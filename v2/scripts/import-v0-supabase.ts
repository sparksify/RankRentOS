// V0 import → RankRent OS as legacy observations, idempotent via run (kind,paramsHash).
// Run: node --experimental-strip-types scripts/import-v0-supabase.ts
import { readFileSync } from "fs";
import { createSupabaseStore } from "../lib/store/supabase";

const V0_OBSERVED_AT = Date.parse("2026-08-08T00:00:00Z"); // v0 volume/CPC fetch date (documented constant)
const rows = JSON.parse(readFileSync(new URL("../../out/opportunities.json", import.meta.url), "utf8"));
const store = createSupabaseStore();

const paramsHash = `v0-opps-${rows.length}`;
const { run, existing } = await store.beginRun("v0-import", paramsHash, { stage: 0, budgetCapUsd: 0, asOf: V0_OBSERVED_AT });
if (existing && run.status === "completed") {
  console.log(`IDEMPOTENT SKIP: v0-import ${paramsHash} already completed (run ${run.id})`);
  process.exit(0);
}

const batch: any[] = [];
for (const r of rows) {
  if (r.score === undefined) continue;
  const sid = `${r.nicheId}|${r.city}|${r.state}`;
  const g = r.signals || {};
  const base = { subjectType: "market", subjectId: sid, source: "v0-import", confidence: 0.8, observedAt: V0_OBSERVED_AT, legacy: true, runId: run.id };
  if (typeof g.volume === "number") batch.push({ ...base, metric: "kw.volume.exact", value: g.volume, evidenceType: "OBSERVED" });
  if (typeof g.cpc === "number" && g.cpc > 0) batch.push({ ...base, metric: "kw.cpc", value: g.cpc, evidenceType: "OBSERVED" });
  if (typeof g.demandFloor === "number") batch.push({ ...base, metric: "kw.autocomplete.floor", value: g.demandFloor, evidenceType: "DERIVED", confidence: 0.6 });
}
console.log(`markets: ${rows.length} | observations to import: ${batch.length}`);
let n = 0;
for (let i = 0; i < batch.length; i += 500) {
  const inserted = await store.insertBatch(batch.slice(i, i + 500));
  n += inserted.length;
  console.log(`  ${n}/${batch.length}`);
}
await store.completeRun(run.id, 0);
console.log(`DONE run ${run.id}: ${n} legacy observations imported`);
