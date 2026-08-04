// Evidence-file domain "provider": loads registrar-grade availability results
// collected out-of-band (e.g. the Vercel registrar API via an authenticated
// session) from evidence/domains/*.json.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { DomainObservation } from '../../core/types.js';
import { evidenceChecksum } from '../../core/hash.js';

export interface RawDomainEvidenceFile {
  provider: string; // e.g. 'vercel_registrar'
  observedAt: string;
  results: { domain: string; available: boolean | null; price?: number | null; premiumPrice?: number | null; message?: string }[];
}

export function loadDomainEvidence(dir: string): DomainObservation[] {
  if (!existsSync(dir)) return [];
  const out: DomainObservation[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    const raw = JSON.parse(readFileSync(join(dir, file), 'utf8')) as RawDomainEvidenceFile;
    for (const r of raw.results) {
      out.push({
        domain: r.domain.toLowerCase(),
        available: r.available,
        regPrice: r.price ?? null,
        premiumPrice: r.premiumPrice ?? null,
        registrar: raw.provider,
        provider: raw.provider,
        observedAt: raw.observedAt,
        evidenceChecksum: evidenceChecksum(raw.provider, 'availability', { domain: r.domain }, r),
      });
    }
  }
  return out;
}
