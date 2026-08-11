/**
 * Collector guards — pure assertions enforced by every paid collector:
 * funnel-stage gating (expensive research never runs on unqualified
 * candidates) and budget-remaining checks.
 */
import { COLLECTOR_REQUIRED_STAGE } from "../config";

export class StageGateError extends Error {
  constructor(kind: string, required: number, actual: number) {
    super(
      `stage gate: collector "${kind}" requires funnel stage >= ${required}, opportunity is at stage ${actual}`,
    );
    this.name = "StageGateError";
  }
}

export class BudgetExceededError extends Error {
  constructor(kind: string, estUsd: number, remainingUsd: number) {
    super(
      `budget gate: collector "${kind}" estimated $${estUsd} exceeds remaining research budget $${remainingUsd}`,
    );
    this.name = "BudgetExceededError";
  }
}

export function assertStage(kind: string, actualStage: number): void {
  const required = COLLECTOR_REQUIRED_STAGE[kind];
  if (required === undefined) return; // unmetered kinds (e.g. trends) have no stage gate
  if (actualStage < required) throw new StageGateError(kind, required, actualStage);
}

export function assertBudget(
  kind: string,
  estUsd: number,
  remainingUsd: number,
): void {
  if (estUsd > remainingUsd) throw new BudgetExceededError(kind, estUsd, remainingUsd);
}
