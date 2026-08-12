import { test, expect } from "vitest";
import { buildUniverse } from "../../lib/keywords/universe";
import { dedupeOperators, depthSignals } from "../../lib/operators/depth";

const base = { core: "appliance repair prosper", serviceTerms: ["appliance", "repair"], geoTerms: ["prosper", "tx"] };

test("universe: never blindly sums; rejects with auditable reasons", () => {
  const u = buildUniverse({ ...base, related: [
    { keyword: "appliance repair prosper", volume: 320, cpc: 3.02 },
    { keyword: "appliance repair prosper tx", volume: 90, cpc: 4.1 },
    { keyword: "appliance repair cost", volume: 50, cpc: 2.0 },
    { keyword: "appliance repair jobs", volume: 400, cpc: 0.2 },      // non-buyer
    { keyword: "how to fix appliance", volume: 900, cpc: 0.1 },        // informational
    { keyword: "plumber prosper", volume: 200, cpc: 5.0 },             // no service token
    { keyword: "appliance repair training", volume: 30, cpc: null },   // non-buyer
    { keyword: "appliance repair zero", volume: 0, cpc: null },        // no measured volume
  ]});
  expect(u.relevantCount).toBe(3);
  expect(u.totalRelevantVolume).toBe(460);           // NOT 1990 (naive sum)
  expect(u.coreVolume).toBe(320);
  expect(u.longTailVolume).toBe(140);
  expect(u.geoIntentVolume).toBe(410);
  expect(u.commercialIntentVolume).toBe(460);
  expect(u.corePctOfUniverse).toBeCloseTo(69.6, 1);
  expect(u.rejected.map((r) => r.reason).sort()).toEqual(
    ["informational-intent", "no-service-token", "non-buyer-intent", "non-buyer-intent", "zero-measured-volume"].sort());
});

test("universe: V0's x2.5 assumption is not reproduced", () => {
  const u = buildUniverse({ ...base, related: [{ keyword: "appliance repair prosper", volume: 320, cpc: 3 }] });
  expect(u.totalRelevantVolume).toBe(320);           // no multiplier invented
  expect(u.corePctOfUniverse).toBe(100);
});

test("universe: zero keyword-tool volume yields zero — autocomplete never becomes volume", () => {
  const u = buildUniverse({ core: "pool builder windsong ranch", serviceTerms: ["pool"], geoTerms: ["windsong"],
    related: [{ keyword: "pool builder windsong ranch", volume: 0, cpc: null }] });
  expect(u.totalRelevantVolume).toBe(0);
  expect(u.relevantCount).toBe(0);
  expect(u.corePctOfUniverse).toBeNull();            // undefined, not fabricated
});

test("operators: dedupe across sources, multi-source confirmation", () => {
  const ops = dedupeOperators([
    { name: "Ace Appliance", source: "mappack", reviews: 120, rating: 4.6, website: "https://www.aceappliance.com" },
    { name: "Ace Appliance LLC", source: "organic", domain: "aceappliance.com" },
    { name: "Bob Repairs", source: "mappack", reviews: 3, rating: 5.0, website: null },
    { name: "Ad Guy", source: "ads", website: "https://adguy.com", reviews: 60, rating: 4.2 },
  ]);
  expect(ops).toHaveLength(3);
  expect(ops.find((o) => o.key.includes("aceappliance"))!.multiSourceConfirmed).toBe(true);
});

test("operators: signals are evidence-only; no financial inference", () => {
  const ops = dedupeOperators([
    { name: "A", source: "mappack", reviews: 120, rating: 4.6, website: "https://a.com" },
    { name: "B", source: "mappack", reviews: 80, rating: 4.4, website: "https://b.com" },
    { name: "C", source: "mappack", reviews: 4, rating: 5.0, website: null },
    { name: "D", source: "ads", reviews: 60, rating: 4.1, website: "https://d.com" },
  ]);
  const s = depthSignals(ops);
  expect(s.relevantOperatorCount).toBe(4);
  expect(s.viableOperatorCount).toBe(3);
  expect(s.strongerOperatorCount).toBe(3);
  expect(s.advertiserCount).toBe(1);
  expect(s.medianReviews).toBe(80);
  expect(s.websiteAdoptionPct).toBe(75);
  expect(s.concentration).toBe("moderate"); // top operator holds 45% of reviews
  expect(Object.keys(s)).not.toContain("revenue");
});

test("operators: thin evidence reports insufficient rather than guessing", () => {
  const s = depthSignals(dedupeOperators([{ name: "Solo", source: "mappack" }]));
  expect(s.concentration).toBe("insufficient-evidence");
  expect(s.medianReviews).toBeNull();
});
