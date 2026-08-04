// SERP result classification — ported from v0 score.js (the SOP-calibrated lists).
import type { SerpResultItem } from '../core/types.js';

export const FRANCHISE_DOMAINS = [
  'garageexperts.com', 'safelite.com', 'leaffilter.com', 'leafguard.com',
  'trugreen.com', 'servpro.com', 'servicemaster.com', 'stanleysteemer.com',
  '1800gotjunk.com', 'collegehunkshaulingjunk.com', 'mrhandyman.com',
  'mrrooter.com', 'aireserv.com', 'mollymaid.com', 'closetsbydesign.com',
  'californiaclosets.com', 'systempavers.com', 'rotorooter.com', 'gutterlogic.com',
  'puroclean.com', 'servicemasterrestore.com', 'cutco.com', 'neighborly.com',
  'gatorguard.com', 'guardianpro.com', 'hellogarage.com', 'premiergarage.com',
];

export const LEAD_MARKETPLACES = ['angi.com', 'angieslist.com', 'homeadvisor.com', 'thumbtack.com', 'networx.com', 'modernize.com'];

export const INTENT_MISMATCH_DOMAINS = [
  'lowes.com', 'homedepot.com', 'amazon.com', 'walmart.com', 'wayfair.com',
  'wikihow.com', 'forbes.com', 'bobvila.com', 'thisoldhouse.com', 'familyhandyman.com',
  'costco.com', 'menards.com', 'acehardware.com', 'etsy.com', 'reddit.com', 'quora.com',
];

export const DIRECTORY_DOMAINS = [
  'yelp.com', 'angi.com', 'angieslist.com', 'thumbtack.com', 'homeadvisor.com',
  'houzz.com', 'porch.com', 'bbb.org', 'yellowpages.com', 'facebook.com',
  'nextdoor.com', 'reddit.com', 'expertise.com', 'bark.com', 'care.com',
  'taskrabbit.com', 'homedepot.com', 'lowes.com', 'safelite.com', 'instagram.com',
  'mapquest.com', 'manta.com', 'birdeye.com', 'threebestrated.com', 'yellowbook.com',
  'yelp.ca', 'superpages.com', 'chamberofcommerce.com', 'citysearch.com',
];

export function hostOf(url: string | undefined): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function matchesDomainList(host: string, list: string[]): boolean {
  return list.some((d) => host === d || host.endsWith(`.${d}`));
}

export function isDirectory(host: string): boolean {
  return matchesDomainList(host, DIRECTORY_DOMAINS);
}
export function isFranchise(host: string): boolean {
  return matchesDomainList(host, FRANCHISE_DOMAINS);
}
export function isLeadMarketplace(host: string): boolean {
  return matchesDomainList(host, LEAD_MARKETPLACES);
}
export function isIntentMismatch(host: string): boolean {
  return matchesDomainList(host, INTENT_MISMATCH_DOMAINS);
}

export function isInnerPage(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const path = new URL(url).pathname.replace(/\/$/, '');
    return path.split('/').filter(Boolean).length >= 1;
  } catch {
    return false;
  }
}

/** Exact-match-domain heuristic: host contains a compacted "{service-ish}{city-ish}" token from the query. */
export function looksLikeEmd(host: string, query: string): boolean {
  const compactHost = host.replace(/\.(com|net|org|co|us|biz|info)$/i, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  const tokens = query.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter((t) => t.length > 3);
  let hits = 0;
  for (const t of tokens) if (compactHost.includes(t)) hits += 1;
  return hits >= 2;
}

export function classifyResult(item: SerpResultItem, query: string): Partial<SerpResultItem> {
  const host = item.domain ?? hostOf(item.url);
  return {
    isDirectory: isDirectory(host),
    isFranchise: isFranchise(host),
    isEmd: looksLikeEmd(host, query),
    isInnerPage: isInnerPage(item.url),
  };
}
