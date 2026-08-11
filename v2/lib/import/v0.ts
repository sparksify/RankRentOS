/**
 * V0 dataset parsers — pure functions turning the tracked V0 JSON files into
 * V2 import rows with honest provenance.
 *
 * PROVENANCE RULES (approved Phase-2 requirement):
 *  - every imported observation is `legacy: true` — it can seed research and
 *    provide fallback context but is ALWAYS superseded by any independently
 *    collected V2 observation (see convex/observations.ts pickLatest)
 *  - evidence types: V0 hand-curated niche economics → HUMAN_ASSUMED with an
 *    explicit "requires V2 verification" rationale; V0 API-collected
 *    volume/CPC → OBSERVED; V0 screening conclusions → DERIVED prior
 *    hypotheses (v0.prior.*), never funnel qualification
 *  - timestamps are NOT fabricated: observedAt is the git commit time of the
 *    source file (an upper bound on collection time, stated in the source
 *    string), except trends.json which carries its own builtAt
 *  - designed so recovered MacBook datasets (out/, data/cache/) can be added
 *    later as additional parsers without redesign
 */
import type { EvidenceType } from "../evidence/types";

/** Git commit timestamps of the V0 data files (verified via `git log`). */
export const V0_FILE_TIMESTAMPS = {
  /** niches.json, cities.json, volumes.json, trends.json @ 2298cba */
  curated: new Date("2026-08-03T19:07:01-05:00").getTime(),
  /** cities-national.json, volumes-national.json, national-survivors.json @ 60c3662 */
  national: new Date("2026-08-10T08:31:35-05:00").getTime(),
} as const;

const VERIFY_NOTE =
  "V0 seed assumption (legacy, unverified) — requires independent V2 verification before selection-grade use";

export interface ImportObservation {
  metric: string;
  value: number | string;
  rawValue?: number | string;
  source: string;
  sourceUrl?: string;
  evidenceType: EvidenceType;
  confidence: number;
  observedAt: number;
  rationale?: string;
  legacy: true;
}

export interface ServiceRow {
  name: string;
  slug: string;
  synonyms: string[];
  queryPhrase?: string;
  acPhrase?: string;
  domainTerms?: string[];
  category?: string;
  observations: ImportObservation[];
}

export interface GeographyRow {
  kind: "city";
  name: string;
  state: string;
  slug: string;
  region?: string;
  observations: ImportObservation[];
}

export interface MarketObservationRow {
  serviceSlug: string;
  geographySlug: string;
  primaryKeyword: string;
  observations: ImportObservation[];
}

export function geoSlug(city: string, state: string): string {
  return `${city}-${state}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

/** Keyword-API name cleanup, preserved from V0 national.js ("San Buenaventura (Ventura)" → "Ventura"). */
export function cleanCityName(city: string): string {
  const paren = city.match(/\(([^)]+)\)/);
  return (paren ? paren[1]! : city).replace(/[^A-Za-z0-9 '\-]/g, "").trim();
}

// ---------- niches.json ----------

export function parseNiches(nichesJson: any[]): ServiceRow[] {
  const at = V0_FILE_TIMESTAMPS.curated;
  const src = "v0:niches.json@2298cba (observedAt = file commit time, upper bound)";
  return nichesJson.map((n) => {
    const obs: ImportObservation[] = [];
    const human = (metric: string, value: number | string, rawValue?: number | string): ImportObservation => ({
      metric,
      value,
      rawValue,
      source: src,
      evidenceType: "HUMAN_ASSUMED",
      confidence: 0.3,
      observedAt: at,
      rationale: VERIFY_NOTE,
      legacy: true,
    });
    if (typeof n.ticketLow === "number" && typeof n.ticketHigh === "number") {
      obs.push(human("econ.ticket.avg", (n.ticketLow + n.ticketHigh) / 2, `${n.ticketLow}-${n.ticketHigh}`));
    }
    if (typeof n.margin === "number") obs.push(human("econ.margin.gross", n.margin));
    if (typeof n.need === "boolean") obs.push(human("econ.service.needType", n.need ? "need" : "desire"));
    if (typeof n.seasonal === "boolean") obs.push(human("econ.service.seasonal", String(n.seasonal)));
    return {
      name: n.label,
      slug: n.id,
      synonyms: [n.acQuery, n.query].filter(Boolean),
      queryPhrase: n.query,
      acPhrase: n.acQuery,
      domainTerms: n.domainTerms ?? [],
      category: n.archetype,
      observations: obs,
    };
  });
}

// ---------- cities.json / cities-national.json ----------

export function parseCities(
  citiesJson: any[],
  which: "curated" | "national",
): GeographyRow[] {
  const at = V0_FILE_TIMESTAMPS[which];
  const src =
    which === "curated"
      ? "v0:cities.json@2298cba (curated seed; observedAt = file commit time)"
      : "v0:cities-national.json@60c3662 (public-data compilation; observedAt = file commit time)";
  const seen = new Set<string>();
  const rows: GeographyRow[] = [];
  for (const c of citiesJson) {
    const name = which === "national" ? cleanCityName(c.city) : c.city;
    if (!name || name.length <= 2 || !c.state) continue;
    const slug = geoSlug(name, c.state);
    if (seen.has(slug)) continue;
    seen.add(slug);
    const obs: ImportObservation[] = [];
    const assumed = (metric: string, value: number | string): ImportObservation => ({
      metric,
      value,
      source: src,
      evidenceType: "HUMAN_ASSUMED",
      confidence: 0.5,
      observedAt: at,
      rationale: "V0 city seed compiled from public sources (legacy); refresh via Census in V2",
      legacy: true,
    });
    if (typeof c.pop === "number") obs.push(assumed("geo.population", c.pop));
    if (typeof c.income === "number") obs.push(assumed("geo.income.household", c.income));
    if (typeof c.growth === "string") obs.push(assumed("geo.growth.class", c.growth));
    rows.push({ kind: "city", name, state: c.state, slug, region: c.region, observations: obs });
  }
  return rows;
}

// ---------- volumes.json / volumes-national.json ----------

export interface VolumeParseResult {
  rows: MarketObservationRow[];
  skippedKeys: string[]; // unresolvable or ambiguous city names — reported, never guessed
}

/**
 * V0 volume keys are "{acPhrase} {city-lowercase}" with no state. Keys are
 * resolved against the provided city list; ambiguous names (same cleaned
 * name in multiple states) are SKIPPED and reported, not guessed.
 */
export function parseVolumes(
  volumesJson: Record<string, { vol: number; cpc: number | null; competition?: number | string | null }>,
  services: { slug: string; acPhrase?: string }[],
  cities: { name: string; state: string; slug: string }[],
  which: "curated" | "national",
): VolumeParseResult {
  const at = V0_FILE_TIMESTAMPS[which];
  const file = which === "curated" ? "volumes.json@2298cba" : "volumes-national.json@60c3662";
  const src = `v0:${file} (DataForSEO Google Ads; observedAt = file commit time, upper bound)`;

  const byAc = services
    .filter((s) => s.acPhrase)
    .sort((a, b) => b.acPhrase!.length - a.acPhrase!.length); // longest match first
  const cityByLower = new Map<string, { slug: string; states: Set<string> }[]>();
  for (const c of cities) {
    const key = c.name.toLowerCase();
    const list = cityByLower.get(key) ?? [];
    const existing = list.find((e) => e.slug === c.slug);
    if (!existing) list.push({ slug: c.slug, states: new Set([c.state]) });
    cityByLower.set(key, list);
  }

  const rows: MarketObservationRow[] = [];
  const skippedKeys: string[] = [];
  for (const [key, v] of Object.entries(volumesJson)) {
    const svc = byAc.find((s) => key.startsWith(`${s.acPhrase!.toLowerCase()} `));
    if (!svc) {
      skippedKeys.push(key);
      continue;
    }
    const cityPart = key.slice(svc.acPhrase!.length + 1).trim();
    const matches = cityByLower.get(cityPart) ?? [];
    if (matches.length !== 1) {
      skippedKeys.push(key); // ambiguous across states or unknown — do not guess
      continue;
    }
    const obs: ImportObservation[] = [
      {
        metric: "kw.volume.exact",
        value: v.vol,
        source: src,
        evidenceType: "OBSERVED",
        confidence: 0.8,
        observedAt: at,
        legacy: true,
      },
    ];
    if (v.cpc !== null && v.cpc !== undefined) {
      obs.push({ metric: "kw.cpc", value: v.cpc, source: src, evidenceType: "OBSERVED", confidence: 0.8, observedAt: at, legacy: true });
    }
    if (v.competition !== null && v.competition !== undefined) {
      // DataForSEO returns competition as a numeric index OR a HIGH/MEDIUM/LOW
      // label depending on endpoint/era — V0 stored both forms. Route by type.
      obs.push({
        metric: typeof v.competition === "number" ? "kw.competition.index" : "kw.competition.class",
        value: v.competition,
        source: src,
        evidenceType: "OBSERVED",
        confidence: 0.8,
        observedAt: at,
        legacy: true,
      });
    }
    rows.push({
      serviceSlug: svc.slug,
      geographySlug: matches[0]!.slug,
      primaryKeyword: key,
      observations: obs,
    });
  }
  return { rows, skippedKeys };
}

// ---------- national-survivors.json ----------

/**
 * V0's screening CONCLUSIONS — imported as prior hypotheses only. They never
 * advance a V2 funnel stage; V2 must independently re-qualify every market.
 */
export function parseSurvivors(
  survivorsJson: any[],
  services: { slug: string }[],
): VolumeParseResult {
  const at = V0_FILE_TIMESTAMPS.national;
  const src =
    "v0:national-survivors.json@60c3662 (V0 screen: vol>=100 & CPC $0.01-16; prior hypothesis only)";
  const serviceSlugs = new Set(services.map((s) => s.slug));
  const rows: MarketObservationRow[] = [];
  const skippedKeys: string[] = [];
  for (const s of survivorsJson) {
    const name = cleanCityName(s.city);
    if (!serviceSlugs.has(s.nicheId) || !name || !s.state) {
      skippedKeys.push(`${s.nicheId}|${s.city}|${s.state}`);
      continue;
    }
    rows.push({
      serviceSlug: s.nicheId,
      geographySlug: geoSlug(name, s.state),
      primaryKeyword: `${s.niche?.toLowerCase() ?? s.nicheId} ${name.toLowerCase()}`,
      observations: [
        {
          metric: "v0.prior.survivor",
          value: "true",
          rawValue: `vol=${s.vol};cpc=${s.cpc}`,
          source: src,
          evidenceType: "DERIVED",
          confidence: 0.6,
          observedAt: at,
          rationale:
            "Historical V0 screening conclusion, for later V0-vs-V2 comparison; grants no V2 funnel advancement",
          legacy: true,
        },
      ],
    });
  }
  return { rows, skippedKeys };
}

// ---------- trends.json ----------

export function parseTrends(
  trendsJson: { builtAt?: string; stats: Record<string, any> },
  services: { slug: string; acPhrase?: string }[],
): { serviceSlug: string; observations: ImportObservation[] }[] {
  // trends.json carries its own build timestamp — the one V0 file with real internal provenance
  const at = trendsJson.builtAt
    ? new Date(trendsJson.builtAt).getTime()
    : V0_FILE_TIMESTAMPS.curated;
  const src = `v0:trends.json (SerpAPI Google Trends 5y US${trendsJson.builtAt ? `, builtAt=${trendsJson.builtAt}` : "@2298cba commit time"})`;
  const out: { serviceSlug: string; observations: ImportObservation[] }[] = [];
  for (const svc of services) {
    if (!svc.acPhrase) continue;
    const stats = trendsJson.stats[svc.acPhrase];
    if (!stats) continue;
    const obs: ImportObservation[] = [];
    if (typeof stats.weight === "number") {
      obs.push({ metric: "kw.trend.weight", value: stats.weight, source: src, evidenceType: "DERIVED", confidence: 0.7, observedAt: at, legacy: true });
    }
    if (Array.isArray(stats.peakMonths) && stats.peakMonths.length) {
      obs.push({ metric: "kw.seasonality.peakMonths", value: stats.peakMonths.join(","), source: src, evidenceType: "DERIVED", confidence: 0.7, observedAt: at, legacy: true });
    }
    if (obs.length) out.push({ serviceSlug: svc.slug, observations: obs });
  }
  return out;
}
