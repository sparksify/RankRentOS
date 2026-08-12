// WAVE-1 LIVE EXPERIMENT — portfolio construction across three cohorts.
// Research/design only. No purchases, no deployment. Gates are never lowered:
// Cohort B is a SEPARATE EXPERIMENTAL CLASS with its own (documented) admission
// rules, not a relaxation of the city-asset gates.
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { BUCKETS_VERSION, WEIGHTS_DEFAULT } from "../lib/scoring/composite";
import { MODEL_VERSION } from "../lib/scoring/dimensions";

const ROOT = new URL("../../", import.meta.url);
const OUT = new URL("out/wave-1-experiment/", ROOT);
mkdirSync(OUT, { recursive: true });

const scored = [
  ...(JSON.parse(readFileSync(new URL("out/experiment-2/stage4-scored.json", ROOT), "utf8")) as any[]).map((r) => ({ ...r, experiment: "experiment-2" })),
  ...(JSON.parse(readFileSync(new URL("out/experiment-3/stage4-scored.json", ROOT), "utf8")) as any[]).map((r) => ({ ...r, experiment: "experiment-3" })),
];
const geo = new Map((JSON.parse(readFileSync(new URL("geography-verification.json", OUT), "utf8")) as any[]).map((g) => [g.id, g]));
const comms = JSON.parse(readFileSync(new URL("nt-community-serp.json", OUT), "utf8")) as any[];
const svcRank = JSON.parse(readFileSync(new URL("nt-service-ranking.json", OUT), "utf8"));
const POOL = svcRank.rows.find((r: any) => r.id === "pool-builder");

// Domain options: exact match first, then defensible partial/natural variants.
// A strong opportunity is NEVER dropped just because the perfect EMD is gone.
const slugd = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
const rdap = async (d: string): Promise<boolean | null> => {
  try { const r = await fetch(`https://rdap.verisign.com/com/v1/domain/${d}`, { signal: AbortSignal.timeout(10000) }); return r.status === 404; }
  catch { return null; }   // null = UNKNOWN availability, never assumed available
};
async function domainOptions(kw: string, city: string, state: string) {
  const k = slugd(kw), c = slugd(city), st = state.toLowerCase();
  const cands = [...new Set([`${k}${c}.com`, `${k}${c}${st}.com`, `${c}${k}.com`, `${k}of${c}.com`, `${c}${k}pros.com`])];
  const out: { domain: string; available: boolean | null; approxFirstYearUsd: number }[] = [];
  for (const d of cands) out.push({ domain: d, available: await rdap(d), approxFirstYearUsd: 12.18 });
  return out;
}

const asset = (o: any) => ({
  cohort: o.cohort, service: o.service, serviceSlug: o.serviceSlug, geography: o.geography, state: o.state,
  geographyType: o.geographyType, parentCity: o.parentCity ?? null,
  domainCandidates: o.domainCandidates, preferredDomain: o.preferredDomain, domainAvailable: o.domainAvailable,
  aiScore: o.aiScore, aiBucket: o.aiBucket, evidenceConfidence: o.evidenceConfidence,
  measuredVolume: o.measuredVolume, volumeState: o.volumeState, cpc: o.cpc,
  rankabilityScore: o.rankabilityScore, renterDepthScore: o.renterDepthScore, leadEconomicsScore: o.leadEconomicsScore,
  assetValueScore: o.assetValueScore ?? null, asymmetryScore: o.asymmetryScore ?? null,
  hypothesis: o.hypothesis, reasonSelected: o.reasonSelected,
  falsificationCondition: o.falsificationCondition, scalingCondition: o.scalingCondition,
  geographyVerified: o.geographyVerified, geographyVerdict: o.geographyVerdict,
  demandIsUpperBound: o.demandIsUpperBound ?? false,
  ticketAssumed: o.ticketAssumed ?? null, marginAssumed: o.marginAssumed ?? null,
  serpContext: o.serpContext ?? null, renterContext: o.renterContext ?? null,
  measurementPlan: o.measurementPlan, evidenceRefs: o.evidenceRefs,
});

// ============================ COHORT A — CORE ============================
// Requires the full credible combination: DEMAND x RANKABILITY x LEAD VALUE x
// RENTABILITY. F >= 50 is imposed here (stricter than the bucket gate) because a
// core asset is an INVESTMENT, not an experiment. Thin-economics assets are not
// discarded — they move to Cohort C where their weakness is the hypothesis.
const MAX_SVC = 3, MAX_CITY = 2;
const CONTRARIAN_IDS = new Set([
  "house-cleaning|Orlando|FL", "appliance-repair|Aurora|IL", "mold-remediation|Knoxville|TN",
  "kitchen-remodel|Rockville|MD", "bathroom-remodel|Bellevue|NE",
]);
const corePool = scored
  .filter((r) => !CONTRARIAN_IDS.has(r.id))          // reserved for Cohort C
  .filter((r) => r.bucket && (r.score.composite ?? 0) >= 60 && (r.score.dims.F.score ?? 0) >= 50)
  .filter((r) => { const g = geo.get(r.id); return g && g.verdict !== "unverified-no-address-evidence" && g.verdict !== "serp-not-localized"; })
  .sort((a, b) => (b.score.composite ?? 0) - (a.score.composite ?? 0));

// pre-resolve the selection first (sync), then fetch domains for exactly those
const preselect: any[] = [];
{
  const sN = new Map<string, number>(), cN = new Map<string, number>();
  for (const r of corePool) {
    const s2 = sN.get(r.svc) ?? 0, c2 = cN.get(`${r.city}|${r.state}`) ?? 0;
    if (s2 >= MAX_SVC || c2 >= MAX_CITY) continue;
    sN.set(r.svc, s2 + 1); cN.set(`${r.city}|${r.state}`, c2 + 1);
    preselect.push(r);
    if (preselect.length >= 16) break;
  }
}
const coreDomains = new Map<string, any[]>();
for (const r of preselect) coreDomains.set(r.id, await domainOptions(r.kw, r.city, r.state));

const svcN = new Map<string, number>(), cityN = new Map<string, number>();
const core: any[] = [];
for (const r of corePool) {
  const s = svcN.get(r.svc) ?? 0, c = cityN.get(`${r.city}|${r.state}`) ?? 0;
  if (s >= MAX_SVC || c >= MAX_CITY) continue;
  const g = geo.get(r.id)!;
  const upper = g.verdict === "serp-local-volume-upper-bound";
  svcN.set(r.svc, s + 1); cityN.set(`${r.city}|${r.state}`, c + 1);
  const d = r.score.dims;
  core.push(asset({
    cohort: "A-CORE", service: r.svcLabel, serviceSlug: r.svc, geography: r.city, state: r.state, geographyType: "city",
    domainCandidates: coreDomains.get(r.id), preferredDomain: coreDomains.get(r.id)!.find((d: any) => d.available === true)?.domain ?? null,
    domainAvailable: coreDomains.get(r.id)!.some((d: any) => d.available === true),
    aiScore: r.score.composite, aiBucket: r.bucket, evidenceConfidence: r.score.confidenceScore,
    measuredVolume: r.vol, volumeState: upper ? "measured-upper-bound-shared-city-name" : "measured", cpc: r.cpc,
    rankabilityScore: d.A.score, renterDepthScore: d.E.score, leadEconomicsScore: d.D.score,
    assetValueScore: d.F.score, asymmetryScore: d.H.score,
    ticketAssumed: r.ticket, marginAssumed: r.margin,
    hypothesis: `A=${d.A.score} predicts this SERP is winnable and F=${d.F.score} predicts the lead flow is worth renting. If the A-I model is right, this asset ranks top-10 within ~6 months and attracts a renter.`,
    reasonSelected: `${r.bucket}, composite ${r.score.composite}, F=${d.F.score} (rentable economics), E=${d.E.score} (viable renters), geography ${g.verdict}.`,
    falsificationCondition: "no top-20 position for the primary keyword within 6 months, OR ranks but produces zero leads in 3 further months.",
    scalingCondition: "top-10 within 6 months AND >=1 lead/month => expand this service across the remaining small affluent markets.",
    geographyVerified: true, geographyVerdict: g.verdict, demandIsUpperBound: upper,
    serpContext: { mapPackSize: r.signals.mapPackSize, mapPackAvgReviews: r.signals.avgMapReviews, directoriesInTop3: r.signals.directoriesInTop3, contentDepthBarWords: r.signals.competitorAvgWords, competitorAvgDomainAgeYears: r.signals.competitorAvgDomainAgeYears },
    renterContext: { relevantOperators: r.operators.relevantOperatorCount, viableRenters: r.operators.viableOperatorCount, websiteAdoptionPct: r.operators.websiteAdoptionPct },
    measurementPlan: "standard-city-asset",
    evidenceRefs: { experiment: r.experiment, rawSerp: `out/${r.experiment}/raw/serp-${r.id.replace(/[^a-z0-9]/gi, "_")}.json`, demand: "dataforseo:google_ads/search_volume", scoreModel: MODEL_VERSION, weights: WEIGHTS_DEFAULT.id, buckets: BUCKETS_VERSION },
  }));
  if (core.length >= 16) break;
}

// ==================== COHORT B — NORTH TEXAS POOL CLUSTER ====================
// Admission rules are DELIBERATELY DIFFERENT and stated: community assets are not
// admitted on measured volume (that is the hypothesis under test). They are admitted
// on: real homeowner base, active buildout, affluent, EMD available, and a coherent
// community SERP. Two CITY-LEVEL controls of the same service anchor the comparison.
const CLUSTER_PICK = [
  // [community, incumbent community-specific pool page present?, why]
  ["Windsong Ranch", true, "largest local MPC (3,300 homes, 2,030 acres, Crystal Lagoon); a competitor already runs a community-specific pool page, which is independent evidence an operator believes this demand is real"],
  ["Star Trail", false, "1,300 homes, Prosper ISD, active buildout; NO competitor community page — virgin organic slot"],
  ["Light Farms", true, "~3,000 homes, one of Celina's largest; incumbent community page present (prestigepp.com)"],
  ["Mustang Lakes", true, "1,200 homes, largest amenity centre in North Texas; incumbent community page present"],
  ["Painted Tree", false, "3,400 homes, one of McKinney's largest active MPCs; NO competitor community page"],
  ["Trinity Falls", false, "~3,000 homes NW McKinney; only a Facebook result mentions it — effectively virgin"],
  ["Sandbrock Ranch", false, "1,400 homes Denton Co; weakest map pack in the cluster (19 avg reviews); NO competitor community page"],
  ["Canyon Falls", false, "1,300 homes affluent Argyle ISD; weak pack (24 avg reviews); NO competitor community page"],
];
const cluster: any[] = [];
for (const [name, incumbent, why] of CLUSTER_PICK as [string, boolean, string][]) {
  const c = comms.find((x) => x.name === name && x.kind === "community");
  if (!c) continue;
  cluster.push(asset({
    cohort: "B-NT-POOL-CLUSTER", service: "Pool Builder", serviceSlug: "pool-builder",
    geography: name, state: "TX", geographyType: "master-planned-community", parentCity: c.city,
    domainCandidates: Object.entries(c.domains).map(([d, avail]) => ({ domain: d, available: avail })),
    preferredDomain: c.preferredDomain, domainAvailable: c.preferredDomain !== null,
    aiScore: null, aiBucket: "EXPERIMENTAL-CLASS", evidenceConfidence: "community class — A-I not applied (see design doc §3)",
    measuredVolume: 0, volumeState: "provider-reports-zero — THIS IS THE HYPOTHESIS UNDER TEST", cpc: null,
    rankabilityScore: null, renterDepthScore: null, leadEconomicsScore: null,
    ticketAssumed: POOL.ticket, marginAssumed: POOL.margin,
    hypothesis: `Keyword tools report zero volume for "${"pool builder " + name}", but real homeowners in a ${c.meta?.homes ?? "large"}-home affluent community search using their community name. If true, this site earns impressions and leads that no keyword tool predicted. ${why}`,
    reasonSelected: `Community-cluster member. ${why}. EMD ${c.preferredDomain ?? "unavailable"}. Incumbent community-specific pool page: ${incumbent ? "YES (demand validated by a competitor's investment)" : "NO (virgin organic slot)"}.`,
    falsificationCondition: "fewer than 20 impressions/month after 6 months indexed, across ALL community-modified queries, with no leads — i.e. the community modifier generates no real search behaviour.",
    scalingCondition: ">=1 qualified lead OR >=100 impressions/month within 6 months => build out the remaining ~14 researched NT communities and replicate in a second metro.",
    geographyVerified: true, geographyVerdict: "community-within-verified-metro (SERP localized to parent city)",
    serpContext: { mapPackSize: c.signals.mapPackSize, mapPackAvgReviews: c.signals.avgMapReviews, directoriesInTop3: c.signals.directoriesInTop3, organicResultsMentioningCommunity: c.organicMentioningCommunity, incumbentCommunityPage: incumbent, note: "map pack is inherited from the parent city — Google does not render a distinct community pack, so this asset must win ORGANIC, not the pack" },
    renterContext: { relevantOperators: c.operators.relevantOperatorCount, viableRenters: c.operators.viableOperatorCount, medianReviews: c.operators.medianReviews, note: "24 distinct pool builders serve the cluster; Lonestar Pool & Spa Design appears in 12 of 22 community packs — one renter could take multiple community sites (upside) but that is buyer concentration (risk)" },
    measurementPlan: "community-asset — see design doc §22 (community-name queries, service+community queries, unpredicted long-tail, whether Google treats the community as a geography)",
    evidenceRefs: { rawSerp: `out/wave-1-experiment/raw/serp-pool_builder_${name.replace(/[^a-z0-9]/gi, "_")}_TX.json`, serviceSelection: "out/wave-1-experiment/nt-service-ranking.json", communityMeta: c.meta },
  }));
}
// city-level controls: the comparison that isolates "community targeting works"
for (const [city, vol, role] of [["Prosper", 10, "LOW-measured-demand city control — same service, same metro, city geography. Tools report only 10/mo for a 35k-person affluent city building pools constantly; this tests city-level under-measurement."],
                                 ["Frisco", 320, "HIGH-measured-demand city control — the market where tools DO report demand. Anchors the gradient Frisco 320 > McKinney 210 > Prosper 10 > community 0."]] as [string, number, string][]) {
  const c = comms.find((x) => x.name === city && x.kind === "city-control");
  if (!c) continue;
  cluster.push(asset({
    cohort: "B-NT-POOL-CLUSTER", service: "Pool Builder", serviceSlug: "pool-builder",
    geography: city, state: "TX", geographyType: "city-control", parentCity: null,
    domainCandidates: Object.entries(c.domains).map(([d, avail]) => ({ domain: d, available: avail })),
    preferredDomain: c.preferredDomain, domainAvailable: c.preferredDomain !== null,
    aiScore: null, aiBucket: "CONTROL", evidenceConfidence: "control asset",
    measuredVolume: vol, volumeState: "measured", cpc: null,
    rankabilityScore: null, renterDepthScore: null, leadEconomicsScore: null,
    ticketAssumed: POOL.ticket, marginAssumed: POOL.margin,
    hypothesis: `Control. ${role} If impressions track measured volume, keyword tools are accurate and the community bet fails. If Prosper and the community sites over-perform their measured volume, tools systematically under-measure hyper-local demand.`,
    reasonSelected: `Experimental control for the community cluster. ${role}`,
    falsificationCondition: "n/a — this is a control; it calibrates the cluster result rather than being judged on its own.",
    scalingCondition: "n/a — control.",
    geographyVerified: true, geographyVerdict: "verified (SERP localized, city name unambiguous in TX metro context)",
    serpContext: { mapPackSize: c.signals.mapPackSize, mapPackAvgReviews: c.signals.avgMapReviews, directoriesInTop3: c.signals.directoriesInTop3 },
    renterContext: { relevantOperators: c.operators.relevantOperatorCount, viableRenters: c.operators.viableOperatorCount },
    measurementPlan: "city-control — identical instrumentation to community assets for direct comparison",
    evidenceRefs: { rawSerp: `out/wave-1-experiment/raw/serp-pool_builder_${city}_TX.json`, demand: "dataforseo:google_ads/search_volume" },
  }));
}

// ==================== COHORT C — CONTRARIAN / INFORMATION VALUE ====================
const find = (id: string) => scored.find((r) => r.id === id);
const CONTRARIAN: [string, string, string, string][] = [
  ["house-cleaning|Orlando|FL",
   "HIGH DEMAND x THIN ECONOMICS. 2,900/mo and A=74, but F=34 — the model says the leads are too cheap to rent. Tests the new rentability floor itself: can volume compensate for ~$10 per-lead gross profit?",
   "If it produces many leads that a cleaning company happily pays $300+/mo for, the buckets-1.1.0 economic floor is too strict and is discarding good assets.",
   ">=$300/mo rent achieved => lower the rentability floor and re-admit high-volume/low-ticket services."],
  ["appliance-repair|Aurora|IL",
   "V0 SAYS YES, V2 SAYS BARELY. Appliance repair was a V0 favourite; V2 gives it F=34 and nearly always rejects it (1 of 16 bucketed). 1,300/mo with A=67. Tests whether the V0 thesis or the V2 thesis is right about commodity high-volume services.",
   "If it ranks and rents easily, V2's economic pessimism about commodity services is wrong and D/F need re-calibration.",
   "rented within 6 months => re-open the fragmented-local service family that V2 currently suppresses."],
  ["mold-remediation|Knoxville|TN",
   "WORST RANKABILITY WE WOULD STILL FUND. A=43 with HIGH-VALUE economics (F=66). Directly tests whether A predicts ranking speed, which is the single most load-bearing assumption in the model.",
   "If it ranks as fast as the A=75+ assets, A is over-weighted and rankability is not the binding constraint we believe it is.",
   "top-10 within 6 months => reduce A's weight and admit far more high-economics/hard-SERP markets."],
  ["kitchen-remodel|Rockville|MD",
   "MAX RENTER DEPTH x POOR RANKABILITY. E=100 (the strongest renter market found) but A=42. Tests whether renter depth can carry an asset through a hard SERP.",
   "If it never ranks, E is worthless without A, and renter depth should be demoted to a tie-breaker rather than a 0.17-weight dimension.",
   "ranks and rents => renter depth deserves more weight relative to rankability."],
  ["bathroom-remodel|Bellevue|NE",
   "HIGHEST COMPOSITE IN THE DATASET (85) BUT AMBIGUOUS DEMAND. 'bathroom remodeling bellevue' is shared with Bellevue WA; the 2,400/mo is an upper bound across both. SERP is verified local to NE. Tests whether a shared-name market can be captured at all, and how much of shared volume is really local.",
   "If impressions are negligible while Bellevue WA's equivalent query is busy, shared-name markets must be excluded from scoring entirely.",
   "meaningful local impressions => shared-name markets are investable and we can stop discarding them."],
];
const contrarianDomains = new Map<string, any[]>();
for (const [id] of CONTRARIAN) { const r = find(id); if (r) contrarianDomains.set(id, await domainOptions(r.kw, r.city, r.state)); }
const contrarian = (await Promise.all(CONTRARIAN.map(async ([id, hyp, fals, scale]) => {
  const r = find(id); if (!r) return null;
  const g = geo.get(id); const d = r.score.dims;
  return asset({
    cohort: "C-CONTRARIAN", service: r.svcLabel, serviceSlug: r.svc, geography: r.city, state: r.state, geographyType: "city",
    domainCandidates: contrarianDomains.get(id), preferredDomain: contrarianDomains.get(id)!.find((d: any) => d.available === true)?.domain ?? null,
    domainAvailable: contrarianDomains.get(id)!.some((d: any) => d.available === true),
    aiScore: r.score.composite, aiBucket: r.bucket, evidenceConfidence: r.score.confidenceScore,
    measuredVolume: r.vol, volumeState: g?.verdict === "serp-local-volume-upper-bound" ? "measured-upper-bound-shared-city-name" : "measured", cpc: r.cpc,
    rankabilityScore: d.A.score, renterDepthScore: d.E.score, leadEconomicsScore: d.D.score,
    assetValueScore: d.F.score, asymmetryScore: d.H.score, ticketAssumed: r.ticket, marginAssumed: r.margin,
    hypothesis: hyp, reasonSelected: "Selected to test a specific way the A-I model may be WRONG, not because it scores well. Exploration, not exploitation.",
    falsificationCondition: fals, scalingCondition: scale,
    geographyVerified: !!g, geographyVerdict: g?.verdict ?? "unknown",
    demandIsUpperBound: g?.verdict === "serp-local-volume-upper-bound",
    serpContext: { mapPackSize: r.signals.mapPackSize, mapPackAvgReviews: r.signals.avgMapReviews, contentDepthBarWords: r.signals.competitorAvgWords, competitorAvgDomainAgeYears: r.signals.competitorAvgDomainAgeYears },
    renterContext: { relevantOperators: r.operators.relevantOperatorCount, viableRenters: r.operators.viableOperatorCount },
    measurementPlan: "standard-city-asset + explicit tracking of the dimension under test",
    evidenceRefs: { experiment: r.experiment, rawSerp: `out/${r.experiment}/raw/serp-${id.replace(/[^a-z0-9]/gi, "_")}.json`, scoreModel: MODEL_VERSION },
  });
}))).filter(Boolean) as any[];

// ---------- economics ----------
const all = [...core, ...cluster, ...contrarian];
const COST = { known: { domainFirstYear: 12.18, domainRenewal: 15.18 }, estimated: { hosting: 1.0, content: 8.0, deploy: 5.0, monitoring: 0.5 },
  unknown: ["deployment engine per-asset cost (engine not built)", "renter acquisition cost/time", "link/citation acquisition if needed to rank", "content revision cycles", "pool-cluster content is photo-heavy and may cost more than the generic estimate"] };
const n = all.length;
const upfront = n * (COST.known.domainFirstYear + COST.estimated.content + COST.estimated.deploy);
const monthly = n * (COST.estimated.hosting + COST.estimated.monitoring);

const portfolio = {
  generatedAt: new Date(1786000000000).toISOString(),
  design: "three-cohort live experiment: exploitation (A) + controlled hypothesis test (B) + exploration (C)",
  modelVersion: MODEL_VERSION, weights: WEIGHTS_DEFAULT.id, buckets: BUCKETS_VERSION,
  totals: { assets: n, cohortA: core.length, cohortB: cluster.length, cohortC: contrarian.length },
  economics: { assets: n, upfrontCapital: +upfront.toFixed(2), monthlyCarrying: +monthly.toFixed(2),
    sixMonthRiskCapital: +(upfront + monthly * 6).toFixed(2), twelveMonthRiskCapital: +(upfront + monthly * 12 + n * COST.known.domainRenewal).toFixed(2),
    domainCostEstimate: +(n * COST.known.domainFirstYear).toFixed(2), costBasis: COST },
  selectedClusterService: { service: "Pool Builder", clusterFitness: POOL.clusterFitness, leadValue: POOL.leadValue,
    metroVolume: POOL.metroVolume, cpcMedian: POOL.cpcMedian, rationale: "highest cluster fitness by a wide margin (85 vs 52 runner-up): $2,125 assumed lead value, the highest measured NT metro demand of any high-ticket service (1,030/mo), a $5.23 median CPC that is low relative to lead value, maximal new-home relevance and strong visual-content suitability." },
  assets: all,
};
writeFileSync(new URL("portfolio.json", OUT), JSON.stringify(portfolio, null, 1));

console.log(`WAVE 1 = ${n} assets | A-core ${core.length} | B-cluster ${cluster.length} | C-contrarian ${contrarian.length}`);
console.log(`economics: upfront $${upfront.toFixed(2)} | monthly $${monthly.toFixed(2)} | 6-mo $${(upfront + monthly * 6).toFixed(2)} | 12-mo $${(upfront + monthly * 12 + n * COST.known.domainRenewal).toFixed(2)}`);
console.log("\n--- COHORT A (core) ---");
core.forEach((a) => console.log(`  ${String(a.aiScore).padStart(3)} | ${a.aiBucket.padEnd(11)} | A${String(a.rankabilityScore).padStart(3)} F${String(a.assetValueScore).padStart(3)} | ${String(a.measuredVolume).padStart(4)}/mo | ${a.service} — ${a.geography}, ${a.state}${a.demandIsUpperBound ? " [vol=upper bound]" : ""}`));
console.log("\n--- COHORT B (NT pool cluster) ---");
cluster.forEach((a) => console.log(`  ${a.geographyType.padEnd(26)} | ${(a.preferredDomain ?? "NO DOMAIN").padEnd(34)} | ${a.geography}${a.parentCity ? " (" + a.parentCity + ")" : ""}`));
console.log("\n--- COHORT C (contrarian) ---");
contrarian.forEach((a) => console.log(`  ${String(a.aiScore).padStart(3)} | A${String(a.rankabilityScore).padStart(3)} E${String(a.renterDepthScore).padStart(3)} F${String(a.assetValueScore).padStart(3)} | ${a.service} — ${a.geography}, ${a.state}`));
