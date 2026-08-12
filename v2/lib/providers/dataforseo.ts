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
  /**
   * Measured monthly volume, or null when the provider has no data.
   * UNKNOWN IS NOT ZERO. Google Ads returns search_volume: null for keywords it
   * cannot measure; treating that as 0 fabricates a confident "no demand" and
   * silently rejects live markets. Only `vol === 0` means observed-zero demand.
   */
  vol: number | null;
  cpc: number | null;
  /** Numeric index or HIGH/MEDIUM/LOW label, per DataForSEO's mood. */
  competition: number | string | null;
  /** How to read `vol`: measured (incl. observed zero), null-from-provider, or never returned. */
  state: "measured" | "unknown-null" | "unknown-omitted";
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
    const measured = typeof r.search_volume === "number";
    byKeyword.set(r.keyword, {
      keyword: r.keyword,
      vol: measured ? r.search_volume : null,
      cpc: typeof r.cpc === "number" ? r.cpc : null,
      competition: r.competition ?? null,
      state: measured ? "measured" : "unknown-null",
    });
  }
  // Keywords the API never returned are gaps, not zeros. They must be carried
  // as UNKNOWN so downstream stages can re-research them instead of rejecting them.
  return requestedKeywords.map(
    (k) =>
      byKeyword.get(k) ?? {
        keyword: k,
        vol: null,
        cpc: null,
        competition: null,
        state: "unknown-omitted" as const,
      },
  );
}
