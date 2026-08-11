/**
 * SerpAPI client — pure request-building and response-parsing. HTTP happens
 * in Convex actions via injected fetch; everything here is unit-testable
 * against fixtures.
 */
import type { TrimmedSerp } from "../serp/signals";

const BASE = "https://serpapi.com/search.json";

export function serpUrl(query: string, location: string, apiKey: string): string {
  const params = new URLSearchParams({
    engine: "google",
    q: query,
    location,
    hl: "en",
    gl: "us",
    num: "10",
    api_key: apiKey,
  });
  return `${BASE}?${params}`;
}

export function autocompleteUrl(typed: string, apiKey: string): string {
  const params = new URLSearchParams({
    engine: "google_autocomplete",
    q: typed,
    gl: "us",
    hl: "en",
    api_key: apiKey,
  });
  return `${BASE}?${params}`;
}

export function trendsUrl(terms: string[], apiKey: string, geo = "US"): string {
  const params = new URLSearchParams({
    engine: "google_trends",
    q: terms.join(","),
    geo,
    date: "today 5-y",
    data_type: "TIMESERIES",
    api_key: apiKey,
  });
  return `${BASE}?${params}`;
}

/** Trim a raw SerpAPI Google payload to the evidence we persist. */
export function parseSerpResponse(raw: any): TrimmedSerp {
  if (raw?.error) throw new Error(`SerpAPI error: ${raw.error}`);
  return {
    organic: (raw?.organic_results ?? []).map((r: any) => ({
      position: r.position,
      title: r.title,
      link: r.link,
      snippet: r.snippet,
    })),
    localPack: (raw?.local_results?.places ?? []).map((p: any) => ({
      name: p.title,
      rating: p.rating,
      reviews: p.reviews,
      website: p.links?.website ?? undefined,
      type: p.type,
    })),
    ads: (raw?.ads ?? []).map((a: any) => ({
      title: a.title,
      link: a.link,
      displayedLink: a.displayed_link,
    })),
  };
}

export interface AutocompleteResult {
  typed: string;
  suggestions: string[];
  cityHit: boolean;
  /** 1.0 exact city pair suggested; 0.8 niche typed but not this city; 0.6 dead air. */
  floor: number;
}

/** V0's autocomplete demand-floor semantics, preserved. */
export function parseAutocompleteResponse(
  raw: any,
  typed: string,
  city: string,
): AutocompleteResult {
  if (raw?.error) throw new Error(`SerpAPI error: ${raw.error}`);
  const suggestions: string[] = (raw?.suggestions ?? []).map(
    (s: any) => s.value?.toLowerCase() ?? "",
  );
  const cityHit = suggestions.some((s) => s.includes(city.toLowerCase()));
  const floor = cityHit ? 1.0 : suggestions.length > 0 ? 0.8 : 0.6;
  return { typed, suggestions, cityHit, floor };
}

export interface TrendsSeriesStats {
  mean: number;
  peakMean: number;
  peakMonths: string[];
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/** Per-term stats from one Trends timeline (V0 logic preserved). */
export function trendsSeriesStats(
  timeline: any[],
  termIndex: number,
): TrendsSeriesStats {
  const monthly: Record<number, number[]> = {};
  let sum = 0;
  let n = 0;
  for (const point of timeline) {
    const v = point.values?.[termIndex]?.extracted_value ?? 0;
    sum += v;
    n++;
    const m = new Date(point.timestamp * 1000).getMonth();
    (monthly[m] = monthly[m] ?? []).push(v);
  }
  const mean = n ? sum / n : 0;
  const monthMeans = Object.entries(monthly)
    .map(([m, vs]) => [Number(m), vs.reduce((a, b) => a + b, 0) / vs.length] as const)
    .sort((a, b) => b[1] - a[1]);
  const top3 = monthMeans.slice(0, 3);
  const peakMean =
    top3.reduce((a, [, v]) => a + v, 0) / Math.max(top3.length, 1);
  return {
    mean: Math.round(mean * 10) / 10,
    peakMean: Math.round(peakMean * 10) / 10,
    peakMonths: top3.map(([m]) => MONTHS[m]!),
  };
}
