/**
 * Autocomplete collector — V0's demand-floor probe (stage-1 cheap screen).
 * Writes kw.autocomplete.floor + kw.autocomplete.cityHit observations.
 */
import { action } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { api } from "../_generated/api";
import {
  autocompleteUrl,
  parseAutocompleteResponse,
} from "../../lib/providers/serpapi";
import { assertBudget, assertStage } from "../../lib/research/guards";
import { EST_COST_USD } from "../../lib/config";

type AutocompleteResult2 = {
  cached: boolean;
  runId: Id<"researchRuns">;
  typed?: string;
  suggestions?: string[];
  cityHit?: boolean;
  floor?: number;
};

export const check = action({
  args: { opportunityId: v.id("opportunities") },
  handler: async (ctx, { opportunityId }): Promise<AutocompleteResult2> => {
    const apiKey = process.env.SERPAPI_KEY;
    if (!apiKey) throw new Error("SERPAPI_KEY not configured");

    const opp = await ctx.runQuery(api.subjects.getOpportunity, { id: opportunityId });
    if (!opp?.service || !opp.geography) throw new Error("opportunity not found");
    assertStage("autocomplete", opp.funnelStage);

    const estCost = EST_COST_USD.serpApiCall;
    assertBudget("autocomplete", estCost, await ctx.runQuery(api.budget.remainingUsd, {}));

    // V0 semantics: type the short phrase + first 4 letters of the city
    const phrase = opp.service.acPhrase ?? opp.service.name.toLowerCase();
    const typed = `${phrase} ${opp.geography.name.toLowerCase().slice(0, 4)}`;
    const { runId, cached } = await ctx.runMutation(api.researchRuns.begin, {
      kind: "autocomplete",
      paramsHash: `${typed}|v1`,
      params: { typed },
      provider: "serpapi",
      estCostUsd: estCost,
      requestedBy: "human",
    });
    if (cached) return { cached: true, runId };

    try {
      const res = await fetch(autocompleteUrl(typed, apiKey));
      if (!res.ok) throw new Error(`SerpAPI ${res.status}`);
      const result = parseAutocompleteResponse(
        await res.json(),
        typed,
        opp.geography.name,
      );

      const now = Date.now();
      await ctx.runMutation(api.observations.recordBatch, {
        observations: [
          {
            opportunityId,
            metric: "kw.autocomplete.floor",
            value: result.floor,
            source: "serpapi:google_autocomplete",
            evidenceType: "DERIVED",
            confidence: 0.7,
            observedAt: now,
            researchRunId: runId,
          },
          {
            opportunityId,
            metric: "kw.autocomplete.cityHit",
            value: String(result.cityHit),
            rawValue: result.suggestions.join(" | ").slice(0, 500),
            source: "serpapi:google_autocomplete",
            evidenceType: "OBSERVED",
            confidence: 0.9,
            observedAt: now,
            researchRunId: runId,
          },
        ],
      });
      await ctx.runMutation(api.researchRuns.complete, {
        runId,
        apiCalls: 1,
        actualCostUsd: estCost,
      });
      await ctx.runMutation(api.budget.charge, {
        researchRunId: runId,
        kind: "autocomplete",
        provider: "serpapi",
        usd: estCost,
      });
      return { cached: false, runId, ...result };
    } catch (e) {
      await ctx.runMutation(api.researchRuns.fail, {
        runId,
        error: e instanceof Error ? e.message : String(e),
      });
      throw e;
    }
  },
});
