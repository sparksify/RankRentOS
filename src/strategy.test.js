// node --test src/strategy.test.js
import { test } from "node:test";
import assert from "node:assert";
import { computeRankability, computeEconomics, computeAssetValue, computeArbitrage, classify, timeTo2k, computeConfidence } from "./strategy.js";

const NICHE_HI = { ticketLow: 15000, ticketHigh: 60000, margin: 0.4, need: false, seasonal: false }; // outdoor kitchens
const NICHE_LO = { ticketLow: 150, ticketHigh: 500, margin: 0.7, need: true, seasonal: false };      // appliance repair

test("rankability rewards weak SERPs, penalizes franchises", () => {
  const weak = computeRankability({ directoriesInTop3: 2, innerPagesInTop5: 4, avgMapReviews: 20, mapPackSize: 3, competitorAvgWords: 300, competitorAvgDomainAge: 3 });
  const strong = computeRankability({ directoriesInTop3: 0, innerPagesInTop5: 0, avgMapReviews: 250, mapPackSize: 3, competitorAvgWords: 2500, competitorAvgDomainAge: 15, franchisesInTop3: 2 });
  assert.ok(weak >= 75, `weak SERP should score high, got ${weak}`);
  assert.ok(strong <= 15, `entrenched SERP should score low, got ${strong}`);
});

test("economics: rent tiers and coverage honor the 4-5x rule", () => {
  const e = computeEconomics(1000, NICHE_HI); // 1000/mo, $37.5k avg ticket, 40% margin
  assert.ok(e.grossProfitMo > 40000, "big-ticket high-volume market has huge gross profit");
  assert.equal(e.tier, "S");
  assert.ok(e.coverage >= 4 && e.coverage <= 7, `coverage should be ~5x, got ${e.coverage}`);
  const tiny = computeEconomics(0, NICHE_LO);
  assert.equal(tiny.grossProfitMo, 0);
  assert.equal(tiny.tier, "D");
});

test("asset value: high-ticket beats low-ticket at same volume", () => {
  const g = { volume: 300, cpc: 8, mapPackSize: 3, avgMapReviews: 60, buyerProof: true };
  const hi = computeAssetValue(g, NICHE_HI, { income: 110000 }, computeEconomics(300, NICHE_HI));
  const lo = computeAssetValue(g, NICHE_LO, { income: 110000 }, computeEconomics(300, NICHE_LO));
  assert.ok(hi > lo, `high-ticket AV ${hi} should exceed low-ticket ${lo}`);
});

test("arbitrage: value+easy high; value+hard and easy+worthless both moderate/low", () => {
  const unicornish = computeArbitrage(85, 85);
  const valueButHard = computeArbitrage(25, 90);
  const easyButPoor = computeArbitrage(95, 20);
  assert.ok(unicornish >= 80);
  assert.ok(valueButHard < 60, `hard SERP caps arbitrage, got ${valueButHard}`);
  assert.ok(easyButPoor < 50, `poor economics caps arbitrage, got ${easyButPoor}`);
});

test("classification boundaries", () => {
  const g = { volume: 400, mapPackSize: 3, buyerProof: true };
  const econA = { rentHigh: 3000, rentMid: 2400 };
  assert.equal(classify({ rankability: 70, assetValue: 65, econ: econA, g }), "UNICORN");
  assert.equal(classify({ rankability: 50, assetValue: 65, econ: econA, g }), "HIGH-VALUE");
  assert.equal(classify({ rankability: 60, assetValue: 45, econ: { rentHigh: 900, rentMid: 700 }, g }), "LOW-HANGING FRUIT");
  assert.equal(classify({ rankability: 30, assetValue: 70, econ: econA, g }), "LONG SHOT");
  assert.equal(classify({ rankability: 60, assetValue: 20, econ: { rentHigh: 300, rentMid: 200 }, g }), "LOW VALUE");
});

test("no unicorn without measured demand", () => {
  const g = { volume: 0, mapPackSize: 3, buyerProof: true };
  assert.notEqual(classify({ rankability: 90, assetValue: 70, econ: { rentHigh: 3000, rentMid: 2400 }, g }), "UNICORN");
});

test("timeTo2k honest when rent ceiling below 2k", () => {
  const t = timeTo2k({ rankability: 90, econ: { rentHigh: 800, coverage: 5 }, g: { volume: 500 } });
  assert.equal(t.possible, false);
  assert.equal(t.prob, 0);
});

test("confidence tiers", () => {
  assert.equal(computeConfidence({ signals: { volume: 300, cpc: 8 }, deepCheck: "confirmed" }), "high");
  assert.equal(computeConfidence({ signals: { volume: 300, cpc: 8 } }), "medium");
  assert.equal(computeConfidence({ signals: { volume: 0 } }), "low");
});
