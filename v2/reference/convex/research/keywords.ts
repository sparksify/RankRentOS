/**
 * Keyword volume/CPC collector — DataForSEO Google Ads search volume for a
 * batch of opportunities (stage-2 qualification). One API request covers up
 * to 1,000 keywords; absent keywords are recorded as explicit zeros.
 */
import { action } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { api } from "../_generated/api";
import {
  parseVolumeResponse,
  volumeRequest,
} from "../../lib/providers/dataforseo";
import { assertBudget, assertStage } from "../../lib/research/guards";
import { EST_COST_USD } from "../../lib/config";

type FetchVolumesResult = {
  cached: boolean;
  runId?: Id<"researchRuns">;
  keywords: number;
  observations?: number;
};

export const fetchVolumes = action({
  args: { opportunityIds: v.array(v.id("opportunities")) },
  handler: async (ctx, { opportunityIds }): Promise<FetchVolumesResult> => {
    const auth = process.env.DATAFORSEO_AUTH;
    if (!auth) throw new Error("DATAFORSEO_AUTH not configured");
    if (opportunityIds.length === 0) return { cached: false, keywords: 0 };
    // (early return above precedes any spend)
    if (opportunityIds.length > 1000) throw new Error("max 1000 keywords per batch");

    const opps = [];
    for (const id of opportunityIds) {
      const opp = await ctx.runQuery(api.subjects.getOpportunity, { id });
      if (!opp?.service || !opp.geography) throw new Error(`opportunity ${id} not found`);
      assertStage("keywords", opp.funnelStage);
      const phrase = opp.service.acPhrase ?? opp.service.name.toLowerCase();
      opps.push({ id, keyword: `${phrase} ${opp.geography.name.toLowerCase()}` });
    }

    const estCost = EST_COST_USD.dataForSeoVolumeBatch;
    assertBudget("keywords", estCost, await ctx.runQuery(api.budget.remainingUsd, {}));

    const keywords = [...new Set(opps.map((o) => o.keyword))].sort();
    const { runId, cached } = await ctx.runMutation(api.researchRuns.begin, {
      kind: "keywords",
      paramsHash: `${keywords.join(",").slice(0, 900)}|${keywords.length}|v1`,
      params: { keywordCount: keywords.length },
      provider: "dataforseo",
      estCostUsd: estCost,
      requestedBy: "human",
    });
    if (cached) return { cached: true, runId, keywords: keywords.length };

    try {
      const req = volumeRequest(keywords);
      const res = await fetch(req.url, {
        method: "POST",
        headers: {
          authorization: `Basic ${auth}`,
          "content-type": "application/json",
        },
        body: req.body,
      });
      if (!res.ok) throw new Error(`DataForSEO ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const volumes = parseVolumeResponse(await res.json(), keywords);
      const byKeyword = new Map(volumes.map((v_) => [v_.keyword, v_]));

      const now = Date.now();
      const observations = [];
      for (const o of opps) {
        const kv = byKeyword.get(o.keyword);
        if (!kv) continue;
        observations.push({
          opportunityId: o.id,
          metric: "kw.volume.exact",
          value: kv.vol,
          source: "dataforseo:google_ads_search_volume",
          evidenceType: "OBSERVED" as const,
          confidence: 0.85,
          observedAt: now,
          researchRunId: runId,
        });
        if (kv.cpc !== null) {
          observations.push({
            opportunityId: o.id,
            metric: "kw.cpc",
            value: kv.cpc,
            source: "dataforseo:google_ads_search_volume",
            evidenceType: "OBSERVED" as const,
            confidence: 0.85,
            observedAt: now,
            researchRunId: runId,
          });
        }
        if (kv.competition !== null) {
          observations.push({
            opportunityId: o.id,
            metric:
              typeof kv.competition === "number"
                ? "kw.competition.index"
                : "kw.competition.class",
            value: kv.competition,
            source: "dataforseo:google_ads_search_volume",
            evidenceType: "OBSERVED" as const,
            confidence: 0.85,
            observedAt: now,
            researchRunId: runId,
          });
        }
      }
      await ctx.runMutation(api.observations.recordBatch, { observations });
      await ctx.runMutation(api.researchRuns.complete, {
        runId,
        apiCalls: 1,
        actualCostUsd: estCost,
      });
      await ctx.runMutation(api.budget.charge, {
        researchRunId: runId,
        kind: "keywords",
        provider: "dataforseo",
        usd: estCost,
      });
      return { cached: false, runId, keywords: keywords.length, observations: observations.length };
    } catch (e) {
      await ctx.runMutation(api.researchRuns.fail, {
        runId,
        error: e instanceof Error ? e.message : String(e),
      });
      throw e;
    }
  },
});
