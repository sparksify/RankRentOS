// Fetch Google Ads search volume + CPC for every (niche, city) keyword via
// DataForSEO, cache to data/volumes.json. Usage: node src/volume.js [--test]
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { loadEnv, ROOT } from "./env.js";

const env = loadEnv();
if (!env.DATAFORSEO_AUTH) { console.error("Missing DATAFORSEO_AUTH in .env"); process.exit(1); }
const TEST = process.argv.includes("--test");

const niches = JSON.parse(readFileSync(join(ROOT, "data", "niches.json"), "utf8"));
const cities = JSON.parse(readFileSync(join(ROOT, "data", "cities.json"), "utf8"));

// Keyword = what a local actually types: "{acQuery} {city}"
const keywords = [];
for (const n of niches) for (const c of cities) keywords.push(`${n.acQuery} ${c.city.toLowerCase()}`);
const batch = TEST ? keywords.slice(0, 10) : keywords;

const outFile = join(ROOT, "data", "volumes.json");
const existing = existsSync(outFile) ? JSON.parse(readFileSync(outFile, "utf8")) : {};
const todo = batch.filter((k) => existing[k] === undefined);
console.log(`${batch.length} keywords, ${todo.length} to fetch (rest cached)`);

async function fetchBatch(kws) {
  const res = await fetch("https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live", {
    method: "POST",
    headers: { authorization: `Basic ${env.DATAFORSEO_AUTH}`, "content-type": "application/json" },
    body: JSON.stringify([{ keywords: kws, location_name: "United States", language_name: "English" }]),
  });
  if (!res.ok) throw new Error(`DataForSEO ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const task = data.tasks?.[0];
  if (task?.status_code !== 20000) throw new Error(`task ${task?.status_code}: ${task?.status_message}`);
  return task.result || [];
}

for (let i = 0; i < todo.length; i += 1000) {
  const chunk = todo.slice(i, i + 1000);
  const result = await fetchBatch(chunk);
  for (const r of result) {
    existing[r.keyword] = { vol: r.search_volume ?? 0, cpc: r.cpc ?? null, competition: r.competition ?? null };
  }
  // keywords the API didn't return = no data = effectively zero
  for (const k of chunk) if (existing[k] === undefined) existing[k] = { vol: 0, cpc: null, competition: null };
  writeFileSync(outFile, JSON.stringify(existing, null, 1));
  console.log(`fetched ${Math.min(i + 1000, todo.length)}/${todo.length}`);
}

const withVol = Object.values(existing).filter((v) => v.vol > 0).length;
console.log(`Done. ${Object.keys(existing).length} keywords cached, ${withVol} with volume > 0 → data/volumes.json`);
