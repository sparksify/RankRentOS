// EXP 1.5b — fixes: (1) DataForSEO Labs accepts ONE task per POST (35/36 were
// rejected); (2) map-pack field is `localPack` not `localResults` (operator
// evidence was organic-only). Budget: remaining headroom under the $1 cap.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "fs";
import { createSupabaseStore } from "../lib/store/supabase";
import { parseSerpResponse } from "../lib/providers/serpapi";
import { buildUniverse, UNIVERSE_VERSION } from "../lib/keywords/universe";
import { dedupeOperators, depthSignals, OPERATORS_VERSION } from "../lib/operators/depth";

const DFS_PER_TASK = 0.0126;
const store = createSupabaseStore();
const DFS = process.env.DATAFORSEO_AUTH!;
const E1 = new URL("../../out/experiment-1/", import.meta.url);
const OUT = new URL("../../out/experiment-1_5/", import.meta.url);
mkdirSync(new URL("raw/", OUT), { recursive: true });
const cands = JSON.parse(readFileSync(new URL("candidates-enriched.json", OUT), "utf8"));
const obs: any[] = [];
const now = () => Date.now();

// ---------- (1) operator depth, corrected extraction (FREE reparse) ----------
const runO = await store.beginRun("exp15b-operators", "ops-localpack-fix", { stage: 4, budgetCapUsd: 0 });
if (!(runO.existing && runO.run.status === "completed")) {
  for (const c of cands) {
    const slug = c.id.replace(/[^a-z0-9]/gi, "_");
    const rf = readdirSync(new URL("raw/", OUT)).find((f) => f.includes(slug) && f.startsWith("serp-"));
    const e1 = readdirSync(new URL("raw/", E1)).find((f) => f.includes(slug) && f.startsWith("serp-"));
    const src = rf ? new URL(`raw/${rf}`, OUT) : e1 ? new URL(`raw/${e1}`, E1) : null;
    if (!src) continue;
    const raw = JSON.parse(readFileSync(src, "utf8"));
    if (raw?.error) continue;
    const p: any = parseSerpResponse(raw);
    const ev: any[] = [];
    for (const b of p.localPack ?? []) ev.push({ name: b.title ?? b.name, source: "mappack", rating: b.rating ?? null, reviews: b.reviews ?? null, website: b.website ?? null });
    for (const o of (p.organic || []).slice(0, 8)) { try { const h = new URL(o.link).hostname.replace(/^www\./, ""); ev.push({ name: h, source: "organic", domain: h }); } catch {} }
    for (const a of p.ads ?? []) ev.push({ name: a.displayed_link || a.title, source: "ads" });
    const s = depthSignals(dedupeOperators(ev));
    c.operators = s;
    const base = { subjectType: "market", subjectId: c.id, source: `${OPERATORS_VERSION}:${rf || e1}`, evidenceType: "DERIVED" as const, confidence: 0.7, observedAt: now(), runId: runO.run.id };
    obs.push({ ...base, metric: "op.count.relevant", value: s.relevantOperatorCount },
      { ...base, metric: "op.count.viable", value: s.viableOperatorCount },
      { ...base, metric: "op.count.stronger", value: s.strongerOperatorCount },
      { ...base, metric: "op.count.multisource", value: s.multiSourceCount },
      { ...base, metric: "op.count.advertiser", value: s.advertiserCount },
      { ...base, metric: "op.concentration.class", value: s.concentration });
    if (s.medianReviews !== null) obs.push({ ...base, metric: "op.reviews.median", value: s.medianReviews });
    if (s.medianRating !== null) obs.push({ ...base, metric: "op.rating.median", value: s.medianRating });
    if (s.websiteAdoptionPct !== null) obs.push({ ...base, metric: "op.website.adoptionpct", value: s.websiteAdoptionPct });
  }
  if (obs.length) await store.insertBatch(obs.splice(0));
  await store.completeRun(runO.run.id, 0);
}

// ---------- (2) keyword universe, one task per POST, budget-fit subset ----------
// Priority: all 12 community (the hypothesis under test) + contrast samples.
const pri = [...cands.filter((c: any) => c.strata === "community"),
  ...cands.filter((c: any) => c.strata === "v0-strong").slice(0, 2),
  ...cands.filter((c: any) => c.strata === "v0-weak").slice(0, 2),
  ...cands.filter((c: any) => c.strata === "hard-serp").slice(0, 2)];
const CAP = 0.30; // remaining headroom under the $1 experiment cap
const runU = await store.beginRun("exp15b-universe", `uni-single-${pri.length}`, { stage: 3, budgetCapUsd: CAP });
if (!(runU.existing && runU.run.status === "completed")) {
  for (const c of pri) {
    const core = c.query.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
    try {
      await store.charge(runU.run.id, "dataforseo", 1, DFS_PER_TASK); // guard stops us at the cap
      const res = await fetch("https://api.dataforseo.com/v3/dataforseo_labs/google/related_keywords/live", {
        method: "POST", headers: { authorization: `Basic ${DFS}`, "content-type": "application/json" },
        body: JSON.stringify([{ keyword: core, location_name: "United States", language_name: "English", depth: 1, limit: 40 }]),
      });
      const raw = await res.json();
      writeFileSync(new URL(`raw/rel-${c.id.replace(/[^a-z0-9]/gi, "_")}.json`, OUT), JSON.stringify(raw));
      const items = raw.tasks?.[0]?.result?.[0]?.items || [];
      const related = items.map((it: any) => ({ keyword: it.keyword_data?.keyword, volume: it.keyword_data?.keyword_info?.search_volume ?? 0, cpc: it.keyword_data?.keyword_info?.cpc ?? null })).filter((r: any) => r.keyword);
      const svc = core.split(" ").filter((w: string) => w.length > 3 && !c.city.toLowerCase().includes(w) && w !== c.state.toLowerCase()).slice(0, 2);
      const u = buildUniverse({ core, serviceTerms: svc, geoTerms: [c.city.toLowerCase()], related });
      c.universe = { count: u.relevantCount, volume: u.totalRelevantVolume, core: u.coreVolume, longtail: u.longTailVolume,
        geo: u.geoIntentVolume, commercial: u.commercialIntentVolume, corePct: u.corePctOfUniverse, cpcMedian: u.cpcMedian,
        top: u.topQueries.slice(0, 3), rejectedCount: u.rejected.length, providerReturned: related.length,
        rejectionReasons: [...new Set(u.rejected.map((r) => r.reason))] };
      const base = { subjectType: "market", subjectId: c.id, source: `dataforseo:${UNIVERSE_VERSION}`, evidenceType: "DERIVED" as const, confidence: 0.85, observedAt: now(), runId: runU.run.id };
      obs.push({ ...base, metric: "kw.universe.count", value: u.relevantCount }, { ...base, metric: "kw.universe.volume", value: u.totalRelevantVolume },
        { ...base, metric: "kw.universe.longtail", value: u.longTailVolume }, { ...base, metric: "kw.universe.geointent", value: u.geoIntentVolume },
        { ...base, metric: "kw.universe.commercialintent", value: u.commercialIntentVolume });
      if (u.corePctOfUniverse !== null) obs.push({ ...base, metric: "kw.universe.corepct", value: u.corePctOfUniverse });
      if (u.cpcMedian !== null) obs.push({ ...base, metric: "kw.cpc.median", value: u.cpcMedian });
    } catch (e: any) { console.log(`  stop/skip ${c.id}: ${e.message.slice(0, 60)}`); break; }
  }
  if (obs.length) await store.insertBatch(obs.splice(0));
  await store.completeRun(runU.run.id, await store.spent(runU.run.id));
}
writeFileSync(new URL("candidates-final.json", OUT), JSON.stringify(cands, null, 1));
console.log("\n=== FINAL ===");
for (const c of cands.filter((x: any) => x.universe || x.operators?.medianReviews !== null)) {
  const u = c.universe, o = c.operators;
  console.log(`${c.strata} | ${c.id} | exact=${c.vol} UNI=${u?.volume ?? "-"}(${u?.count ?? "-"}kw, core ${u?.corePct ?? "-"}%, cpcMed ${u?.cpcMedian ?? "-"}) | OPS rel=${o?.relevantOperatorCount} viable=${o?.viableOperatorCount} strong=${o?.strongerOperatorCount} medRev=${o?.medianReviews ?? "-"} web%=${o?.websiteAdoptionPct ?? "-"} ${o?.concentration ?? ""}`);
}
