// A–I Scoring v1 — deterministic pure functions over evidence.
// No LLM computes any number here. Thresholds derived from the Experiment 1/1.5
// observed distributions (see docs/SCORING_V1.md), versioned + configurable.
export const MODEL_VERSION = "ai-v1.0.0";

export type EvidenceType = "OBSERVED" | "DERIVED" | "AI_ESTIMATED" | "HUMAN_ASSUMED";
export interface DimResult {
  score: number | null;            // null = required evidence missing; never guessed
  confidence: number;              // 0..1 evidence quality for THIS dimension
  contributingMetrics: string[];
  missingMetrics: string[];
  evidenceTypes: EvidenceType[];
  rationale: string[];
  version: string;
  prospective?: boolean;           // G: proxy, not measured history
  assumptionDependent?: boolean;   // D/F: HUMAN_ASSUMED inputs present
}
export interface Ev {                       // evidence bundle for one opportunity
  vol?: number | null; cpc?: number | null;
  universeVolume?: number | null; universeGeoScoped?: boolean; universeCorePct?: number | null;
  acFloor?: number | null;
  dirs?: number | null; inner?: number | null; intentMismatch?: number | null; outOfTown?: number | null;
  franchise?: number | null; titleTargeting?: number | null; ads?: number | null;
  mapCount?: number | null; mapReviews?: number | null; mapNoWebsite?: number | null;
  contentWords?: number | null; domainAge?: number | null;
  opRelevant?: number | null; opViable?: number | null; opStrong?: number | null;
  opMedReviews?: number | null; opWebPct?: number | null; opAdvertisers?: number | null;
  opConcentration?: string | null; opMultiSource?: number | null;
  ticketAvg?: number | null; margin?: number | null;   // HUMAN_ASSUMED
  domainAvailable?: boolean | null;
  freshnessDays?: number | null;
}
export const BENCH_CLOSE = 0.10;   // benchmark close rate (HUMAN_ASSUMED, single source of truth)
export const BENCH_CTR = 0.25, BENCH_CONTACT = 0.12;
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const has = (v: unknown): v is number => typeof v === "number" && !Number.isNaN(v);

// ---------- A. RANKABILITY (fresh SERP evidence) ----------
export const V_A = "A-1.0.0";
export function rankability(e: Ev): DimResult {
  const c: string[] = [], m: string[] = [], r: string[] = [];
  if (!has(e.dirs) && !has(e.inner) && !has(e.mapCount)) {
    return { score: null, confidence: 0, contributingMetrics: [], missingMetrics: ["serp.*"], evidenceTypes: [], rationale: ["no SERP evidence — cannot assess"], version: V_A };
  }
  let s = 40; // neutral base: an ordinary contestable SERP
  if (has(e.dirs)) { c.push("serp.directory.count"); if (e.dirs! > 0) { s += 14 * Math.min(e.dirs!, 2); r.push(`${e.dirs} directory result(s) in top 3 — Google lacks a strong local answer`); } }
  if (has(e.inner)) { c.push("serp.innerpage.count"); if (e.inner! >= 4) { s += 10; r.push(`${e.inner}/5 results are inner pages, not dedicated local sites`); } else if (e.inner! <= 1) { s -= 8; r.push("top results are purpose-built homepages"); } }
  if (has(e.intentMismatch) && e.intentMismatch! > 0) { c.push("serp.intentmismatch.count"); s += 8; r.push("retail/info pages ranking for service intent"); }
  if (has(e.outOfTown) && e.outOfTown! > 0) { c.push("serp.outoftown.count"); s += 6; r.push("out-of-town service-area pages rank — no local specialist"); }
  if (has(e.titleTargeting) && e.titleTargeting! > 0) { c.push("serp.titletargeting.count"); s += 4 * Math.min(e.titleTargeting!, 2); r.push("top titles omit the target city"); }
  if (has(e.franchise) && e.franchise! > 0) { c.push("serp.franchise.count"); s -= 12 * Math.min(e.franchise!, 2); r.push(`${e.franchise} brand-search franchise(s) in top 3`); }
  // map pack: thresholds from observed p25=22 / p50=53 / p75=111
  if (has(e.mapCount)) {
    c.push("serp.mappack.count");
    if (e.mapCount === 0) { s -= 6; r.push("no map pack rendered (often thin local demand)"); }
    else if (has(e.mapReviews)) {
      c.push("serp.mappack.avgreviews");
      if (e.mapReviews! < 25) { s += 16; r.push(`map pack averages only ${e.mapReviews} reviews — weak incumbents`); }
      else if (e.mapReviews! < 60) { s += 8; r.push(`map pack averages ${e.mapReviews} reviews — contestable`); }
      else if (e.mapReviews! > 400) { s -= 18; r.push(`map pack averages ${e.mapReviews} reviews — entrenched incumbents`); }
      else if (e.mapReviews! > 120) { s -= 8; r.push(`map pack averages ${e.mapReviews} reviews — established`); }
    } else m.push("serp.mappack.avgreviews");
  } else m.push("serp.mappack.count");
  if (has(e.mapNoWebsite) && e.mapNoWebsite! > 0) { c.push("serp.mappack.nowebsite.count"); s += 4; r.push("map listings without websites"); }
  // content depth: observed p25=787 p50=1141 p75=1783
  if (has(e.contentWords)) {
    c.push("serp.competitor.contentdepth");
    if (e.contentWords! < 400) { s += 14; r.push(`competitor pages average only ${e.contentWords} words`); }
    else if (e.contentWords! < 900) { s += 7; r.push(`competitor content is modest (${e.contentWords} words)`); }
    else if (e.contentWords! > 2000) { s -= 10; r.push(`competitors average ${e.contentWords} words — deep content`); }
  } else m.push("serp.competitor.contentdepth");
  // domain age: age alone never decides (explicit requirement)
  if (has(e.domainAge)) {
    c.push("serp.competitor.domainage");
    if (e.domainAge! < 5) { s += 6; r.push(`incumbent domains young (${e.domainAge}y)`); }
    else if (e.domainAge! > 20) { s -= 5; r.push(`incumbent domains long-established (${e.domainAge}y) — one factor among many`); }
  } else m.push("serp.competitor.domainage");
  const conf = Math.min(1, c.length / 8);
  return { score: clamp(s), confidence: conf, contributingMetrics: c, missingMetrics: m, evidenceTypes: ["DERIVED"], rationale: r, version: V_A };
}

// ---------- B. DEMAND (measured only; autocomplete never becomes volume) ----------
export const V_B = "B-1.0.0";
export function demand(e: Ev): DimResult {
  const c: string[] = [], m: string[] = [], r: string[] = [];
  if (!has(e.vol)) { m.push("kw.volume.exact"); return { score: null, confidence: 0, contributingMetrics: [], missingMetrics: m, evidenceTypes: [], rationale: ["no measured volume — cannot score demand"], version: V_B }; }
  c.push("kw.volume.exact");
  const v = e.vol!;
  // bands from observed distribution (p50=0, p75=480, max=2400)
  let s = v >= 1000 ? 92 : v >= 480 ? 78 : v >= 200 ? 62 : v >= 100 ? 48 : v >= 30 ? 30 : v > 0 ? 18 : 4;
  r.push(v > 0 ? `${v} measured searches/mo (exact term)` : "zero measured search volume for the exact term");
  let conf = 0.6;
  if (e.universeGeoScoped && has(e.universeVolume)) {
    c.push("kw.universe.volume"); conf += 0.3;
    if (e.universeVolume! > v * 1.5) { s = Math.min(100, s + 8); r.push(`geo-scoped universe adds ${e.universeVolume! - v} searches/mo beyond the core term`); }
  } else { m.push("kw.universe.volume (geo-scoped)"); r.push("no valid geo-scoped keyword universe — demand rests on the exact term alone"); }
  if (has(e.acFloor)) {
    c.push("kw.autocomplete.floor"); conf += 0.1;
    // evidence of query existence ONLY — never added as volume
    if (v === 0 && e.acFloor! >= 0.8) r.push(`autocomplete recognizes the query (floor ${e.acFloor}) but no measured volume exists — recognition is not demand`);
  }
  return { score: clamp(s), confidence: Math.min(conf, 1), contributingMetrics: c, missingMetrics: m, evidenceTypes: ["OBSERVED", "DERIVED"], rationale: r, version: V_B };
}

// ---------- C. COMMERCIAL INTENT ----------
export const V_C = "C-1.0.0";
export function commercialIntent(e: Ev): DimResult {
  const c: string[] = [], m: string[] = [], r: string[] = [];
  let s: number | null = null, conf = 0;
  if (has(e.cpc)) {
    c.push("kw.cpc"); conf += 0.6;
    // observed CPC p25=6.33 p50=9.75 p75=11.66; high CPC != good R&R economics
    s = e.cpc! >= 10 ? 82 : e.cpc! >= 5 ? 72 : e.cpc! >= 2 ? 58 : 35;
    r.push(`advertisers pay $${e.cpc}/click — money is being spent to acquire this customer`);
    if (e.cpc! > 14) r.push("very high CPC also signals an expensive, crowded acquisition market");
  } else m.push("kw.cpc");
  if (has(e.ads)) {
    c.push("serp.ads.count"); conf += 0.25;
    if (e.ads! > 0) { s = (s ?? 45) + 8; r.push(`${e.ads} paid ad(s) present — live advertiser demand`); }
    else if (s === null) { s = 30; r.push("no ads observed and no CPC evidence"); }
    else r.push("no ads on this SERP");
  } else m.push("serp.ads.count");
  if (has(e.opAdvertisers) && e.opAdvertisers! > 0) { c.push("op.count.advertiser"); conf += 0.15; s = (s ?? 45) + 5; r.push(`${e.opAdvertisers} operator(s) observed advertising`); }
  if (s === null) return { score: null, confidence: 0, contributingMetrics: c, missingMetrics: m, evidenceTypes: [], rationale: ["no commercial-intent evidence"], version: V_C };
  return { score: clamp(s), confidence: Math.min(conf, 1), contributingMetrics: c, missingMetrics: m, evidenceTypes: ["OBSERVED", "DERIVED"], rationale: r, version: V_C };
}

// ---------- D. LEAD ECONOMICS (assumption-dependent by design in v1) ----------
export const V_D = "D-1.1.0"; // per-lead value (was per-job); see D/F dependency audit
export function leadEconomics(e: Ev): DimResult {
  const c: string[] = [], m: string[] = ["econ.cpl.live", "econ.close.rate.live", "econ.leadrate.live"], r: string[] = [];
  const et: EvidenceType[] = [];
  if (!has(e.ticketAvg) || !has(e.margin)) {
    return { score: null, confidence: 0, contributingMetrics: c, missingMetrics: [...m, "econ.ticket.avg", "econ.margin.gross"], evidenceTypes: et, rationale: ["no service economics available"], version: V_D, assumptionDependent: true };
  }
  c.push("econ.ticket.avg", "econ.margin.gross"); et.push("HUMAN_ASSUMED");
  // D = value of ONE LEAD (job gross profit x benchmark close rate). Per-lead is the
  // unit live CPL/close-rate evidence will replace directly. F consumes this value
  // rather than re-deriving ticket x margin (dependency audit: no double-derivation).
  const gpJob = e.ticketAvg! * e.margin!;
  const leadValue = gpJob * BENCH_CLOSE;
  let s = leadValue >= 800 ? 90 : leadValue >= 300 ? 78 : leadValue >= 120 ? 64 : leadValue >= 50 ? 48 : leadValue >= 20 ? 32 : 18;
  r.push(`~$${Math.round(leadValue)} value per lead ($${Math.round(gpJob)} job gross profit x ${BENCH_CLOSE} benchmark close rate; HUMAN_ASSUMED)`);
  let conf = 0.25;                        // assumption-dependent -> low confidence by construction
  if (has(e.cpc)) { c.push("kw.cpc"); et.push("OBSERVED"); conf += 0.15; r.push(`CPC $${e.cpc} provides an observed market anchor for lead cost`); }
  r.push("NO live CPL / close-rate evidence — replace when assets produce data");
  return { score: clamp(s), confidence: conf, contributingMetrics: c, missingMetrics: m, evidenceTypes: et, rationale: r, version: V_D, assumptionDependent: true };
}

// ---------- E. RENTER DEPTH (operator intelligence) ----------
export const V_E = "E-1.0.0";
export function renterDepth(e: Ev): DimResult {
  const c: string[] = [], m: string[] = [], r: string[] = [];
  if (!has(e.opRelevant)) { m.push("op.count.relevant"); return { score: null, confidence: 0, contributingMetrics: c, missingMetrics: m, evidenceTypes: [], rationale: ["no operator evidence"], version: V_E }; }
  c.push("op.count.relevant");
  // raw count is NOT liquidity: viable/stronger operators carry the weight
  let s = 20; const rel = e.opRelevant!;
  r.push(`${rel} businesses observed serving this market`);
  if (has(e.opViable)) { c.push("op.count.viable"); s += e.opViable! * 12; r.push(`${e.opViable} viable renter(s) (website + ≥5 reviews)`); if (e.opViable! === 0) r.push("NO viable renter identified — lead flow may have no credible buyer"); } else m.push("op.count.viable");
  if (has(e.opStrong)) { c.push("op.count.stronger"); s += e.opStrong! * 8; if (e.opStrong! > 0) r.push(`${e.opStrong} stronger operator(s) (≥50 reviews, ≥4.0★)`); } else m.push("op.count.stronger");
  if (has(e.opMedReviews)) { c.push("op.reviews.median"); if (e.opMedReviews! >= 100) { s += 6; r.push(`median ${e.opMedReviews} reviews — mature businesses that can pay`); } else if (e.opMedReviews! < 15) { s -= 6; r.push(`median only ${e.opMedReviews} reviews — immature market`); } } else m.push("op.reviews.median");
  if (has(e.opWebPct)) { c.push("op.website.adoptionpct"); if (e.opWebPct! >= 30) s += 5; else if (e.opWebPct! < 15) { s -= 5; r.push(`only ${e.opWebPct}% of operators have websites`); } }
  if (has(e.opMultiSource) && e.opMultiSource! > 0) { c.push("op.count.multisource"); s += 4; r.push(`${e.opMultiSource} operator(s) confirmed by multiple evidence sources`); }
  if (e.opConcentration) {
    c.push("op.concentration.class");
    if (e.opConcentration === "concentrated") { s -= 8; r.push("concentrated market — one dominant operator reduces renter competition"); }
    else if (e.opConcentration === "fragmented") { s += 6; r.push("fragmented market — many comparable potential renters"); }
    else if (e.opConcentration === "insufficient-evidence") { s -= 4; r.push("insufficient evidence to judge concentration"); }
  }
  return { score: clamp(s), confidence: Math.min(c.length / 6, 1), contributingMetrics: c, missingMetrics: m, evidenceTypes: ["DERIVED"], rationale: r, version: V_E };
}

// ---------- F. ASSET VALUE (value of owning the lead flow; not a copy of D/E) ----------
export const V_F = "F-1.1.0"; // consumes D per-lead value; no independent re-derivation
export function assetValue(e: Ev, d: DimResult, b: DimResult, en: DimResult): DimResult {
  const c: string[] = [], m: string[] = [], r: string[] = [];
  if (b.score === null || d.score === null) {
    return { score: null, confidence: 0, contributingMetrics: c, missingMetrics: ["demand or economics"], evidenceTypes: [], rationale: ["cannot value an asset without demand and economics"], version: V_F, assumptionDependent: true };
  }
  // realizable monthly gross profit the asset could route: demand x economics x renter capacity
  // F = SCALE of realizable flow = measured leads/mo x D's per-lead value.
  // ticket x margin enters ONLY through D (audited: single derivation path).
  const leads = (e.vol ?? 0) * BENCH_CTR * BENCH_CONTACT;
  const leadValue = (e.ticketAvg ?? 0) * (e.margin ?? 0) * BENCH_CLOSE; // == D's basis
  const monthlyGp = leads * leadValue;
  c.push("kw.volume.exact", "D.leadEconomics");
  let s = monthlyGp >= 20000 ? 92 : monthlyGp >= 8000 ? 80 : monthlyGp >= 3000 ? 66 : monthlyGp >= 1000 ? 50 : monthlyGp >= 300 ? 34 : monthlyGp > 0 ? 20 : 8;
  r.push(`~$${Math.round(monthlyGp)}/mo renter gross profit at benchmark funnel rates (HUMAN_ASSUMED)`);
  if (en.score !== null) { c.push("op.count.viable"); if ((e.opViable ?? 0) === 0) { s -= 15; r.push("no viable renter → realizable value discounted"); } }
  if (monthlyGp === 0 && (e.vol ?? 0) === 0) r.push("zero measured demand → no realizable lead flow to own");
  return { score: clamp(s), confidence: Math.min(0.35 + (b.confidence * 0.3), 0.75), contributingMetrics: c, missingMetrics: m, evidenceTypes: ["OBSERVED", "HUMAN_ASSUMED"], rationale: r, version: V_F, assumptionDependent: true };
}

// ---------- G. SPEED — PROSPECTIVE time-to-signal (proxy, never measured) ----------
export const V_G = "G-1.0.0";
export function speedProspective(e: Ev, a: DimResult): DimResult {
  const c: string[] = [], m: string[] = ["asset.indexed.days", "asset.firstimpression.days", "asset.firstrank.days"], r: string[] = [];
  if (a.score === null) return { score: null, confidence: 0, contributingMetrics: c, missingMetrics: m, evidenceTypes: [], rationale: ["no rankability evidence"], version: V_G, prospective: true };
  let s = a.score * 0.7; c.push("A.rankability");
  r.push("PROSPECTIVE proxy — no V2 asset performance history exists yet");
  if (has(e.contentWords) && e.contentWords! < 500) { s += 10; c.push("serp.competitor.contentdepth"); r.push("thin competitor content shortens the expected content gap"); }
  if (has(e.mapReviews) && e.mapReviews! > 400) { s -= 10; c.push("serp.mappack.avgreviews"); r.push("entrenched map incumbents lengthen expected time-to-signal"); }
  if (e.domainAvailable) { s += 5; c.push("domain.exactMatch.available"); r.push("exact-match domain available"); }
  return { score: clamp(s), confidence: 0.35, contributingMetrics: c, missingMetrics: m, evidenceTypes: ["DERIVED"], rationale: r, version: V_G, prospective: true };
}

// ---------- H. ASYMMETRY (rewards unusual combinations, not an average) ----------
export const V_H = "H-1.0.0";
export function asymmetry(e: Ev, dims: { a: DimResult; b: DimResult; c: DimResult; d: DimResult; e: DimResult; f: DimResult }): DimResult {
  const contributing: string[] = [], r: string[] = [];
  const { a, b, f, e: en } = dims;
  if (a.score === null || b.score === null) return { score: null, confidence: 0, contributingMetrics: [], missingMetrics: ["A or B"], evidenceTypes: [], rationale: ["insufficient evidence for asymmetry"], version: V_H };
  // Upside: realizable value. Downside: cost/difficulty of the experiment.
  const upside = Math.max(f.score ?? 0, (dims.d.score ?? 0) * 0.7);
  const easeOfEntry = a.score;                       // weak SERP = cheap entry
  let s = 0;
  // core asymmetry: high upside AND low resistance (multiplicative, not averaged)
  s = 100 * Math.pow(upside / 100, 0.55) * Math.pow(easeOfEntry / 100, 0.45);
  contributing.push("F.assetValue", "A.rankability");
  r.push(`upside ${Math.round(upside)} vs entry resistance ${100 - easeOfEntry}`);
  // BONUSES for unusual combinations
  if (a.score >= 65 && (f.score ?? 0) >= 60) { s += 12; r.push("RARE: weak SERP alongside strong realizable value"); }
  if (e.domainAvailable && a.score >= 60) { s += 5; r.push("exact-match domain still open in a weak SERP"); }
  if ((e.opViable ?? 0) >= 2 && a.score >= 55) { s += 5; r.push("multiple viable renters in a beatable market"); }
  // PENALTIES: no upside or no buyer = no asymmetry regardless of ease
  if ((e.vol ?? 0) === 0) { s *= 0.35; r.push("zero measured demand collapses the upside case"); }
  if ((e.opViable ?? 0) === 0) { s *= 0.7; r.push("no viable renter identified"); }
  return { score: clamp(s), confidence: Math.min((a.confidence + b.confidence) / 2, 0.8), contributingMetrics: contributing, missingMetrics: [], evidenceTypes: ["DERIVED"], rationale: r, version: V_H };
}

// ---------- I. CONFIDENCE (evidence quality — NOT an opportunity-quality score) ----------
export const V_I = "I-1.0.0";
export function confidence(e: Ev, dims: DimResult[]): DimResult {
  const c: string[] = [], r: string[] = [];
  const scored = dims.filter((d) => d.score !== null);
  const completeness = scored.length / dims.length;
  let s = 100 * completeness * 0.5;
  r.push(`${scored.length}/${dims.length} dimensions scoreable (${Math.round(completeness * 100)}% completeness)`);
  const observedCount = dims.filter((d) => d.evidenceTypes.includes("OBSERVED")).length;
  s += observedCount * 6; if (observedCount) r.push(`${observedCount} dimension(s) rest on OBSERVED evidence`);
  const assumed = dims.filter((d) => d.assumptionDependent).length;
  s -= assumed * 7; if (assumed) r.push(`${assumed} dimension(s) depend on HUMAN_ASSUMED economics`);
  if (has(e.freshnessDays)) { c.push("freshness"); if (e.freshnessDays! <= 7) { s += 8; r.push("evidence collected within the last week"); } else if (e.freshnessDays! > 60) { s -= 10; r.push(`evidence is ${e.freshnessDays} days old`); } }
  const sources = [e.vol != null, e.cpc != null, e.mapCount != null, e.opRelevant != null, e.acFloor != null].filter(Boolean).length;
  s += sources * 3; r.push(`${sources} independent evidence sources`);
  if ((e.vol ?? null) === 0 && (e.acFloor ?? 0) >= 0.8) { s -= 5; r.push("CONTRADICTION: autocomplete recognizes the query but keyword tools measure zero volume"); }
  r.push("confidence reflects evidence quality only — a poor opportunity can score high here");
  return { score: clamp(s), confidence: 1, contributingMetrics: c, missingMetrics: [], evidenceTypes: ["DERIVED"], rationale: r, version: V_I };
}
