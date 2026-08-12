// Keyword universe (universe-v1): replaces V0's "exact volume x 2.5" assumption
// with measured related keywords + deterministic, versioned relevance filtering.
// Never sums raw provider output; every rejection carries a reason for audit.
export const UNIVERSE_VERSION = "universe-v1";

export interface RelatedKeyword { keyword: string; volume: number; cpc: number | null; competition?: number | null }
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
  coreVolume: number;
  longTailVolume: number;
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

  const vol = (xs: RelatedKeyword[]) => xs.reduce((s, x) => s + (x.volume || 0), 0);
  const coreRow = accepted.find((a) => norm(a.keyword) === core);
  const coreVolume = coreRow?.volume ?? 0;
  const geoRows = geo.length ? accepted.filter((a) => geo.some((g) => norm(a.keyword).includes(g))) : [];
  const commercialRows = accepted.filter((a) => COMMERCIAL.some((t) => norm(a.keyword).includes(t)));
  const totalRelevantVolume = vol(accepted);
  const cpcs = accepted.map((a) => a.cpc).filter((c): c is number => typeof c === "number" && c > 0).sort((a, b) => a - b);
  const median = cpcs.length ? cpcs[Math.floor(cpcs.length / 2)] : null;

  return {
    version: UNIVERSE_VERSION,
    relevantCount: accepted.length,
    totalRelevantVolume,
    coreVolume,
    longTailVolume: Math.max(totalRelevantVolume - coreVolume, 0),
    geoIntentVolume: vol(geoRows),
    commercialIntentVolume: vol(commercialRows),
    cpcMin: cpcs[0] ?? null, cpcMedian: median, cpcMax: cpcs[cpcs.length - 1] ?? null,
    topQueries: [...accepted].sort((a, b) => b.volume - a.volume).slice(0, 5).map((a) => ({ keyword: a.keyword, volume: a.volume, cpc: a.cpc })),
    corePctOfUniverse: totalRelevantVolume > 0 ? Math.round((coreVolume / totalRelevantVolume) * 1000) / 10 : null,
    accepted, rejected,
  };
}
