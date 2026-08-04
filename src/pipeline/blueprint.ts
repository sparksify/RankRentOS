// Stage 8 — Blueprint Lite. Deterministic generator: every number is computed
// from evidence + labeled assumptions. Exists to support approve/reject, not to build.
import type { BlueprintLite, DeepResearchEvidence, NicheAttrs } from '../core/types.js';
import { estimateValue, type LensInput } from '../lens/opportunity-v1.js';
import { BLUEPRINT_VERSION } from '../core/config.js';

const SERVICE_MAP: Record<string, string[]> = {
  'epoxy-garage-floors': ['Garage floor epoxy coating', 'Polyaspartic floor coating', 'Commercial epoxy flooring', 'Concrete floor resurfacing'],
  'artificial-turf': ['Artificial turf installation', 'Putting green installation', 'Pet turf', 'Commercial synthetic grass'],
  'landscape-lighting': ['Landscape lighting design & install', 'Outdoor security lighting', 'Holiday lighting pre-wire', 'Low-voltage LED retrofits'],
  'standby-generators': ['Whole-home standby generator install', 'Generac sales & service', 'Generator maintenance plans', 'Transfer switch installation'],
  'water-softeners': ['Water softener installation', 'Whole-home filtration', 'Reverse osmosis systems', 'Water testing'],
  'popcorn-ceiling-removal': ['Popcorn ceiling removal', 'Ceiling retexturing', 'Drywall repair', 'Interior painting prep'],
  'christmas-lights': ['Professional Christmas light installation', 'Commercial holiday lighting', 'Permanent trim lighting', 'Takedown & storage'],
  'fencing': ['Wood privacy fence installation', 'Iron & aluminum fencing', 'Fence repair', 'Automatic gates'],
  'spray-foam-insulation': ['Spray foam insulation', 'Attic insulation', 'Crawl space encapsulation', 'Energy audits'],
  'auto-glass': ['Windshield replacement', 'Mobile auto glass repair', 'ADAS recalibration', 'Rock chip repair'],
  'outdoor-kitchens': ['Custom outdoor kitchen design & build', 'Built-in grill islands', 'Patio covers & pergolas', 'Outdoor fireplaces'],
  'custom-closets': ['Custom closet systems', 'Walk-in closet design', 'Garage storage systems', 'Pantry & laundry organization'],
  'retaining-walls': ['Retaining wall construction', 'Segmental block walls', 'Drainage correction', 'Wall repair'],
  'french-drains': ['French drain installation', 'Yard drainage systems', 'Sump pump installation', 'Foundation drainage'],
  'ev-chargers': ['Home EV charger installation', 'Level 2 charger wiring', 'Commercial EV charging', 'Panel upgrades'],
  'gutter-installation': ['Seamless gutter installation', 'Gutter guards', 'Gutter repair', 'Downspout drainage'],
  'deck-building': ['Custom deck construction', 'Composite decking', 'Deck repair & refinishing', 'Covered patios'],
  'land-clearing': ['Land & lot clearing', 'Forestry mulching', 'Brush removal', 'Site prep'],
  'dumpster-rental': ['Residential dumpster rental', 'Construction dumpsters', 'Same-day delivery', 'Commercial roll-off service'],
  'air-duct-cleaning': ['Air duct cleaning', 'Dryer vent cleaning', 'HVAC sanitization', 'Allergen reduction'],
  'appliance-repair': ['Refrigerator repair', 'Washer & dryer repair', 'Oven & range repair', 'Dishwasher repair'],
  'mold-remediation': ['Mold inspection & testing', 'Mold remediation', 'Water damage drying', 'Air quality testing'],
  'stump-grinding': ['Stump grinding', 'Stump removal', 'Root pruning', 'Lot cleanup'],
  'sewer-line-repair': ['Sewer line repair', 'Trenchless sewer replacement', 'Camera inspections', 'Drain cleaning'],
};

export function generateBlueprint(
  input: LensInput,
  deep: DeepResearchEvidence | null,
  domains: { recommended: string | null; alternatives: string[]; checkedAt: string | null },
  score: { overall: number; confidence: number },
  keywords: { term: string; volume: number | null; cpc: number | null }[]
): BlueprintLite {
  const a: NicheAttrs = input.niche.attrs;
  const services = SERVICE_MAP[input.niche.slug] ?? [a.query];
  const cityLabel = `${input.city.name}, ${input.city.state}`;
  const { flatRent, commissionMonthly, dealType, estLeads } = estimateValue(input);

  const competitors = (deep?.competitors ?? []).filter((c) => c.kind !== 'directory');
  const weaknesses: string[] = [];
  if (deep?.serp) {
    const organic = deep.serp.results.filter((r) => r.resultType === 'organic').slice(0, 5);
    const dirs = organic.filter((r) => r.isDirectory).length;
    if (dirs >= 2) weaknesses.push(`${dirs} of the top organic results are directories, not local businesses`);
    const inner = organic.filter((r) => !r.isDirectory && r.isInnerPage).length;
    if (inner >= 2) weaknesses.push(`${inner} top results are inner/service-area pages — no one built a dedicated ${cityLabel} site`);
    const noCity = organic.slice(0, 3).filter((r) => !(r.title ?? '').toLowerCase().includes(input.city.name.toLowerCase())).length;
    if (noCity >= 2) weaknesses.push(`${noCity}/3 top titles don't mention ${input.city.name}`);
  }
  const thin = competitors.filter((c) => (c.signals.contentDepthWords ?? 9999) < 500);
  if (thin.length) weaknesses.push(`${thin.length} competitor page(s) under 500 words — out-buildable with real content`);
  if (!competitors.some((c) => c.signals.dedicatedLocalSite)) weaknesses.push('No dedicated single-city specialist site exists yet');

  const missing: string[] = [];
  if (!deep?.serp) missing.push('No SERP snapshot');
  else if (deep.serp.provider === 'web_search') missing.push('SERP evidence is web-search proxy — verify with localized Google SERP (SerpAPI/DataForSEO) before build');
  if (!deep?.serp?.results.some((r) => r.resultType === 'local_pack')) missing.push('Local pack composition unobserved (review counts / GBP strength unverified)');
  if ((deep?.operatorCandidates?.length ?? 0) < 3) missing.push('Operator bench under 3 verified candidates — needs outreach-grade research');
  if (input.city.population === null) missing.push('City demographics unverified against Census');

  const seasonalRisk = a.seasonal ? ['Seasonal demand — revenue concentrates in peak months'] : [];
  const risks = [
    ...seasonalRisk,
    ...(deep?.serp?.results.some((r) => r.isFranchise) ? ['Franchise brand present in SERP — brand searches strengthen their whole domain'] : []),
    ...(a.peRisk !== 'low' ? [`PE roll-up risk: ${a.peRisk}`] : []),
    ...(estLeads < 4 ? ['Thin measured lead flow — monetization depends on high ticket close rates'] : []),
  ];

  const nHoods = 4;
  const sitemap = [
    '/ (city + primary service)',
    ...services.slice(0, 4).map((s) => `/services/${slugify(s)}`),
    `/service-areas (${nHoods} neighborhood/nearby-city pages)`,
    '/gallery', '/reviews', '/contact', '/faq',
  ];

  return {
    marketKey: input.marketKey,
    niche: input.niche.slug,
    geography: cityLabel,
    recommendedDomain: domains.recommended,
    altDomains: domains.alternatives,
    domainCheckedAt: domains.checkedAt,
    primaryServices: services,
    primaryKeywords: keywords,
    sitemap,
    contentPlan: [
      `Homepage: 1,200+ words targeting "${a.query} ${input.city.name}"`,
      ...services.slice(0, 4).map((s) => `Service page: ${s} (800+ words, FAQ block, schema)`),
      `${nHoods} neighborhood pages for ${input.city.name} areas`,
      '10-12 supporting articles from playbook long-tail patterns',
    ],
    primaryCompetitors: competitors.slice(0, 5).map((c) => `${c.name} (${c.domain}${c.position ? `, pos ${c.position}` : ''})`),
    whyBeatable: weaknesses,
    authorityAssumptions: {
      startingAuthority: 'DR0 fresh domain',
      requirement: thin.length >= 2 ? 'low — citations + foundational links' : 'moderate — citations + local links + content depth',
      citations: 80,
    },
    operatorSummary: (deep?.operatorCandidates?.length ?? 0) > 0
      ? `${deep!.operatorCandidates.length} candidate(s): ${deep!.operatorCandidates.slice(0, 3).map((o) => o.name).join(', ')}`
      : 'No operator candidates identified yet — run operator research before build',
    estCost: [400, 900],
    estRankMonths: thin.length >= 2 ? [2, 4] : [3, 6],
    estLeadsMo: [Math.max(1, Math.round(estLeads * 0.5)), Math.round(estLeads * 1.5)],
    estRevenueMo: dealType === 'commission'
      ? [Math.round(commissionMonthly * 0.4), commissionMonthly]
      : [Math.round(flatRent * 0.6), flatRent],
    assumptions: [
      'CTR 25% at positions 1-3; contact rate 12%; close rate 10% (v0 value model, uncalibrated)',
      `Deal type: ${dealType}${dealType === 'commission' ? ' (10% of gross per closed job)' : ' (flat monthly rent)'}`,
      'Revenue discounted ~50% from formula value per guru-math rule until portfolio calibration',
      `Keyword volumes observed ${input.keyword.observedAt?.slice(0, 10) ?? 'unknown'} via DataForSEO`,
    ],
    risks,
    missingEvidence: missing,
    confidence: score.confidence,
    nextAction: score.overall >= 80 && score.confidence >= 0.65
      ? 'Approve for Batch 1 — register domain and start build'
      : score.overall >= 70
        ? 'Verify missing evidence (localized SERP + operator bench), then approve'
        : 'Hold — watchlist',
  };
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export { BLUEPRINT_VERSION };
