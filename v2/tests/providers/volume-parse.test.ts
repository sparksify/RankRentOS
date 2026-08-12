import { test, expect, describe } from "vitest";
import { parseVolumeResponse } from "../../lib/providers/dataforseo";

// Regression: Experiment 2 Stage 2 reported 0/700 survivors because consumers read
// `r.volume` while the parser returns `r.vol`. undefined ?? 0 silently became "no demand".
const raw = { tasks: [{ status_code: 20000, result: [
  { keyword: "dumpster rental orlando", search_volume: 1600, cpc: 13.23, competition: 0.4 },
  { keyword: "foundation repair plano", search_volume: 210, cpc: 65.43, competition: null },
] }] };

describe("parseVolumeResponse contract", () => {
  test("exposes measured demand on `vol` (not `volume`)", () => {
    const r = parseVolumeResponse(raw, ["dumpster rental orlando"]);
    expect(r[0].vol).toBe(1600);
    expect((r[0] as any).volume).toBeUndefined();
  });
  test("keywords the API omits are gaps, not zeros", () => {
    const r = parseVolumeResponse(raw, ["dumpster rental orlando", "never returned"]);
    expect(r).toHaveLength(2);
    expect(r[1].vol).toBeNull();          // UNKNOWN — must not read as "no demand"
    expect(r[1].state).toBe("unknown-omitted");
  });
  test("a real batch never yields all-zero volume when rows carry search_volume", () => {
    const r = parseVolumeResponse(raw, ["dumpster rental orlando", "foundation repair plano"]);
    expect(r.filter((x) => x.vol > 0).length).toBe(2);
  });
});

// UNKNOWN != ZERO. DataForSEO returns search_volume: null for keywords it cannot
// measure. Exp-2 coerced 381 of 700 such keywords to 0/mo and rejected them as
// "below the demand floor" — a fabricated confident negative.
const mixed = { tasks: [{ status_code: 20000, result: [
  { keyword: "measured kw", search_volume: 320, cpc: 5.1, competition: 0.3 },
  { keyword: "observed zero kw", search_volume: 0, cpc: null, competition: null },
  { keyword: "no data kw", search_volume: null, cpc: null, competition: null },
] }] };

describe("unknown is never zero", () => {
  test("provider null volume stays null and is labelled unknown", () => {
    const r = parseVolumeResponse(mixed, ["no data kw"]);
    expect(r[0].vol).toBeNull();
    expect(r[0].state).toBe("unknown-null");
  });
  test("observed zero is distinguishable from unknown", () => {
    const [z] = parseVolumeResponse(mixed, ["observed zero kw"]);
    expect(z.vol).toBe(0);
    expect(z.state).toBe("measured");
  });
  test("omitted keywords are unknown, not zero", () => {
    const [o] = parseVolumeResponse(mixed, ["never requested back"]);
    expect(o.vol).toBeNull();
    expect(o.state).toBe("unknown-omitted");
  });
  test("a demand floor must not reject unknowns as sub-floor", () => {
    const rows = parseVolumeResponse(mixed, ["measured kw", "observed zero kw", "no data kw"]);
    const belowFloor = rows.filter((r) => r.vol !== null && r.vol < 100);
    const unknown = rows.filter((r) => r.vol === null);
    expect(belowFloor.map((r) => r.keyword)).toEqual(["observed zero kw"]);
    expect(unknown.map((r) => r.keyword)).toEqual(["no data kw"]);
  });
  test("cpc of 0 is preserved; non-numeric cpc becomes null", () => {
    const raw0 = { tasks: [{ status_code: 20000, result: [{ keyword: "k", search_volume: 10, cpc: 0, competition: null }] }] };
    expect(parseVolumeResponse(raw0, ["k"])[0].cpc).toBe(0);
  });
});
