/**
 * Subject management — services, geographies, opportunities.
 *
 * Phase 1 provides only what the evidence spine and the Phase-2 importer
 * need: idempotent upsert-by-slug creation and basic reads. Funnel-stage
 * transitions, elimination rules, and discovery channels arrive with the
 * funnel (Phase 6); scoring state arrives Phase 4.
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { discoveryType } from "./schema";

export const createService = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    synonyms: v.array(v.string()),
    queryPhrase: v.optional(v.string()),
    acPhrase: v.optional(v.string()),
    domainTerms: v.optional(v.array(v.string())),
    category: v.optional(v.string()),
    discoveryType,
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("services")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (existing) return { id: existing._id, created: false };
    const id = await ctx.db.insert("services", { ...args, status: "candidate" });
    return { id, created: true };
  },
});

export const createGeography = mutation({
  args: {
    kind: v.union(v.literal("city"), v.literal("community")),
    name: v.string(),
    state: v.string(),
    slug: v.string(),
    region: v.optional(v.string()),
    parentGeographyId: v.optional(v.id("geographies")),
    discoveryType,
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("geographies")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (existing) return { id: existing._id, created: false };
    if (args.kind === "community" && !args.parentGeographyId) {
      throw new Error("community geographies require a parentGeographyId");
    }
    const id = await ctx.db.insert("geographies", {
      ...args,
      status: "candidate",
    });
    return { id, created: true };
  },
});

export const createOpportunity = mutation({
  args: {
    serviceId: v.id("services"),
    geographyId: v.id("geographies"),
    type: v.union(v.literal("general"), v.literal("cluster")),
    discoveryType,
    primaryKeyword: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("opportunities")
      .withIndex("by_service_geography", (q) =>
        q.eq("serviceId", args.serviceId).eq("geographyId", args.geographyId),
      )
      .unique();
    if (existing) return { id: existing._id, created: false };
    const id = await ctx.db.insert("opportunities", {
      ...args,
      funnelStage: 0,
      status: "active",
      stageHistory: [
        { stage: 0, at: Date.now(), reason: `discovered:${args.discoveryType}` },
      ],
    });
    return { id, created: true };
  },
});

/**
 * Manual/funnel stage transition. The automated promotion rules arrive with
 * the funnel (Phase 6); until then stage changes are explicit and recorded.
 * V0-imported priors NEVER advance stages — every opportunity re-qualifies
 * empirically under V2.
 */
export const setFunnelStage = mutation({
  args: {
    id: v.id("opportunities"),
    stage: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, { id, stage, reason }) => {
    if (stage < 0 || stage > 4 || !Number.isInteger(stage)) {
      throw new Error(`invalid funnel stage ${stage}`);
    }
    const opp = await ctx.db.get(id);
    if (!opp) throw new Error("opportunity not found");
    await ctx.db.patch(id, {
      funnelStage: stage,
      stageHistory: [...opp.stageHistory, { stage, at: Date.now(), reason }],
    });
  },
});

export const getService = query({
  args: { id: v.id("services") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

export const getOpportunity = query({
  args: { id: v.id("opportunities") },
  handler: async (ctx, { id }) => {
    const opp = await ctx.db.get(id);
    if (!opp) return null;
    const [service, geography] = await Promise.all([
      ctx.db.get(opp.serviceId),
      ctx.db.get(opp.geographyId),
    ]);
    return { ...opp, service, geography };
  },
});

export const listOpportunities = query({
  args: { funnelStage: v.optional(v.number()) },
  handler: async (ctx, { funnelStage }) => {
    if (funnelStage !== undefined) {
      return await ctx.db
        .query("opportunities")
        .withIndex("by_funnelStage", (q) => q.eq("funnelStage", funnelStage))
        .collect();
    }
    return await ctx.db.query("opportunities").collect();
  },
});
