// End-to-end Discovery pipeline test over the real committed corpus:
// load → qualify all 1,392 markets → build deep-research queue → score a
// market with real deep evidence → select → blueprint. No network needed.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadCorpus, nicheAttrs, keywordTerm, marketKey, trendWeightFor, V0_OBSERVED_AT } from '../src/pipeline/corpus.js';
import { qualifyMarket } from '../src/pipeline/qualify.js';
import { runOpportunityLens, type LensInput } from '../src/lens/opportunity-v1.js';
import { selectBatch, type SelectableMarket } from '../src/pipeline/select.js';
import { generateBlueprint } from '../src/pipeline/blueprint.js';
import { classifyResult, hostOf } from '../src/pipeline/serp-signals.js';
import type { DeepResearchEvidence } from '../src/core/types.js';

const ROOT = process.cwd();

describe('discovery pipeline end-to-end', () => {
  const corpus = loadCorpus(ROOT);

  it('loads the full v0 corpus', () => {
    expect(corpus.niches.length).toBe(24);
    expect(corpus.cities.length).toBe(58);
    expect(Object.keys(corpus.volumes).length).toBe(1392);
  });

  const qualifications = corpus.niches.flatMap((n) =>
    corpus.cities.map((c) => {
      const term = keywordTerm(n, c);
      const v = corpus.volumes[term];
      return {
        nicheSlug: n.id, city: c.city, state: c.state, region: c.region,
        q: qualifyMarket({
          marketKey: marketKey(n.id, c.city, c.state),
          niche: { slug: n.id, attrs: nicheAttrs(n) },
          city: { name: c.city, state: c.state, population: c.pop ?? null, householdIncome: c.income ?? null, growth: c.growth ?? null },
          keyword: { term, volume: v?.vol ?? null, cpc: v?.cpc ?? null, competition: null, observedAt: v ? V0_OBSERVED_AT : null },
          trendWeight: trendWeightFor(corpus, n),
        }),
      };
    })
  );

  it('qualifies every market with a verdict and reasons (nothing hidden)', () => {
    expect(qualifications.length).toBe(1392);
    expect(qualifications.every((x) => x.q.reasons.length > 0)).toBe(true);
    const passed = qualifications.filter((x) => x.q.result === 'passed');
    const failed = qualifications.filter((x) => x.q.result === 'failed');
    expect(passed.length).toBeGreaterThan(100);
    expect(failed.length).toBeGreaterThan(500);
  });

  it('scores real deep evidence into a full opportunity + blueprint', () => {
    const deepDir = join(ROOT, 'evidence', 'deep');
    if (!existsSync(deepDir)) return; // evidence not present in this checkout
    const file = readdirSync(deepDir).find((f) => f.endsWith('.json'))!;
    const deep = JSON.parse(readFileSync(join(deepDir, file), 'utf8')) as DeepResearchEvidence;
    if (deep.serp) {
      deep.serp.results = deep.serp.results.map((r) => ({
        ...r, domain: r.domain ?? hostOf(r.url), ...classifyResult({ ...r, domain: r.domain ?? hostOf(r.url) }, deep.serp!.query),
      }));
    }
    const n = corpus.niches.find((x) => x.id === deep.nicheSlug)!;
    const c = corpus.cities.find((x) => x.city === deep.city && x.state === deep.state)!;
    const term = keywordTerm(n, c);
    const v = corpus.volumes[term];
    const input: LensInput = {
      marketKey: deep.marketKey,
      niche: { slug: n.id, attrs: nicheAttrs(n) },
      city: { name: c.city, state: c.state, population: c.pop, householdIncome: c.income, growth: c.growth },
      keyword: { term, volume: v?.vol ?? null, cpc: v?.cpc ?? null, observedAt: V0_OBSERVED_AT },
      trendWeight: trendWeightFor(corpus, n),
      deep,
      domainAvailability: { available: 2, bestDomain: 'example.com', checkedAt: new Date().toISOString(), registrarVerified: true },
      nicheRepeatCount: 1,
    };
    const score = runOpportunityLens(input);
    expect(score.overall).toBeGreaterThan(0);
    expect(score.confidence).toBeGreaterThan(0);
    expect(score.confidence).toBeLessThan(0.9); // proxy SERP evidence must not reach full confidence

    const bp = generateBlueprint(input, deep, { recommended: 'example.com', alternatives: [], checkedAt: input.domainAvailability.checkedAt }, score, [{ term, volume: v?.vol ?? null, cpc: v?.cpc ?? null }]);
    expect(bp.primaryServices.length).toBeGreaterThan(0);
    expect(bp.sitemap.length).toBeGreaterThan(3);
    expect(bp.assumptions.length).toBeGreaterThan(0);
    expect(bp.missingEvidence.length).toBeGreaterThan(0); // proxy evidence always leaves visible gaps
  });

  it('selection returns a recommended batch plus alternates from qualified markets', () => {
    // Mirror the production queue: diversified pool (top 3 per niche), not a
    // homogeneous slice — the concentration guards intentionally cap those.
    const byNiche = new Map<string, typeof qualifications>();
    for (const x of [...qualifications].filter((x) => x.q.result === 'passed').sort((a, b) => b.q.preliminaryScore - a.q.preliminaryScore)) {
      const list = byNiche.get(x.nicheSlug) ?? [];
      if (list.length < 3) byNiche.set(x.nicheSlug, [...list, x]);
    }
    const selectable: SelectableMarket[] = [...byNiche.values()]
      .flat()
      .map((x) => ({
        marketKey: x.q.marketKey, nicheSlug: x.nicheSlug, city: x.city, state: x.state, region: x.region ?? null,
        score: { lens: 'l', lensVersion: 'v', weightsVersion: 'w', overall: x.q.preliminaryScore, subscores: {} as never, confidence: 0.75, reasons: [], inputHash: 'h', computedAt: '' },
        domainAvailable: true,
        estRevenueMid: 800,
      }));
    const result = selectBatch(selectable, 10, 10);
    expect(result.primaries).toHaveLength(10);
    expect(result.alternates.length).toBeGreaterThan(0);
    expect(result.primaries.every((p) => p.inclusionReasons.length > 0)).toBe(true);
  });
});
