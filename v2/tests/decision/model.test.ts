import { test, expect, describe } from "vitest";
import {
  attributeDemand, assessCapturability, assessMonetization, assessSearchOpportunity, decide,
  DECISION_VERSION, CAPTURABILITY_PASS,
} from "../../lib/decision/model";
import { rankability } from "../../lib/scoring/dimensions";
import { scoreOpportunity, WEIGHTS_DEFAULT } from "../../lib/scoring/composite";

const localDemand = (v: number) => attributeDemand({ measuredVolume: v, sharedCityName: false, geoScopedUniverseVolume: null, serpLocalized: true, cityName: "Arvada" });
const cap = (o: number) => assessCapturability({ architecture: "ORGANIC_ONLY", organicScore: o, mapPackAvgReviews: 11, mapPackSize: 3 });
const mon = (over: any = {}) => assessMonetization({ serviceSlug: "bathroom-remodel", attributableDemand: 400, ticketAssumed: 18000, marginAssumed: 0.32, viableRenters: 3, renterEvidenceAvailable: true, assetValueF: 66, ...over });
const so = (at: any, extra: any = {}) => assessSearchOpportunity({ attribution: at, commercialIntentScore: 80, dimensionA: 70, isExperimentalDemandClass: false, ...extra });

describe("1. map-pack weakness cannot rescue poor organic capturability", () => {
  test("an organic-only asset with a weak pack but hostile organic FAILS capturability", () => {
    const c = assessCapturability({ architecture: "ORGANIC_ONLY", organicScore: 20, mapPackAvgReviews: 8, mapPackSize: 3 });
    expect(c.gate).toBe("FAIL");
    expect(c.excludedSignals).toContain("map-pack review strength");
    expect(c.score).toBe(20);   // the weak pack contributed nothing
  });
});

describe("2. a GBP-capable architecture may consume local-pack evidence without changing organic-only behaviour", () => {
  test("same evidence, different architecture, different capturability", () => {
    const organicOnly = assessCapturability({ architecture: "ORGANIC_ONLY", organicScore: 48, mapPackAvgReviews: 11, mapPackSize: 3 });
    const gbp = assessCapturability({ architecture: "GBP_CAPABLE", organicScore: 48, mapPackAvgReviews: 11, mapPackSize: 3 });
    expect(organicOnly.score).toBe(48);
    expect(gbp.score!).toBeGreaterThan(48);
    expect(organicOnly.gate).toBe("UNKNOWN");
  });
});

describe("3-6. demand attribution states are distinct", () => {
  test("3. ambiguous shared-city demand is NOT locally measured demand", () => {
    const a = attributeDemand({ measuredVolume: 2400, sharedCityName: true, geoScopedUniverseVolume: null, serpLocalized: true, cityName: "Bellevue" });
    expect(a.demandState).toBe("MEASURED_UPPER_BOUND");
    expect(a.attributableDemand).toBeNull();
    expect(a.ceiling).toBe(2400);
    expect(a.demandEvidence.join(" ")).toMatch(/population share is NOT evidence of search share/);
  });
  test("4. ambiguous demand is not zero", () => {
    const a = attributeDemand({ measuredVolume: 2400, sharedCityName: true, geoScopedUniverseVolume: null, serpLocalized: true, cityName: "Bellevue" });
    expect(a.attributableDemand).not.toBe(0);
    expect(a.demandState).not.toBe("ZERO_MEASURED");
    expect(so(a).gate).toBe("UNKNOWN");   // not FAIL
  });
  test("5. unknown demand is not zero", () => {
    const a = attributeDemand({ measuredVolume: null, sharedCityName: false, geoScopedUniverseVolume: null, serpLocalized: true, cityName: "X" });
    expect(a.demandState).toBe("UNKNOWN");
    expect(a.attributableDemand).toBeNull();
    expect(so(a).gate).toBe("UNKNOWN");
  });
  test("6. measured zero stays zero and fails", () => {
    const a = attributeDemand({ measuredVolume: 0, sharedCityName: false, geoScopedUniverseVolume: null, serpLocalized: true, cityName: "X" });
    expect(a.demandState).toBe("ZERO_MEASURED");
    expect(a.attributableDemand).toBe(0);
    expect(so(a).gate).toBe("FAIL");
  });
  test("a geo-scoped universe RESOLVES a shared name back to measured-local", () => {
    const a = attributeDemand({ measuredVolume: 2400, sharedCityName: true, geoScopedUniverseVolume: 300, serpLocalized: true, cityName: "Bellevue" });
    expect(a.demandState).toBe("MEASURED_LOCAL");
    expect(a.attributableDemand).toBe(300);
  });
});

describe("7-10. existential weaknesses cannot be rescued", () => {
  test("7. huge ticket economics cannot rescue zero attributable demand", () => {
    const at = attributeDemand({ measuredVolume: 2400, sharedCityName: true, geoScopedUniverseVolume: null, serpLocalized: true, cityName: "Bellevue" });
    const m = assessMonetization({ serviceSlug: "kitchen-remodel", attributableDemand: at.attributableDemand, ticketAssumed: 200000, marginAssumed: 0.5, viableRenters: 3, renterEvidenceAvailable: true, assetValueF: 92 });
    expect(m.expectedLeadsPerMonth).toBeNull();
    expect(m.gate).toBe("UNKNOWN");        // never PASS on unattributable demand
    expect(m.explanation).toMatch(/not attributable/);
  });
  test("8. huge demand cannot rescue an uncapturable organic SERP", () => {
    const d = decide({ searchOpportunity: so(localDemand(5000)), capturability: cap(18), monetization: mon(),
      attribution: localDemand(5000), renterEvidenceAvailable: true, viableRenters: 3, preRegisteredHypothesis: null, experimentRole: null });
    expect(d.gates.demand).toBe("PASS");
    expect(d.gates.capturability).toBe("FAIL");
    expect(d.decision).toBe("REJECT");
  });
  test("9. zero viable renters cannot become a revenue candidate", () => {
    const d = decide({ searchOpportunity: so(localDemand(900)), capturability: cap(80),
      monetization: mon({ viableRenters: 0 }), attribution: localDemand(900),
      renterEvidenceAvailable: true, viableRenters: 0, preRegisteredHypothesis: null, experimentRole: null });
    expect(d.gates.renterDepth).toBe("FAIL");
    expect(d.decision).toBe("REJECT");
  });
  test("10. high evidence confidence cannot rescue a bad opportunity", () => {
    const at = localDemand(30);            // confidently measured, but tiny
    expect(at.demandConfidence).toBeGreaterThan(0.8);
    const d = decide({ searchOpportunity: so(at), capturability: cap(80), monetization: mon({ attributableDemand: 30 }),
      attribution: at, renterEvidenceAvailable: true, viableRenters: 3, preRegisteredHypothesis: null, experimentRole: null });
    expect(d.decision).toBe("REJECT");
  });
});

describe("11. EXPERIMENTAL requires a pre-registered hypothesis", () => {
  test("a failing asset WITH a registered hypothesis is EXPERIMENTAL, not REJECT", () => {
    const at = attributeDemand({ measuredVolume: 0, sharedCityName: false, geoScopedUniverseVolume: null, serpLocalized: true, cityName: "Painted Tree" });
    const d = decide({ searchOpportunity: assessSearchOpportunity({ attribution: at, commercialIntentScore: null, dimensionA: null, isExperimentalDemandClass: true }),
      capturability: cap(73), monetization: mon({ attributableDemand: null }), attribution: at,
      renterEvidenceAvailable: true, viableRenters: 3, preRegisteredHypothesis: "H2", experimentRole: "community demand test" });
    expect(d.decision).toBe("EXPERIMENTAL");
    expect(d.experimentJustification).toMatch(/NOT a weaker buy signal/);
  });
  test("the SAME failing asset WITHOUT a hypothesis is not excused", () => {
    const at = attributeDemand({ measuredVolume: 20, sharedCityName: false, geoScopedUniverseVolume: null, serpLocalized: true, cityName: "X" });
    const d = decide({ searchOpportunity: so(at), capturability: cap(73), monetization: mon({ attributableDemand: 20 }),
      attribution: at, renterEvidenceAvailable: true, viableRenters: 3, preRegisteredHypothesis: null, experimentRole: null });
    expect(d.decision).not.toBe("EXPERIMENTAL");
  });
});

describe("12. frozen models are unchanged by this work", () => {
  test("ai-v1.0.0 rankability output is byte-identical for a fixed evidence bundle", () => {
    const ev = { dirs: 2, inner: 3, titleTargeting: 1, franchise: 0, mapCount: 3, mapReviews: 60, mapNoWebsite: 0, contentWords: 208, domainAge: 3.9 };
    const r = rankability(ev);
    expect(r.score).toBe(92);          // the frozen Bellevue NE value
    expect(r.version).toBe("A-1.0.0");
  });
  test("the frozen composite still uses w-balanced-v1.1 and is unaffected", () => {
    const s = scoreOpportunity("x", { vol: 480, cpc: 8, dirs: 2, inner: 4, mapCount: 3, mapReviews: 20, opViable: 3, opRelevant: 10, ticketAvg: 5000, margin: 0.5 }, WEIGHTS_DEFAULT, 1000);
    expect(s.weightSetId).toBe("w-balanced-v1.1");
    expect(s.modelVersion).toBe("ai-v1.0.0");
  });
});

describe("13-14. determinism and provenance", () => {
  test("13. identical inputs produce identical decisions", () => {
    const mk = () => decide({ searchOpportunity: so(localDemand(480)), capturability: cap(62), monetization: mon(),
      attribution: localDemand(480), renterEvidenceAvailable: true, viableRenters: 3, preRegisteredHypothesis: null, experimentRole: null });
    expect(JSON.stringify(mk())).toBe(JSON.stringify(mk()));
    expect(mk().modelVersion).toBe(DECISION_VERSION);
  });
  test("14. every economic assumption is labelled HUMAN_ASSUMED and none is model-generated", () => {
    const m = mon();
    expect(m.assumedInputs.join(" ")).toMatch(/HUMAN_ASSUMED/);
    expect(m.profile.basis).toMatch(/^HUMAN_ASSUMED/);
    expect(m.confidence).toBeLessThanOrEqual(0.4);   // assumption-driven => capped confidence
  });
});

describe("capturability threshold provenance", () => {
  test("the PASS bar is the pre-registered Wave-1 Group-A standard, not a new invention", () => {
    expect(CAPTURABILITY_PASS).toBe(55);
    expect(cap(55).gate).toBe("PASS");
    expect(cap(54).gate).toBe("UNKNOWN");
    expect(cap(44).gate).toBe("FAIL");
  });
});
