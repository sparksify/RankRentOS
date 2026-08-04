// Stage-2 deep check (SOP v2 §2.2): re-test the TOP markets with keyword
// variants — a combo judged on one keyword is the #1 due-diligence mistake.
// Usage: node src/deep.js [--top 30]
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { loadEnv, ROOT } from "./env.js";
import { fetchSerp } from "./serp.js";

const env = loadEnv();
const args = process.argv.slice(2);
const TOP = args.includes("--top") ? parseInt(args[args.indexOf("--top") + 1], 10) : 30;

const niches = JSON.parse(readFileSync(join(ROOT, "data", "niches.json"), "utf8"));
const nicheById = Object.fromEntries(niches.map((n) => [n.id, n]));
const results = JSON.parse(readFileSync(join(ROOT, "out", "results.json"), "utf8"));
const scored = results.filter((r) => r.score !== undefined).sort((a, b) => b.score - a.score);
const targets = scored.slice(0, TOP);

const DIRS = ["yelp.com","angi.com","thumbtack.com","homeadvisor.com","houzz.com","porch.com","bbb.org","yellowpages.com","facebook.com","reddit.com","nextdoor.com"];
function weakSerp(serp) {
  const top5 = serp.organic.slice(0, 5);
  const dirs = top5.filter((r) => { try { const h = new URL(r.link).hostname.replace(/^www\./,""); return DIRS.some((d) => h === d || h.endsWith("."+d)); } catch { return false; } }).length;
  const inner = top5.filter((r) => { try { return new URL(r.link).pathname.replace(/\/$/,"").split("/").filter(Boolean).length >= 1; } catch { return false; } }).length;
  return dirs + inner >= 3; // same weakness bar as the main scorer, coarser
}

console.log(`Deep-checking top ${targets.length} markets with 2 keyword variants each (~${targets.length * 2} calls)`);
let calls = 0;
for (const [i, r] of targets.entries()) {
  const niche = nicheById[r.nicheId];
  if (!niche) continue;
  const STATE_NAMES = { TX:"Texas",AZ:"Arizona",ID:"Idaho",UT:"Utah",IN:"Indiana",TN:"Tennessee",NC:"North Carolina",SC:"South Carolina",GA:"Georgia",CO:"Colorado",AR:"Arkansas",OK:"Oklahoma",IA:"Iowa",NE:"Nebraska",FL:"Florida" };
  const location = `${r.city}, ${STATE_NAMES[r.state] || r.state}, United States`;
  const variants = [`best ${niche.acQuery} ${r.city} ${r.state}`, `${niche.acQuery} company ${r.city} ${r.state}`];
  const verdicts = [];
  for (const v of variants) {
    try {
      const serp = await fetchSerp(v, location, env.SERPAPI_KEY);
      calls++;
      verdicts.push(weakSerp(serp));
    } catch (e) {
      verdicts.push(null);
      console.error(`  variant failed: ${v} (${e.message})`);
    }
  }
  const confirmed = verdicts.filter((v) => v === true).length;
  r.deepCheck = confirmed === 2 ? "confirmed" : confirmed === 1 ? "mixed" : "primary-only";
  console.log(`[${i + 1}/${targets.length}] ${r.niche} — ${r.city}: ${r.deepCheck}`);
}

writeFileSync(join(ROOT, "out", "results.json"), JSON.stringify(results, null, 2));
console.log(`\nDone: ${calls} calls. deepCheck written into results.json (re-run sync + dashboard to publish).`);
