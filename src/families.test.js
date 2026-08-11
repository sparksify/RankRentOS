// node --test src/families.test.js
import { test } from "node:test";
import assert from "node:assert";
import { hypothesisType, industryOf, qualifiesForDeepResearch, specializationOpportunity, buildFamilies, clusterExpansionPotential, recommendFirstExperiment } from "./families.js";

const IND = {
  roofing: { label: "Roofing", services: [
    { id: "roofing", label: "Roofing", parentService: null },
    { id: "metal-roofing", label: "Metal Roofing", parentService: "roofing" },
  ]},
};

test("distinguishes broad vs specialist hypotheses", () => {
  assert.equal(hypothesisType("metal-roofing", IND), "specialist"); // Metal Roofing x Kansas City
  assert.equal(hypothesisType("roofing", IND), "service");          // Roofing x Kansas City
  assert.equal(hypothesisType("dumpster-rental", IND), "broad");    // not in taxonomy
  assert.equal(industryOf("metal-roofing", IND), "roofing");
});

test("family associates multiple hypotheses; requires >=2 members", () => {
  const opps = [
    { nicheId: "roofing", niche: "Roofing", city: "Kansas City", state: "MO", overallOpportunity: 50 },
    { nicheId: "metal-roofing", niche: "Metal Roofing", city: "Kansas City", state: "MO", overallOpportunity: 60 },
    { nicheId: "roofing", niche: "Roofing", city: "Lone", state: "AK", overallOpportunity: 50 },
  ];
  const fams = buildFamilies(opps, IND);
  assert.equal(fams.length, 1); // AK singleton excluded
  assert.equal(fams[0].members.length, 2); // both KC hypotheses share the family
});

test("cheap gate filters low-quality combos before paid research", () => {
  assert.equal(qualifiesForDeepResearch({ vol: 0, evidenceCount: 0 }), false);
  assert.equal(qualifiesForDeepResearch({ vol: 90 }), true);
  assert.equal(qualifiesForDeepResearch({ vol: 0, parentScore: 60, evidenceCount: 2 }), true);
  assert.equal(qualifiesForDeepResearch({ vol: 0, parentScore: 30, evidenceCount: 5 }), false);
});

test("family scoring does not inflate member scores", () => {
  const m = { nicheId: "roofing", niche: "Roofing", city: "KC", state: "MO", overallOpportunity: 47, rentHigh: 800, dataConfidence: "medium" };
  const fam = { members: [m, { ...m, city: "Liberty" }, { ...m, city: "Olathe", state: "MO" }] };
  const before = m.overallOpportunity;
  clusterExpansionPotential(fam);
  assert.equal(m.overallOpportunity, before); // untouched
});

test("cluster potential rewards independent viability, not town count", () => {
  const viable = (city) => ({ nicheId: "roofing", city, state: "MO", overallOpportunity: 60, rentHigh: 1200, dataConfidence: "medium" });
  const dud = (city) => ({ nicheId: "roofing", city, state: "MO", overallOpportunity: 20, rentHigh: 100, dataConfidence: "low" });
  const strong = clusterExpansionPotential({ members: [viable("A"), viable("B"), viable("C")] });
  const sprawl = clusterExpansionPotential({ members: [viable("A"), dud("B"), dud("C"), dud("D"), dud("E"), dud("F")] });
  assert.ok(strong.score > sprawl.score, `3 viable (${strong.score}) must beat 1 viable + 5 duds (${sprawl.score})`);
});

test("specialization: missing evidence -> null score + none confidence, never invented", () => {
  const s = specializationOpportunity({ signals: {} }, undefined);
  assert.equal(s.score, null);
  assert.equal(s.confidence, "none");
  assert.equal(s.components.serpWeaknessDelta, null);
});

test("specialization: weak specialist SERP vs strong parent scores high, deterministically", () => {
  const specialist = { rankability: 75, signals: { volume: 200, cpc: 12, competitorAvgWords: 300 } };
  const parent = { rankability: 25, signals: { volume: 1000, cpc: 8, competitorAvgWords: 1800 } };
  const a = specializationOpportunity(specialist, parent);
  const b = specializationOpportunity(specialist, parent);
  assert.deepEqual(a, b); // deterministic
  assert.ok(a.score >= 75, `strong mismatch should score high, got ${a.score}`);
  assert.equal(a.confidence, "medium");
});

test("confidence stays separate from opportunity strength", () => {
  const highScoreLowConf = { nicheId: "roofing", city: "A", state: "MO", overallOpportunity: 90, rentHigh: 3000, dataConfidence: "low" };
  const fam = { members: [highScoreLowConf, { ...highScoreLowConf, city: "B" }] };
  const cep = clusterExpansionPotential(fam);
  assert.ok(cep.score >= 35 && cep.score < 60); // strength registers, small cluster stays modest
  assert.equal(cep.familyConfidence, "low");    // confidence honestly low, independent of strength
});

test("first experiment prefers confidence-weighted asymmetry", () => {
  const fam = { members: [
    { niche: "Roofing", city: "A", state: "MO", overallOpportunity: 70, rankability: 40, dataConfidence: "low", signals: {} },
    { niche: "Metal Roofing", city: "B", state: "MO", overallOpportunity: 65, rankability: 70, dataConfidence: "high", rentHigh: 1500, signals: { volume: 200 } },
  ]};
  const r = recommendFirstExperiment(fam);
  assert.equal(r.pick.city, "B"); // high-confidence weak-SERP beats low-confidence higher raw score
  assert.ok(r.why.length >= 2);
});
