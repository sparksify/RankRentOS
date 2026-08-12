// GEOGRAPHY VERIFICATION — resolve demand-attribution ambiguity before any candidate
// is allowed into the core cohort.
//
// Method (uses evidence already collected; no new spend):
//   1. SERP LOCALIZATION: do the map-pack businesses actually sit in the intended
//      state? SerpAPI returns addresses; if the pack is full of out-of-state
//      businesses, the SERP is not the market we think it is.
//   2. NAME COLLISION: is the city name shared with cities in other states?
//   3. VERDICT: verified | ambiguous-volume-only | unverified
// A candidate whose SERP is local but whose city name is shared has LOCAL COMPETITIVE
// evidence with an UPPER-BOUND volume figure — that is a materially different (and
// much better) situation than "we do not know where this data came from".
import { readFileSync, writeFileSync } from "fs";

const ROOT = new URL("../../", import.meta.url);
const OUT = new URL("out/wave-1-experiment/", ROOT);

// Only names genuinely shared by MULTIPLE notable US cities. Over-flagging is not
// conservatism: if every candidate is flagged, the flag carries no information.
// Excluded after checking: Orlando, Amarillo, Arvada, Naperville, Temecula,
// Brockton, Livermore — each is effectively unique nationally.
const NATIONALLY_SHARED = new Set([
  "Rochester",  // MN / NY
  "Aurora",     // IL / CO / OH
  "Madison",    // WI / AL / MS
  "Plano",      // TX / IL
  "Chandler",   // AZ / OK
  "Knoxville",  // TN / IA
  "Irvine",     // CA / KY
  "Bellevue",   // WA / NE / OH / KY
  "Kirkland",   // WA / IL
  "Roseville",  // CA / MN / MI
  "Rockville",  // MD / IL
  "Lancaster", "Springfield", "Columbus", "Arlington", "Franklin", "Georgetown", "Salem", "Richmond",
]);

const scored = [
  ...JSON.parse(readFileSync(new URL("out/experiment-2/stage4-scored.json", ROOT), "utf8")),
  ...JSON.parse(readFileSync(new URL("out/experiment-3/stage4-scored.json", ROOT), "utf8")),
].map((r: any, i: number) => ({ ...r, experiment: i < 0 ? "" : r.experiment ?? "" }));

const expOf = (id: string) => {
  for (const e of ["experiment-2", "experiment-3"]) {
    try { readFileSync(new URL(`out/${e}/raw/serp-${id.replace(/[^a-z0-9]/gi, "_")}.json`, ROOT)); return e; } catch { /* next */ }
  }
  return null;
};

const results = scored.filter((r: any) => r.bucket).map((r: any) => {
  const exp = expOf(r.id);
  let inState = 0, outState = 0, unknownLoc = 0;
  const samples: string[] = [];
  if (exp) {
    const raw = JSON.parse(readFileSync(new URL(`out/${exp}/raw/serp-${r.id.replace(/[^a-z0-9]/gi, "_")}.json`, ROOT), "utf8"));
    const places = (raw.local_results?.places ?? raw.local_results ?? []) as any[];
    for (const p of places) {
      const addr = `${p.address ?? ""}`;
      if (!addr) { unknownLoc++; continue; }
      // SerpAPI local addresses are usually "123 Main St, City, ST" or "City, ST"
      const m = addr.match(/,\s*([A-Z]{2})\b/);
      if (!m) { unknownLoc++; samples.push(addr); continue; }
      if (m[1] === r.state) inState++; else { outState++; samples.push(addr); }
    }
  }
  const localized = inState > 0 && outState === 0;
  const nameShared = NATIONALLY_SHARED.has(r.city);
  const verdict = !exp || (inState === 0 && outState === 0)
    ? "unverified-no-address-evidence"
    : localized && !nameShared ? "verified"
    : localized && nameShared ? "serp-local-volume-upper-bound"
    : "serp-not-localized";
  return { id: r.id, city: r.city, state: r.state, bucket: r.bucket, composite: r.score.composite,
    inState, outState, unknownLoc, nameShared, verdict, samples: samples.slice(0, 2) };
});

writeFileSync(new URL("geography-verification.json", OUT), JSON.stringify(results, null, 1));
const by = results.reduce((a: any, r) => { a[r.verdict] = (a[r.verdict] || 0) + 1; return a; }, {});
console.log(`verified ${results.length} bucketed candidates`);
console.log(JSON.stringify(by, null, 1));
console.log("\nNOT cleanly localized (excluded from core cohort or flagged):");
for (const r of results.filter((x) => x.verdict === "serp-not-localized" || x.verdict === "unverified-no-address-evidence"))
  console.log(`  ${r.verdict.padEnd(30)} | ${r.id} | inState ${r.inState} outState ${r.outState} unknown ${r.unknownLoc} ${r.samples.length ? "| e.g. " + r.samples[0] : ""}`);
console.log("\nSERP local but city name shared (volume = upper bound, competitive evidence sound):");
for (const r of results.filter((x) => x.verdict === "serp-local-volume-upper-bound"))
  console.log(`  ${String(r.composite).padStart(3)} | ${r.id} (${r.inState} in-state map listings, 0 out-of-state)`);
