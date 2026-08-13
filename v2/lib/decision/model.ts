// DECISION MODEL v2 (decision-v2.0.0)
//
// Separates three questions the single A–I composite was being asked to answer at once:
//   1. SEARCH OPPORTUNITY  — is there real, attributable demand and exploitable weakness?
//   2. CAPTURABILITY       — can the architecture WE deploy actually take that traffic?
//   3. MONETIZATION QUALITY— if we take it, does it become durable economic value?
//
// Nothing here modifies ai-v1.0.0, organic-v1.2, w-balanced-v1.1 or buckets-1.1.0.
// Those remain frozen and their historical outputs are unchanged; this layer consumes
// them. Dimension A is RETAINED as a general SERP diagnostic — the audit showed it is
// not primarily a map-pack artifact — but it is no longer a capturability gate for
// organic-only assets. Organic-v1.2 is.
import { ORGANIC_VERSION } from "../serp/organic";

export const DECISION_VERSION = "decision-v2.0.0";
export const CAPTURABILITY_VERSION = "capturability-v1.0.0";
export const RENTABILITY_VERSION = "rentability-v1.0.0";
export const DEMAND_ATTRIBUTION_VERSION = "demand-attribution-v1.0.0";

export type Gate = "PASS" | "FAIL" | "UNKNOWN";
export type Decision = "REVENUE_CANDIDATE" | "EXPERIMENTAL" | "HOLD" | "REJECT";

// =====================================================================
// 1. DEMAND ATTRIBUTION — UNKNOWN ≠ ZERO ≠ MEASURED ≠ UPPER BOUND
// =====================================================================
export type DemandState =
  | "MEASURED_LOCAL"        // measured AND attributable to this market
  | "MEASURED_UPPER_BOUND"  // measured, but the query is shared with same-named places
  | "AMBIGUOUS_GEO"         // measured, and attribution cannot be established at all
  | "UNKNOWN"               // never measured
  | "ZERO_MEASURED";        // measured and genuinely zero

export interface DemandAttribution {
  version: string;
  demandValue: number | null;        // raw provider measurement, or null if unmeasured
  attributableDemand: number | null; // what we may treat as LOCAL demand — null when unattributable
  ceiling: number | null;            // upper bound when attribution fails
  demandState: DemandState;
  demandConfidence: number;
  demandEvidence: string[];
}

/**
 * Attribution is deterministic and evidence-based. Critically: for a shared city name
 * we do NOT invent a discount factor (population share is not evidence of search
 * share). Attributable demand becomes null with the measurement retained as a ceiling.
 */
export function attributeDemand(input: {
  measuredVolume: number | null;
  sharedCityName: boolean;
  geoScopedUniverseVolume: number | null;   // a valid geo-scoped universe RESOLVES ambiguity
  serpLocalized: boolean;
  cityName: string;
}): DemandAttribution {
  const ev: string[] = [];
  const v = input.measuredVolume;

  if (v === null || v === undefined) {
    return { version: DEMAND_ATTRIBUTION_VERSION, demandValue: null, attributableDemand: null, ceiling: null,
      demandState: "UNKNOWN", demandConfidence: 0,
      demandEvidence: ["no provider measurement exists for this query — UNKNOWN, which is not zero"] };
  }
  if (v === 0) {
    ev.push("provider returned an explicit zero for this exact term");
    return { version: DEMAND_ATTRIBUTION_VERSION, demandValue: 0, attributableDemand: 0, ceiling: 0,
      demandState: "ZERO_MEASURED", demandConfidence: 0.8, demandEvidence: ev };
  }
  if (!input.sharedCityName) {
    ev.push(`${v}/mo measured for the exact term; "${input.cityName}" is not shared with other notable US cities`);
    if (input.serpLocalized) ev.push("SERP map-pack addresses confirm the market is local");
    return { version: DEMAND_ATTRIBUTION_VERSION, demandValue: v, attributableDemand: v, ceiling: v,
      demandState: "MEASURED_LOCAL", demandConfidence: input.serpLocalized ? 0.85 : 0.7, demandEvidence: ev };
  }
  // Shared name. A valid geo-scoped universe would resolve it; otherwise we cannot
  // attribute, and we refuse to guess a split.
  if (typeof input.geoScopedUniverseVolume === "number") {
    ev.push(`shared city name, but a geo-scoped keyword universe attributes ${input.geoScopedUniverseVolume}/mo to this market`);
    return { version: DEMAND_ATTRIBUTION_VERSION, demandValue: v, attributableDemand: input.geoScopedUniverseVolume, ceiling: v,
      demandState: "MEASURED_LOCAL", demandConfidence: 0.75, demandEvidence: ev };
  }
  ev.push(`"${input.cityName}" is shared with other notable US cities, so the ${v}/mo measurement aggregates every same-named market`);
  ev.push("no geo-scoped keyword universe exists to attribute a share to this market");
  ev.push("population share is NOT evidence of search share, so no discount factor is applied");
  if (input.serpLocalized) ev.push("the SERP itself IS localized, so competitive evidence (capturability) remains valid — only the demand figure is unattributable");
  return { version: DEMAND_ATTRIBUTION_VERSION, demandValue: v, attributableDemand: null, ceiling: v,
    demandState: "MEASURED_UPPER_BOUND", demandConfidence: 0.35, demandEvidence: ev };
}

// =====================================================================
// 2. CAPTURABILITY — architecture-specific
// =====================================================================
export type Architecture = "ORGANIC_ONLY" | "GBP_CAPABLE";

export interface Capturability {
  version: string; architecture: Architecture;
  score: number | null; gate: Gate; confidence: number;
  usedSignals: string[]; excludedSignals: string[]; explanation: string;
}

// Thresholds are NOT invented here. 55 is the Wave-1 v3 Group-A organic standard
// (pre-registered before this audit); 45 is the organic-v1.2 CONTESTED/BRUTAL band
// boundary. Both pre-date this model.
export const CAPTURABILITY_PASS = 55;
export const CAPTURABILITY_FAIL_BELOW = 45;

export function assessCapturability(input: {
  architecture: Architecture;
  organicScore: number | null;          // organic-v1.2
  mapPackAvgReviews: number | null;     // consumed ONLY by GBP_CAPABLE
  mapPackSize: number | null;
}): Capturability {
  const { architecture, organicScore } = input;
  if (organicScore === null) {
    return { version: CAPTURABILITY_VERSION, architecture, score: null, gate: "UNKNOWN", confidence: 0,
      usedSignals: [], excludedSignals: [], explanation: "No organic SERP evidence — capturability cannot be assessed." };
  }
  if (architecture === "ORGANIC_ONLY") {
    const gate: Gate = organicScore >= CAPTURABILITY_PASS ? "PASS" : organicScore < CAPTURABILITY_FAIL_BELOW ? "FAIL" : "UNKNOWN";
    return {
      version: CAPTURABILITY_VERSION, architecture, score: organicScore, gate, confidence: 0.6,
      usedSignals: [`organic-only rankability (${ORGANIC_VERSION})`],
      excludedSignals: ["map-pack size", "map-pack review strength", "map listings without websites"],
      explanation: gate === "PASS"
        ? `Organic capturability ${organicScore} clears the ${CAPTURABILITY_PASS} bar. Map-pack conditions are excluded: without a Google Business Profile we cannot rank in a pack, so its weakness is not ours to capture.`
        : gate === "FAIL"
          ? `Organic capturability ${organicScore} is below the ${CAPTURABILITY_FAIL_BELOW} floor — the organic results are effectively uncapturable for an organic-only site, regardless of how weak the map pack is.`
          : `Organic capturability ${organicScore} sits between the ${CAPTURABILITY_FAIL_BELOW} floor and the ${CAPTURABILITY_PASS} bar — winnable but slow and uncertain.`,
    };
  }
  // GBP_CAPABLE is defined but NOT used by any Wave-1 asset. It exists so a future
  // architecture can legitimately consume local-pack evidence without retroactively
  // changing organic-only behaviour.
  const packBonus = input.mapPackAvgReviews !== null && input.mapPackAvgReviews < 25 ? 15
    : input.mapPackAvgReviews !== null && input.mapPackAvgReviews < 60 ? 8 : 0;
  const score = Math.min(100, organicScore + packBonus);
  return { version: CAPTURABILITY_VERSION, architecture, score,
    gate: score >= CAPTURABILITY_PASS ? "PASS" : score < CAPTURABILITY_FAIL_BELOW ? "FAIL" : "UNKNOWN", confidence: 0.5,
    usedSignals: [`organic-only rankability (${ORGANIC_VERSION})`, "map-pack review strength (legitimate for a GBP-capable asset)"],
    excludedSignals: [], explanation: `GBP-capable architecture: organic ${organicScore} plus ${packBonus} of local-pack opportunity.` };
}

// =====================================================================
// 3. MONETIZATION QUALITY (rentability-v1.0.0)
// Every input below is HUMAN_ASSUMED and labelled as such. None is model-generated;
// none comes from an LLM. Each is a documented hypothesis to be replaced by OBSERVED
// outcome data from Wave 1.
// =====================================================================
export interface VerticalProfile {
  salesCycleDays: number;        // enquiry -> signed job
  attributionClarity: number;    // 0-1: can the renter SEE the lead came from us?
  closeRate: number;             // enquiry -> job
  urgency: number;               // 0-1: distress/immediacy of the need
  seasonalitySwing: number;      // 0-1: 0 = flat year-round, 1 = extreme
  operatorSophistication: number;// 0-1: will the operator understand and pay for leads?
  monetizationModels: ("flat-rent" | "per-lead" | "per-qualified-call" | "hybrid")[];
  basis: string;
}

/** HUMAN_ASSUMED vertical profiles. Reasoning is recorded in `basis` for every entry. */
export const VERTICAL_PROFILES: Record<string, VerticalProfile> = {
  "pool-builder": { salesCycleDays: 90, attributionClarity: 0.7, closeRate: 0.08, urgency: 0.2, seasonalitySwing: 0.7, operatorSophistication: 0.6,
    monetizationModels: ["per-lead", "hybrid"], basis: "HUMAN_ASSUMED: large considered purchase, long design/permit cycle, strong spring-summer peak; high ticket makes per-lead viable but long cycle makes flat rent hard to justify early." },
  "bathroom-remodel": { salesCycleDays: 45, attributionClarity: 0.65, closeRate: 0.1, urgency: 0.3, seasonalitySwing: 0.25, operatorSophistication: 0.55,
    monetizationModels: ["per-lead", "flat-rent", "hybrid"], basis: "HUMAN_ASSUMED: considered remodel purchase, moderate cycle, largely aseasonal." },
  "kitchen-remodel": { salesCycleDays: 60, attributionClarity: 0.65, closeRate: 0.08, urgency: 0.25, seasonalitySwing: 0.25, operatorSophistication: 0.55,
    monetizationModels: ["per-lead", "hybrid"], basis: "HUMAN_ASSUMED: larger and slower than bathroom; same attribution profile." },
  "window-replacement": { salesCycleDays: 30, attributionClarity: 0.7, closeRate: 0.12, urgency: 0.35, seasonalitySwing: 0.35, operatorSophistication: 0.6,
    monetizationModels: ["per-lead", "flat-rent", "hybrid"], basis: "HUMAN_ASSUMED: quotable product sale, shorter cycle than full remodels." },
  "metal-roofing": { salesCycleDays: 45, attributionClarity: 0.7, closeRate: 0.1, urgency: 0.45, seasonalitySwing: 0.4, operatorSophistication: 0.6,
    monetizationModels: ["per-lead", "hybrid"], basis: "HUMAN_ASSUMED: partly storm-driven, so urgency is higher than remodels." },
  "basement-waterproofing": { salesCycleDays: 30, attributionClarity: 0.75, closeRate: 0.12, urgency: 0.6, seasonalitySwing: 0.45, operatorSophistication: 0.6,
    monetizationModels: ["per-lead", "flat-rent"], basis: "HUMAN_ASSUMED: problem-driven (water intrusion) so urgency and close rate are higher." },
  "house-cleaning": { salesCycleDays: 3, attributionClarity: 0.85, closeRate: 0.25, urgency: 0.5, seasonalitySwing: 0.15, operatorSophistication: 0.35,
    monetizationModels: ["flat-rent", "per-lead"], basis: "HUMAN_ASSUMED: fast decision, recurring revenue for the renter, but low ticket and less sophisticated operators." },
  "appliance-repair": { salesCycleDays: 1, attributionClarity: 0.9, closeRate: 0.35, urgency: 0.9, seasonalitySwing: 0.1, operatorSophistication: 0.35,
    monetizationModels: ["per-lead", "per-qualified-call"], basis: "HUMAN_ASSUMED: emergency/urgent, same-day decision, excellent attribution via call tracking, but very low ticket." },
};
export const DEFAULT_PROFILE: VerticalProfile = { salesCycleDays: 30, attributionClarity: 0.6, closeRate: 0.1, urgency: 0.4, seasonalitySwing: 0.3, operatorSophistication: 0.5,
  monetizationModels: ["per-lead"], basis: "HUMAN_ASSUMED fallback: no vertical profile recorded for this service." };

export interface MonetizationQuality {
  version: string; score: number | null; gate: Gate; confidence: number;
  leadValueUsd: number | null; expectedLeadsPerMonth: number | null;
  viableRenters: number | null; profile: VerticalProfile;
  recommendedModel: string; assumedInputs: string[]; explanation: string;
}

// $300/mo is the minimum viable rent already encoded in buckets-1.1.0 — reused, not reinvented.
export const MIN_MONTHLY_RENT = 300;

export function assessMonetization(input: {
  serviceSlug: string;
  attributableDemand: number | null;   // NOTE: attributable, not raw measured
  ticketAssumed: number | null; marginAssumed: number | null;
  viableRenters: number | null; renterEvidenceAvailable: boolean;
  assetValueF: number | null;
}): MonetizationQuality {
  const profile = VERTICAL_PROFILES[input.serviceSlug] ?? DEFAULT_PROFILE;
  const assumed = ["ticketAvg (HUMAN_ASSUMED)", "margin (HUMAN_ASSUMED)", `vertical profile: ${profile.basis}`];

  // Lead flow can only be projected from ATTRIBUTABLE demand. Unattributable demand
  // yields a null projection rather than an optimistic one.
  const leads = input.attributableDemand !== null ? input.attributableDemand * 0.25 * 0.12 : null;
  const leadValue = input.ticketAssumed !== null && input.marginAssumed !== null
    ? Math.round(input.ticketAssumed * input.marginAssumed * profile.closeRate) : null;
  const monthlyGp = leads !== null && leadValue !== null ? leads * leadValue : null;

  const hasRenter = input.renterEvidenceAvailable ? (input.viableRenters ?? 0) >= 1 : null;
  let gate: Gate = "UNKNOWN";
  if (hasRenter === false) gate = "FAIL";
  else if (monthlyGp === null || hasRenter === null) gate = "UNKNOWN";
  else gate = monthlyGp >= MIN_MONTHLY_RENT ? "PASS" : "FAIL";

  // Operational quality modifiers — these describe how HARD the money is to collect,
  // not how much of it there is. Deliberately separate from raw gross profit.
  const opQuality = (profile.attributionClarity * 0.4 + profile.operatorSophistication * 0.3
    + (1 - Math.min(profile.salesCycleDays / 120, 1)) * 0.2 + (1 - profile.seasonalitySwing) * 0.1);
  const gpScore = monthlyGp === null ? null
    : monthlyGp >= 8000 ? 90 : monthlyGp >= 3000 ? 75 : monthlyGp >= 1000 ? 58 : monthlyGp >= MIN_MONTHLY_RENT ? 40 : 15;
  const score = gpScore === null ? null : Math.round(gpScore * 0.7 + opQuality * 100 * 0.3);

  const recommendedModel = profile.salesCycleDays > 60 ? "per-lead (long sales cycle makes flat rent hard to justify before the renter sees ROI)"
    : profile.attributionClarity >= 0.85 ? "per-qualified-call (attribution is clean enough to bill per call)"
    : profile.monetizationModels[0]!;

  const explanation = monthlyGp === null
    ? (input.attributableDemand === null
      ? "Monetization cannot be projected: demand is not attributable to this market, so expected lead flow is unknown. This is not the same as low value — it is unmeasured."
      : "Monetization cannot be projected: ticket or margin assumptions are missing.")
    : `~${leads!.toFixed(1)} leads/mo × $${leadValue} per lead ≈ $${Math.round(monthlyGp)}/mo of renter gross profit${monthlyGp < MIN_MONTHLY_RENT ? ` — below the $${MIN_MONTHLY_RENT} minimum rent, so no rational renter pays` : ""}. Sales cycle ~${profile.salesCycleDays} days, attribution clarity ${(profile.attributionClarity * 100).toFixed(0)}%.`;

  return { version: RENTABILITY_VERSION, score, gate, confidence: 0.35,
    leadValueUsd: leadValue, expectedLeadsPerMonth: leads, viableRenters: input.viableRenters,
    profile, recommendedModel, assumedInputs: assumed, explanation };
}

// =====================================================================
// 4. SEARCH OPPORTUNITY
// =====================================================================
export interface SearchOpportunity { version: string; score: number | null; gate: Gate; explanation: string }
export const MIN_ATTRIBUTABLE_DEMAND = 100;   // the existing buckets-1.1.0 demand floor

export function assessSearchOpportunity(input: {
  attribution: DemandAttribution;
  commercialIntentScore: number | null;   // Dimension C
  dimensionA: number | null;              // retained as a GENERAL serp diagnostic
  isExperimentalDemandClass: boolean;     // community assets: zero volume IS the hypothesis
}): SearchOpportunity {
  const { attribution: at } = input;
  if (input.isExperimentalDemandClass) {
    return { version: DECISION_VERSION, score: null, gate: "UNKNOWN",
      explanation: "Demand is the hypothesis under test for this asset class (keyword tools report zero for community queries). Search opportunity is deliberately unscored rather than assumed." };
  }
  let gate: Gate;
  if (at.demandState === "UNKNOWN") gate = "UNKNOWN";
  else if (at.demandState === "ZERO_MEASURED") gate = "FAIL";
  else if (at.attributableDemand === null) gate = "UNKNOWN";      // upper bound / ambiguous
  else gate = at.attributableDemand >= MIN_ATTRIBUTABLE_DEMAND ? "PASS" : "FAIL";

  const score = at.attributableDemand === null ? null
    : Math.round(Math.min(100, (at.attributableDemand >= 1000 ? 92 : at.attributableDemand >= 480 ? 78 : at.attributableDemand >= 200 ? 62 : at.attributableDemand >= 100 ? 48 : 20) * 0.7
      + (input.commercialIntentScore ?? 50) * 0.2 + (input.dimensionA ?? 50) * 0.1));

  const explanation = gate === "UNKNOWN" && at.demandState === "MEASURED_UPPER_BOUND"
    ? `Demand is an UPPER BOUND of ${at.ceiling}/mo shared across same-named markets, not measured local demand. Treating it as local demand would overstate this opportunity.`
    : gate === "FAIL" && at.demandState === "ZERO_MEASURED" ? "Measured zero demand for the exact term."
    : gate === "FAIL" ? `Attributable demand ${at.attributableDemand}/mo is below the ${MIN_ATTRIBUTABLE_DEMAND}/mo floor.`
    : gate === "UNKNOWN" ? "Demand was never measured."
    : `${at.attributableDemand}/mo of locally attributable demand with commercial-intent score ${input.commercialIntentScore ?? "—"}.`;
  return { version: DECISION_VERSION, score, gate, explanation };
}

// =====================================================================
// 5. THE DECISION
// =====================================================================
export interface DecisionResult {
  modelVersion: string;
  searchOpportunity: SearchOpportunity;
  capturability: Capturability;
  monetizationQuality: MonetizationQuality;
  demandAttribution: DemandAttribution;
  gates: { demand: Gate; capturability: Gate; renterDepth: Gate; economics: Gate };
  decision: Decision;
  reasons: string[];
  confidence: number;
  experimentJustification: string | null;
}

export function decide(input: {
  searchOpportunity: SearchOpportunity;
  capturability: Capturability;
  monetization: MonetizationQuality;
  attribution: DemandAttribution;
  renterEvidenceAvailable: boolean;
  viableRenters: number | null;
  /** A pre-registered hypothesis id (H1–H4). EXPERIMENTAL requires one — it is NOT a
   *  softer synonym for BUY, and an asset cannot be excused merely for being weak. */
  preRegisteredHypothesis: string | null;
  experimentRole: string | null;
}): DecisionResult {
  const renterGate: Gate = !input.renterEvidenceAvailable ? "UNKNOWN" : (input.viableRenters ?? 0) >= 1 ? "PASS" : "FAIL";
  const gates = {
    demand: input.searchOpportunity.gate,
    capturability: input.capturability.gate,
    renterDepth: renterGate,
    economics: input.monetization.gate,
  };
  const vals = Object.values(gates);
  const anyFail = vals.includes("FAIL");
  const anyUnknown = vals.includes("UNKNOWN");
  const allPass = vals.every((g) => g === "PASS");

  const reasons: string[] = [];
  for (const [k, g] of Object.entries(gates)) {
    if (g === "FAIL") reasons.push(`${k} gate FAILED — ${k === "demand" ? input.searchOpportunity.explanation : k === "capturability" ? input.capturability.explanation : k === "economics" ? input.monetization.explanation : "no viable renter was found; there is nobody to rent this asset to"}`);
    if (g === "UNKNOWN") reasons.push(`${k} gate UNKNOWN — ${k === "demand" ? input.searchOpportunity.explanation : k === "capturability" ? input.capturability.explanation : k === "economics" ? input.monetization.explanation : "renter depth could not be measured (no map pack returned)"}`);
  }

  let decision: Decision;
  let experimentJustification: string | null = null;
  if (allPass) { decision = "REVENUE_CANDIDATE"; reasons.unshift("All four hard gates pass on attributable evidence."); }
  else if (input.preRegisteredHypothesis) {
    decision = "EXPERIMENTAL";
    experimentJustification = `Deployed to answer pre-registered hypothesis ${input.preRegisteredHypothesis}${input.experimentRole ? ` (${input.experimentRole})` : ""}. This is NOT a weaker buy signal: the asset is justified by the information it produces, not by expected revenue.`;
    reasons.unshift(experimentJustification);
  } else if (anyFail) decision = "REJECT";
  else if (anyUnknown) decision = "HOLD";
  else decision = "HOLD";

  const confidence = Math.min(
    input.attribution.demandConfidence * 0.4 + input.capturability.confidence * 0.35 + input.monetization.confidence * 0.25, 1);

  return { modelVersion: DECISION_VERSION, searchOpportunity: input.searchOpportunity,
    capturability: input.capturability, monetizationQuality: input.monetization,
    demandAttribution: input.attribution, gates, decision, reasons, confidence, experimentJustification };
}
