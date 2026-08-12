// WAVE-1 v3 — adds the STANDALONE vs REGIONAL-HUB architecture experiment.
// Builds on v2 (preserved); nothing is discarded. No purchases, no deployment.
//
// Wave 1 has four jobs: find rentable assets; validate organic-v1.1 against
// Dimension A; test whether zero-volume community queries produce real traffic;
// and test hyperlocal-standalone vs regional-hub architecture on MATCHED pairs.
//
// Both rankability models are carried separately on every asset. Neither is
// overwritten. Neither is assumed correct.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { organicRankability } from "../lib/serp/organic";
import { parseSerpResponse } from "../lib/providers/serpapi";
import { WEIGHTS_DEFAULT, BUCKETS_VERSION } from "../lib/scoring/composite";
import { MODEL_VERSION } from "../lib/scoring/dimensions";

const ROOT = new URL("../../", import.meta.url);
const OUT = new URL("out/wave-1-experiment/", ROOT);
mkdirSync(OUT, { recursive: true });

const scored = [
  ...(JSON.parse(readFileSync(new URL("out/experiment-2/stage4-scored.json", ROOT), "utf8")) as any[]).map((r) => ({ ...r, exp: "experiment-2" })),
  ...(JSON.parse(readFileSync(new URL("out/experiment-3/stage4-scored.json", ROOT), "utf8")) as any[]).map((r) => ({ ...r, exp: "experiment-3" })),
];
const geo = new Map((JSON.parse(readFileSync(new URL("geography-verification.json", OUT), "utf8")) as any[]).map((g) => [g.id, g]));
const comms = JSON.parse(readFileSync(new URL("nt-community-serp.json", OUT), "utf8")) as any[];
const depth = JSON.parse(readFileSync(new URL("cluster-depth.json", OUT), "utf8"));
const POOL = JSON.parse(readFileSync(new URL("nt-service-ranking.json", OUT), "utf8")).rows.find((r: any) => r.id === "pool-builder");
const prior28 = new Set((JSON.parse(readFileSync(new URL("portfolio.json", OUT), "utf8")).assets as any[]).map((a) => `${a.service}|${a.geography}`));

const terms = (label: string) => label.toLowerCase().split(/\s+/).filter((w) => w.length > 3).map((w) => w.replace(/(ing|ers|er|s)$/, ""));
const orgOf = (path: URL, place: string, svc: string, words: number | null, age: number | null, geoType: "city" | "community" = "city") => {
  if (!existsSync(path)) return null;
  const p: any = parseSerpResponse(JSON.parse(readFileSync(path, "utf8")));
  return organicRankability({ organic: (p.organic || []).map((o: any, i: number) => ({ link: o.link, title: o.title, position: o.position ?? i + 1 })), geo: place, serviceTerms: terms(svc), geoType, competitorAvgWords: words, competitorAvgDomainAgeYears: age });
};
const cityOrg = (r: any) => orgOf(new URL(`out/${r.exp}/raw/serp-${r.id.replace(/[^a-z0-9]/gi, "_")}.json`, ROOT), r.city, r.svcLabel, r.signals.competitorAvgWords, r.signals.competitorAvgDomainAgeYears);
const commOrg = (n: string, t: "city" | "community" = "community") => orgOf(new URL(`raw/serp-pool_builder_${n.replace(/[^a-z0-9]/gi, "_")}_TX.json`, OUT), n, "Pool Builder", depth[n]?.words ?? null, depth[n]?.age ?? null, t);
const incumbentOf = (n: string) => {
  const f = new URL(`raw/serp-pool_builder_${n.replace(/[^a-z0-9]/gi, "_")}_TX.json`, OUT);
  if (!existsSync(f)) return false;
  const p: any = parseSerpResponse(JSON.parse(readFileSync(f, "utf8")));
  return (p.organic || []).some((x: any) => { const t = (x.title ?? "").toLowerCase(), u = (x.link ?? "").toLowerCase(); return t.includes(n.toLowerCase()) && (t.includes("pool") || u.includes("pool")); });
};
const slugd = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
const kebab = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const rdap = async (d: string): Promise<boolean | null> => {
  try { const r = await fetch(`https://rdap.verisign.com/com/v1/domain/${d}`, { signal: AbortSignal.timeout(10000) }); return r.status === 404; } catch { return null; }
};
async function domains(svc: string, place: string, state: string) {
  const k = slugd(svc), c = slugd(place), st = state.toLowerCase();
  const out: any[] = [];
  for (const d of [...new Set([`${k}${c}.com`, `${k}${c}${st}.com`, `${c}${k}.com`, `${k}of${c}.com`, `${c}${k}pros.com`])]) out.push({ domain: d, available: await rdap(d), approxFirstYearUsd: 12.18 });
  return out;
}

// Outcome fields — the join from pre-launch evidence through to rentability.
const MEASUREMENT = ["publishDate", "indexDate", "firstImpressionDate", "firstRankingDate",
  "timeToTop100", "timeToTop50", "timeToTop20", "timeToTop10", "timeToTop5",
  "impressions", "clicks", "organicSessions", "calls", "forms",
  "leadsTotal", "qualifiedLeads", "leadValueEstimated", "leadValueRealized", "renterOutreach", "renterResponses",
  "renterInterest", "rentalAgreementAchieved", "monthlyRentRealized"];

// RANKING TRAJECTORY — the primary instrument for validating the two rankability
// models. A single end-state rank cannot distinguish "ranked fast then stalled" from
// "climbed steadily"; the models are claims about SPEED, so speed must be sampled.
const RANKING_TRAJECTORY = {
  observationSchema: { experimentId: "string", query: "string", queryRole: "primary|secondary|community-modified|city-level|unpredicted",
    checkDate: "ISO date", position: "integer 1-100, or null = not in top 100 (UNKNOWN is not 101)",
    rankingUrl: "string", serpFeaturesPresent: "string[]", device: "desktop", location: "the asset's city/community" },
  cadence: "weekly from publishDate through week 12, then fortnightly through week 26",
  queriesPerAsset: { primary: "1 — the exact service+geography query the asset targets",
    secondary: "2-4 close variants",
    communityModified: "community assets only: community-name and service+community queries",
    unpredicted: "any query Search Console reports impressions for that no keyword tool predicted — the direct test of hyper-local under-measurement" },
  derived: ["daysToFirstTop100", "daysToTop50", "daysToTop20", "daysToTop10", "daysToTop5",
    "positionSlopePerWeek", "positionVolatility", "peakPosition", "positionAtDay90", "positionAtDay180"],
  nullHandling: "position null means NOT FOUND in the top 100 — it must never be stored as 101 or 0, and an unchecked week must be absent rather than null",
};
const PREREG = {
  predictorsUnderTest: ["dimensionA", "organicV1_2", "measuredVolume", "cpc", "renterDepthE", "leadEconomicsD", "assetValueF",
    "contentBarWords", "competitorDomainAgeYears", "geographyType", "incumbentTargeting", "architectureTreatment"],
  chain: "rankability -> traffic -> leads -> rentability, each stage measured separately so failure can be localised",
  joinKey: "experimentId joins pre-launch evidence -> deployment -> ranking -> traffic -> leads -> rentability",
  rankingTrajectory: RANKING_TRAJECTORY,
  // Endpoints fixed BEFORE launch so the analysis cannot be chosen to fit the result.
  primaryEndpoint: "daysToTop20 on the primary query",
  secondaryEndpoints: ["positionAtDay90", "daysToFirstImpression", "impressionsAtDay180", "leadsAtDay180"],
  analyses: [
    { id: "H1-model-validation", question: "Does Dimension A or organic-v1.2 better predict ranking speed?",
      method: "Spearman rank correlation of each score against daysToTop20 across all city assets (Groups A and C, n=11). The six pre-identified disagreement assets carry the most weight because the models make opposite predictions there.",
      decisionRule: "If organic-v1.2 correlates more strongly with daysToTop20 AND both ~50-point disagreement assets (Rochester, Naperville) fail to reach top 20, rebuild Dimension A as A-2.0.0 around organic structure. If they rank, retain A unchanged." },
    { id: "H2-community-demand", question: "Do zero-volume community queries produce real search activity?",
      method: "Compare impressions and unpredicted-query counts for the 12 community assets against the 3 city controls, normalised by measured volume (Frisco 320 / McKinney 210 / Prosper 10 / community 0).",
      decisionRule: "If community assets generate impressions materially above what their 0/mo would imply relative to the control gradient, keyword tools under-measure hyper-local demand and community expansion is justified." },
    { id: "H3-architecture", question: "Standalone hyperlocal domain or page on a regional hub?",
      method: "WITHIN-PAIR difference in daysToTop20 and positionAtDay90 across the 6 matched pairs; paired sign test plus mean within-pair delta. Pairing is what controls for community quality.",
      decisionRule: "Requires >=4 of 6 pairs to yield interpretable data; otherwise the architecture verdict is declared VOID rather than reported weakly." },
    { id: "H4-rentability", question: "Does the $300/mo rentability floor sit in the right place?",
      method: "Compare realised monthlyRentRealized against assetValueF for every asset that acquires a renter, with House Cleaning Orlando (F=34) as the designated probe below the floor." },
  ],
};
const mk = (o: any) => ({ ...o, measurementPlan: MEASUREMENT, preRegistration: PREREG });

// ===================== GROUP A — BEST-EVIDENCE / EXPLOITATION =====================
// Explicit, pre-stated standard (NOT tuned to hit a count):
//   measured demand >= 100/mo AND F >= 50 (rentable) AND organic-v1.1 >= 55 AND geography verified.
// Contrarian assets are reserved for Group C and cannot also be exploitation assets.
const CONTRARIAN_IDS = new Set(["metal-roofing|Rochester|MN", "basement-waterproofing|Naperville|IL",
  "house-cleaning|Orlando|FL", "kitchen-remodel|Rockville|MD", "bathroom-remodel|Bellevue|NE", "appliance-repair|Aurora|IL"]);
const A_MIN_ORG = 55, A_MIN_F = 50, A_MIN_VOL = 100, A_MIN_VIABLE_RENTERS = 1;
const aPool = scored
  .filter((r) => !CONTRARIAN_IDS.has(r.id))
  .filter((r) => (r.vol ?? 0) >= A_MIN_VOL && (r.score.dims.F.score ?? 0) >= A_MIN_F)
  // RENTER GATE (defect fix): an asset with no viable renter cannot be rented, which
  // is the entire business model. bucketOf() enforces opViable >= 1 for every bucketed
  // candidate; the Group-A filter previously omitted it and admitted Conroe TX
  // (viableRenters 0, website adoption 0%). Exploitation assets must clear it too.
  .filter((r) => (r.operators?.viableOperatorCount ?? 0) >= A_MIN_VIABLE_RENTERS)
  .filter((r) => { const g = geo.get(r.id); return !g || (g.verdict !== "unverified-no-address-evidence" && g.verdict !== "serp-not-localized"); })
  .map((r) => ({ r, o: cityOrg(r) }))
  .filter((x) => x.o && (x.o.score ?? 0) >= A_MIN_ORG)
  .sort((a, b) => (b.o!.score ?? 0) - (a.o!.score ?? 0));

const groupA: any[] = [];
{
  const sN = new Map<string, number>(), cN = new Map<string, number>();
  for (const { r, o } of aPool) {
    const s = sN.get(r.svc) ?? 0, c = cN.get(`${r.city}|${r.state}`) ?? 0;
    if (s >= 3 || c >= 2) continue;
    sN.set(r.svc, s + 1); cN.set(`${r.city}|${r.state}`, c + 1);
    const g = geo.get(r.id), d = r.score.dims;
    groupA.push(mk({
      experimentId: `W1-A-${String(groupA.length + 1).padStart(3, "0")}`,
      cohort: "A-EXPLOITATION", treatment: "standalone-city-site", assetType: "standalone-site",
      service: r.svcLabel, serviceSlug: r.svc, geography: r.city, state: r.state, geographyType: "city",
      urlArchitecture: "root domain targets the city+service query directly",
      measuredVolume: r.vol, volumeState: g?.verdict === "serp-local-volume-upper-bound" ? "measured-upper-bound-shared-city-name" : "measured",
      demandProven: true, cpc: r.cpc, ticketAssumed: r.ticket, marginAssumed: r.margin,
      leadValueAssumedUsd: Math.round(r.ticket * r.margin * 0.10),
      dimensionA: d.A.score, dimensionAVersion: d.A.version,
      organicV1: o!.score, organicVerdict: o!.verdict, organicVersion: o!.version,
      organicTop5: o!.slots.slice(0, 5).map((x) => `${x.position}. ${x.host} [${x.slotClass}]`),
      organicStructure: { distinctHostsTop5: o!.distinctHostsTop5, displaceableTop5: o!.displaceableTop5, hardLocalTop3: o!.hardLocalTop3, geoTargetedCompetitorsTop5: o!.geoTargetedCompetitorsTop5 },
      modelDisagreement: (d.A.score ?? 0) - (o!.score ?? 0),
      incumbentTargeting: `${o!.geoTargetedCompetitorsTop5} of ${o!.distinctHostsTop5} distinct top-5 hosts explicitly target ${r.city}`,
      renterDepthE: d.E.score, leadEconomicsD: d.D.score, assetValueF: d.F.score, asymmetryH: d.H.score,
      compositeAI: r.score.composite, aiBucket: r.bucket,
      evidenceConfidence: r.score.confidenceScore, evidenceCompleteness: r.score.evidenceCompleteness,
      renterContext: { relevantOperators: r.operators.relevantOperatorCount, viableRenters: r.operators.viableOperatorCount, websiteAdoptionPct: r.operators.websiteAdoptionPct },
      localPackEvidence: { mapPackSize: r.signals.mapPackSize, avgReviews: r.signals.avgMapReviews, note: "market evidence only — excluded from organic scoring" },
      contentBarWords: r.signals.competitorAvgWords, competitorDomainAgeYears: r.signals.competitorAvgDomainAgeYears,
      contentDirective: "SERP-derived, not a fixed word count: this is a commercial service query, so the deployment engine should build a commercial service/location experience benchmarked against the observed content bar, not a long informational article.",
      geographyVerified: true, geographyVerdict: g?.verdict ?? "verified",
      reasonIncluded: `Meets the full pre-stated standard: ${r.vol}/mo measured demand, F=${d.F.score} (rentable, ~$${Math.round(r.ticket * r.margin * 0.1)}/lead), organic-v1.1 ${o!.score}, geography ${g?.verdict ?? "verified"}.`,
      hypothesis: `An asset with real economics AND a beatable organic SERP should rank and rent. A=${d.A.score} vs organic=${o!.score}; where they disagree this asset also contributes model-validation evidence.`,
      successCondition: "top-10 organic for the primary query within 6 months AND >=1 inbound lead within 9 months.",
      failureCondition: "no top-20 within 6 months, OR top-10 with zero leads after 3 further months (which falsifies demand, not rankability).",
      wasInPrior28: prior28.has(`${r.svcLabel}|${r.city}`),
      evidenceRefs: { experiment: r.exp, rawSerp: `out/${r.exp}/raw/serp-${r.id.replace(/[^a-z0-9]/gi, "_")}.json`, scoreModel: MODEL_VERSION, weights: WEIGHTS_DEFAULT.id, buckets: BUCKETS_VERSION },
    }));
  }
}

// ============ GROUP B — NTX POOL: MATCHED ARCHITECTURE EXPERIMENT ============
// 12 communities in 6 matched pairs. Within each pair one community is built as a
// STANDALONE hyperlocal site (S) and its match becomes a PAGE on ONE regional hub (H).
// Pairs are matched on organic-v1.1, virgin/incumbent status, and community scale.
// Neither architecture is assumed superior — that is the experiment.
const HUB_DOMAIN = "poolbuildersnorthtexas.com";      // verified available; NOT purchased
const PAIRS: { id: string; s: string; h: string; basis: string }[] = [
  { id: "NTX-P1", s: "Sutton Fields", h: "Legacy Gardens", basis: "both VIRGIN, active-buildout, organic 82 vs 79 (Δ3) — the two strongest virgin communities" },
  { id: "NTX-P2", s: "Sandbrock Ranch", h: "Star Trail", basis: "both VIRGIN, active-buildout, organic 66 vs 67 (Δ1) and 1,400 vs 1,300 homes — the tightest match in the experiment" },
  { id: "NTX-P3", s: "Painted Tree", h: "Stonebridge Ranch", basis: "both VIRGIN, both in McKinney (parent city and its SERP held constant), both large (3,400 vs 7,000 homes), organic 73 vs 63" },
  { id: "NTX-P4", s: "Mosaic", h: "Union Park", basis: "both INCUMBENT-TARGETED, active-buildout, organic 67 vs 73 (Δ6), 3,000 vs 2,000 homes" },
  { id: "NTX-P5", s: "Newman Village", h: "Harvest", basis: "both INCUMBENT-TARGETED, organic 65 vs 64 (Δ1) — the tightest incumbent match" },
  { id: "NTX-P6", s: "Cambridge Crossing", h: "Trinity Falls", basis: "both INCUMBENT-TARGETED, active-buildout, organic 57 vs 60 (Δ3)" },
];
const groupB: any[] = [];
let bN = 0;
for (const p of PAIRS) {
  for (const [role, name] of [["S", p.s], ["H", p.h]] as ["S" | "H", string][]) {
    const c = comms.find((x) => x.name === name && x.kind === "community");
    const o = commOrg(name);
    if (!c || !o) continue;
    const inc = incumbentOf(name);
    bN++;
    const standalone = role === "S";
    groupB.push(mk({
      experimentId: `W1-B${standalone ? "1" : "2"}-${String(bN).padStart(3, "0")}`,
      matchedPairId: p.id, matchedWith: standalone ? p.h : p.s, matchBasis: p.basis,
      cohort: standalone ? "B1-NTX-STANDALONE" : "B2-NTX-REGIONAL-HUB",
      treatment: standalone ? "TREATMENT-S-standalone-hyperlocal-domain" : "TREATMENT-H-page-on-regional-hub",
      assetType: standalone ? "standalone-site" : "hub-page",
      service: "Pool Builder", serviceSlug: "pool-builder", geography: name, state: "TX",
      geographyType: "master-planned-community", parentCity: c.city,
      communityHomes: c.meta?.homes ?? null, communityStatus: c.meta?.status ?? null,
      urlArchitecture: standalone ? `${c.preferredDomain ?? "(domain TBD)"} (root targets the community query)` : `${HUB_DOMAIN}/${kebab(name)}/`,
      hubDomain: standalone ? null : HUB_DOMAIN,
      measuredVolume: 0, volumeState: "provider-reports-zero — THE HYPOTHESIS UNDER TEST, not a validated demand figure",
      demandProven: false, demandLabel: "DEMAND-UNPROVEN EXPERIMENTAL ASSET",
      cpc: null, ticketAssumed: POOL.ticket, marginAssumed: POOL.margin, leadValueAssumedUsd: POOL.leadValue,
      dimensionA: null, dimensionANote: "A deliberately not applied: it is calibrated on city SERPs and its map-pack term is meaningless here — Google returns the parent city's pack for community queries.",
      organicV1: o.score, organicVerdict: o.verdict, organicVersion: o.version,
      organicTop5: o.slots.slice(0, 5).map((x) => `${x.position}. ${x.host} [${x.slotClass}]`),
      organicStructure: { distinctHostsTop5: o.distinctHostsTop5, displaceableTop5: o.displaceableTop5, hardLocalTop3: o.hardLocalTop3, geoTargetedCompetitorsTop5: o.geoTargetedCompetitorsTop5 },
      incumbentTargeting: inc ? "INCUMBENT — a competitor already runs a community-specific pool page" : "VIRGIN — no competitor holds a community-specific pool page",
      renterDepthE: null,
      renterContext: { viableRentersInCommunityPack: c.operators.viableOperatorCount, note: "24 distinct pool builders serve the 22-community cluster; Lonestar Pool & Spa Design appears in 12 of 22 packs. One renter could take several assets (upside) and that is buyer concentration (risk)." },
      localPackEvidence: { note: "map pack inherited from the parent city; Google renders no distinct community pack, so this asset must win ORGANIC" },
      contentBarWords: depth[name]?.words ?? null, competitorDomainAgeYears: depth[name]?.age ?? null,
      contentDirective: "Identical specification across BOTH treatments: same visual quality, conversion architecture, topical coverage, schema, publishing window, indexing workflow and tracking. Only the architecture differs.",
      domainCandidates: standalone ? Object.entries(c.domains ?? {}).map(([d, a]) => ({ domain: d, available: a })) : [{ domain: HUB_DOMAIN, available: true, note: "one shared hub domain for all six H assets" }],
      preferredDomain: standalone ? c.preferredDomain : HUB_DOMAIN,
      domainAvailable: standalone ? !!c.preferredDomain : true,
      evidenceConfidence: "community class — organic-v1.1 only; no measured demand by construction",
      geographyVerified: true, geographyVerdict: "community within verified metro (SERP localized to parent city)",
      reasonIncluded: `Matched-pair ${p.id} (${p.basis}). Assigned to ${standalone ? "STANDALONE" : "REGIONAL HUB"} so the architecture, not the community, is the variable.`,
      hypothesis: standalone
        ? `Keyword tools report zero volume for "pool builder ${name}", yet homeowners in a ${c.meta?.homes ?? "large"}-home affluent community may search by community name. A dedicated hyperlocal domain should maximise exact-match relevance. Paired against ${p.h} on the hub to isolate architecture.`
        : `Same demand hypothesis as its pair ${p.s}, but delivered as a page on a regional authority domain. Tests whether shared site-level authority and internal linking outrank a dedicated hyperlocal domain — or whether exact-match hyperlocal focus wins.`,
      successCondition: ">=100 impressions/month on community-modified queries within 6 months, OR >=1 qualified lead. Architecture comparison is judged on WITHIN-PAIR difference in time-to-first-impression, time-to-top-20 and impressions at 6 months.",
      failureCondition: "indexed but <20 impressions/month after 6 months across ALL community-modified queries while city controls perform in line with measured volume — falsifies hyper-local under-measurement. Architecture verdict is void if fewer than 4 of 6 pairs produce interpretable data.",
      wasInPrior28: prior28.has(`Pool Builder|${name}`),
      evidenceRefs: { rawSerp: `out/wave-1-experiment/raw/serp-pool_builder_${name.replace(/[^a-z0-9]/gi, "_")}_TX.json`, serviceSelection: "out/wave-1-experiment/nt-service-ranking.json", communityMeta: c.meta },
    }));
  }
}
// ---- B3 city controls: does keyword-tool volume predict real impressions? ----
let cN2 = 0;
for (const [city, vol] of [["Frisco", 320], ["McKinney", 210], ["Prosper", 10]] as [string, number][]) {
  const c = comms.find((x) => x.name === city && x.kind === "city-control");
  const o = commOrg(city, "city");
  if (!c || !o) continue;
  cN2++;
  groupB.push(mk({
    experimentId: `W1-B3-${String(cN2).padStart(3, "0")}`,
    cohort: "B3-CITY-CONTROL", treatment: "control-standalone-city-site", assetType: "standalone-site",
    matchedPairId: null, service: "Pool Builder", serviceSlug: "pool-builder", geography: city, state: "TX",
    geographyType: "city-control", urlArchitecture: `${c.preferredDomain ?? "(domain TBD)"} (root targets the city query)`,
    measuredVolume: vol, volumeState: "measured", demandProven: true, cpc: null,
    ticketAssumed: POOL.ticket, marginAssumed: POOL.margin, leadValueAssumedUsd: POOL.leadValue,
    dimensionA: null, organicV1: o.score, organicVerdict: o.verdict, organicVersion: o.version,
    organicTop5: o.slots.slice(0, 5).map((x) => `${x.position}. ${x.host} [${x.slotClass}]`),
    organicStructure: { distinctHostsTop5: o.distinctHostsTop5, displaceableTop5: o.displaceableTop5, hardLocalTop3: o.hardLocalTop3, geoTargetedCompetitorsTop5: o.geoTargetedCompetitorsTop5 },
    incumbentTargeting: `${o.geoTargetedCompetitorsTop5} of ${o.distinctHostsTop5} distinct top-5 hosts explicitly target ${city}`,
    renterContext: { relevantOperators: c.operators.relevantOperatorCount, viableRenters: c.operators.viableOperatorCount },
    localPackEvidence: { mapPackSize: c.signals.mapPackSize, avgReviews: c.signals.avgMapReviews, note: "market evidence only" },
    contentBarWords: null, competitorDomainAgeYears: null,
    contentDirective: "same specification as the community assets so the control is comparable",
    domainCandidates: Object.entries(c.domains ?? {}).map(([d, a]) => ({ domain: d, available: a })),
    preferredDomain: c.preferredDomain, domainAvailable: !!c.preferredDomain,
    evidenceConfidence: "control", geographyVerified: true, geographyVerdict: "verified",
    reasonIncluded: `City control at ${vol}/mo measured demand, anchoring the gradient Frisco 320 > McKinney 210 > Prosper 10 > community 0.`,
    hypothesis: "If impressions track measured volume across the gradient, keyword tools are accurate and the community bet fails. If Prosper and the community assets over-perform their measured volume, the tools systematically under-measure hyper-local demand.",
    successCondition: "n/a — control; judged only as a calibration reference for the community assets.",
    failureCondition: "n/a — control.",
    wasInPrior28: prior28.has(`Pool Builder|${city}`),
    evidenceRefs: { rawSerp: `out/wave-1-experiment/raw/serp-pool_builder_${city}_TX.json` },
  }));
}

// ===================== GROUP C — MODEL VALIDATION / CONTRARIAN =====================
const byId = new Map(scored.map((r) => [r.id, r]));
const C: [string, string, string, string, string][] = [
  ["metal-roofing|Rochester|MN", "MODEL DISAGREEMENT (largest, ~58 pts)",
   "Dimension A says 76 (credited for a weak map pack); organic-v1.1 says 18 — the organic top-5 is real roofers explicitly targeting Rochester. The single cleanest test of which rankability model predicts reality.",
   "Reaches top-10 within 6 months => organic-v1.1 wrongly discounts map-pack evidence and Dimension A should stand.",
   "Never reaches top-20 => A's map-pack credit is confirmed spurious and A must be rebuilt around organic structure as A-2.0.0."],
  ["basement-waterproofing|Naperville|IL", "MODEL DISAGREEMENT (second, ~49 pts)",
   "A=77 vs organic-v1.1 28. An independent replicate of the Rochester test with a different service and market — two replicates make the conclusion robust rather than anecdotal.",
   "Ranks top-10 => A's map-pack term carries real signal.",
   "Fails to reach top-20 => confirms Rochester; the pair together justify replacing A."],
  ["bathroom-remodel|Bellevue|NE", "A HIGH / ORGANIC MODERATE + SHARED-NAME DEMAND",
   "Highest composite in the dataset (85, A=92) but organic-v1.1 only 58, and its 2,400/mo is shared with Bellevue WA. SERP verified local to NE. Tests both the model gap and whether shared-name volume is capturable.",
   "Meaningful local impressions => shared-name markets are investable and should stop being discounted.",
   "Negligible impressions => shared-name volume must be excluded from scoring entirely."],
  ["house-cleaning|Orlando|FL", "WEAK ECONOMICS / HIGH DEMAND",
   "2,900/mo, A=74, organic 30, but F=34 (~$10 gross profit per lead). Tests the buckets-1.1.0 rentability floor: can volume compensate for thin per-lead value?",
   "Achieves >=$300/mo rent => the rentability floor is too strict and is discarding viable assets.",
   "Ranks but cannot be rented => the floor is validated and should perhaps rise."],
  ["kitchen-remodel|Rockville|MD", "STRONG RENTER DEPTH / HARD SERP",
   "E=100 — the strongest renter market found — against A=45 and organic 22. Tests whether renter depth can carry an asset through a hostile SERP.",
   "Ranks and rents => renter depth deserves more weight relative to rankability.",
   "Never ranks => E is worthless without rankability and should become a tie-breaker only."],
  ["appliance-repair|Aurora|IL", "V0 vs V2 THESIS / WEAK ECONOMICS",
   "V0 favoured commodity high-volume services; V2 bucketed only 1 of 16. 1,300/mo, A=67, organic 39, F=34.",
   "Ranks and rents easily => V2's pessimism about commodity services is wrong and the family should be re-opened.",
   "Fails => the fragmented-local family stays suppressed and we stop spending research on it."],
];
const groupC: any[] = [];
for (const [id, kind, hyp, succ, fail] of C) {
  const r = byId.get(id); if (!r) continue;
  const o = cityOrg(r), g = geo.get(id), d = r.score.dims;
  groupC.push(mk({
    experimentId: `W1-C-${String(groupC.length + 1).padStart(3, "0")}`,
    cohort: "C-MODEL-VALIDATION", treatment: "standalone-city-site", assetType: "standalone-site",
    classification: "EXPERIMENTAL — not investment-grade", contrarianType: kind,
    service: r.svcLabel, serviceSlug: r.svc, geography: r.city, state: r.state, geographyType: "city",
    urlArchitecture: "root domain targets the city+service query directly",
    measuredVolume: r.vol, volumeState: g?.verdict === "serp-local-volume-upper-bound" ? "measured-upper-bound-shared-city-name" : "measured",
    demandProven: true, cpc: r.cpc, ticketAssumed: r.ticket, marginAssumed: r.margin,
    leadValueAssumedUsd: Math.round(r.ticket * r.margin * 0.10),
    dimensionA: d.A.score, dimensionAVersion: d.A.version,
    organicV1: o?.score ?? null, organicVerdict: o?.verdict ?? null, organicVersion: o?.version ?? null,
    organicTop5: o ? o.slots.slice(0, 5).map((x) => `${x.position}. ${x.host} [${x.slotClass}]`) : [],
    organicStructure: o ? { distinctHostsTop5: o.distinctHostsTop5, displaceableTop5: o.displaceableTop5, hardLocalTop3: o.hardLocalTop3, geoTargetedCompetitorsTop5: o.geoTargetedCompetitorsTop5 } : null,
    modelDisagreement: (d.A.score ?? 0) - (o?.score ?? 0),
    incumbentTargeting: o ? `${o.geoTargetedCompetitorsTop5} of ${o.distinctHostsTop5} distinct top-5 hosts explicitly target ${r.city}` : null,
    renterDepthE: d.E.score, leadEconomicsD: d.D.score, assetValueF: d.F.score, asymmetryH: d.H.score,
    compositeAI: r.score.composite, aiBucket: r.bucket,
    evidenceConfidence: r.score.confidenceScore, evidenceCompleteness: r.score.evidenceCompleteness,
    renterContext: { relevantOperators: r.operators.relevantOperatorCount, viableRenters: r.operators.viableOperatorCount },
    localPackEvidence: { mapPackSize: r.signals.mapPackSize, avgReviews: r.signals.avgMapReviews, note: "market evidence only" },
    contentBarWords: r.signals.competitorAvgWords, competitorDomainAgeYears: r.signals.competitorAvgDomainAgeYears,
    contentDirective: "SERP-derived commercial service page; identical build standard to Group A so the comparison is not confounded by build quality.",
    geographyVerified: true, geographyVerdict: g?.verdict ?? "verified",
    reasonIncluded: `Selected to test a specific way the models may be WRONG. ${kind}. NOT presented as an investment-grade asset.`,
    hypothesis: hyp, successCondition: succ, failureCondition: fail,
    wasInPrior28: prior28.has(`${r.svcLabel}|${r.city}`),
    evidenceRefs: { experiment: r.exp, rawSerp: `out/${r.exp}/raw/serp-${id.replace(/[^a-z0-9]/gi, "_")}.json`, scoreModel: MODEL_VERSION },
  }));
}

// ---------- domains for A and C ----------
for (const a of [...groupA, ...groupC]) {
  a.domainCandidates = await domains(a.service, a.geography, a.state);
  a.preferredDomain = a.domainCandidates.find((d: any) => d.available === true)?.domain ?? null;
  a.domainAvailable = !!a.preferredDomain;
  if (a.preferredDomain) a.urlArchitecture = `${a.preferredDomain} (root targets the city+service query)`;
}

const all = [...groupA, ...groupB, ...groupC];

// ---------- FINAL LIVE RE-VERIFICATION of every domain we would actually buy ----------
// Availability decays; the purchase list must reflect a check made at freeze time.
const purchaseSet = new Map<string, any>();
for (const a of all) {
  if (!a.preferredDomain) continue;
  if (a.assetType === "hub-page") { purchaseSet.set(HUB_DOMAIN, { domain: HUB_DOMAIN, role: "regional hub (shared by 6 community pages)", forAssets: [] }); continue; }
  purchaseSet.set(a.preferredDomain, { domain: a.preferredDomain, role: `${a.cohort} — ${a.service} ${a.geography}`, forAssets: [a.experimentId] });
}
for (const [d, rec] of purchaseSet) {
  rec.availableAtFreeze = await rdap(d);
  rec.approxFirstYearUsd = 12.18;
}
for (const a of all) {
  const d = a.assetType === "hub-page" ? HUB_DOMAIN : a.preferredDomain;
  a.domainVerifiedAtFreeze = d ? purchaseSet.get(d)?.availableAtFreeze ?? null : null;
  a.domainAvailable = a.domainVerifiedAtFreeze === true;
}
const unavailable = [...purchaseSet.values()].filter((r) => r.availableAtFreeze !== true);
const sites = new Set(all.filter((a) => a.assetType === "standalone-site").map((a) => a.experimentId));
const websites = sites.size + 1;                       // + the single shared regional hub
const rankablePages = all.length;                      // every asset is one rankable target
const COST = { known: { domainFirstYear: 12.18, domainRenewal: 15.18 }, estimated: { hosting: 1.0, content: 8.0, deploy: 5.0, monitoring: 0.5 },
  unknown: ["deployment engine per-asset cost (engine not built)", "renter acquisition cost/time", "link/citation acquisition", "content revision cycles", "pool content is photo-heavy and likely exceeds the generic content estimate"] };
const domainCount = websites;                          // hub pages share one domain
const upfront = domainCount * COST.known.domainFirstYear + rankablePages * (COST.estimated.content + COST.estimated.deploy);
const monthly = websites * COST.estimated.hosting + rankablePages * COST.estimated.monitoring;

writeFileSync(new URL("portfolio-v2.json", OUT), JSON.stringify({
  generatedAt: new Date(1786000000000).toISOString(), version: "wave1-v3-matched-architecture",
  design: "Four questions: (1) find rentable assets, (2) validate organic-v1.1 vs Dimension A, (3) test zero-volume community demand, (4) test STANDALONE hyperlocal vs REGIONAL HUB architecture on matched pairs.",
  models: { dimensionA: MODEL_VERSION, organic: "organic-v1.1", weights: WEIGHTS_DEFAULT.id, buckets: BUCKETS_VERSION,
    note: "Both rankability models are carried separately on every asset. Neither is overwritten and neither is assumed correct; Wave 1 is the arbiter." },
  selectionStandards: { groupA: `measured demand >= ${A_MIN_VOL}/mo AND F >= ${A_MIN_F} AND organic-v1.2 >= ${A_MIN_ORG} AND viable renters >= ${A_MIN_VIABLE_RENTERS} AND geography verified; max 3/service, 2/city`,
    groupB: "community assets are NOT gated on measured volume (that is the hypothesis); admitted on community scale, buildout, affluence, organic-v1.1 and domain availability; matched into pairs then split across architectures",
    groupC: "selected for information value, explicitly labelled EXPERIMENTAL and never counted as investment-grade" },
  totals: { rankablePages, websites, domainsRequired: domainCount,
    groupA: groupA.length, groupB1_standalone: groupB.filter((a) => a.cohort === "B1-NTX-STANDALONE").length,
    groupB2_hub: groupB.filter((a) => a.cohort === "B2-NTX-REGIONAL-HUB").length,
    groupB3_controls: groupB.filter((a) => a.cohort === "B3-CITY-CONTROL").length, groupC: groupC.length },
  hubDomain: HUB_DOMAIN, matchedPairs: PAIRS,
  economics: { domainCost: +(domainCount * COST.known.domainFirstYear).toFixed(2), upfrontCapital: +upfront.toFixed(2),
    monthlyCarrying: +monthly.toFixed(2), sixMonthExperimentCost: +(upfront + monthly * 6).toFixed(2),
    twelveMonthRiskCapital: +(upfront + monthly * 12 + domainCount * COST.known.domainRenewal).toFixed(2), costBasis: COST },
  preRegistration: PREREG, measurementFields: MEASUREMENT, rankingTrajectory: RANKING_TRAJECTORY,
  frozen: { isFrozen: true, frozenAt: "2026-08-12", baseline: "WAVE-1-FROZEN-BASELINE",
    note: "Scores, selections, endpoints and analyses are FROZEN as of this build. Live outcomes are compared against these values; nothing here may be edited retrospectively. Any change requires a new version.",
    modelVersionsAtFreeze: { dimensionA: MODEL_VERSION, organic: "organic-v1.2", weights: WEIGHTS_DEFAULT.id, buckets: BUCKETS_VERSION } },
  purchaseList: [...purchaseSet.values()],
  assets: all,
}, null, 1));

const f = (a: any) => `${a.experimentId} | ${String(a.organicV1 ?? "-").padStart(3)} ${(a.organicVerdict ?? "-").slice(0, 9).padEnd(9)} | A ${String(a.dimensionA ?? "-").padStart(3)} | F ${String(a.assetValueF ?? "-").padStart(3)} | ${String(a.measuredVolume).padStart(4)}/mo | ${a.service} — ${a.geography}, ${a.state}${a.wasInPrior28 ? "" : " [NEW]"}`;
console.log(`WAVE 1 v3: ${rankablePages} rankable assets across ${websites} websites (${domainCount} domains)`);
console.log(`A ${groupA.length} | B1 standalone ${groupB.filter((a) => a.cohort === "B1-NTX-STANDALONE").length} | B2 hub-pages ${groupB.filter((a) => a.cohort === "B2-NTX-REGIONAL-HUB").length} | B3 controls ${groupB.filter((a) => a.cohort === "B3-CITY-CONTROL").length} | C ${groupC.length}`);
console.log(`domains $${(domainCount * COST.known.domainFirstYear).toFixed(2)} | upfront $${upfront.toFixed(2)} | monthly $${monthly.toFixed(2)} | 6-month $${(upfront + monthly * 6).toFixed(2)}`);
console.log("\n--- A: BEST-EVIDENCE ---"); groupA.forEach((a) => console.log("  " + f(a)));
console.log("\n--- B: NTX MATCHED ARCHITECTURE ---");
for (const p of PAIRS) {
  const s = groupB.find((a) => a.matchedPairId === p.id && a.assetType === "standalone-site");
  const h = groupB.find((a) => a.matchedPairId === p.id && a.assetType === "hub-page");
  console.log(`  ${p.id}  S: ${String(s?.organicV1).padStart(3)} ${s?.geography.padEnd(20)} <-> H: ${String(h?.organicV1).padStart(3)} ${h?.geography}`);
}
console.log("  controls:"); groupB.filter((a) => a.cohort === "B3-CITY-CONTROL").forEach((a) => console.log("    " + f(a)));
console.log("\n--- C: MODEL VALIDATION ---"); groupC.forEach((a) => console.log("  " + f(a) + `  Δ(A-org)=${a.modelDisagreement}`));
console.log(`\n=== DOMAIN RE-VERIFICATION AT FREEZE (${purchaseSet.size} domains) ===`);
for (const r of [...purchaseSet.values()].sort((a, b) => a.domain.localeCompare(b.domain)))
  console.log(`  ${r.availableAtFreeze === true ? "AVAILABLE" : r.availableAtFreeze === false ? "TAKEN    " : "UNKNOWN  "} | ${r.domain.padEnd(36)} | ${r.role}`);
if (unavailable.length) console.log(`\n!! ${unavailable.length} domain(s) NOT confirmed available — portfolio change required`);
else console.log("\nall domains confirmed available at freeze");
const dropped = [...prior28].filter((k) => !all.some((a) => `${a.service}|${a.geography}` === k));
console.log(`\nREMOVED (${dropped.length}): ${dropped.join(" · ")}`);
console.log(`ADDED (${all.filter((a) => !a.wasInPrior28).length}): ${all.filter((a) => !a.wasInPrior28).map((a) => `${a.service}|${a.geography}`).join(" · ")}`);
