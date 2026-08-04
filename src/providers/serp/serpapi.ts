// SerpAPI adapter — live localized Google SERPs. Requires SERPAPI_KEY.
// This is the v0 provider, ported. Cost ~$0.015/search on the developer plan.
import type { SerpProvider } from '../types.js';
import type { SerpResultItem, SerpSnapshot } from '../../core/types.js';
import { evidenceChecksum } from '../../core/hash.js';
import { classifyResult, hostOf } from '../../pipeline/serp-signals.js';

export class SerpApiProvider implements SerpProvider {
  readonly name = 'serpapi';
  constructor(private apiKey: string) {}

  async fetchSerp(query: string, location: string): Promise<SerpSnapshot> {
    const params = new URLSearchParams({
      engine: 'google', q: query, location, hl: 'en', gl: 'us', num: '10', api_key: this.apiKey,
    });
    const res = await fetch(`https://serpapi.com/search.json?${params}`);
    if (!res.ok) throw new Error(`SerpAPI ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as Record<string, any>;
    if (data.error) throw new Error(`SerpAPI error: ${data.error}`);

    const observedAt = new Date().toISOString();
    const results: SerpResultItem[] = [];
    for (const r of data.organic_results ?? []) {
      const item: SerpResultItem = {
        position: r.position, resultType: 'organic', url: r.link,
        domain: hostOf(r.link), title: r.title, snippet: r.snippet,
      };
      results.push({ ...item, ...classifyResult(item, query) });
    }
    for (const [i, p] of (data.local_results?.places ?? []).entries()) {
      results.push({ position: i + 1, resultType: 'local_pack', title: p.title, url: p.links?.website ?? undefined, domain: p.links?.website ? hostOf(p.links.website) : undefined });
    }
    for (const [i, a] of (data.ads ?? []).entries()) {
      results.push({ position: i + 1, resultType: 'ad', title: a.title, url: a.link, domain: hostOf(a.link) });
    }
    return {
      query, engine: 'google', device: 'desktop',
      geoParams: { location }, provider: this.name, observedAt, results,
      evidenceChecksum: evidenceChecksum(this.name, 'serp', { query, location }, data),
      costUsd: 0.015,
    };
  }
}
