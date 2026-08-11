/**
 * Deterministic SERP signal extraction — V0's measurement layer, ported.
 *
 * This module preserves V0's MEASUREMENTS, not its scoring: it counts and
 * classifies what a SERP contains and never produces a score. Phase-4
 * scoring consumes these signals as evidence.
 *
 * Bump SIGNALS_VERSION whenever extraction logic changes — serpSnapshots
 * record the version so historical extractions stay interpretable.
 */
import {
  DIRECTORY_DOMAINS,
  FRANCHISE_DOMAINS,
  INTENT_MISMATCH_DOMAINS,
  LEAD_MARKETPLACES,
  hostMatches,
  hostOf,
} from "./lists";

export const SIGNALS_VERSION = "1.0.0";

export interface SerpOrganicResult {
  position: number;
  title?: string;
  link?: string;
  snippet?: string;
}
export interface SerpLocalPlace {
  name: string;
  rating?: number;
  reviews?: number;
  website?: string;
  type?: string;
}
export interface SerpAd {
  title?: string;
  link?: string;
  displayedLink?: string;
}
export interface TrimmedSerp {
  organic: SerpOrganicResult[];
  localPack: SerpLocalPlace[];
  ads: SerpAd[];
}

export interface SerpSignals {
  // SERP composition
  directoriesInTop3: number;
  innerPagesInTop5: number;
  intentMismatchInTop5: number;
  outOfTownInTop3: number;
  franchisesInTop3: number;
  buyerProof: boolean; // lead marketplace in top-10 OR any ads
  // on-page targeting
  top3TitlesMissingCity: number;
  // local pack
  mapPack: "absent" | "present";
  mapPackSize: number;
  avgMapReviews: number | null;
  mapListingsWithoutWebsite: number;
  // advertisers
  adCount: number;
  advertisers: string[];
  // enrichment (null when not collected)
  competitorAvgWords: number | null;
  competitorAvgDomainAgeYears: number | null;
}

function isDirectory(url: string | undefined): boolean {
  return hostMatches(url, DIRECTORY_DOMAINS);
}

function isInnerPage(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const path = new URL(url).pathname.replace(/\/$/, "");
    return path.split("/").filter(Boolean).length >= 1;
  } catch {
    return false;
  }
}

export interface SignalExtras {
  /** Average words on top competitor pages (content-depth crawl). */
  competitorAvgWords?: number | null;
  /** Registration ages (years) of top-3 non-directory competitor domains. */
  competitorDomainAgesYears?: number[];
}

export function extractSignals(
  serp: TrimmedSerp,
  city: string,
  extras: SignalExtras = {},
): SerpSignals {
  const top3 = serp.organic.slice(0, 3);
  const top5 = serp.organic.slice(0, 5);
  const cityL = city.toLowerCase();

  const directoriesInTop3 = top3.filter((r) => isDirectory(r.link)).length;
  const innerPagesInTop5 = top5.filter(
    (r) => !isDirectory(r.link) && isInnerPage(r.link),
  ).length;
  const intentMismatchInTop5 = top5.filter((r) =>
    hostMatches(r.link, INTENT_MISMATCH_DOMAINS),
  ).length;

  // Out-of-town: top-3 local-business results anchored elsewhere — a
  // service-area page, or an inner page that never mentions the target city.
  const outOfTownInTop3 = top3.filter((r) => {
    if (isDirectory(r.link)) return false;
    const text = `${r.title ?? ""} ${r.link ?? ""}`.toLowerCase();
    const mentionsTarget = text.includes(cityL);
    const isServiceAreaPage = /service-area|locations|areas-we-serve|cities/.test(
      r.link ?? "",
    );
    return isServiceAreaPage || (!mentionsTarget && isInnerPage(r.link));
  }).length;

  const franchisesInTop3 = top3.filter((r) =>
    hostMatches(r.link, FRANCHISE_DOMAINS),
  ).length;

  const buyerProof =
    serp.organic.some((r) => hostMatches(r.link, LEAD_MARKETPLACES)) ||
    serp.ads.length > 0;

  const top3TitlesMissingCity = top3.filter(
    (r) => !(r.title ?? "").toLowerCase().includes(cityL),
  ).length;

  const places = serp.localPack;
  const mapPackSize = places.length;
  const avgMapReviews =
    mapPackSize > 0
      ? Math.round(
          places.reduce((s, p) => s + (p.reviews ?? 0), 0) / mapPackSize,
        )
      : null;
  const mapListingsWithoutWebsite = places.filter((p) => !p.website).length;

  const ages = extras.competitorDomainAgesYears ?? [];
  const competitorAvgDomainAgeYears =
    ages.length > 0
      ? Math.round((ages.reduce((a, b) => a + b, 0) / ages.length) * 10) / 10
      : null;

  return {
    directoriesInTop3,
    innerPagesInTop5,
    intentMismatchInTop5,
    outOfTownInTop3,
    franchisesInTop3,
    buyerProof,
    top3TitlesMissingCity,
    mapPack: mapPackSize === 0 ? "absent" : "present",
    mapPackSize,
    avgMapReviews,
    mapListingsWithoutWebsite,
    adCount: serp.ads.length,
    advertisers: serp.ads
      .map((a) => a.displayedLink || hostOf(a.link))
      .filter((s): s is string => Boolean(s)),
    competitorAvgWords: extras.competitorAvgWords ?? null,
    competitorAvgDomainAgeYears,
  };
}

/** Top-3 non-directory .com competitor hosts — the RDAP age-lookup targets. */
export function competitorHosts(serp: TrimmedSerp): string[] {
  return [
    ...new Set(
      serp.organic
        .slice(0, 3)
        .filter((r) => !isDirectory(r.link))
        .map((r) => hostOf(r.link))
        .filter((h) => h.endsWith(".com")),
    ),
  ];
}
