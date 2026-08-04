// Compute expected monthly $ value per market and a value-weighted rank.
// Ease (score) and value ($) are different axes: appliance repair is easy but
// caps at $300-500/mo rent; outdoor kitchens at 10 searches/mo can still pay
// $1-4k/mo via commission because one closed job is $3,750 (SOP: "one 25K
// inquiry a month is perfectly happy"). Usage: node src/value.js
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { ROOT } from "./env.js";

const niches = JSON.parse(readFileSync(join(ROOT, "data", "niches.json"), "utf8"));
const nicheById = Object.fromEntries(niches.map((n) => [n.id, n]));
const results = JSON.parse(readFileSync(join(ROOT, "out", "results.json"), "utf8"));

for (const r of results) {
  if (r.score === undefined) continue;
  const n = nicheById[r.nicheId];
  if (!n) continue;
  const avgTicket = (n.ticketLow + n.ticketHigh) / 2;
  const vol = r.signals?.volume ?? 0;

  // Lead flow: measured volume when we have it; a conservative floor of
  // 8 leads/mo when autocomplete proves demand that keyword tools can't see
  // (hyper-local under-reporting), else 3.
  let leads = vol > 0 ? vol * 0.25 * 0.12 : (r.signals?.autocompleteCityHit ? 8 : 3) * 0.3;
  leads = Math.max(leads, r.signals?.autocompleteCityHit ? 2 : 0.5);
  const closedJobs = leads * 0.10;

  // Two monetization paths — take the better one:
  const flatRent = Math.min(Math.max(Math.round((closedJobs * avgTicket * n.margin * 0.5) / 50) * 50, 300), 2000);
  const commissionMonthly = Math.round((closedJobs * avgTicket * 0.10) / 50) * 50; // 10% of gross
  const best = Math.max(flatRent, commissionMonthly);

  r.estMonthlyValue = best;
  r.estLeadsMo = Math.round(leads * 10) / 10;
  r.dealType = commissionMonthly > flatRent ? "commission" : "flat";
  r.suggestedRent = flatRent;
  r.commissionPerJob = Math.round((avgTicket * 0.10) / 50) * 50;
  // Value rank blends ease and money: sqrt keeps a $4k market from drowning a 90-score one
  r.valueRank = Math.round(r.score * Math.sqrt(best / 500));
}

writeFileSync(join(ROOT, "out", "results.json"), JSON.stringify(results, null, 2));
const scored = results.filter((x) => x.score !== undefined);
const byValue = [...scored].sort((a, b) => (b.valueRank || 0) - (a.valueRank || 0));
console.log("Top 12 by VALUE-WEIGHTED rank (score x $):");
for (const r of byValue.slice(0, 12)) {
  console.log(`  vr${String(r.valueRank).padStart(4)} | score ${r.score} | ~$${r.estMonthlyValue}/mo (${r.dealType}) | ${r.niche} — ${r.city}, ${r.state} | vol ${r.signals?.volume ?? 0}`);
}
