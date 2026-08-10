// National sweep, stage 2: SERP + autocomplete + content depth + domains on survivors.
// Usage: node src/national-scan.js [--limit N]
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { loadEnv, ROOT } from "./env.js";
import { fetchSerp } from "./serp.js";
import { autocompleteCheck, contentDepth } from "./demand.js";
import { checkCandidates, domainAgeYears, pickWinner } from "./domains.js";
import { scorePair } from "./score.js";

const STATE_NAMES = { AL:"Alabama",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",CT:"Connecticut",DE:"Delaware",FL:"Florida",GA:"Georgia",ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",MS:"Mississippi",MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",NM:"New Mexico",NY:"New York",NC:"North Carolina",ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",VA:"Virginia",WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming" };

const env = loadEnv();
const LIMIT = process.argv.includes("--limit") ? +process.argv[process.argv.indexOf("--limit") + 1] : Infinity;
const niches = JSON.parse(readFileSync(join(ROOT, "data", "niches.json"), "utf8"));
const nicheById = Object.fromEntries(niches.map((n) => [n.id, n]));
const survivors = JSON.parse(readFileSync(join(ROOT, "data", "national-survivors.json"), "utf8"));
const work = survivors.slice(0, LIMIT === Infinity ? undefined : LIMIT);

console.log(`Scanning ${work.length} demand-qualified markets`);
const results = [];
let calls = 0;

for (const [i, m] of work.entries()) {
  const niche = nicheById[m.nicheId];
  const city = { city: m.city, state: m.state, pop: m.pop, income: m.income || 85000, growth: m.growth, region: m.region };
  const location = `${m.city}, ${STATE_NAMES[m.state] || m.state}, United States`;
  const row = { nicheId: m.nicheId, niche: m.niche, city: m.city, state: m.state, region: m.state,
    pop: m.pop, income: m.income, ticket: `$${niche.ticketLow / 1000}k-$${niche.ticketHigh / 1000}k` };

  try {
    const serp = await fetchSerp(`${niche.query} ${m.city} ${m.state}`, location, env.SERPAPI_KEY);
    calls++;
    const topOrganic = serp.organic.slice(0, 5).map((r) => ({ pos: r.position, title: r.title, link: r.link }));

    let ac = null;
    try { ac = await autocompleteCheck(niche, city, env.SERPAPI_KEY); calls++; } catch { /* non-fatal */ }
    const depth = await contentDepth(topOrganic.filter((o) => o.link));
    const hosts = [...new Set(topOrganic.slice(0, 3).map((o) => { try { return new URL(o.link).hostname.replace(/^www\./, ""); } catch { return null; } }).filter((h) => h?.endsWith(".com")))];
    const compAges = (await Promise.all(hosts.map(domainAgeYears))).filter((a) => a !== null);

    const { score, signals } = scorePair(serp, niche, city, { autocomplete: ac, contentDepth: depth, compAges });
    signals.volume = m.vol; signals.cpc = m.cpc;

    // volume/CPC adjustment (same model as rescore.js) then value
    const volFactor = m.vol >= 300 ? 1.1 : m.vol >= 100 ? 1.0 : 0.85;
    const cpcAdj = m.cpc >= 2 && m.cpc <= 15 ? 5 : 0;
    row.score = Math.max(0, Math.min(100, Math.round(score * volFactor + cpcAdj)));
    row.signals = signals;
    row.topOrganic = topOrganic;
    row.advertisers = signals.advertisers;
    row.contentDepth = depth.avgWords;
    row.compAges = compAges;

    const leads = m.vol * 0.25 * 0.12;
    const avgTicket = (niche.ticketLow + niche.ticketHigh) / 2;
    const flat = Math.min(Math.max(Math.round((leads * 0.10 * avgTicket * niche.margin * 0.5) / 50) * 50, 300), 2000);
    const comm = Math.round((leads * 0.10 * avgTicket * 0.10) / 50) * 50;
    row.estLeadsMo = Math.round(leads * 10) / 10;
    row.estMonthlyValue = Math.max(flat, comm);
    row.suggestedRent = flat;
    row.dealType = comm > flat ? "commission" : "flat";
    row.commissionPerJob = Math.round((avgTicket * 0.10) / 50) * 50;

    if (row.score >= 45) {
      const doms = await checkCandidates(niche, city);
      row.availableDomains = doms.filter((d) => d.available === true).map((d) => d.domain);
      row.domainPick = pickWinner(row.availableDomains, niche, city);
    }

    results.push(row);
    console.log(`[${i + 1}/${work.length}] ${m.niche} — ${m.city}, ${m.state}  score ${row.score}  vol ${m.vol}  ${row.availableDomains?.length ? row.availableDomains.length + " domains" : ""}`);
  } catch (e) {
    console.error(`[${i + 1}/${work.length}] ${m.niche} — ${m.city}, ${m.state}  FAILED: ${e.message.slice(0, 80)}`);
    results.push({ ...row, error: e.message });
  }

  if (i % 25 === 0) { mkdirSync(join(ROOT, "out"), { recursive: true }); writeFileSync(join(ROOT, "out", "national-results.json"), JSON.stringify(results, null, 2)); }
}

mkdirSync(join(ROOT, "out"), { recursive: true });
writeFileSync(join(ROOT, "out", "national-results.json"), JSON.stringify(results, null, 2));
const scored = results.filter((r) => r.score !== undefined).sort((a, b) => b.score - a.score);
console.log(`\nDone. ${calls} SerpAPI calls. ${scored.length} scored.`);
console.log("Top 20 nationally:");
for (const r of scored.slice(0, 20)) {
  console.log(`  ${String(r.score).padStart(3)} | ${r.niche} — ${r.city}, ${r.state} | ${r.signals.volume}/mo $${r.signals.cpc} | est $${r.estMonthlyValue}/mo | ${r.domainPick?.domain || "no domain"}`);
}
