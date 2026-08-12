// EXPERIMENT 1.5: close evidence gaps. Budget cap $1.00 actual provider spend.
// (a) retry 10 geo-failed SERPs via serpLocation  (b) content-depth + domain-age
// enrichment for survivors  (c) keyword universe across ALL strata
// (d) operator/renter depth from existing SERP evidence (free re-read).
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "fs";
import { createSupabaseStore } from "../lib/store/supabase";
import { serpUrl, parseSerpResponse } from "../lib/providers/serpapi";
import { serpLocation } from "../lib/geo/states";
import { extractSignals } from "../lib/serp/signals";
import { contentDepth } from "../lib/crawl/contentDepth";
import { rdapUrl, registrationAgeYears } from "../lib/providers/rdap";
import { buildUniverse, UNIVERSE_VERSION } from "../lib/keywords/universe";
import { dedupeOperators, depthSignals, OPERATORS_VERSION } from "../lib/operators/depth";

const SERP_COST = 0.015, DFS_IDEAS_COST = 0.05;
const store = createSupabaseStore();
const KEY = process.env.SERPAPI_KEY!, DFS = process.env.DATAFORSEO_AUTH!;
const E1 = new URL("../../out/experiment-1/", import.meta.url);
const OUT = new URL("../../out/experiment-1_5/", import.meta.url);
mkdirSync(new URL("raw/", OUT), { recursive: true });
const cands = JSON.parse(readFileSync(new URL("candidates.json", E1), "utf8"));
const findings: any[] = [];
const obsBuf: any[] = [];
const now = () => Date.now();

// ---------- (a) retry geo-failed SERPs ----------
const failedIds = new Set(JSON.parse(readFileSync(new URL("decisions.json", E1), "utf8"))
  .filter((d: any) => d.action === "collector-error").map((d: any) => d.id));
const retry = cands.filter((c: any) => failedIds.has(c.id));
const runR = await store.beginRun("exp15-serp-retry", `retry-${retry.length}`, { stage: 4, budgetCapUsd: 0.25 });
let retryOk = 0;
if (!(runR.existing && runR.run.status === "completed")) {
  for (const c of retry) {
    try {
      await store.charge(runR.run.id, "serpapi", 1, SERP_COST);
      const loc = serpLocation(c.city, c.state);           // <- the fix
      const res = await fetch(serpUrl(c.query, loc, KEY));
      const raw = await res.json();
      if (raw.error) throw new Error(raw.error);
      const f = `serp-retry-${c.id.replace(/[^a-z0-9]/gi, "_")}.json`;
      writeFileSync(new URL(`raw/${f}`, OUT), JSON.stringify(raw));
      const g: any = extractSignals(parseSerpResponse(raw) as any, c.city);
      c.signals = g; c.retried = true; retryOk++;
      const base = { subjectType: "market", subjectId: c.id, source: `serpapi:signals-v1:${f}`, evidenceType: "DERIVED" as const, confidence: 0.85, observedAt: now(), runId: runR.run.id };
      obsBuf.push(...([["serp.directory.count", g.directoriesInTop3], ["serp.franchise.count", g.franchisesInTop3],
        ["serp.outoftown.count", g.outOfTownInTop3], ["serp.innerpage.count", g.innerPagesInTop5],
        ["serp.intentmismatch.count", g.intentMismatchInTop5], ["serp.titletargeting.count", g.top3TitlesMissingCity],
        ["serp.ads.count", g.adCount], ["serp.mappack.count", g.mapPackSize],
        ["serp.mappack.avgreviews", g.avgMapReviews], ["serp.mappack.nowebsite.count", g.mapListingsWithoutWebsite]] as [string, any][])
        .filter(([, v]) => typeof v === "number").map(([metric, value]) => ({ ...base, metric, value })));
    } catch (e: any) { findings.push({ id: c.id, stage: "retry", error: e.message.slice(0, 90) }); }
  }
  if (obsBuf.length) { await store.insertBatch(obsBuf.splice(0)); }
  await store.completeRun(runR.run.id, await store.spent(runR.run.id));
}

// ---------- (b) content depth + domain age (free crawl + free RDAP) ----------
const withSerp = cands.filter((c: any) => c.signals?.mapPackSize !== undefined || c.retried);
const runE = await store.beginRun("exp15-enrich", `enrich-${withSerp.length}`, { stage: 4, budgetCapUsd: 0.01 });
if (!(runE.existing && runE.run.status === "completed")) {
  for (const c of withSerp) {
    const slug = c.id.replace(/[^a-z0-9]/gi, "_");
    // prefer the 1.5 retry payload; fall back to experiment-1; skip saved error payloads
    const retryFile = readdirSync(new URL("raw/", OUT)).find((f) => f.includes(slug));
    const e1File = readdirSync(new URL("raw/", E1)).find((f) => f.includes(slug) && f.startsWith("serp-"));
    const src = retryFile ? new URL(`raw/${retryFile}`, OUT) : e1File ? new URL(`raw/${e1File}`, E1) : null;
    if (!src) continue;
    const evFile = retryFile || e1File!;
    const raw = JSON.parse(readFileSync(src, "utf8"));
    if (raw?.error) { findings.push({ id: c.id, stage: "enrich", skipped: "stored error payload" }); continue; }
    const parsed: any = parseSerpResponse(raw);
    const top = (parsed.organic || []).slice(0, 3);
    try {
      const d: any = await contentDepth(top.map((o: any) => o.link).filter(Boolean), fetch);
      const hosts = [...new Set(top.map((o: any) => { try { return new URL(o.link).hostname.replace(/^www\./, ""); } catch { return null; } }).filter((h: any) => h?.endsWith(".com")))] as string[];
      const ages = (await Promise.all(hosts.map(async (h) => { try { const r = await fetch(rdapUrl(h)); if (!r.ok) return null; return registrationAgeYears(await r.json(), Date.now()); } catch { return null; } }))).filter((a): a is number => typeof a === "number");
      const avgAge = ages.length ? Math.round((ages.reduce((s, a) => s + a, 0) / ages.length) * 10) / 10 : null;
      c.contentDepth = d?.avgWords ?? d ?? null; c.domainAge = avgAge;
      const base = { subjectType: "market", subjectId: c.id, source: `crawl+rdap:${evFile}`, evidenceType: "DERIVED" as const, confidence: 0.75, observedAt: now(), runId: runE.run.id };
      if (typeof c.contentDepth === "number") obsBuf.push({ ...base, metric: "serp.competitor.contentdepth", value: c.contentDepth });
      if (avgAge !== null) obsBuf.push({ ...base, metric: "serp.competitor.domainage", value: avgAge });
    } catch { /* enrichment failure non-fatal */ }
    // ---------- (d) operator depth from the SAME evidence (free) ----------
    const ev: any[] = [];
    for (const p of parsed.localResults ?? parsed.local_results?.places ?? []) ev.push({ name: p.title, source: "mappack", rating: p.rating, reviews: p.reviews, website: p.website ?? null });
    for (const o of (parsed.organic || []).slice(0, 8)) { try { ev.push({ name: new URL(o.link).hostname.replace(/^www\./, ""), source: "organic", domain: new URL(o.link).hostname.replace(/^www\./, "") }); } catch {} }
    for (const a of parsed.ads ?? []) ev.push({ name: a.displayed_link || a.title, source: "ads" });
    const ops = dedupeOperators(ev);
    const s = depthSignals(ops);
    c.operators = s;
    const ob = { subjectType: "market", subjectId: c.id, source: `${OPERATORS_VERSION}:${evFile}`, evidenceType: "DERIVED" as const, confidence: 0.7, observedAt: now(), runId: runE.run.id };
    obsBuf.push(
      { ...ob, metric: "op.count.relevant", value: s.relevantOperatorCount },
      { ...ob, metric: "op.count.viable", value: s.viableOperatorCount },
      { ...ob, metric: "op.count.stronger", value: s.strongerOperatorCount },
      { ...ob, metric: "op.count.multisource", value: s.multiSourceCount },
      { ...ob, metric: "op.count.advertiser", value: s.advertiserCount },
      { ...ob, metric: "op.concentration.class", value: s.concentration },
    );
    if (s.medianReviews !== null) obsBuf.push({ ...ob, metric: "op.reviews.median", value: s.medianReviews });
    if (s.medianRating !== null) obsBuf.push({ ...ob, metric: "op.rating.median", value: s.medianRating });
    if (s.websiteAdoptionPct !== null) obsBuf.push({ ...ob, metric: "op.website.adoptionpct", value: s.websiteAdoptionPct });
  }
  if (obsBuf.length) await store.insertBatch(obsBuf.splice(0));
  await store.completeRun(runE.run.id, 0);
}

// ---------- (c) keyword universe: ALL strata (DataForSEO keyword ideas) ----------
const uniTargets = cands.filter((c: any) => c.strata !== "questionable");
const runU = await store.beginRun("exp15-universe", `uni-${uniTargets.length}`, { stage: 3, budgetCapUsd: 0.6 });
if (!(runU.existing && runU.run.status === "completed")) {
  await store.charge(runU.run.id, "dataforseo", uniTargets.length, DFS_IDEAS_COST);
  const seeds = uniTargets.map((c: any) => c.query.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim());
  const res = await fetch("https://api.dataforseo.com/v3/dataforseo_labs/google/related_keywords/live", {
    method: "POST", headers: { authorization: `Basic ${DFS}`, "content-type": "application/json" },
    body: JSON.stringify(seeds.slice(0, 40).map((kw: string) => ({ keyword: kw, location_name: "United States", language_name: "English", depth: 1, limit: 40 }))),
  });
  const raw = await res.json();
  writeFileSync(new URL("raw/dfs-related.json", OUT), JSON.stringify(raw));
  const tasks = raw.tasks || [];
  uniTargets.forEach((c: any, i: number) => {
    const t = tasks[i];
    const items = t?.result?.[0]?.items || [];
    const related = items.map((it: any) => ({
      keyword: it.keyword_data?.keyword ?? it.keyword,
      volume: it.keyword_data?.keyword_info?.search_volume ?? 0,
      cpc: it.keyword_data?.keyword_info?.cpc ?? null,
    })).filter((r: any) => r.keyword);
    const svcTokens = c.query.toLowerCase().split(" ").filter((w: string) => w.length > 3 && ![c.city.toLowerCase(), c.state.toLowerCase()].includes(w)).slice(0, 2);
    const u = buildUniverse({ core: c.query.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim(), serviceTerms: svcTokens, geoTerms: [c.city.toLowerCase()], related });
    c.universe = { count: u.relevantCount, volume: u.totalRelevantVolume, core: u.coreVolume, longtail: u.longTailVolume,
      geo: u.geoIntentVolume, commercial: u.commercialIntentVolume, corePct: u.corePctOfUniverse, cpcMedian: u.cpcMedian,
      top: u.topQueries.slice(0, 3), rejected: u.rejected.length, providerReturned: related.length };
    const base = { subjectType: "market", subjectId: c.id, source: `dataforseo:${UNIVERSE_VERSION}:dfs-related.json`, evidenceType: "DERIVED" as const, confidence: 0.85, observedAt: now(), runId: runU.run.id };
    obsBuf.push({ ...base, metric: "kw.universe.count", value: u.relevantCount }, { ...base, metric: "kw.universe.volume", value: u.totalRelevantVolume },
      { ...base, metric: "kw.universe.longtail", value: u.longTailVolume }, { ...base, metric: "kw.universe.geointent", value: u.geoIntentVolume },
      { ...base, metric: "kw.universe.commercialintent", value: u.commercialIntentVolume });
    if (u.corePctOfUniverse !== null) obsBuf.push({ ...base, metric: "kw.universe.corepct", value: u.corePctOfUniverse });
    if (u.cpcMedian !== null) obsBuf.push({ ...base, metric: "kw.cpc.median", value: u.cpcMedian });
  });
  if (obsBuf.length) await store.insertBatch(obsBuf.splice(0));
  await store.completeRun(runU.run.id, DFS_IDEAS_COST);
}

writeFileSync(new URL("candidates-enriched.json", OUT), JSON.stringify(cands, null, 1));
writeFileSync(new URL("findings.json", OUT), JSON.stringify(findings, null, 1));
console.log(`retry ok: ${retryOk}/${retry.length} | enriched: ${withSerp.length} | universe: ${uniTargets.length}`);
for (const c of cands.filter((x: any) => x.universe || x.operators)) {
  console.log(`${c.strata} | ${c.id} | exact=${c.vol} uni=${c.universe?.volume ?? "-"}(${c.universe?.count ?? 0}kw core${c.universe?.corePct ?? "-"}%) | ops rel=${c.operators?.relevantOperatorCount ?? "-"} viable=${c.operators?.viableOperatorCount ?? "-"} strong=${c.operators?.strongerOperatorCount ?? "-"} conc=${c.operators?.concentration ?? "-"} | words=${c.contentDepth ?? "-"} age=${c.domainAge ?? "-"}`);
}
