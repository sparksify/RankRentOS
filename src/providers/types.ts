// Provider interfaces. Business logic depends on these shapes only —
// provider-specific payloads stay inside each adapter (and in raw evidence).

import type { DomainObservation, KeywordObservation, SerpSnapshot } from '../core/types.js';

export interface ProviderUsage {
  provider: string;
  requests: number;
  costUsd: number;
  failures: number;
  totalLatencyMs: number;
}

export class UsageTracker {
  private usage = new Map<string, ProviderUsage>();
  record(provider: string, costUsd: number, latencyMs: number, failed = false): void {
    const u = this.usage.get(provider) ?? { provider, requests: 0, costUsd: 0, failures: 0, totalLatencyMs: 0 };
    u.requests += 1;
    u.costUsd += costUsd;
    u.totalLatencyMs += latencyMs;
    if (failed) u.failures += 1;
    this.usage.set(provider, u);
  }
  report(): ProviderUsage[] {
    return [...this.usage.values()];
  }
  totalCost(): number {
    return this.report().reduce((s, u) => s + u.costUsd, 0);
  }
}

export interface SerpProvider {
  readonly name: string;
  fetchSerp(query: string, location: string): Promise<SerpSnapshot>;
}

export interface KeywordVolumeProvider {
  readonly name: string;
  fetchVolumes(keywords: string[]): Promise<KeywordObservation[]>;
}

export interface DomainAvailabilityProvider {
  readonly name: string;
  check(domains: string[]): Promise<DomainObservation[]>;
}

export interface BudgetGate {
  maxTotalBudgetUsd: number;
  spentUsd: number;
}

export class BudgetExceededError extends Error {
  constructor(public readonly budget: BudgetGate) {
    super(`Research budget exceeded: spent $${budget.spentUsd.toFixed(2)} of $${budget.maxTotalBudgetUsd.toFixed(2)}`);
  }
}

export function assertBudget(gate: BudgetGate, nextCostUsd: number): void {
  if (gate.spentUsd + nextCostUsd > gate.maxTotalBudgetUsd) throw new BudgetExceededError(gate);
}
