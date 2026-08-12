// Operator/renter depth (operators-v1): "if this asset produces leads, is there a
// deep, economically credible market of businesses that could buy them?"
// Deterministic SIGNALS ONLY — not Score E. Never infers revenue/employees/budget.
export const OPERATORS_VERSION = "operators-v1";

export interface OperatorEvidence {
  name: string;
  source: "mappack" | "organic" | "ads";
  rating?: number | null;
  reviews?: number | null;
  website?: string | null;
  domain?: string | null;
  multiLocationHint?: boolean;
}
export interface OperatorRecord {
  key: string; name: string; sources: string[];
  rating: number | null; reviews: number | null; website: string | null; domain: string | null;
  multiLocationHint: boolean; multiSourceConfirmed: boolean;
}
export interface DepthSignals {
  version: string;
  relevantOperatorCount: number;   // deduped businesses seen at all
  viableOperatorCount: number;     // has website AND >=5 reviews (contactable + real)
  strongerOperatorCount: number;   // >=50 reviews AND rating >=4.0
  multiSourceCount: number;        // seen via 2+ evidence sources
  advertiserCount: number;         // observed paying for ads
  medianReviews: number | null;
  reviewDistribution: { p0: number; p50: number; p100: number } | null;
  medianRating: number | null;
  websiteAdoptionPct: number | null;
  concentration: "fragmented" | "moderate" | "concentrated" | "insufficient-evidence";
  evidenceNote: string;
}

const keyOf = (name: string, domain?: string | null) =>
  (domain ? domain.replace(/^www\./, "") : name.toLowerCase().replace(/[^a-z0-9]/g, "")).slice(0, 60);

export function dedupeOperators(evidence: OperatorEvidence[]): OperatorRecord[] {
  const map = new Map<string, OperatorRecord>();
  for (const e of evidence) {
    const domain = e.domain ?? (e.website ? safeHost(e.website) : null);
    const k = keyOf(e.name, domain);
    const prev = map.get(k);
    if (!prev) {
      map.set(k, { key: k, name: e.name, sources: [e.source], rating: e.rating ?? null, reviews: e.reviews ?? null,
        website: e.website ?? null, domain, multiLocationHint: !!e.multiLocationHint, multiSourceConfirmed: false });
    } else {
      if (!prev.sources.includes(e.source)) prev.sources.push(e.source);
      prev.multiSourceConfirmed = prev.sources.length > 1;
      prev.rating ??= e.rating ?? null;
      prev.reviews ??= e.reviews ?? null;
      prev.website ??= e.website ?? null;
      prev.domain ??= domain;
      prev.multiLocationHint ||= !!e.multiLocationHint;
    }
  }
  return [...map.values()];
}
function safeHost(u: string) { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return null; } }

export function depthSignals(ops: OperatorRecord[]): DepthSignals {
  const withReviews = ops.map((o) => o.reviews).filter((r): r is number => typeof r === "number").sort((a, b) => a - b);
  const withRating = ops.map((o) => o.rating).filter((r): r is number => typeof r === "number").sort((a, b) => a - b);
  const viable = ops.filter((o) => o.website && (o.reviews ?? 0) >= 5).length;
  const stronger = ops.filter((o) => (o.reviews ?? 0) >= 50 && (o.rating ?? 0) >= 4.0).length;
  const advertisers = ops.filter((o) => o.sources.includes("ads")).length;
  const med = (xs: number[]) => (xs.length ? xs[Math.floor(xs.length / 2)] : null);

  // concentration from review share of the top operator (deterministic, evidence-only)
  let concentration: DepthSignals["concentration"] = "insufficient-evidence";
  const totalReviews = withReviews.reduce((s, x) => s + x, 0);
  if (ops.length >= 3 && totalReviews > 0) {
    const topShare = withReviews[withReviews.length - 1] / totalReviews;
    concentration = topShare >= 0.6 ? "concentrated" : topShare >= 0.4 ? "moderate" : "fragmented";
  }
  return {
    version: OPERATORS_VERSION,
    relevantOperatorCount: ops.length,
    viableOperatorCount: viable,
    strongerOperatorCount: stronger,
    multiSourceCount: ops.filter((o) => o.multiSourceConfirmed).length,
    advertiserCount: advertisers,
    medianReviews: med(withReviews),
    reviewDistribution: withReviews.length ? { p0: withReviews[0], p50: med(withReviews)!, p100: withReviews[withReviews.length - 1] } : null,
    medianRating: med(withRating),
    websiteAdoptionPct: ops.length ? Math.round((ops.filter((o) => o.website).length / ops.length) * 100) : null,
    concentration,
    evidenceNote: "signals only; no revenue/employee/budget inference (operators-v1)",
  };
}
