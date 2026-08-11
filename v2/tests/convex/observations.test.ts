import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { seedSubjects, testConvex } from "./helpers";
import * as observationsModule from "../../convex/observations";

const DAY = 24 * 60 * 60 * 1000;

function observed(overrides: Record<string, unknown> = {}) {
  return {
    metric: "kw.volume.exact",
    value: 320,
    source: "dataforseo",
    evidenceType: "OBSERVED" as const,
    confidence: 0.9,
    observedAt: Date.now() - 1000,
    ...overrides,
  };
}

describe("append-only guarantee", () => {
  test("the observations module exposes no update or delete functions", () => {
    const names = Object.keys(observationsModule).map((n) => n.toLowerCase());
    for (const forbidden of ["update", "patch", "delete", "remove", "replace", "overwrite"]) {
      expect(names.some((n) => n.includes(forbidden)), `found ${forbidden}-like export`).toBe(false);
    }
    // and the exports we rely on exist
    expect(Object.keys(observationsModule)).toEqual(
      expect.arrayContaining(["record", "recordBatch", "latestByMetric", "historyByMetric", "evidenceBag"]),
    );
  });

  test("newer knowledge appends; history preserves both", async () => {
    const t = testConvex();
    const { opportunityId } = await seedSubjects(t);
    await t.mutation(api.observations.record, {
      ...observed({ value: 300, observedAt: Date.now() - 10 * DAY }),
      opportunityId,
    });
    await t.mutation(api.observations.record, {
      ...observed({ value: 390, observedAt: Date.now() - 1 * DAY }),
      opportunityId,
    });
    const history = await t.query(api.observations.historyByMetric, {
      opportunityId,
      metric: "kw.volume.exact",
    });
    expect(history).toHaveLength(2);
    expect(history[0]!.value).toBe(390); // newest first
    expect(history[1]!.value).toBe(300); // older observation intact
  });
});

describe("write-boundary enforcement", () => {
  test("valid observation inserts with denormalized unit and recordedAt", async () => {
    const t = testConvex();
    const { opportunityId } = await seedSubjects(t);
    await t.mutation(api.observations.record, { ...observed(), opportunityId });
    const latest = await t.query(api.observations.latestByMetric, {
      opportunityId,
      metric: "kw.volume.exact",
    });
    expect(latest?.observation.value).toBe(320);
    expect(latest?.observation.unit).toBe("searches/mo");
    expect(latest?.observation.recordedAt).toBeGreaterThan(0);
    expect(latest?.stale).toBe(false);
  });

  test("unknown metric is rejected", async () => {
    const t = testConvex();
    const { opportunityId } = await seedSubjects(t);
    await expect(
      t.mutation(api.observations.record, {
        ...observed({ metric: "made.up.metric" }),
        opportunityId,
      }),
    ).rejects.toThrow(/Unknown metric/);
  });

  test("subjectless observation is rejected", async () => {
    const t = testConvex();
    await seedSubjects(t);
    await expect(
      t.mutation(api.observations.record, observed()),
    ).rejects.toThrow(/at least one subject/);
  });

  test("AI citation guard holds at the mutation boundary", async () => {
    const t = testConvex();
    const { serviceId } = await seedSubjects(t);
    const ai = {
      metric: "econ.ticket.avg",
      value: 4500,
      source: "ai:research",
      evidenceType: "AI_ESTIMATED" as const,
      confidence: 0.5,
      observedAt: Date.now() - 1000,
      serviceId,
    };
    await expect(t.mutation(api.observations.record, ai)).rejects.toThrow(
      /citation sourceUrl/,
    );
    // with a citation it lands
    await t.mutation(api.observations.record, {
      ...ai,
      sourceUrl: "https://homeguide.com/costs/epoxy-floor",
    });
    const latest = await t.query(api.observations.latestByMetric, {
      serviceId,
      metric: "econ.ticket.avg",
    });
    expect(latest?.observation.evidenceType).toBe("AI_ESTIMATED");
    expect(latest?.observation.sourceUrl).toMatch(/^https:/);
  });

  test("metric-level evidence-type policy: OBSERVED-only metrics reject AI estimates even with citation", async () => {
    const t = testConvex();
    const { opportunityId } = await seedSubjects(t);
    await expect(
      t.mutation(api.observations.record, {
        ...observed({
          evidenceType: "AI_ESTIMATED",
          sourceUrl: "https://example.com",
        }),
        opportunityId,
      }),
    ).rejects.toThrow(/does not accept evidence type AI_ESTIMATED/);
  });

  test("batch is atomic: one invalid row rejects the whole batch", async () => {
    const t = testConvex();
    const { opportunityId } = await seedSubjects(t);
    await expect(
      t.mutation(api.observations.recordBatch, {
        observations: [
          { ...observed(), opportunityId },
          { ...observed({ metric: "bogus.metric" }), opportunityId },
        ],
      }),
    ).rejects.toThrow(/Unknown metric/);
    const history = await t.query(api.observations.historyByMetric, {
      opportunityId,
      metric: "kw.volume.exact",
    });
    expect(history).toHaveLength(0); // nothing from the failed batch landed
  });
});

describe("latest-valid-evidence queries", () => {
  test("latestByMetric returns newest by observedAt and flags staleness", async () => {
    const t = testConvex();
    const { opportunityId } = await seedSubjects(t);
    const old = Date.now() - 120 * DAY; // beyond kw.volume.exact's 90-day horizon
    await t.mutation(api.observations.record, {
      ...observed({ value: 111, observedAt: old }),
      opportunityId,
    });
    const stale = await t.query(api.observations.latestByMetric, {
      opportunityId,
      metric: "kw.volume.exact",
    });
    expect(stale?.observation.value).toBe(111);
    expect(stale?.stale).toBe(true);

    await t.mutation(api.observations.record, {
      ...observed({ value: 222, observedAt: Date.now() - 1 * DAY }),
      opportunityId,
    });
    const fresh = await t.query(api.observations.latestByMetric, {
      opportunityId,
      metric: "kw.volume.exact",
    });
    expect(fresh?.observation.value).toBe(222);
    expect(fresh?.stale).toBe(false);
    expect(fresh?.observationCount).toBe(2);
  });

  test("asOf makes freshness reproducible at a point in time", async () => {
    const t = testConvex();
    const { opportunityId } = await seedSubjects(t);
    const observedAt = Date.now() - 10 * DAY;
    await t.mutation(api.observations.record, {
      ...observed({ observedAt }),
      opportunityId,
    });
    const then = await t.query(api.observations.latestByMetric, {
      opportunityId,
      metric: "kw.volume.exact",
      asOf: observedAt + 1 * DAY,
    });
    const farFuture = await t.query(api.observations.latestByMetric, {
      opportunityId,
      metric: "kw.volume.exact",
      asOf: observedAt + 200 * DAY,
    });
    expect(then?.stale).toBe(false);
    expect(farFuture?.stale).toBe(true);
  });

  test("evidenceBag returns latest per metric with evidence mix and stale count", async () => {
    const t = testConvex();
    const { opportunityId, serviceId } = await seedSubjects(t);
    await t.mutation(api.observations.recordBatch, {
      observations: [
        { ...observed({ value: 320 }), opportunityId },
        {
          metric: "kw.cpc",
          value: 6.5,
          source: "dataforseo",
          evidenceType: "OBSERVED" as const,
          confidence: 0.9,
          observedAt: Date.now() - 120 * DAY, // stale
          opportunityId,
        },
        {
          metric: "econ.margin.gross",
          value: 0.5,
          source: "human:steve",
          evidenceType: "HUMAN_ASSUMED" as const,
          confidence: 0.4,
          observedAt: Date.now() - 1000,
          rationale: "v0 niche seed",
          opportunityId,
        },
      ],
    });
    const bag = await t.query(api.observations.evidenceBag, { opportunityId });
    expect(bag.metricCount).toBe(3);
    expect(bag.metrics["kw.volume.exact"]?.observation.value).toBe(320);
    expect(bag.metrics["kw.cpc"]?.stale).toBe(true);
    expect(bag.staleCount).toBe(1);
    expect(bag.evidenceMix).toEqual({
      OBSERVED: 2,
      DERIVED: 0,
      AI_ESTIMATED: 0,
      HUMAN_ASSUMED: 1,
    });
    // subject scoping: the service has no observations of its own here
    const serviceBag = await t.query(api.observations.evidenceBag, { serviceId });
    expect(serviceBag.metricCount).toBe(0);
  });
});
