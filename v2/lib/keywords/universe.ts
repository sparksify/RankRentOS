// Keyword universe (universe-v1): replaces V0's "exact volume x 2.5" assumption
// with measured related keywords + deterministic, versioned relevance filtering.
// Never sums raw provider output; every rejection carries a reason for audit.
export const UNIVERSE_VERSION = "universe-v1";

export interface RelatedKeyword { keyword: string; volume: number | null; cpc: number | null; competition?: number | null }
export interface UniverseInput {
  core: string;                 // exact/core query, e.g. "appliance repair prosper"
  serviceTerms: string[];       // service tokens that must appear, e.g. ["appliance","repair"]
  geoTerms: string[];           // geography tokens, e.g. ["prosper","tx"]
  related: RelatedKeyword[];
}
export interface UniverseResult {
  version: string;
  relevantCount: number;
  totalRelevantVolume: number;
  coreVolume: number | null;        // null when the core term itself was never measured
  longTailVolume: number | null;
  unknownVolumeCount: number;       // accepted keywords whose volume the provider could not measure
  geoIntentVolume: number;
  commercialIntentVolume: number;
  cpcMin: number | null; cpcMedian: number | null; cpcMax: number | null;
  topQueries: { keyword: string; volume: number; cpc: number | null }[];
  corePctOfUniverse: number | null;
  accepted: RelatedKeyword[];
  rejected: { keyword: string; reason: string }[];
}

// Deterministic commercial-intent markers (transactional/hire intent).
const COMMERCIAL = ["near me", "cost", "price", "quote", "estimate", "company", "companies", "contractor", "contractors", "service", "services", "installer", "installers", "install", "installation", "repair", "best", "cheap", "affordable", "hire"];
// Informational markers -> not commercial (kept in universe unless irrelevant).
const INFORMATIONAL = ["how to", "diy", "what is", "why", "meaning", "definition", "youtube", "reddit"];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

export function buildUniverse(input: UniverseInput): UniverseResult {
  const core = norm(input.core);
  const svc = input.serviceTerms.map(norm);
  const geo = input.geoTerms.map(norm).filter(Boolean);
  const accepted: RelatedKeyword[] = [];
  const rejected: { keyword: string; reason: string }[] = [];

  for (const r of input.related) {
    const k = norm(r.keyword);
    if (!k) { rejected.push({ keyword: r.keyword, reason: "empty-after-normalization" }); continue; }
    if (r.volume === 0) { rejected.push({ keyword: r.keyword, reason: "zero-measured-volume" }); continue; }
    // must carry at least one service token: prevents unrelated drift
    if (!svc.some((t) => t && k.includes(t))) { rejected.push({ keyword: r.keyword, reason: "no-service-token" }); continue; }
    if (INFORMATIONAL.some((t) => k.includes(t))) { rejected.push({ keyword: r.keyword, reason: "informational-intent" }); continue; }
    // job-seeking / non-buyer intent
    if (/\b(jobs?|salary|training|school|license)\b/.test(k)) { rejected.push({ keyword: r.keyword, reason: "non-buyer-intent" }); continue; }
    accepted.push(r);
  }

  // Sum only measured volumes. A related keyword with unknown volume contributes
  // nothing to the total AND is counted as unknown, so an incomplete universe is
  // never presented as a complete one. UNKNOWN != ZERO.
  const vol = (xs: RelatedKeyword[]) =>
    xs.reduce((s, x) => s + (typeof x.volume === "number" ? x.volume : 0), 0);
  const unknownVolumeCount = accepted.filter((a) => typeof a.volume !== "number").length;
  const coreRow = accepted.find((a) => norm(a.keyword) === core);
  const coreVolume = typeof coreRow?.volume === "number" ? coreRow.volume : null;
  const geoRows = geo.length ? accepted.filter((a) => geo.some((g) => norm(a.keyword).includes(g))) : [];
  const commercialRows = accepted.filter((a) => COMMERCIAL.some((t) => norm(a.keyword).includes(t)));
  const totalRelevantVolume = vol(accepted);
  const cpcs = accepted.map((a) => a.cpc).filter((c): c is number => typeof c === "number" && c > 0).sort((a, b) => a - b);
  const median = cpcs.length ? cpcs[Math.floor(cpcs.length / 2)]! : null;

  return {
    version: UNIVERSE_VERSION,
    relevantCount: accepted.length,
    totalRelevantVolume,
    coreVolume,
    unknownVolumeCount,
    longTailVolume: coreVolume === null ? null : Math.max(totalRelevantVolume - coreVolume, 0),
    geoIntentVolume: vol(geoRows),
    commercialIntentVolume: vol(commercialRows),
    cpcMin: cpcs[0] ?? null, cpcMedian: median, cpcMax: cpcs[cpcs.length - 1] ?? null,
    // only measured keywords can be ranked by volume
    topQueries: accepted
      .filter((a): a is RelatedKeyword & { volume: number } => typeof a.volume === "number")
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 5)
      .map((a) => ({ keyword: a.keyword, volume: a.volume, cpc: a.cpc })),
    corePctOfUniverse: coreVolume !== null && totalRelevantVolume > 0 ? Math.round((coreVolume / totalRelevantVolume) * 1000) / 10 : null,
    accepted, rejected,
  };
}

// ---------------------------------------------------------------------------
// GEO-SCOPED UNIVERSE (universe-geo-1.0.0)
//
// Exp-1.5 found DataForSEO related keywords leak NATIONAL volume into local
// research: "appliance repair near me" carries nationwide demand that a single
// city asset can never capture. Summing it inflates B and is indefensible.
//
// Rule: for a local asset, only keywords that are geographically attributable to
// THIS market may contribute volume. Everything else is preserved with an explicit
// rejection reason but contributes ZERO. If nothing is attributable, the geo
// universe is reported as incomplete rather than invented.
// ---------------------------------------------------------------------------
export const UNIVERSE_GEO_VERSION = "universe-geo-1.0.0";

export interface GeoUniverseResult {
  version: string;
  geoScoped: true;
  attributableCount: number;
  attributableVolume: number;        // sum of MEASURED volume of geo-attributable keywords
  unknownVolumeCount: number;        // attributable but unmeasured — universe is incomplete
  complete: boolean;                 // false when any attributable keyword lacks volume
  accepted: RelatedKeyword[];
  rejected: { keyword: string; reason: string }[];
  nationalLeakageVolume: number;     // what a naive sum WOULD have added (audit trail)
  cpcMedian: number | null;
}

/** Deterministic, auditable geo-scoped universe. Never blind-sums. */
export function buildGeoUniverse(input: UniverseInput): GeoUniverseResult {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const geo = input.geoTerms.map(norm).filter(Boolean);
  const svc = input.serviceTerms.map(norm).filter(Boolean);
  const accepted: RelatedKeyword[] = [];
  const rejected: { keyword: string; reason: string }[] = [];
  let nationalLeakageVolume = 0;

  for (const r of input.related) {
    const k = norm(r.keyword);
    if (!k) { rejected.push({ keyword: r.keyword, reason: "empty-keyword" }); continue; }
    // 1. must be geographically attributable to THIS market
    if (!geo.some((g) => k.includes(g))) {
      nationalLeakageVolume += typeof r.volume === "number" ? r.volume : 0;
      rejected.push({ keyword: r.keyword, reason: "national-scope-not-attributable-to-this-market" });
      continue;
    }
    // 2. must actually be this service
    if (svc.length && !svc.some((t) => k.includes(t))) { rejected.push({ keyword: r.keyword, reason: "no-service-token" }); continue; }
    // 3. must be buyer intent
    if (INFORMATIONAL.some((t) => k.includes(t))) { rejected.push({ keyword: r.keyword, reason: "informational-intent" }); continue; }
    if (/\b(jobs?|salary|training|school|license|diy)\b/.test(k)) { rejected.push({ keyword: r.keyword, reason: "non-buyer-intent" }); continue; }
    // 4. observed zero demand is a rejection; UNKNOWN is kept but marks incompleteness
    if (r.volume === 0) { rejected.push({ keyword: r.keyword, reason: "zero-measured-volume" }); continue; }
    accepted.push(r);
  }

  const unknownVolumeCount = accepted.filter((a) => typeof a.volume !== "number").length;
  const attributableVolume = accepted.reduce((s, a) => s + (typeof a.volume === "number" ? a.volume : 0), 0);
  const cpcs = accepted.map((a) => a.cpc).filter((c): c is number => typeof c === "number" && c > 0).sort((a, b) => a - b);

  return {
    version: UNIVERSE_GEO_VERSION, geoScoped: true,
    attributableCount: accepted.length, attributableVolume, unknownVolumeCount,
    complete: accepted.length > 0 && unknownVolumeCount === 0,
    accepted, rejected, nationalLeakageVolume,
    cpcMedian: cpcs.length ? cpcs[Math.floor(cpcs.length / 2)]! : null,
  };
}
