// Dual-strategy scoring: Rankability / Asset Value / Arbitrage / Overall,
// rent tiers, coverage ratio, portfolio classification, confidence.
// Pure functions over ALREADY-COLLECTED signals — no rescanning, no data loss.
// Benchmarks (close rate, CTR, contact rate) are labeled benchmark, not observed.
//
// CLI: node src/strategy.js   -> applies to out/results.json + out/national-results.json,
//      writes strategy fields in place + combined out/opportunities.json (deduped).
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { ROOT } from "./env.js";

// ---------- Rankability 0-100: pure SEO/competition attractiveness ----------
export function computeRankability(g = {}) {
  let pts = 0;
  pts += Math.min((g.directoriesInTop3 || 0) * 15, 30);       // directories = Google has nothing better
  pts += Math.min((g.innerPagesInTop5 || 0) * 5, 20);         // inner pages, not dedicated sites
  pts += Math.min((g.intentMismatchInTop5 || 0) * 6, 12);     // retail/info ranking for service intent
  pts += Math.min((g.outOfTownInTop3 || 0) * 4, 8);           // no local specialist
  pts += Math.min((g.top3TitlesMissingCity || 0) * 4, 10);    // untargeted titles
  if (g.mapPack === "absent") pts += 8;                        // no map competition (demand judged elsewhere)
  else if (g.avgMapReviews !== undefined) {
    if (g.avgMapReviews < 40) pts += 15;                       // SOP sweet spot
    else if (g.avgMapReviews < 100) pts += 6;
    if (g.mapListingsWithoutWebsite >= 1) pts += 4;
  }
  const w = g.competitorAvgWords;
  if (w !== undefined && w !== null) { if (w < 250) pts += 15; else if (w < 500) pts += 10; else if (w < 900) pts += 5; }
  const a = g.competitorAvgDomainAge;
  if (a !== undefined) { if (a < 4) pts += 6; else if (a < 8) pts += 3; }
  pts -= Math.min((g.franchisesInTop3 || 0) * 8, 16);          // brand-search franchises
  return Math.max(0, Math.min(100, Math.round(pts)));          // raw points; 100 = every weakness present
}

// ---------- Economics (benchmarks labeled) ----------
// kwUniverse: a ranked site captures the whole keyword cluster, not just the
// primary term; primary-term volume is typically ~40% of cluster (benchmark).
// closeNeed vs closeDesire: emergency/need services close far higher than
// comparison-shopped desire purchases (SOP: 5-15% general, 40-50% emergency).
export const BENCH = { ctr: 0.25, contactRate: 0.12, closeNeed: 0.25, closeDesire: 0.10, rentShareLow: 0.15, rentShareHigh: 0.25, kwUniverse: 2.5 };

export function computeEconomics(vol, niche) {
  const avgTicket = (niche.ticketLow + niche.ticketHigh) / 2;
  const leadsMo = (vol || 0) * BENCH.kwUniverse * BENCH.ctr * BENCH.contactRate;
  const closedMo = leadsMo * (niche.need ? BENCH.closeNeed : BENCH.closeDesire);
  const grossProfitMo = closedMo * avgTicket * niche.margin;
  const rentLow = Math.round((grossProfitMo * BENCH.rentShareLow) / 50) * 50;
  const rentHigh = Math.round((grossProfitMo * BENCH.rentShareHigh) / 50) * 50;
  const rentMid = (rentLow + rentHigh) / 2;
  const coverage = rentMid > 0 ? Math.round((grossProfitMo / rentMid) * 10) / 10 : null;
  const tier = rentMid >= 4000 ? "S" : rentMid >= 2500 ? "A" : rentMid >= 1500 ? "B" : rentMid >= 750 ? "C" : "D";
  return { avgTicket, leadsMo: r1(leadsMo), closedMo: r1(closedMo), grossProfitMo: Math.round(grossProfitMo),
    rentLow: Math.max(rentLow, 0), rentHigh: Math.max(rentHigh, 0), rentMid: Math.round(rentMid), coverage, tier };
}
const r1 = (x) => Math.round(x * 10) / 10;

// ---------- Asset Value 0-100: economic potential if we win ----------
export function computeAssetValue(g = {}, niche, city = {}, econ) {
  let pts = 0;
  const gp = econ.avgTicket * niche.margin;                    // gross profit per closed job
  pts += gp >= 5000 ? 30 : gp >= 2000 ? 24 : gp >= 1000 ? 18 : gp >= 500 ? 12 : gp >= 150 ? 6 : 2;
  const cpc = g.cpc || 0;                                      // advertisers' revealed lead value
  pts += cpc >= 10 ? 10 : cpc >= 5 ? 8 : cpc >= 2 ? 6 : cpc > 0 ? 3 : 0;
  const vol = g.volume || 0;                                   // demand scale
  pts += vol >= 1000 ? 20 : vol >= 500 ? 16 : vol >= 300 ? 13 : vol >= 100 ? 9 : vol >= 30 ? 5 : 1;
  if (niche.need) pts += 8;                                    // urgency / must-buy
  if (niche.seasonal) pts -= 5;
  let renter = 0;                                              // renter market depth & maturity
  if ((g.mapPackSize || 0) >= 3) renter += 6;
  if ((g.avgMapReviews || 0) >= 40) renter += 4;               // mature businesses = can pay
  if (g.buyerProof) renter += 8;
  if ((g.adCount || 0) >= 2) renter += 4;
  pts += Math.min(renter, 20);
  if ((city.income || 0) >= 100000) pts += 4; else if ((city.income || 0) >= 85000) pts += 2;
  return Math.max(0, Math.min(100, Math.round(pts / 0.92)));   // max raw ≈ 92
}

// ---------- Arbitrage 0-100: value mispriced vs difficulty ----------
export function computeArbitrage(rankability, assetValue) {
  return Math.round(100 * Math.pow(assetValue / 100, 0.6) * Math.pow(rankability / 100, 0.4));
}

// ---------- Classification ----------
export function classify({ rankability, assetValue, econ, g }) {
  const renterDepth = (g.mapPackSize || 0) >= 3 || g.buyerProof;
  const vol = g.volume || 0;
  // UNICORN = easy SEO + expensive customers: must clear a real rent bar, not just scores
  if (rankability >= 60 && assetValue >= 55 && renterDepth && vol >= 100 && econ.rentMid >= 750) return "UNICORN";
  if (assetValue >= 55 && rankability >= 40 && econ.rentHigh >= 1500) return "HIGH-VALUE";
  if (rankability >= 55 && assetValue < 35) return "LOW VALUE";
  if (rankability >= 55 && econ.rentMid >= 150) return "LOW-HANGING FRUIT";
  if (assetValue >= 55 && rankability < 40) return "LONG SHOT";
  return "STANDARD";
}

// ---------- Time to $2k MRR ----------
export function timeTo2k({ rankability, econ, g }) {
  if (econ.rentHigh < 2000) return { possible: false, prob: 0, note: "rent ceiling below $2k at benchmark economics" };
  let p = 0.15 + 0.5 * (rankability / 100);
  if ((g.volume || 0) >= 300) p += 0.15;
  if ((econ.coverage || 0) >= 5) p += 0.10;
  p = Math.max(0.05, Math.min(0.9, p));
  return { possible: true, prob: Math.round(p * 100) / 100, note: "probability of $2k+ MRR within 6-12mo (benchmark funnel)" };
}

// ---------- Confidence ----------
export function computeConfidence(row) {
  const g = row.signals || {};
  const volMeasured = (g.volume || 0) > 0;
  const cpcMeasured = (g.cpc || 0) > 0;
  if (volMeasured && cpcMeasured && row.deepCheck === "confirmed") return "high";
  if (volMeasured && cpcMeasured) return "medium";
  return "low";
}

export function applyStrategy(row, niche, city) {
  const g = row.signals || {};
  const rankability = computeRankability(g);
  const econ = computeEconomics(g.volume, niche);
  const assetValue = computeAssetValue(g, niche, city, econ);
  const arbitrage = computeArbitrage(rankability, assetValue);
  const overall = Math.round(0.35 * rankability + 0.35 * assetValue + 0.30 * arbitrage);
  const strategy = classify({ rankability, assetValue, econ, g });
  const t2k = timeTo2k({ rankability, econ, g });
  const confidence = computeConfidence(row);
  return { rankability, assetValue, arbitrage, overall, strategy, confidence, econ, timeTo2k: t2k };
}

// ---------- CLI: apply to both datasets, emit combined opportunities ----------
if (process.argv[1]?.endsWith("strategy.js")) {
  const niches = JSON.parse(readFileSync(join(ROOT, "data", "niches.json"), "utf8"));
  const nicheById = Object.fromEntries(niches.map((n) => [n.id, n]));
  const combined = new Map();

  for (const file of ["results.json", "national-results.json"]) {
    const p = join(ROOT, "out", file);
    if (!existsSync(p)) continue;
    const rows = JSON.parse(readFileSync(p, "utf8"));
    let applied = 0;
    for (const row of rows) {
      if (row.score === undefined) continue;
      const niche = nicheById[row.nicheId]; if (!niche) continue;
      const s = applyStrategy(row, niche, { income: row.income });
      Object.assign(row, {
        rankability: s.rankability, assetValue: s.assetValue, arbitrage: s.arbitrage,
        overallOpportunity: s.overall, strategy: s.strategy, dataConfidence: s.confidence,
        rentLow: s.econ.rentLow, rentHigh: s.econ.rentHigh, rentTier: s.econ.tier,
        coverageRatio: s.econ.coverage, grossProfitMo: s.econ.grossProfitMo,
        estLeadsMo: s.econ.leadsMo, timeTo2kProb: s.timeTo2k.prob, timeTo2kNote: s.timeTo2k.note,
        sourceDataset: file === "results.json" ? "original-58" : "national-491",
      });
      applied++;
      const key = `${row.nicheId}|${row.city}|${row.state}`;
      const prev = combined.get(key);
      if (!prev || (row.signals?.volume || 0) > (prev.signals?.volume || 0)) combined.set(key, row);
    }
    writeFileSync(p, JSON.stringify(rows, null, 2));
    console.log(`${file}: strategy applied to ${applied} markets`);
  }

  const all = [...combined.values()].sort((a, b) => b.overallOpportunity - a.overallOpportunity);
  writeFileSync(join(ROOT, "out", "opportunities.json"), JSON.stringify(all, null, 2));
  const byS = {};
  for (const r of all) byS[r.strategy] = (byS[r.strategy] || 0) + 1;
  console.log(`combined opportunities: ${all.length}`);
  console.log(Object.entries(byS).map(([k, v]) => `  ${k}: ${v}`).join("\n"));
  console.log("\nTop UNICORNs:");
  for (const r of all.filter((x) => x.strategy === "UNICORN").slice(0, 8))
    console.log(`  ${r.overallOpportunity} | R${r.rankability}/V${r.assetValue}/A${r.arbitrage} | ${r.niche} — ${r.city}, ${r.state} | $${r.rentLow}-${r.rentHigh}/mo (${r.rentTier}) cov ${r.coverageRatio}x | ${r.dataConfidence}`);
}
