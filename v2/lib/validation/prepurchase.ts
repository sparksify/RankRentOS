// PRE-PURCHASE VALIDATION (prepurchase-v1)
//
// A deterministic, auditable stage between RESEARCH and APPROVED FOR PURCHASE.
// It does NOT replace or fold into the A–I composite. Each dimension carries its
// own evidence, confidence and verdict, and the gate is applied separately so the
// reasoning stays legible.
//
// Motivating failure: Bathroom Remodeling — Conroe TX ranked #1 on the old evidence
// with an organic top-5 of Wikipedia, IKEA, Lowe's, Home Depot and Houzz — a
// retail/informational SERP with zero rentable operators. Numeric metrics looked
// fine. Intent was wrong. That class of error must be caught here.
import type { OrganicSlot } from "../serp/organic";

export const VALIDATION_VERSION = "prepurchase-v1";

// ---------- shared types ----------
export type Verdict = "PASS" | "PASS_WITH_WARNING" | "NEEDS_REVIEW" | "FAIL";
export interface DimensionResult<T = Record<string, unknown>> {
  verdict: Verdict;
  score: number | null;          // 0-100 where meaningful; null when not scoreable
  confidence: number;            // 0-1, evidence quality (not opportunity quality)
  explanation: string;           // plain English, shown directly in the UI
  evidence: T;
  version: string;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

// =========================================================================
// A. COMMERCIAL INTENT VALIDATION
// Does this SERP represent people trying to HIRE a local provider?
// =========================================================================
export type IntentClass =
  | "LOCAL_COMMERCIAL"        // hiring intent: local operators / map pack / ads
  | "MIXED_COMMERCIAL"        // hiring intent present but diluted
  | "RETAIL_PRODUCT"          // big-box / product pages — buying materials, not hiring
  | "INFORMATIONAL"           // articles, DIY, definitions
  | "INSTITUTIONAL"           // government, education, reference
  | "INSUFFICIENT_EVIDENCE";

export interface IntentEvidence {
  localOperatorsTop10: number;
  directoriesTop10: number;       // Yelp/Angi etc — commercial LOCAL intent
  marketplacesTop10: number;
  nationalRetailTop10: number;    // Home Depot / Lowe's / IKEA — product intent
  informationalTop10: number;     // national content/editorial
  institutionalTop10: number;     // wikipedia / .gov / .edu
  adCount: number | null;
  mapPackSize: number | null;
  cpc: number | null;
  commercialSlots: number;
  nonCommercialSlots: number;
  topSlots: string[];
}

const RETAIL_HOSTS = ["homedepot.com", "lowes.com", "menards.com", "ikea.com", "wayfair.com", "amazon.com", "target.com", "walmart.com", "costco.com", "ferguson.com"];

/**
 * Deterministic intent classification from SERP composition.
 * Hiring intent is evidenced by local operators, directories, ads and a map pack.
 * Product and informational results are evidence AGAINST hiring intent.
 */
export function validateCommercialIntent(input: {
  slots: OrganicSlot[];
  adCount: number | null;
  mapPackSize: number | null;
  cpc: number | null;
}): DimensionResult<IntentEvidence> & { intentClass: IntentClass } {
  const top10 = input.slots.slice(0, 10);
  const isRetail = (h: string) => RETAIL_HOSTS.some((r) => h === r || h.endsWith(`.${r}`));

  const localOperators = top10.filter((s) => s.slotClass === "local-specialist").length;
  const franchises = top10.filter((s) => s.slotClass === "franchise").length;
  const directories = top10.filter((s) => s.slotClass === "directory" && !isRetail(s.host)).length;
  const marketplaces = top10.filter((s) => s.slotClass === "marketplace").length;
  const nationalRetail = top10.filter((s) => isRetail(s.host) || (s.slotClass === "national-brand" && isRetail(s.host))).length;
  const informational = top10.filter((s) => s.slotClass === "national-content" || s.slotClass === "news").length;
  const institutional = top10.filter((s) => s.slotClass === "reference").length;

  // Local operators, franchises, directories, marketplaces and ads all indicate a
  // searcher looking to HIRE. Retail, editorial and reference indicate they are not.
  const commercialSlots = localOperators + franchises + directories + marketplaces;
  const nonCommercialSlots = nationalRetail + informational + institutional;

  const evidence: IntentEvidence = {
    localOperatorsTop10: localOperators, directoriesTop10: directories, marketplacesTop10: marketplaces,
    nationalRetailTop10: nationalRetail, informationalTop10: informational, institutionalTop10: institutional,
    adCount: input.adCount, mapPackSize: input.mapPackSize, cpc: input.cpc,
    commercialSlots, nonCommercialSlots,
    topSlots: top10.slice(0, 5).map((s) => `${s.position}. ${s.host} [${s.slotClass}]`),
  };

  if (top10.length === 0) {
    return { intentClass: "INSUFFICIENT_EVIDENCE", verdict: "NEEDS_REVIEW", score: null, confidence: 0,
      explanation: "No organic results were captured, so commercial intent cannot be assessed.", evidence, version: VALIDATION_VERSION };
  }

  let score = 50;
  score += Math.min(localOperators * 10, 30);
  score += Math.min((directories + marketplaces) * 5, 15);
  score += franchises * 4;
  if ((input.adCount ?? 0) > 0) score += 8;                      // advertisers pay for hiring intent
  if ((input.mapPackSize ?? 0) > 0) score += 6;
  if (typeof input.cpc === "number" && input.cpc >= 2) score += 6;
  score -= nationalRetail * 9;
  score -= informational * 7;
  score -= institutional * 8;
  score = clamp(score);

  // Classification is driven by composition, not by the score alone.
  let intentClass: IntentClass;
  if (localOperators === 0 && nonCommercialSlots >= 3) {
    intentClass = nationalRetail >= informational && nationalRetail >= institutional ? "RETAIL_PRODUCT"
      : institutional > informational ? "INSTITUTIONAL" : "INFORMATIONAL";
  } else if (localOperators >= 3 || (localOperators >= 1 && commercialSlots >= 4)) intentClass = "LOCAL_COMMERCIAL";
  else if (commercialSlots >= 2) intentClass = "MIXED_COMMERCIAL";
  else intentClass = "INSUFFICIENT_EVIDENCE";

  // GATE: an opportunity whose SERP shows nobody hiring a local provider cannot be
  // rescued by strong numbers elsewhere. This is the Conroe condition.
  let verdict: Verdict, explanation: string;
  if (intentClass === "RETAIL_PRODUCT" || intentClass === "INFORMATIONAL" || intentClass === "INSTITUTIONAL") {
    verdict = "FAIL";
    explanation = `Google is not showing people hiring a local provider for this query. The top 10 contains no local service business, and ${nonCommercialSlots} results are ${intentClass === "RETAIL_PRODUCT" ? "national retailers selling products" : intentClass === "INSTITUTIONAL" ? "reference or institutional pages" : "articles and editorial content"}. A rank-and-rent asset here would attract readers or shoppers, not customers a contractor would pay for.`;
  } else if (intentClass === "LOCAL_COMMERCIAL") {
    verdict = "PASS";
    explanation = `Clear hiring intent: ${localOperators} local service business${localOperators === 1 ? "" : "es"} rank organically${directories + marketplaces > 0 ? `, alongside ${directories + marketplaces} directory/marketplace result${directories + marketplaces === 1 ? "" : "s"}` : ""}${(input.mapPackSize ?? 0) > 0 ? `, with a ${input.mapPackSize}-listing map pack` : ""}${(input.adCount ?? 0) > 0 ? ` and ${input.adCount} advertiser${input.adCount === 1 ? "" : "s"} bidding` : ""}. This is a market where people hire.`;
  } else if (intentClass === "MIXED_COMMERCIAL") {
    verdict = "PASS_WITH_WARNING";
    explanation = `Hiring intent is present but diluted: only ${localOperators} local operator${localOperators === 1 ? "" : "s"} rank organically, against ${nonCommercialSlots} retail/editorial/reference result${nonCommercialSlots === 1 ? "" : "s"}. The query is partly commercial, so expect to compete for a narrower slice of the traffic.`;
  } else {
    verdict = "NEEDS_REVIEW";
    explanation = "The SERP composition does not clearly indicate whether searchers are hiring a provider. Manual review of the actual results is required before spending money.";
  }

  const confidence = Math.min(0.5 + top10.length * 0.05 + (input.mapPackSize !== null ? 0.1 : 0) + (input.cpc !== null ? 0.1 : 0), 0.95);
  return { intentClass, verdict, score, confidence, explanation, evidence, version: VALIDATION_VERSION };
}

// =========================================================================
// B. EXPANSION SURFACE
// Legitimate SEO surface beyond the head keyword. Never a raw multiplication.
// =========================================================================
export interface ExpansionEvidence {
  primaryServices: { service: string; volume: number | null }[];
  viableServiceCount: number;
  candidateAreas: { area: string; basis: string }[];
  viableAreaCount: number;
  viableCombinations: number;
  demandCoveredPerMonth: number;
  thinContentRisk: boolean;
  geographyConfidence: "measured" | "approximate-adjacency" | "unknown";
  notes: string[];
}

/**
 * Expansion Surface counts only services with MEASURED demand and areas with a
 * defensible basis. Combinations are discounted, not multiplied: an area only
 * supports the services that are plausible there, and thin duplicates are excluded.
 */
export function validateExpansionSurface(input: {
  headService: string;
  headVolume: number | null;
  relatedServices: { service: string; volume: number | null }[];  // measured in THIS geography
  areas: { area: string; basis: string }[];
  geographyConfidence: "measured" | "approximate-adjacency" | "unknown";
}): DimensionResult<ExpansionEvidence> {
  const notes: string[] = [];
  // A service counts only if demand for it was actually measured in this market.
  const viableServices = input.relatedServices.filter((s) => typeof s.volume === "number" && s.volume >= 50);
  const unmeasured = input.relatedServices.filter((s) => typeof s.volume !== "number").length;
  if (unmeasured > 0) notes.push(`${unmeasured} candidate service${unmeasured === 1 ? "" : "s"} had no provider demand data and were EXCLUDED rather than assumed viable.`);

  const serviceCount = viableServices.length + (typeof input.headVolume === "number" ? 1 : 0);
  const areaCount = input.areas.length;

  // Not every service is worth a page in every area. Discount by area rank: the
  // primary market supports the full service set, secondary areas support fewer.
  const combos = areaCount === 0 ? serviceCount
    : serviceCount + Math.round(serviceCount * Math.min(areaCount, 12) * 0.45);
  const demandCovered = (typeof input.headVolume === "number" ? input.headVolume : 0)
    + viableServices.reduce((a, s) => a + (s.volume as number), 0);

  // Thin-content risk: many pages resting on very little measured demand.
  const thinContentRisk = combos > 20 && demandCovered < 500;
  if (thinContentRisk) notes.push("Apparent surface is large relative to measured demand — most Service × Area pages would be thin or duplicative.");
  if (input.geographyConfidence === "approximate-adjacency") notes.push("Nearby areas are inferred from state/county membership, not verified drive-time adjacency. Area count is indicative and needs a gazetteer with coordinates to firm up.");

  const score = clamp(18 * Math.min(serviceCount, 6) + Math.min(areaCount, 10) * 2 - (thinContentRisk ? 25 : 0));
  const verdict: Verdict = serviceCount <= 1 && areaCount === 0 ? "NEEDS_REVIEW" : thinContentRisk ? "PASS_WITH_WARNING" : "PASS";

  const explanation = serviceCount <= 1 && areaCount === 0
    ? `Only the head service has measured demand here and no defensible surrounding areas were identified. This asset would likely remain a one-page site, which caps its ceiling.`
    : `${serviceCount} service${serviceCount === 1 ? "" : "s"} with measured demand and ${areaCount} defensible area${areaCount === 1 ? "" : "s"} support roughly ${combos} legitimate pages covering about ${demandCovered.toLocaleString()} searches/month.${thinContentRisk ? " Demand is thin relative to that page count, so build fewer, better pages." : ""}`;

  return {
    verdict, score, confidence: input.geographyConfidence === "measured" ? 0.8 : 0.55, explanation,
    evidence: { primaryServices: [{ service: input.headService, volume: input.headVolume }, ...viableServices],
      viableServiceCount: serviceCount, candidateAreas: input.areas, viableAreaCount: areaCount,
      viableCombinations: combos, demandCoveredPerMonth: demandCovered, thinContentRisk,
      geographyConfidence: input.geographyConfidence, notes },
    version: VALIDATION_VERSION,
  };
}

// =========================================================================
// C. SITE ARCHITECTURE PREVIEW (investment-planning artifact only)
// =========================================================================
export interface ArchitectureNode { path: string; label: string; kind: "home" | "service" | "area" | "service-area" | "supporting"; children?: ArchitectureNode[] }
export function previewArchitecture(input: {
  headService: string; geography: string;
  services: string[]; areas: string[];
}): { tree: ArchitectureNode; estimatedPages: number; clusters: string[]; internalLinking: string[] } {
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const services = [input.headService, ...input.services].slice(0, 8);
  const areas = input.areas.slice(0, 10);
  const tree: ArchitectureNode = {
    path: "/", label: `${input.headService} — ${input.geography}`, kind: "home",
    children: [
      { path: "/services/", label: "Services", kind: "service",
        children: services.map((s) => ({ path: `/services/${slug(s)}/`, label: s, kind: "service" as const })) },
      ...(areas.length ? [{ path: "/areas/", label: "Service Areas", kind: "area" as const,
        children: areas.map((a) => ({ path: `/areas/${slug(a)}/`, label: a, kind: "area" as const,
          children: services.slice(0, 3).map((s) => ({ path: `/areas/${slug(a)}/${slug(s)}/`, label: `${s} in ${a}`, kind: "service-area" as const })) })) }] : []),
    ],
  };
  const estimatedPages = 1 + services.length + areas.length + areas.length * Math.min(services.length, 3);
  return {
    tree, estimatedPages,
    clusters: [`${input.headService} core commercial cluster`, ...(areas.length ? ["Geographic service-area cluster"] : []),
      ...(services.length > 2 ? ["Adjacent-service cluster"] : [])],
    internalLinking: ["Home links to every service page and the top service areas",
      "Each service page links to its Service × Area variants",
      "Area pages cross-link to sibling areas to distribute authority",
      "Every commercial page links back to a single conversion path"],
  };
}

// =========================================================================
// D. CANNIBALIZATION / QUERY OVERLAP RISK
// =========================================================================
export interface CannibalEvidence { conflictGroups: { intent: string; pages: string[] }[]; recommendations: string[]; pageCount: number; distinctIntents: number }
export function assessCannibalization(input: {
  headService: string; geography: string; services: string[]; areas: string[]; estimatedPages: number;
}): DimensionResult<CannibalEvidence> {
  const conflicts: { intent: string; pages: string[] }[] = [];
  const recs: string[] = [];

  // The classic collision: the home page, the head service page and the primary
  // Service × Area page all target the same "service + city" intent.
  conflicts.push({ intent: `${input.headService} ${input.geography} (primary commercial intent)`,
    pages: ["/", `/services/${input.headService.toLowerCase().replace(/\s+/g, "-")}/`, `/areas/${input.geography.toLowerCase().replace(/\s+/g, "-")}/`] });
  recs.push(`Point the home page at "${input.headService} ${input.geography}" and make the head service page a supporting overview, or drop the separate service page entirely.`);

  // Near-duplicate services collide when they are synonyms rather than distinct jobs.
  const near = input.services.filter((s) => {
    const a = s.toLowerCase(), b = input.headService.toLowerCase();
    return a !== b && (a.includes(b.split(" ")[0]!) || b.includes(a.split(" ")[0]!));
  });
  if (near.length) {
    conflicts.push({ intent: "Overlapping service variants", pages: near.map((s) => `/services/${s.toLowerCase().replace(/\s+/g, "-")}/`) });
    recs.push(`${near.join(", ")} overlap with the head service. Consolidate them into one page with sections unless each has separately measured demand.`);
  }

  const distinctIntents = 1 + input.services.filter((s) => !near.includes(s)).length + input.areas.length;
  const ratio = input.estimatedPages / Math.max(distinctIntents, 1);
  const verdict: Verdict = ratio >= 3 ? "NEEDS_REVIEW" : ratio >= 2 ? "PASS_WITH_WARNING" : "PASS";
  if (ratio >= 2) recs.push("Planned page count materially exceeds the number of distinct search intents — build the intents that exist rather than filling a template.");

  return {
    verdict, score: clamp(100 - (ratio - 1) * 35), confidence: 0.6,
    explanation: ratio >= 3
      ? `About ${input.estimatedPages} planned pages chase roughly ${distinctIntents} genuinely distinct intents. Several pages would compete with each other and dilute the site.`
      : ratio >= 2
        ? `Planned pages modestly outnumber distinct intents (${input.estimatedPages} vs ~${distinctIntents}). Manageable, but the home page and head service page must be differentiated deliberately.`
        : `Planned pages map cleanly onto distinct intents (${input.estimatedPages} vs ~${distinctIntents}). Low overlap risk.`,
    evidence: { conflictGroups: conflicts, recommendations: recs, pageCount: input.estimatedPages, distinctIntents },
    version: VALIDATION_VERSION,
  };
}

// =========================================================================
// E. LOCAL CONTENT DEPTH — capability, never invented facts
// =========================================================================
export interface LocalDepthEvidence { availableSignals: string[]; missingSignals: string[]; areaCount: number; competitorContentBarWords: number | null }
export function assessLocalContentDepth(input: {
  geography: string; geographyType: string; areas: string[];
  population: number | null; medianIncome: number | null;
  competitorContentBarWords: number | null; communityHomes?: number | null;
}): DimensionResult<LocalDepthEvidence> {
  const have: string[] = [], missing: string[] = [];
  if (input.areas.length >= 3) have.push(`${input.areas.length} named surrounding areas`); else missing.push("surrounding service areas");
  if (typeof input.population === "number") have.push("population profile"); else missing.push("population profile");
  if (typeof input.medianIncome === "number") have.push("household income profile"); else missing.push("household income profile");
  if (typeof input.communityHomes === "number") have.push(`community housing scale (~${input.communityHomes.toLocaleString()} homes)`);
  if (typeof input.competitorContentBarWords === "number") have.push(`measured competitor content depth (~${input.competitorContentBarWords} words)`); else missing.push("competitor content depth");
  // Deliberately NOT claimed: landmarks, climate, regulations, local pricing. We hold
  // no verified evidence for these and will not invent them.
  missing.push("verified landmarks / climate / local regulation / local pricing evidence (not collected — must not be fabricated at build time)");

  const score = clamp(have.length * 18);
  const verdict: Verdict = have.length >= 4 ? "PASS" : have.length >= 2 ? "PASS_WITH_WARNING" : "NEEDS_REVIEW";
  return {
    verdict, score, confidence: 0.5,
    explanation: have.length >= 4
      ? `Enough verified local signal (${have.slice(0, 3).join(", ")}) to differentiate pages without inventing facts.`
      : `Limited verified local signal — only ${have.join(", ") || "none"}. Pages risk reading generically unless real local research is done at build time.`,
    evidence: { availableSignals: have, missingSignals: missing, areaCount: input.areas.length, competitorContentBarWords: input.competitorContentBarWords },
    version: VALIDATION_VERSION,
  };
}

// =========================================================================
// F. VISUAL / TRUST ASSET FEASIBILITY — preserved for deployment planning
// =========================================================================
const VISUAL_PROFILE: Record<string, { score: number; assets: string[] }> = {
  "pool-builder": { score: 95, assets: ["completed pool photography", "before/after backyard transformations", "3D design renders", "construction-process sequence", "lighting/night shots"] },
  "kitchen-remodel": { score: 92, assets: ["before/after kitchens", "material and finish close-ups", "design renders", "process timeline"] },
  "bathroom-remodel": { score: 90, assets: ["before/after bathrooms", "tile and fixture detail", "renders", "process timeline"] },
  "window-replacement": { score: 70, assets: ["before/after facade", "product cutaway diagrams", "installation process", "energy-efficiency graphics"] },
  "metal-roofing": { score: 78, assets: ["roof profile photography", "material samples", "drone project shots", "installation sequence"] },
  "basement-waterproofing": { score: 62, assets: ["before/after basement", "system diagrams", "excavation process", "moisture problem imagery"] },
  "house-cleaning": { score: 45, assets: ["before/after rooms", "team/trust imagery", "checklist graphics"] },
  "appliance-repair": { score: 35, assets: ["technician imagery", "brand/badge trust marks", "diagnostic diagrams"] },
};
export function assessVisualFeasibility(serviceSlug: string): DimensionResult<{ suggestedAssets: string[]; basis: string }> {
  const p = VISUAL_PROFILE[serviceSlug] ?? { score: 55, assets: ["service photography", "trust and credential elements", "process diagrams"] };
  return {
    verdict: p.score >= 70 ? "PASS" : p.score >= 45 ? "PASS_WITH_WARNING" : "NEEDS_REVIEW",
    score: p.score, confidence: 0.4,
    explanation: p.score >= 70
      ? `Highly visual service — strong before/after and project imagery are available, which supports a credible, non-generic site.`
      : `Limited natural imagery. The build will lean on trust elements and diagrams; extra care is needed to avoid a cheap-looking AI site.`,
    evidence: { suggestedAssets: p.assets, basis: "HUMAN_ASSUMED service-level judgement, recorded for deployment planning; does not affect A–I scoring" },
    version: VALIDATION_VERSION,
  };
}

// =========================================================================
// G. THE GATE — combines dimension verdicts with existing hard rules
// =========================================================================
export interface GateInput {
  intent: DimensionResult & { intentClass: IntentClass };
  expansion: DimensionResult;
  cannibalization: DimensionResult;
  localDepth: DimensionResult;
  visual: DimensionResult;
  // hard conditions already encoded elsewhere in RankRentOS
  viableRenters: number | null;      // null = NOT MEASURED (e.g. empty map pack), never "zero renters"
  renterEvidenceAvailable: boolean;  // false when no map pack was returned at all
  organicScore: number | null;
  measuredVolume: number | null;
  assetValueF: number | null;
  geographyVerdict: string | null;
  demandProven: boolean;
  isControl?: boolean;               // controls are exempt from the demand floor by design
}
export interface GateResult { status: Verdict; reasons: string[]; blockers: string[]; warnings: string[]; readyForPurchaseDecision: boolean }

export function applyPrePurchaseGate(g: GateInput): GateResult {
  const blockers: string[] = [], warnings: string[] = [], reasons: string[] = [];

  if (g.intent.verdict === "FAIL") blockers.push(`Commercial intent gate: ${g.intent.explanation}`);
  // UNKNOWN != ZERO. An empty map pack means renter depth was NOT MEASURED; it must
  // not read as "no renters exist". Only an observed zero against real evidence blocks.
  if (!g.renterEvidenceAvailable) warnings.push("Renter depth could not be measured here (no map pack was returned) — this is missing evidence, not evidence that no renter exists. Confirm manually before purchase.");
  else if ((g.viableRenters ?? 0) < 1) blockers.push("No viable renter was found in this market — there is nobody to rent the asset to, which is the entire business model.");
  if (g.geographyVerdict === "serp-not-localized") blockers.push("The SERP evidence is not localized to the intended market, so every competitive read is unreliable.");
  if (g.geographyVerdict === "unverified-no-address-evidence") warnings.push("Geography could not be confirmed from map-pack addresses.");
  // A control asset's low measured demand IS the experimental design, not a defect.
  if (g.demandProven && !g.isControl && (g.measuredVolume ?? 0) < 100) blockers.push("Measured demand is below the 100/mo floor.");
  if (g.isControl) reasons.push("Experimental control — the demand floor does not apply; its measured volume is the calibration point.");
  if (g.demandProven && (g.assetValueF ?? 0) < 34) warnings.push("Realizable renter gross profit sits near or below the $300/mo minimum rent.");
  if ((g.organicScore ?? 0) < 45 && g.organicScore !== null) warnings.push(`Organic SERP is hostile (organic-v1.2 ${g.organicScore}) — ranking will be slow and uncertain.`);

  if (g.intent.verdict === "PASS_WITH_WARNING") warnings.push("Commercial intent is present but diluted.");
  if (g.expansion.verdict === "PASS_WITH_WARNING") warnings.push("Expansion surface is thin relative to the page count it implies.");
  if (g.expansion.verdict === "NEEDS_REVIEW") warnings.push("Little defensible expansion surface beyond the head keyword.");
  if (g.cannibalization.verdict === "NEEDS_REVIEW") warnings.push("Planned architecture would likely cannibalize itself.");
  if (g.localDepth.verdict === "NEEDS_REVIEW") warnings.push("Thin verified local signal for differentiated content.");

  if (g.intent.verdict === "PASS") reasons.push("Clear local hiring intent.");
  if ((g.viableRenters ?? 0) >= 1) reasons.push(`${g.viableRenters} viable renter${g.viableRenters === 1 ? "" : "s"} identified.`);
  if ((g.organicScore ?? 0) >= 55) reasons.push(`Organic SERP is realistically beatable (${g.organicScore}).`);

  const status: Verdict = blockers.length ? "FAIL"
    : warnings.length >= 3 ? "NEEDS_REVIEW"
    : warnings.length ? "PASS_WITH_WARNING" : "PASS";

  return { status, reasons, blockers, warnings, readyForPurchaseDecision: status === "PASS" || status === "PASS_WITH_WARNING" };
}
