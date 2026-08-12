import { parseVolumeResponse } from "../lib/providers/dataforseo";
// Stage 2 salvage: parse the batch that completed BEFORE the DataForSEO balance
// was exhausted (700/846 keywords, actual cost $0.09). No new paid calls.
import { readFileSync, writeFileSync } from "fs";

const OUT = new URL("../../out/experiment-2/", import.meta.url);
const H = JSON.parse(readFileSync(new URL("hypotheses.json", OUT), "utf8"));
const raw = JSON.parse(readFileSync(new URL("raw-volume-0.json", OUT), "utf8"));
const kw = (h: any) => `${h.kw} ${h.city}`.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
const all = [...new Set(H.hyps.map(kw))] as string[];
const chunk = all.slice(0, 700);
const vols: Record<string, any> = {};
for (const r of parseVolumeResponse(raw, chunk)) vols[r.keyword] = { vol: r.vol ?? 0, cpc: r.cpc ?? null, comp: r.competition ?? null };
const DEMAND_FLOOR = 100;
const survivors: any[] = [], rejected: any[] = [], unmeasured: any[] = [];
for (const h of H.hyps) {
  const v = vols[kw(h)];
  if (!v) { unmeasured.push(h); continue; }               // batch 2 never ran (unfunded)
  h.vol = v.vol; h.cpc = v.cpc;
  if (h.vol < DEMAND_FLOOR) { rejected.push({ id: h.id, cat: h.cat, reason: `demand ${h.vol}/mo < ${DEMAND_FLOOR}` }); continue; }
  if (h.cpc !== null && h.cpc > 25) { rejected.push({ id: h.id, cat: h.cat, reason: `CPC $${h.cpc} extreme ad war` }); continue; }
  survivors.push(h);
}
survivors.sort((a, b) => b.vol - a.vol);
writeFileSync(new URL("stage2-survivors.json", OUT), JSON.stringify({ actualCost: 0.09, measured: chunk.length, survivors, rejected, unmeasured: unmeasured.length }, null, 1));
const byCat = survivors.reduce((a: any, s) => { a[s.cat] = (a[s.cat] || 0) + 1; return a; }, {});
console.log(`measured: ${chunk.length}/${all.length} keywords (batch 2 blocked: unfunded)`);
console.log(`survivors >=${DEMAND_FLOOR}/mo: ${survivors.length} | rejected: ${rejected.length} | unmeasured: ${unmeasured.length}`);
console.log("survivor categories:", JSON.stringify(byCat));
console.log("top 12:"); survivors.slice(0, 12).forEach((s) => console.log(`  ${String(s.vol).padStart(5)}/mo $${String(s.cpc ?? "-").padStart(5)} | ${s.svcLabel} — ${s.city}, ${s.state} [${s.cat}]`));
