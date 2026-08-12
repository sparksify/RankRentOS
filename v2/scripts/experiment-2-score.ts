// EXPERIMENT 2 — Stage 4: A–I v1 scoring, bucketing, sensitivity.
// Pure computation over collected evidence. No provider calls, no cost.
// contentWords / domainAge were NOT collected in Exp-2 (crawl not run): they stay
// absent so Dimension A reports them as gaps rather than having them imputed.
import { readFileSync, writeFileSync, existsSync } from "fs";
import { scoreOpportunity, bucketOf, WEIGHTS_DEFAULT, WEIGHT_SETS } from "../lib/scoring/composite";
import type { Ev } from "../lib/scoring/dimensions";

const EXP = process.argv[2] || "experiment-2";
const OUT = new URL(`../../out/${EXP}/`, import.meta.url);
const S = JSON.parse(readFileSync(new URL("stage3-enriched.json", OUT), "utf8"));
const rows: any[] = S.survivors.filter((s: any) => s.signals);
// Overlay free content-depth / domain-age evidence when it has been collected, so
// Dimension A scores on the fullest evidence available. Absent values stay absent.
const depthFile = new URL("stage3-depth.json", OUT);
if (existsSync(depthFile)) {
  const depth = new Map<string, any>(
    (JSON.parse(readFileSync(depthFile, "utf8")) as any[]).map((d) => [d.id, d]),
  );
  let applied = 0;
  for (const r of rows) {
    const d = depth.get(r.id);
    if (!d) continue;
    r.signals.competitorAvgWords = d.signals.competitorAvgWords ?? null;
    r.signals.competitorAvgDomainAgeYears = d.signals.competitorAvgDomainAgeYears ?? null;
    r.depthEvidence = d.depthEvidence;
    applied++;
  }
  console.log(`depth evidence applied to ${applied} candidates`);
}
const ASOF = 1786000000000; // fixed asOf so the run is reproducible

function toEv(c: any): Ev {
  const g = c.signals, o = c.operators || {};
  return {
    vol: c.vol, cpc: c.cpc,
    dirs: g.directoriesInTop3, inner: g.innerPagesInTop5, intentMismatch: g.intentMismatchInTop5,
    outOfTown: g.outOfTownInTop3, franchise: g.franchisesInTop3, titleTargeting: g.top3TitlesMissingCity,
    ads: g.adCount, mapCount: g.mapPackSize, mapReviews: g.avgMapReviews, mapNoWebsite: g.mapListingsWithoutWebsite,
    contentWords: g.competitorAvgWords, domainAge: g.competitorAvgDomainAgeYears, // null: not collected
    opRelevant: o.relevantOperatorCount, opViable: o.viableOperatorCount, opStrong: o.strongerOperatorCount,
    opMedReviews: o.medianReviews, opWebPct: o.websiteAdoptionPct, opAdvertisers: o.advertiserCount,
    opConcentration: o.concentration, opMultiSource: o.multiSourceCount,
    ticketAvg: c.ticket, margin: c.margin,
    domainAvailable: c.domainAvailable ?? null,
    freshnessDays: 0,
  };
}

const scored = rows.map((c) => {
  const ev = toEv(c);
  const s = scoreOpportunity(c.id, ev, WEIGHTS_DEFAULT, ASOF);
  const b = bucketOf(s, ev);
  // sensitivity: rank under every weight set
  const alt: Record<string, number | null> = {};
  for (const w of WEIGHT_SETS) alt[w.id] = scoreOpportunity(c.id, ev, w, ASOF).composite;
  return { ...c, ev, score: s, bucket: b.bucket, bucketWhy: b.why, alt };
});

// ranks per weight set for stability analysis
const rankMaps: Record<string, Map<string, number>> = {};
for (const w of WEIGHT_SETS) {
  const ordered = [...scored].sort((a, b) => (b.alt[w.id] ?? -1) - (a.alt[w.id] ?? -1));
  rankMaps[w.id] = new Map(ordered.map((r, i) => [r.id, i + 1]));
}
for (const r of scored) {
  const ranks = WEIGHT_SETS.map((w) => rankMaps[w.id].get(r.id)!);
  r.rankDefault = rankMaps[WEIGHTS_DEFAULT.id].get(r.id)!;
  r.rankBest = Math.min(...ranks); r.rankWorst = Math.max(...ranks);
  r.rankSpread = r.rankWorst - r.rankBest;
}
scored.sort((a, b) => (b.score.composite ?? -1) - (a.score.composite ?? -1));
writeFileSync(new URL("stage4-scored.json", OUT), JSON.stringify(scored, null, 1));

// ---------- report surfaces ----------
const buckets = scored.reduce((a: any, s) => { const k = s.bucket ?? "unbucketed"; a[k] = (a[k] || 0) + 1; return a; }, {});
const unbucketWhy = scored.filter((s) => !s.bucket).reduce((a: any, s) => { a[s.bucketWhy] = (a[s.bucketWhy] || 0) + 1; return a; }, {});
console.log(`[${EXP}] scored: ${scored.length}`);
console.log("buckets:", JSON.stringify(buckets));
console.log("unbucketed reasons:", JSON.stringify(unbucketWhy));
console.log("\nTOP 20 (default weights):");
for (const s of scored.slice(0, 20)) {
  const d = s.score.dims;
  const dm = (k: string) => String(d[k].score ?? "-").padStart(3);
  console.log(
    `${String(s.score.composite).padStart(3)} | ${(s.bucket ?? "—").padEnd(11)} | ${String(s.vol).padStart(4)}/mo | ` +
    `A${dm("A")} B${dm("B")} C${dm("C")} D${dm("D")} E${dm("E")} F${dm("F")} H${dm("H")} | conf ${String(s.score.confidenceScore).padStart(3)} | ` +
    `rank ${s.rankBest}-${s.rankWorst} | ${s.svcLabel} — ${s.city}, ${s.state}${s.domainAvailable ? " [.com OPEN]" : ""}`,
  );
}
const stable = scored.slice(0, 20).filter((s) => s.rankSpread <= 15).length;
console.log(`\nsensitivity: ${stable}/20 of the top 20 stay within 15 rank positions across all 5 weight sets`);
const gaps = scored.flatMap((s) => s.score.unscoredDimensions).reduce((a: any, d: string) => { a[d] = (a[d] || 0) + 1; return a; }, {});
console.log("unscored dimensions (evidence gaps):", JSON.stringify(gaps));
console.log("median evidence completeness:", scored.map((s) => s.score.evidenceCompleteness).sort((a, b) => a - b)[Math.floor(scored.length / 2)] + "%");
