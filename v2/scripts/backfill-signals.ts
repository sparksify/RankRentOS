// Backfill SERP signals from already-saved retry evidence (free; no provider calls).
import { readFileSync, writeFileSync, readdirSync } from "fs";
import { parseSerpResponse } from "../lib/providers/serpapi";
import { extractSignals } from "../lib/serp/signals";
const P = new URL("../../out/experiment-1_5/candidates-final.json", import.meta.url);
const cands = JSON.parse(readFileSync(P, "utf8"));
const dir = new URL("../../out/experiment-1_5/raw/", import.meta.url);
let n = 0;
for (const c of cands) {
  if (c.signals?.mapPackSize !== undefined) continue;
  const slug = c.id.replace(/[^a-z0-9]/gi, "_");
  const f = readdirSync(dir).find((x) => x.startsWith("serp-retry") && x.includes(slug));
  if (!f) continue;
  const raw = JSON.parse(readFileSync(new URL(f, dir), "utf8"));
  if (raw?.error) continue;
  const p: any = parseSerpResponse(raw);
  c.signals = extractSignals(p, c.city);
  const top = (p.organic || []).slice(0, 3);
  c.recovered = true; n++;
}
writeFileSync(P, JSON.stringify(cands, null, 1));
console.log(`recovered signals for ${n} opportunities from saved evidence`);
