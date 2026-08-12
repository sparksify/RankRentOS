// Close the biggest Dimension-A evidence gap: competitor content depth + domain age.
// Both are FREE (page fetch + RDAP). Runs over bucketed candidates of an experiment.
// Missing values stay missing — a failed crawl is UNKNOWN, never 0 words / 0 years.
import { readFileSync, writeFileSync, existsSync } from "fs";
import { createSupabaseStore } from "../lib/store/supabase";
import { parseSerpResponse } from "../lib/providers/serpapi";
import { wordCount } from "../lib/crawl/contentDepth";
import { rdapUrl, registrationAgeYears } from "../lib/providers/rdap";
import { DIRECTORY_DOMAINS } from "../lib/serp/lists";

const EXP = process.argv[2] || "experiment-3";
const OUT = new URL(`../../out/${EXP}/`, import.meta.url);
const store = createSupabaseStore();
const scored: any[] = JSON.parse(readFileSync(new URL("stage4-scored.json", OUT), "utf8"));
// enrich everything bucketed plus near-misses (composite >= 55): the decision set
const targets = scored.filter((s) => s.bucket || (s.score.composite ?? 0) >= 55);
console.log(`[${EXP}] enriching ${targets.length} of ${scored.length} candidates (free: crawl + RDAP)`);

const run = await store.beginRun(`${EXP}-depth`, `${EXP}-depth-${targets.length}`, { stage: 3, budgetCapUsd: 0 });
const closed = run.existing && run.run.status === "completed";
let crawlOk = 0, crawlFail = 0, ageOk = 0;

for (const c of targets) {
  const slug = c.id.replace(/[^a-z0-9]/gi, "_");
  const rawFile = new URL(`raw/serp-${slug}.json`, OUT);
  if (!existsSync(rawFile)) continue;
  const parsed: any = parseSerpResponse(JSON.parse(readFileSync(rawFile, "utf8")));

  // top 3 non-directory organic competitors — the pages we would actually have to beat
  const comps = (parsed.organic || [])
    .filter((o: any) => { try { const h = new URL(o.link).hostname.replace(/^www\./, ""); return !DIRECTORY_DOMAINS.some((d) => h === d || h.endsWith(`.${d}`)); } catch { return false; } })
    .slice(0, 3);

  const words: number[] = [], ages: number[] = [];
  for (const o of comps) {
    try {
      const res = await fetch(o.link, { signal: AbortSignal.timeout(12000), headers: { "user-agent": "Mozilla/5.0 (compatible; RankRentOS research)" } });
      if (res.ok) { words.push(wordCount(await res.text())); crawlOk++; } else crawlFail++;
    } catch { crawlFail++; }
    try {
      const host = new URL(o.link).hostname.replace(/^www\./, "");
      const rd = await fetch(rdapUrl(host), { signal: AbortSignal.timeout(10000) });
      if (rd.ok) { const a = registrationAgeYears(await rd.json(), Date.now()); if (a !== null) { ages.push(a); ageOk++; } }
    } catch { /* RDAP miss leaves age UNKNOWN */ }
  }

  // UNKNOWN stays UNKNOWN: no crawled page -> no content-depth claim at all
  c.signals.competitorAvgWords = words.length ? Math.round(words.reduce((a, b) => a + b, 0) / words.length) : null;
  c.signals.competitorAvgDomainAgeYears = ages.length ? Math.round((ages.reduce((a, b) => a + b, 0) / ages.length) * 10) / 10 : null;
  c.depthEvidence = { pagesCrawled: words.length, domainsAged: ages.length, competitorsConsidered: comps.length };

  if (!closed) {
    const base = { subjectType: "market", subjectId: c.id, source: "crawl+rdap:depth-v1", evidenceType: "OBSERVED" as const, confidence: 0.8, observedAt: Date.now(), runId: run.run.id };
    const obs: any[] = [];
    if (c.signals.competitorAvgWords !== null) obs.push({ ...base, metric: "serp.competitor.avgwords", value: c.signals.competitorAvgWords });
    if (c.signals.competitorAvgDomainAgeYears !== null) obs.push({ ...base, metric: "serp.competitor.domainageyears", value: c.signals.competitorAvgDomainAgeYears });
    if (obs.length) await store.insertBatch(obs);
  }
  process.stdout.write(".");
}
if (!closed) await store.completeRun(run.run.id, 0);

writeFileSync(new URL("stage3-depth.json", OUT), JSON.stringify(targets, null, 1));
const w = targets.map((t) => t.signals.competitorAvgWords).filter((x): x is number => typeof x === "number");
const a = targets.map((t) => t.signals.competitorAvgDomainAgeYears).filter((x): x is number => typeof x === "number");
console.log(`\ncrawled pages ok ${crawlOk} / failed ${crawlFail} | domain ages resolved ${ageOk}`);
console.log(`candidates with content-depth evidence: ${w.length}/${targets.length} (mean ${w.length ? Math.round(w.reduce((x, y) => x + y, 0) / w.length) : "-"} words)`);
console.log(`candidates with domain-age evidence:   ${a.length}/${targets.length} (mean ${a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : "-"} years)`);
