/**
 * Pure evidence validation — no I/O. Used by Convex mutations at the write
 * boundary and directly unit-tested. These functions are the enforcement
 * point for the provenance guarantees:
 *
 *  - every observation names a registered metric with the right value kind
 *  - evidence types are restricted per metric
 *  - AI_ESTIMATED requires a source citation (the "AI citation guard")
 *  - HUMAN_ASSUMED requires a rationale
 *  - confidence is bounded, observedAt is sane
 */
import { getMetric } from "./metrics";
import {
  EvidenceValidationError,
  type ObservationInput,
  type RegistryEntry,
} from "./types";

/** Max clock skew tolerated for "observed in the future" (ms). */
const FUTURE_SKEW_MS = 5 * 60 * 1000;

export function assertValidObservation(
  input: ObservationInput,
  nowMs: number,
): RegistryEntry {
  const metric = getMetric(input.metric);
  if (!metric) {
    throw new EvidenceValidationError(
      `Unknown metric "${input.metric}" — add it to lib/evidence/metrics.ts before recording it`,
      "UNKNOWN_METRIC",
    );
  }
  if (typeof input.value !== metric.kind) {
    throw new EvidenceValidationError(
      `Metric "${metric.id}" expects a ${metric.kind}, got ${typeof input.value}`,
      "KIND_MISMATCH",
    );
  }
  if (!metric.allowedEvidenceTypes.includes(input.evidenceType)) {
    throw new EvidenceValidationError(
      `Metric "${metric.id}" does not accept evidence type ${input.evidenceType} (allowed: ${metric.allowedEvidenceTypes.join(", ")})`,
      "EVIDENCE_TYPE_NOT_ALLOWED",
    );
  }
  if (input.evidenceType === "AI_ESTIMATED") {
    const url = input.sourceUrl?.trim() ?? "";
    if (!/^https?:\/\/.+/.test(url)) {
      throw new EvidenceValidationError(
        `AI_ESTIMATED observation of "${metric.id}" requires a citation sourceUrl (http/https). AI research may not assert uncited facts.`,
        "AI_CITATION_REQUIRED",
      );
    }
  }
  if (input.evidenceType === "HUMAN_ASSUMED") {
    if (!input.rationale?.trim()) {
      throw new EvidenceValidationError(
        `HUMAN_ASSUMED observation of "${metric.id}" requires a rationale`,
        "HUMAN_RATIONALE_REQUIRED",
      );
    }
  }
  if (
    !Number.isFinite(input.confidence) ||
    input.confidence < 0 ||
    input.confidence > 1
  ) {
    throw new EvidenceValidationError(
      `confidence must be within [0,1], got ${input.confidence}`,
      "CONFIDENCE_OUT_OF_RANGE",
    );
  }
  if (
    !Number.isFinite(input.observedAt) ||
    input.observedAt <= 0 ||
    input.observedAt > nowMs + FUTURE_SKEW_MS
  ) {
    throw new EvidenceValidationError(
      `observedAt must be a past epoch-ms timestamp, got ${input.observedAt}`,
      "OBSERVED_AT_INVALID",
    );
  }
  return metric;
}

/** Whether an observation is still valid for SELECTION decisions at `asOfMs`. */
export function isFresh(
  observedAtMs: number,
  metric: RegistryEntry,
  asOfMs: number,
): boolean {
  if (metric.staleAfterDays === null) return true;
  return asOfMs - observedAtMs <= metric.staleAfterDays * 24 * 60 * 60 * 1000;
}

/**
 * Evidence-type mix of a set of observations — the raw material of the
 * Confidence dimension (Phase 4) and the Data Quality view. Pure + tested
 * now so provenance accounting is locked from the start.
 */
export function evidenceMix(
  observations: readonly { evidenceType: string }[],
): Record<string, number> {
  const mix: Record<string, number> = {
    OBSERVED: 0,
    DERIVED: 0,
    AI_ESTIMATED: 0,
    HUMAN_ASSUMED: 0,
  };
  for (const o of observations) {
    if (mix[o.evidenceType] === undefined) mix[o.evidenceType] = 0;
    mix[o.evidenceType] = (mix[o.evidenceType] ?? 0) + 1;
  }
  return mix;
}
