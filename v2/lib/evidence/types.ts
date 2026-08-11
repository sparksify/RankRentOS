/**
 * Evidence / provenance core types.
 *
 * Every material number in RankRent OS V2 enters as an Observation carrying
 * full provenance. Observations are APPEND-ONLY: they are never updated or
 * deleted; newer knowledge is a newer observation.
 */

export const EVIDENCE_TYPES = [
  "OBSERVED", // came directly off an API / crawled page
  "DERIVED", // deterministic computation over observed inputs
  "AI_ESTIMATED", // produced by AI research; must carry a source citation
  "HUMAN_ASSUMED", // entered or confirmed by a human; carries rationale
] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export const DISCOVERY_TYPES = [
  "SEED",
  "AI_DISCOVERY",
  "SEARCH_ANOMALY",
  "COMMUNITY_DISCOVERY",
  "HUMAN_HYPOTHESIS",
  "DATA_ANOMALY",
  "OTHER",
] as const;
export type DiscoveryType = (typeof DISCOVERY_TYPES)[number];

/** The wire shape of an observation before it is persisted. */
export interface ObservationInput {
  /** Metric id — MUST exist in the metric registry (lib/evidence/metrics.ts). */
  metric: string;
  /** Normalized value. Kind must match the registry entry. */
  value: number | string;
  /** Raw value as received from the source, when different from `value`. */
  rawValue?: number | string;
  /** Where this came from: provider/source id, e.g. "dataforseo", "serpapi", "human:steve", "ai:research". */
  source: string;
  /** URL or API endpoint backing the observation. REQUIRED for AI_ESTIMATED. */
  sourceUrl?: string;
  evidenceType: EvidenceType;
  /** 0..1 source-level confidence in this single observation. */
  confidence: number;
  /** Epoch ms when the fact was observed in the external world. */
  observedAt: number;
  /** Rationale — REQUIRED for HUMAN_ASSUMED. */
  rationale?: string;
}

export interface RegistryEntry {
  /** Canonical metric id, dot-namespaced, e.g. "kw.volume.exact". */
  id: string;
  /** "number" | "string" — the kind `value` must have. */
  kind: "number" | "string";
  /** Unit for numeric metrics (e.g. "searches/mo", "usd", "homes"). "none" for strings/classes. */
  unit: string;
  /** Evidence types this metric may legitimately arrive as. */
  allowedEvidenceTypes: readonly EvidenceType[];
  /**
   * Days after observedAt when the observation stops being valid for
   * SELECTION decisions. null = does not go stale (e.g., historical facts).
   */
  staleAfterDays: number | null;
  description: string;
}

export class EvidenceValidationError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "UNKNOWN_METRIC"
      | "KIND_MISMATCH"
      | "EVIDENCE_TYPE_NOT_ALLOWED"
      | "AI_CITATION_REQUIRED"
      | "HUMAN_RATIONALE_REQUIRED"
      | "CONFIDENCE_OUT_OF_RANGE"
      | "OBSERVED_AT_INVALID"
      | "NO_SUBJECT",
  ) {
    super(message);
    this.name = "EvidenceValidationError";
  }
}
