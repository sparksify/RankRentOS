// Phase 1b — ingest the v0 corpus into canonical rows + raw evidence.
// Emits out/state/*.json for downstream stages and out/sql/01_ingest.sql for DB load.
// Idempotent: deterministic UUIDs + checksum-keyed evidence + on-conflict-do-nothing.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadCorpus, nicheAttrs, keywordTerm, V0_OBSERVED_AT, ROOT } from '../pipeline/corpus.js';
import { ids } from '../db/ids.js';
import { insertSqlChunked } from '../db/sql.js';
import { evidenceChecksum } from '../core/hash.js';
import { configRows } from '../core/config.js';

const corpus = loadCorpus();
const outState = join(ROOT, 'out', 'state');
const outSql = join(ROOT, 'out', 'sql');
mkdirSync(outState, { recursive: true });
mkdirSync(outSql, { recursive: true });

const sql: string[] = [];

// --- Raw evidence for each imported source file ---
const evidenceRows = [
  { provider: 'v0-repo', requestType: 'niches_seed', params: { file: 'data/niches.json' }, payload: corpus.niches },
  { provider: 'v0-repo', requestType: 'cities_seed', params: { file: 'data/cities.json' }, payload: corpus.cities },
  { provider: 'dataforseo', requestType: 'search_volume_corpus', params: { file: 'data/volumes.json' }, payload: corpus.volumes },
  ...(corpus.trends ? [{ provider: 'serpapi_trends', requestType: 'trends_weights', params: { file: 'data/trends.json' }, payload: corpus.trends }] : []),
].map((e) => {
  const checksum = evidenceChecksum(e.provider, e.requestType, e.params, e.payload);
  return {
    id: ids.evidence(checksum),
    provider: e.provider,
    request_type: e.requestType,
    request_params: e.params,
    source_id: (e.params as { file: string }).file,
    observed_at: e.provider === 'serpapi_trends' && corpus.trends ? corpus.trends.builtAt : V0_OBSERVED_AT,
    checksum,
    payload: e.payload,
    cost_usd: 0,
  };
});
sql.push(...insertSqlChunked('rros_raw_evidence', evidenceRows, { conflictTarget: '(checksum)' }, 5));
const evidenceIdByType = Object.fromEntries(evidenceRows.map((r) => [r.request_type, r.id]));

// --- Niches + playbooks v1 ---
const nicheRows = corpus.niches.map((n) => ({
  id: ids.niche(n.id),
  name: n.label,
  slug: n.id,
  description: null,
  active: true,
  attrs: nicheAttrs(n),
}));
sql.push(...insertSqlChunked('rros_niches', nicheRows));

const playbookRows = corpus.niches.map((n) => ({
  id: ids.playbook(n.id, 1),
  niche_id: ids.niche(n.id),
  name: `${n.label} Playbook`,
  version: 1,
  status: 'active',
  build_verdict: 'build',
  discovery_criteria: { archetype: n.archetype, minIncome: n.archetype === 'affluent-suburb' ? 90000 : null },
  keyword_strategy: { primaryQuery: n.query, acQuery: n.acQuery, domainTerms: n.domainTerms },
  revenue_assumptions: { ticketLow: n.ticketLow, ticketHigh: n.ticketHigh, margin: n.margin, seasonal: n.seasonal },
  operator_criteria: { profile: 'local operator ranked below #5 or absent from organic; buys leads or advertises' },
  known_risks: n.peRisk !== 'low' ? [`PE roll-up risk: ${n.peRisk}`] : [],
  kill_criteria: ['zero measured volume and no autocomplete demand', 'top-3 owned by brand-search franchises'],
}));
sql.push(...insertSqlChunked('rros_playbooks', playbookRows));

// --- Cities + geographic observations ---
const cityRows = corpus.cities.map((c) => ({
  id: ids.city(c.city, c.state),
  name: c.city,
  state: c.state,
  region: c.region,
  external_ids: {},
}));
sql.push(...insertSqlChunked('rros_cities', cityRows, { conflictTarget: '(name, state)' }));

const geoObsRows = corpus.cities.flatMap((c) => {
  const cityId = ids.city(c.city, c.state);
  const base = {
    geo_type: 'city',
    geo_id: cityId,
    dataset: 'v0-curated',
    dataset_year: 2026,
    source: 'v0-curated',
    observed_at: V0_OBSERVED_AT,
    evidence_id: evidenceIdByType['cities_seed'],
  };
  return [
    { id: ids.geoObs(cityId, 'population', 'v0-curated', V0_OBSERVED_AT), ...base, metric: 'population', value_num: c.pop, value_text: null },
    { id: ids.geoObs(cityId, 'household_income', 'v0-curated', V0_OBSERVED_AT), ...base, metric: 'household_income', value_num: c.income, value_text: null },
    { id: ids.geoObs(cityId, 'growth', 'v0-curated', V0_OBSERVED_AT), ...base, metric: 'growth', value_num: null, value_text: c.growth },
  ];
});
sql.push(...insertSqlChunked('rros_geo_observations', geoObsRows));

// --- Markets (niche × city) ---
const marketRows = corpus.niches.flatMap((n) =>
  corpus.cities.map((c) => ({
    id: ids.market(n.id, c.city, c.state),
    niche_id: ids.niche(n.id),
    geo_type: 'city',
    geo_id: ids.city(c.city, c.state),
    research_state: 'unresearched',
    freshness_state: 'unknown',
  }))
);
sql.push(...insertSqlChunked('rros_markets', marketRows, { conflictTarget: '(niche_id, geo_type, geo_id)' }));

// --- Keywords + observations from the 1,392-keyword corpus ---
const keywordRows: Record<string, unknown>[] = [];
const kwObsRows: Record<string, unknown>[] = [];
for (const n of corpus.niches) {
  for (const c of corpus.cities) {
    const term = keywordTerm(n, c);
    const geoScope = `city:${ids.city(c.city, c.state)}`;
    const v = corpus.volumes[term];
    keywordRows.push({
      id: ids.keyword(term, geoScope),
      niche_id: ids.niche(n.id),
      term,
      intent: 'commercial',
      geo_scope: geoScope,
    });
    if (v !== undefined) {
      kwObsRows.push({
        id: ids.keywordObs(term, 'dataforseo', V0_OBSERVED_AT),
        keyword_id: ids.keyword(term, geoScope),
        volume: v.vol,
        cpc: v.cpc,
        competition: v.competition,
        provider: 'dataforseo',
        observed_at: V0_OBSERVED_AT,
        evidence_id: evidenceIdByType['search_volume_corpus'],
      });
    }
  }
}
sql.push(...insertSqlChunked('rros_keywords', keywordRows, { conflictTarget: '(term, geo_scope)' }));
sql.push(...insertSqlChunked('rros_keyword_observations', kwObsRows));

// --- Config rows (versioned weights/thresholds/policies) ---
sql.push(
  ...insertSqlChunked(
    'rros_config',
    configRows().map((r) => ({ key: r.key, value: r.value })),
    { conflictTarget: '(key)', onConflict: 'update', updateColumns: ['value'] }
  )
);

writeFileSync(join(outSql, '01_ingest.sql'), sql.filter(Boolean).join('\n\n'));
writeFileSync(
  join(outState, 'ingest-summary.json'),
  JSON.stringify(
    {
      ingestedAt: new Date().toISOString(),
      niches: nicheRows.length,
      playbooks: playbookRows.length,
      cities: cityRows.length,
      geoObservations: geoObsRows.length,
      markets: marketRows.length,
      keywords: keywordRows.length,
      keywordObservations: kwObsRows.length,
      evidenceRecords: evidenceRows.length,
      observedAt: V0_OBSERVED_AT,
    },
    null,
    2
  )
);
console.log(`Ingest: ${nicheRows.length} niches, ${cityRows.length} cities, ${marketRows.length} markets, ${kwObsRows.length} keyword observations → out/sql/01_ingest.sql`);
