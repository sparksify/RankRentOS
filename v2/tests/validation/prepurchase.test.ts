import { test, expect, describe } from "vitest";
import { validateCommercialIntent, validateExpansionSurface, assessCannibalization, applyPrePurchaseGate, previewArchitecture } from "../../lib/validation/prepurchase";
import type { OrganicSlot } from "../../lib/serp/organic";

const slot = (position: number, host: string, slotClass: any): OrganicSlot =>
  ({ position, host, slotClass, displaceable: false, isInnerPage: false, targetsGeoInTitle: false, geoInDomain: false });

describe("commercial intent gate (the Conroe failure mode)", () => {
  test("a retail/informational SERP with no local operator FAILS regardless of other metrics", () => {
    // the actual Conroe top-5: wikipedia, ikea, lowes, homedepot, houzz
    const r = validateCommercialIntent({
      slots: [slot(1, "en.wikipedia.org", "reference"), slot(2, "ikea.com", "national-brand"),
        slot(3, "lowes.com", "directory"), slot(4, "homedepot.com", "directory"), slot(5, "houzz.com", "directory")],
      adCount: 0, mapPackSize: 3, cpc: 22.19,
    });
    expect(r.intentClass).toBe("RETAIL_PRODUCT");
    expect(r.verdict).toBe("FAIL");
    expect(r.evidence.localOperatorsTop10).toBe(0);
    // a present map pack must NOT rescue it
    expect(r.explanation).toMatch(/not showing people hiring/);
  });

  test("a genuine local-hire SERP passes", () => {
    const r = validateCommercialIntent({
      slots: [slot(1, "prestigepp.com", "local-specialist"), slot(2, "venturecustompools.com", "local-specialist"),
        slot(3, "selahpools.com", "local-specialist"), slot(4, "yelp.com", "directory"), slot(5, "angi.com", "marketplace")],
      adCount: 2, mapPackSize: 3, cpc: 5.23,
    });
    expect(r.intentClass).toBe("LOCAL_COMMERCIAL");
    expect(r.verdict).toBe("PASS");
  });

  test("diluted intent warns rather than passing cleanly", () => {
    const r = validateCommercialIntent({
      slots: [slot(1, "somepools.com", "local-specialist"), slot(2, "yelp.com", "directory"),
        slot(3, "homedepot.com", "directory"), slot(4, "thespruce.com", "national-content")],
      adCount: 0, mapPackSize: 0, cpc: null,
    });
    expect(["MIXED_COMMERCIAL", "LOCAL_COMMERCIAL"]).toContain(r.intentClass);
    expect(r.verdict).not.toBe("FAIL");
  });

  test("no organic evidence is NEEDS_REVIEW, never a pass", () => {
    const r = validateCommercialIntent({ slots: [], adCount: null, mapPackSize: null, cpc: null });
    expect(r.verdict).toBe("NEEDS_REVIEW");
    expect(r.score).toBeNull();
  });
});

describe("expansion surface never multiplies raw counts", () => {
  test("unmeasured services are excluded, not assumed viable", () => {
    const r = validateExpansionSurface({
      headService: "Pool Builder", headVolume: 320,
      relatedServices: [{ service: "Pool Remodeling", volume: 210 }, { service: "Pool Cleaning", volume: null }, { service: "Hot Tub", volume: 10 }],
      areas: [{ area: "Celina", basis: "same county" }], geographyConfidence: "approximate-adjacency",
    });
    expect(r.evidence.viableServiceCount).toBe(2);          // head + Pool Remodeling only
    expect(r.evidence.notes.join(" ")).toMatch(/EXCLUDED/);
  });
  test("many pages on thin demand is flagged as thin-content risk", () => {
    const r = validateExpansionSurface({
      headService: "X", headVolume: 110,
      relatedServices: [{ service: "a", volume: 50 }, { service: "b", volume: 60 }, { service: "c", volume: 55 }, { service: "d", volume: 50 }, { service: "e", volume: 50 }],
      areas: Array.from({ length: 10 }, (_, i) => ({ area: `A${i}`, basis: "state" })), geographyConfidence: "approximate-adjacency",
    });
    expect(r.evidence.thinContentRisk).toBe(true);
    expect(r.verdict).toBe("PASS_WITH_WARNING");
  });
  test("a lone head keyword with no areas needs review", () => {
    const r = validateExpansionSurface({ headService: "X", headVolume: 200, relatedServices: [], areas: [], geographyConfidence: "unknown" });
    expect(r.verdict).toBe("NEEDS_REVIEW");
  });
});

describe("cannibalization", () => {
  test("flags the home vs head-service vs area collision", () => {
    const arch = previewArchitecture({ headService: "Roof Repair", geography: "Frisco", services: ["Roof Replacement"], areas: ["Plano"] });
    const r = assessCannibalization({ headService: "Roof Repair", geography: "Frisco", services: ["Roof Replacement"], areas: ["Plano"], estimatedPages: arch.estimatedPages });
    expect(r.evidence.conflictGroups.length).toBeGreaterThan(0);
    expect(r.evidence.recommendations.join(" ")).toMatch(/home page/i);
  });
});

describe("the gate", () => {
  const ok = { verdict: "PASS" as const, score: 70, confidence: 0.8, explanation: "", evidence: {}, version: "v" };
  test("zero viable renters is a hard blocker", () => {
    const g = applyPrePurchaseGate({
      intent: { ...ok, intentClass: "LOCAL_COMMERCIAL" }, expansion: ok, cannibalization: ok, localDepth: ok, visual: ok,
      viableRenters: 0, renterEvidenceAvailable: true, organicScore: 70, measuredVolume: 500, assetValueF: 60, geographyVerdict: "verified", demandProven: true,
    });
    expect(g.status).toBe("FAIL");
    expect(g.readyForPurchaseDecision).toBe(false);
    expect(g.blockers.join(" ")).toMatch(/nobody to rent/);
  });
  test("failed intent blocks even when every number is good", () => {
    const g = applyPrePurchaseGate({
      intent: { ...ok, verdict: "FAIL", intentClass: "RETAIL_PRODUCT", explanation: "retail serp" },
      expansion: ok, cannibalization: ok, localDepth: ok, visual: ok,
      viableRenters: 3, renterEvidenceAvailable: true, organicScore: 80, measuredVolume: 2400, assetValueF: 92, geographyVerdict: "verified", demandProven: true,
    });
    expect(g.status).toBe("FAIL");
  });
  test("a clean opportunity passes and is ready for a human decision", () => {
    const g = applyPrePurchaseGate({
      intent: { ...ok, intentClass: "LOCAL_COMMERCIAL" }, expansion: ok, cannibalization: ok, localDepth: ok, visual: ok,
      viableRenters: 3, renterEvidenceAvailable: true, organicScore: 62, measuredVolume: 390, assetValueF: 66, geographyVerdict: "verified", demandProven: true,
    });
    expect(g.status).toBe("PASS");
    expect(g.readyForPurchaseDecision).toBe(true);
  });
  test("an empty map pack is UNKNOWN renter depth, not zero renters", () => {
    const g = applyPrePurchaseGate({
      intent: { ...ok, intentClass: "LOCAL_COMMERCIAL" }, expansion: ok, cannibalization: ok, localDepth: ok, visual: ok,
      viableRenters: null, renterEvidenceAvailable: false, organicScore: 79, measuredVolume: 0, assetValueF: null,
      geographyVerdict: "verified", demandProven: false,
    });
    expect(g.blockers).toHaveLength(0);
    expect(g.warnings.join(" ")).toMatch(/not evidence that no renter exists/);
  });
  test("a control is exempt from the demand floor by design", () => {
    const g = applyPrePurchaseGate({
      intent: { ...ok, intentClass: "LOCAL_COMMERCIAL" }, expansion: ok, cannibalization: ok, localDepth: ok, visual: ok,
      viableRenters: 3, renterEvidenceAvailable: true, isControl: true, organicScore: 36, measuredVolume: 10,
      assetValueF: null, geographyVerdict: "verified", demandProven: true,
    });
    expect(g.blockers).toHaveLength(0);
  });
  test("community assets are not blocked by the demand floor (demand is the hypothesis)", () => {
    const g = applyPrePurchaseGate({
      intent: { ...ok, intentClass: "LOCAL_COMMERCIAL" }, expansion: ok, cannibalization: ok, localDepth: ok, visual: ok,
      viableRenters: 2, renterEvidenceAvailable: true, organicScore: 73, measuredVolume: 0, assetValueF: null, geographyVerdict: "verified", demandProven: false,
    });
    expect(g.blockers).toHaveLength(0);
  });
});
