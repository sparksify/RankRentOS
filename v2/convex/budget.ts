/**
 * Budget ledger — append-only research-spend accounting.
 *
 * Every collector charges actual spend here when its run completes; the
 * remaining-budget query is the gate collectors consult BEFORE spending.
 * The cap lives in lib/config.ts until scoringModels (Phase 4).
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { TOTAL_RESEARCH_BUDGET_USD } from "../lib/config";

export const charge = mutation({
  args: {
    researchRunId: v.id("researchRuns"),
    kind: v.string(),
    provider: v.string(),
    usd: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.usd < 0) throw new Error("negative charge");
    await ctx.db.insert("budgetLedger", { ...args, at: Date.now() });
  },
});

export const spentUsd = query({
  args: {},
  handler: async (ctx) => {
    const entries = await ctx.db.query("budgetLedger").collect();
    const total = entries.reduce((s, e) => s + e.usd, 0);
    return Math.round(total * 10000) / 10000;
  },
});

export const remainingUsd = query({
  args: {},
  handler: async (ctx) => {
    const entries = await ctx.db.query("budgetLedger").collect();
    const total = entries.reduce((s, e) => s + e.usd, 0);
    return Math.max(0, Math.round((TOTAL_RESEARCH_BUDGET_USD - total) * 10000) / 10000);
  },
});
