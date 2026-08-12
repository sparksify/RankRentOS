// ORGANIC-ONLY RANKABILITY (organic-v1)
//
// Dimension A blends map-pack weakness into rankability: a weak pack can add up to
// +20 points. For an ORGANIC-ONLY asset with no Google Business Profile, that is
// compensation we are not entitled to — we cannot rank in a pack we cannot enter.
//
// This module scores ONLY what an organic-only site actually competes for:
// positions 1-10 of the blue links. Local-pack facts are preserved separately as
// market evidence (who the real operators are, how entrenched they are) and are
// NEVER added to the organic score.
import { DIRECTORY_DOMAINS, FRANCHISE_DOMAINS, LEAD_MARKETPLACES, INTENT_MISMATCH_DOMAINS } from "./lists";

export const ORGANIC_VERSION = "organic-v1";

const SOCIAL = ["facebook.com", "instagram.com", "youtube.com", "pinterest.com", "tiktok.com", "nextdoor.com", "linkedin.com", "x.com", "twitter.com"];
const FORUM = ["reddit.com", "quora.com", "city-data.com"];
const REFERENCE = ["wikipedia.org"];
const NEWS = ["patch.com", "star-telegram.com", "dallasnews.com"];
// National brands / manufacturers / franchise chains and national content-affiliate
// sites. These rank on domain authority, not on local relevance, and a dedicated
// local page competes with them differently than with an independent local operator.
const NATIONAL_BRAND = [
  "rebath.com", "pella.com", "andersenwindows.com", "renewalbyandersen.com", "champion.com",
  "homedepot.com", "lowes.com", "menards.com", "leaffilter.com", "servpro.com", "roto-rooter.com",
  "anytimefitness.com", "mrhandyman.com", "molly-maid.com", "mollymaid.com", "chemdry.com",
];
const NATIONAL_CONTENT = [
  "ecowatch.com", "thisoldhouse.com", "bobvila.com", "forbes.com", "architecturaldigest.com",
  "consumeraffairs.com", "homeadvisor.com", "thespruce.com", "familyhandyman.com", "cnet.com",
  "usnews.com", "goodhousekeeping.com", "marthastewart.com", "hgtv.com",
];

export type SlotClass =
  | "directory" | "marketplace" | "social" | "forum" | "reference" | "news"
  | "intent-mismatch" | "franchise" | "national-brand" | "national-content"
  | "adjacent-not-this-service" | "local-specialist";

export interface OrganicSlot {
  position: number;
  host: string;
  slotClass: SlotClass;
  /** true when an organic-only newcomer can realistically take this slot */
  displaceable: boolean;
  isInnerPage: boolean;
  targetsGeoInTitle: boolean;
  geoInDomain: boolean;
}

// Exact host or true subdomain suffix ONLY. A substring test wrongly matched
// "x.com" inside "paintedtreetx.com" and classified a community site as social.
const hostMatch = (host: string, list: readonly string[]) =>
  list.some((d) => host === d || host.endsWith(`.${d}`));

export function classifySlot(link: string, title: string, geo: string, position: number, serviceTerms: string[] = []): OrganicSlot | null {
  let host: string;
  try { host = new URL(link).hostname.replace(/^www\./, "").toLowerCase(); } catch { return null; }
  const t2 = (title ?? "").toLowerCase();
  const t = t2;
  const g = geo.toLowerCase();
  const geoToken = g.replace(/[^a-z0-9]/g, "");

  let slotClass: SlotClass = "local-specialist";
  if (hostMatch(host, DIRECTORY_DOMAINS)) slotClass = "directory";
  else if (hostMatch(host, LEAD_MARKETPLACES)) slotClass = "marketplace";
  else if (hostMatch(host, SOCIAL)) slotClass = "social";
  else if (hostMatch(host, FORUM)) slotClass = "forum";
  else if (hostMatch(host, INTENT_MISMATCH_DOMAINS)) slotClass = "intent-mismatch";
  else if (hostMatch(host, FRANCHISE_DOMAINS)) slotClass = "franchise";
  else if (hostMatch(host, NATIONAL_BRAND)) slotClass = "national-brand";
  else if (hostMatch(host, NATIONAL_CONTENT)) slotClass = "national-content";
  else if (hostMatch(host, REFERENCE) || host.endsWith(".gov") || host.endsWith(".edu")) slotClass = "reference";
  else if (hostMatch(host, NEWS)) slotClass = "news";

  // A result whose title never names the service is not a competing service page:
  // community sites, home builders, chambers of commerce. It occupies the slot by
  // topical adjacency and a dedicated service page displaces it readily.
  const namesService = serviceTerms.length === 0 || serviceTerms.some((t) => t && t.length > 2 && t2.includes(t));
  if (slotClass === "local-specialist" && !namesService) slotClass = "adjacent-not-this-service";

  // A directory/social/forum/reference/news/mismatch slot is soft: a purpose-built
  // local page routinely outranks them. A franchise or a real local specialist is not.
  const displaceable = ["directory", "marketplace", "social", "forum", "reference", "news",
    "intent-mismatch", "national-content", "adjacent-not-this-service"].includes(slotClass);

  let isInnerPage = false;
  try { isInnerPage = new URL(link).pathname.replace(/\/$/, "").split("/").filter(Boolean).length >= 1; } catch { /* keep false */ }

  return {
    position, host, slotClass, displaceable, isInnerPage,
    targetsGeoInTitle: t.includes(g),
    geoInDomain: host.replace(/[^a-z0-9]/g, "").includes(geoToken),
  };
}

export interface OrganicInput {
  organic: { link: string; title?: string; position?: number }[];
  geo: string;                              // city or community name
  serviceTerms?: string[];                  // head terms of the service, e.g. ["pool"]
  competitorAvgWords?: number | null;       // content bar we must clear (UNKNOWN stays null)
  competitorAvgDomainAgeYears?: number | null;
}

export interface OrganicResult {
  version: string;
  score: number | null;
  verdict: "ORGANIC-VIABLE" | "ORGANIC-CONTESTED" | "ORGANIC-BRUTAL" | null;
  slots: OrganicSlot[];
  displaceableTop5: number;
  displaceableTop10: number;
  hardLocalTop3: number;
  hardLocalTop5: number;
  geoTargetedCompetitorsTop5: number;
  missing: string[];
  rationale: string[];
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Deterministic organic-only rankability. Map-pack evidence is deliberately absent. */
export function organicRankability(input: OrganicInput): OrganicResult {
  const slots = input.organic
    .map((o, i) => classifySlot(o.link, o.title ?? "", input.geo, o.position ?? i + 1, input.serviceTerms ?? []))
    .filter((s): s is OrganicSlot => s !== null)
    .slice(0, 10);

  if (slots.length === 0) {
    return { version: ORGANIC_VERSION, score: null, verdict: null, slots: [], displaceableTop5: 0, displaceableTop10: 0,
      hardLocalTop3: 0, hardLocalTop5: 0, geoTargetedCompetitorsTop5: 0, missing: ["organic results"], rationale: ["no organic evidence — cannot assess"] };
  }

  const top5 = slots.filter((s) => s.position <= 5);
  const top3 = slots.filter((s) => s.position <= 3);
  const displaceableTop5 = top5.filter((s) => s.displaceable).length;
  const displaceableTop10 = slots.filter((s) => s.displaceable).length;
  const hardLocalTop3 = top3.filter((s) => !s.displaceable).length;
  const hardLocalTop5 = top5.filter((s) => !s.displaceable).length;
  // national brands/franchises rank on authority rather than local relevance; a
  // dedicated local page competes with them more easily than with a local operator.
  const brandWeight = (s: OrganicSlot) => (s.slotClass === "franchise" || s.slotClass === "national-brand" ? 0.6 : 1);
  const weightedHardTop3 = top3.filter((s) => !s.displaceable).reduce((a, s) => a + brandWeight(s), 0);
  const weightedHardTop5 = top5.filter((s) => !s.displaceable).reduce((a, s) => a + brandWeight(s), 0);
  const geoTargeted = top5.filter((s) => !s.displaceable && (s.targetsGeoInTitle || s.geoInDomain)).length;

  const r: string[] = [], missing: string[] = [];
  let s = 50;

  // Soft slots are the opportunity: each one is a position a purpose-built page can take.
  s += Math.min(displaceableTop5 * 7, 28);
  s += Math.min((displaceableTop10 - displaceableTop5) * 2, 10);
  if (displaceableTop5 > 0) r.push(`${displaceableTop5} of the top 5 organic slots are directories/marketplaces/social — displaceable by a purpose-built local page`);

  // Real local competitors are the wall.
  s -= weightedHardTop3 * 9;
  s -= (weightedHardTop5 - weightedHardTop3) * 4;
  if (hardLocalTop3 >= 3) r.push("top 3 organic is entirely real local businesses — no soft entry point");

  // Competitors already targeting the exact geography are the hardest to displace.
  s -= geoTargeted * 4;
  if (geoTargeted >= 3) r.push(`${geoTargeted} top-5 competitors explicitly target "${input.geo}" in title or domain`);

  // Content bar.
  if (typeof input.competitorAvgWords === "number") {
    if (input.competitorAvgWords > 2500) { s -= 12; r.push(`content bar ~${input.competitorAvgWords} words — expensive to beat`); }
    else if (input.competitorAvgWords > 1500) { s -= 6; r.push(`content bar ~${input.competitorAvgWords} words`); }
    else if (input.competitorAvgWords < 800) { s += 8; r.push(`thin competitor content (~${input.competitorAvgWords} words) — cheap to out-publish`); }
  } else missing.push("serp.competitor.avgwords");

  // Domain age: a headwind, never by itself disqualifying (established Exp-1.5 finding).
  if (typeof input.competitorAvgDomainAgeYears === "number") {
    if (input.competitorAvgDomainAgeYears > 20) { s -= 8; r.push(`competitor domains average ${input.competitorAvgDomainAgeYears}y — long authority head start`); }
    else if (input.competitorAvgDomainAgeYears > 12) s -= 4;
    else if (input.competitorAvgDomainAgeYears < 6) { s += 6; r.push("young competitor domains — little authority moat"); }
  } else missing.push("serp.competitor.domainageyears");

  // Inner pages ranking = competitors are not devoting a dedicated page to this query.
  const innerNonDisplaceableTop5 = top5.filter((s2) => !s2.displaceable && s2.isInnerPage).length;
  if (innerNonDisplaceableTop5 >= 2) { s += 5; r.push("competitors rank with inner pages, not dedicated local pages"); }

  const score = clamp(s);
  const verdict = score >= 65 ? "ORGANIC-VIABLE" : score >= 45 ? "ORGANIC-CONTESTED" : "ORGANIC-BRUTAL";
  return { version: ORGANIC_VERSION, score, verdict, slots, displaceableTop5, displaceableTop10, hardLocalTop3, hardLocalTop5, geoTargetedCompetitorsTop5: geoTargeted, missing, rationale: r };
}

/** Local-pack facts kept as MARKET EVIDENCE only. Never added to the organic score. */
export interface LocalPackEvidence {
  mapPackSize: number | null;
  avgReviews: number | null;
  listingsWithoutWebsite: number | null;
  interpretation: string;
}
export function localPackEvidence(mapPackSize: number | null, avgReviews: number | null, noWebsite: number | null): LocalPackEvidence {
  let interpretation: string;
  if (mapPackSize === 0 || mapPackSize === null) interpretation = "no map pack rendered — read as a demand signal, not as an opening";
  else if (avgReviews === null) interpretation = "map pack present, review strength unknown";
  else if (avgReviews < 25) interpretation = "weak pack incumbents — relevant to a future GBP play and to renter quality, NOT to organic difficulty";
  else if (avgReviews > 400) interpretation = "entrenched pack incumbents — strong renter candidates, but says nothing about organic difficulty";
  else interpretation = "moderate pack strength — market evidence only";
  return { mapPackSize, avgReviews, listingsWithoutWebsite: noWebsite, interpretation };
}
