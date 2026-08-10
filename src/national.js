// National sweep, stage 1: volume-first qualification.
// 5 proven niches x national city list -> DataForSEO volume/CPC -> survivors only.
// Usage: node src/national.js [--min-vol 100]
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { loadEnv, ROOT } from "./env.js";

const env = loadEnv();
const MIN_VOL = process.argv.includes("--min-vol") ? +process.argv[process.argv.indexOf("--min-vol") + 1] : 100;
const PROVEN = ["appliance-repair", "dumpster-rental", "auto-glass", "mold-remediation", "outdoor-kitchens"];

const niches = JSON.parse(readFileSync(join(ROOT, "data", "niches.json"), "utf8")).filter((n) => PROVEN.includes(n.id));
// Keyword APIs reject punctuation: "San Buenaventura (Ventura)" -> "Ventura"
const cities = JSON.parse(readFileSync(join(ROOT, "data", "cities-national.json"), "utf8")).map((c) => {
  const paren = c.city.match(/\(([^)]+)\)/);
  const clean = (paren ? paren[1] : c.city).replace(/[^A-Za-z0-9 '\-]/g, "").trim();
  return { ...c, city: clean };
}).filter((c) => c.city.length > 2);
console.log(`${niches.length} niches x ${cities.length} cities = ${niches.length * cities.length} keywords`);

const outFile = join(ROOT, "data", "volumes-national.json");
const cache = existsSync(outFile) ? JSON.parse(readFileSync(outFile, "utf8")) : {};

const keywords = [];
for (const n of niches) for (const c of cities) keywords.push(`${n.acQuery} ${c.city.toLowerCase()}`);
const todo = [...new Set(keywords)].filter((k) => cache[k] === undefined);
console.log(`${todo.length} to fetch (${keywords.length - todo.length} cached)`);

for (let i = 0; i < todo.length; i += 1000) {
  const chunk = todo.slice(i, i + 1000);
  const res = await fetch("https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live", {
    method: "POST",
    headers: { authorization: `Basic ${env.DATAFORSEO_AUTH}`, "content-type": "application/json" },
    body: JSON.stringify([{ keywords: chunk, location_name: "United States", language_name: "English" }]),
  });
  if (!res.ok) throw new Error(`DataForSEO ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const task = (await res.json()).tasks?.[0];
  if (task?.status_code !== 20000) throw new Error(`task ${task?.status_code}: ${task?.status_message}`);
  for (const r of task.result || []) cache[r.keyword] = { vol: r.search_volume ?? 0, cpc: r.cpc ?? null };
  for (const k of chunk) if (cache[k] === undefined) cache[k] = { vol: 0, cpc: null };
  writeFileSync(outFile, JSON.stringify(cache));
  console.log(`  ${Math.min(i + 1000, todo.length)}/${todo.length}`);
}

// Qualify: real demand, sane CPC (SOP: $0 = worthless, $16+ = ad war)
const survivors = [];
for (const n of niches) {
  for (const c of cities) {
    const v = cache[`${n.acQuery} ${c.city.toLowerCase()}`];
    if (!v) continue;
    const cpcOk = v.cpc !== null && v.cpc > 0 && v.cpc <= 16;
    if (v.vol >= MIN_VOL && cpcOk) survivors.push({ nicheId: n.id, niche: n.label, ...c, vol: v.vol, cpc: v.cpc });
  }
}
survivors.sort((a, b) => b.vol - a.vol);
writeFileSync(join(ROOT, "data", "national-survivors.json"), JSON.stringify(survivors, null, 1));

console.log(`\nSurvivors (vol>=${MIN_VOL}, CPC $0.01-16): ${survivors.length} of ${keywords.length}`);
const byN = {};
for (const s of survivors) byN[s.niche] = (byN[s.niche] || 0) + 1;
console.log(Object.entries(byN).map(([k, v]) => `  ${k}: ${v}`).join("\n"));
console.log(`\nSERP calls needed: ~${survivors.length * 2} (SERP + autocomplete)`);
console.log("Top 15 by volume:");
for (const s of survivors.slice(0, 15)) console.log(`  ${s.niche} — ${s.city}, ${s.state}: ${s.vol}/mo $${s.cpc}`);
