// Evidence-file SERP "provider": loads SERP snapshots collected out-of-band
// (e.g. harness web research in a Claude session, or a manual export) from
// evidence/serp/*.json. Each file records provider, query, observedAt and raw
// results; classification runs at import so signals stay consistent.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { SerpResultItem, SerpSnapshot } from '../../core/types.js';
import { evidenceChecksum } from '../../core/hash.js';
import { classifyResult, hostOf } from '../../pipeline/serp-signals.js';

export interface RawSerpEvidenceFile {
  provider: string; // e.g. 'web_search'
  query: string;
  location?: string;
  observedAt: string;
  results: { position: number; url?: string; title?: string; snippet?: string; resultType?: 'organic' | 'local_pack' | 'ad' }[];
  notes?: string;
}

export function loadSerpEvidence(dir: string): SerpSnapshot[] {
  if (!existsSync(dir)) return [];
  const snapshots: SerpSnapshot[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    const raw = JSON.parse(readFileSync(join(dir, file), 'utf8')) as RawSerpEvidenceFile;
    const results: SerpResultItem[] = raw.results.map((r) => {
      const base: SerpResultItem = {
        position: r.position,
        resultType: r.resultType ?? 'organic',
        url: r.url,
        domain: r.url ? hostOf(r.url) : undefined,
        title: r.title,
        snippet: r.snippet,
      };
      return { ...base, ...classifyResult(base, raw.query) };
    });
    snapshots.push({
      query: raw.query,
      engine: 'web',
      device: 'desktop',
      geoParams: { location: raw.location ?? null },
      provider: raw.provider,
      observedAt: raw.observedAt,
      results,
      evidenceChecksum: evidenceChecksum(raw.provider, 'serp', { query: raw.query, location: raw.location }, raw.results),
      costUsd: 0,
    });
  }
  return snapshots;
}
