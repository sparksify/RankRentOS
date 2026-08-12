import { test, expect, describe } from "vitest";
import { buildGeoUniverse } from "../../lib/keywords/universe";

const input = {
  core: "kitchen remodeling rochester",
  serviceTerms: ["kitchen", "remodel"],
  geoTerms: ["rochester"],
  related: [
    { keyword: "kitchen remodeling rochester", volume: 390, cpc: 9.6 },
    { keyword: "kitchen remodeling rochester mn cost", volume: 40, cpc: 3.1 },
    { keyword: "kitchen remodeling near me", volume: 201400, cpc: 12.0 },
    { keyword: "kitchen remodel ideas", volume: 74000, cpc: 1.2 },
    { keyword: "kitchen remodeling rochester jobs", volume: 90, cpc: null },
    { keyword: "plumber rochester", volume: 800, cpc: 7.0 },
    { keyword: "kitchen remodeling rochester quotes", volume: null, cpc: null },
  ],
};

describe("geo-scoped universe (universe-geo-1.0.0)", () => {
  const u = buildGeoUniverse(input);
  test("national terms never contribute volume", () => {
    expect(u.accepted.map((a) => a.keyword)).not.toContain("kitchen remodeling near me");
    expect(u.attributableVolume).toBe(430);
    expect(u.nationalLeakageVolume).toBeGreaterThan(200000);
  });
  test("every rejection carries a reason", () => {
    expect(u.rejected.every((r) => r.reason.length > 0)).toBe(true);
    expect(u.rejected.find((r) => r.keyword === "kitchen remodeling near me")!.reason)
      .toBe("national-scope-not-attributable-to-this-market");
    expect(u.rejected.find((r) => r.keyword === "plumber rochester")!.reason).toBe("no-service-token");
    expect(u.rejected.find((r) => r.keyword.includes("jobs"))!.reason).toBe("non-buyer-intent");
  });
  test("an unmeasured attributable keyword makes the universe incomplete, not smaller", () => {
    expect(u.unknownVolumeCount).toBe(1);
    expect(u.complete).toBe(false);
  });
  test("is deterministic", () => {
    expect(JSON.stringify(buildGeoUniverse(input))).toBe(JSON.stringify(buildGeoUniverse(input)));
  });
});
