/**
 * V0 parser tests against the REAL tracked V0 data files. Exact counts are
 * asserted so any silent change in parsing or in the V0 files is caught.
 */
import { describe, expect, test } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  V0_FILE_TIMESTAMPS,
  cleanCityName,
  parseCities,
  parseNiches,
  parseSurvivors,
  parseTrends,
  parseVolumes,
} from "../../lib/import/v0";

const V0 = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "data");
const read = (f: string) => JSON.parse(readFileSync(join(V0, f), "utf8"));

const services = parseNiches(read("niches.json"));
const cur = parseCities(read("cities.json"), "curated");
const nat = parseCities(read("cities-national.json"), "national");
const svcRef = services.map((s) => ({ slug: s.slug, acPhrase: s.acPhrase }));
const cityRef = [...cur, ...nat].map((c) => ({ name: c.name, state: c.state, slug: c.slug }));
const obsCount = (rows: { observations: unknown[] }[]) =>
  rows.reduce((s, r) => s + r.observations.length, 0);

describe("niches.json → services", () => {
  test("24 services, 96 HUMAN_ASSUMED legacy economics observations", () => {
    expect(services).toHaveLength(24);
    expect(obsCount(services)).toBe(96); // ticket, margin, needType, seasonal × 24
    for (const s of services) {
      expect(s.domainTerms!.length).toBeGreaterThan(0);
      expect(s.acPhrase).toBeTruthy();
      for (const o of s.observations) {
        expect(o.legacy).toBe(true);
        expect(o.evidenceType).toBe("HUMAN_ASSUMED");
        expect(o.rationale).toMatch(/requires independent V2 verification/);
        expect(o.observedAt).toBe(V0_FILE_TIMESTAMPS.curated);
        expect(o.source).toContain("v0:niches.json");
      }
    }
  });
});

describe("city files → geographies", () => {
  test("58 curated + 491 national, demographics as legacy assumptions", () => {
    expect(cur).toHaveLength(58);
    expect(obsCount(cur)).toBe(174); // pop, income, growth × 58
    expect(nat).toHaveLength(491);
    expect(obsCount(nat)).toBe(1182);
  });

  test("keyword-API name cleanup preserved from V0", () => {
    expect(cleanCityName("San Buenaventura (Ventura)")).toBe("Ventura");
    expect(cleanCityName("Boise City")).toBe("Boise City");
  });
});

describe("volumes → market observations (legacy OBSERVED)", () => {
  test("curated: all 1,392 keys resolve; 2,013 observations", () => {
    const v = parseVolumes(read("volumes.json"), svcRef, cityRef, "curated");
    expect(v.rows).toHaveLength(1392);
    expect(v.skippedKeys).toHaveLength(0);
    expect(obsCount(v.rows)).toBe(2013);
    for (const o of v.rows[0]!.observations) {
      expect(o.legacy).toBe(true);
      expect(o.evidenceType).toBe("OBSERVED");
    }
  });

  test("national: 2,350 resolve, 50 skipped as ambiguous (never guessed)", () => {
    const v = parseVolumes(read("volumes-national.json"), svcRef, cityRef, "national");
    expect(v.rows).toHaveLength(2350);
    expect(v.skippedKeys).toHaveLength(50);
    expect(obsCount(v.rows)).toBe(3784);
    // ambiguity example: Westminster exists in CO and CA
    expect(v.skippedKeys).toContain("windshield replacement westminster");
  });
});

describe("national-survivors → prior hypotheses only", () => {
  test("669 rows, all DERIVED v0.prior.survivor, no funnel advancement encoded", () => {
    const s = parseSurvivors(read("national-survivors.json"), svcRef);
    expect(s.rows).toHaveLength(669);
    expect(s.skippedKeys).toHaveLength(0);
    for (const r of s.rows.slice(0, 20)) {
      expect(r.observations).toHaveLength(1);
      const o = r.observations[0]!;
      expect(o.metric).toBe("v0.prior.survivor");
      expect(o.evidenceType).toBe("DERIVED");
      expect(o.legacy).toBe(true);
      expect(o.rationale).toMatch(/grants no V2 funnel advancement/);
    }
  });
});

describe("trends.json → service demand weights", () => {
  test("24 services, 48 observations, timestamps from the file's own builtAt", () => {
    const t = parseTrends(read("trends.json"), svcRef);
    expect(t).toHaveLength(24);
    expect(t.reduce((s, x) => s + x.observations.length, 0)).toBe(48);
    const builtAt = new Date("2026-07-17T08:35:04.894Z").getTime();
    for (const row of t) {
      for (const o of row.observations) {
        expect(o.observedAt).toBe(builtAt); // real internal timestamp, not fabricated
        expect(o.legacy).toBe(true);
      }
    }
  });
});
