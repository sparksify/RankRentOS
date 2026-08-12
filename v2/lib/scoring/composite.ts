// Composite scoring + weight configurations + portfolio bucketing.
// RULE (explicit): the composite is NEVER multiplied by Confidence. Confidence (I)
// and evidence completeness are exposed as independent decision variables.
import {
  MODEL_VERSION, rankability, demand, commercialIntent, leadEconomics, renterDepth,
  assetValue, speedProspective, asymmetry, confidence, type Ev, type DimResult,
} from "./dimensions";

export interface WeightSet {
  id: string; label: string; rationale: string;
  A: number; B: number; C: number; D: number; E: number; F: number; G: number; H: number;
}

/** v1 default. Reasoning: the objective is "assets likely to become economically
 *  useful", so realizable value (F) + renter depth (E) + demand (B) carry the most
 *  weight; rankability (A) is the entry gate but not the goal; D is down-weighted
 *  BECAUSE it is assumption-dependent in v1 (the historical Rentability-First v2
 *  model put 25 there on live-economics reasoning we cannot yet support). */
export const WEIGHTS_DEFAULT: WeightSet = {
  id: "w-balanced-v1.1", label: "Balanced v1.1 (default)",
  rationale: "D/F audit: F consumes D's per-lead value, so D's independent weight is reduced (0.08->0.05) and moved to OBSERVED dimensions B/E. Directionally conservative: lowers high-ticket/no-volume candidates, does not create winners.",
  A: 0.18, B: 0.19, C: 0.10, D: 0.05, E: 0.17, F: 0.16, G: 0.06, H: 0.09,
};
export const WEIGHT_SETS: WeightSet[] = [
  WEIGHTS_DEFAULT,
  { id: "w-rankability", label: "Rankability-first", rationale: "speed-to-signal bias (V0-like)", A: 0.32, B: 0.16, C: 0.08, D: 0.05, E: 0.10, F: 0.10, G: 0.12, H: 0.07 },
  { id: "w-economics", label: "Economics-first", rationale: "closest to historical Rentability-First v2 priors", A: 0.10, B: 0.18, C: 0.10, D: 0.20, E: 0.20, F: 0.15, G: 0.02, H: 0.05 },
  { id: "w-asymmetry", label: "Asymmetry-seeking", rationale: "hunts mispricing over consensus quality", A: 0.14, B: 0.14, C: 0.06, D: 0.06, E: 0.12, F: 0.14, G: 0.04, H: 0.30 },
  { id: "w-renter", label: "Renter-liquidity-first", rationale: "who will actually pay us?", A: 0.14, B: 0.14, C: 0.08, D: 0.10, E: 0.30, F: 0.14, G: 0.04, H: 0.06 },
];

export interface ScoreResult {
  opportunityId: string;
  modelVersion: string; weightSetId: string;
  dims: Record<"A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I", DimResult>;
  composite: number | null;
  evidenceCompleteness: number;         // independent of composite
  confidenceScore: number | null;       // Dimension I, independent
  unscoredDimensions: string[];
  assumptionDependentDimensions: string[];
  prospectiveDimensions: string[];
  topDrivers: { dim: string; contribution: number }[];
  biggestGap: string | null;            // "what would most change the score"
  asOf: number;
}

export function scoreOpportunity(id: string, e: Ev, w: WeightSet = WEIGHTS_DEFAULT, asOf = Date.now()): ScoreResult {
  const A = rankability(e), B = demand(e), C = commercialIntent(e), D = leadEconomics(e), E = renterDepth(e);
  const F = assetValue(e, D, B, E);
  const G = speedProspective(e, A);
  const H = asymmetry(e, { a: A, b: B, c: C, d: D, e: E, f: F });
  const I = confidence(e, [A, B, C, D, E, F, G, H]);
  const dims = { A, B, C, D, E, F, G, H, I };

  const parts: [string, DimResult, number][] = [["A", A, w.A], ["B", B, w.B], ["C", C, w.C], ["D", D, w.D], ["E", E, w.E], ["F", F, w.F], ["G", G, w.G], ["H", H, w.H]];
  const scored = parts.filter(([, d]) => d.score !== null);
  const weightSum = scored.reduce((s, [, , wt]) => s + wt, 0);
  // renormalize over scoreable dimensions; NEVER impute a missing dimension
  const composite = weightSum > 0 ? Math.round(scored.reduce((s, [, d, wt]) => s + d.score! * wt, 0) / weightSum) : null;

  const contributions = scored.map(([k, d, wt]) => ({ dim: k, contribution: Math.round((d.score! * wt) / weightSum) }))
    .sort((x, y) => y.contribution - x.contribution);
  const unscored = parts.filter(([, d]) => d.score === null).map(([k]) => k);
  // biggest gap = the missing metric on the highest-weighted unscored/incomplete dimension
  const gapDim = parts.filter(([, d]) => d.missingMetrics.length).sort((a, b) => b[2] - a[2])[0];

  return {
    opportunityId: id, modelVersion: MODEL_VERSION, weightSetId: w.id, dims, composite,
    evidenceCompleteness: Math.round((scored.length / parts.length) * 100),
    confidenceScore: I.score, unscoredDimensions: unscored,
    assumptionDependentDimensions: parts.filter(([, d]) => d.assumptionDependent).map(([k]) => k),
    prospectiveDimensions: parts.filter(([, d]) => d.prospective).map(([k]) => k),
    topDrivers: contributions.slice(0, 3),
    biggestGap: gapDim ? `${gapDim[0]}: ${gapDim[1].missingMetrics[0]}` : null,
    asOf,
  };
}

// ---------- Portfolio bucketing (quality gates beat quotas) ----------
/** Bump when a gate changes. 1.1.0 = LOW-HANGING gained an economic (rentability) floor. */
export const BUCKETS_VERSION = "buckets-1.1.0";
export type Bucket = "LOW-HANGING" | "HIGH-VALUE" | "UNICORN" | null;
export function bucketOf(s: ScoreResult, e: Ev): { bucket: Bucket; why: string } {
  const d = s.dims;
  const val = (k: keyof typeof d) => d[k].score ?? 0;
  const hasBuyer = (e.opViable ?? 0) >= 1;
  // Unknown demand is not sub-floor demand: both stay unbucketed, but they are
  // different decisions — unknown is re-researchable, sub-floor is rejected.
  const demandKnown = typeof e.vol === "number";
  const realDemand = demandKnown && e.vol! >= 100;
  if (!demandKnown) return { bucket: null, why: "demand UNKNOWN — not measured, requires research (not a rejection)" };
  if (!realDemand) return { bucket: null, why: "below 100/mo measured demand floor" };
  if (!hasBuyer) return { bucket: null, why: "no viable renter identified" };
  if (val("H") >= 60 && val("A") >= 55 && val("F") >= 55)
    return { bucket: "UNICORN", why: "unusual asymmetry: weak SERP with strong realizable value and a credible buyer" };
  if (val("F") >= 60 && val("E") >= 50 && val("A") >= 40)
    return { bucket: "HIGH-VALUE", why: "strong economics and renter depth with beatable competition" };
  // Economic floor (buckets-1.1.0). A rank-and-rent asset must be RENTABLE: if the
  // lead flow we could route is worth less to the renter than the $300/mo minimum
  // rent the system already encodes, no rational renter pays for it. F >= 34 is the
  // band boundary for >= $300/mo realizable renter gross profit. Without this floor,
  // high-volume/low-ticket services (lawn mowing at ~$3/lead) qualified as deployable.
  if (val("A") >= 60 && val("B") >= 45 && val("E") >= 40) {
    if (val("F") < 34)
      return { bucket: null, why: "beatable SERP but realizable renter gross profit is below the $300/mo minimum rent — not rentable" };
    return { bucket: "LOW-HANGING", why: "weak competition with sufficient demand, an available renter, and rentable economics" };
  }
  return { bucket: null, why: "does not clear any bucket's quality gate" };
}
