// EXPERIMENT 2 — Stage 3: SERP competition + operator depth on Stage-2 survivors.
// SerpAPI ONLY (prepaid Production quota; DataForSEO is unfunded and blocked).
// One SERP per survivor + free RDAP domain check. Raw payloads saved for reparse.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { createSupabaseStore } from "../lib/store/supabase";
import { serpUrl, parseSerpResponse } from "../lib/providers/serpapi";
import { serpLocation } from "../lib/geo/states";
import { extractSignals, SIGNALS_VERSION } from "../lib/serp/signals";
import { dedupeOperators, depthSignals, OPERATORS_VERSION } from "../lib/operators/depth";

// Experiment directory is parameterized so Exp-2 and Exp-3 share one collector
// (identical methodology, no discontinuity between rounds).
const EXP = process.argv[2] || "experiment-2";
const OUT = new URL(`../../out/${EXP}/`, import.meta.url);
mkdirSync(new URL("raw/", OUT), { recursive: true });
const KEY = process.env.SERPAPI_KEY!;
const store = createSupabaseStore();
const SERP_COST = 0.0; // prepaid Production plan: marginal cost of an in-quota call is $0

const S = JSON.parse(readFileSync(new URL("stage2-complete.json", OUT), "utf8"));
const survivors: any[] = S.survivors;
console.log(`Stage 3: ${survivors.length} survivors -> ${survivors.length} SERPs (prepaid quota, $0 marginal)`);

const run = await store.beginRun(`${EXP}-serp`, `${EXP}-serp-v3-${survivors.length}`, { stage: 3, budgetCapUsd: 0 });
// Observations are append-only: only write them on a run that is not already closed,
// so a rerun re-derives the report without duplicating evidence.
const alreadyClosed = run.existing && run.run.status === "completed";
const failures: any[] = [];
let fetched = 0, reparsed = 0;

for (const c of survivors) {
  const slug = c.id.replace(/[^a-z0-9]/gi, "_");
  const query = `${c.kw} ${c.city}`;
  try {
    // Reparse the saved payload when we already have it — reruns cost no quota.
    const cacheFile = new URL(`raw/serp-${slug}.json`, OUT);
    let raw: any = null;
    if (existsSync(cacheFile)) {
      const cached = JSON.parse(readFileSync(cacheFile, "utf8"));
      if (!cached?.error) { raw = cached; reparsed++; }
    }
    if (!raw) {
      const res = await fetch(serpUrl(query, serpLocation(c.city, c.state), KEY));
      raw = await res.json();
      writeFileSync(cacheFile, JSON.stringify(raw));
      fetched++;
    }
    if (raw?.error) { failures.push({ id: c.id, reason: `serpapi: ${raw.error}` }); continue; }

    const parsed: any = parseSerpResponse(raw);
    const g: any = extractSignals(parsed, c.city);
    c.signals = g;

    // operator depth from map pack + organic + ads (localPack, not localResults)
    const ev: any[] = [];
    for (const b of parsed.localPack ?? [])
      ev.push({ name: b.title ?? b.name, source: "mappack", rating: b.rating ?? null, reviews: b.reviews ?? null, website: b.website ?? null });
    for (const o of (parsed.organic || []).slice(0, 8)) {
      try { const h = new URL(o.link).hostname.replace(/^www\./, ""); ev.push({ name: h, source: "organic", domain: h }); } catch { /* unparseable link */ }
    }
    for (const a of parsed.ads ?? []) ev.push({ name: a.displayed_link || a.title, source: "ads" });
    const ops = depthSignals(dedupeOperators(ev));
    c.operators = ops;

    const base = { subjectType: "market", subjectId: c.id, evidenceType: "DERIVED" as const, confidence: 0.85, observedAt: Date.now(), runId: run.run.id };
    const serpBase = { ...base, source: `serpapi:${SIGNALS_VERSION}:serp-${slug}.json` };
    const opBase = { ...base, source: `${OPERATORS_VERSION}:serp-${slug}.json`, confidence: 0.7 };
    const m: [string, any, any][] = [
      ["serp.directory.count", g.directoriesInTop3, serpBase], ["serp.franchise.count", g.franchisesInTop3, serpBase],
      ["serp.outoftown.count", g.outOfTownInTop3, serpBase], ["serp.innerpage.count", g.innerPagesInTop5, serpBase],
      ["serp.intentmismatch.count", g.intentMismatchInTop5, serpBase], ["serp.titletargeting.count", g.top3TitlesMissingCity, serpBase],
      ["serp.ads.count", g.adCount, serpBase], ["serp.mappack.count", g.mapPackSize, serpBase],
      ["serp.mappack.avgreviews", g.avgMapReviews, serpBase], ["serp.mappack.nowebsite.count", g.mapListingsWithoutWebsite, serpBase],
      ["op.count.relevant", ops.relevantOperatorCount, opBase], ["op.count.viable", ops.viableOperatorCount, opBase],
      ["op.count.stronger", ops.strongerOperatorCount, opBase], ["op.count.multisource", ops.multiSourceCount, opBase],
      ["op.count.advertiser", ops.advertiserCount, opBase], ["op.concentration.class", ops.concentration, opBase],
      ["op.reviews.median", ops.medianReviews, opBase], ["op.rating.median", ops.medianRating, opBase],
      ["op.website.adoptionpct", ops.websiteAdoptionPct, opBase],
      ["kw.volume.exact", c.vol, { ...base, source: `dataforseo:${EXP}-stage2`, evidenceType: "OBSERVED" as const, confidence: 0.9 }],
    ];
    if (!alreadyClosed) {
      await store.insertBatch(
        m.filter(([, v]) => v !== null && v !== undefined).map(([metric, value, b]) => ({ ...b, metric, value })),
      );
    }

    // free RDAP: exact-match domain availability
    const domain = `${c.kw} ${c.city}`.toLowerCase().replace(/[^a-z0-9]/g, "") + ".com";
    c.domain = domain;
    try {
      const rd = await fetch(`https://rdap.verisign.com/com/v1/domain/${domain}`);
      c.domainAvailable = rd.status === 404;
      if (!alreadyClosed) await store.insertBatch([{ ...base, metric: "domain.available.count", value: c.domainAvailable ? 1 : 0, source: "rdap", evidenceType: "OBSERVED" as const }]);
    } catch { /* rdap failure is non-fatal; leaves domainAvailable undefined */ }
    process.stdout.write(".");
  } catch (e: any) {
    failures.push({ id: c.id, reason: e.message.slice(0, 100) });
    process.stdout.write("x");
  }
}
if (!alreadyClosed) await store.completeRun(run.run.id, 0);

writeFileSync(new URL("stage3-enriched.json", OUT), JSON.stringify({ survivors, failures }, null, 1));
console.log(`\nfetched: ${fetched} new SERPs | reparsed from cache: ${reparsed} (no quota used)`);
console.log(`SERP collected: ${survivors.filter((s) => s.signals).length}/${survivors.length} | failures: ${failures.length}`);
if (failures.length) console.log("failure reasons:", JSON.stringify(failures.slice(0, 8), null, 1));
