// WAVE-1 REBUILD (v2) — experimental portfolio informed by organic-v1.1.
// Dual purpose: (1) find rentable assets, (2) generate evidence about which
// pre-launch signals predict ranking -> traffic -> leads -> rent.
//
// organic-v1.1 is treated as an IMPORTANT NEW SIGNAL, not truth. Dimension A is
// preserved untouched alongside it on every asset. Selection is NOT "highest
// organic score": each group has a distinct experimental job.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { organicRankability } from "../lib/serp/organic";
import { parseSerpResponse } from "../lib/providers/serpapi";
import { WEIGHTS_DEFAULT, BUCKETS_VERSION } from "../lib/scoring/composite";
import { MODEL_VERSION } from "../lib/scoring/dimensions";

const ROOT = new URL("../../", import.meta.url);
const OUT = new URL("out/wave-1-experiment/", ROOT);
mkdirSync(OUT, { recursive: true });

const scored = [
  ...(JSON.parse(readFileSync(new URL("out/experiment-2/stage4-scored.json", ROOT), "utf8")) as any[]).map((r) => ({ ...r, exp: "experiment-2" })),
  ...(JSON.parse(readFileSync(new URL("out/experiment-3/stage4-scored.json", ROOT), "utf8")) as any[]).map((r) => ({ ...r, exp: "experiment-3" })),
];
const geo = new Map((JSON.parse(readFileSync(new URL("geography-verification.json", OUT), "utf8")) as any[]).map((g) => [g.id, g]));
const comms = JSON.parse(readFileSync(new URL("nt-community-serp.json", OUT), "utf8")) as any[];
const clusterDepth = JSON.parse(readFileSync(new URL("cluster-depth.json", OUT), "utf8"));
const POOL = JSON.parse(readFileSync(new URL("nt-service-ranking.json", OUT), "utf8")).rows.find((r: any) => r.id === "pool-builder");
const prior28 = new Set((JSON.parse(readFileSync(new URL("portfolio.json", OUT), "utf8")).assets as any[]).map((a) => `${a.service}|${a.geography}`));

const terms = (label: string) => label.toLowerCase().split(/\s+/).filter((w) => w.length > 3).map((w) => w.replace(/(ing|ers|er|s)$/, ""));
const org = (rawPath: URL, geoName: string, svcLabel: string, words: number | null, age: number | null) => {
  if (!existsSync(rawPath)) return null;
  const parsed: any = parseSerpResponse(JSON.parse(readFileSync(rawPath, "utf8")));
  return organicRankability({
    organic: (parsed.organic || []).map((o: any, i: number) => ({ link: o.link, title: o.title, position: o.position ?? i + 1 })),
    geo: geoName, serviceTerms: terms(svcLabel), competitorAvgWords: words, competitorAvgDomainAgeYears: age,
  });
};
const cityOrg = (r: any) => org(new URL(`out/${r.exp}/raw/serp-${r.id.replace(/[^a-z0-9]/gi, "_")}.json`, ROOT), r.city, r.svcLabel, r.signals.competitorAvgWords, r.signals.competitorAvgDomainAgeYears);

const slugd = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
const rdap = async (d: string): Promise<boolean | null> => {
  try { const r = await fetch(`https://rdap.verisign.com/com/v1/domain/${d}`, { signal: AbortSignal.timeout(10000) }); return r.status === 404; }
  catch { return null; }
};
async function domains(kw: string, place: string, state: string) {
  const k = slugd(kw), c = slugd(place), st = state.toLowerCase();
  const cands = [...new Set([`${k}${c}.com`, `${k}${c}${st}.com`, `${c}${k}.com`, `${k}of${c}.com`, `${c}${k}pros.com`])];
  const out: any[] = [];
  for (const d of cands) out.push({ domain: d, available: await rdap(d), approxFirstYearUsd: 12.18 });
  return out;
}

// Outcome fields every asset must yield, so both models can be validated later.
const MEASUREMENT = [
  "indexDate", "firstImpressionDate", "firstRankingDate", "rankingTrajectoryByQuery",
  "timeToTop20", "timeToTop10", "timeToTop5", "impressions", "clicks", "organicSessions",
  "calls", "forms", "leadsTotal", "qualifiedLeads", "leadValueActual",
  "renterOutreach", "renterInterest", "rentalAchieved", "monthlyRentalValue",
];
const PREREG = {
  predictorsUnderTest: ["dimensionA", "organicV1_1", "measuredVolume", "cpc", "renterDepthE", "leadEconomicsD", "assetValueF", "contentBarWords", "competitorDomainAgeYears", "geographyType", "incumbentTargeting"],
  chain: "rankability -> traffic -> leads -> rentability, each stage measured separately so a failure can be localised",
};

const mk = (o: any) => ({ ...o, measurementPlan: MEASUREMENT, preRegistration: PREREG });

// ============ GROUP 1 — EXPLOITATION / BEST-EVIDENCE ============
// Economics must be real (F >= 50 = rentable) AND organic must be beatable
// (organic >= 50). A hostile organic SERP disqualifies regardless of Dimension A.
const g1pool = scored
  .filter((r) => (r.score.dims.F.score ?? 0) >= 50)
  .filter((r) => { const g = geo.get(r.id); return !g || (g.verdict !== "unverified-no-address-evidence" && g.verdict !== "serp-not-localized"); })
  .map((r) => ({ r, o: cityOrg(r) }))
  .filter((x) => x.o && (x.o.score ?? 0) >= 50)
  .sort((a, b) => (b.o!.score ?? 0) - (a.o!.score ?? 0));

const g1: any[] = [];
{
  const sN = new Map<string, number>(), cN = new Map<string, number>();
  for (const { r, o } of g1pool) {
    const s = sN.get(r.svc) ?? 0, c = cN.get(`${r.city}|${r.state}`) ?? 0;
    if (s >= 3 || c >= 2) continue;
    sN.set(r.svc, s + 1); cN.set(`${r.city}|${r.state}`, c + 1);
    const g = geo.get(r.id); const d = r.score.dims;
    g1.push(mk({
      group: "1-EXPLOITATION", cohortLabel: "best-evidence investment",
      service: r.svcLabel, serviceSlug: r.svc, geography: r.city, state: r.state, geographyType: "city",
      measuredVolume: r.vol, volumeState: g?.verdict === "serp-local-volume-upper-bound" ? "measured-upper-bound-shared-city-name" : "measured",
      cpc: r.cpc, ticketAssumed: r.ticket, marginAssumed: r.margin,
      leadValueAssumedUsd: Math.round(r.ticket * r.margin * 0.10),
      dimensionA: d.A.score, dimensionAVersion: d.A.version,
      organicV1: o!.score, organicVerdict: o!.verdict, organicVersion: o!.version,
      organicTop5: o!.slots.slice(0, 5).map((s2) => `${s2.position}. ${s2.host} [${s2.slotClass}]`),
      organicStructure: { distinctHostsTop5: o!.distinctHostsTop5, displaceableTop5: o!.displaceableTop5, hardLocalTop3: o!.hardLocalTop3, geoTargetedCompetitorsTop5: o!.geoTargetedCompetitorsTop5 },
      modelDisagreement: (d.A.score ?? 0) - (o!.score ?? 0),
      renterDepthE: d.E.score, leadEconomicsD: d.D.score, assetValueF: d.F.score, asymmetryH: d.H.score,
      compositeAI: r.score.composite, aiBucket: r.bucket, evidenceConfidence: r.score.confidenceScore,
      renterContext: { relevantOperators: r.operators.relevantOperatorCount, viableRenters: r.operators.viableOperatorCount, websiteAdoptionPct: r.operators.websiteAdoptionPct },
      localPackEvidence: { mapPackSize: r.signals.mapPackSize, avgReviews: r.signals.avgMapReviews, note: "market evidence only — excluded from organic scoring" },
      contentBarWords: r.signals.competitorAvgWords, competitorDomainAgeYears: r.signals.competitorAvgDomainAgeYears,
      geographyVerified: true, geographyVerdict: g?.verdict ?? "verified",
      demandProven: true,
      reasonIncluded: `Rentable economics (F=${d.F.score}, ~$${Math.round(r.ticket * r.margin * 0.1)}/lead) AND a beatable organic SERP (organic-v1.1 ${o!.score}, ${o!.displaceableTop5} of ${o!.distinctHostsTop5} distinct top-5 hosts displaceable).`,
      hypothesis: `An asset with BOTH real lead economics and a soft organic SERP should rank and rent. Tests the conjunction directly: A=${d.A.score}, organic=${o!.score}.`,
      successCondition: "top-10 organic for the primary query within 6 months AND >=1 inbound lead within 9 months.",
      failureCondition: "no top-20 position within 6 months, OR ranks top-10 but produces zero leads in 3 further months (which would falsify demand rather than rankability).",
      wasInPrior28: prior28.has(`${r.svcLabel}|${r.city}`),
      evidenceRefs: { experiment: r.exp, rawSerp: `out/${r.exp}/raw/serp-${r.id.replace(/[^a-z0-9]/gi, "_")}.json`, scoreModel: MODEL_VERSION, weights: WEIGHTS_DEFAULT.id, buckets: BUCKETS_VERSION },
    }));
    if (g1.length >= 8) break;
  }
}

// ============ GROUP 2 — NORTH TEXAS POOL CLUSTER (expanded) ============
// Service held constant (Pool Builder) so economics and seasonality are controlled.
// BOTH virgin and incumbent-targeted communities are retained: that distinction is
// itself a hypothesis. Zero keyword-tool volume is NOT a rejection here — it is the
// hypothesis under test — but these are labelled DEMAND-UNPROVEN, not validated.
const commOrg = (name: string) => {
  const d = clusterDepth[name] ?? { words: null, age: null };
  return org(new URL(`raw/serp-pool_builder_${name.replace(/[^a-z0-9]/gi, "_")}_TX.json`, OUT), name, "Pool Builder", d.words, d.age);
};
const incumbentOf = (name: string) => {
  const f = new URL(`raw/serp-pool_builder_${name.replace(/[^a-z0-9]/gi, "_")}_TX.json`, OUT);
  if (!existsSync(f)) return false;
  const p: any = parseSerpResponse(JSON.parse(readFileSync(f, "utf8")));
  return (p.organic || []).some((x: any) => {
    const t = (x.title ?? "").toLowerCase(), u = (x.link ?? "").toLowerCase();
    return t.includes(name.toLowerCase()) && (t.includes("pool") || u.includes("pool"));
  });
};
// Re-evaluate the FULL 22-community universe, then select deliberately.
const commRows = comms.filter((c) => c.kind === "community").map((c) => {
  const o = commOrg(c.name);
  return { name: c.name, city: c.city, meta: c.meta, o, incumbent: incumbentOf(c.name), preferredDomain: c.preferredDomain, domainsChecked: c.domains };
}).filter((x) => x.o).sort((a, b) => (b.o!.score ?? 0) - (a.o!.score ?? 0));

const EXCLUDE_PREOCC = new Set(["Ramble", "Serenade"]);   // pre-occupancy: no homeowners to search
const virgin = commRows.filter((c) => !c.incumbent && !EXCLUDE_PREOCC.has(c.name)).slice(0, 6);
const incumb = commRows.filter((c) => c.incumbent && !EXCLUDE_PREOCC.has(c.name)).slice(0, 5);
// plus the largest incumbent community even if organically hard — the "big, validated,
// hard" arm that tests whether size/validated demand beats SERP softness
const bigHard = commRows.find((c) => c.name === "Windsong Ranch");
const clusterPick = [...virgin, ...incumb, ...(bigHard && !incumb.includes(bigHard) ? [bigHard] : [])];

const g2: any[] = [];
for (const c of clusterPick) {
  g2.push(mk({
    group: "2-NT-POOL-CLUSTER", cohortLabel: c.incumbent ? "community / incumbent-targeted" : "community / virgin",
    service: "Pool Builder", serviceSlug: "pool-builder", geography: c.name, state: "TX",
    geographyType: "master-planned-community", parentCity: c.city, communityHomes: c.meta?.homes ?? null, communityStatus: c.meta?.status ?? null,
    measuredVolume: 0, volumeState: "provider-reports-zero — THE HYPOTHESIS UNDER TEST, not a validated demand figure",
    demandProven: false, demandLabel: "DEMAND-UNPROVEN EXPERIMENTAL ASSET",
    cpc: null, ticketAssumed: POOL.ticket, marginAssumed: POOL.margin, leadValueAssumedUsd: POOL.leadValue,
    dimensionA: null, dimensionANote: "A not applied: it is calibrated on city-level SERPs and its map-pack term is meaningless here (Google returns the parent city's pack).",
    organicV1: c.o!.score, organicVerdict: c.o!.verdict, organicVersion: c.o!.version,
    organicTop5: c.o!.slots.slice(0, 5).map((s) => `${s.position}. ${s.host} [${s.slotClass}]`),
    organicStructure: { distinctHostsTop5: c.o!.distinctHostsTop5, displaceableTop5: c.o!.displaceableTop5, hardLocalTop3: c.o!.hardLocalTop3, geoTargetedCompetitorsTop5: c.o!.geoTargetedCompetitorsTop5 },
    incumbentCommunityTargeting: c.incumbent,
    renterDepthE: null, renterContext: { note: "24 distinct pool builders serve the 22-community cluster; Lonestar Pool & Spa Design appears in 12 of 22 packs. One renter could take several sites (upside) — and that is buyer concentration (risk)." },
    localPackEvidence: { note: "map pack is inherited from the parent city; Google renders no distinct community pack. This asset must win ORGANIC." },
    contentBarWords: clusterDepth[c.name]?.words ?? null, competitorDomainAgeYears: clusterDepth[c.name]?.age ?? null,
    domainCandidates: Object.entries(c.domainsChecked ?? {}).map(([d, a]) => ({ domain: d, available: a })), preferredDomain: c.preferredDomain,
    geographyVerified: true, geographyVerdict: "community within verified metro (SERP localized to parent city)",
    reasonIncluded: c.incumbent
      ? `Incumbent-targeted arm: a competitor already runs a ${c.name}-specific pool page, which is independent evidence an operator believes this demand is real. Organic ${c.o!.score} (${c.o!.verdict}).`
      : `Virgin arm: no competitor holds a ${c.name}-specific pool page. Organic ${c.o!.score} (${c.o!.verdict}), ${c.o!.displaceableTop5} of ${c.o!.distinctHostsTop5} distinct top-5 hosts displaceable.`,
    hypothesis: `Keyword tools report zero volume for "pool builder ${c.name}", but homeowners in a ${c.meta?.homes ?? "large"}-home affluent community search using their community name. ${c.incumbent ? "A competitor's existing community page suggests the demand is real; this tests whether we can take that slot." : "No competitor has built for this community; this tests whether the demand exists at all."}`,
    successCondition: ">=100 impressions/month on community-modified queries within 6 months, OR >=1 qualified lead — either result proves demand the tools could not see.",
    failureCondition: "indexed but <20 impressions/month after 6 months across ALL community-modified queries, while the city controls perform in line with their measured volume. That cleanly falsifies hyper-local under-measurement.",
    wasInPrior28: prior28.has(`Pool Builder|${c.name}`),
    evidenceRefs: { rawSerp: `out/wave-1-experiment/raw/serp-pool_builder_${c.name.replace(/[^a-z0-9]/gi, "_")}_TX.json`, serviceSelection: "out/wave-1-experiment/nt-service-ranking.json" },
  }));
}
// city controls — the comparison that isolates the community effect
for (const [city, vol] of [["Prosper", 10], ["McKinney", 210], ["Frisco", 320]] as [string, number][]) {
  const c = comms.find((x) => x.name === city && x.kind === "city-control");
  const o = commOrg(city);
  if (!c || !o) continue;
  g2.push(mk({
    group: "2-NT-POOL-CLUSTER", cohortLabel: "city control",
    service: "Pool Builder", serviceSlug: "pool-builder", geography: city, state: "TX", geographyType: "city-control",
    measuredVolume: vol, volumeState: "measured", demandProven: true, cpc: null,
    ticketAssumed: POOL.ticket, marginAssumed: POOL.margin, leadValueAssumedUsd: POOL.leadValue,
    dimensionA: null, organicV1: o.score, organicVerdict: o.verdict, organicVersion: o.version,
    organicTop5: o.slots.slice(0, 5).map((s) => `${s.position}. ${s.host} [${s.slotClass}]`),
    organicStructure: { distinctHostsTop5: o.distinctHostsTop5, displaceableTop5: o.displaceableTop5, hardLocalTop3: o.hardLocalTop3, geoTargetedCompetitorsTop5: o.geoTargetedCompetitorsTop5 },
    incumbentCommunityTargeting: null,
    renterContext: { relevantOperators: c.operators.relevantOperatorCount, viableRenters: c.operators.viableOperatorCount },
    localPackEvidence: { mapPackSize: c.signals.mapPackSize, avgReviews: c.signals.avgMapReviews, note: "market evidence only" },
    contentBarWords: null, competitorDomainAgeYears: null,
    domainCandidates: Object.entries(c.domains ?? {}).map(([d, a]) => ({ domain: d, available: a })), preferredDomain: c.preferredDomain,
    geographyVerified: true, geographyVerdict: "verified",
    reasonIncluded: `City control at ${vol}/mo measured demand. Anchors the gradient Frisco 320 > McKinney 210 > Prosper 10 > community 0.`,
    hypothesis: "If impressions track measured volume across the gradient, keyword tools are accurate and the community bet fails. If Prosper and the community sites over-perform their measured volume, the tools systematically under-measure hyper-local demand.",
    successCondition: "n/a — control. Judged only as a calibration reference.",
    failureCondition: "n/a — control.",
    wasInPrior28: prior28.has(`Pool Builder|${city}`),
    evidenceRefs: { rawSerp: `out/wave-1-experiment/raw/serp-pool_builder_${city}_TX.json` },
  }));
}

// ============ GROUP 3 — CONTRARIAN / MODEL DISAGREEMENT ============
const byId = new Map(scored.map((r) => [r.id, r]));
const G3: [string, string, string, string, string][] = [
  ["metal-roofing|Rochester|MN", "MODEL DISAGREEMENT (largest)",
   "Dimension A says 76 (weak map pack); organic-v1.1 says 18 — a 58-point disagreement. The organic top 5 is real roofers explicitly targeting Rochester. This is the cleanest available test of WHICH rankability model predicts reality.",
   "If it reaches top-10 within 6 months, organic-v1.1 is wrong to discount map-pack evidence and A should be preserved as-is.",
   "If it never reaches top-20, Dimension A's map-pack credit is confirmed spurious and A must be rebuilt as A-2.0.0 around organic structure."],
  ["basement-waterproofing|Naperville|IL", "MODEL DISAGREEMENT (second largest)",
   "A=77 vs organic-v1.1 28 — a 49-point disagreement, and the second independent replicate of the same test with a different service and market.",
   "Ranks top-10 => A's map-pack term carries real signal.",
   "Fails to reach top-20 => confirms the Rochester result; two replicates make the conclusion robust."],
  ["house-cleaning|Orlando|FL", "WEAK ECONOMICS / HIGH DEMAND",
   "2,900/mo with A=74 but F=34 (~$10 gross profit per lead) and organic 30. Tests the buckets-1.1.0 rentability floor: can sheer volume compensate for thin per-lead value?",
   "Achieves >=$300/mo rent => the rentability floor is too strict and is discarding viable assets.",
   "Ranks but cannot be rented => the floor is validated and should perhaps rise."],
  ["kitchen-remodel|Rockville|MD", "STRONG RENTER DEPTH / HARD SERP",
   "E=100 — the strongest renter market in the dataset — against A=45 and organic 22. Tests whether renter depth can carry an asset through a hostile SERP.",
   "Ranks and rents => renter depth deserves more weight relative to rankability.",
   "Never ranks => E is worthless without rankability and should be demoted to a tie-breaker."],
  ["bathroom-remodel|Bellevue|NE", "SHARED-NAME DEMAND ATTRIBUTION",
   "Highest composite in the dataset (85) but its 2,400/mo is shared with Bellevue WA. SERP verified local to NE, organic 58. Paired with Bellevue WA elsewhere in the portfolio so we can observe directly how shared-name volume splits.",
   "Meaningful local impressions => shared-name markets are investable and should stop being discounted.",
   "Negligible impressions while Bellevue WA performs => shared-name volume must be excluded from scoring entirely."],
  ["appliance-repair|Aurora|IL", "V0 vs V2 THESIS",
   "V0 favoured commodity high-volume services; V2 bucketed only 1 of 16. 1,300/mo, A=67, organic 39, F=34. Tests which generation of the model is right about this family.",
   "Ranks and rents easily => V2's economic pessimism about commodity services is wrong.",
   "Fails => the fragmented-local family stays suppressed and we stop researching it."],
];
const g3: any[] = [];
for (const [id, kind, hyp, scaleC, failC] of G3) {
  const r = byId.get(id); if (!r) continue;
  const o = cityOrg(r); const g = geo.get(id); const d = r.score.dims;
  g3.push(mk({
    group: "3-CONTRARIAN", cohortLabel: kind,
    service: r.svcLabel, serviceSlug: r.svc, geography: r.city, state: r.state, geographyType: "city",
    measuredVolume: r.vol, volumeState: g?.verdict === "serp-local-volume-upper-bound" ? "measured-upper-bound-shared-city-name" : "measured",
    demandProven: true, cpc: r.cpc, ticketAssumed: r.ticket, marginAssumed: r.margin,
    leadValueAssumedUsd: Math.round(r.ticket * r.margin * 0.10),
    dimensionA: d.A.score, dimensionAVersion: d.A.version,
    organicV1: o?.score ?? null, organicVerdict: o?.verdict ?? null, organicVersion: o?.version ?? null,
    organicTop5: o ? o.slots.slice(0, 5).map((s) => `${s.position}. ${s.host} [${s.slotClass}]`) : [],
    organicStructure: o ? { distinctHostsTop5: o.distinctHostsTop5, displaceableTop5: o.displaceableTop5, hardLocalTop3: o.hardLocalTop3, geoTargetedCompetitorsTop5: o.geoTargetedCompetitorsTop5 } : null,
    modelDisagreement: (d.A.score ?? 0) - (o?.score ?? 0),
    renterDepthE: d.E.score, leadEconomicsD: d.D.score, assetValueF: d.F.score, asymmetryH: d.H.score,
    compositeAI: r.score.composite, aiBucket: r.bucket, evidenceConfidence: r.score.confidenceScore,
    renterContext: { relevantOperators: r.operators.relevantOperatorCount, viableRenters: r.operators.viableOperatorCount },
    localPackEvidence: { mapPackSize: r.signals.mapPackSize, avgReviews: r.signals.avgMapReviews, note: "market evidence only" },
    contentBarWords: r.signals.competitorAvgWords, competitorDomainAgeYears: r.signals.competitorAvgDomainAgeYears,
    geographyVerified: true, geographyVerdict: g?.verdict ?? "verified",
    reasonIncluded: `Selected to test a specific way the models may be WRONG — exploration, not a presumed winner. ${kind}.`,
    hypothesis: hyp, successCondition: scaleC, failureCondition: failC,
    wasInPrior28: prior28.has(`${r.svcLabel}|${r.city}`),
    evidenceRefs: { experiment: r.exp, rawSerp: `out/${r.exp}/raw/serp-${id.replace(/[^a-z0-9]/gi, "_")}.json`, scoreModel: MODEL_VERSION },
  }));
}

// ---------- domains for groups 1 and 3 ----------
for (const a of [...g1, ...g3]) {
  a.domainCandidates = await domains(a.service, a.geography, a.state);
  a.preferredDomain = a.domainCandidates.find((d: any) => d.available === true)?.domain ?? null;
  a.domainAvailable = !!a.preferredDomain;
}
for (const a of g2) a.domainAvailable = !!a.preferredDomain;

const all = [...g1, ...g2, ...g3];
const COST = { known: { domainFirstYear: 12.18, domainRenewal: 15.18 }, estimated: { hosting: 1.0, content: 8.0, deploy: 5.0, monitoring: 0.5 },
  unknown: ["deployment engine per-asset cost (engine not built)", "renter acquisition cost/time", "link/citation acquisition", "content revision cycles", "pool cluster content is photo-heavy and likely exceeds the generic content estimate"] };
const n = all.length;
const upfront = n * (COST.known.domainFirstYear + COST.estimated.content + COST.estimated.deploy);
const monthly = n * (COST.estimated.hosting + COST.estimated.monitoring);

writeFileSync(new URL("portfolio-v2.json", OUT), JSON.stringify({
  generatedAt: new Date(1786000000000).toISOString(), version: "wave1-v2",
  design: "three experimental groups: exploitation (best evidence) / NT pool cluster (controlled hypothesis) / contrarian (model disagreement)",
  models: { dimensionA: MODEL_VERSION, organic: "organic-v1.1", weights: WEIGHTS_DEFAULT.id, buckets: BUCKETS_VERSION,
    note: "Dimension A and organic-v1.1 are carried SEPARATELY on every asset. Neither is overwritten; historical A scores are untouched. organic-v1.1 is an experimental signal awaiting live validation." },
  totals: { assets: n, group1: g1.length, group2: g2.length, group3: g3.length },
  economics: { upfrontCapital: +upfront.toFixed(2), monthlyCarrying: +monthly.toFixed(2),
    sixMonthRiskCapital: +(upfront + monthly * 6).toFixed(2), twelveMonthRiskCapital: +(upfront + monthly * 12 + n * COST.known.domainRenewal).toFixed(2),
    domainCost: +(n * COST.known.domainFirstYear).toFixed(2), costBasis: COST },
  preRegistration: PREREG, measurementFields: MEASUREMENT,
  assets: all,
}, null, 1));

const f = (a: any) => `${String(a.organicV1 ?? "-").padStart(3)} ${(a.organicVerdict ?? "-").padEnd(17)} | A ${String(a.dimensionA ?? "-").padStart(3)} | F ${String(a.assetValueF ?? "-").padStart(3)} | ${String(a.measuredVolume).padStart(4)}/mo | ${(a.preferredDomain ?? "NO DOMAIN").padEnd(34)} | ${a.service} — ${a.geography}, ${a.state}${a.wasInPrior28 ? "" : "  [NEW]"}`;
console.log(`WAVE 1 v2 = ${n} assets | G1 ${g1.length} | G2 ${g2.length} | G3 ${g3.length}`);
console.log(`economics: upfront $${upfront.toFixed(2)} | monthly $${monthly.toFixed(2)} | 6-mo $${(upfront + monthly * 6).toFixed(2)} | 12-mo $${(upfront + monthly * 12 + n * COST.known.domainRenewal).toFixed(2)}`);
for (const [g, label] of [[g1, "GROUP 1 — EXPLOITATION"], [g2, "GROUP 2 — NT POOL CLUSTER"], [g3, "GROUP 3 — CONTRARIAN"]] as [any[], string][]) {
  console.log(`\n--- ${label} ---`);
  g.forEach((a) => console.log("  " + f(a) + (a.cohortLabel.includes("community") || a.cohortLabel === "city control" ? `  <${a.cohortLabel}>` : "")));
}
const dropped = [...prior28].filter((k) => !all.some((a) => `${a.service}|${a.geography}` === k));
console.log(`\nREMOVED from the prior 28 (${dropped.length}): ${dropped.join(" · ")}`);
console.log(`ADDED (${all.filter((a) => !a.wasInPrior28).length}): ${all.filter((a) => !a.wasInPrior28).map((a) => `${a.service}|${a.geography}`).join(" · ")}`);
