import { describe, expect, test } from "vitest";
import {
  parseAutocompleteResponse,
  parseSerpResponse,
  trendsSeriesStats,
} from "../../lib/providers/serpapi";
import { parseVolumeResponse } from "../../lib/providers/dataforseo";
import {
  parseRdapAvailability,
  registrationAgeYears,
} from "../../lib/providers/rdap";
import { wordCount } from "../../lib/crawl/contentDepth";
import {
  domainCandidates,
  pickWinner,
} from "../../lib/domains/candidates";

describe("serpapi parsing", () => {
  test("error payloads throw", () => {
    expect(() => parseSerpResponse({ error: "quota" })).toThrow(/quota/);
    expect(() => parseAutocompleteResponse({ error: "x" }, "t", "c")).toThrow();
  });

  test("autocomplete floor semantics preserved from V0 (1.0 / 0.8 / 0.6)", () => {
    const hit = parseAutocompleteResponse(
      { suggestions: [{ value: "epoxy flooring prosper tx" }] },
      "epoxy flooring pros",
      "Prosper",
    );
    expect(hit).toMatchObject({ cityHit: true, floor: 1.0 });
    const activity = parseAutocompleteResponse(
      { suggestions: [{ value: "epoxy flooring cost" }] },
      "epoxy flooring pros",
      "Prosper",
    );
    expect(activity).toMatchObject({ cityHit: false, floor: 0.8 });
    const dead = parseAutocompleteResponse({ suggestions: [] }, "x", "Prosper");
    expect(dead.floor).toBe(0.6);
  });

  test("trends series stats: mean, peak months", () => {
    // 12 monthly points across one year; June/July/August triple the rest
    const timeline = Array.from({ length: 12 }, (_, m) => ({
      timestamp: Date.UTC(2025, m, 15) / 1000,
      values: [{ extracted_value: m >= 5 && m <= 7 ? 90 : 30 }],
    }));
    const s = trendsSeriesStats(timeline, 0);
    expect(s.mean).toBe(45);
    expect(s.peakMean).toBe(90);
    expect(s.peakMonths.sort()).toEqual(["Aug", "Jul", "Jun"].sort());
  });
});

describe("dataforseo parsing", () => {
  test("maps results and records explicit zeros for omitted keywords", () => {
    const raw = {
      tasks: [
        {
          status_code: 20000,
          result: [
            { keyword: "epoxy flooring prosper", search_volume: 320, cpc: 6.5, competition: 0.4 },
          ],
        },
      ],
    };
    const out = parseVolumeResponse(raw, ["epoxy flooring prosper", "epoxy flooring anna"]);
    expect(out).toEqual([
      { keyword: "epoxy flooring prosper", vol: 320, cpc: 6.5, competition: 0.4 },
      { keyword: "epoxy flooring anna", vol: 0, cpc: null, competition: null },
    ]);
  });

  test("failed task throws", () => {
    expect(() =>
      parseVolumeResponse({ tasks: [{ status_code: 40401, status_message: "auth" }] }, []),
    ).toThrow(/40401/);
  });
});

describe("rdap parsing", () => {
  test("availability from status codes", () => {
    expect(parseRdapAvailability("a.com", 404).available).toBe(true);
    expect(parseRdapAvailability("a.com", 200).available).toBe(false);
    expect(parseRdapAvailability("a.com", 429).available).toBe(null);
  });

  test("registration age", () => {
    const now = new Date("2026-08-11T00:00:00Z").getTime();
    const raw = { events: [{ eventAction: "registration", eventDate: "2020-08-11T00:00:00Z" }] };
    expect(registrationAgeYears(raw, now)).toBe(6);
    expect(registrationAgeYears({ events: [] }, now)).toBe(null);
  });
});

describe("content depth", () => {
  test("word count strips scripts/styles/tags, keeps words >2 chars", () => {
    const html = `<html><head><style>body{color:red}</style></head>
      <body><script>var x=1;</script><h1>Epoxy Garage Floors</h1>
      <p>We coat garage floors in Prosper and beyond.</p></body></html>`;
    // Epoxy Garage Floors coat garage floors Prosper and beyond → words>2
    expect(wordCount(html)).toBe(9);
  });
});

describe("domain candidates (V0 logic preserved)", () => {
  test("generation includes city-first, service-first, and pros fallback", () => {
    const c = domainCandidates(["epoxyfloors", "epoxy"], "Little Elm");
    expect(c).toContain("littleelmepoxyfloors.com");
    expect(c).toContain("epoxyfloorslittleelm.com");
    expect(c).toContain("littleelmepoxy.com");
    expect(c).toContain("littleelmepoxyfloorspros.com");
  });

  test("winner: city-first + primary keyword beats variants and pros suffix", () => {
    const pick = pickWinner(
      ["epoxylittleelm.com", "littleelmepoxyfloors.com", "littleelmepoxyfloorspros.com"],
      ["epoxyfloors", "epoxy"],
      "Little Elm",
    );
    expect(pick?.domain).toBe("littleelmepoxyfloors.com");
    expect(pick?.why).toContain("city-first");
    expect(pick?.runnerUp).toBeTruthy();
    expect(pickWinner([], ["x"], "Anna")).toBeNull();
  });
});
