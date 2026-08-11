/**
 * Observation layer — the APPEND-ONLY evidence spine.
 *
 * GUARANTEES (tested in tests/convex/observations.test.ts):
 *  1. Append-only: this module exposes NO update or delete function for
 *     observations, and none may ever be added. Corrections are newer
 *     observations.
 *  2. Every write validates against the metric registry (unknown metric,
 *     wrong value kind, and disallowed evidence type are rejected).
 *  3. AI citation guard: AI_ESTIMATED without an http(s) sourceUrl is
 *     rejected at the write boundary.
 *  4. HUMAN_ASSUMED requires a rationale.
 *  5. Every observation is associated with at least one subject
 *     (opportunity / geography / service).
 *  6. Reads distinguish latest-valid (freshness-aware) from history.
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { evidenceType } from "./schema";
import { assertValidObservation, isFresh, evidenceMix } from "../lib/evidence/validate";
import { requireMetric, METRICS } from "../lib/evidence/metrics";
import { EvidenceValidationError, type ObservationInput } from "../lib/evidence/types";

const observationArgs = {
  opportunityId: v.optional(v.id("opportunities")),
  geographyId: v.optional(v.id("geographies")),
  serviceId: v.optional(v.id("services")),
  metric: v.string(),
  value: v.union(v.number(), v.string()),
  rawValue: v.optional(v.union(v.number(), v.string())),
  source: v.string(),
  sourceUrl: v.optional(v.string()),
  evidenceType,
  confidence: v.number(),
  observedAt: v.number(),
  rationale: v.optional(v.string()),
  researchRunId: v.optional(v.id("researchRuns")),
  legacy: v.optional(v.boolean()),
};

/**
 * LEGACY SUPERSESSION RULE (V0 data must not become V2 truth by
 * inheritance): among a subject's observations of a metric, ANY
 * independently collected V2 observation (legacy !== true) beats ANY
 * legacy one regardless of timestamps; within the same class, newest
 * observedAt wins. Legacy evidence therefore only surfaces when V2 has
 * not yet independently measured/estimated the metric — and it surfaces
 * visibly flagged.
 */
function pickLatest(all: Doc<"observations">[]): Doc<"observations"> {
  const nonLegacy = all.filter((o) => o.legacy !== true);
  const pool = nonLegacy.length > 0 ? nonLegacy : all;
  return pool.reduce((a, b) => (b.observedAt > a.observedAt ? b : a));
}

type ObservationArgs = {
  opportunityId?: Id<"opportunities">;
  geographyId?: Id<"geographies">;
  serviceId?: Id<"services">;
  rawValue?: number | string;
  researchRunId?: Id<"researchRuns">;
  legacy?: boolean;
} & ObservationInput;

function validateForInsert(args: ObservationArgs, nowMs: number) {
  if (!args.opportunityId && !args.geographyId && !args.serviceId) {
    throw new EvidenceValidationError(
      "Observation must reference at least one subject (opportunity, geography, or service)",
      "NO_SUBJECT",
    );
  }
  return assertValidObservation(args, nowMs);
}

/** Record one observation. Throws EvidenceValidationError on any guarantee violation. */
export const record = mutation({
  args: observationArgs,
  handler: async (ctx, args) => {
    const now = Date.now();
    const metric = validateForInsert(args as ObservationArgs, now);
    return await ctx.db.insert("observations", {
      ...args,
      unit: metric.unit,
      recordedAt: now,
    });
  },
});

/** Record a batch atomically — all validate or none insert. */
export const recordBatch = mutation({
  args: { observations: v.array(v.object(observationArgs)) },
  handler: async (ctx, { observations }) => {
    const now = Date.now();
    const metrics = observations.map((o) =>
      validateForInsert(o as ObservationArgs, now),
    );
    const ids = [];
    for (let i = 0; i < observations.length; i++) {
      ids.push(
        await ctx.db.insert("observations", {
          ...observations[i]!,
          unit: metrics[i]!.unit,
          recordedAt: now,
        }),
      );
    }
    return ids;
  },
});

type SubjectArgs = {
  opportunityId?: Id<"opportunities">;
  geographyId?: Id<"geographies">;
  serviceId?: Id<"services">;
};

async function collectForSubjectMetric(
  ctx: { db: { query: (t: "observations") => any } },
  subject: SubjectArgs,
  metric: string,
): Promise<Doc<"observations">[]> {
  if (subject.opportunityId) {
    return await ctx.db
      .query("observations")
      .withIndex("by_opportunity_metric", (q: any) =>
        q.eq("opportunityId", subject.opportunityId).eq("metric", metric),
      )
      .collect();
  }
  if (subject.geographyId) {
    return await ctx.db
      .query("observations")
      .withIndex("by_geography_metric", (q: any) =>
        q.eq("geographyId", subject.geographyId).eq("metric", metric),
      )
      .collect();
  }
  if (subject.serviceId) {
    return await ctx.db
      .query("observations")
      .withIndex("by_service_metric", (q: any) =>
        q.eq("serviceId", subject.serviceId).eq("metric", metric),
      )
      .collect();
  }
  throw new Error("latest/history queries require a subject id");
}

const subjectArgs = {
  opportunityId: v.optional(v.id("opportunities")),
  geographyId: v.optional(v.id("geographies")),
  serviceId: v.optional(v.id("services")),
};

/**
 * Latest observation for a subject+metric, with freshness verdict.
 * Returns null when nothing recorded. `stale: true` means the value exists
 * but is past the registry's staleAfterDays for selection decisions.
 */
export const latestByMetric = query({
  args: { ...subjectArgs, metric: v.string(), asOf: v.optional(v.number()) },
  handler: async (ctx, { metric, asOf, ...subject }) => {
    const registry = requireMetric(metric); // unknown metric is a programming error, fail loudly
    const all = await collectForSubjectMetric(ctx, subject, metric);
    if (all.length === 0) return null;
    const latest = pickLatest(all);
    const asOfMs = asOf ?? Date.now();
    return {
      observation: latest,
      stale: !isFresh(latest.observedAt, registry, asOfMs),
      legacy: latest.legacy === true,
      observationCount: all.length,
    };
  },
});

/** Full history for a subject+metric (append-only trail), newest first. */
export const historyByMetric = query({
  args: { ...subjectArgs, metric: v.string() },
  handler: async (ctx, { metric, ...subject }) => {
    requireMetric(metric);
    const all = await collectForSubjectMetric(ctx, subject, metric);
    return all.sort((a, b) => b.observedAt - a.observedAt);
  },
});

/**
 * Evidence bag for a subject: latest observation per metric that has any,
 * plus staleness flags and the evidence-type mix. This is the exact input
 * shape the Phase-4 scoring engine will consume.
 */
export const evidenceBag = query({
  args: { ...subjectArgs, asOf: v.optional(v.number()) },
  handler: async (ctx, { asOf, ...subject }) => {
    const asOfMs = asOf ?? Date.now();
    const bag: Record<
      string,
      { observation: Doc<"observations">; stale: boolean; legacy: boolean }
    > = {};
    const latestPerMetric: Doc<"observations">[] = [];
    for (const m of METRICS) {
      const all = await collectForSubjectMetric(ctx, subject, m.id);
      if (all.length === 0) continue;
      const latest = pickLatest(all);
      bag[m.id] = {
        observation: latest,
        stale: !isFresh(latest.observedAt, m, asOfMs),
        legacy: latest.legacy === true,
      };
      latestPerMetric.push(latest);
    }
    return {
      metrics: bag,
      evidenceMix: evidenceMix(latestPerMetric),
      metricCount: latestPerMetric.length,
      staleCount: Object.values(bag).filter((e) => e.stale).length,
      legacyCount: Object.values(bag).filter((e) => e.legacy).length,
    };
  },
});
