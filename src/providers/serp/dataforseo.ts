// DataForSEO adapters — keyword volume/CPC (v0-proven) and live SERP.
// Requires DATAFORSEO_AUTH (base64 login:password).
import type { KeywordVolumeProvider, SerpProvider } from '../types.js';
import type { KeywordObservation, SerpResultItem, SerpSnapshot } from '../../core/types.js';
import { evidenceChecksum } from '../../core/hash.js';
import { classifyResult, hostOf } from '../../pipeline/serp-signals.js';

const BASE = 'https://api.dataforseo.com/v3';

async function post(auth: string, path: string, body: unknown): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { authorization: `Basic ${auth}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`DataForSEO ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const task = data.tasks?.[0];
  if (task?.status_code !== 20000) throw new Error(`DataForSEO task ${task?.status_code}: ${task?.status_message}`);
  return task.result ?? [];
}

export class DataForSeoVolumeProvider implements KeywordVolumeProvider {
  readonly name = 'dataforseo';
  constructor(private auth: string) {}

  async fetchVolumes(keywords: string[]): Promise<KeywordObservation[]> {
    const observedAt = new Date().toISOString();
    const out: KeywordObservation[] = [];
    for (let i = 0; i < keywords.length; i += 1000) {
      const chunk = keywords.slice(i, i + 1000);
      const result = await post(this.auth, '/keywords_data/google_ads/search_volume/live', [
        { keywords: chunk, location_name: 'United States', language_name: 'English' },
      ]);
      const byKeyword = new Map<string, any>(result.map((r: any) => [r.keyword, r]));
      for (const kw of chunk) {
        const r = byKeyword.get(kw);
        out.push({
          keywordTerm: kw,
          volume: r?.search_volume ?? 0,
          cpc: r?.cpc ?? null,
          competition: r?.competition ?? null,
          provider: this.name,
          observedAt,
          evidenceChecksum: evidenceChecksum(this.name, 'search_volume', { keyword: kw }, r ?? null),
        });
      }
    }
    return out;
  }
}

export class DataForSeoSerpProvider implements SerpProvider {
  readonly name = 'dataforseo_serp';
  constructor(private auth: string) {}

  async fetchSerp(query: string, location: string): Promise<SerpSnapshot> {
    const result = await post(this.auth, '/serp/google/organic/live/advanced', [
      { keyword: query, location_name: location, language_name: 'English', depth: 10 },
    ]);
    const observedAt = new Date().toISOString();
    const items = result?.[0]?.items ?? [];
    const results: SerpResultItem[] = [];
    for (const item of items) {
      if (item.type === 'organic') {
        const base: SerpResultItem = {
          position: item.rank_group, resultType: 'organic', url: item.url,
          domain: hostOf(item.url), title: item.title, snippet: item.description,
        };
        results.push({ ...base, ...classifyResult(base, query) });
      } else if (item.type === 'local_pack') {
        results.push({ position: item.rank_group, resultType: 'local_pack', title: item.title, domain: item.domain ?? undefined });
      } else if (item.type === 'paid') {
        results.push({ position: item.rank_group, resultType: 'ad', title: item.title, url: item.url, domain: hostOf(item.url) });
      }
    }
    return {
      query, engine: 'google', device: 'desktop', geoParams: { location },
      provider: this.name, observedAt, results,
      evidenceChecksum: evidenceChecksum(this.name, 'serp', { query, location }, items),
      costUsd: 0.002,
    };
  }
}
