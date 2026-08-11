/**
 * Google Trends collector — service-level 5-year demand weights and
 * seasonality (V0's anchor-rescaled batching preserved: Trends values are
 * only comparable within one call of ≤5 terms, so batches share an anchor
 * term and later batches rescale onto the first batch's scale).
 * No stage gate (service-level, a handful of calls total).
 */
import { action } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { api } from "../_generated/api";
import { trendsSeriesStats, trendsUrl } from "../../lib/providers/serpapi";
import { assertBudget } from "../../lib/research/guards";
import { EST_COST_USD } from "../../lib/config";

type FetchTrendsResult = {
  cached: boolean;
  runId?: Id<"researchRuns">;
  terms: number;
  batches?: number;
};

export const fetchTrends = action({
  args: { serviceIds: v.array(v.id("services")) },
  handler: async (ctx, { serviceIds }): Promise<FetchTrendsResult> => {
    const apiKey = process.env.SERPAPI_KEY;
    if (!apiKey) throw new Error("SERPAPI_KEY not configured");

    const services: { id: (typeof serviceIds)[number]; term: string }[] = [];
    for (const id of serviceIds) {
      const svc = await ctx.runQuery(api.subjects.getService, { id });
      if (!svc) throw new Error(`service ${id} not found`);
      if (svc.acPhrase) services.push({ id, term: svc.acPhrase });
    }
    if (services.length === 0) return { cached: false, terms: 0 };
    // (early return above precedes any spend)

    const terms = services.map((s) => s.term);
    const anchor = terms[0]!;
    const batches: string[][] = [terms.slice(0, 5)];
    for (let i = 5; i < terms.length; i += 4) batches.push([anchor, ...terms.slice(i, i + 4)]);

    const estCost = batches.length * EST_COST_USD.serpApiCall;
    assertBudget("trends", estCost, await ctx.runQuery(api.budget.remainingUsd, {}));

    const { runId, cached } = await ctx.runMutation(api.researchRuns.begin, {
      kind: "trends",
      paramsHash: `${terms.join(",")}|v1`,
      params: { terms },
      provider: "serpapi",
      estCostUsd: estCost,
      requestedBy: "human",
    });
    if (cached) return { cached: true, runId, terms: terms.length };

    try {
      const stats: Record<string, { mean: number; peakMean: number; peakMonths: string[] }> = {};
      for (const [bi, batch] of batches.entries()) {
        const res = await fetch(trendsUrl(batch, apiKey));
        if (!res.ok) throw new Error(`SerpAPI trends ${res.status}`);
        const data = await res.json();
        if (data.error) throw new Error(`SerpAPI trends: ${data.error}`);
        const timeline = data.interest_over_time?.timeline_data ?? [];
        if (bi === 0) {
          batch.forEach((term, i) => {
            stats[term] = trendsSeriesStats(timeline, i);
          });
        } else {
          const anchorHere = trendsSeriesStats(timeline, 0);
          const scale = anchorHere.mean > 0 ? stats[anchor]!.mean / anchorHere.mean : 1;
          batch.slice(1).forEach((term, i) => {
            const s = trendsSeriesStats(timeline, i + 1);
            stats[term] = {
              mean: Math.round(s.mean * scale * 10) / 10,
              peakMean: Math.round(s.peakMean * scale * 10) / 10,
              peakMonths: s.peakMonths,
            };
          });
        }
      }

      // V0 normalization preserved: 0.7–1.15 weight band across the compared set
      const maxMean = Math.max(...Object.values(stats).map((s) => s.mean), 1);
      const now = Date.now();
      const observations = [];
      for (const svc of services) {
        const s = stats[svc.term];
        if (!s) continue;
        observations.push({
          serviceId: svc.id,
          metric: "kw.trend.weight",
          value: Math.round((0.7 + (s.mean / maxMean) * 0.45) * 100) / 100,
          rawValue: s.mean,
          source: "serpapi:google_trends_5y_us",
          evidenceType: "DERIVED" as const,
          confidence: 0.75,
          observedAt: now,
          researchRunId: runId,
        });
        if (s.peakMonths.length) {
          observations.push({
            serviceId: svc.id,
            metric: "kw.seasonality.peakMonths",
            value: s.peakMonths.join(","),
            source: "serpapi:google_trends_5y_us",
            evidenceType: "DERIVED" as const,
            confidence: 0.75,
            observedAt: now,
            researchRunId: runId,
          });
        }
      }
      await ctx.runMutation(api.observations.recordBatch, { observations });
      await ctx.runMutation(api.researchRuns.complete, {
        runId,
        apiCalls: batches.length,
        actualCostUsd: estCost,
      });
      await ctx.runMutation(api.budget.charge, {
        researchRunId: runId,
        kind: "trends",
        provider: "serpapi",
        usd: estCost,
      });
      return { cached: false, runId, terms: terms.length, batches: batches.length };
    } catch (e) {
      await ctx.runMutation(api.researchRuns.fail, {
        runId,
        error: e instanceof Error ? e.message : String(e),
      });
      throw e;
    }
  },
});
