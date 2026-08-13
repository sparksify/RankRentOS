// PRE-PURCHASE VALIDATION RUN (validation-run-1)
// Runs the deterministic validation stage against the FROZEN Wave-1 finalists plus
// reserve candidates close enough to the cutoff that validation could change the call.
// Preserves the frozen run untouched and writes a NEW versioned artifact.
// No provider spend: every input is evidence already collected.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "fs";
import { organicRankability } from "../lib/serp/organic";
import { parseSerpResponse } from "../lib/providers/serpapi";
import {
  validateCommercialIntent, validateExpansionSurface, previewArchitecture,
  assessCannibalization, assessLocalContentDepth, assessVisualFeasibility,
  applyPrePurchaseGate, VALIDATION_VERSION,
} from "../lib/validation/prepurchase";

const ROOT = new URL("../../", import.meta.url);
const OUT = new URL("out/wave-1-experiment/", ROOT);
const APPDATA = new URL("app/data/", ROOT);
mkdirSync(APPDATA, { recursive: true });

const frozen = JSON.parse(readFileSync(new URL("portfolio-v2.json", OUT), "utf8"));
const scored = [
  ...(JSON.parse(readFileSync(new URL("out/experiment-2/stage4-scored.json", ROOT), "utf8")) as any[]).map((r) => ({ ...r, exp: "experiment-2" })),
  ...(JSON.parse(readFileSync(new URL("out/experiment-3/stage4-scored.json", ROOT), "utf8")) as any[]).map((r) => ({ ...r, exp: "experiment-3" })),
];
const comms = JSON.parse(readFileSync(new URL("nt-community-serp.json", OUT), "utf8")) as any[];
const depth = JSON.parse(readFileSync(new URL("cluster-depth.json", OUT), "utf8"));
const cities = JSON.parse(readFileSync(new URL("data/cities-national.json", ROOT), "utf8")) as any[];

// ---------- measured-demand corpus: every keyword we have ever measured ----------
// Used to find OTHER services with real demand in a market (expansion surface) and
// other markets with real demand for the same service (geographic surface).
const corpus = new Map<string, number | null>();
const addRaw = (raw: any) => {
  for (const r of raw?.tasks?.[0]?.result ?? []) corpus.set(String(r.keyword).toLowerCase(), typeof r.search_volume === "number" ? r.search_volume : null);
};
for (const dir of ["out/experiment-2", "out/experiment-3", "out/wave-1-experiment"]) {
  const d = new URL(`${dir}/`, ROOT);
  if (!existsSync(d)) continue;
  for (const f of readdirSync(d)) {
    if (!f.includes("volume") || !f.endsWith(".json")) continue;
    try {
      const j = JSON.parse(readFileSync(new URL(f, d), "utf8"));
      if (Array.isArray(j)) j.forEach((b: any) => addRaw(b.raw)); else addRaw(j);
    } catch { /* skip unreadable */ }
  }
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
/** Services (other than the head) with MEASURED demand in this geography. */
function relatedServicesIn(geography: string, headService: string) {
  const g = norm(geography), out: { service: string; volume: number | null }[] = [];
  for (const [kw, vol] of corpus) {
    if (!kw.endsWith(` ${g}`)) continue;
    const svc = kw.slice(0, kw.length - g.length - 1).trim();
    if (!svc || norm(headService).includes(svc) || svc === norm(headService)) continue;
    out.push({ service: svc.replace(/\b\w/g, (c) => c.toUpperCase()), volume: vol });
  }
  return out.sort((a, b) => (b.volume ?? -1) - (a.volume ?? -1)).slice(0, 12);
}
/** Nearby markets where the SAME service has measured demand. Adjacency is approximate. */
function areasFor(geography: string, state: string, headService: string) {
  const svc = norm(headService), out: { area: string; basis: string }[] = [];
  const inState = new Set(cities.filter((c) => c.state === state).map((c) => norm(c.city)));
  for (const [kw, vol] of corpus) {
    if (!kw.startsWith(`${svc} `)) continue;
    const area = kw.slice(svc.length + 1).trim();
    if (!area || area === norm(geography) || !inState.has(area)) continue;
    if (typeof vol !== "number" || vol < 50) continue;   // only areas with real demand
    out.push({ area: area.replace(/\b\w/g, (c) => c.toUpperCase()), basis: `same state, ${vol}/mo measured demand for this service` });
  }
  return out.slice(0, 10);
}

// ---------- assemble the validation set: finalists + reserves ----------
type Row = { key: string; source: "FINALIST" | "RESERVE"; asset: any };
const rows: Row[] = frozen.assets.map((a: any) => ({ key: `${a.service}|${a.geography}`, source: "FINALIST" as const, asset: a }));
const inWave = new Set(rows.map((r) => r.key));

// Reserves: researched candidates close enough that validation could flip the call —
// bucketed, or within 10 points of the Group-A organic bar with rentable economics.
for (const r of scored) {
  const key = `${r.svcLabel}|${r.city}`;
  if (inWave.has(key)) continue;
  const f = new URL(`out/${r.exp}/raw/serp-${r.id.replace(/[^a-z0-9]/gi, "_")}.json`, ROOT);
  if (!existsSync(f)) continue;
  const p: any = parseSerpResponse(JSON.parse(readFileSync(f, "utf8")));
  const o = organicRankability({
    organic: (p.organic || []).map((x: any, i: number) => ({ link: x.link, title: x.title, position: x.position ?? i + 1 })),
    geo: r.city, serviceTerms: r.svcLabel.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3).map((w: string) => w.replace(/(ing|ers|er|s)$/, "")),
    competitorAvgWords: r.signals.competitorAvgWords, competitorAvgDomainAgeYears: r.signals.competitorAvgDomainAgeYears,
  });
  const nearBar = (o.score ?? 0) >= 45 && (r.score.dims.F.score ?? 0) >= 50 && (r.vol ?? 0) >= 100;
  if (!(r.bucket || nearBar)) continue;
  rows.push({ key, source: "RESERVE", asset: {
    experimentId: `RES-${r.id.replace(/[^a-z0-9]/gi, "-")}`, cohort: "RESERVE", service: r.svcLabel, serviceSlug: r.svc,
    geography: r.city, state: r.state, geographyType: "city", measuredVolume: r.vol, cpc: r.cpc, demandProven: true,
    dimensionA: r.score.dims.A.score, organicV1: o.score, organicVerdict: o.verdict,
    renterDepthE: r.score.dims.E.score, leadEconomicsD: r.score.dims.D.score, assetValueF: r.score.dims.F.score,
    asymmetryH: r.score.dims.H.score, compositeAI: r.score.composite, aiBucket: r.bucket,
    evidenceConfidence: r.score.confidenceScore, evidenceCompleteness: r.score.evidenceCompleteness,
    ticketAssumed: r.ticket, marginAssumed: r.margin, leadValueAssumedUsd: Math.round(r.ticket * r.margin * 0.1),
    renterContext: { relevantOperators: r.operators.relevantOperatorCount, viableRenters: r.operators.viableOperatorCount, websiteAdoptionPct: r.operators.websiteAdoptionPct },
    localPackEvidence: { mapPackSize: r.signals.mapPackSize, avgReviews: r.signals.avgMapReviews },
    contentBarWords: r.signals.competitorAvgWords, competitorDomainAgeYears: r.signals.competitorAvgDomainAgeYears,
    _serpSignals: r.signals, _exp: r.exp, _id: r.id, geographyVerdict: "verified",
  } });
}

// Full A–I detail, keyed by service|city|state, so the cockpit can show every
// dimension with its own value, version, confidence and rationale — never "n/a"
// for a dimension that was in fact scored.
const dimsBySubject = new Map<string, any>();
for (const r of scored) {
  const d = r.score.dims;
  dimsBySubject.set(`${r.svcLabel}|${r.city}`, {
    A: d.A, B: d.B, C: d.C, D: d.D, E: d.E, F: d.F, G: d.G, H: d.H, I: d.I,
    composite: r.score.composite, weightSet: r.score.weightSetId,
    unscored: r.score.unscoredDimensions, assumptionDependent: r.score.assumptionDependentDimensions,
    prospective: r.score.prospectiveDimensions, topDrivers: r.score.topDrivers, biggestGap: r.score.biggestGap,
  });
}

// ---------- run validation ----------
const results: any[] = [];
for (const { key, source, asset: a } of rows) {
  const isCommunity = a.geographyType === "master-planned-community";
  const community = isCommunity ? comms.find((c) => c.name === a.geography && c.kind === "community") : null;
  const rawPath = isCommunity || a.geographyType === "city-control"
    ? new URL(`raw/serp-pool_builder_${a.geography.replace(/[^a-z0-9]/gi, "_")}_TX.json`, OUT)
    : a._exp ? new URL(`out/${a._exp}/raw/serp-${a._id.replace(/[^a-z0-9]/gi, "_")}.json`, ROOT)
    : (() => { for (const e of ["experiment-2", "experiment-3"]) { const f = new URL(`out/${e}/raw/serp-${`${a.serviceSlug}|${a.geography}|${a.state}`.replace(/[^a-z0-9]/gi, "_")}.json`, ROOT); if (existsSync(f)) return f; } return null; })();

  let slots: any[] = [], signals: any = a._serpSignals ?? null;
  if (rawPath && existsSync(rawPath)) {
    const p: any = parseSerpResponse(JSON.parse(readFileSync(rawPath, "utf8")));
    slots = organicRankability({
      organic: (p.organic || []).map((x: any, i: number) => ({ link: x.link, title: x.title, position: x.position ?? i + 1 })),
      geo: a.geography, serviceTerms: a.service.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3).map((w: string) => w.replace(/(ing|ers|er|s)$/, "")),
      geoType: isCommunity ? "community" : "city",
      competitorAvgWords: a.contentBarWords ?? null, competitorAvgDomainAgeYears: a.competitorDomainAgeYears ?? null,
    }).slots;
    if (!signals && community) signals = community.signals;
  }

  const intent = validateCommercialIntent({
    slots, adCount: signals?.adCount ?? a.localPackEvidence?.adCount ?? null,
    mapPackSize: a.localPackEvidence?.mapPackSize ?? signals?.mapPackSize ?? null, cpc: a.cpc ?? null,
  });

  // expansion inputs
  const geoForCorpus = isCommunity ? (a.parentCity ?? a.geography) : a.geography;
  const related = relatedServicesIn(geoForCorpus, a.service);
  const areas = isCommunity
    ? comms.filter((c) => c.kind === "community" && c.city === a.parentCity && c.name !== a.geography)
        .slice(0, 8).map((c) => ({ area: c.name, basis: `neighbouring master-planned community in ${a.parentCity}` }))
    : areasFor(a.geography, a.state, a.service);
  const expansion = validateExpansionSurface({
    headService: a.service, headVolume: typeof a.measuredVolume === "number" && a.measuredVolume > 0 ? a.measuredVolume : null,
    relatedServices: related, areas,
    geographyConfidence: isCommunity ? "measured" : "approximate-adjacency",
  });
  const arch = previewArchitecture({ headService: a.service, geography: a.geography,
    services: expansion.evidence.primaryServices.slice(1).map((s: any) => s.service), areas: areas.map((x) => x.area) });
  const cannibal = assessCannibalization({ headService: a.service, geography: a.geography,
    services: expansion.evidence.primaryServices.slice(1).map((s: any) => s.service), areas: areas.map((x) => x.area), estimatedPages: arch.estimatedPages });
  const localDepth = assessLocalContentDepth({
    geography: a.geography, geographyType: a.geographyType, areas: areas.map((x) => x.area),
    population: a.communityHomes ? null : (cities.find((c) => c.city === a.geography && c.state === a.state)?.pop ?? null),
    medianIncome: cities.find((c) => c.city === (isCommunity ? a.parentCity : a.geography) && c.state === a.state)?.income ?? null,
    competitorContentBarWords: a.contentBarWords ?? depth[a.geography]?.words ?? null,
    communityHomes: a.communityHomes ?? null,
  });
  const visual = assessVisualFeasibility(a.serviceSlug);
  // Community queries return the PARENT CITY's map pack (established in the NTX
  // research). When a community's own query returned no pack, renter depth is
  // inherited from that parent city rather than being recorded as zero.
  let viableRenters = a.renterContext?.viableRenters ?? a.renterContext?.viableRentersInCommunityPack ?? null;
  let renterEvidenceAvailable = (signals?.mapPackSize ?? a.localPackEvidence?.mapPackSize ?? 0) > 0;
  let renterNote: string | null = null;
  if (isCommunity && !renterEvidenceAvailable) {
    const parent = comms.find((c) => c.name === a.parentCity && c.kind === "city-control");
    if (parent) {
      viableRenters = parent.operators.viableOperatorCount;
      renterEvidenceAvailable = true;
      renterNote = `No map pack was returned for this community query, so renter depth is inherited from the parent-city pack (${a.parentCity}): ${viableRenters} viable renter(s). Google returns the city pack for community queries, so these are the operators who would serve this community.`;
    }
  }
  const gate = applyPrePurchaseGate({
    intent, expansion, cannibalization: cannibal, localDepth, visual,
    viableRenters, renterEvidenceAvailable, isControl: a.geographyType === "city-control",
    organicScore: a.organicV1 ?? null, measuredVolume: a.measuredVolume ?? null,
    assetValueF: a.assetValueF ?? null, geographyVerdict: a.geographyVerdict ?? null,
    demandProven: a.demandProven !== false,
  });

  const full = dimsBySubject.get(key) ?? null;
  results.push({ key, source, ...a, renterEvidenceNote: renterNote,
    dimensions: full ? {
      A: { score: full.A.score, version: full.A.version, confidence: full.A.confidence, rationale: full.A.rationale, evidenceTypes: full.A.evidenceTypes, missing: full.A.missingMetrics },
      B: { score: full.B.score, version: full.B.version, confidence: full.B.confidence, rationale: full.B.rationale, evidenceTypes: full.B.evidenceTypes, missing: full.B.missingMetrics },
      C: { score: full.C.score, version: full.C.version, confidence: full.C.confidence, rationale: full.C.rationale, evidenceTypes: full.C.evidenceTypes, missing: full.C.missingMetrics },
      D: { score: full.D.score, version: full.D.version, confidence: full.D.confidence, rationale: full.D.rationale, evidenceTypes: full.D.evidenceTypes, missing: full.D.missingMetrics },
      E: { score: full.E.score, version: full.E.version, confidence: full.E.confidence, rationale: full.E.rationale, evidenceTypes: full.E.evidenceTypes, missing: full.E.missingMetrics },
      F: { score: full.F.score, version: full.F.version, confidence: full.F.confidence, rationale: full.F.rationale, evidenceTypes: full.F.evidenceTypes, missing: full.F.missingMetrics },
      G: { score: full.G.score, version: full.G.version, confidence: full.G.confidence, rationale: full.G.rationale, prospective: true, missing: full.G.missingMetrics },
      H: { score: full.H.score, version: full.H.version, confidence: full.H.confidence, rationale: full.H.rationale, missing: full.H.missingMetrics },
      I: { score: full.I.score, version: full.I.version, confidence: full.I.confidence, rationale: full.I.rationale, missing: full.I.missingMetrics },
      composite: full.composite, weightSet: full.weightSet, topDrivers: full.topDrivers, biggestGap: full.biggestGap,
      assumptionDependent: full.assumptionDependent, prospective: full.prospective,
    } : null,
    dimensionsNote: full ? null : "A–I was deliberately not applied to this asset class: Dimension A is calibrated on city SERPs and its map-pack term is meaningless for community queries, where Google returns the parent city's pack.",
    validation: { version: VALIDATION_VERSION, intent, expansion, architecture: arch, cannibalization: cannibal, localDepth, visual, gate,
      renterEvidence: { viableRenters, measured: renterEvidenceAvailable, inheritedFromParentCity: !!renterNote, note: renterNote } } });
}

// ---------- before / after ranking (same deterministic formula, both runs) ----------
const preScore = (r: any) => (r.organicV1 ?? 0) + (r.assetValueF ?? 0) * 0.3 + (r.demandProven === false ? 12 : 0);
const postScore = (r: any) => {
  const g = r.validation.gate.status;
  const penalty = g === "FAIL" ? -1000 : g === "NEEDS_REVIEW" ? -40 : g === "PASS_WITH_WARNING" ? -8 : 0;
  return preScore(r) + penalty + (r.validation.expansion.score ?? 0) * 0.12 + (r.validation.intent.score ?? 0) * 0.15;
};
const finalists = results.filter((r) => r.source === "FINALIST");
// BOTH rankings are computed over the SAME population (finalists + reserves).
// Ranking "before" over finalists only and "after" over everything would make every
// finalist appear to fall purely because the pool grew — an artifact, not a finding.
const before = [...results].sort((a, b) => preScore(b) - preScore(a)).map((r, i) => [r.key, i + 1] as const);
const beforeRank = new Map(before);
const afterAll = [...results].sort((a, b) => postScore(b) - postScore(a)).map((r, i) => [r.key, i + 1] as const);
const afterRank = new Map(afterAll);

// Explanations must describe the DIRECTION of the move. Reporting "commercial intent
// confirmed" against an asset that fell nine places is not an explanation.
const intentContrib = (r: any) => (r.validation.intent.score ?? 0) * 0.15;
const expansionContrib = (r: any) => (r.validation.expansion.score ?? 0) * 0.12;
const med = (xs: number[]) => { const a = [...xs].sort((x, y) => x - y); return a[Math.floor(a.length / 2)] ?? 0; };
const medIntent = med(results.map(intentContrib)), medExpansion = med(results.map(expansionContrib));

const comparison = results.map((r) => {
  const oldR = beforeRank.get(r.key)!, newR = afterRank.get(r.key)!;
  const delta = oldR - newR;
  const g = r.validation.gate;
  const iAbove = intentContrib(r) >= medIntent, eAbove = expansionContrib(r) >= medExpansion;
  const reasons: string[] = [];

  if (g.status === "FAIL") reasons.push(g.blockers[0]!);
  else if (delta > 0) {
    // rose: say WHICH validation factor lifted it
    if (iAbove && eAbove) reasons.push(`Rose because validation confirmed both strong commercial intent (${r.validation.intent.intentClass.replace(/_/g, " ").toLowerCase()}) and an above-average expansion surface (~${r.validation.expansion.evidence.viableCombinations} defensible pages).`);
    else if (iAbove) reasons.push(`Rose on commercial intent: ${r.validation.intent.evidence.localOperatorsTop10} local operators rank organically, stronger hiring intent than most of the field.`);
    else if (eAbove) reasons.push(`Rose on expansion surface: ${r.validation.expansion.evidence.viableServiceCount} services × ${r.validation.expansion.evidence.viableAreaCount} areas support ~${r.validation.expansion.evidence.viableCombinations} defensible pages, above the field median.`);
    else reasons.push("Rose relatively as higher-ranked candidates were penalised by the validation gate.");
  } else if (delta < 0) {
    // fell: say WHAT held it back
    if (g.warnings.length) reasons.push(`Fell on a validation warning: ${g.warnings[0]}`);
    else if (!iAbove && !eAbove) reasons.push(`Fell because both commercial intent and expansion surface came in below the field median — intent reads ${r.validation.intent.intentClass.replace(/_/g, " ").toLowerCase()} and only ~${r.validation.expansion.evidence.viableCombinations} defensible pages were found.`);
    else if (!iAbove) reasons.push(`Fell on commercial intent: only ${r.validation.intent.evidence.localOperatorsTop10} local operator(s) rank organically, weaker hiring intent than peers.`);
    else reasons.push(`Fell on expansion surface: only ~${r.validation.expansion.evidence.viableCombinations} defensible pages (${r.validation.expansion.evidence.viableServiceCount} services × ${r.validation.expansion.evidence.viableAreaCount} areas), below the field median.`);
  } else reasons.push("Position unchanged — validation confirmed the prior read.");

  if (r.validation.expansion.evidence.thinContentRisk) reasons.push("Expansion surface is thin relative to the page count it implies.");
  if (g.warnings.length > 1) reasons.push(g.warnings[1]!);

  return { key: r.key, experimentId: r.experimentId, service: r.service, geography: r.geography, state: r.state,
    cohort: r.cohort, source: r.source, oldRank: oldR, newRank: newR, delta,
    preScore: Math.round(preScore(r)), postScore: Math.round(postScore(r)),
    gate: g.status, intentClass: r.validation.intent.intentClass,
    intentScore: r.validation.intent.score, expansionScore: r.validation.expansion.score,
    primaryReason: reasons[0]!, allReasons: reasons };
});

const run = {
  runId: "validation-run-1", version: VALIDATION_VERSION, generatedAt: "2026-08-12",
  basedOn: { portfolio: "wave1-v3-matched-architecture", frozenAt: frozen.frozen?.frozenAt, preserved: true },
  note: "The frozen Wave-1 run is NOT modified. This is a separate, versioned validation pass whose output feeds the Decision Cockpit and the human purchase decision.",
  counts: { finalists: finalists.length, reserves: results.length - finalists.length,
    pass: results.filter((r) => r.validation.gate.status === "PASS").length,
    passWithWarning: results.filter((r) => r.validation.gate.status === "PASS_WITH_WARNING").length,
    needsReview: results.filter((r) => r.validation.gate.status === "NEEDS_REVIEW").length,
    fail: results.filter((r) => r.validation.gate.status === "FAIL").length },
  funnel: [
    { stage: "Hypotheses generated", count: 3762 }, { stage: "Structurally screened", count: 3744 },
    { stage: "Demand measured", count: 1245 }, { stage: "Demand survivors", count: 168 },
    { stage: "SERP + operator researched", count: 168 }, { stage: "Scored (A–I)", count: 168 },
    { stage: "Bucketed", count: 44 }, { stage: "Wave-1 finalists", count: finalists.length },
    { stage: "Validated (ready for decision)", count: results.filter((r) => r.source === "FINALIST" && r.validation.gate.readyForPurchaseDecision).length },
  ],
  economics: frozen.economics, purchaseList: frozen.purchaseList, matchedPairs: frozen.matchedPairs,
  preRegistration: frozen.preRegistration,
  comparison, assets: results,
};
writeFileSync(new URL("validation-run-1.json", OUT), JSON.stringify(run, null, 1));
writeFileSync(new URL("cockpit.json", APPDATA), JSON.stringify(run, null, 1));

console.log(`PRE-PURCHASE VALIDATION — ${VALIDATION_VERSION}`);
console.log(`validated ${results.length} (${finalists.length} finalists + ${results.length - finalists.length} reserves)`);
console.log(`gate: PASS ${run.counts.pass} | WARN ${run.counts.passWithWarning} | REVIEW ${run.counts.needsReview} | FAIL ${run.counts.fail}`);
console.log("\nFINALISTS THAT NOW FAIL:");
const failed = finalists.filter((r) => r.validation.gate.status === "FAIL");
failed.forEach((r) => console.log(`  ${r.experimentId} ${r.service} — ${r.geography}: ${r.validation.gate.blockers[0]}`));
if (!failed.length) console.log("  (none)");
console.log("\nFINALISTS NEEDING REVIEW:");
finalists.filter((r) => r.validation.gate.status === "NEEDS_REVIEW").forEach((r) => console.log(`  ${r.experimentId} ${r.service} — ${r.geography}: ${r.validation.gate.warnings.join(" | ")}`));
console.log("\nBIGGEST RANK MOVES (finalists):");
comparison.filter((c) => c.source === "FINALIST").sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 8)
  .forEach((c) => console.log(`  ${c.oldRank} -> ${c.newRank} (${c.delta > 0 ? "+" : ""}${c.delta}) ${c.service} — ${c.geography}: ${c.primaryReason}`));
console.log("\nRESERVES NOW OUTRANKING THE WEAKEST FINALIST:");
const weakestFinalist = Math.max(...comparison.filter((c) => c.source === "FINALIST").map((c) => c.newRank));
comparison.filter((c) => c.source === "RESERVE" && c.newRank < weakestFinalist && c.gate !== "FAIL").slice(0, 8)
  .forEach((c) => console.log(`  #${c.newRank} ${c.service} — ${c.geography}, ${c.state} [${c.gate}] ${c.primaryReason}`));
