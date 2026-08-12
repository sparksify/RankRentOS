// Supabase Store implementation (migration 003 schema). Thin REST layer —
// invariants live in Postgres (grants/constraints) AND at this boundary
// (assertValidObservation), matching memory.ts exactly.
// NOT yet exercised live: the LeadGenScout project is currently unreachable.
// This module throws immediately if credentials are absent — it never fakes results.
import { assertValidObservation } from "../evidence/validate";
import { assertBudget } from "../research/guards";
import type { Store } from "./contract";

const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

async function rest(path: string, opts: RequestInit = {}) {
  if (!URL_ || !KEY) throw new Error("Supabase credentials not configured (SUPABASE_URL / key)");
  const res = await fetch(`${URL_}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: KEY, authorization: `Bearer ${KEY}`, "content-type": "application/json",
      prefer: "return=representation", ...(opts.headers || {}) },
  });
  if (!res.ok) throw new Error(`supabase ${path}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null; // void RPCs return empty bodies
}

const toRow = (o: any) => ({
  subject_type: o.subjectType, subject_id: o.subjectId, metric: o.metric,
  value: o.value, unit: o.unit, basis: o.evidenceType, source: o.source,
  citation: o.sourceUrl ?? null, confidence: o.confidence ?? null,
  observed_at: new Date(o.observedAt).toISOString(), run_id: o.runId ?? null,
  legacy: o.legacy ?? false,
});
const fromRow = (r: any) => ({
  id: r.id, subjectType: r.subject_type, subjectId: r.subject_id, metric: r.metric,
  value: r.value, unit: r.unit, evidenceType: r.basis, source: r.source,
  sourceUrl: r.citation ?? undefined, confidence: r.confidence ?? undefined,
  observedAt: Date.parse(r.observed_at), ingestedAt: Date.parse(r.ingested_at),
  runId: r.run_id ?? undefined, legacy: r.legacy, supersededBy: r.superseded_by,
});

export function createSupabaseStore(): Store {
  return {
    async insertObservation(o) {
      assertValidObservation(o, Date.now());
      const [r] = await rest("observations", { method: "POST", body: JSON.stringify([toRow(o)]) });
      return fromRow(r);
    },
    async insertBatch(os) {
      os.forEach((o) => assertValidObservation(o, Date.now())); // validate all before sending; single POST = atomic
      const rows = await rest("observations", { method: "POST", body: JSON.stringify(os.map(toRow)) });
      return rows.map(fromRow);
    },
    async latestByMetric(subjectId, metric, asOf) {
      const asOfQ = asOf !== undefined ? `&observed_at=lte.${new Date(asOf).toISOString()}` : "";
      const rows = await rest(`observations?subject_id=eq.${subjectId}&metric=eq.${encodeURIComponent(metric)}&superseded_by=is.null${asOfQ}&order=legacy.asc,observed_at.desc&limit=1`);
      return rows[0] ? fromRow(rows[0]) : undefined;
    },
    async history(subjectId, metric) {
      const rows = await rest(`observations?subject_id=eq.${subjectId}&metric=eq.${encodeURIComponent(metric)}&order=observed_at.asc`);
      return rows.map(fromRow);
    },
    async supersede(oldId, byId) {
      // the ONLY permitted mutation, via RPC that touches superseded_by exclusively
      await rest(`rpc/supersede_observation`, { method: "POST", body: JSON.stringify({ p_old: oldId, p_by: byId }) });
    },
    async beginRun(kind, paramsHash, { stage, budgetCapUsd, asOf }) {
      const existing = await rest(`research_runs?kind=eq.${kind}&params_hash=eq.${paramsHash}&limit=1`);
      if (existing[0]) return { run: mapRun(existing[0]), existing: true };
      const [r] = await rest("research_runs", { method: "POST", body: JSON.stringify([{ kind, params_hash: paramsHash, stage, budget_cap_usd: budgetCapUsd, as_of: asOf ? new Date(asOf).toISOString() : null, status: "running" }]) });
      return { run: mapRun(r), existing: false };
    },
    async completeRun(id, actualCostUsd) {
      const [cur] = await rest(`research_runs?id=eq.${id}`);
      if (!cur) throw new Error(`no run ${id}`);
      if (cur.status === "completed") throw new Error("double-complete rejected");
      const [r] = await rest(`research_runs?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ status: "completed", spent_usd: actualCostUsd, completed_at: new Date().toISOString() }) });
      return mapRun(r);
    },
    async failRun(id, error) {
      const [r] = await rest(`research_runs?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ status: "failed", error }) });
      return mapRun(r);
    },
    async getRun(id) { const [r] = await rest(`research_runs?id=eq.${id}`); return r ? mapRun(r) : undefined; },
    async charge(runId, provider, units, costUsd) {
      const run = await this.getRun(runId); if (!run) throw new Error(`no run ${runId}`);
      const already = await this.spent(runId);
      try { assertBudget(provider, costUsd, run.budgetCapUsd - already); }
      catch (e) {
        await rest("budget_ledger", { method: "POST", body: JSON.stringify([{ run_id: runId, provider, units, cost_usd: costUsd, refused: true }]) });
        throw e;
      }
      const [r] = await rest("budget_ledger", { method: "POST", body: JSON.stringify([{ run_id: runId, provider, units, cost_usd: costUsd }]) });
      return { id: r.id, runId, provider, units, costUsd, createdAt: Date.parse(r.created_at) };
    },
    async spent(runId) {
      const rows = await rest(`budget_ledger?run_id=eq.${runId}&refused=eq.false&select=cost_usd`);
      return rows.reduce((s: number, r: any) => s + Number(r.cost_usd), 0);
    },
  };
}
const mapRun = (r: any) => ({ id: r.id, kind: r.kind, paramsHash: r.params_hash, stage: r.stage, asOf: r.as_of ? Date.parse(r.as_of) : undefined, status: r.status, budgetCapUsd: Number(r.budget_cap_usd), spentUsd: Number(r.spent_usd ?? 0), error: r.error ?? undefined, createdAt: Date.parse(r.created_at), completedAt: r.completed_at ? Date.parse(r.completed_at) : undefined });
