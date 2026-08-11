/**
 * Curated domain lists — V0's distilled practitioner knowledge, ported
 * verbatim from legacy src/score.js (provenance: Luke/Kyle SOPs +
 * Whitespark local-organic factors). Extend deliberately; never repurpose.
 */

/** Brand-search franchises: their brand searches boost everything they rank for. */
export const FRANCHISE_DOMAINS: readonly string[] = [
  "garageexperts.com", "safelite.com", "leaffilter.com", "leafguard.com",
  "trugreen.com", "servpro.com", "servicemaster.com", "stanleysteemer.com",
  "1800gotjunk.com", "collegehunkshaulingjunk.com", "mrhandyman.com",
  "mrrooter.com", "aireserv.com", "mollymaid.com", "closetsbydesign.com",
  "californiaclosets.com", "systempavers.com", "rotorooter.com", "gutterlogic.com",
  "puroclean.com", "servicemasterrestore.com", "cutco.com", "neighborly.com",
];

/** Lead marketplaces anywhere in the SERP = proof businesses BUY leads here. */
export const LEAD_MARKETPLACES: readonly string[] = [
  "angi.com", "angieslist.com", "homeadvisor.com", "thumbtack.com",
  "networx.com", "modernize.com",
];

/** E-commerce / info sites ranking for service intent = exploitable mismatch. */
export const INTENT_MISMATCH_DOMAINS: readonly string[] = [
  "lowes.com", "homedepot.com", "amazon.com", "walmart.com", "wayfair.com",
  "wikihow.com", "forbes.com", "bobvila.com", "thisoldhouse.com", "familyhandyman.com",
  "costco.com", "menards.com", "acehardware.com", "etsy.com",
];

export const DIRECTORY_DOMAINS: readonly string[] = [
  "yelp.com", "angi.com", "angieslist.com", "thumbtack.com", "homeadvisor.com",
  "houzz.com", "porch.com", "bbb.org", "yellowpages.com", "facebook.com",
  "nextdoor.com", "reddit.com", "expertise.com", "bark.com", "care.com",
  "taskrabbit.com", "homedepot.com", "lowes.com", "safelite.com", "instagram.com",
  "mapquest.com", "manta.com", "birdeye.com", "threebestrated.com", "yellowbook.com",
];

export function hostOf(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function hostMatches(url: string | undefined, list: readonly string[]): boolean {
  const h = hostOf(url);
  if (!h) return false;
  return list.some((d) => h === d || h.endsWith(`.${d}`));
}
