import { describe, expect, test } from "vitest";
import {
  assertValidObservation,
  evidenceMix,
  isFresh,
} from "../../lib/evidence/validate";
import { requireMetric } from "../../lib/evidence/metrics";
import type { ObservationInput } from "../../lib/evidence/types";

const NOW = 1_760_000_000_000;
const base: ObservationInput = {
  metric: "kw.volume.exact",
  value: 320,
  source: "dataforseo",
  evidenceType: "OBSERVED",
  confidence: 0.9,
  observedAt: NOW - 1000,
};

describe("assertValidObservation", () => {
  test("accepts a valid observed metric", () => {
    expect(assertValidObservation(base, NOW).id).toBe("kw.volume.exact");
  });

  test("rejects unknown metrics", () => {
    expect(() =>
      assertValidObservation({ ...base, metric: "made.up" }, NOW),
    ).toThrowError(/Unknown metric/);
  });

  test("rejects wrong value kind", () => {
    expect(() =>
      assertValidObservation({ ...base, value: "lots" }, NOW),
    ).toThrowError(/expects a number/);
  });

  test("rejects evidence types the metric does not allow", () => {
    // kw.volume.exact is OBSERVED-only: an AI may never estimate it
    expect(() =>
      assertValidObservation(
        {
          ...base,
          evidenceType: "AI_ESTIMATED",
          sourceUrl: "https://example.com/report",
        },
        NOW,
      ),
    ).toThrowError(/does not accept evidence type AI_ESTIMATED/);
  });

  test("AI citation guard: AI_ESTIMATED without http(s) sourceUrl is rejected", () => {
    const ai: ObservationInput = {
      metric: "econ.ticket.avg",
      value: 4500,
      source: "ai:research",
      evidenceType: "AI_ESTIMATED",
      confidence: 0.5,
      observedAt: NOW - 1000,
    };
    expect(() => assertValidObservation(ai, NOW)).toThrowError(
      /requires a citation sourceUrl/,
    );
    expect(() =>
      assertValidObservation({ ...ai, sourceUrl: "not a url" }, NOW),
    ).toThrowError(/requires a citation sourceUrl/);
    expect(
      assertValidObservation(
        { ...ai, sourceUrl: "https://homeguide.com/costs/epoxy" },
        NOW,
      ).id,
    ).toBe("econ.ticket.avg");
  });

  test("HUMAN_ASSUMED requires a rationale", () => {
    const human: ObservationInput = {
      metric: "econ.margin.gross",
      value: 0.5,
      source: "human:steve",
      evidenceType: "HUMAN_ASSUMED",
      confidence: 0.4,
      observedAt: NOW - 1000,
    };
    expect(() => assertValidObservation(human, NOW)).toThrowError(
      /requires a rationale/,
    );
    expect(
      assertValidObservation(
        { ...human, rationale: "v0 seed assumption, industry experience" },
        NOW,
      ).id,
    ).toBe("econ.margin.gross");
  });

  test("bounds: confidence and observedAt", () => {
    expect(() =>
      assertValidObservation({ ...base, confidence: 1.2 }, NOW),
    ).toThrowError(/confidence/);
    expect(() =>
      assertValidObservation({ ...base, confidence: -0.1 }, NOW),
    ).toThrowError(/confidence/);
    expect(() =>
      assertValidObservation({ ...base, observedAt: NOW + 10 * 60 * 1000 }, NOW),
    ).toThrowError(/observedAt/);
    expect(() =>
      assertValidObservation({ ...base, observedAt: 0 }, NOW),
    ).toThrowError(/observedAt/);
  });
});

describe("freshness", () => {
  const kwVol = requireMetric("kw.volume.exact"); // staleAfterDays: 90
  const needType = requireMetric("econ.service.needType"); // never stale

  test("within horizon is fresh; past horizon is stale", () => {
    const day = 24 * 60 * 60 * 1000;
    expect(isFresh(NOW - 89 * day, kwVol, NOW)).toBe(true);
    expect(isFresh(NOW - 91 * day, kwVol, NOW)).toBe(false);
  });

  test("null staleAfterDays never goes stale", () => {
    expect(isFresh(NOW - 10_000 * 24 * 60 * 60 * 1000, needType, NOW)).toBe(
      true,
    );
  });
});

describe("evidenceMix", () => {
  test("counts by evidence type with all four keys present", () => {
    const mix = evidenceMix([
      { evidenceType: "OBSERVED" },
      { evidenceType: "OBSERVED" },
      { evidenceType: "AI_ESTIMATED" },
      { evidenceType: "HUMAN_ASSUMED" },
    ]);
    expect(mix).toEqual({
      OBSERVED: 2,
      DERIVED: 0,
      AI_ESTIMATED: 1,
      HUMAN_ASSUMED: 1,
    });
  });
});
