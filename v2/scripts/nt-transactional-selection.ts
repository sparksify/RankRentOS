// WAVE1-V4 — transactional service selection for the neighborhood experiment (S2).
// Steve's criterion: a simple buying journey (need -> search -> call). Selection is
// data-driven: measured NT city demand + lead value + transactional fit + seasonal
// timing. Community-level volume is deliberately NOT a criterion — it is the
// hypothesis under test.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { createSupabaseStore } from "../lib/store/supabase";
import { volumeRequest, parseVolumeResponse, DFS_VOLUME_URL, type KeywordVolume } from "../lib/providers/dataforseo";

const OUT = new URL("../../out/wave1-v4/", import.meta.url);
mkdirSync(OUT, { recursive: true });
const DFS = process.env.DATAFORSEO_AUTH;
if (!DFS) throw new Error("DATAFORSEO_AUTH is not set — refusing to run");
const store = createSupabaseStore();

// Candidates. ticket/margin HUMAN_ASSUMED; fit scores (1-5) are explicit judgements
// on "need -> search -> call" simplicity and new-home/community relevance.
// seasonNow: does demand peak in the Sep-Dec window a launch-now site would catch?
type C = { id: string; label: string; kw: string; ticket: number; margin: number; transactionalFit: number; communityFit: number; seasonNow: number };
const CANDS: C[] = [
  { id: "landscape-lighting", label: "Landscape Lighting", kw: "landscape lighting", ticket: 6500, margin: 0.45, transactionalFit: 4, communityFit: 4, seasonNow: 5 },
  { id: "christmas-lights", label: "Christmas Light Installation", kw: "christmas light installation", ticket: 1500, margin: 0.55, transactionalFit: 5, communityFit: 5, seasonNow: 5 },
  { id: "epoxy-garage", label: "Epoxy Garage Floor", kw: "epoxy garage floor", ticket: 3500, margin: 0.55, transactionalFit: 5, communityFit: 5, seasonNow: 3 },
  { id: "fence-staining", label: "Fence Staining", kw: "fence staining", ticket: 1200, margin: 0.55, transactionalFit: 5, communityFit: 4, seasonNow: 4 },
  { id: "pressure-washing", label: "Pressure Washing", kw: "pressure washing", ticket: 400, margin: 0.6, transactionalFit: 5, communityFit: 3, seasonNow: 3 },
  { id: "exterior-painting", label: "Exterior Painting", kw: "exterior painting", ticket: 6000, margin: 0.4, transactionalFit: 4, communityFit: 3, seasonNow: 3 },
  { id: "sprinkler-repair", label: "Sprinkler Repair", kw: "sprinkler repair", ticket: 1200, margin: 0.5, transactionalFit: 5, communityFit: 4, seasonNow: 3 },
];
const CITIES = ["Prosper", "Celina", "Frisco", "McKinney", "Aubrey", "Argyle", "Little Elm", "Plano"];

// ---- reuse every prior measurement; only pay for genuinely new keywords ----
const corpus = new Map<string, KeywordVolume>();
const harvest = (raw: any) => { for (const r of raw?.tasks?.[0]?.result ?? []) {
  const measured = typeof r.search_volume === "number";
  corpus.set(String(r.keyword).toLowerCase(), { keyword: r.keyword, vol: measured ? r.search_volume : null, cpc: typeof r.cpc === "number" ? r.cpc : null, competition: r.competition ?? null, state: measured ? "measured" : "unknown-null" });
} };
for (const f of ["../../out/wave-1-experiment/nt-service-volume.json", "../../out/experiment-3/raw-volume.json"]) {
  const p = new URL(f, import.meta.url);
  if (!existsSync(p)) continue;
  const j = JSON.parse(readFileSync(p, "utf8"));
  (Array.isArray(j) ? j : [j]).forEach((b: any) => harvest(b.raw ?? b));
}

const want: string[] = [];
const index: { c: string; city: string; kw: string }[] = [];
for (const c of CANDS) for (const city of CITIES) {
  const k = `${c.kw} ${city}`.toLowerCase();
  index.push({ c: c.id, city, kw: k });
  if (!corpus.has(k)) want.push(k);
}
console.log(`transactional selection: ${index.length} keywords | cached ${index.length - want.length} | new ${want.length} (~$${(want.length * 0.000129).toFixed(2)})`);

const run = await store.beginRun("v4-transactional", `v4-s2-${want.length}`, { stage: 2, budgetCapUsd: 0.5 });
let cost = 0;
if (want.length && !(run.existing && run.run.status === "completed")) {
  const res = await fetch(DFS_VOLUME_URL, { method: "POST", headers: { authorization: `Basic ${DFS}`, "content-type": "application/json" }, body: volumeRequest(want).body });
  const raw = await res.json();
  writeFileSync(new URL("s2-volume.json", OUT), JSON.stringify(raw));
  if (raw?.tasks?.[0]?.status_code !== 20000) { await store.failRun(run.run.id, raw?.tasks?.[0]?.status_message ?? "failed"); throw new Error("volume batch failed"); }
  cost = raw.cost ?? 0;
  for (const r of parseVolumeResponse(raw, want)) corpus.set(r.keyword, r);
  await store.charge(run.run.id, "dataforseo", want.length, cost);
  await store.completeRun(run.run.id, cost);
} else if (existsSync(new URL("s2-volume.json", OUT))) {
  harvest(JSON.parse(readFileSync(new URL("s2-volume.json", OUT), "utf8")));
}

const BENCH_CLOSE = 0.10;
const rows = CANDS.map((c) => {
  const mine = index.filter((i) => i.c === c.id).map((i) => ({ city: i.city, v: corpus.get(i.kw) }));
  const measured = mine.filter((m) => m.v && typeof m.v.vol === "number");
  const metroVol = measured.reduce((a, m) => a + (m.v!.vol as number), 0);
  const citiesWithDemand = measured.filter((m) => (m.v!.vol as number) >= 30).length;
  const cpcs = measured.map((m) => m.v!.cpc).filter((x): x is number => typeof x === "number" && x > 0).sort((a, b) => a - b);
  const leadValue = Math.round(c.ticket * c.margin * BENCH_CLOSE);
  return { ...c, metroVol, citiesWithDemand, measuredCities: measured.length, unknownCities: mine.length - measured.length,
    cpcMedian: cpcs.length ? cpcs[Math.floor(cpcs.length / 2)]! : null, leadValue,
    perCity: measured.filter((m) => (m.v!.vol as number) > 0).sort((a, b) => (b.v!.vol as number) - (a.v!.vol as number)).map((m) => `${m.city} ${m.v!.vol}`) };
});
// Fitness for the NEIGHBORHOOD experiment: transactional simplicity and community
// relevance dominate; lead value matters (tiny traffic must still pay); metro demand
// proves the metro wants it; seasonNow rewards launching into the service's season.
const maxLead = Math.max(...rows.map((r) => r.leadValue)), maxVol = Math.max(...rows.map((r) => r.metroVol), 1);
for (const r of rows as any[]) r.fitness = Math.round(100 * (
  0.30 * (r.leadValue / maxLead) + 0.20 * (r.metroVol / maxVol) +
  0.20 * (r.transactionalFit / 5) + 0.15 * (r.communityFit / 5) + 0.15 * (r.seasonNow / 5)));
(rows as any[]).sort((a, b) => b.fitness - a.fitness);
writeFileSync(new URL("s2-ranking.json", OUT), JSON.stringify({ actualCost: cost, rows }, null, 1));

console.log(`ACTUAL cost: $${cost.toFixed(4)}\n`);
console.log("fit | lead$ | metroVol | cities>=30 | cpcMed | txn | comm | seasonNow | service");
for (const r of rows as any[])
  console.log(`${String(r.fitness).padStart(3)} | ${String(r.leadValue).padStart(5)} | ${String(r.metroVol).padStart(7)} | ${String(r.citiesWithDemand).padStart(2)}/${r.measuredCities} (${r.unknownCities}u) | ${String(r.cpcMedian ?? "-").padStart(6)} | ${r.transactionalFit}   | ${r.communityFit}    | ${r.seasonNow}         | ${r.label}`);
console.log("\nper-city demand for the top 3:");
for (const r of (rows as any[]).slice(0, 3)) console.log(`  ${r.label}: ${r.perCity.join(", ") || "(no measured city demand)"}`);
