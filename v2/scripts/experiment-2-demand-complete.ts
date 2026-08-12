// EXPERIMENT 2 — Stage 2 COMPLETION: measure every structurally valid hypothesis.
// Same endpoint/methodology as the original 700 (no methodological discontinuity).
// UNKNOWN != ZERO: provider-null and never-returned keywords are carried as unknown.
import { readFileSync, writeFileSync, existsSync } from "fs";
import { createSupabaseStore } from "../lib/store/supabase";
import { volumeRequest, parseVolumeResponse, DFS_VOLUME_URL, type KeywordVolume } from "../lib/providers/dataforseo";

const OUT = new URL("../../out/experiment-2/", import.meta.url);
const DFS = process.env.DATAFORSEO_AUTH;
// Fail loudly: a missing credential must never look like "the provider has no data".
if (!DFS) throw new Error("DATAFORSEO_AUTH is not set — refusing to run (missing credentials would be misread as missing demand)");
const store = createSupabaseStore();
const DEMAND_FLOOR = 100;

const H = JSON.parse(readFileSync(new URL("hypotheses.json", OUT), "utf8"));
const hyps: any[] = H.hyps;
const kw = (h: any) => `${h.kw} ${h.city}`.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
const keywords = [...new Set(hyps.map(kw))] as string[];

// ---- 1. harvest everything already measured from cached raw payloads (free) ----
const known = new Map<string, KeywordVolume>();
for (const f of ["raw-volume-0.json", "raw-volume-700.json", "raw-volume-complete.json"]) {
  const p = new URL(f, OUT);
  if (!existsSync(p)) continue;
  const raw = JSON.parse(readFileSync(p, "utf8"));
  if (raw?.tasks?.[0]?.status_code !== 20000) continue;
  for (const r of raw.tasks[0].result ?? []) {
    const measured = typeof r.search_volume === "number";
    known.set(r.keyword, {
      keyword: r.keyword, vol: measured ? r.search_volume : null,
      cpc: typeof r.cpc === "number" ? r.cpc : null, competition: r.competition ?? null,
      state: measured ? "measured" : "unknown-null",
    });
  }
}
const missing = keywords.filter((k) => !known.has(k));
console.log(`universe ${keywords.length} unique keywords | cached ${known.size} | never attempted ${missing.length}`);

// ---- 2. measure the never-attempted remainder, same endpoint ----
let actualCost = 0;
const failures: any[] = [];
if (missing.length) {
  const run = await store.beginRun("exp2-demand-complete", `exp2-vol-remainder-${missing.length}`, { stage: 2, budgetCapUsd: 1.0 });
  if (run.existing && run.run.status === "completed") {
    console.log("idempotent skip — remainder already measured in a prior run");
  } else {
    for (let i = 0; i < missing.length; i += 700) {
      const chunk = missing.slice(i, i + 700);
      const res = await fetch(DFS_VOLUME_URL, {
        method: "POST",
        headers: { authorization: `Basic ${DFS}`, "content-type": "application/json" },
        body: volumeRequest(chunk).body,
      });
      const raw = await res.json();
      writeFileSync(new URL("raw-volume-complete.json", OUT), JSON.stringify(raw));
      if (raw?.tasks?.[0]?.status_code !== 20000) {
        failures.push({ batch: i, status: raw?.tasks?.[0]?.status_code, msg: raw?.tasks?.[0]?.status_message });
        continue;
      }
      actualCost += raw.cost ?? 0;                       // ACTUAL provider-reported cost
      for (const r of parseVolumeResponse(raw, chunk)) known.set(r.keyword, r);
    }
    await store.charge(run.run.id, "dataforseo", missing.length, actualCost);
    // A run that collected nothing must NOT be recorded as completed: idempotency
    // would then skip the retry forever and the gap would look like a finding.
    if (failures.length) await store.failRun(run.run.id, JSON.stringify(failures).slice(0, 400));
    else await store.completeRun(run.run.id, actualCost);
  }
}

// ---- 3. attach evidence to hypotheses; unknown is never a rejection ----
const measured: any[] = [], observedZero: any[] = [], unknown: any[] = [], survivors: any[] = [], rejected: any[] = [];
for (const h of hyps) {
  const v = known.get(kw(h));
  h.volState = v?.state ?? "unknown-omitted";
  h.vol = v && typeof v.vol === "number" ? v.vol : null;
  h.cpc = v?.cpc ?? null;
  h.comp = v?.competition ?? null;

  if (h.vol === null) { unknown.push(h); continue; }      // NOT rejected — unresearched
  measured.push(h);
  if (h.vol === 0) observedZero.push(h);
  if (h.vol < DEMAND_FLOOR) { rejected.push({ ...h, reason: `measured demand ${h.vol}/mo below ${DEMAND_FLOOR} floor` }); continue; }
  if (h.cpc !== null && h.cpc > 25) { rejected.push({ ...h, reason: `CPC $${h.cpc} indicates an extreme ad war` }); continue; }
  survivors.push(h);
}
survivors.sort((a, b) => b.vol - a.vol);

// ---- 4. persist observations (append-only, provenance preserved) ----
const runObs = await store.beginRun("exp2-demand-obs", `exp2-obs-${measured.length}`, { stage: 2, budgetCapUsd: 0 });
if (!(runObs.existing && runObs.run.status === "completed")) {
  const batch: any[] = [];
  for (const h of measured) {
    const base = { subjectType: "market", subjectId: h.id, source: "dataforseo:google_ads/search_volume", evidenceType: "OBSERVED" as const, confidence: 0.9, observedAt: Date.now(), runId: runObs.run.id };
    batch.push({ ...base, metric: "kw.volume.exact", value: h.vol });
    if (typeof h.cpc === "number") batch.push({ ...base, metric: "kw.cpc", value: h.cpc });
  }
  for (let i = 0; i < batch.length; i += 500) await store.insertBatch(batch.slice(i, i + 500));
  await store.completeRun(runObs.run.id, 0);
}

const dist = (n: number) => measured.filter((h) => h.vol >= n).length;
writeFileSync(new URL("stage2-complete.json", OUT), JSON.stringify({
  demandFloor: DEMAND_FLOOR, actualCost, universe: hyps.length,
  measured: measured.length, observedZero: observedZero.length, unknown: unknown.length,
  survivors, rejectedCount: rejected.length,
  unknownIds: unknown.map((h) => h.id), failures,
}, null, 1));

const by = (rows: any[], k: string) => rows.reduce((a: any, r) => { a[r[k]] = (a[r[k]] || 0) + 1; return a; }, {});
console.log(`\nACTUAL new provider cost this run: $${actualCost.toFixed(4)}`);
console.log(`universe (structurally valid): ${hyps.length}`);
console.log(`  measured:      ${measured.length}   (incl. ${observedZero.length} observed-zero)`);
console.log(`  UNKNOWN:       ${unknown.length}   (no provider data — NOT rejected)`);
console.log(`demand distribution (of measured): >=100 ${dist(100)} | >=250 ${dist(250)} | >=500 ${dist(500)} | >=1000 ${dist(1000)}`);
console.log(`survivors: ${survivors.length} | rejected: ${rejected.length}`);
console.log("survivors by service:", JSON.stringify(by(survivors, "svcLabel")));
console.log("survivors by category:", JSON.stringify(by(survivors, "cat")));
console.log("survivors by stratum:", JSON.stringify(by(survivors, "stratum")));
if (failures.length) console.log("FAILURES:", JSON.stringify(failures));
