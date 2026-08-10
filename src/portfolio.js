// Initial Portfolio Builder: ~20 assets, default mix 8 LHF / 8 HIGH-VALUE / 4 UNICORN.
// Quality thresholds beat quotas; diversity caps prevent concentration.
// Usage: node src/portfolio.js
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { ROOT } from "./env.js";

const all = JSON.parse(readFileSync(join(ROOT, "out", "opportunities.json"), "utf8"));
const CAPS = { perNiche: 6, perCity: 1, perState: 5 };
const TARGET = { UNICORN: 4, "HIGH-VALUE": 8, "LOW-HANGING FRUIT": 8 };

function pick(pool, n, taken) {
  const out = [];
  for (const r of pool) {
    if (out.length >= n) break;
    const nicheCt = taken.filter((t) => t.niche === r.niche).length;
    const cityCt = taken.filter((t) => t.city === r.city && t.state === r.state).length;
    const stateCt = taken.filter((t) => t.state === r.state).length;
    if (nicheCt >= CAPS.perNiche || cityCt >= CAPS.perCity || stateCt >= CAPS.perState) continue;
    out.push(r); taken.push(r);
  }
  return out;
}

const taken = [];
const unicorns = pick(all.filter((r) => r.strategy === "UNICORN").sort((a, b) => b.overallOpportunity - a.overallOpportunity), TARGET.UNICORN, taken);
const highValue = pick(all.filter((r) => r.strategy === "HIGH-VALUE").sort((a, b) => b.arbitrage - a.arbitrage), TARGET["HIGH-VALUE"], taken);
const lhf = pick(all.filter((r) => r.strategy === "LOW-HANGING FRUIT").sort((a, b) => b.rankability - a.rankability), TARGET["LOW-HANGING FRUIT"], taken);

const portfolio = { generatedAt: null, // stamped by caller if needed
  note: "Quality thresholds take precedence over quotas — short categories are NOT padded.",
  unicorns, highValue, lowHangingFruit: lhf,
  totals: {
    count: taken.length,
    estRentLow: taken.reduce((s, r) => s + (r.rentLow || 0), 0),
    estRentHigh: taken.reduce((s, r) => s + (r.rentHigh || 0), 0),
    niches: [...new Set(taken.map((r) => r.niche))].length,
    states: [...new Set(taken.map((r) => r.state))].length,
  },
};
writeFileSync(join(ROOT, "out", "portfolio.json"), JSON.stringify(portfolio, null, 2));

function show(label, rows) {
  console.log(`\n${label} (${rows.length}):`);
  for (const r of rows) console.log(`  ${String(r.overallOpportunity).padStart(3)} | R${r.rankability}/V${r.assetValue}/A${r.arbitrage} | ${r.niche} — ${r.city}, ${r.state} | $${r.rentLow}-${r.rentHigh}/mo (${r.rentTier}) cov ${r.coverageRatio}x | vol ${r.signals?.volume} | ${r.dataConfidence} | ${r.domainPick?.domain || "check domains"}`);
}
show("UNICORN", unicorns); show("HIGH-VALUE", highValue); show("LOW-HANGING FRUIT", lhf);
console.log(`\nPortfolio: ${portfolio.totals.count} assets, ${portfolio.totals.niches} niches, ${portfolio.totals.states} states`);
console.log(`Est. combined rent at maturity: $${portfolio.totals.estRentLow.toLocaleString()}-$${portfolio.totals.estRentHigh.toLocaleString()}/mo (benchmark funnel, discount per SOP)`);
