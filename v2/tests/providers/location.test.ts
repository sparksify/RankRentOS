// Regression tests for the Experiment-1 geography failure class.
// 10 SERPs failed with "Unsupported `Meridian, ID, United States` location".
import { test, expect } from "vitest";
import { serpUrl, assertNormalizedLocation } from "../../lib/providers/serpapi";
import { serpLocation } from "../../lib/geo/states";

const KEY = "test-key";

// Exact failures observed in Experiment 1
const FAILED_CASES: [string, string][] = [
  ["Meridian", "ID"], ["Prosper", "TX"], ["Frisco", "TX"], ["Conroe", "TX"],
  ["Carmel", "IN"], ["Celina", "TX"], ["Port St Lucie", "FL"], ["Mansfield", "TX"],
  ["Kansas City", "KS"], ["Erie", "CO"],
];

test("serpLocation expands every Experiment-1 failure case to a full state name", () => {
  for (const [city, state] of FAILED_CASES) {
    const loc = serpLocation(city, state);
    expect(loc).not.toMatch(/,\s*[A-Z]{2}\s*(,|$)/); // no bare abbreviation survives
    expect(loc).toContain(city);
    expect(loc).toMatch(/United States$/);
  }
  expect(serpLocation("Meridian", "ID")).toBe("Meridian, Idaho, United States");
  expect(serpLocation("Prosper", "TX")).toBe("Prosper, Texas, United States");
});

test("serpUrl REJECTS the exact strings that failed in Experiment 1", () => {
  for (const [city, state] of FAILED_CASES) {
    const bad = `${city}, ${state}, United States`;
    expect(() => serpUrl("appliance repair", bad, KEY)).toThrow(/unnormalized location/);
  }
});

test("serpUrl accepts normalized locations", () => {
  for (const [city, state] of FAILED_CASES) {
    const url = serpUrl("appliance repair", serpLocation(city, state), KEY);
    expect(url).toContain("engine=google");
    expect(url).toContain("location=");
  }
});

test("guard is precise: full state names and city-only pass, abbreviations fail", () => {
  expect(() => assertNormalizedLocation("Franklin, Tennessee, United States")).not.toThrow();
  expect(() => assertNormalizedLocation("Windsong Ranch, Texas, United States")).not.toThrow();
  expect(() => assertNormalizedLocation("United States")).not.toThrow();
  expect(() => assertNormalizedLocation("Austin, TX")).toThrow();
  expect(() => assertNormalizedLocation("Austin, TX, United States")).toThrow();
});
