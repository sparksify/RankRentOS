// Apply DataForSEO volume + CPC gates to already-scored results (SOP §1.6/§2.3).
// Adjusts score, recalculates rent from actual estimated lead flow, writes back.
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { ROOT } from "./env.js";

const volumes = JSON.parse(readFileSync(join(ROOT, "data", "volumes.json"), "utf8"));
const niches = JSON.parse(readFileSync(join(ROOT, "data", "niches.json"), "utf8"));
const nicheById = Object.fromEntries(niches.map((n) => [n.id, n]));
const results = JSON.parse(readFileSync(join(ROOT, "out", "results.json"), "utf8"));

let gated = 0, boosted = 0;
for (const r of results) {
  if (r.score === undefined) continue;
  const n = nicheById[r.nicheId];
  if (!n) continue;
  const v = volumes[`${n.acQuery} ${r.city.toLowerCase()}`];
  if (!v) continue;

  r.signals.volume = v.vol;
  r.signals.cpc = v.cpc;

  // Volume gate (SOP §1.6: ~300+/mo for rent model; 0 = the #1 rookie failure)
  let volFactor;
  if (v.vol >= 300) volFactor = 1.1;
  else if (v.vol >= 100) volFactor = 1.0;
  else if (v.vol >= 30) volFactor = 0.85;
  else if (v.vol >= 10) volFactor = 0.7;
  else volFactor = r.signals.autocompleteCityHit ? 0.65 : 0.5; // no measured volume; autocomplete softens the blow

  // CPC sanity band (SOP v2 §2.3): $2–15 healthy; $0/null = leads nobody buys; $16+ = ad war
  let cpcAdj = 0;
  if (v.cpc === null || v.cpc === 0) cpcAdj = -5;
  else if (v.cpc >= 2 && v.cpc <= 15) cpcAdj = 5;
  else if (v.cpc > 16) cpcAdj = -8;
  r.signals.volFactor = volFactor;
  r.signals.cpcAdj = cpcAdj;

  const before = r.score;
  r.preVolumeScore = before;
  r.score = Math.max(0, Math.min(100, Math.round(before * volFactor + cpcAdj)));
  if (r.score < before - 5) gated++; else if (r.score > before) boosted++;

  // Rent from actual flow when volume exists: leads = vol x 25% CTR x 12% contact
  if (v.vol > 0) {
    const leads = v.vol * 0.25 * 0.12;
    r.estLeadsMo = Math.round(leads * 10) / 10;
    const avgTicket = (n.ticketLow + n.ticketHigh) / 2;
    const monthlyValue = leads * 0.10 * avgTicket * n.margin; // 10% close
    const formulaRent = monthlyValue * 0.5;
    r.suggestedRent = Math.min(Math.max(Math.round(formulaRent / 50) * 50, 300), 2000);
    r.dealType = formulaRent > 2000 ? "commission" : "flat";
    r.commissionPerJob = r.dealType === "commission" ? Math.round((avgTicket * 0.10) / 50) * 50 : null;
  }
}

writeFileSync(join(ROOT, "out", "results.json"), JSON.stringify(results, null, 2));
const scored = results.filter((x) => x.score !== undefined).sort((a, b) => b.score - a.score);
console.log(`Rescored. ${gated} markets gated down, ${boosted} boosted.`);
console.log("New top 10:");
for (const r of scored.slice(0, 10)) {
  console.log(`  ${String(r.score).padStart(3)} (was ${r.preVolumeScore ?? "-"})  ${r.niche} — ${r.city}, ${r.state}  vol:${r.signals.volume ?? "?"}/mo cpc:$${r.signals.cpc ?? "?"}`);
}
