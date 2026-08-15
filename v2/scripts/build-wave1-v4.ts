// WAVE1-V4 — the de-confounded factorial redesign (supersedes wave1-v3; v3 preserved).
//
// Steve's critique, adopted: don't ask one site to prove pools AND hyperlocal AND
// template conversion at once. v4 separates the variables as a 2x2 factorial with
// same-geography service pairs:
//        {Pool Builder (considered/visual), Sprinkler Repair (transactional)}
//      x {city (Frisco/McKinney/Prosper), community (4 shared communities)}
// plus a reduced hub arm on S2, and Groups A + C unchanged from v3.
//
// S2 selection was data-driven (nt-transactional-selection): sprinkler repair won on
// instrument quality — the only transactional candidate with a real city demand
// gradient (Frisco 390 / McKinney 320 / Prosper 40) to anchor the control arm.
// Landscape lighting had better economics but only 90/mo metro demand: an
// unanchorable control. Christmas lights was REJECTED for a design reason: its
// annual-average volume hides a seasonal spike — a second under-measurement effect
// stacked on the hyperlocal one under test.
import { readFileSync, writeFileSync, mkdirSync } from "fs";

const ROOT = new URL("../../", import.meta.url);
const OUT = new URL("out/wave1-v4/", ROOT);
mkdirSync(OUT, { recursive: true });

const v3 = JSON.parse(readFileSync(new URL("out/wave-1-experiment/portfolio-v2.json", ROOT), "utf8"));
const s2 = JSON.parse(readFileSync(new URL("out/wave1-v4/s2-serps.json", ROOT), "utf8"));
const s2rank = JSON.parse(readFileSync(new URL("out/wave1-v4/s2-ranking.json", ROOT), "utf8"));
const SPRINKLER = s2rank.rows.find((r: any) => r.id === "sprinkler-repair");
const byName = new Map(s2.results.map((r: any) => [r.name, r]));

const keep = (id: string) => v3.assets.find((a: any) => a.experimentId === id);
const PAIRED_COMMUNITIES = ["Sutton Fields", "Painted Tree", "Sandbrock Ranch", "Star Trail"];
const HUB_COMMUNITIES = ["Trinity Falls", "Union Park"];
const CITY_VOL: Record<string, number> = { Frisco: 390, McKinney: 320, Prosper: 40 };

const mk = (o: any) => ({ ...o, measurementPlan: v3.assets[0].measurementPlan, preRegistration: null }); // prereg attached at portfolio level

// ---------- carried unchanged from v3 ----------
const groupA = v3.assets.filter((a: any) => a.cohort === "A-EXPLOITATION");
const groupC = v3.assets.filter((a: any) => a.cohort === "C-MODEL-VALIDATION");
// S1 pool: 3 city controls + the 4 paired communities (from v3's B cohorts)
const poolCity = ["Frisco", "McKinney", "Prosper"].map((c) => {
  const a = keep(v3.assets.find((x: any) => x.cohort === "B3-CITY-CONTROL" && x.geography === c)?.experimentId);
  return { ...a, cohort: "NT-POOL-CITY", treatment: "S1-city",
    note: "PREDICTED-HARD probe: organic 23-39, the model expects this NOT to rank. Retained because a niche test needs its city baseline and failure here is itself an A/O data point." };
});
const poolComm = PAIRED_COMMUNITIES.map((n) => {
  const a = v3.assets.find((x: any) => x.geography === n && x.service === "Pool Builder");
  return { ...a, cohort: "NT-POOL-COMMUNITY", treatment: "S1-community", assetType: "standalone-site",
    hubDomain: null, urlArchitecture: `${a.preferredDomain ?? "(domain)"} (root targets the community query)`,
    matchedPairId: null, matchedWith: `Sprinkler Repair — ${n} (same community, transactional twin)` };
});

// ---------- new: S2 sprinkler assets ----------
const slugd = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
const s2asset = (name: string, type: "city" | "community", assetType: "standalone-site" | "hub-page") => {
  const r: any = byName.get(name);
  const isCity = type === "city";
  const vol = isCity ? CITY_VOL[name] ?? null : 0;
  // renter inheritance: a community query returns the parent-city pack; 0 viable in
  // the community read means inherit the parent city's sprinkler operators
  const parentR: any = isCity ? null : byName.get(r.city) ?? null;
  const viable = r.viableRenters > 0 ? r.viableRenters : (parentR?.viableRenters ?? null);
  return mk({
    experimentId: `W1V4-S2-${slugd(name).toUpperCase().slice(0, 12)}`,
    cohort: isCity ? "NT-SPRINKLER-CITY" : assetType === "hub-page" ? "NT-SPRINKLER-HUB" : "NT-SPRINKLER-COMMUNITY",
    treatment: isCity ? "S2-city" : assetType === "hub-page" ? "S2-community-hub" : "S2-community",
    assetType, service: "Sprinkler Repair", serviceSlug: "sprinkler-repair",
    geography: name, state: "TX", geographyType: isCity ? "city-control" : "master-planned-community",
    parentCity: isCity ? null : r.city,
    urlArchitecture: assetType === "hub-page" ? `${s2.hubDomain}/${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}/` : `${r.preferredDomain ?? "(alternate needed)"} (root targets the query)`,
    hubDomain: assetType === "hub-page" ? s2.hubDomain : null,
    measuredVolume: vol, volumeState: isCity ? "measured" : "provider-reports-zero — THE HYPOTHESIS UNDER TEST",
    demandProven: isCity, demandLabel: isCity ? undefined : "DEMAND-UNPROVEN EXPERIMENTAL ASSET",
    cpc: null, ticketAssumed: SPRINKLER.ticket, marginAssumed: SPRINKLER.margin, leadValueAssumedUsd: SPRINKLER.leadValue,
    dimensionA: null, dimensionANote: "A not applied — no full A-I evidence bundle was collected for sprinkler markets; organic-v1.2 and intent were.",
    organicV1: r.organic, organicVerdict: r.verdict, organicVersion: "organic-v1.2",
    organicTop5: r.top5, organicStructure: { distinctHostsTop5: r.structure.distinctHosts, displaceableTop5: r.structure.displaceable, hardLocalTop3: r.structure.hardLocal, geoTargetedCompetitorsTop5: r.structure.geoTargeted },
    incumbentTargeting: `${r.structure.geoTargeted} of ${r.structure.distinctHosts} distinct top-5 hosts target this geography`,
    renterDepthE: null, renterContext: { viableRenters: viable, relevantOperators: r.relevantOperators,
      note: r.viableRenters === 0 && viable ? `community pack showed 0 viable; inherited from parent city ${r.city} (${viable})` : undefined },
    localPackEvidence: { mapPackSize: r.mapPackSize, avgReviews: r.avgMapReviews, note: "market evidence only — excluded from organic scoring" },
    contentBarWords: null, competitorDomainAgeYears: null,
    contentDirective: "Transactional lead-gen archetype: credibility, service proof, phone-first conversion. This is the EASY-JOURNEY arm — do not build an editorial site.",
    archetype: "transactional-lead-gen",
    domainCandidates: Object.entries(r.domains ?? {}).map(([d, a]) => ({ domain: d, available: a })),
    preferredDomain: assetType === "hub-page" ? s2.hubDomain : r.preferredDomain,
    domainAvailable: assetType === "hub-page" ? s2.hubAvail === true : !!r.preferredDomain,
    evidenceConfidence: "S2 class: organic + intent + operators measured; A-I not applied",
    geographyVerified: true, geographyVerdict: isCity ? "verified" : "community within verified metro",
    intentClass: r.intentClass, intentVerdict: r.intentVerdict,
    hypothesis: isCity
      ? `S2 city control at ${vol}/mo measured demand. Anchors the transactional gradient (Frisco 390 > McKinney 320 > Prosper 40) exactly as the pool controls anchor the considered-purchase gradient.`
      : `Keyword tools report zero volume for "sprinkler repair ${name}", but a ${type === "community" ? "large affluent community" : ""} full of irrigation systems generates urgent repair needs year-round. Paired with the pool asset in the same community: if this ranks and rings while the pool site ranks and doesn't, purchase psychology — not hyperlocal SEO — is the differentiator.`,
    successCondition: isCity ? "n/a — control; calibration reference." : ">=100 impressions/month on community-modified queries OR >=1 call within 6 months.",
    failureCondition: isCity ? "n/a — control." : "indexed but <20 impressions/month after 6 months while city controls track measured volume.",
    wasInPrior28: false,
    evidenceRefs: { rawSerp: `out/wave1-v4/raw/serp-sprinkler-repair_${name.replace(/[^a-z0-9]/gi, "_")}.json`, s2Selection: "out/wave1-v4/s2-ranking.json", demand: "dataforseo:google_ads/search_volume" },
  });
};

const s2City = ["Frisco", "McKinney", "Prosper"].map((n) => s2asset(n, "city", "standalone-site"));
// exact/first-choice city domains were taken for Frisco and McKinney; alternates
// verified available via RDAP at build time
const ALT_DOMAINS: Record<string, string> = { Frisco: "sprinklerrepairoffrisco.com", McKinney: "sprinklerrepairofmckinney.com" };
for (const a of s2City) {
  if (!a.preferredDomain && ALT_DOMAINS[a.geography]) {
    a.preferredDomain = ALT_DOMAINS[a.geography];
    a.domainAvailable = true;
    a.urlArchitecture = `${a.preferredDomain} (root targets the query)`;
    a.domainCandidates = [...(a.domainCandidates ?? []), { domain: ALT_DOMAINS[a.geography], available: true, note: "alternate; verified available at build" }];
  }
}
const s2Comm = PAIRED_COMMUNITIES.map((n) => s2asset(n, "community", "standalone-site"));
const s2Hub = HUB_COMMUNITIES.map((n) => s2asset(n, "community", "hub-page"));
// pair links
for (const n of PAIRED_COMMUNITIES) {
  const s = s2Comm.find((x) => x.geography === n)!;
  s.matchedWith = `Pool Builder — ${n} (same community, considered-purchase twin)`;
}

// mark pool assets with the visual archetype
for (const a of [...poolCity, ...poolComm]) { a.archetype = "visual-luxury"; a.contentDirective = (a.contentDirective ?? "") + " ARCHETYPE: visual-luxury — galleries, project photography, design credibility. A considered $85k purchase is evaluated visually; a generic lead-gen template is expected to under-convert here and that expectation is part of the test (H5)."; }
for (const a of [...groupA, ...groupC]) a.archetype = a.archetype ?? "transactional-lead-gen";

const all = [...groupA, ...groupC, ...poolCity, ...poolComm, ...s2City, ...s2Comm, ...s2Hub];
const domains = new Set(all.filter((a: any) => a.assetType !== "hub-page" && a.preferredDomain).map((a: any) => a.preferredDomain));
if (s2Hub.length) domains.add(s2.hubDomain);
const websites = domains.size;
const pages = all.length;
const cb = v3.economics.costBasis;
const upfront = websites * cb.known.domainFirstYear + pages * (cb.estimated.content + cb.estimated.deploy);
const monthly = websites * cb.estimated.hosting + pages * cb.estimated.monitoring;

const PREREG = {
  ...v3.preRegistration,
  version: "prereg-v4",
  supersedes: "wave1-v3 pre-registration (frozen 2026-08-12, preserved untouched). Revision is legitimate: nothing has been purchased or deployed.",
  factorial: { design: "2x2: {pool considered-visual, sprinkler transactional} x {city, community}, same-community service pairs",
    pairedCommunities: PAIRED_COMMUNITIES,
    gradients: { pool: "Frisco 320 / McKinney 210 / Prosper 10", sprinkler: "Frisco 390 / McKinney 320 / Prosper 40" } },
  analyses: [
    ...v3.preRegistration.analyses.filter((a: any) => ["H1-model-validation", "H4-rentability"].includes(a.id)),
    { id: "H2-hyperlocal-demand", question: "Do zero-volume community queries produce real search activity?",
      method: "Impressions + unpredicted queries for the 10 community assets (6 sprinkler incl. hub, 4 pool) vs the 6 city controls, normalised by the two measured gradients.",
      decisionRule: "Community assets materially over-performing their zero => tools under-measure hyperlocal demand; expand the community layer." },
    { id: "H3-architecture-exploratory", question: "Standalone community domain vs page on a regional hub?",
      method: "EXPLORATORY (demoted from v3's confirmatory 6 pairs): 2 sprinkler hub pages vs 4 sprinkler standalone community sites, compared on daysToTop20 and impressionsAtDay180.",
      decisionRule: "Directional evidence only; a confirmatory architecture test is deferred to Wave 2 with proper pairing." },
    { id: "H5-purchase-psychology", question: "Does service psychology (considered vs transactional) drive hyperlocal outcomes?",
      method: "WITHIN the 4 paired communities: pool vs sprinkler compared on impressions (demand exists?), clicks (SERP wins?), and calls-per-click (conversion). The same community holds geography constant, so divergence isolates the service variable.",
      decisionRule: "If sprinkler converts and pool does not, the visual-luxury archetype becomes a prerequisite for considered-purchase niches; if NEITHER gets impressions, hyperlocal demand fails regardless of service; if both convert, pools scale on economics." },
    { id: "H6-niche-value", question: "Do high-value considered niches out-earn transactional niches per asset?",
      method: "Realized rent + lead value across the pool arm vs the sprinkler arm at 9 months (longer horizon: pool sales cycle is ~90 days).",
      decisionRule: "Determines whether Wave 2 tilts toward visual/luxury niches or transactional volume." },
  ],
  economicHonesty: "The sprinkler arm's ~$60/lead is BELOW the $300/mo rentability floor at expected community volumes. It is deliberately pre-registered as information spend — the cheapest clean instrument for the hyperlocal mechanism — not as a revenue bet. Do not reinterpret a working sprinkler experiment as a failed business, or vice versa.",
};

const portfolio = {
  generatedAt: new Date().toISOString(), version: "wave1-v4-factorial",
  supersedes: { version: "wave1-v3-matched-architecture", note: "v3 frozen baseline preserved at out/wave-1-experiment/portfolio-v2.json. Superseded BEFORE any purchase or deployment — the freeze forbids post-launch changes, not pre-launch redesign." },
  design: "Groups A + C unchanged. NT arm rebuilt as a 2x2 factorial with same-community service pairs, per the revised strategy: pools tested without the neighborhood confound, neighborhoods tested with a simple transactional service, and city-vs-community controls for BOTH services.",
  models: { ...v3.models, note: "Unchanged: ai-v1.0.0, organic-v1.2, buckets-1.1.0. S2 selection used the transactional-fitness ranking (s2-ranking.json)." },
  totals: { rankablePages: pages, websites, domainsRequired: websites,
    groupA: groupA.length, groupC: groupC.length,
    poolCity: poolCity.length, poolCommunity: poolComm.length,
    sprinklerCity: s2City.length, sprinklerCommunity: s2Comm.length, sprinklerHubPages: s2Hub.length },
  hubDomain: s2.hubDomain,
  economics: { domainCost: +(websites * cb.known.domainFirstYear).toFixed(2), upfrontCapital: +upfront.toFixed(2),
    monthlyCarrying: +monthly.toFixed(2), sixMonthExperimentCost: +(upfront + monthly * 6).toFixed(2),
    twelveMonthRiskCapital: +(upfront + monthly * 12 + websites * cb.known.domainRenewal).toFixed(2), costBasis: cb },
  preRegistration: PREREG,
  frozen: { isFrozen: false, note: "DRAFT awaiting Steve's approval; freezes on approval." },
  assets: all,
};
writeFileSync(new URL("portfolio-v4.json", OUT), JSON.stringify(portfolio, null, 1));

console.log(`WAVE1-V4: ${pages} rankable assets across ${websites} websites`);
console.log(`A ${groupA.length} | C ${groupC.length} | pool city ${poolCity.length} + comm ${poolComm.length} | sprinkler city ${s2City.length} + comm ${s2Comm.length} + hub ${s2Hub.length}`);
console.log(`domains $${(websites * cb.known.domainFirstYear).toFixed(2)} | upfront $${upfront.toFixed(2)} | monthly $${monthly.toFixed(2)} | 6-mo $${(upfront + monthly * 6).toFixed(2)}`);
const noDomain = all.filter((a: any) => a.assetType !== "hub-page" && !a.preferredDomain);
console.log(noDomain.length ? `\nNEED ALTERNATE DOMAINS: ${noDomain.map((a: any) => `${a.service} ${a.geography}`).join(" · ")}` : "\nall standalone assets have a domain");
