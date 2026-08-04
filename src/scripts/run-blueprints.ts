// Phase 8 — Blueprint Lite for every batch target (primaries + alternates).
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadCorpus, nicheAttrs, keywordTerm, V0_OBSERVED_AT, trendWeightFor, ROOT } from '../pipeline/corpus.js';
import { generateBlueprint } from '../pipeline/blueprint.js';
import type { LensInput } from '../lens/opportunity-v1.js';
import { loadDomainEvidence } from '../providers/domains/evidence-import.js';
import { domainCandidates } from '../pipeline/domains.js';
import { ids } from '../db/ids.js';
import { insertSqlChunked } from '../db/sql.js';
import { writeLoadOps } from '../db/rows.js';
import type { DeepResearchEvidence } from '../core/types.js';

const corpus = loadCorpus();
const outState = join(ROOT, 'out', 'state');
const outSql = join(ROOT, 'out', 'sql');
mkdirSync(outSql, { recursive: true });

const { scores } = JSON.parse(readFileSync(join(outState, 'scores.json'), 'utf8')) as { scores: any[] };
const selection = JSON.parse(readFileSync(join(outState, 'selection.json'), 'utf8')) as { primaries: any[]; alternates: any[] };

const deepDir = join(ROOT, 'evidence', 'deep');
const deepByMarket = new Map<string, DeepResearchEvidence>();
if (existsSync(deepDir)) {
  for (const f of readdirSync(deepDir).filter((x) => x.endsWith('.json')).sort()) {
    const d = JSON.parse(readFileSync(join(deepDir, f), 'utf8')) as DeepResearchEvidence;
    deepByMarket.set(d.marketKey, d);
  }
}
const domainObs = loadDomainEvidence(join(ROOT, 'evidence', 'domains'));
const domainByName = new Map(domainObs.map((d) => [d.domain, d]));

const nicheBySlug = new Map(corpus.niches.map((n) => [n.id, n]));
const cityByKey = new Map(corpus.cities.map((c) => [`${c.city}|${c.state}`, c]));

const targets = [...selection.primaries, ...selection.alternates];
const blueprints: any[] = [];
const rows: Record<string, unknown>[] = [];

for (const t of targets) {
  const s = scores.find((x) => x.marketKey === t.marketKey);
  const deep = deepByMarket.get(t.marketKey) ?? null;
  if (!s) continue;
  const n = nicheBySlug.get(s.nicheSlug)!;
  const c = cityByKey.get(`${s.city}|${s.state}`)!;
  const term = keywordTerm(n, c);
  const v = corpus.volumes[term];

  const candidateNames = deep?.domains.length
    ? deep.domains.map((d) => d.domain.toLowerCase())
    : domainCandidates({ attrs: nicheAttrs(n) }, c.city);
  const avail = candidateNames
    .map((name) => domainByName.get(name))
    .filter((d) => d?.available === true)
    .map((d) => d!.domain);

  const lensInput: LensInput = {
    marketKey: t.marketKey,
    niche: { slug: n.id, attrs: nicheAttrs(n) },
    city: { name: c.city, state: c.state, population: c.pop ?? null, householdIncome: c.income ?? null, growth: c.growth ?? null },
    keyword: { term, volume: v?.vol ?? null, cpc: v?.cpc ?? null, observedAt: v ? V0_OBSERVED_AT : null },
    trendWeight: trendWeightFor(corpus, n),
    deep,
    domainAvailability: { available: avail.length, bestDomain: s.bestDomain, checkedAt: s.domainCheckedAt, registrarVerified: s.registrarVerified },
    nicheRepeatCount: 0,
  };

  const bp = generateBlueprint(
    lensInput, deep,
    { recommended: s.bestDomain, alternatives: avail.filter((d: string) => d !== s.bestDomain).slice(0, 4), checkedAt: s.domainCheckedAt },
    { overall: s.overall, confidence: s.confidence },
    [{ term, volume: v?.vol ?? null, cpc: v?.cpc ?? null }]
  );
  blueprints.push(bp);

  const mId = ids.market(s.nicheSlug, s.city, s.state);
  const oppId = ids.opportunity(mId);
  rows.push({
    id: ids.blueprint(oppId, 1),
    opportunity_id: oppId,
    version: 1,
    recommended_domain: bp.recommendedDomain,
    alt_domains: bp.altDomains,
    domain_availability_checked_at: bp.domainCheckedAt,
    target_services: bp.primaryServices,
    target_geography: { city: s.city, state: s.state, marketKey: t.marketKey },
    sitemap: bp.sitemap,
    content_plan: bp.contentPlan,
    authority_assumptions: bp.authorityAssumptions,
    operator_strategy: { summary: bp.operatorSummary },
    est_cost_low: bp.estCost[0], est_cost_high: bp.estCost[1],
    est_rank_months_low: bp.estRankMonths[0], est_rank_months_high: bp.estRankMonths[1],
    est_leads_low: bp.estLeadsMo[0], est_leads_high: bp.estLeadsMo[1],
    est_revenue_low: bp.estRevenueMo[0], est_revenue_high: bp.estRevenueMo[1],
    risks: bp.risks,
    assumptions: bp.assumptions,
    confidence: bp.confidence,
    status: 'draft',
  });
}

writeFileSync(join(outSql, '05_blueprints.sql'), insertSqlChunked('rros_blueprint_versions', rows, { conflictTarget: '(opportunity_id, version)', onConflict: 'update', updateColumns: ['recommended_domain', 'alt_domains', 'risks', 'assumptions', 'confidence'] }).join('\n\n'));
writeLoadOps('50-blueprints', [
  { op: 'upsert', table: 'rros_blueprint_versions', onConflict: 'opportunity_id,version', merge: true, rows },
]);
writeFileSync(join(outState, 'blueprints.json'), JSON.stringify({ generatedAt: new Date().toISOString(), blueprints }, null, 1));
console.log(`Generated ${blueprints.length} Blueprint Lite records → out/state/blueprints.json`);
