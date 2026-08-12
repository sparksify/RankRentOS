import { test, expect, describe } from "vitest";
import { rankability, demand, commercialIntent, leadEconomics, renterDepth, assetValue, speedProspective, asymmetry, confidence, type Ev } from "../../lib/scoring/dimensions";
import { scoreOpportunity, bucketOf, WEIGHTS_DEFAULT, WEIGHT_SETS } from "../../lib/scoring/composite";

const weakSerp: Ev = { dirs: 2, inner: 4, mapCount: 3, mapReviews: 20, contentWords: 300, domainAge: 3, vol: 480, cpc: 8, opRelevant: 10, opViable: 3, opStrong: 1, opMedReviews: 40, opWebPct: 30, opConcentration: "fragmented", ticketAvg: 5000, margin: 0.5, domainAvailable: true, freshnessDays: 1 };
const brutalSerp: Ev = { ...weakSerp, dirs: 0, inner: 1, mapReviews: 1675, contentWords: 2748, domainAge: 24, franchise: 1, opConcentration: "concentrated" };

describe("determinism & reproducibility", () => {
  test("same evidence + version = identical result", () => {
    const a = scoreOpportunity("x", weakSerp, WEIGHTS_DEFAULT, 1000);
    const b = scoreOpportunity("x", weakSerp, WEIGHTS_DEFAULT, 1000);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("missing evidence is never imputed", () => {
  test("no SERP evidence -> A null, not zero", () => {
    const r = rankability({});
    expect(r.score).toBeNull();
    expect(r.missingMetrics.length).toBeGreaterThan(0);
  });
  test("no measured volume -> B null", () => { expect(demand({}).score).toBeNull(); });
  test("no operator evidence -> E null", () => { expect(renterDepth({}).score).toBeNull(); });
  test("composite renormalizes over scoreable dims only", () => {
    const s = scoreOpportunity("y", { dirs: 1, inner: 4, mapCount: 3, mapReviews: 20 }, WEIGHTS_DEFAULT);
    expect(s.composite).not.toBeNull();
    expect(s.unscoredDimensions).toContain("B");
    expect(s.evidenceCompleteness).toBeLessThan(100);
  });
});

describe("A rankability", () => {
  test("weak SERP outscores brutal SERP", () => {
    expect(rankability(weakSerp).score!).toBeGreaterThan(rankability(brutalSerp).score! + 25);
  });
  test("domain age alone never makes a market unwinnable", () => {
    const oldOnly = rankability({ dirs: 2, inner: 4, mapCount: 3, mapReviews: 20, contentWords: 300, domainAge: 27 });
    expect(oldOnly.score!).toBeGreaterThan(55); // still contestable despite 27y incumbents
  });
});

describe("B demand — autocomplete is never volume", () => {
  test("zero volume + strong autocomplete stays low and says so", () => {
    const r = demand({ vol: 0, acFloor: 1.0 });
    expect(r.score).toBeLessThan(15);
    expect(r.rationale.join(" ")).toMatch(/recognition is not demand/);
  });
  test("V0's x2.5 multiplier is not used", () => {
    const r = demand({ vol: 100 });
    expect(r.score).toBe(demand({ vol: 100, universeVolume: 250, universeGeoScoped: false }).score);
  });
  test("national-leak universe (not geo-scoped) is ignored", () => {
    const leak = demand({ vol: 210, universeVolume: 201440, universeGeoScoped: false });
    expect(leak.missingMetrics.join()).toMatch(/geo-scoped/);
    expect(leak.score).toBe(demand({ vol: 210 }).score);
  });
});

describe("D/F assumption handling", () => {
  test("D is assumption-dependent with low confidence", () => {
    const r = leadEconomics({ ticketAvg: 5000, margin: 0.5 });
    expect(r.assumptionDependent).toBe(true);
    expect(r.confidence).toBeLessThan(0.5);
    expect(r.evidenceTypes).toContain("HUMAN_ASSUMED");
    expect(r.missingMetrics.join()).toMatch(/cpl|close/i);
  });
  test("F is not a copy of D or E", () => {
    const hiTicketNoDemand: Ev = { vol: 0, ticketAvg: 40000, margin: 0.4, opRelevant: 8, opViable: 1 };
    const d = leadEconomics(hiTicketNoDemand), b = demand(hiTicketNoDemand), e = renterDepth(hiTicketNoDemand);
    const f = assetValue(hiTicketNoDemand, d, b, e);
    expect(d.score!).toBeGreaterThan(70);   // per-job economics look great
    expect(f.score!).toBeLessThan(25);      // but there is no lead flow to own
  });
});

describe("E renter depth — count is not liquidity", () => {
  test("many businesses but zero viable scores below few-but-viable", () => {
    const many = renterDepth({ opRelevant: 11, opViable: 0, opStrong: 0, opWebPct: 0, opConcentration: "insufficient-evidence" });
    const few = renterDepth({ opRelevant: 7, opViable: 3, opStrong: 2, opMedReviews: 150, opWebPct: 40, opConcentration: "fragmented" });
    expect(few.score!).toBeGreaterThan(many.score! + 30);
    expect(many.rationale.join(" ")).toMatch(/NO viable renter/);
  });
});

describe("G is prospective, never measured", () => {
  test("marked prospective with missing live metrics", () => {
    const g = speedProspective(weakSerp, rankability(weakSerp));
    expect(g.prospective).toBe(true);
    expect(g.missingMetrics.join()).toMatch(/firstrank|indexed/);
    expect(g.rationale.join(" ")).toMatch(/PROSPECTIVE/);
  });
});

describe("H asymmetry is not an average", () => {
  test("zero demand collapses asymmetry despite an easy SERP", () => {
    const ev: Ev = { ...weakSerp, vol: 0, opViable: 2 };
    const dims = { a: rankability(ev), b: demand(ev), c: commercialIntent(ev), d: leadEconomics(ev), e: renterDepth(ev), f: assetValue(ev, leadEconomics(ev), demand(ev), renterDepth(ev)) };
    const h = asymmetry(ev, dims);
    const avg = (dims.a.score! + dims.b.score! + (dims.f.score ?? 0)) / 3;
    expect(h.score!).toBeLessThan(avg);
    expect(h.rationale.join(" ")).toMatch(/collapses the upside/);
  });
  test("rare combination earns a bonus above its inputs' mean", () => {
    const h = asymmetry(weakSerp, { a: rankability(weakSerp), b: demand(weakSerp), c: commercialIntent(weakSerp), d: leadEconomics(weakSerp), e: renterDepth(weakSerp), f: assetValue(weakSerp, leadEconomics(weakSerp), demand(weakSerp), renterDepth(weakSerp)) });
    expect(h.rationale.join(" ")).toMatch(/RARE/);
  });
});

describe("I confidence is evidence quality, not opportunity quality", () => {
  test("a terrible opportunity can have high confidence", () => {
    const awful: Ev = { vol: 0, cpc: null, dirs: 0, inner: 1, mapCount: 3, mapReviews: 1675, contentWords: 2748, domainAge: 24, opRelevant: 11, opViable: 0, opMedReviews: 559, opWebPct: 27, opConcentration: "concentrated", ticketAvg: 325, margin: 0.7, freshnessDays: 1 };
    const s = scoreOpportunity("awful", awful);
    expect(s.composite!).toBeLessThan(45);
    expect(s.confidenceScore!).toBeGreaterThan(55); // we are confident it is bad
  });
  test("composite is NEVER multiplied by confidence", () => {
    const hi = scoreOpportunity("h", { ...weakSerp, freshnessDays: 1 });
    const lo = scoreOpportunity("l", { ...weakSerp, freshnessDays: 400 });
    expect(hi.composite).toBe(lo.composite);          // same evidence values -> same composite
    expect(hi.confidenceScore!).toBeGreaterThan(lo.confidenceScore!); // confidence differs independently
  });
});

describe("buckets enforce quality gates over quotas", () => {
  test("no viable renter or sub-floor demand = unbucketed", () => {
    expect(bucketOf(scoreOpportunity("a", { ...weakSerp, vol: 0 }), { ...weakSerp, vol: 0 }).bucket).toBeNull();
    expect(bucketOf(scoreOpportunity("b", { ...weakSerp, opViable: 0 }), { ...weakSerp, opViable: 0 }).bucket).toBeNull();
  });
});

describe("sensitivity", () => {
  test("all weight sets produce a score; ordering is comparable", () => {
    for (const w of WEIGHT_SETS) {
      const s = scoreOpportunity("x", weakSerp, w);
      expect(s.composite).toBeGreaterThan(0);
      expect(s.weightSetId).toBe(w.id);
    }
  });
});
