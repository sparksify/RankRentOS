// Stage 7 — Top 10 selection. Not the 10 highest raw scores: a portfolio pick
// balancing score, confidence, niche repeatability (one playbook many cities),
// geographic clustering (one operator many assets), learning value, and
// avoiding overconcentration. Produces raw ranking + recommended 10 + alternates,
// each with explicit inclusion reasons.
import { ACTION_THRESHOLDS, SELECTION_VERSION } from '../core/config.js';
import type { LensScore, SelectionEntry } from '../core/types.js';

export interface SelectableMarket {
  marketKey: string;
  nicheSlug: string;
  city: string;
  state: string;
  region: string | null;
  score: LensScore;
  domainAvailable: boolean;
  estRevenueMid: number;
}

export interface SelectionResult {
  version: string;
  rawRanked: { marketKey: string; overall: number; confidence: number }[];
  primaries: SelectionEntry[];
  alternates: SelectionEntry[];
  notes: string[];
}

const MAX_PER_NICHE = 3;
const MAX_PER_REGION = 4;

export function selectBatch(markets: SelectableMarket[], batchSize = 10, alternateCount = 10): SelectionResult {
  const notes: string[] = [];
  const ranked = [...markets].sort((a, b) => b.score.overall - a.score.overall);
  const rawRanked = ranked.map((m) => ({ marketKey: m.marketKey, overall: m.score.overall, confidence: m.score.confidence }));

  // Eligibility for the recommended batch
  const eligible = ranked.filter((m) => {
    if (m.score.overall < ACTION_THRESHOLDS.watchlist) return false;
    if (m.score.confidence < ACTION_THRESHOLDS.minConfidenceForTop10) return false;
    if (!m.domainAvailable) return false;
    return true;
  });
  const ineligibleStrong = ranked.filter((m) => m.score.overall >= ACTION_THRESHOLDS.investigate && !eligible.includes(m));
  if (ineligibleStrong.length) {
    notes.push(
      `${ineligibleStrong.length} high-scoring market(s) excluded from the recommended batch for low confidence or missing domain: ` +
      ineligibleStrong.slice(0, 5).map((m) => `${m.marketKey} (score ${m.score.overall}, conf ${m.score.confidence})`).join('; ')
    );
  }

  const primaries: SelectionEntry[] = [];
  const nicheCount = new Map<string, number>();
  const regionCount = new Map<string, number>();
  const nichesInPool = new Map<string, number>();
  for (const m of eligible) nichesInPool.set(m.nicheSlug, (nichesInPool.get(m.nicheSlug) ?? 0) + 1);

  const pick = (m: SelectableMarket, reasons: string[]) => {
    primaries.push({
      marketKey: m.marketKey, rank: rawRanked.findIndex((r) => r.marketKey === m.marketKey) + 1,
      role: 'primary', position: primaries.length + 1, inclusionReasons: reasons,
    });
    nicheCount.set(m.nicheSlug, (nicheCount.get(m.nicheSlug) ?? 0) + 1);
    const region = m.region ?? `${m.state}`;
    regionCount.set(region, (regionCount.get(region) ?? 0) + 1);
  };

  for (const m of eligible) {
    if (primaries.length >= batchSize) break;
    const region = m.region ?? `${m.state}`;
    const nUsed = nicheCount.get(m.nicheSlug) ?? 0;
    const rUsed = regionCount.get(region) ?? 0;
    const reasons: string[] = [`Score ${m.score.overall} at confidence ${m.score.confidence}`];

    if (nUsed >= MAX_PER_NICHE) {
      notes.push(`${m.marketKey} deferred to alternates: already ${nUsed} ${m.nicheSlug} picks (overconcentration guard)`);
      continue;
    }
    if (rUsed >= MAX_PER_REGION) {
      notes.push(`${m.marketKey} deferred to alternates: already ${rUsed} picks in ${region} (geographic overconcentration guard)`);
      continue;
    }
    if (nUsed > 0) reasons.push(`Repeats ${m.nicheSlug} playbook (pick #${nUsed + 1}) — one-niche-many-cities leverage`);
    if (rUsed > 0) reasons.push(`Clusters in ${region} (pick #${rUsed + 1}) — one-operator-many-assets leverage`);
    if ((nichesInPool.get(m.nicheSlug) ?? 0) >= 3) reasons.push('Niche repeats across the candidate pool — batch-1 learnings stamp out');
    if (m.estRevenueMid >= 1500) reasons.push(`Est. revenue midpoint $${m.estRevenueMid.toLocaleString()}/mo`);
    pick(m, reasons);
  }

  // Learning-diversity pass: if the batch ended up <3 niches, promote the best
  // eligible market of an unused niche over the weakest same-niche duplicate.
  const distinctNiches = new Set(primaries.map((p) => keyNiche(p.marketKey)));
  if (primaries.length === batchSize && distinctNiches.size < 3) {
    const unused = eligible.filter((m) => !distinctNiches.has(m.nicheSlug) && !primaries.some((p) => p.marketKey === m.marketKey));
    const candidate = unused[0];
    if (candidate) {
      const dupIdx = findLastDuplicateNicheIndex(primaries);
      if (dupIdx >= 0) {
        const removed = primaries.splice(dupIdx, 1)[0]!;
        notes.push(`${removed.marketKey} swapped out for ${candidate.marketKey} to widen learning across niches`);
        pick(candidate, [`Score ${candidate.score.overall} at confidence ${candidate.score.confidence}`, 'Included to widen niche learning in Batch 1 (portfolio balance over raw rank)']);
        primaries.forEach((p, i) => (p.position = i + 1));
      }
    }
  }

  const chosen = new Set(primaries.map((p) => p.marketKey));
  const alternates: SelectionEntry[] = [];
  for (const m of ranked) {
    if (alternates.length >= alternateCount) break;
    if (chosen.has(m.marketKey)) continue;
    if (m.score.overall < ACTION_THRESHOLDS.watchlist - 5) break;
    const reasons: string[] = [`Score ${m.score.overall} at confidence ${m.score.confidence}`];
    if (!m.domainAvailable) reasons.push('Blocked from primary: no verified available domain');
    if (m.score.confidence < ACTION_THRESHOLDS.minConfidenceForTop10) reasons.push(`Blocked from primary: confidence ${m.score.confidence} < ${ACTION_THRESHOLDS.minConfidenceForTop10}`);
    alternates.push({
      marketKey: m.marketKey, rank: rawRanked.findIndex((r) => r.marketKey === m.marketKey) + 1,
      role: 'alternate', position: alternates.length + 1, inclusionReasons: reasons,
    });
  }

  return { version: SELECTION_VERSION, rawRanked, primaries, alternates, notes };

  function keyNiche(marketKey: string): string {
    return markets.find((m) => m.marketKey === marketKey)?.nicheSlug ?? '';
  }
  function findLastDuplicateNicheIndex(list: SelectionEntry[]): number {
    const seen = new Set<string>();
    let lastDup = -1;
    list.forEach((p, i) => {
      const n = keyNiche(p.marketKey);
      if (seen.has(n)) lastDup = i;
      seen.add(n);
    });
    return lastDup;
  }
}
