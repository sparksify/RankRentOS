import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { seedSubjects, testConvex } from "./helpers";

describe("researchRuns provenance + idempotency", () => {
  test("begin → complete lifecycle with cost actuals", async () => {
    const t = testConvex();
    const { runId, cached } = await t.mutation(api.researchRuns.begin, {
      kind: "import:v0",
      paramsHash: "volumes-2026-07",
      estCostUsd: 0,
      requestedBy: "import",
    });
    expect(cached).toBe(false);
    await t.mutation(api.researchRuns.complete, {
      runId,
      apiCalls: 0,
      actualCostUsd: 0,
    });
    const done = await t.query(api.researchRuns.byStatus, { status: "done" });
    expect(done).toHaveLength(1);
  });

  test("idempotency: identical (kind, paramsHash) returns the existing run instead of creating another", async () => {
    const t = testConvex();
    const first = await t.mutation(api.researchRuns.begin, {
      kind: "serp",
      paramsHash: "epoxy-prosper-v1",
      estCostUsd: 0.02,
      requestedBy: "funnel",
    });
    const second = await t.mutation(api.researchRuns.begin, {
      kind: "serp",
      paramsHash: "epoxy-prosper-v1",
      estCostUsd: 0.02,
      requestedBy: "funnel",
    });
    expect(second.cached).toBe(true);
    expect(second.runId).toBe(first.runId);
    // different params → new run
    const third = await t.mutation(api.researchRuns.begin, {
      kind: "serp",
      paramsHash: "epoxy-celina-v1",
      estCostUsd: 0.02,
      requestedBy: "funnel",
    });
    expect(third.cached).toBe(false);
  });

  test("completed run stays cached; double-complete rejected; failure recorded", async () => {
    const t = testConvex();
    const { runId } = await t.mutation(api.researchRuns.begin, {
      kind: "keywords",
      paramsHash: "batch-1",
      estCostUsd: 0.05,
      requestedBy: "funnel",
    });
    await t.mutation(api.researchRuns.complete, {
      runId,
      apiCalls: 3,
      actualCostUsd: 0.04,
    });
    await expect(
      t.mutation(api.researchRuns.complete, { runId, apiCalls: 3, actualCostUsd: 0.04 }),
    ).rejects.toThrow(/already completed/);
    const again = await t.mutation(api.researchRuns.begin, {
      kind: "keywords",
      paramsHash: "batch-1",
      estCostUsd: 0.05,
      requestedBy: "funnel",
    });
    expect(again.cached).toBe(true);

    const { runId: failing } = await t.mutation(api.researchRuns.begin, {
      kind: "keywords",
      paramsHash: "batch-2",
      estCostUsd: 0.05,
      requestedBy: "funnel",
    });
    await t.mutation(api.researchRuns.fail, { runId: failing, error: "429 quota" });
    const failed = await t.query(api.researchRuns.byStatus, { status: "failed" });
    expect(failed).toHaveLength(1);
    expect(failed[0]!.error).toContain("429");
  });

  test("observations link back to their research run; spend totals use actuals", async () => {
    const t = testConvex();
    const { opportunityId } = await seedSubjects(t);
    const { runId } = await t.mutation(api.researchRuns.begin, {
      kind: "keywords",
      paramsHash: "vol-batch",
      estCostUsd: 0.1,
      requestedBy: "funnel",
    });
    await t.mutation(api.observations.record, {
      opportunityId,
      metric: "kw.volume.exact",
      value: 480,
      source: "dataforseo",
      evidenceType: "OBSERVED",
      confidence: 0.9,
      observedAt: Date.now() - 1000,
      researchRunId: runId,
    });
    await t.mutation(api.researchRuns.complete, {
      runId,
      apiCalls: 1,
      actualCostUsd: 0.07,
    });
    const latest = await t.query(api.observations.latestByMetric, {
      opportunityId,
      metric: "kw.volume.exact",
    });
    expect(latest?.observation.researchRunId).toBe(runId);
    expect(await t.query(api.researchRuns.totalSpendUsd, {})).toBe(0.07);
  });
});

describe("subject spine", () => {
  test("upserts are idempotent by slug / service×geography", async () => {
    const t = testConvex();
    const a = await seedSubjects(t);
    const again = await t.mutation(api.subjects.createService, {
      name: "Epoxy Garage Floors",
      slug: "epoxy-garage-floors",
      synonyms: [],
      discoveryType: "SEED",
    });
    expect(again.created).toBe(false);
    expect(again.id).toBe(a.serviceId);
    const opp = await t.mutation(api.subjects.createOpportunity, {
      serviceId: a.serviceId,
      geographyId: a.geographyId,
      type: "general",
      discoveryType: "SEED",
      primaryKeyword: "epoxy flooring prosper",
    });
    expect(opp.created).toBe(false);
  });

  test("community geographies require a parent city", async () => {
    const t = testConvex();
    await expect(
      t.mutation(api.subjects.createGeography, {
        kind: "community",
        name: "Windsong Ranch",
        state: "TX",
        slug: "windsong-ranch-tx",
        discoveryType: "COMMUNITY_DISCOVERY",
      }),
    ).rejects.toThrow(/parentGeographyId/);
  });

  test("opportunities start at funnel stage 0 with discovery provenance", async () => {
    const t = testConvex();
    const { opportunityId } = await seedSubjects(t);
    const opp = await t.query(api.subjects.getOpportunity, { id: opportunityId });
    expect(opp?.funnelStage).toBe(0);
    expect(opp?.status).toBe("active");
    expect(opp?.stageHistory[0]!.reason).toBe("discovered:SEED");
    expect(opp?.service?.slug).toBe("epoxy-garage-floors");
    expect(opp?.geography?.slug).toBe("prosper-tx");
  });
});
