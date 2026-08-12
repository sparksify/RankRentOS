// EXPERIMENT 2 — Stage 2: measured demand screen (cheapest paid evidence first).
// Records ACTUAL provider cost from the response, not list-price estimates.
import { readFileSync, writeFileSync } from "fs";
import { createSupabaseStore } from "../lib/store/supabase";
import { volumeRequest, parseVolumeResponse, DFS_VOLUME_URL } from "../lib/providers/dataforseo";

const OUT = new URL("../../out/experiment-2/", import.meta.url);
const H = JSON.parse(readFileSync(new URL("hypotheses.json", OUT), "utf8"));
const hyps = H.hyps;
const DFS = process.env.DATAFORSEO_AUTH!;
const store = createSupabaseStore();
const DEMAND_FLOOR = 100;   // gate-v2: measured local demand floor (documented)

const kw = (h: any) => `${h.kw} ${h.city}`.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
const keywords = [...new Set(hyps.map(kw))] as string[];
console.log(`Stage 2: ${hyps.length} hypotheses -> ${keywords.length} unique keywords`);

const run = await store.beginRun("exp2-demand", `exp2-vol-${keywords.length}`, { stage: 2, budgetCapUsd: 3.0 });
let actualCost = 0;
const vols: Record<string, { vol: number; cpc: number | null; comp: number | null }> = {};
if (!(run.existing && run.run.status === "completed")) {
  for (let i = 0; i < keywords.length; i += 700) {
    const chunk = keywords.slice(i, i + 700);
    const res = await fetch(DFS_VOLUME_URL, { method: "POST", headers: { authorization: `Basic ${DFS}`, "content-type": "application/json" }, body: volumeRequest(chunk).body });
    const raw = await res.json();
    writeFileSync(new URL(`raw-volume-${i}.json`, OUT), JSON.stringify(raw));
    actualCost += raw.cost ?? 0;                       // ACTUAL provider cost
    for (const r of parseVolumeResponse(raw, chunk) as any[]) vols[r.keyword] = { vol: r.vol ?? 0, cpc: r.cpc ?? null, comp: r.competition ?? null };
    console.log(`  batch ${i / 700 + 1}: ${chunk.length} kw, cost so far $${actualCost.toFixed(4)}`);
  }
  await store.charge(run.run.id, "dataforseo", keywords.length, actualCost);
  await store.completeRun(run.run.id, actualCost);
} else { console.log("idempotent skip — reusing prior run"); }

// attach + gate
const survivors: any[] = [], rejected: any[] = [];
for (const h of hyps) {
  const v = vols[kw(h)];
  h.vol = v?.vol ?? null; h.cpc = v?.cpc ?? null; h.comp = v?.comp ?? null;
  if (h.vol === null) { rejected.push({ ...h, reason: "no volume data returned" }); continue; }
  if (h.vol < DEMAND_FLOOR) { rejected.push({ ...h, reason: `measured demand ${h.vol}/mo below ${DEMAND_FLOOR} floor` }); continue; }
  if (h.cpc !== null && h.cpc > 25) { rejected.push({ ...h, reason: `CPC $${h.cpc} indicates an extreme ad war` }); continue; }
  survivors.push(h);
}
survivors.sort((a, b) => b.vol - a.vol);
writeFileSync(new URL("stage2-survivors.json", OUT), JSON.stringify({ demandFloor: DEMAND_FLOOR, actualCost, survivors, rejectedCount: rejected.length }, null, 1));
writeFileSync(new URL("stage2-rejected.json", OUT), JSON.stringify(rejected.slice(0, 400), null, 1));

const byCat = survivors.reduce((a: any, s) => { a[s.cat] = (a[s.cat] || 0) + 1; return a; }, {});
const rr = rejected.reduce((a: any, r) => { const k = r.reason.replace(/\d+/g, "N"); a[k] = (a[k] || 0) + 1; return a; }, {});
console.log(`\nACTUAL provider cost: $${actualCost.toFixed(4)}`);
console.log(`survivors (>=${DEMAND_FLOOR}/mo): ${survivors.length} | rejected: ${rejected.length}`);
console.log("survivor categories:", JSON.stringify(byCat));
console.log("rejection reasons:", JSON.stringify(rr));
console.log("\ntop 15 by measured demand:");
survivors.slice(0, 15).forEach((s) => console.log(`  ${String(s.vol).padStart(5)}/mo $${String(s.cpc ?? "-").padStart(5)} | ${s.svcLabel} — ${s.city}, ${s.state} [${s.cat}]`));
