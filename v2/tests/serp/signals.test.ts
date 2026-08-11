/**
 * GOLDEN FIXTURES: known SERPs must produce exactly these extracted signals.
 * If extraction logic changes intentionally, bump SIGNALS_VERSION and update
 * the goldens in the same commit.
 */
import { describe, expect, test } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parseSerpResponse } from "../../lib/providers/serpapi";
import {
  SIGNALS_VERSION,
  competitorHosts,
  extractSignals,
} from "../../lib/serp/signals";

const FIX = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");
const weak = parseSerpResponse(
  JSON.parse(readFileSync(join(FIX, "serpapi-weak-market.json"), "utf8")),
);
const strong = parseSerpResponse(
  JSON.parse(readFileSync(join(FIX, "serpapi-strong-market.json"), "utf8")),
);

test("signals version is pinned", () => {
  expect(SIGNALS_VERSION).toBe("1.0.0");
});

describe("golden: weak market (directories, mismatch, thin pack, ads)", () => {
  const signals = extractSignals(weak, "Prosper", {
    competitorAvgWords: 240,
    competitorDomainAgesYears: [2.1, 3.5],
  });

  test("exact signal extraction", () => {
    expect(signals).toEqual({
      directoriesInTop3: 2, // yelp #1, angi #2
      innerPagesInTop5: 2, // houston service-area, dfw /services/epoxy (lowes counts as directory)
      intentMismatchInTop5: 1, // lowes
      outOfTownInTop3: 1, // houstoncoatingsco service-area page
      franchisesInTop3: 0,
      buyerProof: true, // homeadvisor in top-10 + ads present
      top3TitlesMissingCity: 2, // angi + houston titles lack "Prosper"
      mapPack: "present",
      mapPackSize: 3,
      avgMapReviews: 17, // (12+31+8)/3
      mapListingsWithoutWebsite: 2,
      adCount: 2,
      advertisers: ["garagekingsdfw.com", "example-coatings.com"],
      competitorAvgWords: 240,
      competitorAvgDomainAgeYears: 2.8,
    });
  });

  test("competitor hosts exclude directories, keep .com specialists", () => {
    expect(competitorHosts(weak)).toEqual(["houstoncoatingsco.com"]);
  });
});

describe("golden: strong market (dedicated local sites, franchise, mature pack)", () => {
  const signals = extractSignals(strong, "Prosper", {
    competitorAvgWords: 2400,
    competitorDomainAgesYears: [12, 9.5, 15],
  });

  test("exact signal extraction", () => {
    expect(signals).toEqual({
      directoriesInTop3: 0,
      innerPagesInTop5: 1, // garageexperts.com/north-dallas
      intentMismatchInTop5: 0,
      outOfTownInTop3: 0, // garageexperts title mentions Prosper; no service-area URLs in top 3
      franchisesInTop3: 1, // garageexperts.com
      buyerProof: false, // no marketplaces, no ads
      top3TitlesMissingCity: 0, // all three titles mention Prosper
      mapPack: "present",
      mapPackSize: 3,
      avgMapReviews: 238,
      mapListingsWithoutWebsite: 0,
      adCount: 0,
      advertisers: [],
      competitorAvgWords: 2400,
      competitorAvgDomainAgeYears: 12.2,
    });
  });
});
