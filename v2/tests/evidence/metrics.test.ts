import { describe, expect, test } from "vitest";
import { METRICS, getMetric, requireMetric } from "../../lib/evidence/metrics";
import { EVIDENCE_TYPES } from "../../lib/evidence/types";

describe("metric registry integrity", () => {
  test("ids are unique and dot-namespaced", () => {
    const ids = METRICS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z]+(\.[a-zA-Z]+)+$/);
  });

  test("every entry declares unit, kind, evidence types, staleness", () => {
    for (const m of METRICS) {
      expect(m.unit.length).toBeGreaterThan(0);
      expect(["number", "string"]).toContain(m.kind);
      expect(m.allowedEvidenceTypes.length).toBeGreaterThan(0);
      for (const et of m.allowedEvidenceTypes) {
        expect(EVIDENCE_TYPES).toContain(et);
      }
      expect(
        m.staleAfterDays === null || m.staleAfterDays > 0,
      ).toBe(true);
      expect(m.description.length).toBeGreaterThan(10);
    }
  });

  test("lookup helpers", () => {
    expect(getMetric("kw.volume.exact")?.unit).toBe("searches/mo");
    expect(getMetric("nope.nope")).toBeUndefined();
    expect(() => requireMetric("nope.nope")).toThrow(/Unknown metric/);
  });
});
