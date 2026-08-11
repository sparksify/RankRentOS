/**
 * Convex schema — PHASE 1 SUBSET ONLY (Amendment 4: incremental schema).
 *
 * Implemented now (and why):
 *  - services, geographies, opportunities — the subject spine. Observations
 *    are meaningless without subjects, and the Phase-2 importer (the
 *    immediately dependent phase) attaches evidence to exactly these three.
 *  - observations — the append-only evidence/provenance table. The point of
 *    Phase 1.
 *  - researchRuns — collection provenance: every automated observation
 *    points back to the run that produced it; also carries cost accounting
 *    and idempotency for Phase-2 collectors.
 *
 * Phase 2 additions: serpSnapshots (SERPs are structured multi-part
 * evidence a flat observation cannot hold queryably) and budgetLedger
 * (append-only research-spend accounting enforcing the cost cap), plus
 * `legacy` on observations (V0-imported evidence must never become V2
 * truth by inheritance — see observations.ts selection rules).
 *
 * Deliberately NOT implemented yet (conceptual only, see implementation
 * plan §7): operators (Phase 3), scoringModels + scoreRuns (Phase 4),
 * domainCandidates (first domain research phase — Phase-2 domain checks
 * record summary observations instead), portfolioRuns/Selections (Phase 8).
 */
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const evidenceType = v.union(
  v.literal("OBSERVED"),
  v.literal("DERIVED"),
  v.literal("AI_ESTIMATED"),
  v.literal("HUMAN_ASSUMED"),
);

export const discoveryType = v.union(
  v.literal("SEED"),
  v.literal("AI_DISCOVERY"),
  v.literal("SEARCH_ANOMALY"),
  v.literal("COMMUNITY_DISCOVERY"),
  v.literal("HUMAN_HYPOTHESIS"),
  v.literal("DATA_ANOMALY"),
  v.literal("OTHER"),
);

export default defineSchema({
  services: defineTable({
    name: v.string(),
    slug: v.string(),
    synonyms: v.array(v.string()),
    /** Full SERP query phrase, e.g. "epoxy garage floor coating" (collectors). */
    queryPhrase: v.optional(v.string()),
    /** Short phrase people actually type, e.g. "epoxy flooring" (keywords/autocomplete). */
    acPhrase: v.optional(v.string()),
    /** Domain-name terms for candidate generation (domains collector). */
    domainTerms: v.optional(v.array(v.string())),
    category: v.optional(v.string()),
    discoveryType,
    status: v.union(
      v.literal("candidate"),
      v.literal("active"),
      v.literal("excluded"),
    ),
    notes: v.optional(v.string()),
  })
    .index("by_slug", ["slug"])
    .index("by_status", ["status"]),

  geographies: defineTable({
    kind: v.union(v.literal("city"), v.literal("community")),
    name: v.string(),
    state: v.string(),
    slug: v.string(),
    region: v.optional(v.string()),
    // community → parent city; cities have no parent
    parentGeographyId: v.optional(v.id("geographies")),
    discoveryType,
    status: v.union(
      v.literal("candidate"),
      v.literal("active"),
      v.literal("excluded"),
    ),
  })
    .index("by_slug", ["slug"])
    .index("by_kind_state", ["kind", "state"])
    .index("by_parent", ["parentGeographyId"]),

  opportunities: defineTable({
    serviceId: v.id("services"),
    geographyId: v.id("geographies"),
    type: v.union(v.literal("general"), v.literal("cluster")),
    discoveryType,
    // funnel: 0 discovery, 1 cheap screen, 2 qualification, 3 deep research, 4 due diligence
    funnelStage: v.number(),
    status: v.union(
      v.literal("active"),
      v.literal("eliminated"),
      v.literal("finalist"),
      v.literal("selected"),
      v.literal("rejected"),
    ),
    eliminationReason: v.optional(v.string()),
    stageHistory: v.array(
      v.object({ stage: v.number(), at: v.number(), reason: v.string() }),
    ),
    primaryKeyword: v.string(),
  })
    .index("by_service_geography", ["serviceId", "geographyId"])
    .index("by_funnelStage", ["funnelStage"])
    .index("by_status", ["status"]),

  observations: defineTable({
    // subject association — at least one is required (enforced in the mutation)
    opportunityId: v.optional(v.id("opportunities")),
    geographyId: v.optional(v.id("geographies")),
    serviceId: v.optional(v.id("services")),
    // provenance payload
    metric: v.string(), // must exist in lib/evidence/metrics.ts (enforced in mutation)
    value: v.union(v.number(), v.string()),
    rawValue: v.optional(v.union(v.number(), v.string())),
    unit: v.string(), // denormalized from the registry at write time
    source: v.string(),
    sourceUrl: v.optional(v.string()),
    evidenceType,
    confidence: v.number(), // 0..1
    observedAt: v.number(), // epoch ms, when the fact was true in the world
    recordedAt: v.number(), // epoch ms, when we wrote it
    rationale: v.optional(v.string()), // required for HUMAN_ASSUMED (enforced in mutation)
    researchRunId: v.optional(v.id("researchRuns")),
    /**
     * true = imported from V0 (or any pre-V2 system). Legacy observations
     * seed research and provide fallback context, but evidence selection
     * prefers ANY independently collected V2 observation over ANY legacy
     * one, regardless of timestamps. Never authoritative by inheritance.
     */
    legacy: v.optional(v.boolean()),
  })
    .index("by_opportunity_metric", ["opportunityId", "metric", "observedAt"])
    .index("by_geography_metric", ["geographyId", "metric", "observedAt"])
    .index("by_service_metric", ["serviceId", "metric", "observedAt"])
    .index("by_researchRun", ["researchRunId"]),

  serpSnapshots: defineTable({
    opportunityId: v.id("opportunities"),
    keyword: v.string(),
    location: v.string(),
    engine: v.string(), // "google"
    variant: v.optional(v.string()), // deep-check variant label, if any
    fetchedAt: v.number(),
    organic: v.array(
      v.object({
        position: v.number(),
        title: v.optional(v.string()),
        link: v.optional(v.string()),
        domain: v.optional(v.string()),
        snippet: v.optional(v.string()),
      }),
    ),
    localPack: v.array(
      v.object({
        name: v.string(),
        rating: v.optional(v.number()),
        reviews: v.optional(v.number()),
        website: v.optional(v.string()),
        type: v.optional(v.string()),
      }),
    ),
    ads: v.array(
      v.object({
        title: v.optional(v.string()),
        link: v.optional(v.string()),
        displayedLink: v.optional(v.string()),
      }),
    ),
    /** Deterministic extraction (lib/serp/signals.ts), versioned. */
    signals: v.any(),
    signalsVersion: v.string(),
    /** true = imported from V0 raw cache when recovered; never used for freshness. */
    historic: v.optional(v.boolean()),
    researchRunId: v.optional(v.id("researchRuns")),
    costUsd: v.number(),
  })
    .index("by_opportunity", ["opportunityId", "fetchedAt"])
    .index("by_keyword_location", ["keyword", "location"]),

  budgetLedger: defineTable({
    researchRunId: v.id("researchRuns"),
    kind: v.string(),
    provider: v.string(),
    usd: v.number(),
    at: v.number(),
  }).index("by_kind", ["kind"]),

  researchRuns: defineTable({
    kind: v.string(), // e.g. "import:v0", "serp", "keywords", "ai:economics"
    paramsHash: v.string(), // idempotency: kind+paramsHash unique-by-convention
    params: v.optional(v.any()),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("done"),
      v.literal("failed"),
    ),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    error: v.optional(v.string()),
    provider: v.optional(v.string()),
    apiCalls: v.number(),
    estCostUsd: v.number(),
    actualCostUsd: v.optional(v.number()),
    requestedBy: v.union(v.literal("funnel"), v.literal("human"), v.literal("import")),
  })
    .index("by_kind_paramsHash", ["kind", "paramsHash"])
    .index("by_status", ["status"]),
});
