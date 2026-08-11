/**
 * DataForSEO client — pure request/parse; HTTP via injected fetch in actions.
 */
export const DFS_VOLUME_URL =
  "https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live";

export function volumeRequest(keywords: string[]): {
  url: string;
  body: string;
} {
  return {
    url: DFS_VOLUME_URL,
    body: JSON.stringify([
      { keywords, location_name: "United States", language_name: "English" },
    ]),
  };
}

export interface KeywordVolume {
  keyword: string;
  vol: number;
  cpc: number | null;
  /** Numeric index or HIGH/MEDIUM/LOW label, per DataForSEO's mood. */
  competition: number | string | null;
}

export function parseVolumeResponse(
  raw: any,
  requestedKeywords: string[],
): KeywordVolume[] {
  const task = raw?.tasks?.[0];
  if (task?.status_code !== 20000) {
    throw new Error(
      `DataForSEO task ${task?.status_code}: ${task?.status_message}`,
    );
  }
  const byKeyword = new Map<string, KeywordVolume>();
  for (const r of task.result ?? []) {
    byKeyword.set(r.keyword, {
      keyword: r.keyword,
      vol: r.search_volume ?? 0,
      cpc: r.cpc ?? null,
      competition: r.competition ?? null,
    });
  }
  // Keywords the API omits have no data — record explicit zeros so absence
  // of demand is an observation, not a gap.
  return requestedKeywords.map(
    (k) =>
      byKeyword.get(k) ?? { keyword: k, vol: 0, cpc: null, competition: null },
  );
}
