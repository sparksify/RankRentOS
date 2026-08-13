// Rescore the FROZEN Wave-1 26 under decision-v2.0.0. The frozen baseline is read
// only — never written. Output is a new versioned comparison artifact.
import { readFileSync, writeFileSync } from "fs";
import {
  attributeDemand, assessCapturability, assessMonetization, assessSearchOpportunity, decide,
  DECISION_VERSION, CAPTURABILITY_VERSION, RENTABILITY_VERSION, DEMAND_ATTRIBUTION_VERSION,
} from "../lib/decision/model";

const ROOT = new URL("../../", import.meta.url);
const OUT = new URL("out/wave-1-experiment/", ROOT);
const frozen = JSON.parse(readFileSync(new URL("portfolio-v2.json", OUT), "utf8"));
const scored = [
  ...(JSON.parse(readFileSync(new URL("out/experiment-2/stage4-scored.json", ROOT), "utf8")) as any[]),
  ...(JSON.parse(readFileSync(new URL("out/experiment-3/stage4-scored.json", ROOT), "utf8")) as any[]),
];
// state-qualified key: "service|city" alone collides for shared city names — the very
// defect under audit.
const byKey = new Map(scored.map((r: any) => [`${r.svcLabel}|${r.city}|${r.state}`, r]));
const comms = JSON.parse(readFileSync(new URL("nt-community-serp.json", OUT), "utf8")) as any[];

const SHARED_NAMES = new Set(["Rochester", "Aurora", "Madison", "Plano", "Chandler", "Knoxville",
  "Irvine", "Bellevue", "Kirkland", "Roseville", "Rockville", "Lancaster", "Springfield",
  "Columbus", "Arlington", "Franklin", "Georgetown", "Salem", "Richmond"]);

// Pre-registered hypotheses from the FROZEN baseline — not invented here.
const hypothesisFor = (a: any): { id: string; role: string } | null => {
  if (a.cohort === "C-MODEL-VALIDATION") return { id: "H1", role: `model validation: ${a.contrarianType ?? "A vs organic disagreement"}` };
  if (a.cohort === "B1-NTX-STANDALONE") return { id: "H2+H3", role: "community demand test + standalone arm of the architecture experiment" };
  if (a.cohort === "B2-NTX-REGIONAL-HUB") return { id: "H2+H3", role: "community demand test + hub arm of the architecture experiment" };
  if (a.cohort === "B3-CITY-CONTROL") return { id: "H2", role: "city control anchoring the demand gradient" };
  return null;
};

const rows = frozen.assets.map((a: any) => {
  const isCommunity = a.geographyType === "master-planned-community";
  const isControl = a.geographyType === "city-control";
  const r: any = byKey.get(`${a.service}|${a.geography}|${a.state}`) ?? null;

  // ---- renter evidence (inherit parent-city pack for communities with no pack) ----
  let viableRenters = a.renterContext?.viableRenters ?? a.renterContext?.viableRentersInCommunityPack ?? null;
  let renterEvidenceAvailable = (a.localPackEvidence?.mapPackSize ?? r?.signals?.mapPackSize ?? 0) > 0;
  if (isCommunity || isControl) {
    const own = comms.find((c) => c.name === a.geography);
    if (own && own.signals.mapPackSize > 0) { viableRenters = own.operators.viableOperatorCount; renterEvidenceAvailable = true; }
    else {
      const parent = comms.find((c) => c.name === a.parentCity && c.kind === "city-control");
      if (parent) { viableRenters = parent.operators.viableOperatorCount; renterEvidenceAvailable = true; }
    }
  }

  const attribution = attributeDemand({
    measuredVolume: isCommunity ? null : (a.measuredVolume ?? null),   // community volume is the hypothesis, not a measurement
    sharedCityName: SHARED_NAMES.has(a.geography),
    geoScopedUniverseVolume: null,      // none was ever collected for these markets
    serpLocalized: a.geographyVerified !== false,
    cityName: a.geography,
  });

  const capturability = assessCapturability({
    architecture: "ORGANIC_ONLY",
    organicScore: a.organicV1 ?? null,
    mapPackAvgReviews: a.localPackEvidence?.avgReviews ?? null,
    mapPackSize: a.localPackEvidence?.mapPackSize ?? null,
  });

  const monetization = assessMonetization({
    serviceSlug: a.serviceSlug,
    attributableDemand: attribution.attributableDemand,
    ticketAssumed: a.ticketAssumed ?? null, marginAssumed: a.marginAssumed ?? null,
    viableRenters, renterEvidenceAvailable, assetValueF: a.assetValueF ?? null,
  });

  const searchOpportunity = assessSearchOpportunity({
    attribution, commercialIntentScore: r?.score?.dims?.C?.score ?? null,
    dimensionA: a.dimensionA ?? null, isExperimentalDemandClass: isCommunity,
  });

  const h = hypothesisFor(a);
  const d = decide({ searchOpportunity, capturability, monetization, attribution,
    renterEvidenceAvailable, viableRenters,
    preRegisteredHypothesis: h?.id ?? null, experimentRole: h?.role ?? null });

  return {
    experimentId: a.experimentId, cohort: a.cohort, assetType: a.assetType,
    service: a.service, serviceSlug: a.serviceSlug, geography: a.geography, state: a.state,
    isHubPage: a.assetType === "hub-page", hubDomain: a.hubDomain ?? null, preferredDomain: a.preferredDomain,
    old: { composite: a.compositeAI ?? r?.score?.composite ?? null, A: a.dimensionA ?? null, O: a.organicV1 ?? null,
      bucket: a.aiBucket ?? null, measuredVolume: a.measuredVolume ?? null, volumeState: a.volumeState ?? null,
      F: a.assetValueF ?? null, E: a.renterDepthE ?? null },
    new: {
      searchOpportunity: searchOpportunity.score, searchOpportunityGate: searchOpportunity.gate,
      capturability: capturability.score, capturabilityGate: capturability.gate,
      monetizationQuality: monetization.score, monetizationGate: monetization.gate,
      demandState: attribution.demandState, attributableDemand: attribution.attributableDemand,
      demandCeiling: attribution.ceiling, viableRenters,
      gates: d.gates, decision: d.decision, confidence: Math.round(d.confidence * 100) / 100,
      recommendedMonetizationModel: monetization.recommendedModel,
      leadValueUsd: monetization.leadValueUsd, expectedLeadsPerMonth: monetization.expectedLeadsPerMonth,
    },
    decisionChanged: true, reasons: d.reasons, experimentJustification: d.experimentJustification,
    explanations: { demand: searchOpportunity.explanation, capturability: capturability.explanation, monetization: monetization.explanation },
    humanAssumed: monetization.assumedInputs, verticalProfileBasis: monetization.profile.basis,
  };
});

// websites vs pages: the six B2 assets are PAGES on one hub, not six websites
const sites = new Set(rows.filter((r: any) => !r.isHubPage).map((r: any) => r.preferredDomain));
const hubUsed = rows.some((r: any) => r.isHubPage);
const byDecision = (d: string) => rows.filter((r: any) => r.new.decision === d);

const out = {
  version: DECISION_VERSION, generatedAt: "2026-08-12",
  models: { decision: DECISION_VERSION, capturability: CAPTURABILITY_VERSION, rentability: RENTABILITY_VERSION, demandAttribution: DEMAND_ATTRIBUTION_VERSION,
    frozenAndUnchanged: { dimensionA: "ai-v1.0.0", organic: "organic-v1.2", weights: "w-balanced-v1.1", buckets: "buckets-1.1.0", baseline: "WAVE-1-FROZEN-BASELINE" } },
  note: "The frozen Wave-1 baseline is read-only and unmodified. This is a parallel decision layer for comparison against live outcomes.",
  counts: { assets: rows.length, websites: sites.size + (hubUsed ? 1 : 0),
    REVENUE_CANDIDATE: byDecision("REVENUE_CANDIDATE").length, EXPERIMENTAL: byDecision("EXPERIMENTAL").length,
    HOLD: byDecision("HOLD").length, REJECT: byDecision("REJECT").length },
  assets: rows,
};
writeFileSync(new URL("decision-v2-comparison.json", OUT), JSON.stringify(out, null, 1));

console.log(`DECISION MODEL ${DECISION_VERSION} — rescoring the frozen ${rows.length} assets\n`);
console.log(`REVENUE_CANDIDATE ${out.counts.REVENUE_CANDIDATE} | EXPERIMENTAL ${out.counts.EXPERIMENTAL} | HOLD ${out.counts.HOLD} | REJECT ${out.counts.REJECT}`);
console.log(`websites: ${out.counts.websites} (the 6 B2 assets are PAGES on one regional hub, not 6 sites)\n`);
const fmt = (r: any) => `${String(r.old.composite ?? "—").padStart(3)} | A${String(r.old.A ?? "—").padStart(3)} O${String(r.old.O ?? "—").padStart(3)} | SO ${String(r.new.searchOpportunity ?? "—").padStart(3)}/${r.new.gates.demand.padEnd(7)} CAP ${String(r.new.capturability ?? "—").padStart(3)}/${r.new.gates.capturability.padEnd(7)} MON ${String(r.new.monetizationQuality ?? "—").padStart(3)}/${r.new.gates.economics.padEnd(7)} RENT ${r.new.gates.renterDepth.padEnd(7)} | ${r.service} — ${r.geography}, ${r.state}`;
for (const dec of ["REVENUE_CANDIDATE", "EXPERIMENTAL", "HOLD", "REJECT"]) {
  const g = byDecision(dec); if (!g.length) continue;
  console.log(`\n=== ${dec} (${g.length}) ===`);
  g.forEach((r: any) => console.log("  " + fmt(r)));
}
console.log("\n=== demand attribution states ===");
const st: any = {}; rows.forEach((r: any) => { st[r.new.demandState] = (st[r.new.demandState] || 0) + 1; });
console.log(JSON.stringify(st, null, 1));
