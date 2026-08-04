// Shared read-model: joins the geo-polymorphic markets to niches and cities in JS
// (markets.geo_id is polymorphic, so PostgREST can't embed it).
import { select } from './db';

export interface Niche { id: string; name: string; slug: string; attrs: Record<string, any> }
export interface City { id: string; name: string; state: string; region: string | null }
export interface MarketRow { id: string; niche_id: string; geo_id: string; research_state: string; freshness_state: string }

export interface MarketView {
  id: string;
  nicheSlug: string;
  nicheName: string;
  city: string;
  state: string;
  region: string | null;
  researchState: string;
}

export async function loadMarketViews(): Promise<Map<string, MarketView>> {
  const [niches, cities, markets] = await Promise.all([
    select<Niche>('rros_niches', 'select=id,name,slug,attrs&limit=200'),
    select<City>('rros_cities', 'select=id,name,state,region&limit=500'),
    select<MarketRow>('rros_markets', 'select=id,niche_id,geo_id,research_state,freshness_state&limit=2000'),
  ]);
  const nicheById = new Map(niches.map((n) => [n.id, n]));
  const cityById = new Map(cities.map((c) => [c.id, c]));
  const out = new Map<string, MarketView>();
  for (const m of markets) {
    const n = nicheById.get(m.niche_id);
    const c = cityById.get(m.geo_id);
    if (!n || !c) continue;
    out.set(m.id, {
      id: m.id,
      nicheSlug: n.slug,
      nicheName: n.name,
      city: c.name,
      state: c.state,
      region: c.region,
      researchState: m.research_state,
    });
  }
  return out;
}

export function fmtMoney(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return `$${Number(n).toLocaleString()}`;
}

export function scoreBand(score: number): { label: string; cls: string } {
  if (score >= 80) return { label: 'Strong build', cls: 'text-emerald-400' };
  if (score >= 70) return { label: 'Build w/ caveats', cls: 'text-emerald-300' };
  if (score >= 60) return { label: 'Watchlist', cls: 'text-amber-300' };
  return { label: 'Reject', cls: 'text-rose-400' };
}
