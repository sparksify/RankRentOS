import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { loadEnv, ROOT } from "./env.js";
import { fetchSerp } from "./serp.js";
import { checkCandidates, domainAgeYears, pickWinner } from "./domains.js";
import { scorePair } from "./score.js";
import { autocompleteCheck, buildTrends, contentDepth } from "./demand.js";

const args = process.argv.slice(2);
const DOMAINS_ONLY = args.includes("--domains-only");
const LIMIT = (() => {
  const i = args.indexOf("--limit");
  return i >= 0 ? parseInt(args[i + 1], 10) : Infinity;
})();
const MIN_SCORE_FOR_DOMAINS = 40; // only burn RDAP calls on markets worth owning

const CITY_LIMIT = (() => {
  const i = args.indexOf("--cities");
  return i >= 0 ? parseInt(args[i + 1], 10) : Infinity;
})();

const STATE_NAMES = {
  TX: "Texas", AZ: "Arizona", ID: "Idaho", UT: "Utah", IN: "Indiana", TN: "Tennessee",
  NC: "North Carolina", SC: "South Carolina", GA: "Georgia", CO: "Colorado",
  AR: "Arkansas", OK: "Oklahoma", IA: "Iowa", NE: "Nebraska", FL: "Florida",
};

const env = loadEnv();
const niches = JSON.parse(readFileSync(join(ROOT, "data", "niches.json"), "utf8"));
let cities = JSON.parse(readFileSync(join(ROOT, "data", "cities.json"), "utf8"));
if (CITY_LIMIT !== Infinity) cities = cities.slice(0, CITY_LIMIT);

if (!DOMAINS_ONLY && !env.SERPAPI_KEY) {
  console.error("No SERPAPI_KEY found (checked env, .env, ../hermes-os/.env.local).");
  console.error("Run with --domains-only to check domain availability without SERP data.");
  process.exit(1);
}

const pairs = [];
for (const niche of niches) for (const city of cities) pairs.push({ niche, city });
const work = pairs.slice(0, LIMIT === Infinity ? undefined : LIMIT);

console.log(`leadgen-scout: ${niches.length} niches x ${cities.length} cities = ${pairs.length} pairs; running ${work.length}${DOMAINS_ONLY ? " (domains only)" : ""}`);

// One-time niche demand weights + seasonality (2 SerpAPI calls, cached to data/trends.json)
let trends = null;
if (!DOMAINS_ONLY) {
  try {
    trends = await buildTrends(niches, env.SERPAPI_KEY);
    console.log("Trends weights:", Object.entries(trends.stats).map(([t, s]) => `${t}=${s.weight}`).join(" "));
  } catch (e) {
    console.error(`Trends unavailable (${e.message}) — continuing without niche weights`);
  }
}

const results = [];
let serpCalls = 0;

for (const [i, { niche, city }] of work.entries()) {
  const label = `${niche.label} — ${city.city}, ${city.state}`;
  const row = {
    nicheId: niche.id,
    niche: niche.label,
    city: city.city,
    state: city.state,
    region: city.region,
    income: city.income,
    pop: city.pop,
    ticket: `$${niche.ticketLow / 1000}k-$${niche.ticketHigh / 1000}k`,
  };

  try {
    if (!DOMAINS_ONLY) {
      const location = `${city.city}, ${STATE_NAMES[city.state] || city.state}, United States`;
      const serp = await fetchSerp(`${niche.query} ${city.city} ${city.state}`, location, env.SERPAPI_KEY);
      serpCalls++;

      const topOrganic = serp.organic.slice(0, 5).map((r) => ({ pos: r.position, title: r.title, link: r.link }));

      // demand floor (1 SerpAPI autocomplete call, cached) + competitor depth (free crawl)
      let ac = null;
      try { ac = await autocompleteCheck(niche, city, env.SERPAPI_KEY); serpCalls++; } catch { /* non-fatal */ }
      const depth = await contentDepth(topOrganic.filter((o) => o.link));

      // competitor domain ages via RDAP (free) — top-3 non-directory hosts
      const compHosts = [...new Set(topOrganic.slice(0, 3).map((o) => {
        try { return new URL(o.link).hostname.replace(/^www\./, ""); } catch { return null; }
      }).filter((h) => h && h.endsWith(".com")))];
      const compAges = (await Promise.all(compHosts.map(domainAgeYears))).filter((a) => a !== null);

      const trendStats = trends?.stats?.[niche.acQuery];
      const trendWeight = niche.seasonal ? trendStats?.weightPeak : trendStats?.weight;
      const { score, signals } = scorePair(serp, niche, city, {
        autocomplete: ac,
        trendWeight,
        contentDepth: depth,
        compAges,
      });

      row.score = score;
      row.signals = signals;
      row.topOrganic = topOrganic;
      row.advertisers = signals.advertisers;
      row.peakMonths = trendStats?.peakMonths;
      row.contentDepth = depth.avgWords;
      row.compAges = compAges;

      // Monetization estimate. Formula value (SOP §1.4) tells us what the leads are
      // WORTH; the market says flat rents actually clear at $500-$2,000/mo (§5.1).
      // High-ticket niches monetize the gap via commission deals, not higher rent.
      const avgTicket = (niche.ticketLow + niche.ticketHigh) / 2;
      const monthlyLeadValue = 20 * 0.10 * avgTicket * niche.margin; // 20 calls, 10% close
      const formulaRent = monthlyLeadValue * 0.5;
      row.suggestedRent = Math.min(Math.max(Math.round(formulaRent / 50) * 50, 300), 2000);
      row.dealType = formulaRent > 2000 ? "commission" : "flat";
      if (row.dealType === "commission") {
        row.commissionPerJob = Math.round((avgTicket * 0.10) / 50) * 50; // 10% of gross per closed job
      }
    }

    // Domain check: always in domains-only mode, else only for promising markets
    if (DOMAINS_ONLY || (row.score ?? 0) >= MIN_SCORE_FOR_DOMAINS) {
      const domains = await checkCandidates(niche, city);
      row.availableDomains = domains.filter((d) => d.available === true).map((d) => d.domain);
      row.exactMatchAvailable = row.availableDomains.some((d) =>
        d.startsWith(city.city.toLowerCase().replace(/[^a-z0-9]/g, ""))
      );
      row.domainPick = pickWinner(row.availableDomains, niche, city);
      // SOP v2 §3.1: EMD for quick single-city rent sites; PMD/brand for
      // commission-grade high-ticket markets you'd grow and need to look trustworthy
      row.domainStrategy = (row.dealType === "commission" || niche.ticketHigh >= 15000)
        ? "PMD/brand recommended (commission-grade: rank speed matters less than trust & growth)"
        : "EMD (speed play: rent-model site in a weak market)";
    }

    results.push(row);
    const s = row.score !== undefined ? `score ${row.score}` : "";
    const d = row.availableDomains ? `${row.availableDomains.length} domains open` : "";
    console.log(`[${i + 1}/${work.length}] ${label}  ${s} ${d}`.trim());
  } catch (e) {
    console.error(`[${i + 1}/${work.length}] ${label}  FAILED: ${e.message}`);
    results.push({ ...row, error: e.message });
  }
}

mkdirSync(join(ROOT, "out"), { recursive: true });
const outFile = join(ROOT, "out", "results.json");
writeFileSync(outFile, JSON.stringify(results, null, 2));

const scored = results.filter((r) => r.score !== undefined).sort((a, b) => b.score - a.score);
console.log(`\nDone. ${serpCalls} SERP calls (cached responses are free on re-run).`);
console.log(`Results: ${outFile}`);
if (scored.length) {
  console.log("\nTop 10:");
  for (const r of scored.slice(0, 10)) {
    console.log(`  ${String(r.score).padStart(3)}  ${r.niche} — ${r.city}, ${r.state}  ${r.availableDomains?.length ? `[${r.availableDomains[0]} available]` : ""}`);
  }
}
