/**
 * METRIC REGISTRY — the closed vocabulary of facts the system may record.
 *
 * The scoring engine can only ever consume metrics defined here, and the
 * observation layer rejects writes for unknown metrics. This prevents
 * stringly-typed drift and guarantees every number has a declared unit,
 * staleness policy, and set of legitimate evidence types.
 *
 * Phase 1 seeds the registry with the metrics the Phase-2 importer and
 * collectors will write. Later phases EXTEND this list (append entries);
 * they never repurpose existing ids.
 */
import type { RegistryEntry } from "./types";

const OBS = ["OBSERVED"] as const;
const OBS_DER = ["OBSERVED", "DERIVED"] as const;
const ANY_EST = ["OBSERVED", "DERIVED", "AI_ESTIMATED", "HUMAN_ASSUMED"] as const;
const EST_ONLY = ["AI_ESTIMATED", "HUMAN_ASSUMED"] as const;

export const METRICS: readonly RegistryEntry[] = [
  // --- Keyword / demand (Phase 2 importer + collectors) ---
  { id: "kw.volume.exact", kind: "number", unit: "searches/mo", allowedEvidenceTypes: OBS, staleAfterDays: 90, description: "Exact keyword monthly search volume (Google Ads data)" },
  { id: "kw.volume.universe", kind: "number", unit: "searches/mo", allowedEvidenceTypes: OBS_DER, staleAfterDays: 90, description: "Summed monthly volume of the related-keyword universe" },
  { id: "kw.cpc", kind: "number", unit: "usd", allowedEvidenceTypes: OBS, staleAfterDays: 90, description: "Cost-per-click advertisers pay for the primary keyword" },
  { id: "kw.competition.index", kind: "number", unit: "0-1", allowedEvidenceTypes: OBS, staleAfterDays: 90, description: "Ads competition index for the primary keyword (numeric)" },
  { id: "kw.competition.class", kind: "string", unit: "none", allowedEvidenceTypes: OBS, staleAfterDays: 90, description: "Ads competition label for the primary keyword (HIGH|MEDIUM|LOW)" },
  { id: "kw.autocomplete.floor", kind: "number", unit: "0-1", allowedEvidenceTypes: OBS_DER, staleAfterDays: 120, description: "Autocomplete demand floor (1.0 city hit, 0.8 niche activity, 0.6 dead air)" },
  { id: "kw.autocomplete.cityHit", kind: "string", unit: "none", allowedEvidenceTypes: OBS, staleAfterDays: 120, description: "Whether Google autocompletes the exact service+city pair (true/false)" },
  { id: "kw.trend.weight", kind: "number", unit: "multiplier", allowedEvidenceTypes: OBS_DER, staleAfterDays: 365, description: "Niche demand weight from multi-year Google Trends comparison" },
  { id: "kw.trend.direction", kind: "string", unit: "none", allowedEvidenceTypes: OBS_DER, staleAfterDays: 180, description: "Multi-year trend direction class: rising|flat|declining" },
  { id: "kw.seasonality.peakMonths", kind: "string", unit: "none", allowedEvidenceTypes: OBS_DER, staleAfterDays: 365, description: "Comma-joined strongest demand months" },

  // --- Geography demographics (Phase 2 importer; Census later) ---
  { id: "geo.population", kind: "number", unit: "people", allowedEvidenceTypes: ANY_EST, staleAfterDays: 730, description: "Population of the geography" },
  { id: "geo.income.household", kind: "number", unit: "usd/yr", allowedEvidenceTypes: ANY_EST, staleAfterDays: 730, description: "Median household income" },
  { id: "geo.growth.class", kind: "string", unit: "none", allowedEvidenceTypes: ANY_EST, staleAfterDays: 365, description: "Growth classification: high|medium|low" },

  // --- Service economics (Phase 2 importer seeds; Phase 5 AI research) ---
  { id: "econ.ticket.avg", kind: "number", unit: "usd", allowedEvidenceTypes: ANY_EST, staleAfterDays: 365, description: "Average project/job value for the service" },
  { id: "econ.margin.gross", kind: "number", unit: "0-1", allowedEvidenceTypes: ANY_EST, staleAfterDays: 365, description: "Typical gross margin for the service" },
  { id: "econ.close.rate", kind: "number", unit: "0-1", allowedEvidenceTypes: ANY_EST, staleAfterDays: 365, description: "Typical qualified-lead close rate" },
  { id: "econ.lead.value", kind: "number", unit: "usd", allowedEvidenceTypes: ANY_EST, staleAfterDays: 365, description: "Estimated market value of one qualified lead" },
  { id: "econ.service.needType", kind: "string", unit: "none", allowedEvidenceTypes: EST_ONLY, staleAfterDays: null, description: "need|desire purchase classification" },
  { id: "econ.service.seasonal", kind: "string", unit: "none", allowedEvidenceTypes: EST_ONLY, staleAfterDays: null, description: "Whether the service is seasonal (true/false)" },

  // --- V0 prior hypotheses (Phase 2 importer; historical artifacts, always legacy) ---
  // These record what V0 concluded so V2's independent conclusions can later
  // be compared against them. They are DERIVED (from V0's screening code over
  // its observed data) and never feed V2 scoring as current evidence.
  { id: "v0.prior.survivor", kind: "string", unit: "none", allowedEvidenceTypes: ["DERIVED"], staleAfterDays: null, description: "V0 national screen judged this market demand-qualified (true)" },

  // --- Domain research summaries (Phase 2 collector; detail table arrives with the domain-research phase) ---
  // SERP-derived facts (deterministic extraction from a SERP snapshot; DERIVED,
  // must reference the source snapshot + signals methodology version)
  { id: "serp.directory.count", kind: "number", unit: "results", allowedEvidenceTypes: OBS_DER, staleAfterDays: 60, description: "Directory/aggregator results in top 3 organic" },
  { id: "serp.franchise.count", kind: "number", unit: "results", allowedEvidenceTypes: OBS_DER, staleAfterDays: 60, description: "Brand-search franchise domains in top 3 organic" },
  { id: "serp.out_of_town.count", kind: "number", unit: "results", allowedEvidenceTypes: OBS_DER, staleAfterDays: 60, description: "Out-of-town service-area pages in top 3 organic" },
  { id: "serp.inner_page.count", kind: "number", unit: "results", allowedEvidenceTypes: OBS_DER, staleAfterDays: 60, description: "Inner-page (non-homepage) results in top 5 organic" },
  { id: "serp.intent_mismatch.count", kind: "number", unit: "results", allowedEvidenceTypes: OBS_DER, staleAfterDays: 60, description: "Retail/info pages ranking for service intent in top 5" },
  { id: "serp.title_targeting.count", kind: "number", unit: "results", allowedEvidenceTypes: OBS_DER, staleAfterDays: 60, description: "Top-3 titles missing the target city" },
  { id: "serp.ads.count", kind: "number", unit: "ads", allowedEvidenceTypes: OBS_DER, staleAfterDays: 60, description: "Paid ads on the SERP" },
  { id: "serp.map_pack.count", kind: "number", unit: "listings", allowedEvidenceTypes: OBS_DER, staleAfterDays: 60, description: "Map pack listings shown (0 = absent)" },
  { id: "serp.map_pack.avg_reviews", kind: "number", unit: "reviews", allowedEvidenceTypes: OBS_DER, staleAfterDays: 60, description: "Average review count across map pack listings" },
  { id: "serp.map_pack.no_website.count", kind: "number", unit: "listings", allowedEvidenceTypes: OBS_DER, staleAfterDays: 60, description: "Map pack listings without a website" },
  { id: "serp.competitor.content_depth", kind: "number", unit: "words", allowedEvidenceTypes: OBS_DER, staleAfterDays: 90, description: "Average word count of top organic competitor pages" },
  { id: "serp.competitor.domain_age", kind: "number", unit: "years", allowedEvidenceTypes: OBS_DER, staleAfterDays: 180, description: "Average RDAP registration age of top-3 competitor .com domains" },
  { id: "domain.available.count", kind: "number", unit: "domains", allowedEvidenceTypes: OBS, staleAfterDays: 14, description: "Number of candidate .com domains currently available for this opportunity" },
  { id: "domain.exactMatch.available", kind: "string", unit: "none", allowedEvidenceTypes: OBS_DER, staleAfterDays: 14, description: "Whether a city-first exact-match .com is available (true/false)" },
  { id: "domain.pick", kind: "string", unit: "none", allowedEvidenceTypes: OBS_DER, staleAfterDays: 14, description: "Best available domain candidate per deterministic ranking" },
] as const;

const byId = new Map(METRICS.map((m) => [m.id, m]));
if (byId.size !== METRICS.length) {
  throw new Error("METRIC REGISTRY CORRUPT: duplicate metric ids");
}

export function getMetric(id: string): RegistryEntry | undefined {
  return byId.get(id);
}

export function requireMetric(id: string): RegistryEntry {
  const m = byId.get(id);
  if (!m) throw new Error(`Unknown metric: ${id}`);
  return m;
}

export const METRIC_IDS: readonly string[] = METRICS.map((m) => m.id);
