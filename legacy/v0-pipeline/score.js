// Scoring rules distilled from the Luke (Corner Office) and Kyle (AI Rabbit Holes)
// playbooks + Whitespark 2026 local organic factors. Organic winnability is primary;
// map-pack weakness is bonus only (Kyle's organic-first model).

// Brand-search franchises: their direct brand searches boost everything they
// rank for — "if the top 3 are brands people search BY NAME, leave" (SOP v2 §2.4)
const FRANCHISE_DOMAINS = [
  "garageexperts.com", "safelite.com", "leaffilter.com", "leafguard.com",
  "trugreen.com", "servpro.com", "servicemaster.com", "stanleysteemer.com",
  "1800gotjunk.com", "collegehunkshaulingjunk.com", "mrhandyman.com",
  "mrrooter.com", "aireserv.com", "mollymaid.com", "closetsbydesign.com",
  "californiaclosets.com", "systempavers.com", "rotorooter.com", "gutterlogic.com",
  "puroclean.com", "servicemasterrestore.com", "cutco.com", "neighborly.com",
];

// Lead marketplaces anywhere in the SERP = proof businesses BUY leads here (SOP v2 §1.5)
const LEAD_MARKETPLACES = ["angi.com", "angieslist.com", "homeadvisor.com", "thumbtack.com", "networx.com", "modernize.com"];

// E-commerce / info sites ranking for service intent = exploitable mismatch (SOP §2.3)
const INTENT_MISMATCH_DOMAINS = [
  "lowes.com", "homedepot.com", "amazon.com", "walmart.com", "wayfair.com",
  "wikihow.com", "forbes.com", "bobvila.com", "thisoldhouse.com", "familyhandyman.com",
  "costco.com", "menards.com", "acehardware.com", "etsy.com",
];

const DIRECTORY_DOMAINS = [
  "yelp.com", "angi.com", "angieslist.com", "thumbtack.com", "homeadvisor.com",
  "houzz.com", "porch.com", "bbb.org", "yellowpages.com", "facebook.com",
  "nextdoor.com", "reddit.com", "expertise.com", "bark.com", "care.com",
  "taskrabbit.com", "homedepot.com", "lowes.com", "safelite.com", "instagram.com",
  "mapquest.com", "manta.com", "birdeye.com", "threebestrated.com", "yellowbook.com",
];

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

function isDirectory(url) {
  const h = hostOf(url);
  return DIRECTORY_DOMAINS.some((d) => h === d || h.endsWith(`.${d}`));
}

function isInnerPage(url) {
  try {
    const path = new URL(url).pathname.replace(/\/$/, "");
    return path.split("/").filter(Boolean).length >= 1;
  } catch { return false; }
}

export function scorePair(serp, niche, city, extras = {}) {
  const signals = {};
  let score = 0;

  const top3 = serp.organic.slice(0, 3);
  const top5 = serp.organic.slice(0, 5);

  // 1. Directory / national brand in top 3 organic — Kyle's headline green light (max 30)
  const dirCount = top3.filter((r) => isDirectory(r.link)).length;
  signals.directoriesInTop3 = dirCount;
  score += Math.min(dirCount * 15, 30);

  // 1b. Intent mismatch — e-commerce/info pages ranking for service intent (max 12)
  const mismatchCount = top5.filter((r) => {
    const h = hostOf(r.link);
    return INTENT_MISMATCH_DOMAINS.some((d) => h === d || h.endsWith(`.${d}`));
  }).length;
  signals.intentMismatchInTop5 = mismatchCount;
  score += Math.min(mismatchCount * 6, 12);

  // 1c. Out-of-town competitors — top-3 local-business results anchored to a
  // different city (e.g. a Houston firm's service-area page ranking in Celina).
  // Google shows them because no local specialist exists (max 8)
  const cityL = city.city.toLowerCase();
  const outOfTown = top3.filter((r) => {
    if (isDirectory(r.link)) return false;
    const text = `${r.title || ""} ${r.link || ""}`.toLowerCase();
    const mentionsTarget = text.includes(cityL);
    const isServiceAreaPage = /service-area|locations|areas-we-serve|cities/.test(r.link || "");
    return isServiceAreaPage || (!mentionsTarget && isInnerPage(r.link));
  }).length;
  signals.outOfTownInTop3 = outOfTown;
  score += Math.min(outOfTown * 4, 8);

  // 1d. Franchise brands in top 3 — brand searches boost their whole domain; walk (−8 each, max −16)
  const franchiseCount = top3.filter((r) => {
    const h = hostOf(r.link);
    return FRANCHISE_DOMAINS.some((d) => h === d || h.endsWith(`.${d}`));
  }).length;
  signals.franchisesInTop3 = franchiseCount;
  score -= Math.min(franchiseCount * 8, 16);

  // 1e. Buyer proof — lead marketplaces anywhere in top 10, or ads: businesses
  // here already PAY for leads, so a renter exists (max 8)
  const marketplacePresent = serp.organic.some((r) => {
    const h = hostOf(r.link);
    return LEAD_MARKETPLACES.some((d) => h === d || h.endsWith(`.${d}`));
  });
  signals.buyerProof = marketplacePresent || serp.ads.length > 0;
  if (signals.buyerProof) score += 8;

  // 2. Inner pages in top 5 — nobody built a dedicated site for this query (max 20)
  const innerCount = top5.filter((r) => !isDirectory(r.link) && isInnerPage(r.link)).length;
  signals.innerPagesInTop5 = innerCount;
  score += Math.min(innerCount * 5, 20);

  // 3. Map pack composition — SOP §2.2.5: absence is a DEMAND red flag, not an
  // opportunity. Sweet spot = pack exists with weak (<30-40 review) listings.
  const places = serp.localResults;
  signals.mapPackSize = places.length;
  if (places.length === 0) {
    signals.mapPack = "absent";
    // Penalize unless autocomplete independently proves demand exists
    score += extras?.autocomplete?.cityHit ? 0 : -10;
  } else {
    const avgReviews = places.reduce((s, p) => s + (p.reviews || 0), 0) / places.length;
    const noSite = places.filter((p) => !p.website).length;
    signals.avgMapReviews = Math.round(avgReviews);
    signals.mapListingsWithoutWebsite = noSite;
    if (avgReviews < 40) score += 15;       // the jackpot condition
    else if (avgReviews < 100) score += 6;  // contestable
    if (noSite >= 1) score += 4;
  }

  // 4. Ads block = proof local operators pay for leads (renter demand) (max 10)
  signals.adCount = serp.ads.length;
  signals.advertisers = serp.ads.map((a) => a.displayed_link || hostOf(a.link)).filter(Boolean);
  if (serp.ads.length >= 1 && serp.ads.length <= 3) score += 10; // demand without a war
  else if (serp.ads.length > 3) score += 4; // demand, but crowded auction

  // 5. Weak titles: top-3 organic titles missing the city name → poor local targeting (max 10)
  const cityLower = city.city.toLowerCase();
  const untargeted = top3.filter((r) => !(r.title || "").toLowerCase().includes(cityLower)).length;
  signals.top3TitlesMissingCity = untargeted;
  score += Math.min(untargeted * 4, 10);

  // 6. Competitor content depth — Kyle's word-count sizing, automated (max 15)
  if (extras?.contentDepth?.avgWords !== null && extras?.contentDepth?.avgWords !== undefined) {
    const w = extras.contentDepth.avgWords;
    signals.competitorAvgWords = w;
    if (w < 250) score += 15;      // "three bullet points" — no chance against a real site
    else if (w < 500) score += 10; // thin
    else if (w < 900) score += 5;  // modest
  }

  // 6b. Young competition — all top-3 domains under ~4 years old = beatable (max 6)
  if (extras?.compAges?.length) {
    const avgAge = extras.compAges.reduce((a, b) => a + b, 0) / extras.compAges.length;
    signals.competitorAvgDomainAge = Math.round(avgAge * 10) / 10;
    if (avgAge < 4) score += 6;
    else if (avgAge < 8) score += 3;
  }

  // 7. City fit multiplier — income/growth match for the niche archetype
  let fit = 1.0;
  if (niche.archetype === "affluent-suburb") {
    if (city.income >= 120000) fit = 1.15;
    else if (city.income >= 100000) fit = 1.05;
    else if (city.income < 80000) fit = 0.8;
  }
  if (city.growth === "high") fit += 0.05;
  signals.cityFit = fit;

  // 8. Demand multipliers — winnability x demand, not winnability + demand.
  // An empty-because-no-demand market must die; empty-because-no-competition must survive.
  let demand = 1.0;
  if (extras?.autocomplete) {
    signals.demandFloor = extras.autocomplete.floor;
    signals.autocompleteCityHit = extras.autocomplete.cityHit;
    demand *= extras.autocomplete.floor;
  }
  if (extras?.trendWeight) {
    signals.trendWeight = extras.trendWeight;
    demand *= extras.trendWeight;
  }
  signals.demandMultiplier = Math.round(demand * 100) / 100;

  const finalScore = Math.round(Math.min(score * fit * demand, 100));
  return { score: finalScore, rawScore: score, signals };
}
