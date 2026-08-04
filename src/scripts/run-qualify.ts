// Phase 3 — low-cost qualification over all markets. Free (uses only owned
// observations). Emits qualifications JSON + SQL (job, tasks, candidates).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadCorpus, nicheAttrs, keywordTerm, marketKey, trendWeightFor, V0_OBSERVED_AT, ROOT } from '../pipeline/corpus.js';
import { qualifyMarket } from '../pipeline/qualify.js';
import { QUALIFICATION_VERSION } from '../core/config.js';
import { ids } from '../db/ids.js';
import { insertSqlChunked } from '../db/sql.js';
import type { Qualification } from '../core/types.js';

const corpus = loadCorpus();
const outState = join(ROOT, 'out', 'state');
const outSql = join(ROOT, 'out', 'sql');
mkdirSync(outState, { recursive: true });
mkdirSync(outSql, { recursive: true });

const runKey = `qualify|${QUALIFICATION_VERSION}`;
const jobId = ids.job('qualification', runKey);
const startedAt = new Date().toISOString();

const qualifications: (Qualification & { nicheSlug: string; city: string; state: string })[] = [];
for (const n of corpus.niches) {
  const attrs = nicheAttrs(n);
  const tw = trendWeightFor(corpus, n);
  for (const c of corpus.cities) {
    const term = keywordTerm(n, c);
    const v = corpus.volumes[term];
    const q = qualifyMarket({
      marketKey: marketKey(n.id, c.city, c.state),
      niche: { slug: n.id, attrs },
      city: { name: c.city, state: c.state, population: c.pop ?? null, householdIncome: c.income ?? null, growth: c.growth ?? null },
      keyword: { term, volume: v?.vol ?? null, cpc: v?.cpc ?? null, competition: v?.competition ?? null, observedAt: v ? V0_OBSERVED_AT : null },
      trendWeight: tw,
    });
    qualifications.push({ ...q, nicheSlug: n.id, city: c.city, state: c.state });
  }
}

const passed = qualifications.filter((q) => q.result === 'passed');
const needs = qualifications.filter((q) => q.result === 'needs_research');
const failed = qualifications.filter((q) => q.result === 'failed');

// SQL: job + candidate rows + market state updates
const sql: string[] = [];
sql.push(
  ...insertSqlChunked('rros_jobs', [{
    id: jobId, type: 'qualification',
    params: { version: QUALIFICATION_VERSION, markets: qualifications.length },
    status: 'completed',
    progress: { passed: passed.length, needs_research: needs.length, failed: failed.length },
    budget_usd: 0, actual_cost_usd: 0,
    started_at: startedAt, completed_at: new Date().toISOString(),
  }])
);
sql.push(
  ...insertSqlChunked('rros_tasks', [{
    id: ids.task(jobId, 'run-qualification'), job_id: jobId, type: 'run_qualification',
    params: { version: QUALIFICATION_VERSION }, status: 'completed', idempotency_key: 'run-qualification',
  }])
);

const candidateRows = qualifications.map((q) => {
  const mId = ids.market(q.nicheSlug, q.city, q.state);
  return {
    id: ids.candidate(mId, q.version, q.inputHash),
    market_id: mId,
    qualification_version: q.version,
    result: q.result,
    reasons: q.reasons,
    confidence: q.confidence,
    input_hash: q.inputHash,
    research_status: 'none',
  };
});
sql.push(...insertSqlChunked('rros_candidates', candidateRows, { conflictTarget: '(market_id, qualification_version, input_hash)' }));

// Market research-state updates
for (const bucket of [
  { rows: passed, state: 'qualified' },
  { rows: failed, state: 'rejected' },
]) {
  const idsList = bucket.rows.map((q) => `'${ids.market(q.nicheSlug, q.city, q.state)}'`);
  for (let i = 0; i < idsList.length; i += 500) {
    sql.push(`update rros_markets set research_state='${bucket.state}', last_researched_at=now() where id in (${idsList.slice(i, i + 500).join(',')});`);
  }
}

writeFileSync(join(outSql, '02_qualify.sql'), sql.filter(Boolean).join('\n\n'));
writeFileSync(join(outState, 'qualifications.json'), JSON.stringify({ version: QUALIFICATION_VERSION, computedAt: new Date().toISOString(), qualifications }, null, 1));

// Deep-research queue: diversified, not raw-top-N — max 3 markets per niche
// (repeatability still visible) capped at 30 (cost control), so high-ticket
// niches that qualify on economics rather than raw volume reach deep research.
const MAX_PER_NICHE = 3;
const QUEUE_CAP = 30;
const byNiche = new Map<string, typeof passed>();
for (const q of [...passed].sort((a, b) => b.preliminaryScore - a.preliminaryScore)) {
  const list = byNiche.get(q.nicheSlug) ?? [];
  if (list.length < MAX_PER_NICHE) byNiche.set(q.nicheSlug, [...list, q]);
}
const topPassed = [...byNiche.values()].flat()
  .sort((a, b) => b.preliminaryScore - a.preliminaryScore)
  .slice(0, QUEUE_CAP);
writeFileSync(join(outState, 'deep-research-queue.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  note: `Deep-research queue: top qualified markets, max ${MAX_PER_NICHE}/niche, cap ${QUEUE_CAP}`,
  queue: topPassed.map((q) => ({ marketKey: q.marketKey, nicheSlug: q.nicheSlug, city: q.city, state: q.state, preliminaryScore: q.preliminaryScore, confidence: q.confidence })),
}, null, 1));

console.log(`Qualification ${QUALIFICATION_VERSION}: ${passed.length} passed, ${needs.length} needs research, ${failed.length} failed (of ${qualifications.length})`);
console.log('Top 15 by preliminary score:');
for (const q of topPassed.slice(0, 15)) console.log(`  ${String(q.preliminaryScore).padStart(3)}  ${q.marketKey}`);
