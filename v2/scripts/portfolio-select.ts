// PORTFOLIO SELECTION — merges Exp-2 + Exp-3, assigns tiers, sizes Wave 1 for
// information value, and emits AssetSpecifications per DEPLOYMENT_HANDOFF_CONTRACT.
// Pure computation over collected evidence. No provider calls, no cost.
// Selection NEVER relaxes a scoring gate: tiers are applied on top of bucketing.
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, readdirSync } from "fs";
import { BUCKETS_VERSION, WEIGHTS_DEFAULT } from "../lib/scoring/composite";
import { MODEL_VERSION } from "../lib/scoring/dimensions";

const ROOT = new URL("../../", import.meta.url);
const OUT = new URL("out/portfolio/", ROOT);
mkdirSync(new URL("asset-specs/", OUT), { recursive: true });

const load = (exp: string) =>
  (JSON.parse(readFileSync(new URL(`out/${exp}/stage4-scored.json`, ROOT), "utf8")) as any[])
    .map((r) => ({ ...r, experiment: exp }));
const all = [...load("experiment-2"), ...load("experiment-3")];

// ---------- demand ambiguity: same keyword, different city ----------
// "bathroom remodeling bellevue" is one query shared by Bellevue WA and Bellevue NE.
// The measured volume is the sum across all same-named cities and cannot be
// attributed to one market: it is an UPPER BOUND, not a measurement.
const cities = JSON.parse(readFileSync(new URL("data/cities-national.json", ROOT), "utf8"));
const nameCount = new Map<string, number>();
for (const c of cities) nameCount.set(c.city, (nameCount.get(c.city) ?? 0) + 1);
// Manual gazetteer stub: US city names known to be shared across states. Our
// 491-city universe cannot detect these (each appears once in it), so duplicate
// detection is incomplete by construction. A Census place-name gazetteer is the
// real fix and is recommended for Wave 2.
const NATIONALLY_SHARED_NAMES = new Set([
  "Rochester", "Aurora", "Madison", "Plano", "Chandler", "Knoxville", "Irvine",
  "Bellevue", "Springfield", "Columbus", "Arlington", "Kirkland", "Lancaster",
  "Temecula", "Naperville", "Franklin", "Georgetown", "Salem", "Richmond",
]);
const kwOf = (r: any) => `${r.kw} ${r.city}`.toLowerCase();
const kwGroups = new Map<string, any[]>();
for (const r of all) { const k = kwOf(r); if (!kwGroups.has(k)) kwGroups.set(k, []); kwGroups.get(k)!.push(r); }
for (const r of all) {
  const collidesInUniverse = (kwGroups.get(kwOf(r))!.length > 1) || (nameCount.get(r.city) ?? 0) > 1;
  const collidesNationally = NATIONALLY_SHARED_NAMES.has(r.city);
  r.demandAmbiguous = collidesInUniverse;                  // hard block: same keyword, two tested cities
  r.demandAttributionRisk = collidesInUniverse || collidesNationally;
  if (r.demandAttributionRisk)
    r.ambiguityNote = `city name "${r.city}" is shared with other US cities, so ${r.vol}/mo is an UPPER BOUND on locally attributable demand. SERP/operator evidence IS correctly local (SerpAPI was queried with location "${r.city}, ${r.state}"); only the volume figure is at risk.`;
}

// ---------- tiering ----------
const TIER1_MIN = 60;
const t1: any[] = [], t2: any[] = [], t3: any[] = [];
for (const r of all) {
  const c = r.score.composite ?? 0;
  if (!r.bucket) { r.tierReason = r.bucketWhy; t3.push(r); continue; }
  if (r.demandAmbiguous) {
    r.tierReason = `bucketed ${r.bucket} but demand attribution is ambiguous — ${r.ambiguityNote}`;
    t2.push(r); continue;
  }
  if (c >= TIER1_MIN) { r.tierReason = `${r.bucket}, composite ${c}, unambiguous demand, viable renter present`; t1.push(r); continue; }
  r.tierReason = `bucketed ${r.bucket} but composite ${c} is below the Tier-1 threshold of ${TIER1_MIN}`;
  t2.push(r);
}
const byComposite = (a: any, b: any) => (b.score.composite ?? 0) - (a.score.composite ?? 0);
t1.sort(byComposite); t2.sort(byComposite); t3.sort(byComposite);

// ---------- Wave 1: maximize information value per incremental cost ----------
// Every Wave-1 asset must either have attractive economics or test a stated
// hypothesis. Diversity is enforced so the live results can actually discriminate
// between the model's dimensions rather than confounding them.
const MAX_PER_SERVICE = 3;      // avoid a portfolio that only tests one service
const MAX_PER_CITY = 2;         // avoid confounding service effects with one city
const wave1: any[] = [];
const svcCount = new Map<string, number>(), cityCount = new Map<string, number>();
const take = (r: any, role: string, hypothesis: string) => {
  const s = svcCount.get(r.svc) ?? 0, c = cityCount.get(r.city) ?? 0;
  if (s >= MAX_PER_SERVICE || c >= MAX_PER_CITY) return false;
  svcCount.set(r.svc, s + 1); cityCount.set(r.city, c + 1);
  wave1.push({ ...r, waveRole: role, hypothesis });
  return true;
};

// 1. the investment core: highest-composite unambiguous Tier-1, spread across services
for (const r of t1) {
  if (wave1.length >= 14) break;   // leave room for deliberate experiments below
  take(r, "INVESTMENT", `A=${r.score.dims.A.score} predicts this SERP is winnable; F=${r.score.dims.F.score} predicts the lead flow is worth renting. Tests whether composite ${r.score.composite} converts to real rankings and revenue.`);
}
// 2. deliberate experiments that research alone cannot settle
const already = new Set(wave1.map((w) => w.id));
const pick = (pred: (r: any) => boolean, role: string, hyp: (r: any) => string, n = 1) => {
  let taken = 0;
  for (const r of [...t1, ...t2]) {
    if (taken >= n || already.has(r.id)) continue;
    if (!pred(r)) continue;
    if (take(r, role, hyp(r))) { already.add(r.id); taken++; }
  }
};
// A-prediction test: hardest SERP we would still deploy
pick((r) => (r.score.dims.A.score ?? 0) < 55, "EXPERIMENT",
  (r) => `Does A predict ranking speed? A=${r.score.dims.A.score} is the weakest rankability in the portfolio; strong economics justify the risk. If it ranks as fast as high-A assets, A is over-weighted.`, 2);
// D/F assumption test: high volume, thin per-lead economics
pick((r) => (r.score.dims.F.score ?? 0) <= 50 && (r.vol ?? 0) >= 800, "EXPERIMENT",
  (r) => `Do our HUMAN_ASSUMED ticket/close-rate values hold? ${r.vol}/mo of demand with F=${r.score.dims.F.score}. Measures real CPL and lead value where the model predicts thin economics.`, 2);
// large-metro contrast: does city size predict difficulty as Exp-2 suggested?
pick((r) => r.pop >= 200000, "EXPERIMENT",
  (r) => `Exp-2 found small markets more rankable (meanA 57 vs 47). This large market (pop ${r.pop}) tests whether metro size genuinely predicts ranking difficulty.`, 2);
// ambiguous-name test: can a shared-name market be won at all?
pick((r) => r.demandAmbiguous && (r.score.composite ?? 0) >= 70, "EXPERIMENT",
  (r) => `Shared-city-name market: ${r.ambiguityNote}. Tests whether localized SERPs let one city's asset capture a shared query — and how much of the volume is really local.`, 1);
// EMD test: exact-match domain available vs not
pick((r) => r.domainAvailable === true, "EXPERIMENT",
  (r) => `Does exact-match domain availability matter? ${r.domain} is registrable; paired against non-EMD assets to isolate the EMD effect on ranking speed.`, 2);

wave1.sort(byComposite);

// ---------- economics: known vs estimated vs unknown ----------
const COST = {
  known: { domainFirstYear: 12.18, domainRenewal: 15.18 },                 // .com list pricing
  estimated: { hostingPerMonth: 1.0, contentGeneration: 8.0, deploymentLabor: 5.0, monitoringPerMonth: 0.5 },
  unknown: ["deployment engine per-asset cost (engine not built)", "renter acquisition cost/time", "link acquisition if required to rank", "content revision cycles"],
};
const n = wave1.length;
const upfront = n * (COST.known.domainFirstYear + COST.estimated.contentGeneration + COST.estimated.deploymentLabor);
const monthly = n * (COST.estimated.hostingPerMonth + COST.estimated.monitoringPerMonth);
const econ = {
  assets: n, upfrontCapital: +upfront.toFixed(2), monthlyCarrying: +monthly.toFixed(2),
  sixMonthRiskCapital: +(upfront + monthly * 6).toFixed(2),
  twelveMonthRiskCapital: +(upfront + monthly * 12 + n * COST.known.domainRenewal).toFixed(2),
  perAssetUpfront: +(upfront / n).toFixed(2), costBasis: COST,
};

// geo-scoped universes, when collected (universe-geo-1.0.0)
const uniFile = new URL("wave1-universes.json", OUT);
const universes = new Map<string, any>();
if (existsSync(uniFile)) for (const u of JSON.parse(readFileSync(uniFile, "utf8")) as any[]) universes.set(u.id, u);

// ---------- AssetSpecifications (conforms to DEPLOYMENT_HANDOFF_CONTRACT) ----------
const SPEC_VERSION = "asset-spec-1.0.0";
const specs = wave1.map((r) => {
  const d = r.score.dims, g = r.signals, o = r.operators;
  const dim = (k: string) => ({ score: d[k].score, version: d[k].version, confidence: d[k].confidence, evidenceTypes: d[k].evidenceTypes, missing: d[k].missingMetrics });
  return {
    specVersion: SPEC_VERSION, generatedAt: new Date(1786000000000).toISOString(),
    assetId: r.id, opportunityId: r.id, experiment: r.experiment,
    identity: { service: r.svcLabel, serviceSlug: r.svc, category: r.cat, city: r.city, state: r.state, population: r.pop, medianIncome: r.income, stratum: r.stratum, opportunityType: "general" },
    domain: { recommended: r.domain, status: r.domainAvailable === true ? "available-at-research-time" : r.domainAvailable === false ? "taken" : "unknown", note: "availability decays; re-check before purchase. NOT purchased by RankRentOS." },
    keywordStrategy: { primaryKeyword: `${r.kw} ${r.city}`, exactLocalVolume: r.vol, volumeState: r.volState ?? "measured", cpc: r.cpc, demandAmbiguous: !!r.demandAmbiguous, demandAttributionRisk: !!r.demandAttributionRisk, ambiguityNote: r.ambiguityNote ?? null,
      geoScopedUniverse: (() => {
        const u = universes.get(r.id);
        if (!u) return { collected: false, note: "geo-scoped universe not collected for this asset" };
        return { collected: true, version: "universe-geo-1.0.0", attributableKeywords: u.attributable,
          attributableVolume: u.attributableVolume, complete: u.complete, unmeasuredMembers: u.unknown,
          nationalVolumeExcluded: u.leakageExcluded,
          supportingKeywords: u.top.map((t: any) => ({ keyword: t.keyword, volume: t.volume, cpc: t.cpc })) };
      })(), },
    serpContext: { mapPackSize: g.mapPackSize, mapPackAvgReviews: g.avgMapReviews, mapListingsWithoutWebsite: g.mapListingsWithoutWebsite,
      directoriesInTop3: g.directoriesInTop3, innerPagesInTop5: g.innerPagesInTop5, franchisesInTop3: g.franchisesInTop3,
      outOfTownInTop3: g.outOfTownInTop3, titlesMissingCity: g.top3TitlesMissingCity, adCount: g.adCount,
      contentDepthBarWords: g.competitorAvgWords, competitorAvgDomainAgeYears: g.competitorAvgDomainAgeYears,
      depthEvidence: r.depthEvidence ?? null },
    renterContext: { relevantOperators: o.relevantOperatorCount, viableRenters: o.viableOperatorCount, strongerOperators: o.strongerOperatorCount,
      medianReviews: o.medianReviews, websiteAdoptionPct: o.websiteAdoptionPct, advertisers: o.advertiserCount, concentration: o.concentration },
    economicsContext: { ticketAvg: r.ticket, margin: r.margin, evidenceType: "HUMAN_ASSUMED",
      warning: "ticket and margin are HUMAN_ASSUMED and drive D and F. Live outcomes must replace them." },
    scores: { modelVersion: MODEL_VERSION, weightSet: WEIGHTS_DEFAULT.id, bucketsVersion: BUCKETS_VERSION,
      composite: r.score.composite, confidence: r.score.confidenceScore, evidenceCompleteness: r.score.evidenceCompleteness,
      A: dim("A"), B: dim("B"), C: dim("C"), D: dim("D"), E: dim("E"), F: dim("F"), G: dim("G"), H: dim("H"), I: dim("I"),
      sensitivity: { byWeightSet: r.alt, bestRank: r.rankBest, worstRank: r.rankWorst, rankSpread: r.rankSpread },
      assumptionDependentDimensions: r.score.assumptionDependentDimensions, prospectiveDimensions: r.score.prospectiveDimensions },
    selection: { bucket: r.bucket, tier: "WAVE-1", role: r.waveRole, whySelected: r.tierReason, hypothesisUnderTest: r.hypothesis },
    expectationsBaseline: { predictedRankability: d.A.score, predictedTimeToSignalDays: d.G.score !== null ? Math.round(180 - (d.G.score * 1.4)) : null,
      predictedMonthlyRenterGrossProfit: Math.round((r.vol ?? 0) * 0.25 * 0.12 * (r.ticket * r.margin * 0.10)),
      note: "predictions are the falsifiable claims this deployment tests" },
    measurementRequirements: ["deployedAt", "indexedAt", "firstImpressionAt", "firstClickAt", "firstLeadAt", "firstRevenueAt",
      "dailyImpressions", "dailyClicks", "rankingsByKeyword", "leadsTotal", "leadsByChannel(call|form)", "qualifiedLeads",
      "renterOutreachCount", "renterResponses", "renterAcquiredAt", "monthlyRent", "revenue", "operatingCost"],
    provenance: { experiment: r.experiment, rawSerp: `out/${r.experiment}/raw/serp-${r.id.replace(/[^a-z0-9]/gi, "_")}.json`,
      demandSource: "dataforseo:google_ads/search_volume", serpSource: "serpapi", depthSource: "crawl+rdap:depth-v1", asOf: r.score.asOf },
  };
});
// Clear stale specs first: a spec left over from a previous selection would be
// handed to the deployment engine as if it were still approved.
const specDir = new URL("asset-specs/", OUT);
for (const f of readdirSync(specDir)) if (f.endsWith(".json")) rmSync(new URL(f, specDir));
for (const s of specs) writeFileSync(new URL(`asset-specs/${s.assetId.replace(/[^a-z0-9]/gi, "_")}.json`, OUT), JSON.stringify(s, null, 1));

writeFileSync(new URL("portfolio.json", OUT), JSON.stringify({
  generatedAt: new Date(1786000000000).toISOString(), modelVersion: MODEL_VERSION, bucketsVersion: BUCKETS_VERSION,
  totals: { evaluated: all.length, tier1: t1.length, tier2: t2.length, tier3: t3.length, wave1: wave1.length },
  buckets: all.reduce((a: any, r) => { const k = r.bucket ?? "unbucketed"; a[k] = (a[k] || 0) + 1; return a; }, {}),
  economics: econ,
  tier1: t1.map((r) => ({ id: r.id, bucket: r.bucket, composite: r.score.composite, vol: r.vol, why: r.tierReason })),
  tier2: t2.map((r) => ({ id: r.id, bucket: r.bucket, composite: r.score.composite, vol: r.vol, why: r.tierReason })),
  tier3Count: t3.length,
  wave1: wave1.map((r) => ({ id: r.id, role: r.waveRole, bucket: r.bucket, composite: r.score.composite, hypothesis: r.hypothesis })),
}, null, 1));

// ---------- report surfaces ----------
const bk = all.reduce((a: any, r) => { const k = r.bucket ?? "unbucketed"; a[k] = (a[k] || 0) + 1; return a; }, {});
console.log(`evaluated ${all.length} researched candidates (Exp-2 + Exp-3)`);
console.log("buckets:", JSON.stringify(bk));
console.log(`TIER 1 deploy-ready: ${t1.length} | TIER 2 experimental: ${t2.length} | TIER 3 hold/reject: ${t3.length}`);
console.log(`\nWAVE 1 = ${wave1.length} assets`);
for (const r of wave1) {
  const d = r.score.dims;
  console.log(`  ${String(r.score.composite).padStart(3)} | ${(r.bucket ?? "-").padEnd(11)} | ${r.waveRole.padEnd(10)} | A${String(d.A.score).padStart(3)} F${String(d.F.score).padStart(3)} | ${String(r.vol).padStart(4)}/mo | ${r.svcLabel} — ${r.city}, ${r.state}${r.domainAvailable ? " [.com OPEN]" : ""}`);
}
console.log(`\nservices represented: ${new Set(wave1.map((r) => r.svcLabel)).size} | states: ${new Set(wave1.map((r) => r.state)).size} | buckets: ${JSON.stringify(wave1.reduce((a: any, r) => { a[r.bucket] = (a[r.bucket] || 0) + 1; return a; }, {}))}`);
console.log(`A range ${Math.min(...wave1.map((r) => r.score.dims.A.score))}-${Math.max(...wave1.map((r) => r.score.dims.A.score))} | F range ${Math.min(...wave1.map((r) => r.score.dims.F.score))}-${Math.max(...wave1.map((r) => r.score.dims.F.score))} | EMD available ${wave1.filter((r) => r.domainAvailable).length}`);
console.log(`\nECONOMICS: upfront $${econ.upfrontCapital} | monthly $${econ.monthlyCarrying} | 6-mo risk $${econ.sixMonthRiskCapital} | 12-mo risk $${econ.twelveMonthRiskCapital}`);
console.log(`asset specifications written: ${specs.length}`);
