// NORTH TEXAS NEIGHBORHOOD-CLUSTER: service selection research.
//
// The cluster hypothesis is that keyword tools under-measure hyper-local demand.
// So community-level volume CANNOT be the selection criterion (it is the thing
// under test). Instead we select the service on evidence that is measurable:
//   1. CITY-level demand for the service across the NT metro (proves the metro wants it)
//   2. CPC / commercial intent (proves advertisers pay for the lead)
//   3. lead value (ticket x margin x close) — must justify very low traffic
//   4. new-home relevance + outdoor-living fit (HUMAN_ASSUMED, scored explicitly)
// Operator depth and community SERP weakness are measured in a later stage on
// survivors only (staged funnel: cheap evidence first).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { createSupabaseStore } from "../lib/store/supabase";
import { volumeRequest, parseVolumeResponse, DFS_VOLUME_URL, type KeywordVolume } from "../lib/providers/dataforseo";

const OUT = new URL("../../out/wave-1-experiment/", import.meta.url);
mkdirSync(OUT, { recursive: true });
const DFS = process.env.DATAFORSEO_AUTH;
if (!DFS) throw new Error("DATAFORSEO_AUTH is not set — refusing to run");
const store = createSupabaseStore();

// ---------- candidate services ----------
// ticket/margin are HUMAN_ASSUMED and labelled as such everywhere downstream.
// newHomeFit / outdoorLiving / visualContent are explicit 1-5 judgements, recorded
// as HUMAN_ASSUMED so they can never be mistaken for measured evidence.
type Svc = { id: string; label: string; kw: string; ticket: number; margin: number; newHomeFit: number; outdoorLiving: number; visual: number; seasonality: string; multiCommunity: number };
const S = (id: string, label: string, kw: string, ticket: number, margin: number, newHomeFit: number, outdoorLiving: number, visual: number, seasonality: string, multiCommunity: number): Svc =>
  ({ id, label, kw, ticket, margin, newHomeFit, outdoorLiving, visual, seasonality, multiCommunity });

const SERVICES: Svc[] = [
  S("pool-builder", "Pool Builder", "pool builder", 85000, 0.25, 5, 5, 5, "spring-summer peak", 5),
  S("outdoor-kitchen", "Outdoor Kitchen", "outdoor kitchen", 25000, 0.35, 5, 5, 5, "spring-fall", 5),
  S("artificial-turf", "Artificial Turf", "artificial turf", 12000, 0.40, 5, 4, 4, "year-round", 5),
  S("epoxy-garage", "Epoxy Garage Floor", "epoxy garage floor", 3500, 0.55, 5, 2, 4, "year-round", 5),
  S("pergola", "Pergola / Patio Cover", "patio cover", 18000, 0.35, 5, 5, 5, "spring-fall", 5),
  S("landscape-design", "Landscape Design", "landscape design", 15000, 0.35, 5, 5, 5, "spring-fall", 5),
  S("outdoor-lighting", "Landscape Lighting", "landscape lighting", 6500, 0.45, 4, 4, 5, "fall-winter peak", 5),
  S("hardscaping", "Hardscaping", "hardscaping", 14000, 0.40, 4, 5, 5, "spring-fall", 5),
  S("fencing", "Fence Installation", "fence company", 6000, 0.35, 4, 3, 3, "year-round", 5),
  S("putting-green", "Putting Green", "putting green installation", 15000, 0.40, 4, 4, 5, "year-round", 5),
  S("pool-remodel", "Pool Remodeling", "pool remodeling", 30000, 0.30, 1, 5, 5, "spring-summer", 5),
  S("sprinkler", "Sprinkler / Irrigation", "sprinkler repair", 1200, 0.50, 3, 3, 2, "spring-summer", 5),
  S("custom-closet", "Custom Closets", "custom closets", 8000, 0.45, 5, 1, 4, "year-round", 5),
  S("outdoor-fireplace", "Outdoor Fireplace", "outdoor fireplace", 12000, 0.40, 4, 5, 5, "fall-winter", 5),
  S("deck-builder", "Deck Builder", "deck builder", 16000, 0.35, 4, 5, 5, "spring-fall", 5),
  S("screen-enclosure", "Patio Screen Enclosure", "patio screen enclosure", 9000, 0.40, 4, 4, 4, "spring-fall", 5),
  S("water-softener", "Water Softener", "water softener installation", 4500, 0.45, 5, 1, 2, "year-round", 5),
  S("home-theater", "Home Theater / AV", "home theater installation", 12000, 0.40, 5, 1, 4, "year-round", 5),
  S("generator", "Home Generator", "generator installation", 12000, 0.35, 3, 1, 2, "storm-driven", 5),
  S("window-treatment", "Window Treatments", "window treatments", 6000, 0.45, 5, 1, 4, "year-round", 5),
  S("sod-install", "Sod Installation", "sod installation", 4000, 0.40, 4, 4, 3, "spring-fall", 5),
  S("stamped-concrete", "Stamped Concrete Patio", "stamped concrete patio", 12000, 0.40, 4, 5, 5, "spring-fall", 5),
];

// ---------- North Texas metro (the geography the cluster lives in) ----------
const NT_CITIES = [
  "Prosper", "Celina", "Frisco", "McKinney", "Plano", "Allen", "Melissa", "Anna",
  "Little Elm", "Aubrey", "Wylie", "Fairview", "Lucas", "Argyle", "Flower Mound",
  "Southlake", "Colleyville", "Trophy Club", "Keller", "Rockwall",
];

const kws: string[] = [];
const index: { svc: string; city: string; kw: string }[] = [];
for (const s of SERVICES) for (const c of NT_CITIES) {
  const k = `${s.kw} ${c}`.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  kws.push(k); index.push({ svc: s.id, city: c, kw: k });
}
const unique = [...new Set(kws)];
console.log(`service selection: ${SERVICES.length} services x ${NT_CITIES.length} NT cities = ${unique.length} keywords (~$${(unique.length * 0.000129).toFixed(2)} expected)`);

// ---------- Stage 1: measured city-level demand ----------
const cache = new URL("nt-service-volume.json", OUT);
const known = new Map<string, KeywordVolume>();
let actualCost = 0;
const failures: any[] = [];
const run = await store.beginRun("nt-service-selection", `nt-svc-${unique.length}`, { stage: 2, budgetCapUsd: 1.0 });
if (run.existing && run.run.status === "completed" && existsSync(cache)) {
  for (const b of JSON.parse(readFileSync(cache, "utf8"))) for (const r of parseVolumeResponse(b.raw, b.chunk)) known.set(r.keyword, r);
  console.log("idempotent: reusing cached demand evidence (no new spend)");
} else {
  const saved: any[] = [];
  for (let i = 0; i < unique.length; i += 700) {
    const chunk = unique.slice(i, i + 700);
    const res = await fetch(DFS_VOLUME_URL, { method: "POST", headers: { authorization: `Basic ${DFS}`, "content-type": "application/json" }, body: volumeRequest(chunk).body });
    const raw = await res.json();
    if (raw?.tasks?.[0]?.status_code !== 20000) { failures.push({ i, msg: raw?.tasks?.[0]?.status_message ?? raw?.status_message }); continue; }
    actualCost += raw.cost ?? 0;
    saved.push({ chunk, raw });
    for (const r of parseVolumeResponse(raw, chunk)) known.set(r.keyword, r);
  }
  writeFileSync(cache, JSON.stringify(saved));
  await store.charge(run.run.id, "dataforseo", unique.length, actualCost);
  if (failures.length && known.size === 0) await store.failRun(run.run.id, JSON.stringify(failures)); else await store.completeRun(run.run.id, actualCost);
}

// ---------- aggregate per service ----------
const BENCH_CLOSE = 0.10;   // same constant the scoring model uses
const rows = SERVICES.map((s) => {
  const mine = index.filter((i) => i.svc === s.id).map((i) => ({ city: i.city, v: known.get(i.kw) }));
  const measured = mine.filter((m) => m.v && typeof m.v.vol === "number");
  const totalVol = measured.reduce((a, m) => a + (m.v!.vol as number), 0);
  const citiesWithDemand = measured.filter((m) => (m.v!.vol as number) >= 50).length;
  const cpcs = measured.map((m) => m.v!.cpc).filter((c): c is number => typeof c === "number" && c > 0).sort((a, b) => a - b);
  const cpcMed = cpcs.length ? cpcs[Math.floor(cpcs.length / 2)]! : null;
  const leadValue = s.ticket * s.margin * BENCH_CLOSE;
  return {
    id: s.id, label: s.label, kw: s.kw, ticket: s.ticket, margin: s.margin,
    metroVolume: totalVol, citiesWithDemand, measuredCities: measured.length, unknownCities: mine.length - measured.length,
    cpcMedian: cpcMed, leadValue: Math.round(leadValue),
    newHomeFit: s.newHomeFit, outdoorLiving: s.outdoorLiving, visual: s.visual, seasonality: s.seasonality,
    topCities: measured.filter((m) => (m.v!.vol as number) > 0).sort((a, b) => (b.v!.vol as number) - (a.v!.vol as number)).slice(0, 4).map((m) => `${m.city} ${m.v!.vol}`),
  };
});

// Cluster fitness: a hyper-local asset gets very little traffic, so LEAD VALUE
// dominates; metro demand proves the service is wanted; new-home fit proves the
// community trigger is real. Explicitly a HUMAN_ASSUMED weighting for SELECTION
// ONLY — it never feeds A-I scoring.
const norm = (v: number, max: number) => (max > 0 ? v / max : 0);
const maxLead = Math.max(...rows.map((r) => r.leadValue));
const maxVol = Math.max(...rows.map((r) => r.metroVolume));
for (const r of rows as any[]) {
  r.clusterFitness = Math.round(
    100 * (0.40 * norm(r.leadValue, maxLead) + 0.25 * norm(r.metroVolume, maxVol) +
           0.15 * (r.newHomeFit / 5) + 0.10 * (r.outdoorLiving / 5) + 0.10 * (r.visual / 5)),
  );
}
(rows as any[]).sort((a, b) => b.clusterFitness - a.clusterFitness);
writeFileSync(new URL("nt-service-ranking.json", OUT), JSON.stringify({ actualCost, rows }, null, 1));

console.log(`\nACTUAL cost: $${actualCost.toFixed(4)}`);
console.log("\nfit | leadVal | metroVol | cities>=50 | cpcMed | service");
for (const r of rows as any[])
  console.log(`${String(r.clusterFitness).padStart(3)} | $${String(r.leadValue).padStart(6)} | ${String(r.metroVolume).padStart(6)} | ${String(r.citiesWithDemand).padStart(2)}/${r.measuredCities} (${r.unknownCities} unk) | ${String(r.cpcMedian ?? "-").padStart(6)} | ${r.label}`);
console.log("\ntop cities for the leading services:");
for (const r of (rows as any[]).slice(0, 5)) console.log(`  ${r.label}: ${r.topCities.join(", ") || "(no measured city volume)"}`);
