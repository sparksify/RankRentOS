import { createHash } from 'node:crypto';

/** Deterministic JSON stringify (sorted keys) so hashes are stable across runs. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortValue((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Checksum for raw evidence dedup: provider + request identity + payload. */
export function evidenceChecksum(provider: string, requestType: string, requestParams: unknown, payload: unknown): string {
  return sha256(stableStringify({ provider, requestType, requestParams, payload }));
}

/** Input hash for derived intelligence reproducibility. */
export function inputHash(inputs: unknown): string {
  return sha256(stableStringify(inputs)).slice(0, 16);
}
