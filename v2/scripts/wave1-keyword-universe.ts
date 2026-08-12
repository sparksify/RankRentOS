// Geo-scoped keyword universe for Wave-1 assets (universe-geo-1.0.0).
// One DataForSEO Labs task per keyword (the API accepts only one task per POST).
// National-scope terms are preserved with a rejection reason and contribute ZERO.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { createSupabaseStore } from "../lib/store/supabase";
import { buildGeoUniverse, UNIVERSE_GEO_VERSION } from "../lib/keywords/universe";

const ROOT = new URL("../../", import.meta.url);
const OUT = new URL("out/portfolio/", ROOT);
mkdirSync(new URL("raw/", OUT), { recursive: true });
const DFS = process.env.DATAFORSEO_AUTH;
if (!DFS) throw new Error("DATAFORSEO_AUTH is not set — refusing to run");
const store = createSupabaseStore();

const portfolio = JSON.parse(readFileSync(new URL("portfolio.json", OUT), "utf8"));
const scored = [
  ...JSON.parse(readFileSync(new URL("out/experiment-2/stage4-scored.json", ROOT), "utf8")),
  ...JSON.parse(readFileSync(new URL("out/experiment-3/stage4-scored.json", ROOT), "utf8")),
];
const byId = new Map(scored.map((r: any) => [r.id, r]));
const wave1 = portfolio.wave1.map((w: any) => byId.get(w.id)).filter(Boolean);
const PER_TASK = 0.0144;  // observed actual unit cost from the Exp-2 probe
console.log(`Wave-1 universes: ${wave1.length} keywords x ~$${PER_TASK} = ~$${(wave1.length * PER_TASK).toFixed(2)} expected`);

const run = await store.beginRun("wave1-universe", `w1-uni-${wave1.length}`, { stage: 3, budgetCapUsd: 1.0 });
const closed = run.existing && run.run.status === "completed";
let actualCost = 0;
const results: any[] = [];

for (const c of wave1) {
  const slug = c.id.replace(/[^a-z0-9]/gi, "_");
  const cacheFile = new URL(`raw/rel-${slug}.json`, OUT);
  const core = `${c.kw} ${c.city}`.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  let raw: any = null;
  if (existsSync(cacheFile)) raw = JSON.parse(readFileSync(cacheFile, "utf8"));
  else {
    const res = await fetch("https://api.dataforseo.com/v3/dataforseo_labs/google/related_keywords/live", {
      method: "POST", headers: { authorization: `Basic ${DFS}`, "content-type": "application/json" },
      body: JSON.stringify([{ keyword: core, location_name: "United States", language_name: "English", depth: 1, limit: 60 }]),
    });
    raw = await res.json();
    writeFileSync(cacheFile, JSON.stringify(raw));
    actualCost += raw.cost ?? 0;
  }
  const items = raw?.tasks?.[0]?.result?.[0]?.items ?? [];
  const related = items.map((it: any) => ({
    keyword: it.keyword_data?.keyword,
    // UNKNOWN != ZERO: keep provider nulls as null
    volume: typeof it.keyword_data?.keyword_info?.search_volume === "number" ? it.keyword_data.keyword_info.search_volume : null,
    cpc: typeof it.keyword_data?.keyword_info?.cpc === "number" ? it.keyword_data.keyword_info.cpc : null,
  })).filter((r: any) => r.keyword);

  const serviceTerms = c.kw.toLowerCase().split(" ").filter((w: string) => w.length > 3).slice(0, 2);
  const u = buildGeoUniverse({ core, serviceTerms, geoTerms: [c.city.toLowerCase()], related });
  c.geoUniverse = u;
  results.push({ id: c.id, providerReturned: related.length, attributable: u.attributableCount, attributableVolume: u.attributableVolume,
    leakageExcluded: u.nationalLeakageVolume, complete: u.complete, unknown: u.unknownVolumeCount,
    top: u.accepted.filter((a) => typeof a.volume === "number").sort((a, b) => (b.volume as number) - (a.volume as number)).slice(0, 6) });

  if (!closed) {
    const base = { subjectType: "market", subjectId: c.id, source: `dataforseo:${UNIVERSE_GEO_VERSION}`, evidenceType: "DERIVED" as const, confidence: 0.85, observedAt: Date.now(), runId: run.run.id };
    const obs: any[] = [
      { ...base, metric: "kw.universe.count", value: u.attributableCount },
      { ...base, metric: "kw.universe.volume", value: u.attributableVolume },
      { ...base, metric: "kw.universe.geointent", value: u.attributableVolume },
    ];
    if (u.cpcMedian !== null) obs.push({ ...base, metric: "kw.cpc.median", value: u.cpcMedian });
    await store.insertBatch(obs);
  }
  process.stdout.write(".");
}
await store.charge(run.run.id, "dataforseo", wave1.length, actualCost);
if (!closed) await store.completeRun(run.run.id, actualCost);

writeFileSync(new URL("wave1-universes.json", OUT), JSON.stringify(results, null, 1));
const totalLeak = results.reduce((s, r) => s + r.leakageExcluded, 0);
const complete = results.filter((r) => r.complete).length;
console.log(`\nACTUAL cost: $${actualCost.toFixed(4)}`);
console.log(`universes built: ${results.length} | complete: ${complete} | incomplete (unmeasured members): ${results.length - complete}`);
console.log(`NATIONAL VOLUME EXCLUDED by geo-scoping: ${totalLeak.toLocaleString()} searches/mo`);
console.log(`  (a naive sum would have inflated Wave-1 demand by ${Math.round(totalLeak / Math.max(results.reduce((s, r) => s + r.attributableVolume, 0), 1))}x)`);
console.log("\nsample:");
for (const r of results.slice(0, 6)) console.log(`  ${r.id}: ${r.attributable} attributable kw = ${r.attributableVolume}/mo (excluded ${r.leakageExcluded.toLocaleString()} national)`);
