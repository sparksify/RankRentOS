/**
 * Collector actions tested against an in-memory deployment with a stubbed
 * fetch — NO live API calls anywhere in this suite. Verifies stage gating,
 * budget gating, idempotency, snapshot storage, and observation writes.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { api } from "../../convex/_generated/api";
import { seedSubjects, testConvex } from "./helpers";
import { SIGNALS_VERSION } from "../../lib/serp/signals";

const FIX = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");
const weakSerp = readFileSync(join(FIX, "serpapi-weak-market.json"), "utf8");

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Route-based fetch stub: serpapi / dataforseo / rdap / competitor pages. */
function stubFetch(routes: {
  serpapi?: (url: URL) => Response;
  dataforseo?: () => Response;
  rdap?: (domain: string) => Response;
  page?: () => Response;
}) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      calls.push(url.hostname + url.pathname);
      if (url.hostname === "serpapi.com") return routes.serpapi!(url);
      if (url.hostname === "api.dataforseo.com") return routes.dataforseo!();
      if (url.hostname === "rdap.verisign.com") {
        return routes.rdap!(url.pathname.split("/").pop()!);
      }
      return (routes.page ?? (() => jsonResponse("<html><body>word ".repeat(300) + "</body></html>")))();
    }),
  );
  return calls;
}

beforeEach(() => {
  vi.stubEnv("SERPAPI_KEY", "test-key");
  vi.stubEnv("DATAFORSEO_AUTH", "test-auth");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function promotedOpportunity(t: ReturnType<typeof testConvex>, stage: number) {
  const ids = await seedSubjects(t);
  await t.mutation(api.subjects.setFunnelStage, {
    id: ids.opportunityId,
    stage,
    reason: "test-promotion",
  });
  return ids;
}

describe("stage gating — expensive research never runs early", () => {
  test("serp collector refuses a stage-0 opportunity", async () => {
    const t = testConvex();
    const { opportunityId } = await seedSubjects(t);
    stubFetch({ serpapi: () => jsonResponse(JSON.parse(weakSerp)) });
    await expect(
      t.action(api.research.serp.fetchSerp, { opportunityId }),
    ).rejects.toThrow(/stage gate: collector "serp" requires funnel stage >= 3/);
  });

  test("keywords collector refuses stage-1; autocomplete refuses stage-0", async () => {
    const t = testConvex();
    const { opportunityId } = await promotedOpportunity(t, 1);
    await expect(
      t.action(api.research.keywords.fetchVolumes, { opportunityIds: [opportunityId] }),
    ).rejects.toThrow(/stage gate/);
    const t2 = testConvex();
    const { opportunityId: o2 } = await seedSubjects(t2);
    await expect(
      t2.action(api.research.autocomplete.check, { opportunityId: o2 }),
    ).rejects.toThrow(/stage gate/);
  });
});

describe("budget gating", () => {
  test("collector refuses to spend past the remaining budget", async () => {
    const t = testConvex();
    const { opportunityId } = await promotedOpportunity(t, 3);
    // exhaust the budget via the ledger
    const { runId } = await t.mutation(api.researchRuns.begin, {
      kind: "setup",
      paramsHash: "exhaust",
      estCostUsd: 0,
      requestedBy: "human",
    });
    await t.mutation(api.budget.charge, {
      researchRunId: runId,
      kind: "setup",
      provider: "test",
      usd: 250,
    });
    expect(await t.query(api.budget.remainingUsd, {})).toBe(0);
    stubFetch({ serpapi: () => jsonResponse(JSON.parse(weakSerp)) });
    await expect(
      t.action(api.research.serp.fetchSerp, { opportunityId }),
    ).rejects.toThrow(/budget gate/);
  });
});

describe("serp collector", () => {
  test("stores snapshot with extracted signals, charges ledger, is idempotent", async () => {
    const t = testConvex();
    const { opportunityId } = await promotedOpportunity(t, 3);
    const calls = stubFetch({
      serpapi: () => jsonResponse(JSON.parse(weakSerp)),
      rdap: () =>
        jsonResponse({
          events: [{ eventAction: "registration", eventDate: "2023-01-01T00:00:00Z" }],
        }),
    });

    const r1 = await t.action(api.research.serp.fetchSerp, { opportunityId });
    expect(r1.cached).toBe(false);
    expect(r1.signals).toMatchObject({
      directoriesInTop3: 2,
      intentMismatchInTop5: 1,
      buyerProof: true,
      adCount: 2,
    });
    expect(r1.signals!.competitorAvgWords).toBeGreaterThan(200);
    expect(r1.signals!.competitorAvgDomainAgeYears).toBeGreaterThan(2);

    // snapshot persisted with version + run linkage
    const snapshots = await t.run(async (ctx) => ctx.db.query("serpSnapshots").collect());
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]!.signalsVersion).toBe(SIGNALS_VERSION);
    expect(snapshots[0]!.organic).toHaveLength(10);
    expect(snapshots[0]!.costUsd).toBeGreaterThan(0);

    // ledger charged once
    expect(await t.query(api.budget.spentUsd, {})).toBeCloseTo(0.015, 5);

    // idempotent: same params → cached, no second spend, no second snapshot
    const serpCallsBefore = calls.filter((c) => c.startsWith("serpapi.com")).length;
    const r2 = await t.action(api.research.serp.fetchSerp, { opportunityId });
    expect(r2.cached).toBe(true);
    expect(calls.filter((c) => c.startsWith("serpapi.com")).length).toBe(serpCallsBefore);
    expect(await t.query(api.budget.spentUsd, {})).toBeCloseTo(0.015, 5);
    expect(await t.run(async (ctx) => (await ctx.db.query("serpSnapshots").collect()).length)).toBe(1);
  });

  test("provider failure marks the run failed and rethrows", async () => {
    const t = testConvex();
    const { opportunityId } = await promotedOpportunity(t, 3);
    stubFetch({ serpapi: () => jsonResponse({ error: "rate limited" }) });
    await expect(
      t.action(api.research.serp.fetchSerp, { opportunityId }),
    ).rejects.toThrow(/rate limited/);
    const failed = await t.query(api.researchRuns.byStatus, { status: "failed" });
    expect(failed).toHaveLength(1);
  });
});

describe("autocomplete collector", () => {
  test("writes floor + cityHit observations (V0 semantics)", async () => {
    const t = testConvex();
    const { opportunityId } = await promotedOpportunity(t, 1);
    stubFetch({
      serpapi: () =>
        jsonResponse({ suggestions: [{ value: "epoxy flooring prosper tx" }] }),
    });
    const r = await t.action(api.research.autocomplete.check, { opportunityId });
    expect(r).toMatchObject({ cached: false, cityHit: true, floor: 1.0 });
    const floor = await t.query(api.observations.latestByMetric, {
      opportunityId,
      metric: "kw.autocomplete.floor",
    });
    expect(floor?.observation.value).toBe(1);
    expect(floor?.legacy).toBe(false);
    expect(floor?.observation.researchRunId).toBeTruthy();
  });
});

describe("keywords collector", () => {
  test("writes volume/cpc/competition observations; absent keyword → explicit zero", async () => {
    const t = testConvex();
    const { opportunityId } = await promotedOpportunity(t, 2);
    stubFetch({
      dataforseo: () =>
        jsonResponse({
          tasks: [
            {
              status_code: 20000,
              result: [
                {
                  keyword: "epoxy flooring prosper",
                  search_volume: 390,
                  cpc: 7.25,
                  competition: 0.42,
                },
              ],
            },
          ],
        }),
    });
    const r = await t.action(api.research.keywords.fetchVolumes, {
      opportunityIds: [opportunityId],
    });
    expect(r).toMatchObject({ cached: false, keywords: 1, observations: 3 });
    const vol = await t.query(api.observations.latestByMetric, {
      opportunityId,
      metric: "kw.volume.exact",
    });
    expect(vol?.observation.value).toBe(390);
    expect(vol?.observation.source).toBe("dataforseo:google_ads_search_volume");
  });
});

describe("domains collector", () => {
  test("RDAP availability → summary observations + deterministic pick", async () => {
    const t = testConvex();
    const { opportunityId } = await promotedOpportunity(t, 3);
    stubFetch({
      // every candidate available except the taken city-first primary
      rdap: (domain) =>
        domain === "prosperepoxyfloors.com"
          ? jsonResponse({}, 200)
          : jsonResponse({}, 404),
    });
    const r = await t.action(api.research.domains.checkDomains, { opportunityId });
    expect(r.cached).toBe(false);
    expect(r.available!.length).toBeGreaterThan(0);
    expect(r.available).not.toContain("prosperepoxyfloors.com");
    expect(r.pick?.domain).toBeTruthy();

    const count = await t.query(api.observations.latestByMetric, {
      opportunityId,
      metric: "domain.available.count",
    });
    expect(count?.observation.value).toBe(r.available!.length);
    const pick = await t.query(api.observations.latestByMetric, {
      opportunityId,
      metric: "domain.pick",
    });
    expect(pick?.observation.value).toBe(r.pick?.domain);
    // RDAP is free — no ledger charge
    expect(await t.query(api.budget.spentUsd, {})).toBe(0);
  }, 30_000);
});
