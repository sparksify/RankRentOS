// Phase 4 — Opportunity Lens v1 over deep-researched candidates.
// Consumes evidence/deep/*.json (DeepResearchEvidence per market) and
// evidence/domains/*.json (registrar-grade availability), resolves business
// identities, and emits scores + opportunities + all evidence rows as SQL.
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadCorpus, nicheAttrs, keywordTerm, marketKey, trendWeightFor, V0_OBSERVED_AT, ROOT } from '../pipeline/corpus.js';
import { runOpportunityLens, estimateValue, type LensInput } from '../lens/opportunity-v1.js';
import { loadDomainEvidence } from '../providers/domains/evidence-import.js';
import { classifyResult, hostOf } from '../pipeline/serp-signals.js';
import { domainCandidates, pickWinner } from '../pipeline/domains.js';
import { dedupeIdentities, rootDomainOf } from '../identity/resolve.js';
import { ids } from '../db/ids.js';
import { insertSqlChunked } from '../db/sql.js';
import { evidenceChecksum } from '../core/hash.js';
import { writeLoadOps, type LoadOp } from '../db/rows.js';
import type { BusinessIdentity, DeepResearchEvidence } from '../core/types.js';

const corpus = loadCorpus();
const outState = join(ROOT, 'out', 'state');
const outSql = join(ROOT, 'out', 'sql');
mkdirSync(outState, { recursive: true });
mkdirSync(outSql, { recursive: true });

// --- Load deep research evidence ---
const deepDir = join(ROOT, 'evidence', 'deep');
const deepByMarket = new Map<string, DeepResearchEvidence>();
const deepFileByMarket = new Map<string, string>();
if (existsSync(deepDir)) {
  for (const f of readdirSync(deepDir).filter((x) => x.endsWith('.json')).sort()) {
    const d = JSON.parse(readFileSync(join(deepDir, f), 'utf8')) as DeepResearchEvidence;
    deepFileByMarket.set(d.marketKey, `evidence/deep/${f}`);
    // Classification runs at import so signal definitions stay centralized.
    if (d.serp) {
      d.serp.results = d.serp.results.map((r) => ({
        ...r,
        domain: r.domain ?? hostOf(r.url),
        ...classifyResult({ ...r, domain: r.domain ?? hostOf(r.url) }, d.serp!.query),
      }));
    }
    deepByMarket.set(d.marketKey, d);
  }
}

// --- Load domain evidence (registrar-verified availability) ---
const domainObs = loadDomainEvidence(join(ROOT, 'evidence', 'domains'));
const domainByName = new Map(domainObs.map((d) => [d.domain, d]));
// Single evidence record for the registrar batch file (payload via storage_ref)
const domainBatchFile = existsSync(join(ROOT, 'evidence', 'domains'))
  ? readdirSync(join(ROOT, 'evidence', 'domains')).filter((f) => f.endsWith('.json')).sort()[0] ?? null
  : null;
const domainBatchChecksum = domainBatchFile
  ? evidenceChecksum('vercel_registrar', 'availability_batch', { file: domainBatchFile }, readFileSync(join(ROOT, 'evidence', 'domains', domainBatchFile), 'utf8'))
  : 'none';
const domainBatchEvidenceId = ids.evidence(domainBatchChecksum);

// --- Which markets to score: those with deep evidence ---
const nicheBySlug = new Map(corpus.niches.map((n) => [n.id, n]));
const cityByKey = new Map(corpus.cities.map((c) => [`${c.city}|${c.state}`, c]));

// Niche repeat counts across the deep pool (repeatability signal)
const nicheRepeat = new Map<string, number>();
for (const d of deepByMarket.values()) {
  nicheRepeat.set(d.nicheSlug, (nicheRepeat.get(d.nicheSlug) ?? 0) + 1);
}

const sql: string[] = [];
const jobId = ids.job('deep_scoring', `score|${new Date().toISOString().slice(0, 10)}`);
const scoreSummaries: Record<string, unknown>[] = [];

// Evidence + snapshots + results + businesses + domains rows accumulate across markets
const evidenceRows: Record<string, unknown>[] = [];
const snapshotRows: Record<string, unknown>[] = [];
const serpResultRows: Record<string, unknown>[] = [];
const businessRows = new Map<string, Record<string, unknown>>();
const bizObsRows: Record<string, unknown>[] = [];
const membershipRows: Record<string, unknown>[] = [];
const domainRows = new Map<string, Record<string, unknown>>();
const domainObsRows: Record<string, unknown>[] = [];
const opportunityRows: Record<string, unknown>[] = [];
const scoreRows: Record<string, unknown>[] = [];
const marketUpdates: string[] = [];
const marketUpdateOps: LoadOp[] = [];

for (const [mk, deep] of deepByMarket) {
  const n = nicheBySlug.get(deep.nicheSlug);
  const c = cityByKey.get(`${deep.city}|${deep.state}`);
  if (!n || !c) {
    console.warn(`skip ${mk}: unknown niche or city`);
    continue;
  }
  const mId = ids.market(n.id, c.city, c.state);
  const term = keywordTerm(n, c);
  const v = corpus.volumes[term];

  // Domain availability rollup: generated candidates × registrar observations
  const candidateNames = deep.domains.length
    ? deep.domains.map((d) => d.domain.toLowerCase())
    : domainCandidates({ attrs: nicheAttrs(n) }, c.city);
  const marketDomains = candidateNames
    .map((name) => domainByName.get(name))
    .filter((d): d is NonNullable<typeof d> => d !== undefined);
  const availableList = marketDomains.filter((d) => d.available === true);
  const registrarVerified = availableList.some((d) => d.provider === 'vercel_registrar' || d.provider === 'namecheap');
  const picked = pickWinner(availableList.map((d) => d.domain), { attrs: nicheAttrs(n) }, c.city);
  const available = availableList;
  const bestDomain = picked?.domain ?? null;
  const checkedAt = marketDomains[0]?.observedAt ?? null;

  const lensInput: LensInput = {
    marketKey: mk,
    niche: { slug: n.id, attrs: nicheAttrs(n) },
    city: { name: c.city, state: c.state, population: c.pop ?? null, householdIncome: c.income ?? null, growth: c.growth ?? null },
    keyword: { term, volume: v?.vol ?? null, cpc: v?.cpc ?? null, observedAt: v ? V0_OBSERVED_AT : null },
    trendWeight: trendWeightFor(corpus, n),
    deep,
    domainAvailability: { available: available.length, bestDomain, checkedAt, registrarVerified },
    nicheRepeatCount: (nicheRepeat.get(n.id) ?? 1) - 1,
  };
  const score = runOpportunityLens(lensInput);
  const value = estimateValue(lensInput);

  // --- SERP snapshot + results rows ---
  // Raw payload lives in the committed evidence file; DB row carries storage_ref.
  if (deep.serp) {
    const snapChecksum = deep.serp.evidenceChecksum ?? evidenceChecksum(deep.serp.provider, 'serp', { query: deep.serp.query }, deep.serp.results);
    const evId = ids.evidence(snapChecksum);
    evidenceRows.push({
      id: evId, provider: deep.serp.provider, request_type: 'serp',
      request_params: { query: deep.serp.query, ...deep.serp.geoParams },
      source_id: mk, observed_at: deep.serp.observedAt, checksum: snapChecksum,
      payload: null, storage_ref: `git:${deepFileByMarket.get(mk) ?? ''}`,
      cost_usd: deep.serp.costUsd ?? 0, job_id: jobId,
    });
    const snapId = ids.serpSnapshot(deep.serp.query, deep.serp.provider, deep.serp.observedAt);
    snapshotRows.push({
      id: snapId, market_id: mId, keyword_id: ids.keyword(term, `city:${ids.city(c.city, c.state)}`),
      query: deep.serp.query, engine: deep.serp.engine, device: deep.serp.device,
      geo_params: deep.serp.geoParams, provider: deep.serp.provider,
      observed_at: deep.serp.observedAt, evidence_id: evId, cost_usd: deep.serp.costUsd ?? 0,
    });
    for (const r of deep.serp.results) {
      serpResultRows.push({
        id: ids.serpResult(snapId, r.resultType, r.position, r.url ?? r.title ?? ''),
        snapshot_id: snapId, position: r.position, result_type: r.resultType,
        url: r.url ?? null, domain: r.domain ?? null, title: r.title ?? null,
        is_directory: r.isDirectory ?? false, is_franchise: r.isFranchise ?? false,
        is_emd: r.isEmd ?? false, is_inner_page: r.isInnerPage ?? false,
      });
    }
  }

  // --- Business identity resolution (competitors + operator candidates) ---
  const identities: (BusinessIdentity & { role: 'competitor' | 'operator_candidate'; extra: Record<string, unknown> })[] = [
    ...deep.competitors.filter((x) => x.kind !== 'directory').map((x) => ({
      canonicalName: x.name, rootDomain: x.domain, role: 'competitor' as const,
      extra: { kind: x.kind, position: x.position ?? null, signals: x.signals },
    })),
    ...deep.operatorCandidates.map((x) => ({
      canonicalName: x.name, rootDomain: x.domain, primaryPhone: x.phone, role: 'operator_candidate' as const,
      extra: { whyCandidate: x.whyCandidate, source: x.source },
    })),
  ];
  const deduped = dedupeIdentities(identities);
  for (const entry of deduped) {
    const key = rootDomainOf(entry.canonical.rootDomain) ?? entry.canonical.canonicalName.toLowerCase();
    const bId = ids.business(key);
    if (!businessRows.has(bId)) {
      businessRows.set(bId, {
        id: bId, canonical_name: entry.canonical.canonicalName,
        root_domain: rootDomainOf(entry.canonical.rootDomain) ?? null,
        primary_phone: entry.canonical.primaryPhone ?? null,
        identity_confidence: entry.mergedFrom.length > 1 ? 0.85 : 0.7,
        identity_review_state: 'auto',
      });
    }
    const roles = new Set(entry.mergedFrom.map((i) => identities[i]!.role));
    for (const role of roles) {
      membershipRows.push({
        id: ids.membership(bId, role, mId),
        business_id: bId, role, market_id: mId, state: 'active',
      });
    }
    for (const i of entry.mergedFrom) {
      const src = identities[i]!;
      bizObsRows.push({
        id: ids.bizObs(bId, src.role === 'competitor' ? 'competitor_scan' : 'operator_fit', deep.serp?.provider ?? 'web_research', deep.collectedAt),
        business_id: bId,
        obs_type: src.role === 'competitor' ? 'competitor_scan' : 'operator_fit',
        value: src.extra,
        tier: 'scan',
        source: deep.serp?.provider ?? 'web_research',
        inferred: false,
        confidence: 0.7,
        observed_at: deep.collectedAt,
      });
    }
  }

  // --- Domains + observations ---
  // One shared evidence row covers the whole registrar batch file (git-committed).
  for (const d of marketDomains) {
    const dl = d.domain.toLowerCase();
    const dId = ids.domain(dl);
    if (!domainRows.has(dId)) {
      domainRows.set(dId, { id: dId, domain: dl, root_name: dl.replace(/\.[a-z]+$/, ''), tld: dl.split('.').pop() ?? 'com' });
    }
    domainObsRows.push({
      id: ids.domainObs(dl, d.provider, d.observedAt),
      domain_id: dId, available: d.available, reg_price: d.regPrice ?? null,
      premium_price: d.premiumPrice ?? null, registrar: d.registrar ?? null,
      provider: d.provider, observed_at: d.observedAt, evidence_id: domainBatchEvidenceId,
    });
  }

  // --- Opportunity + score ---
  const oppId = ids.opportunity(mId);
  const missing: string[] = [];
  if (!deep.serp) missing.push('serp');
  else if (deep.serp.provider === 'web_search') missing.push('localized_serp');
  if (!deep.serp?.results.some((r) => r.resultType === 'local_pack')) missing.push('local_pack');
  if (deep.operatorCandidates.length < 3) missing.push('operator_bench');
  opportunityRows.push({
    id: oppId, market_id: mId, candidate_id: null,
    state: 'researched',
    evidence_completeness: score.confidence,
    freshness_state: 'fresh',
    blocking_conditions: missing,
    review_state: 'unreviewed',
  });
  scoreRows.push({
    id: ids.score(oppId, score.lens, score.lensVersion, score.inputHash),
    entity_type: 'opportunity', entity_id: oppId,
    lens: score.lens, lens_version: score.lensVersion, weights_version: score.weightsVersion,
    overall: score.overall, subscores: score.subscores, confidence: score.confidence,
    reasons: score.reasons, input_hash: score.inputHash, computed_at: score.computedAt,
  });
  marketUpdates.push(`update rros_markets set research_state='deep_researched', last_researched_at='${deep.collectedAt}', freshness_state='fresh' where id='${mId}';`);
  marketUpdateOps.push({ op: 'update', table: 'rros_markets', filter: `id=eq.${mId}`, set: { research_state: 'deep_researched', last_researched_at: deep.collectedAt, freshness_state: 'fresh' } });

  scoreSummaries.push({
    marketKey: mk, nicheSlug: n.id, city: c.city, state: c.state, region: c.region ?? null,
    overall: score.overall, subscores: score.subscores, confidence: score.confidence,
    reasons: score.reasons, detail: score.detail, inputHash: score.inputHash,
    bestDomain, domainsAvailable: available.length, domainCheckedAt: checkedAt,
    registrarVerified,
    dealType: value.dealType, estLeads: Math.round(value.estLeads * 10) / 10,
    estRevenueMid: value.dealType === 'commission' ? Math.round(value.commissionMonthly * 0.7) : Math.round(value.flatRent * 0.8),
    operatorCandidates: deep.operatorCandidates.length,
    missingEvidence: missing,
  });
}

sql.push(...insertSqlChunked('rros_jobs', [{
  id: jobId, type: 'deep_scoring',
  params: { markets: deepByMarket.size },
  status: 'completed',
  progress: { scored: scoreSummaries.length },
  actual_cost_usd: 0,
  completed_at: new Date().toISOString(),
}]));
sql.push(...insertSqlChunked('rros_raw_evidence', [...evidenceRows, { id: domainBatchEvidenceId, provider: 'vercel_registrar', request_type: 'availability_batch', request_params: { file: domainBatchFile }, source_id: domainBatchFile, observed_at: domainObs[0]?.observedAt ?? new Date().toISOString(), checksum: domainBatchChecksum, payload: null, storage_ref: `git:evidence/domains/${domainBatchFile}`, cost_usd: 0 }], { conflictTarget: '(checksum)' }));
sql.push(...insertSqlChunked('rros_serp_snapshots', snapshotRows));
sql.push(...insertSqlChunked('rros_serp_results', serpResultRows));
sql.push(...insertSqlChunked('rros_businesses', [...businessRows.values()]));
sql.push(...insertSqlChunked('rros_business_observations', bizObsRows));
sql.push(...insertSqlChunked('rros_pipeline_memberships', membershipRows, { conflictTarget: '(business_id, role, market_id)' }));
sql.push(...insertSqlChunked('rros_domains', [...domainRows.values()], { conflictTarget: '(domain)' }));
sql.push(...insertSqlChunked('rros_domain_observations', domainObsRows));
sql.push(...insertSqlChunked('rros_opportunities', opportunityRows, { conflictTarget: '(market_id)', onConflict: 'update', updateColumns: ['evidence_completeness', 'freshness_state', 'blocking_conditions'] }));
sql.push(...insertSqlChunked('rros_scores', scoreRows));
sql.push(...marketUpdates);

writeFileSync(join(outSql, '03_score.sql'), sql.filter(Boolean).join('\n\n'));

const allEvidenceRows = [
  ...evidenceRows,
  ...(domainBatchFile ? [{
    id: domainBatchEvidenceId, provider: 'vercel_registrar', request_type: 'availability_batch',
    request_params: { file: domainBatchFile }, source_id: domainBatchFile,
    observed_at: domainObs[0]?.observedAt ?? new Date().toISOString(),
    checksum: domainBatchChecksum, payload: null, storage_ref: `git:evidence/domains/${domainBatchFile}`, cost_usd: 0,
  }] : []),
];
writeLoadOps('30-score', [
  { op: 'upsert', table: 'rros_jobs', rows: [{ id: jobId, type: 'deep_scoring', params: { markets: deepByMarket.size }, status: 'completed', progress: { scored: scoreSummaries.length }, actual_cost_usd: 0, completed_at: new Date().toISOString() }] },
  { op: 'upsert', table: 'rros_raw_evidence', onConflict: 'checksum', rows: allEvidenceRows },
  { op: 'upsert', table: 'rros_serp_snapshots', rows: snapshotRows },
  { op: 'upsert', table: 'rros_serp_results', rows: serpResultRows },
  { op: 'upsert', table: 'rros_businesses', rows: [...businessRows.values()] },
  { op: 'upsert', table: 'rros_business_observations', rows: bizObsRows },
  { op: 'upsert', table: 'rros_pipeline_memberships', onConflict: 'business_id,role,market_id', rows: membershipRows },
  { op: 'upsert', table: 'rros_domains', onConflict: 'domain', rows: [...domainRows.values()] },
  { op: 'upsert', table: 'rros_domain_observations', rows: domainObsRows },
  { op: 'upsert', table: 'rros_opportunities', onConflict: 'market_id', merge: true, rows: opportunityRows },
  { op: 'upsert', table: 'rros_scores', rows: scoreRows },
  ...marketUpdateOps,
]);
writeFileSync(join(outState, 'scores.json'), JSON.stringify({ computedAt: new Date().toISOString(), scores: scoreSummaries }, null, 1));

const ranked = [...scoreSummaries].sort((a: any, b: any) => b.overall - a.overall);
console.log(`Scored ${scoreSummaries.length} opportunities (deep evidence for ${deepByMarket.size} markets)`);
for (const s of ranked as any[]) {
  console.log(`  ${String(s.overall).padStart(5)} conf ${s.confidence}  ${s.marketKey}  ${s.bestDomain ?? 'NO DOMAIN'} ops:${s.operatorCandidates}`);
}
