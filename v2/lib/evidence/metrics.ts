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
  { id: "serp.outoftown.count", kind: "number", unit: "results", allowedEvidenceTypes: OBS_DER, staleAfterDays: 60, description: "Out-of-town service-area pages in top 3 organic" },
  { id: "serp.innerpage.count", kind: "number", unit: "results", allowedEvidenceTypes: OBS_DER, staleAfterDays: 60, description: "Inner-page (non-homepage) results in top 5 organic" },
  { id: "serp.intentmismatch.count", kind: "number", unit: "results", allowedEvidenceTypes: OBS_DER, staleAfterDays: 60, description: "Retail/info pages ranking for service intent in top 5" },
  { id: "serp.titletargeting.count", kind: "number", unit: "results", allowedEvidenceTypes: OBS_DER, staleAfterDays: 60, description: "Top-3 titles missing the target city" },
  { id: "serp.ads.count", kind: "number", unit: "ads", allowedEvidenceTypes: OBS_DER, staleAfterDays: 60, description: "Paid ads on the SERP" },
  { id: "serp.mappack.count", kind: "number", unit: "listings", allowedEvidenceTypes: OBS_DER, staleAfterDays: 60, description: "Map pack listings shown (0 = absent)" },
  { id: "serp.mappack.avgreviews", kind: "number", unit: "reviews", allowedEvidenceTypes: OBS_DER, staleAfterDays: 60, description: "Average review count across map pack listings" },
  { id: "serp.competitor.avgwords", kind: "number", unit: "words", allowedEvidenceTypes: OBS_DER, staleAfterDays: 90, description: "Mean word count of top non-directory organic competitor pages (content depth we must beat)" },
  { id: "serp.competitor.domainageyears", kind: "number", unit: "years", allowedEvidenceTypes: OBS_DER, staleAfterDays: 180, description: "Mean registration age of top non-directory organic competitor domains" },

  // ---------- deployment outcome metrics (asset.* namespace) ----------
  // Written back by the Deployment Engine per the Part-2 outcome contract. All
  // OBSERVED. Event dates are ISO strings; counts/durations are numbers.
  // UNKNOWN is never posted as zero: an unmeasured value is simply not sent.
  { id: "asset.published.date", kind: "string", unit: "iso-date", allowedEvidenceTypes: ["OBSERVED"], staleAfterDays: 36500, description: "Site/page publish date" },
  { id: "asset.indexed.date", kind: "string", unit: "iso-date", allowedEvidenceTypes: ["OBSERVED"], staleAfterDays: 36500, description: "First seen indexed by Google" },
  { id: "asset.firstimpression.date", kind: "string", unit: "iso-date", allowedEvidenceTypes: ["OBSERVED"], staleAfterDays: 36500, description: "First Search Console impression" },
  { id: "asset.firstrank.date", kind: "string", unit: "iso-date", allowedEvidenceTypes: ["OBSERVED"], staleAfterDays: 36500, description: "First top-100 position on the primary query" },
  { id: "asset.firstlead.date", kind: "string", unit: "iso-date", allowedEvidenceTypes: ["OBSERVED"], staleAfterDays: 36500, description: "First inbound lead (call or form)" },
  { id: "asset.firstrevenue.date", kind: "string", unit: "iso-date", allowedEvidenceTypes: ["OBSERVED"], staleAfterDays: 36500, description: "First rent/revenue received" },
  { id: "asset.indexed.days", kind: "number", unit: "days", allowedEvidenceTypes: ["OBSERVED", "DERIVED"], staleAfterDays: 36500, description: "Days from publish to indexation" },
  { id: "asset.firstimpression.days", kind: "number", unit: "days", allowedEvidenceTypes: ["OBSERVED", "DERIVED"], staleAfterDays: 36500, description: "Days from publish to first impression" },
  { id: "asset.firstrank.days", kind: "number", unit: "days", allowedEvidenceTypes: ["OBSERVED", "DERIVED"], staleAfterDays: 36500, description: "Days from publish to first top-100 rank" },
  { id: "asset.rank.check", kind: "string", unit: "json", allowedEvidenceTypes: ["OBSERVED"], staleAfterDays: 36500, description: "One ranking-trajectory check, JSON: {query, role, position(1-100)|'notFound', url}. 'notFound' = checked and absent from top 100 — never stored as 101 or 0" },
  { id: "asset.impressions.count", kind: "number", unit: "impressions", allowedEvidenceTypes: ["OBSERVED"], staleAfterDays: 36500, description: "Search impressions for the period stated in source" },
  { id: "asset.clicks.count", kind: "number", unit: "clicks", allowedEvidenceTypes: ["OBSERVED"], staleAfterDays: 36500, description: "Search clicks for the period" },
  { id: "asset.sessions.count", kind: "number", unit: "sessions", allowedEvidenceTypes: ["OBSERVED"], staleAfterDays: 36500, description: "Organic sessions for the period" },
  { id: "asset.calls.count", kind: "number", unit: "calls", allowedEvidenceTypes: ["OBSERVED"], staleAfterDays: 36500, description: "Tracked calls for the period" },
  { id: "asset.forms.count", kind: "number", unit: "forms", allowedEvidenceTypes: ["OBSERVED"], staleAfterDays: 36500, description: "Form submissions for the period" },
  { id: "asset.leads.count", kind: "number", unit: "leads", allowedEvidenceTypes: ["OBSERVED"], staleAfterDays: 36500, description: "Total leads for the period" },
  { id: "asset.leads.qualified", kind: "number", unit: "leads", allowedEvidenceTypes: ["OBSERVED"], staleAfterDays: 36500, description: "Qualified leads for the period" },
  { id: "asset.leadvalue.realized", kind: "number", unit: "usd", allowedEvidenceTypes: ["OBSERVED"], staleAfterDays: 36500, description: "Realized value per lead — replaces the HUMAN_ASSUMED figure in D" },
  { id: "asset.renter.outreach", kind: "number", unit: "contacts", allowedEvidenceTypes: ["OBSERVED"], staleAfterDays: 36500, description: "Renter outreach attempts" },
  { id: "asset.renter.responses", kind: "number", unit: "contacts", allowedEvidenceTypes: ["OBSERVED"], staleAfterDays: 36500, description: "Renter responses" },
  { id: "asset.renter.acquired", kind: "number", unit: "boolean", allowedEvidenceTypes: ["OBSERVED"], staleAfterDays: 36500, description: "1 when a renter signs; 0 explicitly means an engagement fell through — absence of the metric means unknown" },
  { id: "asset.rent.monthly", kind: "number", unit: "usd", allowedEvidenceTypes: ["OBSERVED"], staleAfterDays: 36500, description: "Realized monthly rent — replaces modelled renter GP in F" },
  { id: "asset.revenue.total", kind: "number", unit: "usd", allowedEvidenceTypes: ["OBSERVED"], staleAfterDays: 36500, description: "Cumulative revenue" },
  { id: "asset.cost.operating", kind: "number", unit: "usd", allowedEvidenceTypes: ["OBSERVED"], staleAfterDays: 36500, description: "Operating cost for the period" },
  { id: "serp.mappack.nowebsite.count", kind: "number", unit: "listings", allowedEvidenceTypes: OBS_DER, staleAfterDays: 60, description: "Map pack listings without a website" },
  { id: "serp.competitor.contentdepth", kind: "number", unit: "words", allowedEvidenceTypes: OBS_DER, staleAfterDays: 90, description: "Average word count of top organic competitor pages" },
  { id: "serp.competitor.domainage", kind: "number", unit: "years", allowedEvidenceTypes: OBS_DER, staleAfterDays: 180, description: "Average RDAP registration age of top-3 competitor .com domains" },
  // Keyword universe (universe-v1) — replaces V0's exact x2.5 assumption
  { id: "kw.universe.count", kind: "number", unit: "keywords", allowedEvidenceTypes: OBS_DER, staleAfterDays: 90, description: "Relevant related keywords after deterministic filtering" },
  { id: "kw.universe.volume", kind: "number", unit: "searches/mo", allowedEvidenceTypes: OBS_DER, staleAfterDays: 90, description: "Total measured volume of the filtered relevant universe" },
  { id: "kw.universe.longtail", kind: "number", unit: "searches/mo", allowedEvidenceTypes: OBS_DER, staleAfterDays: 90, description: "Universe volume excluding the core term" },
  { id: "kw.universe.geointent", kind: "number", unit: "searches/mo", allowedEvidenceTypes: OBS_DER, staleAfterDays: 90, description: "Universe volume carrying geographic intent" },
  { id: "kw.universe.commercialintent", kind: "number", unit: "searches/mo", allowedEvidenceTypes: OBS_DER, staleAfterDays: 90, description: "Universe volume carrying commercial/transactional intent" },
  { id: "kw.universe.corepct", kind: "number", unit: "percent", allowedEvidenceTypes: OBS_DER, staleAfterDays: 90, description: "Core term share of the relevant universe" },
  { id: "kw.cpc.median", kind: "number", unit: "usd", allowedEvidenceTypes: OBS_DER, staleAfterDays: 90, description: "Median CPC across the relevant keyword universe" },
  // Operator/renter depth (operators-v1) — signals only, never financial inference
  { id: "op.count.relevant", kind: "number", unit: "businesses", allowedEvidenceTypes: OBS_DER, staleAfterDays: 90, description: "Deduped businesses observed serving this market" },
  { id: "op.count.viable", kind: "number", unit: "businesses", allowedEvidenceTypes: OBS_DER, staleAfterDays: 90, description: "Operators with a website and >=5 reviews" },
  { id: "op.count.stronger", kind: "number", unit: "businesses", allowedEvidenceTypes: OBS_DER, staleAfterDays: 90, description: "Operators with >=50 reviews and >=4.0 rating" },
  { id: "op.count.multisource", kind: "number", unit: "businesses", allowedEvidenceTypes: OBS_DER, staleAfterDays: 90, description: "Operators confirmed by 2+ evidence sources" },
  { id: "op.count.advertiser", kind: "number", unit: "businesses", allowedEvidenceTypes: OBS_DER, staleAfterDays: 90, description: "Operators observed paying for ads" },
  { id: "op.reviews.median", kind: "number", unit: "reviews", allowedEvidenceTypes: OBS_DER, staleAfterDays: 90, description: "Median review count across observed operators" },
  { id: "op.rating.median", kind: "number", unit: "stars", allowedEvidenceTypes: OBS_DER, staleAfterDays: 90, description: "Median rating across observed operators" },
  { id: "op.website.adoptionpct", kind: "number", unit: "percent", allowedEvidenceTypes: OBS_DER, staleAfterDays: 90, description: "Percent of observed operators with a website" },
  { id: "op.concentration.class", kind: "string", unit: "none", allowedEvidenceTypes: OBS_DER, staleAfterDays: 90, description: "fragmented|moderate|concentrated|insufficient-evidence by review share" },
  // Scoring outputs (A–I v1). DERIVED only — recomputable, never facts.
  { id: "score.composite", kind: "number", unit: "0-100", allowedEvidenceTypes: ["DERIVED"], staleAfterDays: 30, description: "A–I composite score under a named weight set" },
  { id: "score.confidence", kind: "number", unit: "0-100", allowedEvidenceTypes: ["DERIVED"], staleAfterDays: 30, description: "Dimension I — evidence-quality confidence, independent of composite" },
  { id: "score.completeness", kind: "number", unit: "percent", allowedEvidenceTypes: ["DERIVED"], staleAfterDays: 30, description: "Share of A–H dimensions scoreable from available evidence" },
  { id: "score.bucket", kind: "string", unit: "none", allowedEvidenceTypes: ["DERIVED"], staleAfterDays: 30, description: "Portfolio bucket: LOW-HANGING|HIGH-VALUE|UNICORN|null" },
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
