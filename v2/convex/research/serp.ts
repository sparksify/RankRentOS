/**
 * SERP collector — SerpAPI Google SERP for an opportunity's primary keyword,
 * plus free enrichment (content-depth crawl of top organic, competitor
 * domain ages via RDAP). Stores a serpSnapshot with deterministically
 * extracted signals. Stage-3 gated; budget-gated; idempotent per
 * (keyword, location, variant).
 *
 * Runs in Convex's default runtime (fetch is available; no Node builtins).
 */
import { action, mutation } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { api } from "../_generated/api";
import { parseSerpResponse, serpUrl } from "../../lib/providers/serpapi";
import { rdapUrl, registrationAgeYears } from "../../lib/providers/rdap";
import { contentDepth } from "../../lib/crawl/contentDepth";
import {
  SIGNALS_VERSION,
  competitorHosts,
  extractSignals,
  type SerpSignals,
} from "../../lib/serp/signals";
import { serpLocation } from "../../lib/geo/states";
import { assertBudget, assertStage } from "../../lib/research/guards";
import { EST_COST_USD } from "../../lib/config";

export const saveSnapshot = mutation({
  args: {
    opportunityId: v.id("opportunities"),
    keyword: v.string(),
    location: v.string(),
    variant: v.optional(v.string()),
    organic: v.any(),
    localPack: v.any(),
    ads: v.any(),
    signals: v.any(),
    researchRunId: v.id("researchRuns"),
    costUsd: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("serpSnapshots", {
      ...args,
      engine: "google",
      fetchedAt: Date.now(),
      signalsVersion: SIGNALS_VERSION,
    });
  },
});

type FetchSerpResult = {
  cached: boolean;
  runId: Id<"researchRuns">;
  snapshotId?: Id<"serpSnapshots">;
  signals?: SerpSignals;
};

export const fetchSerp = action({
  args: {
    opportunityId: v.id("opportunities"),
    variant: v.optional(v.string()),
  },
  handler: async (ctx, { opportunityId, variant }): Promise<FetchSerpResult> => {
    const apiKey = process.env.SERPAPI_KEY;
    if (!apiKey) throw new Error("SERPAPI_KEY not configured");

    const opp = await ctx.runQuery(api.subjects.getOpportunity, { id: opportunityId });
    if (!opp?.service || !opp.geography) throw new Error("opportunity not found");
    assertStage("serp", opp.funnelStage);

    // 1 SERP call + free enrichment
    const estCost = EST_COST_USD.serpApiCall;
    assertBudget("serp", estCost, await ctx.runQuery(api.budget.remainingUsd, {}));

    const query = variant ?? `${opp.service.queryPhrase ?? opp.service.name} ${opp.geography.name} ${opp.geography.state}`;
    const location = serpLocation(opp.geography.name, opp.geography.state);
    const { runId, cached } = await ctx.runMutation(api.researchRuns.begin, {
      kind: "serp",
      paramsHash: `${query}|${location}|v1`,
      params: { query, location, variant: variant ?? null },
      provider: "serpapi",
      estCostUsd: estCost,
      requestedBy: "human",
    });
    if (cached) return { cached: true, runId };

    try {
      const res = await fetch(serpUrl(query, location, apiKey));
      if (!res.ok) throw new Error(`SerpAPI ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const trimmed = parseSerpResponse(await res.json());

      // free enrichment: content depth of top organic + competitor domain age
      const links = trimmed.organic.slice(0, 5).map((o) => o.link ?? "").filter(Boolean);
      const depth = await contentDepth(links, fetch);
      const ages: number[] = [];
      for (const host of competitorHosts(trimmed)) {
        try {
          const r = await fetch(rdapUrl(host), { headers: { accept: "application/rdap+json" } });
          if (r.ok) {
            const age = registrationAgeYears(await r.json(), Date.now());
            if (age !== null) ages.push(age);
          }
        } catch {
          /* non-fatal */
        }
      }

      const signals = extractSignals(trimmed, opp.geography.name, {
        competitorAvgWords: depth.avgWords,
        competitorDomainAgesYears: ages,
      });

      const snapshotId = await ctx.runMutation(api.research.serp.saveSnapshot, {
        opportunityId,
        keyword: query,
        location,
        variant,
        organic: trimmed.organic.map((o) => ({
          position: o.position,
          title: o.title,
          link: o.link,
          snippet: o.snippet,
        })),
        localPack: trimmed.localPack,
        ads: trimmed.ads.map((a) => ({
          title: a.title,
          link: a.link,
          displayedLink: a.displayedLink,
        })),
        signals,
        researchRunId: runId,
        costUsd: estCost,
      });

      await ctx.runMutation(api.researchRuns.complete, {
        runId,
        apiCalls: 1,
        actualCostUsd: estCost,
      });
      await ctx.runMutation(api.budget.charge, {
        researchRunId: runId,
        kind: "serp",
        provider: "serpapi",
        usd: estCost,
      });
      return { cached: false, runId, snapshotId, signals };
    } catch (e) {
      await ctx.runMutation(api.researchRuns.fail, {
        runId,
        error: e instanceof Error ? e.message : String(e),
      });
      throw e;
    }
  },
});
