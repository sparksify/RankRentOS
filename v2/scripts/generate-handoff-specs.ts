// ASSET SPECIFICATIONS v2 (asset-spec-2.0.0) — the handoff to the Deployment Engine.
// One spec per frozen Wave-1 asset, assembled from the frozen portfolio, the
// pre-purchase validation run and decision-v2. Pure read; nothing frozen changes.
// Output: out/handoff/ (canonical) and app/data/handoff/ (served over HTTP by the app).
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, existsSync } from "fs";

const ROOT = new URL("../../", import.meta.url);
const OUT = new URL("out/handoff/", ROOT);
const SERVED = new URL("app/data/handoff/", ROOT);
for (const d of [OUT, SERVED]) {
  mkdirSync(new URL("asset-specs/", d), { recursive: true });
  const sd = new URL("asset-specs/", d);
  for (const f of readdirSync(sd)) if (f.endsWith(".json")) rmSync(new URL(f, sd)); // never ship stale specs
}

const frozen = JSON.parse(readFileSync(new URL("out/wave-1-experiment/portfolio-v2.json", ROOT), "utf8"));
const validation = JSON.parse(readFileSync(new URL("out/wave-1-experiment/validation-run-1.json", ROOT), "utf8"));
const decisions = JSON.parse(readFileSync(new URL("out/wave-1-experiment/decision-v2-comparison.json", ROOT), "utf8"));
const vByEid = new Map(validation.assets.filter((a: any) => a.source === "FINALIST").map((a: any) => [a.experimentId, a]));
const dByEid = new Map(decisions.assets.map((a: any) => [a.experimentId, a]));

const SPEC_VERSION = "asset-spec-2.0.0";
const cb = frozen.economics.costBasis;

const specs = frozen.assets.map((a: any) => {
  const v = vByEid.get(a.experimentId);
  const d = dByEid.get(a.experimentId);
  const val = v?.validation;
  const isHub = d?.isHubPage ?? a.assetType === "hub-page";
  const domain = isHub ? (a.hubDomain ?? d?.hubDomain) : (a.preferredDomain ?? d?.preferredDomain ?? null);

  return {
    specVersion: SPEC_VERSION,
    generatedAt: new Date().toISOString(),
    frozenBaseline: frozen.frozen?.frozenAt ?? "2026-08-12",
    // ---- join key: EVERYTHING the engine reports back must carry this id ----
    experimentId: a.experimentId,

    identity: {
      service: a.service, serviceSlug: a.serviceSlug, geography: a.geography, state: a.state,
      geographyType: a.geographyType, parentCity: a.parentCity ?? null,
      cohort: a.cohort, treatment: a.treatment, matchedPairId: a.matchedPairId ?? null, matchedWith: a.matchedWith ?? null,
    },

    decision: {
      classification: d?.new?.decision ?? "UNKNOWN",
      gates: d?.new?.gates ?? null,
      prePurchaseGate: val?.gate?.status ?? null,
      hypothesis: a.hypothesis, successCondition: a.successCondition, failureCondition: a.failureCondition,
    },

    build: {
      assetType: a.assetType,                      // standalone-site | hub-page
      domain, urlArchitecture: a.urlArchitecture,
      domainStatus: a.domainVerifiedAtFreeze === true ? "verified-available-at-freeze — RE-CHECK AND PURCHASE BEFORE BUILD" : isHub ? "shared hub domain" : "unknown — verify",
      contentDirective: a.contentDirective,
      primaryKeyword: `${a.service} ${a.geography}`.replace(/\s+/g, " "),
      contentBarWords: a.contentBarWords ?? null,
      competitorDomainAgeYears: a.competitorDomainAgeYears ?? null,
      siteMap: val?.architecture?.tree ?? null,
      estimatedPages: val?.architecture?.estimatedPages ?? null,
      internalLinking: val?.architecture?.internalLinking ?? [],
      cannibalizationGuidance: val?.cannibalization?.evidence?.recommendations ?? [],
      visualAssets: val?.visual?.evidence?.suggestedAssets ?? [],
      localSignalsAvailable: val?.localDepth?.evidence?.availableSignals ?? [],
      localSignalsMissing: val?.localDepth?.evidence?.missingSignals ?? [],
      doNotFabricate: "Local facts (landmarks, climate, regulations, pricing) were NOT collected. Build pages only from evidence in this spec or verified at build time — never invent local claims.",
    },

    serpToBeat: {
      organicScore: a.organicV1 ?? null, organicVerdict: a.organicVerdict ?? null, organicVersion: a.organicVersion ?? "organic-v1.2",
      dimensionA: a.dimensionA ?? null,
      top5: a.organicTop5 ?? [], structure: a.organicStructure ?? null,
      intentClass: val?.intent?.intentClass ?? null,
      localPack: a.localPackEvidence ?? null,
    },

    economics: {
      note: "ALL HUMAN_ASSUMED until live data replaces them. Never present these as measured.",
      ticketAssumed: a.ticketAssumed ?? null, marginAssumed: a.marginAssumed ?? null,
      leadValueAssumedUsd: a.leadValueAssumedUsd ?? null,
      modelledMonthlyGpUsd: d?.new?.expectedLeadsPerMonth && d?.new?.leadValueUsd ? Math.round(d.new.expectedLeadsPerMonth * d.new.leadValueUsd) : null,
      recommendedMonetizationModel: d?.new?.recommendedMonetizationModel ?? null,
      viableRenters: d?.new?.viableRenters ?? null,
      demandState: d?.new?.demandState ?? null, measuredVolume: a.measuredVolume ?? null, volumeState: a.volumeState ?? null,
      costBasis: { domainFirstYearUsd: isHub ? 0 : cb.known.domainFirstYear, contentUsd: cb.estimated.content, deployUsd: cb.estimated.deploy, monthlyUsd: (isHub ? 0 : cb.estimated.hosting) + cb.estimated.monitoring },
    },

    // ---- what the engine MUST send back, via POST /api/outcomes ----
    outcomeContract: {
      endpoint: "POST {rankrentos}/api/outcomes  (Authorization: Bearer <HANDOFF_TOKEN>)",
      joinKey: "experimentId",
      metrics: ["asset.published.date", "asset.indexed.date", "asset.firstimpression.date", "asset.firstrank.date",
        "asset.firstlead.date", "asset.firstrevenue.date", "asset.rank.check", "asset.impressions.count",
        "asset.clicks.count", "asset.sessions.count", "asset.calls.count", "asset.forms.count", "asset.leads.count",
        "asset.leads.qualified", "asset.leadvalue.realized", "asset.renter.outreach", "asset.renter.responses",
        "asset.renter.acquired", "asset.rent.monthly", "asset.revenue.total", "asset.cost.operating"],
      rankingCadence: frozen.preRegistration?.rankingTrajectory?.cadence,
      queriesToTrack: frozen.preRegistration?.rankingTrajectory?.queriesPerAsset,
      nullRule: "UNKNOWN is never zero. Do not post a metric you did not measure; for a rank check where the site is absent from the top 100, post position 'notFound' — never 101 or 0.",
    },

    provenance: a.evidenceRefs ?? null,
  };
});

const manifest = {
  specVersion: SPEC_VERSION, generatedAt: new Date().toISOString(),
  frozenBaseline: frozen.frozen?.frozenAt, decisionModel: decisions.version,
  counts: { specs: specs.length, websites: decisions.counts.websites,
    revenueCandidates: decisions.counts.REVENUE_CANDIDATE, experimental: decisions.counts.EXPERIMENTAL },
  hubDomain: frozen.hubDomain, matchedPairs: frozen.matchedPairs,
  deployOrder: ["1. Cohort B together (B1+B2+B3) — the architecture experiment is only interpretable launched as one batch, and pool seasonality rewards speed",
    "2. Group A revenue candidates", "3. Group C model-validation assets"],
  specs: specs.map((s: any) => ({ experimentId: s.experimentId, service: s.identity.service, geography: s.identity.geography,
    state: s.identity.state, cohort: s.identity.cohort, assetType: s.build.assetType, domain: s.build.domain,
    classification: s.decision.classification, file: `asset-specs/${s.experimentId}.json` })),
};

for (const d of [OUT, SERVED]) {
  for (const s of specs) writeFileSync(new URL(`asset-specs/${s.experimentId}.json`, d), JSON.stringify(s, null, 1));
  writeFileSync(new URL("manifest.json", d), JSON.stringify(manifest, null, 1));
}
console.log(`asset-spec-2.0.0: ${specs.length} specs written to out/handoff/ and app/data/handoff/`);
console.log(`revenue ${manifest.counts.revenueCandidates} | experimental ${manifest.counts.experimental} | websites ${manifest.counts.websites}`);
const missing = specs.filter((s: any) => !s.build.domain || !s.build.siteMap || !s.decision.hypothesis);
console.log(missing.length ? `INCOMPLETE SPECS: ${missing.map((m: any) => m.experimentId).join(", ")}` : "all specs carry domain, site map and hypothesis");
