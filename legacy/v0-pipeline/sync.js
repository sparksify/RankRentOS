// Push out/results.json into Supabase (runs, markets, domains tables).
// Usage: node src/sync.js [--label "pilot 5 cities"]
import { readFileSync } from "fs";
import { join } from "path";
import { loadEnv, ROOT } from "./env.js";

const env = loadEnv();
if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_ANON_KEY in .env");
  process.exit(1);
}

const args = process.argv.slice(2);
const label = args.includes("--label") ? args[args.indexOf("--label") + 1] : `run ${new Date().toISOString().slice(0, 10)}`;

const HEADERS = {
  apikey: env.SUPABASE_ANON_KEY,
  authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
  "content-type": "application/json",
  prefer: "return=representation",
};

async function insert(table, rows) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`${table} insert ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

const results = JSON.parse(readFileSync(join(ROOT, "out", "results.json"), "utf8"));
const niches = JSON.parse(readFileSync(join(ROOT, "data", "niches.json"), "utf8"));
const nicheById = Object.fromEntries(niches.map((n) => [n.id, n]));
const scored = results.filter((r) => r.score !== undefined);

const [run] = await insert("runs", [{
  label,
  niche_count: new Set(scored.map((r) => r.nicheId)).size,
  city_count: new Set(scored.map((r) => `${r.city}|${r.state}`)).size,
  serp_calls: scored.length * 2,
}]);
console.log(`run ${run.id} (${label})`);

// Insert markets in batches of 100
let marketRows = [];
for (const r of scored) {
  const n = nicheById[r.nicheId] || {};
  marketRows.push({
    run_id: run.id,
    niche_id: r.nicheId, niche: r.niche, city: r.city, state: r.state, region: r.region,
    pop: r.pop, income: r.income,
    ticket_low: n.ticketLow, ticket_high: n.ticketHigh,
    score: r.score, deal_type: r.dealType || "flat",
    suggested_rent: r.suggestedRent, commission_per_job: r.commissionPerJob || null,
    peak_months: r.peakMonths || null, content_depth: r.contentDepth || null,
    comp_ages: r.compAges?.length ? r.compAges : null,
    signals: r.signals || {}, top_organic: r.topOrganic || [],
    advertisers: r.advertisers?.length ? r.advertisers : null,
    deep_check: r.deepCheck || null,
    domain_strategy: r.domainStrategy || null,
    need_type: !!n.need,
    est_monthly_value: r.estMonthlyValue || null,
    value_rank: r.valueRank || null,
    est_leads: r.estLeadsMo || null,
  });
}

const inserted = [];
for (let i = 0; i < marketRows.length; i += 100) {
  inserted.push(...(await insert("markets", marketRows.slice(i, i + 100))));
  console.log(`markets: ${Math.min(i + 100, marketRows.length)}/${marketRows.length}`);
}

// Domains (winner flagged)
const domainRows = [];
for (const [i, r] of scored.entries()) {
  const marketId = inserted[i]?.id;
  if (!marketId || !r.availableDomains) continue;
  for (const d of r.availableDomains) {
    domainRows.push({
      market_id: marketId, domain: d, available: true,
      is_winner: r.domainPick?.domain === d,
      winner_reason: r.domainPick?.domain === d ? r.domainPick.why : null,
    });
  }
}
for (let i = 0; i < domainRows.length; i += 200) {
  await insert("domains", domainRows.slice(i, i + 200));
}
console.log(`domains: ${domainRows.length} rows`);
console.log("Sync complete.");
