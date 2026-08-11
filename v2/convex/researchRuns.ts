/**
 * Research runs — collection provenance + idempotency + cost accounting.
 *
 * Every automated collector (Phase 2+) opens a run before touching an
 * external source and closes it with actuals; the observations it writes
 * reference the run. `begin` is idempotent on (kind, paramsHash): a run
 * that already completed is returned instead of re-executed, which is the
 * mechanism that prevents re-buying identical research.
 *
 * Runs are status-mutable BY DESIGN (queued → running → done|failed); they
 * are execution records, not evidence. Observations remain append-only.
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const begin = mutation({
  args: {
    kind: v.string(),
    paramsHash: v.string(),
    params: v.optional(v.any()),
    provider: v.optional(v.string()),
    estCostUsd: v.number(),
    requestedBy: v.union(
      v.literal("funnel"),
      v.literal("human"),
      v.literal("import"),
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("researchRuns")
      .withIndex("by_kind_paramsHash", (q) =>
        q.eq("kind", args.kind).eq("paramsHash", args.paramsHash),
      )
      .collect();
    const done = existing.find((r) => r.status === "done");
    if (done) return { runId: done._id, cached: true };
    const inFlight = existing.find(
      (r) => r.status === "queued" || r.status === "running",
    );
    if (inFlight) return { runId: inFlight._id, cached: true };
    const runId = await ctx.db.insert("researchRuns", {
      kind: args.kind,
      paramsHash: args.paramsHash,
      params: args.params,
      provider: args.provider,
      status: "running",
      startedAt: Date.now(),
      apiCalls: 0,
      estCostUsd: args.estCostUsd,
      requestedBy: args.requestedBy,
    });
    return { runId, cached: false };
  },
});

export const complete = mutation({
  args: {
    runId: v.id("researchRuns"),
    apiCalls: v.number(),
    actualCostUsd: v.number(),
  },
  handler: async (ctx, { runId, apiCalls, actualCostUsd }) => {
    const run = await ctx.db.get(runId);
    if (!run) throw new Error("researchRun not found");
    if (run.status === "done") throw new Error("researchRun already completed");
    await ctx.db.patch(runId, {
      status: "done",
      finishedAt: Date.now(),
      apiCalls,
      actualCostUsd,
    });
  },
});

export const fail = mutation({
  args: { runId: v.id("researchRuns"), error: v.string() },
  handler: async (ctx, { runId, error }) => {
    const run = await ctx.db.get(runId);
    if (!run) throw new Error("researchRun not found");
    await ctx.db.patch(runId, {
      status: "failed",
      finishedAt: Date.now(),
      error,
    });
  },
});

export const byStatus = query({
  args: {
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("done"),
      v.literal("failed"),
    ),
  },
  handler: async (ctx, { status }) => {
    return await ctx.db
      .query("researchRuns")
      .withIndex("by_status", (q) => q.eq("status", status))
      .collect();
  },
});

/** Total research spend so far (actuals where known, else estimates). */
export const totalSpendUsd = query({
  args: {},
  handler: async (ctx) => {
    const runs = await ctx.db.query("researchRuns").collect();
    let total = 0;
    for (const r of runs) {
      if (r.status === "failed") continue;
      total += r.actualCostUsd ?? (r.status === "done" ? r.estCostUsd : 0);
    }
    return Math.round(total * 100) / 100;
  },
});
