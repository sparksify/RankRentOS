// ONE SERP collector smoke: run -> budget charge -> SerpAPI fetch -> parse ->
// extractSignals -> raw evidence to disk -> complete run with actuals.
// NOTE (reported gap): metric registry has no serp.* observation metrics —
// SERP evidence is snapshot+signals by design; no observations written here.
// Run: node --experimental-strip-types scripts/serp-smoke.ts
import { writeFileSync, mkdirSync } from "fs";
import { serpUrl, parseSerpResponse } from "../lib/providers/serpapi";
import { extractSignals } from "../lib/serp/signals";
import { createSupabaseStore } from "../lib/store/supabase";

const KEY = process.env.SERPAPI_KEY!;
if (!KEY) throw new Error("SERPAPI_KEY missing");
const store = createSupabaseStore();
const QUERY = "mold remediation franklin tn";
const LOCATION = "Franklin, Tennessee, United States";
const COST = 0.015;

const { run, existing } = await store.beginRun("serp-smoke", `smoke-${new Date().toISOString().slice(0, 10)}-r3`, { stage: 1, budgetCapUsd: 0.05 });
if (existing && run.status === "completed") { console.log("IDEMPOTENT SKIP: today's smoke already completed"); process.exit(0); }

await store.charge(run.id, "serpapi", 1, COST);
try {
  const url = serpUrl(QUERY, LOCATION, KEY);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`serpapi ${res.status}`);
  const raw = await res.json();
  mkdirSync(new URL("../../out/smoke", import.meta.url), { recursive: true });
  const evidencePath = new URL(`../../out/smoke/serp-${run.id}.json`, import.meta.url);
  writeFileSync(evidencePath, JSON.stringify(raw)); // raw evidence preserved before normalization
  const parsed = parseSerpResponse(raw as any);
  const signals = extractSignals(parsed as any, "Franklin");
  await store.completeRun(run.id, COST);
  console.log("SMOKE OK", JSON.stringify({ runId: run.id, organic: (parsed as any).organic?.length ?? (parsed as any).length, signals }, null, 0).slice(0, 600));
} catch (e: any) {
  await store.failRun(run.id, e.message);
  throw e;
}
