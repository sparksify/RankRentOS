/**
 * Domain availability collector — RDAP-only (free, definitive for .com).
 * V0's DNS pre-filter is dropped (an optimization RDAP doesn't need; Node
 * dns is unavailable in the default Convex runtime).
 *
 * Records summary observations (count / exact-match / pick); the per-domain
 * domainCandidates table arrives with the dedicated domain-research phase.
 * Stage-3 gated. Detail is returned to the caller for display.
 */
import { action } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { api } from "../_generated/api";
import {
  domainCandidates,
  pickWinner,
  slugCity,
  type DomainPick,
} from "../../lib/domains/candidates";
import {
  parseRdapAvailability,
  rdapUrl,
  type RdapAvailability,
} from "../../lib/providers/rdap";
import { assertStage } from "../../lib/research/guards";

type CheckDomainsResult = {
  cached: boolean;
  runId: Id<"researchRuns">;
  candidates?: RdapAvailability[];
  available?: string[];
  pick?: DomainPick | null;
};

export const checkDomains = action({
  args: { opportunityId: v.id("opportunities") },
  handler: async (ctx, { opportunityId }): Promise<CheckDomainsResult> => {
    const opp = await ctx.runQuery(api.subjects.getOpportunity, { id: opportunityId });
    if (!opp?.service || !opp.geography) throw new Error("opportunity not found");
    assertStage("domains", opp.funnelStage);
    const terms = opp.service.domainTerms ?? [];
    if (terms.length === 0) throw new Error("service has no domainTerms configured");

    const candidates = domainCandidates(terms, opp.geography.name);
    const { runId, cached } = await ctx.runMutation(api.researchRuns.begin, {
      kind: "domains",
      paramsHash: `${candidates.join(",")}|v1`,
      params: { candidates },
      provider: "rdap",
      estCostUsd: 0, // RDAP is free
      requestedBy: "human",
    });
    if (cached) return { cached: true, runId };

    try {
      const results = [];
      for (const domain of candidates) {
        try {
          const res = await fetch(rdapUrl(domain), {
            headers: { accept: "application/rdap+json" },
          });
          results.push(parseRdapAvailability(domain, res.status));
        } catch (e) {
          results.push({ domain, available: null, via: `error:${String(e).slice(0, 40)}` });
        }
        await new Promise((r) => setTimeout(r, 120)); // be polite to RDAP
      }
      const available = results.filter((r) => r.available === true).map((r) => r.domain);
      const cityPrefix = slugCity(opp.geography.name);
      const exactMatchAvailable = available.some((d) => d.startsWith(cityPrefix));
      const pick = pickWinner(available, terms, opp.geography.name);

      const now = Date.now();
      const observations: any[] = [
        {
          opportunityId,
          metric: "domain.available.count",
          value: available.length,
          rawValue: available.join(",").slice(0, 500),
          source: "rdap:verisign",
          evidenceType: "OBSERVED" as const,
          confidence: 0.95,
          observedAt: now,
          researchRunId: runId,
        },
        {
          opportunityId,
          metric: "domain.exactMatch.available",
          value: String(exactMatchAvailable),
          source: "rdap:verisign",
          evidenceType: "DERIVED" as const,
          confidence: 0.95,
          observedAt: now,
          researchRunId: runId,
        },
      ];
      if (pick) {
        observations.push({
          opportunityId,
          metric: "domain.pick",
          value: pick.domain,
          rawValue: pick.why.slice(0, 500),
          source: "rdap:verisign",
          evidenceType: "DERIVED" as const,
          confidence: 0.9,
          observedAt: now,
          researchRunId: runId,
        });
      }
      await ctx.runMutation(api.observations.recordBatch, { observations });
      await ctx.runMutation(api.researchRuns.complete, {
        runId,
        apiCalls: candidates.length,
        actualCostUsd: 0,
      });
      return { cached: false, runId, candidates: results, available, pick };
    } catch (e) {
      await ctx.runMutation(api.researchRuns.fail, {
        runId,
        error: e instanceof Error ? e.message : String(e),
      });
      throw e;
    }
  },
});
