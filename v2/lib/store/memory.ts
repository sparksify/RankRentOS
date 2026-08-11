// In-memory Store implementation — enforces the same rules migration 003
// enforces in Postgres (append-only grants, taxonomy CHECK, unique idempotency).
// Used by store-contract tests; Supabase impl must pass the identical suite.
import { assertValidObservation } from "../evidence/validate";
import { assertBudget, BudgetExceededError } from "../research/guards";
import type { Store, StoredObservation, ResearchRun, LedgerEntry } from "./contract";
import type { ObservationInput } from "../evidence/types";

let seq = 0;
const nid = (p: string) => `${p}_${++seq}`;

export function createMemoryStore(now: () => number = () => Date.now()): Store {
  const obs: StoredObservation[] = [];
  const runs = new Map<string, ResearchRun>();
  const byIdem = new Map<string, string>();
  const ledger: LedgerEntry[] = [];

  function validate(o: ObservationInput & { legacy?: boolean }) {
    assertValidObservation(o, now()); // taxonomy, metric registry, AI citation guard
  }

  return {
    async insertObservation(o) {
      validate(o);
      const row: StoredObservation = { ...o, id: nid("obs"), ingestedAt: now(), supersededBy: null };
      obs.push(row);
      return row;
    },
    async insertBatch(os) {
      os.forEach(validate); // atomic: all validated before any insert
      return Promise.all(os.map((o) => this.insertObservation(o)));
    },
    async latestByMetric(subjectId, metric, asOf) {
      const cand = obs.filter(
        (o) => o.subjectId === subjectId && o.metric === metric && !o.supersededBy &&
          (asOf === undefined || o.observedAt <= asOf)
      );
      if (!cand.length) return undefined;
      // supersession preference: fresh non-legacy beats legacy regardless of recency
      const fresh = cand.filter((o) => !o.legacy);
      const pool = fresh.length ? fresh : cand;
      return pool.sort((a, b) => b.observedAt - a.observedAt)[0];
    },
    async history(subjectId, metric) {
      return obs.filter((o) => o.subjectId === subjectId && o.metric === metric);
    },
    async supersede(oldId, byId) {
      const t = obs.find((o) => o.id === oldId);
      if (!t) throw new Error(`no observation ${oldId}`);
      t.supersededBy = byId; // pointer only; values remain untouched
    },

    async beginRun(kind, paramsHash, { stage, budgetCapUsd, asOf }) {
      const key = `${kind}|${paramsHash}`;
      const existingId = byIdem.get(key);
      if (existingId) return { run: runs.get(existingId)!, existing: true };
      const run: ResearchRun = { id: nid("run"), kind, paramsHash, stage, asOf, status: "running", budgetCapUsd, spentUsd: 0, createdAt: now() };
      runs.set(run.id, run); byIdem.set(key, run.id);
      return { run, existing: false };
    },
    async completeRun(id, actualCostUsd) {
      const r = runs.get(id); if (!r) throw new Error(`no run ${id}`);
      if (r.status === "completed") throw new Error("double-complete rejected");
      r.status = "completed"; r.spentUsd = actualCostUsd; r.completedAt = now();
      return r;
    },
    async failRun(id, error) {
      const r = runs.get(id); if (!r) throw new Error(`no run ${id}`);
      r.status = "failed"; r.error = error;
      return r;
    },
    async getRun(id) { return runs.get(id); },

    async charge(runId, provider, units, costUsd) {
      const r = runs.get(runId); if (!r) throw new Error(`no run ${runId}`);
      const already = ledger.filter((l) => l.runId === runId && !l.refused).reduce((s, l) => s + l.costUsd, 0);
      try {
        assertBudget(provider, costUsd, r.budgetCapUsd - already);
      } catch (e) {
        ledger.push({ id: nid("led"), runId, provider, units, costUsd, refused: true, createdAt: now() });
        throw e;
      }
      const entry: LedgerEntry = { id: nid("led"), runId, provider, units, costUsd, createdAt: now() };
      ledger.push(entry);
      return entry;
    },
    async spent(runId) {
      return ledger.filter((l) => l.runId === runId && !l.refused).reduce((s, l) => s + l.costUsd, 0);
    },
  };
}
export { BudgetExceededError };
