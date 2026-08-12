// ORGANIC-ONLY RANKABILITY AUDIT of the 28 Wave-1 candidates.
// Re-scores every candidate as an organic-only asset with NO Google Business Profile.
// Local-pack facts are retained as market evidence and explicitly excluded from the score.
// Free: reparses SERPs already held; crawls competitor pages for the cluster (no provider spend).
import { readFileSync, writeFileSync, existsSync } from "fs";
import { organicRankability, localPackEvidence, ORGANIC_VERSION } from "../lib/serp/organic";
import { parseSerpResponse } from "../lib/providers/serpapi";
import { wordCount } from "../lib/crawl/contentDepth";
import { rdapUrl, registrationAgeYears } from "../lib/providers/rdap";
import { DIRECTORY_DOMAINS } from "../lib/serp/lists";

const ROOT = new URL("../../", import.meta.url);
const OUT = new URL("out/wave-1-experiment/", ROOT);
const portfolio = JSON.parse(readFileSync(new URL("portfolio.json", OUT), "utf8"));
const scored = [
  ...(JSON.parse(readFileSync(new URL("out/experiment-2/stage4-scored.json", ROOT), "utf8")) as any[]),
  ...(JSON.parse(readFileSync(new URL("out/experiment-3/stage4-scored.json", ROOT), "utf8")) as any[]),
];
const byGeoSvc = new Map(scored.map((r) => [`${r.svc}|${r.city}|${r.state}`, r]));

const rawFor = (a: any): any | null => {
  if (a.cohort === "B-NT-POOL-CLUSTER") {
    const f = new URL(`raw/serp-pool_builder_${a.geography.replace(/[^a-z0-9]/gi, "_")}_TX.json`, OUT);
    return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null;
  }
  const id = `${a.serviceSlug}|${a.geography}|${a.state}`.replace(/[^a-z0-9]/gi, "_");
  for (const e of ["experiment-2", "experiment-3"]) {
    const f = new URL(`out/${e}/raw/serp-${id}.json`, ROOT);
    if (existsSync(f)) return JSON.parse(readFileSync(f, "utf8"));
  }
  return null;
};

// content bar for cluster assets (never collected) — crawl the same way as Exp-2/3
const depthCache = new URL("cluster-depth.json", OUT);
const cachedDepth: Record<string, any> = existsSync(depthCache) ? JSON.parse(readFileSync(depthCache, "utf8")) : {};
async function depthFor(a: any, raw: any) {
  if (a.cohort !== "B-NT-POOL-CLUSTER") {
    const s = byGeoSvc.get(`${a.serviceSlug}|${a.geography}|${a.state}`);
    return { words: s?.signals?.competitorAvgWords ?? null, age: s?.signals?.competitorAvgDomainAgeYears ?? null };
  }
  if (cachedDepth[a.geography]) return cachedDepth[a.geography];
  const parsed: any = parseSerpResponse(raw);
  const comps = (parsed.organic || []).filter((o: any) => {
    try { const h = new URL(o.link).hostname.replace(/^www\./, ""); return !DIRECTORY_DOMAINS.some((d) => h === d || h.endsWith(`.${d}`)); }
    catch { return false; }
  }).slice(0, 3);
  const words: number[] = [], ages: number[] = [];
  for (const o of comps) {
    try { const res = await fetch(o.link, { signal: AbortSignal.timeout(12000), headers: { "user-agent": "Mozilla/5.0 (compatible; RankRentOS research)" } });
      if (res.ok) words.push(wordCount(await res.text())); } catch { /* UNKNOWN */ }
    try { const h = new URL(o.link).hostname.replace(/^www\./, "");
      const rd = await fetch(rdapUrl(h), { signal: AbortSignal.timeout(10000) });
      if (rd.ok) { const y = registrationAgeYears(await rd.json(), Date.now()); if (y !== null) ages.push(y); } } catch { /* UNKNOWN */ }
  }
  const out = { words: words.length ? Math.round(words.reduce((x, y) => x + y, 0) / words.length) : null,
                age: ages.length ? Math.round((ages.reduce((x, y) => x + y, 0) / ages.length) * 10) / 10 : null };
  cachedDepth[a.geography] = out;
  return out;
}

const results: any[] = [];
for (const a of portfolio.assets) {
  const raw = rawFor(a);
  if (!raw) { results.push({ ...a, organic: null, note: "no raw SERP" }); continue; }
  const parsed: any = parseSerpResponse(raw);
  const d = await depthFor(a, raw);
  // head terms of the service, stemmed, so "Bathroom Remodeling" matches "remodel"
  const serviceTerms = a.service.toLowerCase().split(/\s+/)
    .filter((w: string) => w.length > 3)
    .map((w: string) => w.replace(/(ing|ers|er|s)$/, ""));
  const org = organicRankability({
    organic: (parsed.organic || []).map((o: any, i: number) => ({ link: o.link, title: o.title, position: o.position ?? i + 1 })),
    geo: a.geography, serviceTerms, competitorAvgWords: d.words, competitorAvgDomainAgeYears: d.age,
  });
  const pack = localPackEvidence(a.serpContext?.mapPackSize ?? null, a.serpContext?.mapPackAvgReviews ?? null, a.serpContext?.mapListingsWithoutWebsite ?? null);
  results.push({
    cohort: a.cohort, service: a.service, geography: a.geography, state: a.state,
    priorA: a.rankabilityScore, organicScore: org.score, organicVerdict: org.verdict,
    delta: a.rankabilityScore !== null && org.score !== null ? org.score - a.rankabilityScore : null,
    displaceableTop5: org.displaceableTop5, displaceableTop10: org.displaceableTop10,
    hardLocalTop3: org.hardLocalTop3, hardLocalTop5: org.hardLocalTop5,
    geoTargetedCompetitorsTop5: org.geoTargetedCompetitorsTop5,
    contentBarWords: d.words, competitorDomainAgeYears: d.age,
    serviceTerms,
    topSlots: org.slots.slice(0, 5).map((s) => `${s.position}. ${s.host} [${s.slotClass}${s.displaceable ? "" : "*"}]`),
    localPackEvidence: pack, organicRationale: org.rationale, missing: org.missing, version: ORGANIC_VERSION,
  });
}
writeFileSync(depthCache, JSON.stringify(cachedDepth, null, 1));
writeFileSync(new URL("organic-audit.json", OUT), JSON.stringify(results, null, 1));

const fmt = (r: any) => `${(r.organicVerdict ?? "-").padEnd(18)} | org ${String(r.organicScore ?? "-").padStart(3)} | priorA ${String(r.priorA ?? "-").padStart(4)} | Δ${String(r.delta ?? "-").padStart(4)} | soft ${r.displaceableTop5}/5 | hard ${r.hardLocalTop3}/3 | geoTgt ${r.geoTargetedCompetitorsTop5} | ${r.service} — ${r.geography}, ${r.state}`;
for (const c of ["A-CORE", "B-NT-POOL-CLUSTER", "C-CONTRARIAN"]) {
  console.log(`\n=== ${c} ===`);
  results.filter((r) => r.cohort === c).sort((a, b) => (b.organicScore ?? 0) - (a.organicScore ?? 0)).forEach((r) => console.log("  " + fmt(r)));
}
const v = results.reduce((a: any, r) => { a[r.organicVerdict ?? "none"] = (a[r.organicVerdict ?? "none"] || 0) + 1; return a; }, {});
console.log("\nverdicts:", JSON.stringify(v));
const inflated = results.filter((r) => r.delta !== null && r.delta <= -15);
console.log(`\ncandidates whose rankability was materially INFLATED by map-pack credit (Δ <= -15): ${inflated.length}`);
inflated.sort((a, b) => a.delta - b.delta).forEach((r) => console.log(`  Δ${r.delta} | ${r.service} — ${r.geography}: pack "${r.localPackEvidence.interpretation.slice(0, 60)}" but organic ${r.organicVerdict}`));
