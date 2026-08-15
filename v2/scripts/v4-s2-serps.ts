// WAVE1-V4 — S2 (Sprinkler Repair) SERP + organic + intent + domains, across the
// 2x2 geographies: 3 cities and 6 communities. SerpAPI prepaid ($0 marginal) + RDAP.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { createSupabaseStore } from "../lib/store/supabase";
import { serpUrl, parseSerpResponse } from "../lib/providers/serpapi";
import { serpLocation } from "../lib/geo/states";
import { extractSignals, SIGNALS_VERSION } from "../lib/serp/signals";
import { dedupeOperators, depthSignals, OPERATORS_VERSION } from "../lib/operators/depth";
import { organicRankability } from "../lib/serp/organic";
import { validateCommercialIntent } from "../lib/validation/prepurchase";

const OUT = new URL("../../out/wave1-v4/", import.meta.url);
mkdirSync(new URL("raw/", OUT), { recursive: true });
const KEY = process.env.SERPAPI_KEY;
if (!KEY) throw new Error("SERPAPI_KEY is not set — refusing to run");
const store = createSupabaseStore();

const SVC = { label: "Sprinkler Repair", kw: "sprinkler repair", slug: "sprinkler-repair", ticket: 1200, margin: 0.5 };
const TARGETS: { name: string; city: string; type: "city" | "community" }[] = [
  { name: "Frisco", city: "Frisco", type: "city" },
  { name: "McKinney", city: "McKinney", type: "city" },
  { name: "Prosper", city: "Prosper", type: "city" },
  { name: "Sutton Fields", city: "Celina", type: "community" },
  { name: "Painted Tree", city: "McKinney", type: "community" },
  { name: "Sandbrock Ranch", city: "Aubrey", type: "community" },
  { name: "Star Trail", city: "Prosper", type: "community" },
  { name: "Trinity Falls", city: "McKinney", type: "community" },
  { name: "Union Park", city: "Aubrey", type: "community" },
];

const slugd = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
const rdap = async (d: string) => { try { const r = await fetch(`https://rdap.verisign.com/com/v1/domain/${d}`, { signal: AbortSignal.timeout(10000) }); return r.status === 404; } catch { return null; } };

const run = await store.beginRun("v4-s2-serp", `v4-s2-serp-${TARGETS.length}`, { stage: 3, budgetCapUsd: 0 });
const closed = run.existing && run.run.status === "completed";
const results: any[] = [];

for (const t of TARGETS) {
  const query = t.type === "city" ? `${SVC.kw} ${t.name} TX` : `${SVC.kw} ${t.name} ${t.city} TX`;
  const sl = `${SVC.slug}_${t.name}`.replace(/[^a-z0-9]/gi, "_");
  const cacheFile = new URL(`raw/serp-${sl}.json`, OUT);
  let raw: any = null;
  if (existsSync(cacheFile)) { const c = JSON.parse(readFileSync(cacheFile, "utf8")); if (!c?.error) raw = c; }
  if (!raw) {
    const res = await fetch(serpUrl(query, serpLocation(t.city, "TX"), KEY));
    raw = await res.json();
    writeFileSync(cacheFile, JSON.stringify(raw));
  }
  if (raw?.error) { results.push({ ...t, error: raw.error }); continue; }
  const parsed: any = parseSerpResponse(raw);
  const g: any = extractSignals(parsed, t.type === "city" ? t.name : t.name);
  const ev: any[] = [];
  for (const b of parsed.localPack ?? []) ev.push({ name: b.name, source: "mappack", rating: b.rating ?? null, reviews: b.reviews ?? null, website: b.website ?? null });
  for (const o of (parsed.organic || []).slice(0, 8)) { try { const h = new URL(o.link).hostname.replace(/^www\./, ""); ev.push({ name: h, source: "organic", domain: h }); } catch { /* skip */ } }
  const ops = depthSignals(dedupeOperators(ev));
  const org = organicRankability({
    organic: (parsed.organic || []).map((x: any, i: number) => ({ link: x.link, title: x.title, position: x.position ?? i + 1 })),
    geo: t.name, serviceTerms: ["sprinkler", "irrigation"], geoType: t.type,
    competitorAvgWords: null, competitorAvgDomainAgeYears: null,
  });
  const intent = validateCommercialIntent({ slots: org.slots, adCount: g.adCount ?? null, mapPackSize: g.mapPackSize ?? null, cpc: null });

  // domains: standalone candidates; the hub domain is checked separately below
  const doms: Record<string, boolean | null> = {};
  for (const d of [`${SVC.slug.replace(/-/g, "")}${slugd(t.name)}.com`, `${slugd(t.name)}sprinklerrepair.com`, `sprinklerrepair${slugd(t.name)}${t.type === "city" ? "tx" : ""}.com`])
    doms[d] = await rdap(d);

  results.push({ ...t, query, organic: org.score, verdict: org.verdict,
    structure: { distinctHosts: org.distinctHostsTop5, displaceable: org.displaceableTop5, hardLocal: org.hardLocalTop3, geoTargeted: org.geoTargetedCompetitorsTop5 },
    intentClass: intent.intentClass, intentVerdict: intent.verdict,
    mapPackSize: g.mapPackSize, avgMapReviews: g.avgMapReviews,
    viableRenters: ops.viableOperatorCount, relevantOperators: ops.relevantOperatorCount,
    top5: org.slots.slice(0, 5).map((s) => `${s.position}. ${s.host} [${s.slotClass}]`),
    domains: doms, preferredDomain: Object.entries(doms).find(([, v]) => v === true)?.[0] ?? null });

  if (!closed) {
    const base = { subjectType: "market", subjectId: `${SVC.slug}|${t.name}|TX`, evidenceType: "DERIVED" as const, confidence: 0.85, observedAt: Date.now(), runId: run.run.id };
    const m: [string, any][] = [["serp.mappack.count", g.mapPackSize], ["serp.mappack.avgreviews", g.avgMapReviews],
      ["serp.directory.count", g.directoriesInTop3], ["op.count.relevant", ops.relevantOperatorCount], ["op.count.viable", ops.viableOperatorCount]];
    await store.insertBatch(m.filter(([, v]) => v !== null && v !== undefined).map(([metric, value]) => ({ ...base, metric, value, source: `serpapi:${SIGNALS_VERSION}:serp-${sl}.json` })));
  }
  process.stdout.write(".");
}
if (!closed) await store.completeRun(run.run.id, 0);

const hubDomain = "sprinklerrepairnorthtexas.com";
const hubAvail = await rdap(hubDomain);
writeFileSync(new URL("s2-serps.json", OUT), JSON.stringify({ service: SVC, hubDomain, hubAvail, results }, null, 1));

console.log("\n\ntype      | org | verdict           | intent            | hard/disp | renters | domain");
for (const r of results.filter((x) => !x.error))
  console.log(`${r.type.padEnd(9)} | ${String(r.organic).padStart(3)} | ${(r.verdict ?? "").padEnd(17)} | ${r.intentClass.padEnd(17)} | ${r.structure.hardLocal}/${r.structure.displaceable}       | ${String(r.viableRenters).padStart(2)}      | ${(r.preferredDomain ?? "NONE").padEnd(36)} ${r.name}`);
console.log(`\nhub domain ${hubDomain}: ${hubAvail === true ? "AVAILABLE" : "taken/unknown"}`);
