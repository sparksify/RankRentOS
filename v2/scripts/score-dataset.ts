// Score the Experiment 1/1.5 researched dataset with A–I v1 + sensitivity analysis.
// Persists score runs to Supabase. No deployment, no purchases, no forced portfolio.
import { readFileSync, writeFileSync } from "fs";
import { createSupabaseStore } from "../lib/store/supabase";
import { scoreOpportunity, bucketOf, WEIGHT_SETS, WEIGHTS_DEFAULT } from "../lib/scoring/composite";
import { MODEL_VERSION, type Ev } from "../lib/scoring/dimensions";

const OUT = new URL("../../out/scoring-v1/", import.meta.url);
const cands = JSON.parse(readFileSync(new URL("../../out/experiment-1_5/candidates-final.json", import.meta.url), "utf8"));
const NICHE_ECON: Record<string, { ticket: number; margin: number }> = JSON.parse(readFileSync(new URL("../../data/niches.json", import.meta.url), "utf8"))
  .reduce((a: any, n: any) => { a[n.id] = { ticket: (n.ticketLow + n.ticketHigh) / 2, margin: n.margin }; return a; }, {});
// community-only services absent from niches.json (documented HUMAN_ASSUMED)
const EXTRA: Record<string, { ticket: number; margin: number }> = {
  "pool-builder": { ticket: 70000, margin: 0.35 }, pergolas: { ticket: 15000, margin: 0.45 },
  "garage-door-repair": { ticket: 700, margin: 0.5 }, "pressure-washing": { ticket: 400, margin: 0.6 },
  "solar-installation": { ticket: 25000, margin: 0.25 }, "house-cleaning": { ticket: 200, margin: 0.5 },
};

const toEv = (c: any): Ev => {
  const econ = NICHE_ECON[c.niche] || EXTRA[c.niche] || null;
  const s = c.signals || {}, o = c.operators || {};
  const uniValid = c.universe && c.universe.corePct !== null && c.universe.corePct >= 10; // reject national leaks
  return {
    vol: typeof c.vol === "number" ? c.vol : null,
    cpc: c.cpc ?? c.v0?.signals?.cpc ?? null,
    universeVolume: uniValid ? c.universe.volume : null, universeGeoScoped: !!uniValid, universeCorePct: c.universe?.corePct ?? null,
    acFloor: c.acFloor ?? null,
    dirs: s.directoriesInTop3 ?? null, inner: s.innerPagesInTop5 ?? null, intentMismatch: s.intentMismatchInTop5 ?? null,
    outOfTown: s.outOfTownInTop3 ?? null, franchise: s.franchisesInTop3 ?? null, titleTargeting: s.top3TitlesMissingCity ?? null,
    ads: s.adCount ?? null, mapCount: s.mapPackSize ?? null, mapReviews: s.avgMapReviews ?? null, mapNoWebsite: s.mapListingsWithoutWebsite ?? null,
    contentWords: c.contentDepth ?? null, domainAge: c.domainAge ?? null,
    opRelevant: o.relevantOperatorCount ?? null, opViable: o.viableOperatorCount ?? null, opStrong: o.strongerOperatorCount ?? null,
    opMedReviews: o.medianReviews ?? null, opWebPct: o.websiteAdoptionPct ?? null, opAdvertisers: o.advertiserCount ?? null,
    opConcentration: o.concentration ?? null, opMultiSource: o.multiSourceCount ?? null,
    ticketAvg: econ?.ticket ?? null, margin: econ?.margin ?? null,
    domainAvailable: c.domainAvailable ?? null, freshnessDays: 1,
  };
};

const eligible = cands.filter((c: any) => c.signals?.mapPackSize !== undefined || c.operators?.relevantOperatorCount);
const results = eligible.map((c: any) => {
  const ev = toEv(c);
  const s = scoreOpportunity(c.id, ev, WEIGHTS_DEFAULT);
  const b = bucketOf(s, ev);
  const sens = WEIGHT_SETS.map((w) => ({ w: w.id, composite: scoreOpportunity(c.id, ev, w).composite }));
  return { id: c.id, strata: c.strata, ev, score: s, bucket: b, sens };
});
results.sort((a: any, b: any) => (b.score.composite ?? -1) - (a.score.composite ?? -1));

// ---- sensitivity: rank stability across weight sets ----
const rankBy: Record<string, string[]> = {};
for (const w of WEIGHT_SETS) rankBy[w.id] = [...results].sort((a: any, b: any) => (b.sens.find((x: any) => x.w === w.id)!.composite ?? -1) - (a.sens.find((x: any) => x.w === w.id)!.composite ?? -1)).map((r: any) => r.id);
const stability = results.map((r: any) => {
  const ranks = WEIGHT_SETS.map((w) => rankBy[w.id].indexOf(r.id) + 1);
  return { id: r.id, best: Math.min(...ranks), worst: Math.max(...ranks), spread: Math.max(...ranks) - Math.min(...ranks), ranks };
}).sort((a, b) => a.worst - b.worst);

writeFileSync(new URL("scores.json", OUT), JSON.stringify({ modelVersion: MODEL_VERSION, results, stability, rankBy }, null, 1));

// ---- persist score runs to Supabase ----
const store = createSupabaseStore();
const run = await store.beginRun("scoring-v1", `${MODEL_VERSION}-${WEIGHTS_DEFAULT.id}-v2-${results.length}`, { stage: 5, budgetCapUsd: 0 });
if (!(run.existing && run.run.status === "completed")) {
  const obs = results.filter((r: any) => r.score.composite !== null).map((r: any) => ({
    subjectType: "market", subjectId: r.id, metric: "score.composite", value: r.score.composite,
    source: `${MODEL_VERSION}:${WEIGHTS_DEFAULT.id}`, evidenceType: "DERIVED" as const,
    confidence: (r.score.confidenceScore ?? 50) / 100, observedAt: Date.now(), runId: run.run.id,
  }));
  for (const r of results) {
    const base = { subjectType: "market" as const, subjectId: r.id, source: `${MODEL_VERSION}:${WEIGHTS_DEFAULT.id}`, evidenceType: "DERIVED" as const, confidence: 0.9, observedAt: Date.now(), runId: run.run.id };
    if (r.score.confidenceScore !== null) obs.push({ ...base, metric: "score.confidence", value: r.score.confidenceScore });
    obs.push({ ...base, metric: "score.completeness", value: r.score.evidenceCompleteness });
    obs.push({ ...base, metric: "score.bucket", value: r.bucket.bucket ?? "none" });
  }
  await store.insertBatch(obs);
  await store.completeRun(run.run.id, 0);
}

console.log(`=== A–I v1 (${MODEL_VERSION}) — ${results.length} researched opportunities ===\n`);
console.log("rank score conf compl | A  B  C  D  E  F  G  H | bucket        | opportunity");
results.forEach((r: any, i: number) => {
  const d = r.score.dims, n = (k: string) => String(d[k].score ?? "--").padStart(2);
  console.log(`${String(i + 1).padStart(2)}. ${String(r.score.composite ?? "--").padStart(3)} ${String(r.score.confidenceScore).padStart(4)} ${String(r.score.evidenceCompleteness).padStart(4)}% | ${n("A")} ${n("B")} ${n("C")} ${n("D")} ${n("E")} ${n("F")} ${n("G")} ${n("H")} | ${(r.bucket.bucket ?? "—").padEnd(13)} | ${r.id} [${r.strata}]`);
});
const byBucket = results.reduce((a: any, r: any) => { const k = r.bucket.bucket ?? "unbucketed"; (a[k] ||= []).push(r.id); return a; }, {});
console.log("\nBUCKETS:", Object.entries(byBucket).map(([k, v]: any) => `${k}=${v.length}`).join(" "));
console.log("\nMOST STABLE (worst rank across all 5 weightings):");
stability.slice(0, 6).forEach((s) => console.log(`  ${s.id}: best #${s.best} worst #${s.worst} spread ${s.spread}`));
console.log("MOST WEIGHT-SENSITIVE:");
[...stability].sort((a, b) => b.spread - a.spread).slice(0, 5).forEach((s) => console.log(`  ${s.id}: spread ${s.spread} (ranks ${s.ranks.join(",")})`));
