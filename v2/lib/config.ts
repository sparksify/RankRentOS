/**
 * V1 research-cost + funnel-stage configuration.
 *
 * TEMPORARY HOME: these constants move into versioned `scoringModels`
 * documents in Phase 4. Until then they are the single authority the
 * collectors enforce. Values are the approved plan defaults.
 */

/** Hard cap on total external research spend (USD) — plan §13 default. */
export const TOTAL_RESEARCH_BUDGET_USD = 250;

/**
 * Funnel stage an opportunity must have reached before a collector may
 * spend money on it (plan §12: cheap data early, expensive data late).
 */
export const COLLECTOR_REQUIRED_STAGE: Record<string, number> = {
  autocomplete: 1, // cheap screen
  keywords: 2, // qualification
  serp: 3, // deep research
  domains: 3, // deep research
};

/** Estimated per-call provider costs (USD) used for budget pre-checks. */
export const EST_COST_USD = {
  serpApiCall: 0.015,
  dataForSeoVolumeBatch: 0.075, // per 1k-keyword batch request
  rdapCall: 0,
  crawlPage: 0,
} as const;
