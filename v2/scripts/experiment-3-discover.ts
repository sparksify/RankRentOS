// EXPERIMENT 3 — evidence-biased discovery.
// Exp-2 learned: (1) demand is common, weak SERPs are scarce; (2) rankability is
// highest in SMALL and AFFLUENT markets (meanA 57 small vs 47 mid); (3) only
// high-ticket families (Kitchen Remodeling F=77, Mold Remediation) clear the
// rentability floor — high-volume/low-ticket services almost never do.
// So we search deliberately for: high-ticket service x small affluent geography.
//
// Service economics are read from Exp-2's own artifact so the two experiments are
// numerically comparable by construction (no re-declared ticket/margin drift).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { createSupabaseStore } from "../lib/store/supabase";
import { volumeRequest, parseVolumeResponse, DFS_VOLUME_URL, type KeywordVolume } from "../lib/providers/dataforseo";

const E2 = new URL("../../out/experiment-2/", import.meta.url);
const OUT = new URL("../../out/experiment-3/", import.meta.url);
mkdirSync(OUT, { recursive: true });
const DFS = process.env.DATAFORSEO_AUTH;
if (!DFS) throw new Error("DATAFORSEO_AUTH is not set — refusing to run (missing credentials would be misread as missing demand)");
const store = createSupabaseStore();
const DEMAND_FLOOR = 100;
const MAX_KEYWORDS = 3000;          // hard cap: ~$0.39 at Exp-2's observed unit cost

// ---------- services: high-ticket families, economics inherited from Exp-2 ----------
const E2H = JSON.parse(readFileSync(new URL("hypotheses.json", E2), "utf8"));
const catalog = new Map<string, any>();
for (const h of E2H.hyps) if (!catalog.has(h.svc)) catalog.set(h.svc, { svc: h.svc, svcLabel: h.svcLabel, cat: h.cat, kw: h.kw, ticket: h.ticket, margin: h.margin });
// Target the families whose realizable value (F) can clear the rentability floor.
const TARGET_CATS = new Set(["high-ticket-home", "specialty-trade", "emergency"]);
const SERVICES = [...catalog.values()].filter((s) => TARGET_CATS.has(s.cat) && s.ticket * s.margin >= 900);
console.log(`services: ${SERVICES.length} high-ticket (>= $900 gross profit/job) from Exp-2 catalog`);

// ---------- geography: small + affluent, excluding everything Exp-2 already tested ----------
const cities = JSON.parse(readFileSync(new URL("../../data/cities-national.json", import.meta.url), "utf8"));
const used = new Set(E2H.hyps.map((h: any) => `${h.city}|${h.state}`));
const GEOS = cities
  .filter((c: any) => c.income && c.pop < 200000 && c.income >= 80000 && !used.has(`${c.city}|${c.state}`))
  // rank by the profile Exp-2 found most rankable: affluent first, smaller first, growth as tiebreak
  .sort((a: any, b: any) => (b.income - a.income) || (a.pop - b.pop) || ((b.growth ?? 0) - (a.growth ?? 0)))
  .slice(0, Math.floor(MAX_KEYWORDS / SERVICES.length));
console.log(`geos: ${GEOS.length} small/affluent markets not used in Exp-2`);

// ---------- generate + free structural screen (screen-v1, unchanged) ----------
const hyps: any[] = [], screened: any[] = [];
for (const s of SERVICES) {
  for (const g of GEOS) {
    const id = `${s.svc}|${g.city}|${g.state}`;
    if (s.cat === "high-ticket-home" && g.income < 70000) { screened.push({ id, reason: "high-ticket service in below-median-income geography" }); continue; }
    if (s.ticket < 250 && g.pop < 100000) { screened.push({ id, reason: "low-ticket service in small market: rent ceiling implausible" }); continue; }
    hyps.push({ id, ...s, city: g.city, state: g.state, pop: g.pop, income: g.income, growth: g.growth ?? null,
      stratum: `${g.pop >= 100000 ? "mid" : "small"}|${g.income >= 100000 ? "affluent" : "upper-mid"}`, control: false, source: "exp3-biased" });
  }
}
const kw = (h: any) => `${h.kw} ${h.city}`.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
const keywords = [...new Set(hyps.map(kw))] as string[];
console.log(`generated ${hyps.length + screened.length} | passed screen ${hyps.length} | unique keywords ${keywords.length}`);

// ---------- Stage 2: measured demand (the only paid step here) ----------
const known = new Map<string, KeywordVolume>();
const cache = new URL("raw-volume.json", OUT);
let actualCost = 0;
const failures: any[] = [];
const run = await store.beginRun("exp3-demand", `exp3-vol-${keywords.length}`, { stage: 2, budgetCapUsd: 1.5 });
if (run.existing && run.run.status === "completed" && existsSync(cache)) {
  const cached = JSON.parse(readFileSync(cache, "utf8"));
  for (const batch of cached) for (const r of parseVolumeResponse(batch.raw, batch.chunk)) known.set(r.keyword, r);
  console.log("idempotent: reusing cached demand evidence (no new spend)");
} else {
  const saved: any[] = [];
  for (let i = 0; i < keywords.length; i += 700) {
    const chunk = keywords.slice(i, i + 700);
    const res = await fetch(DFS_VOLUME_URL, { method: "POST", headers: { authorization: `Basic ${DFS}`, "content-type": "application/json" }, body: volumeRequest(chunk).body });
    const raw = await res.json();
    if (raw?.tasks?.[0]?.status_code !== 20000) { failures.push({ batch: i, status: raw?.tasks?.[0]?.status_code ?? raw?.status_code, msg: raw?.tasks?.[0]?.status_message ?? raw?.status_message }); continue; }
    actualCost += raw.cost ?? 0;
    saved.push({ chunk, raw });
    for (const r of parseVolumeResponse(raw, chunk)) known.set(r.keyword, r);
    console.log(`  batch ${i / 700 + 1}: ${chunk.length} kw | actual cost so far $${actualCost.toFixed(4)}`);
  }
  writeFileSync(cache, JSON.stringify(saved));
  await store.charge(run.run.id, "dataforseo", keywords.length, actualCost);
  if (failures.length && known.size === 0) await store.failRun(run.run.id, JSON.stringify(failures).slice(0, 400));
  else await store.completeRun(run.run.id, actualCost);
}

// ---------- attach; UNKNOWN is never a rejection ----------
const measured: any[] = [], unknown: any[] = [], survivors: any[] = [], rejected: any[] = [];
for (const h of hyps) {
  const v = known.get(kw(h));
  h.volState = v?.state ?? "unknown-omitted";
  h.vol = v && typeof v.vol === "number" ? v.vol : null;
  h.cpc = v?.cpc ?? null;
  if (h.vol === null) { unknown.push(h); continue; }
  measured.push(h);
  if (h.vol < DEMAND_FLOOR) { rejected.push({ id: h.id, reason: `measured demand ${h.vol}/mo below ${DEMAND_FLOOR} floor` }); continue; }
  if (h.cpc !== null && h.cpc > 25) { rejected.push({ id: h.id, reason: `CPC $${h.cpc} indicates an extreme ad war` }); continue; }
  survivors.push(h);
}
survivors.sort((a, b) => b.vol - a.vol);
writeFileSync(new URL("stage2-complete.json", OUT), JSON.stringify({ demandFloor: DEMAND_FLOOR, actualCost, universe: hyps.length, measured: measured.length, unknown: unknown.length, survivors, rejectedCount: rejected.length, failures }, null, 1));

const by = (rows: any[], k: string) => rows.reduce((a: any, r) => { a[r[k]] = (a[r[k]] || 0) + 1; return a; }, {});
console.log(`\nACTUAL provider cost: $${actualCost.toFixed(4)}`);
console.log(`measured ${measured.length} | UNKNOWN ${unknown.length} (not rejected) | survivors ${survivors.length} | rejected ${rejected.length}`);
console.log("survivors by service:", JSON.stringify(by(survivors, "svcLabel")));
console.log("top 15:");
survivors.slice(0, 15).forEach((s) => console.log(`  ${String(s.vol).padStart(4)}/mo $${String(s.cpc ?? "-").padStart(6)} | ${s.svcLabel} — ${s.city}, ${s.state} (pop ${s.pop}, inc ${s.income})`));
if (failures.length) console.log("FAILURES:", JSON.stringify(failures));
