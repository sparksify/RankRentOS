// NORTH TEXAS COMMUNITY CLUSTER — candidate research for the selected service.
//
// Selection evidence for community assets is DELIBERATELY DIFFERENT from city assets:
// exact-match volume is the thing under test, so it cannot be the gate. What we can
// measure now, and what actually decides deployability:
//   - community SERP weakness (map pack size/reviews, directories, content depth)
//   - whether a community-specific SERP even exists / is coherent
//   - operator depth serving the community (who could rent it)
//   - EMD availability
// Volume is still COLLECTED and recorded honestly (expected ~0) as the baseline the
// live experiment will falsify or confirm. UNKNOWN and ZERO stay distinct.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { createSupabaseStore } from "../lib/store/supabase";
import { serpUrl, parseSerpResponse } from "../lib/providers/serpapi";
import { serpLocation } from "../lib/geo/states";
import { extractSignals, SIGNALS_VERSION } from "../lib/serp/signals";
import { dedupeOperators, depthSignals, OPERATORS_VERSION } from "../lib/operators/depth";

const OUT = new URL("../../out/wave-1-experiment/", import.meta.url);
mkdirSync(new URL("raw/", OUT), { recursive: true });
const KEY = process.env.SERPAPI_KEY;
if (!KEY) throw new Error("SERPAPI_KEY is not set — refusing to run");
const store = createSupabaseStore();

const SERVICE = { id: "pool-builder", label: "Pool Builder", kw: "pool builder", ticket: 85000, margin: 0.25 };

// ---------- candidate community universe ----------
// homes/status are HUMAN_ASSUMED research notes from public developer/press sources,
// recorded as such. They inform selection, never A-I scoring.
type Comm = { name: string; city: string; state: string; homes: number; status: string; note: string };
const C = (name: string, city: string, homes: number, status: string, note: string): Comm => ({ name, city, state: "TX", homes, status, note });
const COMMUNITIES: Comm[] = [
  // Prosper
  C("Windsong Ranch", "Prosper", 3300, "active-buildout", "2,030 acres; 10 new phases + 600 homesites releasing; famous 5-acre Crystal Lagoon"),
  C("Star Trail", "Prosper", 1300, "active-buildout", "Prosper ISD; large lots, semi-custom"),
  C("Legacy Gardens", "Prosper", 400, "active-buildout", "luxury custom, large lots"),
  C("Whitley Place", "Prosper", 600, "mature", "established, larger lots"),
  // Celina
  C("Light Farms", "Celina", 3000, "active-buildout", "one of Celina's largest; heavy amenity base"),
  C("Mustang Lakes", "Celina", 1200, "active-buildout", "largest amenity center in North Texas"),
  C("Mosaic", "Celina", 3000, "active-buildout", "fast-growing; trails, lakes, The River amenity complex"),
  C("Cambridge Crossing", "Celina", 1400, "active-buildout", "Celina/Prosper ISD corridor"),
  C("Sutton Fields", "Celina", 1500, "active-buildout", "volume builder base, mid-affluent"),
  C("Ramble", "Celina", 2000, "pre-occupancy", "first phase opening 2026 — few/no homeowners yet"),
  C("Serenade", "Celina", 1200, "pre-occupancy", "$650M, groundbroke March 2026 — no homeowners yet"),
  // Frisco
  C("Fields", "Frisco", 10000, "early-buildout", "very large; PGA HQ corridor"),
  C("Phillips Creek Ranch", "Frisco", 1800, "mature", "affluent, established"),
  C("Newman Village", "Frisco", 800, "mature", "luxury, Mediterranean-style custom"),
  // McKinney
  C("Painted Tree", "McKinney", 3400, "active-buildout", "one of McKinney's largest active MPCs"),
  C("Trinity Falls", "McKinney", 3000, "active-buildout", "NW McKinney, Trinity River corridor"),
  C("Stonebridge Ranch", "McKinney", 7000, "mature", "very large but mature — most homes already improved"),
  // Denton County / other
  C("Union Park", "Aubrey", 2000, "active-buildout", "Denton Co, strong new-build activity"),
  C("Sandbrock Ranch", "Aubrey", 1400, "active-buildout", "Denton Co, semi-custom"),
  C("Harvest", "Argyle", 1800, "active-buildout", "farm-themed MPC, affluent Argyle/Northlake"),
  C("Canyon Falls", "Argyle", 1300, "active-buildout", "Argyle ISD, affluent"),
  C("The Preserve", "Prosper", 500, "active-buildout", "previously researched community"),
];

// City-level CONTROLS for the same service — the essential comparison that isolates
// "community targeting works" from "pool builder in North Texas is simply a good market".
const CITY_CONTROLS = ["Prosper", "Celina", "Frisco", "McKinney", "Aubrey", "Argyle"];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const rdap = async (d: string) => {
  try { const r = await fetch(`https://rdap.verisign.com/com/v1/domain/${d}`, { signal: AbortSignal.timeout(10000) }); return r.status === 404; }
  catch { return null; }   // null = UNKNOWN, never "available"
};

const run = await store.beginRun("nt-community-serp", `nt-comm-${COMMUNITIES.length}-${CITY_CONTROLS.length}`, { stage: 3, budgetCapUsd: 0 });
const closed = run.existing && run.run.status === "completed";
const results: any[] = [];

const research = async (kind: "community" | "city-control", name: string, city: string) => {
  const id = `${SERVICE.id}|${name}|TX`;
  const sl = id.replace(/[^a-z0-9]/gi, "_");
  const query = kind === "community" ? `${SERVICE.kw} ${name} ${city} TX` : `${SERVICE.kw} ${city} TX`;
  const cacheFile = new URL(`raw/serp-${sl}.json`, OUT);
  let raw: any = null;
  if (existsSync(cacheFile)) { const c = JSON.parse(readFileSync(cacheFile, "utf8")); if (!c?.error) raw = c; }
  if (!raw) {
    const res = await fetch(serpUrl(query, serpLocation(city, "TX"), KEY));
    raw = await res.json();
    writeFileSync(cacheFile, JSON.stringify(raw));
  }
  if (raw?.error) { results.push({ id, kind, name, city, error: raw.error }); return; }

  const parsed: any = parseSerpResponse(raw);
  const g: any = extractSignals(parsed, kind === "community" ? name : city);
  const ev: any[] = [];
  for (const b of parsed.localPack ?? []) ev.push({ name: b.title ?? b.name, source: "mappack", rating: b.rating ?? null, reviews: b.reviews ?? null, website: b.website ?? null });
  for (const o of (parsed.organic || []).slice(0, 8)) { try { const h = new URL(o.link).hostname.replace(/^www\./, ""); ev.push({ name: h, source: "organic", domain: h }); } catch { /* skip */ } }
  for (const a of parsed.ads ?? []) ev.push({ name: a.displayed_link || a.title, source: "ads" });
  const ops = depthSignals(dedupeOperators(ev));

  // does the SERP even acknowledge the community as a place? (community assets only)
  const organicMentioningCommunity = kind === "community"
    ? (parsed.organic || []).filter((o: any) => `${o.title ?? ""} ${o.snippet ?? ""}`.toLowerCase().includes(name.toLowerCase())).length
    : null;

  const domains = kind === "community"
    ? [`poolbuilder${slug(name)}.com`, `${slug(name)}poolbuilder.com`, `${slug(name)}pools.com`, `poolsof${slug(name)}.com`]
    : [`poolbuilder${slug(city)}tx.com`, `${slug(city)}poolbuilders.com`];
  const domainStatus: Record<string, boolean | null> = {};
  for (const d of domains) domainStatus[d] = await rdap(d);

  results.push({ id, kind, name, city, query, signals: g, operators: ops, organicMentioningCommunity,
    domains: domainStatus, preferredDomain: Object.entries(domainStatus).find(([, v]) => v === true)?.[0] ?? null });

  if (!closed) {
    const base = { subjectType: "market", subjectId: id, evidenceType: "DERIVED" as const, confidence: 0.85, observedAt: Date.now(), runId: run.run.id };
    const sb = { ...base, source: `serpapi:${SIGNALS_VERSION}:serp-${sl}.json` };
    const ob = { ...base, source: `${OPERATORS_VERSION}:serp-${sl}.json`, confidence: 0.7 };
    const m: [string, any, any][] = [
      ["serp.mappack.count", g.mapPackSize, sb], ["serp.mappack.avgreviews", g.avgMapReviews, sb],
      ["serp.mappack.nowebsite.count", g.mapListingsWithoutWebsite, sb], ["serp.directory.count", g.directoriesInTop3, sb],
      ["serp.innerpage.count", g.innerPagesInTop5, sb], ["serp.titletargeting.count", g.top3TitlesMissingCity, sb],
      ["serp.ads.count", g.adCount, sb], ["serp.franchise.count", g.franchisesInTop3, sb],
      ["op.count.relevant", ops.relevantOperatorCount, ob], ["op.count.viable", ops.viableOperatorCount, ob],
      ["op.count.stronger", ops.strongerOperatorCount, ob], ["op.reviews.median", ops.medianReviews, ob],
      ["op.website.adoptionpct", ops.websiteAdoptionPct, ob], ["op.concentration.class", ops.concentration, ob],
    ];
    await store.insertBatch(m.filter(([, v]) => v !== null && v !== undefined).map(([metric, value, b]) => ({ ...b, metric, value })));
  }
  process.stdout.write(".");
};

for (const c of COMMUNITIES) await research("community", c.name, c.city);
for (const c of CITY_CONTROLS) await research("city-control", c, c);
if (!closed) await store.completeRun(run.run.id, 0);

const enriched = results.map((r) => ({ ...r, meta: COMMUNITIES.find((c) => c.name === r.name) ?? null }));
writeFileSync(new URL("nt-community-serp.json", OUT), JSON.stringify(enriched, null, 1));

console.log("\n\n=== COMMUNITY SERPs (weakness = opportunity) ===");
console.log("map | avgRev | dirs | ops(rel/viable) | medRev | mentions | EMD | community");
for (const r of enriched.filter((x) => x.kind === "community" && !x.error)) {
  const g = r.signals, o = r.operators;
  console.log(`${String(g.mapPackSize).padStart(3)} | ${String(g.avgMapReviews ?? "-").padStart(6)} | ${String(g.directoriesInTop3).padStart(4)} | ${String(o.relevantOperatorCount).padStart(3)}/${String(o.viableOperatorCount).padStart(2)} | ${String(o.medianReviews ?? "-").padStart(6)} | ${String(r.organicMentioningCommunity).padStart(8)} | ${(r.preferredDomain ? "YES" : "no ").padStart(3)} | ${r.name} (${r.city})`);
}
console.log("\n=== CITY CONTROLS (same service, city level) ===");
for (const r of enriched.filter((x) => x.kind === "city-control" && !x.error)) {
  const g = r.signals, o = r.operators;
  console.log(`${String(g.mapPackSize).padStart(3)} | ${String(g.avgMapReviews ?? "-").padStart(6)} | ${String(g.directoriesInTop3).padStart(4)} | ${String(o.relevantOperatorCount).padStart(3)}/${String(o.viableOperatorCount).padStart(2)} | ${String(o.medianReviews ?? "-").padStart(6)} | ${"-".padStart(8)} | ${(r.preferredDomain ? "YES" : "no ").padStart(3)} | ${r.name} CITY`);
}
const errs = enriched.filter((x) => x.error);
if (errs.length) console.log("\nerrors:", errs.map((e) => `${e.name}: ${e.error}`).join("; "));
