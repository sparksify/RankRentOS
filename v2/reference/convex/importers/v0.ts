/**
 * V0 importer mutations — idempotent, provenance-preserving, repeatable.
 *
 *  - subjects upsert by slug / service×geography (re-import creates nothing new)
 *  - observations dedupe on (subject, metric, source, observedAt, value):
 *    re-running an import skips rows that already exist — NEVER overwrites
 *  - every observation passes the same validation as live writes, plus a
 *    hard requirement here that it is marked legacy:true
 *  - accepts parsed rows (lib/import/v0.ts), so recovered MacBook datasets
 *    plug in later as new parsers feeding these same mutations
 */
import { mutation } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { assertValidObservation } from "../../lib/evidence/validate";
import { evidenceType } from "../schema";

const importObservation = v.object({
  metric: v.string(),
  value: v.union(v.number(), v.string()),
  rawValue: v.optional(v.union(v.number(), v.string())),
  source: v.string(),
  sourceUrl: v.optional(v.string()),
  evidenceType,
  confidence: v.number(),
  observedAt: v.number(),
  rationale: v.optional(v.string()),
  legacy: v.literal(true), // importer refuses non-legacy rows by type
});

type ImportObs = {
  metric: string;
  value: number | string;
  rawValue?: number | string;
  source: string;
  sourceUrl?: string;
  evidenceType: "OBSERVED" | "DERIVED" | "AI_ESTIMATED" | "HUMAN_ASSUMED";
  confidence: number;
  observedAt: number;
  rationale?: string;
  legacy: true;
};

type Subject = {
  opportunityId?: Id<"opportunities">;
  geographyId?: Id<"geographies">;
  serviceId?: Id<"services">;
};

async function insertDeduped(
  ctx: any,
  subject: Subject,
  obs: ImportObs[],
  now: number,
): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;
  for (const o of obs) {
    const metric = assertValidObservation(o, now);
    const index = subject.opportunityId
      ? ["by_opportunity_metric", "opportunityId", subject.opportunityId]
      : subject.geographyId
        ? ["by_geography_metric", "geographyId", subject.geographyId]
        : ["by_service_metric", "serviceId", subject.serviceId];
    const existing = await ctx.db
      .query("observations")
      .withIndex(index[0], (q: any) => q.eq(index[1], index[2]).eq("metric", o.metric))
      .collect();
    const dupe = existing.some(
      (e: any) =>
        e.source === o.source &&
        e.observedAt === o.observedAt &&
        e.value === o.value,
    );
    if (dupe) {
      skipped++;
      continue;
    }
    await ctx.db.insert("observations", {
      ...subject,
      ...o,
      unit: metric.unit,
      recordedAt: now,
    });
    inserted++;
  }
  return { inserted, skipped };
}

export const importServices = mutation({
  args: {
    rows: v.array(
      v.object({
        name: v.string(),
        slug: v.string(),
        synonyms: v.array(v.string()),
        queryPhrase: v.optional(v.string()),
        acPhrase: v.optional(v.string()),
        domainTerms: v.optional(v.array(v.string())),
        category: v.optional(v.string()),
        observations: v.array(importObservation),
      }),
    ),
  },
  handler: async (ctx, { rows }) => {
    const now = Date.now();
    let created = 0,
      inserted = 0,
      skipped = 0;
    for (const row of rows) {
      const { observations, ...svc } = row;
      const existing = await ctx.db
        .query("services")
        .withIndex("by_slug", (q) => q.eq("slug", svc.slug))
        .unique();
      const id =
        existing?._id ??
        (await ctx.db.insert("services", {
          ...svc,
          discoveryType: "SEED",
          status: "candidate",
        }));
      if (!existing) created++;
      const r = await insertDeduped(ctx, { serviceId: id }, observations as ImportObs[], now);
      inserted += r.inserted;
      skipped += r.skipped;
    }
    return { created, observationsInserted: inserted, observationsSkipped: skipped };
  },
});

export const importGeographies = mutation({
  args: {
    rows: v.array(
      v.object({
        kind: v.literal("city"),
        name: v.string(),
        state: v.string(),
        slug: v.string(),
        region: v.optional(v.string()),
        observations: v.array(importObservation),
      }),
    ),
  },
  handler: async (ctx, { rows }) => {
    const now = Date.now();
    let created = 0,
      inserted = 0,
      skipped = 0;
    for (const row of rows) {
      const { observations, ...geo } = row;
      const existing = await ctx.db
        .query("geographies")
        .withIndex("by_slug", (q) => q.eq("slug", geo.slug))
        .unique();
      const id =
        existing?._id ??
        (await ctx.db.insert("geographies", {
          ...geo,
          discoveryType: "SEED",
          status: "candidate",
        }));
      if (!existing) created++;
      const r = await insertDeduped(ctx, { geographyId: id }, observations as ImportObs[], now);
      inserted += r.inserted;
      skipped += r.skipped;
    }
    return { created, observationsInserted: inserted, observationsSkipped: skipped };
  },
});

/**
 * Market-level rows (service × geography): upserts the opportunity at funnel
 * stage 0 (V0 priors grant NO stage advancement) and attaches observations.
 * Unresolvable slugs are reported back, never guessed.
 */
export const importMarketObservations = mutation({
  args: {
    rows: v.array(
      v.object({
        serviceSlug: v.string(),
        geographySlug: v.string(),
        primaryKeyword: v.string(),
        observations: v.array(importObservation),
      }),
    ),
  },
  handler: async (ctx, { rows }) => {
    const now = Date.now();
    let opportunitiesCreated = 0,
      inserted = 0,
      skipped = 0;
    const unresolved: string[] = [];
    for (const row of rows) {
      const service = await ctx.db
        .query("services")
        .withIndex("by_slug", (q) => q.eq("slug", row.serviceSlug))
        .unique();
      const geography = await ctx.db
        .query("geographies")
        .withIndex("by_slug", (q) => q.eq("slug", row.geographySlug))
        .unique();
      if (!service || !geography) {
        unresolved.push(`${row.serviceSlug}|${row.geographySlug}`);
        continue;
      }
      const existing = await ctx.db
        .query("opportunities")
        .withIndex("by_service_geography", (q) =>
          q.eq("serviceId", service._id).eq("geographyId", geography._id),
        )
        .unique();
      const oppId =
        existing?._id ??
        (await ctx.db.insert("opportunities", {
          serviceId: service._id,
          geographyId: geography._id,
          type: "general",
          discoveryType: "SEED",
          funnelStage: 0, // legacy priors never advance the V2 funnel
          status: "active",
          stageHistory: [{ stage: 0, at: now, reason: "imported:v0-seed" }],
          primaryKeyword: row.primaryKeyword,
        }));
      if (!existing) opportunitiesCreated++;
      const r = await insertDeduped(
        ctx,
        { opportunityId: oppId },
        row.observations as ImportObs[],
        now,
      );
      inserted += r.inserted;
      skipped += r.skipped;
    }
    return {
      opportunitiesCreated,
      observationsInserted: inserted,
      observationsSkipped: skipped,
      unresolved,
    };
  },
});
