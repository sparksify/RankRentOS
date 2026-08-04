// Rank & Rent Opportunity Lens v1 — versioned pure function: facts → score + confidence + reasons.
// Subscores (sum 100): demand 20 · competition 25 · monetization 15 · domain 10 ·
// operator bench 10 · geo economics 10 · buildability 10.
// Confidence is computed separately and NEVER folded into the score.
import type {
  DeepResearchEvidence, LensScore, NicheAttrs, SerpSnapshot, Subscores,
} from '../core/types.js';
import { LENS_VERSION, WEIGHTS_VERSION } from '../core/config.js';
import { inputHash } from '../core/hash.js';
import { isLeadMarketplace, isIntentMismatch } from '../pipeline/serp-signals.js';

export interface LensInput {
  marketKey: string;
  niche: { slug: string; attrs: NicheAttrs };
  city: { name: string; state: string; population: number | null; householdIncome: number | null; growth: string | null };
  keyword: { term: string; volume: number | null; cpc: number | null; observedAt: string | null };
  trendWeight: number | null;
  deep: DeepResearchEvidence | null; // null = scored on cheap evidence only (low confidence)
  domainAvailability: { available: number; bestDomain: string | null; checkedAt: string | null; registrarVerified: boolean };
  nicheRepeatCount: number; // how many other markets share this niche in the candidate pool (repeatability)
}

interface SubscoreDetail { points: number; max: number; reasons: string[]; observed: boolean }

export function runOpportunityLens(input: LensInput): LensScore & { detail: Record<keyof Subscores, SubscoreDetail> } {
  const a = input.niche.attrs;
  const serp = input.deep?.serp ?? null;

  const demand = scoreDemand(input);
  const competition = scoreCompetition(input, serp);
  const monetization = scoreMonetization(input);
  const domain = scoreDomain(input);
  const operatorBench = scoreOperatorBench(input);
  const geoEconomics = scoreGeoEconomics(input);
  const buildability = scoreBuildability(input);

  const detail = { demand, competition, monetization, domain, operatorBench, geoEconomics, buildability };
  const subscores: Subscores = Object.fromEntries(
    Object.entries(detail).map(([k, v]) => [k, Math.round(v.points * 10) / 10])
  ) as unknown as Subscores;

  const overall = Math.round(Object.values(detail).reduce((s, d) => s + d.points, 0) * 10) / 10;
  const confidence = computeConfidence(input);
  const reasons = Object.entries(detail).flatMap(([k, d]) => d.reasons.map((r) => `[${k}] ${r}`));

  return {
    lens: 'rank-rent-opportunity',
    lensVersion: LENS_VERSION,
    weightsVersion: WEIGHTS_VERSION,
    overall,
    subscores,
    confidence,
    reasons,
    inputHash: inputHash({ marketKey: input.marketKey, niche: input.niche.slug, kw: input.keyword, deepAt: input.deep?.collectedAt ?? null }),
    computedAt: new Date().toISOString(),
    detail,
  };
}

// ---------- Demand /20 ----------
function scoreDemand(input: LensInput): SubscoreDetail {
  const r: string[] = [];
  let pts = 0;
  const vol = input.keyword.volume;
  if (vol === null) {
    r.push('No measured volume — demand unproven');
    return { points: 0, max: 20, reasons: r, observed: false };
  }
  if (vol >= 300) { pts += 12; r.push(`${vol}/mo measured searches — strong rent-model demand`); }
  else if (vol >= 100) { pts += 9; r.push(`${vol}/mo measured searches`); }
  else if (vol >= 30) { pts += 6; r.push(`${vol}/mo — modest demand (hyper-local under-reporting likely)`); }
  else if (vol >= 10) { pts += 3.5; r.push(`${vol}/mo — thin, viable only with high tickets`); }
  else { pts += 1; r.push(`${vol}/mo — near-zero measured demand`); }

  const cpc = input.keyword.cpc;
  if (cpc !== null && cpc >= 2) { pts += 4; r.push(`CPC $${cpc.toFixed(2)} proves buyers pay for these clicks`); }
  else if (cpc !== null && cpc > 0) { pts += 2; r.push(`CPC $${cpc.toFixed(2)} — some commercial intent`); }
  else r.push('No CPC data — commercial intent unverified');

  if (input.trendWeight !== null && input.trendWeight >= 1.0) { pts += 2; r.push('Niche trend at/above national average'); }
  else if (input.trendWeight !== null) { pts += 1; }

  if (input.city.growth === 'high') { pts += 2; r.push('High-growth city — demand compounding'); }
  return { points: Math.min(pts, 20), max: 20, reasons: r, observed: true };
}

// ---------- Competition & authority gap /25 ----------
function scoreCompetition(input: LensInput, serp: SerpSnapshot | null): SubscoreDetail {
  const r: string[] = [];
  if (!serp) {
    return { points: 0, max: 25, reasons: ['No SERP evidence — competition unknown'], observed: false };
  }
  let pts = 0;
  const organic = serp.results.filter((x) => x.resultType === 'organic');
  const top3 = organic.slice(0, 3);
  const top5 = organic.slice(0, 5);

  const dirs = top3.filter((x) => x.isDirectory).length;
  if (dirs >= 2) { pts += 8; r.push(`${dirs} directories in top 3 — no strong local site owns this SERP`); }
  else if (dirs === 1) { pts += 5; r.push('1 directory in top 3'); }

  const inner = top5.filter((x) => !x.isDirectory && x.isInnerPage).length;
  if (inner >= 3) { pts += 6; r.push(`${inner}/5 top results are inner pages — no dedicated local site built for this query`); }
  else if (inner >= 1) { pts += 3; r.push(`${inner}/5 top results are inner pages`); }

  const franchises = top3.filter((x) => x.isFranchise).length;
  if (franchises >= 2) { pts -= 6; r.push(`${franchises} brand-search franchises in top 3 — hard to displace (SOP: walk)`); }
  else if (franchises === 1) { pts -= 3; r.push('1 franchise brand in top 3'); }

  const mismatch = top5.filter((x) => isIntentMismatch(x.domain ?? '')).length;
  if (mismatch >= 1) { pts += 3; r.push(`${mismatch} e-commerce/info results ranking for service intent — exploitable mismatch`); }

  const emds = top5.filter((x) => x.isEmd && !x.isDirectory).length;
  if (emds >= 1) { pts -= 2; r.push(`${emds} exact-match local site(s) already ranking — someone ran this play here`); }
  else { pts += 2; r.push('No dedicated exact-match local site in top 5 — the play is unclaimed'); }

  const cityL = input.city.name.toLowerCase();
  const untargeted = top3.filter((x) => !(x.title ?? '').toLowerCase().includes(cityL)).length;
  if (untargeted >= 2) { pts += 3; r.push(`${untargeted}/3 top titles missing "${input.city.name}" — poor local targeting`); }
  else if (untargeted === 1) { pts += 1.5; }

  // Competitor content depth from deep evidence
  const depths = (input.deep?.competitors ?? [])
    .map((c) => c.signals.contentDepthWords)
    .filter((w): w is number => typeof w === 'number');
  if (depths.length) {
    const avg = depths.reduce((s, w) => s + w, 0) / depths.length;
    if (avg < 400) { pts += 5; r.push(`Competitor pages average ${Math.round(avg)} words — thin content, beatable`); }
    else if (avg < 900) { pts += 3; r.push(`Competitor pages average ${Math.round(avg)} words — modest depth`); }
    else { r.push(`Competitor pages average ${Math.round(avg)} words — real content to out-build`); }
  }

  const dedicated = (input.deep?.competitors ?? []).filter((c) => c.kind === 'local_business' && c.signals.dedicatedLocalSite).length;
  if (dedicated === 0) { pts += 3; r.push('No dedicated single-city specialist site found among competitors'); }
  else if (dedicated >= 2) { pts -= 2; r.push(`${dedicated} dedicated local specialists already competing`); }

  return { points: Math.max(0, Math.min(pts, 25)), max: 25, reasons: r, observed: true };
}

// ---------- Monetization /15 ----------
function scoreMonetization(input: LensInput): SubscoreDetail {
  const r: string[] = [];
  let pts = 0;
  const a = input.niche.attrs;
  const avgTicket = (a.ticketLow + a.ticketHigh) / 2;
  const { flatRent, commissionMonthly, dealType, estLeads } = estimateValue(input);

  if (dealType === 'commission') {
    pts += 7;
    r.push(`Commission-grade: ~$${commissionMonthly.toLocaleString()}/mo potential at 10% of gross (avg ticket $${avgTicket.toLocaleString()})`);
  } else if (flatRent >= 1000) {
    pts += 6; r.push(`Flat rent ~$${flatRent.toLocaleString()}/mo clears comfortably`);
  } else if (flatRent >= 500) {
    pts += 4.5; r.push(`Flat rent ~$${flatRent.toLocaleString()}/mo`);
  } else {
    pts += 2.5; r.push(`Rent floor ~$${flatRent}/mo — modest`);
  }

  if (estLeads >= 10) { pts += 4; r.push(`~${Math.round(estLeads)} projected leads/mo from measured volume`); }
  else if (estLeads >= 4) { pts += 2.5; r.push(`~${Math.round(estLeads)} projected leads/mo`); }
  else { pts += 1; r.push(`~${estLeads.toFixed(1)} projected leads/mo — thin flow, ticket must carry it`); }

  const serpAds = input.deep?.serp?.results.filter((x) => x.resultType === 'ad') ?? [];
  const marketplace = input.deep?.serp?.results.some((x) => isLeadMarketplace(x.domain ?? '')) ?? false;
  if (serpAds.length >= 1 || marketplace) { pts += 3; r.push('Buyer proof: businesses already pay for leads here (ads/lead marketplaces present)'); }

  if (a.margin >= 0.45) { pts += 1; r.push(`Healthy margin (${a.margin})`); }
  return { points: Math.min(pts, 15), max: 15, reasons: r, observed: input.keyword.volume !== null };
}

// ---------- Domain quality /10 ----------
function scoreDomain(input: LensInput): SubscoreDetail {
  const r: string[] = [];
  let pts = 0;
  const d = input.domainAvailability;
  if (d.checkedAt === null) {
    return { points: 0, max: 10, reasons: ['Domain availability not verified'], observed: false };
  }
  if (d.bestDomain && d.available > 0) {
    pts += 6; r.push(`"${d.bestDomain}" available (verified ${d.registrarVerified ? 'registrar' : 'registry'}-grade ${d.checkedAt.slice(0, 10)})`);
    if (d.available >= 3) { pts += 2; r.push(`${d.available} viable domains open — naming optionality`); }
    else { pts += 1; }
    const compact = input.city.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (d.bestDomain.startsWith(compact)) { pts += 2; r.push('City-first exact-match — the geography+service formula'); }
  } else {
    r.push('No exact/partial-match domain currently available — brandable fallback required');
    pts += 1;
  }
  return { points: Math.min(pts, 10), max: 10, reasons: r, observed: true };
}

// ---------- Operator bench /10 ----------
function scoreOperatorBench(input: LensInput): SubscoreDetail {
  const r: string[] = [];
  const ops = input.deep?.operatorCandidates ?? [];
  if (!input.deep) return { points: 0, max: 10, reasons: ['No operator research yet'], observed: false };
  let pts = 0;
  if (ops.length >= 5) { pts = 9; r.push(`${ops.length} plausible operator candidates identified`); }
  else if (ops.length >= 3) { pts = 7; r.push(`${ops.length} operator candidates identified`); }
  else if (ops.length >= 1) { pts = 4.5; r.push(`Only ${ops.length} operator candidate(s) found — bench is thin`); }
  else { pts = 1; r.push('No operator candidates identified yet — rental demand unproven'); }
  return { points: pts, max: 10, reasons: r, observed: true };
}

// ---------- Geographic economics /10 ----------
function scoreGeoEconomics(input: LensInput): SubscoreDetail {
  const r: string[] = [];
  let pts = 0;
  const { population, householdIncome, growth } = input.city;
  const a = input.niche.attrs;
  if (population !== null) {
    if (population >= 40000 && population <= 250000) { pts += 4; r.push(`Population ${population.toLocaleString()} — big enough to feed leads, small enough to win`); }
    else if (population >= 15000) { pts += 2.5; r.push(`Population ${population.toLocaleString()}`); }
  } else r.push('Population unverified');
  if (householdIncome !== null) {
    if (a.archetype === 'affluent-suburb' && householdIncome >= 120000) { pts += 4; r.push(`Median income $${householdIncome.toLocaleString()} — ideal for ${input.niche.slug}`); }
    else if (householdIncome >= 90000) { pts += 3; r.push(`Median income $${householdIncome.toLocaleString()}`); }
    else { pts += 1; }
  } else r.push('Income unverified');
  if (growth === 'high') { pts += 2; r.push('High growth — new construction feeds this niche'); }
  return { points: Math.min(pts, 10), max: 10, reasons: r, observed: population !== null };
}

// ---------- Buildability & repeatability /10 ----------
function scoreBuildability(input: LensInput): SubscoreDetail {
  const r: string[] = [];
  let pts = 0;
  const a = input.niche.attrs;
  if (!a.seasonal) { pts += 2; r.push('Non-seasonal — year-round lead flow'); }
  else r.push('Seasonal niche — revenue concentrates in peak months');
  if (a.peRisk === 'low') { pts += 2; r.push('Low PE-rollup risk'); }
  else if (a.peRisk === 'medium') pts += 1;
  if (!a.need) { pts += 1; r.push('Desire purchase — affluent buyers, less price war'); }
  else { pts += 1.5; r.push('Need purchase — urgency converts'); }
  if (input.nicheRepeatCount >= 3) { pts += 3; r.push(`Niche repeats across ${input.nicheRepeatCount} candidate markets — one playbook, many cities`); }
  else if (input.nicheRepeatCount >= 1) { pts += 1.5; r.push('Some niche repeatability in pool'); }
  pts += 1.5; // single-service local site is inherently buildable with current stack
  return { points: Math.min(pts, 10), max: 10, reasons: r, observed: true };
}

// ---------- Confidence (separate from score) ----------
export function computeConfidence(input: LensInput): number {
  let c = 0;
  // Measured demand (+ freshness within the 90-day keyword policy)
  if (input.keyword.volume !== null) {
    c += 0.2;
    if (input.keyword.observedAt) {
      const age = (Date.now() - new Date(input.keyword.observedAt).getTime()) / 86_400_000;
      if (age <= 90) c += 0.05;
    }
  }
  // SERP evidence quality: localized Google SERP is worth nearly twice a
  // web-search proxy — competition carries 25 lens points and proxy results
  // lack geo-personalization, local pack, and ads blocks.
  const serpProvider = input.deep?.serp?.provider;
  if (serpProvider === 'serpapi' || serpProvider === 'dataforseo_serp') c += 0.25;
  else if (serpProvider) c += 0.13;
  // Local pack observed at all (review counts / GBP strength)
  if (input.deep?.serp?.results.some((r) => r.resultType === 'local_pack')) c += 0.07;
  if ((input.deep?.competitors?.length ?? 0) >= 3) c += 0.1;
  // Domain availability: registrar-grade beats registry-grade
  if (input.domainAvailability.checkedAt) c += input.domainAvailability.registrarVerified ? 0.15 : 0.12;
  const ops = input.deep?.operatorCandidates?.length ?? 0;
  if (ops >= 3) c += 0.1;
  else if (ops >= 1) c += 0.08;
  if (input.city.population !== null) c += 0.05;

  return Number(Math.min(0.98, c).toFixed(3));
}

/** Monetization model ported from v0 value.js — measured volume drives leads; ticket drives deal type. */
export function estimateValue(input: LensInput): { flatRent: number; commissionMonthly: number; dealType: 'flat' | 'commission'; estLeads: number } {
  const a = input.niche.attrs;
  const avgTicket = (a.ticketLow + a.ticketHigh) / 2;
  const vol = input.keyword.volume ?? 0;
  let leads = vol > 0 ? vol * 0.25 * 0.12 : 1; // 25% CTR at #1-3, 12% contact rate
  leads = Math.max(leads, 0.5);
  const closedJobs = leads * 0.10;
  const flatRent = Math.min(Math.max(Math.round((closedJobs * avgTicket * a.margin * 0.5) / 50) * 50, 300), 2000);
  const commissionMonthly = Math.round((closedJobs * avgTicket * 0.10) / 50) * 50;
  return {
    flatRent,
    commissionMonthly,
    dealType: commissionMonthly > flatRent ? 'commission' : 'flat',
    estLeads: leads,
  };
}
