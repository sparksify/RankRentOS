import { FRESHNESS_POLICY } from './config.js';

export type FreshnessState = 'fresh' | 'stale' | 'unknown';

export function freshnessOf(
  kind: keyof typeof FRESHNESS_POLICY,
  observedAt: string | null | undefined,
  now: Date = new Date()
): FreshnessState {
  if (!observedAt) return 'unknown';
  const policyDays = FRESHNESS_POLICY[kind];
  if (policyDays === null) return 'fresh'; // dataset-year data judged by dataset, not wall clock
  if (policyDays === 0) return 'stale';    // v0-unknown-date: stale until verified
  const ageDays = (now.getTime() - new Date(observedAt).getTime()) / 86_400_000;
  return ageDays <= policyDays ? 'fresh' : 'stale';
}

export function ageDays(observedAt: string, now: Date = new Date()): number {
  return Math.round((now.getTime() - new Date(observedAt).getTime()) / 86_400_000);
}
