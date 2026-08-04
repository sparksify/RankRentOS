// Versioned configuration: weights, thresholds, freshness policies.
// Stored in rros_config at load time; changing values requires bumping the version string.

export const QUALIFICATION_VERSION = 'qual-v1.0';
export const LENS_VERSION = 'rr-opportunity-v1.0';
export const WEIGHTS_VERSION = 'w1.0';
export const SELECTION_VERSION = 'select-v1.0';
export const BLUEPRINT_VERSION = 'blueprint-lite-v1.0';

/** Rank & Rent Opportunity Lens v1 — point allocations (sum = 100). */
export const LENS_WEIGHTS = {
  demand: 20,
  competition: 25,
  monetization: 15,
  domain: 10,
  operatorBench: 10,
  geoEconomics: 10,
  buildability: 10,
} as const;

export const ACTION_THRESHOLDS = {
  strongBuild: 80,
  investigate: 70,
  watchlist: 60,
  minConfidenceForTop10: 0.65,
} as const;

/** Freshness policies in days; null = dataset-year based. */
export const FRESHNESS_POLICY = {
  domain_availability: 1, // verify immediately before recommendation
  serp: 30,
  reviews_gbp: 30,
  keyword: 90,
  census: null,
  v0_unknown: 0, // stale until verified
} as const;

export const QUALIFICATION_GATES = {
  minPopulation: 15000,
  minIncomeAffluent: 90000, // for affluent-suburb archetype niches
  minVolumeStrong: 100,     // measured monthly searches for a strong pass
  minVolumeWeak: 10,        // below this without other demand proof -> needs_research/fail
  cpcHealthyLow: 2,
  cpcHealthyHigh: 15,
  cpcWarHigh: 16,
} as const;

/** Deep-research budget defaults (cost controls). */
export const BUDGET_DEFAULTS = {
  maxTotalBudgetUsd: 25,
  maxDeepResearchCandidates: 30,
  maxKeywordsPerMarket: 5,
  maxSerpCallsPerMarket: 3,
  maxEnrichmentCalls: 0,
} as const;

/** Everything above, serializable for rros_config. */
export function configRows(): { key: string; value: unknown }[] {
  return [
    { key: 'lens_weights:' + WEIGHTS_VERSION, value: LENS_WEIGHTS },
    { key: 'action_thresholds:' + WEIGHTS_VERSION, value: ACTION_THRESHOLDS },
    { key: 'freshness_policy:v1', value: FRESHNESS_POLICY },
    { key: 'qualification_gates:' + QUALIFICATION_VERSION, value: QUALIFICATION_GATES },
    { key: 'budget_defaults:v1', value: BUDGET_DEFAULTS },
  ];
}
