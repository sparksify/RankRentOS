// Stage 3 — low-cost qualification. Pure function over cheap evidence:
// city economics + niche economics + measured keyword volume/CPC.
// Every market gets a result WITH reasons; rejected markets are never hidden.
import type { NicheAttrs, Qualification, QualificationReason } from '../core/types.js';
import { QUALIFICATION_GATES as G, QUALIFICATION_VERSION } from '../core/config.js';
import { inputHash } from '../core/hash.js';

export interface QualifyInput {
  marketKey: string;
  niche: { slug: string; attrs: NicheAttrs };
  city: { name: string; state: string; population: number | null; householdIncome: number | null; growth: string | null };
  keyword: { term: string; volume: number | null; cpc: number | null; competition: number | null; observedAt: string | null };
  trendWeight: number | null; // niche-relative demand weight (0.7–1.15) from trends
}

export function qualifyMarket(input: QualifyInput): Qualification {
  const reasons: QualificationReason[] = [];
  let failed = false;
  let needsResearch = false;
  let score = 0; // preliminary 0-100 built from cheap evidence

  const { niche, city, keyword, trendWeight } = input;
  const a = niche.attrs;

  // --- Gate: playbook verdict (avoid-niches die here) ---
  // (verdict lives on the playbook; callers pre-filter avoid niches, gate kept for safety)

  // --- Gate: population ---
  if (city.population === null) {
    reasons.push({ gate: 'population', outcome: 'warn', detail: 'Population unknown — needs verification' });
    needsResearch = true;
  } else if (city.population < G.minPopulation) {
    reasons.push({ gate: 'population', outcome: 'fail', detail: `Population ${city.population.toLocaleString()} below ${G.minPopulation.toLocaleString()} floor` });
    failed = true;
  } else {
    reasons.push({ gate: 'population', outcome: 'pass', detail: `Population ${city.population.toLocaleString()}` });
    score += 10;
  }

  // --- Gate: household income (only binding for affluent-suburb niches) ---
  if (a.archetype === 'affluent-suburb') {
    if (city.householdIncome === null) {
      reasons.push({ gate: 'income', outcome: 'warn', detail: 'Income unknown for affluence-sensitive niche' });
      needsResearch = true;
    } else if (city.householdIncome < G.minIncomeAffluent) {
      reasons.push({ gate: 'income', outcome: 'fail', detail: `Median income $${city.householdIncome.toLocaleString()} below $${G.minIncomeAffluent.toLocaleString()} for ${niche.slug}` });
      failed = true;
    } else {
      const bonus = city.householdIncome >= 120000 ? 15 : 10;
      reasons.push({ gate: 'income', outcome: 'pass', detail: `Median income $${city.householdIncome.toLocaleString()}` });
      score += bonus;
    }
  } else if (city.householdIncome !== null) {
    reasons.push({ gate: 'income', outcome: 'info', detail: `Median income $${city.householdIncome.toLocaleString()} (niche not affluence-gated)` });
    score += 5;
  }

  // --- Gate: search demand (measured volume; SOP §1.6 — zero volume is the #1 rookie failure) ---
  const vol = keyword.volume;
  if (vol === null) {
    reasons.push({ gate: 'demand', outcome: 'warn', detail: `No volume observation for "${keyword.term}"` });
    needsResearch = true;
  } else if (vol >= G.minVolumeStrong) {
    reasons.push({ gate: 'demand', outcome: 'pass', detail: `${vol}/mo measured searches for "${keyword.term}"` });
    score += 30;
  } else if (vol >= 30) {
    reasons.push({ gate: 'demand', outcome: 'pass', detail: `${vol}/mo — modest but real (hyper-local under-reporting likely)` });
    score += 20;
  } else if (vol >= G.minVolumeWeak) {
    // High-ticket niches survive low volume: one $25k inquiry/mo is a fine market (SOP)
    if (a.ticketHigh >= 15000) {
      reasons.push({ gate: 'demand', outcome: 'pass', detail: `${vol}/mo but high-ticket ($${a.ticketLow / 1000}k-$${a.ticketHigh / 1000}k) — commission-grade economics` });
      score += 14;
    } else {
      reasons.push({ gate: 'demand', outcome: 'warn', detail: `${vol}/mo — thin demand for a rent-model niche` });
      score += 6;
      needsResearch = true;
    }
  } else {
    if (a.ticketHigh >= 15000 && vol > 0) {
      reasons.push({ gate: 'demand', outcome: 'warn', detail: `${vol}/mo — very thin; only viable as commission play` });
      score += 4;
      needsResearch = true;
    } else {
      reasons.push({ gate: 'demand', outcome: 'fail', detail: `${vol}/mo measured — below viability floor` });
      failed = true;
    }
  }

  // --- Gate: commercial intent (CPC band, SOP v2 §2.3) ---
  const cpc = keyword.cpc;
  if (cpc === null || cpc === 0) {
    reasons.push({ gate: 'cpc', outcome: 'warn', detail: 'No CPC — advertisers not measurably buying these clicks' });
  } else if (cpc >= G.cpcHealthyLow && cpc <= G.cpcHealthyHigh) {
    reasons.push({ gate: 'cpc', outcome: 'pass', detail: `CPC $${cpc.toFixed(2)} — healthy commercial intent` });
    score += 15;
  } else if (cpc > G.cpcWarHigh) {
    reasons.push({ gate: 'cpc', outcome: 'warn', detail: `CPC $${cpc.toFixed(2)} — ad-war pricing; organic prize is large but competition capital is real` });
    score += 8;
  } else {
    reasons.push({ gate: 'cpc', outcome: 'info', detail: `CPC $${cpc.toFixed(2)}` });
    score += 5;
  }

  // --- Gate: niche economics ---
  const avgTicket = (a.ticketLow + a.ticketHigh) / 2;
  const leadValue = avgTicket * a.margin * 0.1; // value of one closed job at 10% close
  if (leadValue >= 300) {
    reasons.push({ gate: 'economics', outcome: 'pass', detail: `Avg ticket $${avgTicket.toLocaleString()}, margin ${a.margin} — strong lead economics` });
    score += 15;
  } else if (leadValue >= 100) {
    reasons.push({ gate: 'economics', outcome: 'pass', detail: `Avg ticket $${avgTicket.toLocaleString()} — workable flat-rent economics` });
    score += 8;
  } else {
    reasons.push({ gate: 'economics', outcome: 'warn', detail: `Low ticket ($${avgTicket.toLocaleString()}) — rent ceiling is low` });
    score += 3;
  }

  // --- Growth bonus ---
  if (city.growth === 'high') {
    reasons.push({ gate: 'growth', outcome: 'pass', detail: 'High-growth city — demand compounding' });
    score += 8;
  } else if (city.growth === 'medium') {
    score += 4;
  }

  // --- Trend weight ---
  if (trendWeight !== null) {
    score = Math.round(score * trendWeight);
    reasons.push({ gate: 'trend', outcome: 'info', detail: `Niche demand weight ${trendWeight}` });
  }

  // Confidence in this qualification: how much of it was measured vs missing.
  const warns = reasons.filter((r) => r.outcome === 'warn').length;
  const confidence = Math.max(0.2, Math.min(0.9, 0.9 - warns * 0.15));

  const result = failed ? 'failed' : needsResearch ? 'needs_research' : 'passed';
  return {
    marketKey: input.marketKey,
    version: QUALIFICATION_VERSION,
    result,
    reasons,
    confidence: Number(confidence.toFixed(3)),
    inputHash: inputHash(input),
    preliminaryScore: Math.max(0, Math.min(100, score)),
  };
}
