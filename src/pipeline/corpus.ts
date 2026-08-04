// Loads the v0 corpus (repo data files) into typed working structures.
// This is the read side used by every pipeline stage; the write side
// (ingest-v0 script) turns the same data into canonical rows + evidence.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { NicheAttrs } from '../core/types.js';

export const ROOT = process.cwd();

// v0 data was committed 2026-08-03; DataForSEO volumes were fetched shortly
// before. This is the observation date applied to imported keyword facts.
export const V0_OBSERVED_AT = '2026-08-03T00:00:00Z';

export interface V0Niche {
  id: string; label: string; query: string; acQuery: string; domainTerms: string[];
  ticketLow: number; ticketHigh: number; margin: number; seasonal: boolean;
  peRisk: 'low' | 'medium' | 'high'; archetype: string; need: boolean;
}
export interface V0City {
  city: string; state: string; pop: number; income: number; growth: string; region: string;
}
export interface V0Volume { vol: number; cpc: number | null; competition: number | null }
export interface V0Trends {
  geo: string; builtAt: string;
  stats: Record<string, { mean: number; peakMean: number; peakMonths: string[]; weight: number; weightPeak: number }>;
}

export interface Corpus {
  niches: V0Niche[];
  cities: V0City[];
  volumes: Record<string, V0Volume>;
  trends: V0Trends | null;
}

export function loadCorpus(root: string = ROOT): Corpus {
  const niches = JSON.parse(readFileSync(join(root, 'data', 'niches.json'), 'utf8')) as V0Niche[];
  const cities = JSON.parse(readFileSync(join(root, 'data', 'cities.json'), 'utf8')) as V0City[];
  const volumes = JSON.parse(readFileSync(join(root, 'data', 'volumes.json'), 'utf8')) as Record<string, V0Volume>;
  const trendsPath = join(root, 'data', 'trends.json');
  const trends = existsSync(trendsPath) ? (JSON.parse(readFileSync(trendsPath, 'utf8')) as V0Trends) : null;
  return { niches, cities, volumes, trends };
}

export function nicheAttrs(n: V0Niche): NicheAttrs {
  return {
    query: n.query, acQuery: n.acQuery, domainTerms: n.domainTerms,
    ticketLow: n.ticketLow, ticketHigh: n.ticketHigh, margin: n.margin,
    seasonal: n.seasonal, peRisk: n.peRisk, archetype: n.archetype, need: n.need,
  };
}

export function keywordTerm(n: V0Niche, c: V0City): string {
  return `${n.acQuery} ${c.city.toLowerCase()}`;
}

export function marketKey(nicheSlug: string, city: string, state: string): string {
  return `${nicheSlug}|${city}|${state}`;
}

export function trendWeightFor(corpus: Corpus, n: V0Niche): number | null {
  const stats = corpus.trends?.stats?.[n.acQuery];
  if (!stats) return null;
  return n.seasonal ? stats.weightPeak : stats.weight;
}
