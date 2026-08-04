// Phase 5/7 — Batch 1 selection: raw ranking + recommended 10 + alternates.
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../pipeline/corpus.js';
import { selectBatch, type SelectableMarket } from '../pipeline/select.js';
import { ids } from '../db/ids.js';
import { insertSqlChunked } from '../db/sql.js';
import { writeLoadOps, type LoadOp } from '../db/rows.js';

const outState = join(ROOT, 'out', 'state');
const outSql = join(ROOT, 'out', 'sql');
mkdirSync(outSql, { recursive: true });

const { scores } = JSON.parse(readFileSync(join(outState, 'scores.json'), 'utf8')) as { scores: any[] };

const selectable: SelectableMarket[] = scores.map((s) => ({
  marketKey: s.marketKey,
  nicheSlug: s.nicheSlug,
  city: s.city,
  state: s.state,
  region: s.region,
  score: {
    lens: 'rank-rent-opportunity', lensVersion: '', weightsVersion: '',
    overall: s.overall, subscores: s.subscores, confidence: s.confidence,
    reasons: s.reasons, inputHash: s.inputHash, computedAt: '',
  },
  domainAvailable: s.domainsAvailable > 0,
  estRevenueMid: s.estRevenueMid,
}));

const result = selectBatch(selectable, 10, 12);

const rows = [...result.primaries, ...result.alternates].map((e) => {
  const s = scores.find((x) => x.marketKey === e.marketKey)!;
  const mId = ids.market(s.nicheSlug, s.city, s.state);
  const oppId = ids.opportunity(mId);
  return {
    id: ids.batchTarget('batch-1', oppId),
    batch: 'batch-1',
    position: e.role === 'primary' ? e.position : 100 + e.position,
    opportunity_id: oppId,
    role: e.role,
    inclusion_reasons: e.inclusionReasons,
    decision: 'pending',
  };
});
const sql = [
  ...insertSqlChunked('rros_batch_targets', rows, { conflictTarget: '(batch, opportunity_id)', onConflict: 'update', updateColumns: ['position', 'role', 'inclusion_reasons'] }),
  ...result.primaries.map((e) => {
    const s = scores.find((x) => x.marketKey === e.marketKey)!;
    return `update rros_opportunities set state='recommended' where market_id='${ids.market(s.nicheSlug, s.city, s.state)}';`;
  }),
];
writeFileSync(join(outSql, '04_select.sql'), sql.join('\n\n'));
writeLoadOps('40-select', [
  { op: 'upsert', table: 'rros_batch_targets', onConflict: 'batch,opportunity_id', merge: true, rows },
  ...result.primaries.map((e): LoadOp => {
    const s = scores.find((x) => x.marketKey === e.marketKey)!;
    return { op: 'update', table: 'rros_opportunities', filter: `market_id=eq.${ids.market(s.nicheSlug, s.city, s.state)}`, set: { state: 'recommended' } };
  }),
]);
writeFileSync(join(outState, 'selection.json'), JSON.stringify(result, null, 1));

console.log(`Selection ${result.version}: ${result.primaries.length} primaries, ${result.alternates.length} alternates`);
console.log('\nRecommended Batch 1:');
for (const p of result.primaries) console.log(`  #${p.position} (raw rank ${p.rank}) ${p.marketKey}`);
console.log('\nNotes:');
for (const nt of result.notes) console.log(`  - ${nt}`);
