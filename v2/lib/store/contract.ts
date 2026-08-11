// Backend-independent store contract. Rules ported from the Convex reference
// (v2/convex/{observations,researchRuns,budget}.ts) — see reconciliation audit §8.
// Implementations: memory.ts (tests), supabase.ts (production).
import type { ObservationInput, EvidenceType } from "../evidence/types";

export interface SubjectRef { subjectType: string; subjectId: string; }

export interface StoredObservation extends ObservationInput, SubjectRef {
  id: string;
  ingestedAt: number;
  runId?: string;
  legacy?: boolean;
  supersededBy?: string | null;
}

export interface ResearchRun {
  id: string;
  kind: string;
  paramsHash: string;
  stage: number;
  asOf?: number;
  status: "running" | "completed" | "failed";
  budgetCapUsd: number;
  spentUsd: number;
  error?: string;
  createdAt: number;
  completedAt?: number;
}

export interface LedgerEntry {
  id: string;
  runId: string;
  provider: string;
  units: number;
  costUsd: number;
  refused?: boolean;
  createdAt: number;
}

export interface Store {
  // Observations: append-only. NO update/delete methods exist on this contract.
  insertObservation(o: ObservationInput & SubjectRef & { runId?: string; legacy?: boolean }): Promise<StoredObservation>;
  insertBatch(os: (ObservationInput & SubjectRef & { runId?: string; legacy?: boolean })[]): Promise<StoredObservation[]>; // atomic
  /** newest wins; non-legacy beats legacy even when legacy is newer */
  latestByMetric(subjectId: string, metric: string, asOf?: number): Promise<StoredObservation | undefined>;
  history(subjectId: string, metric: string): Promise<StoredObservation[]>;
  /** marks prior latest as superseded by the given observation (pointer, never mutation of values) */
  supersede(oldId: string, byId: string): Promise<void>;

  // Research runs: idempotent by (kind, paramsHash)
  beginRun(kind: string, paramsHash: string, opts: { stage: number; budgetCapUsd: number; asOf?: number }): Promise<{ run: ResearchRun; existing: boolean }>;
  completeRun(id: string, actualCostUsd: number): Promise<ResearchRun>;
  failRun(id: string, error: string): Promise<ResearchRun>;
  getRun(id: string): Promise<ResearchRun | undefined>;

  // Budget ledger
  charge(runId: string, provider: string, units: number, costUsd: number): Promise<LedgerEntry>;
  spent(runId: string): Promise<number>;
}
