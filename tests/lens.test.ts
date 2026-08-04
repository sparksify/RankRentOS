import { describe, expect, it } from 'vitest';
import { runOpportunityLens, computeConfidence, estimateValue, type LensInput } from '../src/lens/opportunity-v1.js';
import type { DeepResearchEvidence } from '../src/core/types.js';

function deepEvidence(overrides: Partial<DeepResearchEvidence> = {}): DeepResearchEvidence {
  return {
    marketKey: 'test|City|TX', nicheSlug: 'test', city: 'City', state: 'TX',
    collectedAt: new Date().toISOString(),
    serp: {
      query: 'test service city tx', engine: 'web', device: 'desktop', geoParams: {},
      provider: 'web_search', observedAt: new Date().toISOString(),
      results: [
        { position: 1, resultType: 'organic', url: 'https://yelp.com/biz/x', domain: 'yelp.com', title: 'Best Test Service', isDirectory: true, isInnerPage: true },
        { position: 2, resultType: 'organic', url: 'https://angi.com/x', domain: 'angi.com', title: 'Top 10', isDirectory: true, isInnerPage: true },
        { position: 3, resultType: 'organic', url: 'https://someco.com/service-areas/city', domain: 'someco.com', title: 'Service', isInnerPage: true },
      ],
    },
    competitors: [
      { name: 'Some Co', domain: 'someco.com', kind: 'out_of_town', signals: { contentDepthWords: 300, dedicatedLocalSite: false } },
      { name: 'Other Co', domain: 'otherco.com', kind: 'local_business', signals: { contentDepthWords: 250, dedicatedLocalSite: false } },
      { name: 'Third Co', domain: 'thirdco.com', kind: 'local_business', signals: { dedicatedLocalSite: false } },
    ],
    operatorCandidates: [
      { name: 'Op One', domain: 'opone.com', whyCandidate: 'ranked below top 3', source: 'web_search' },
      { name: 'Op Two', domain: 'optwo.com', whyCandidate: 'directory only', source: 'web_search' },
      { name: 'Op Three', domain: 'opthree.com', whyCandidate: 'ads only', source: 'web_search' },
    ],
    domains: [],
    ...overrides,
  };
}

function lensInput(overrides: Partial<LensInput> = {}): LensInput {
  return {
    marketKey: 'test|City|TX',
    niche: {
      slug: 'test',
      attrs: { query: 'test service', acQuery: 'test', domainTerms: ['test'], ticketLow: 2000, ticketHigh: 8000, margin: 0.5, seasonal: false, peRisk: 'low', archetype: 'affluent-suburb', need: false },
    },
    city: { name: 'City', state: 'TX', population: 50000, householdIncome: 130000, growth: 'high' },
    keyword: { term: 'test city', volume: 200, cpc: 8, observedAt: new Date().toISOString() },
    trendWeight: 1.0,
    deep: deepEvidence(),
    domainAvailability: { available: 3, bestDomain: 'citytest.com', checkedAt: new Date().toISOString(), registrarVerified: true },
    nicheRepeatCount: 3,
    ...overrides,
  };
}

describe('Rank & Rent Opportunity Lens v1', () => {
  it('produces a bounded score with all seven subscores and reasons', () => {
    const s = runOpportunityLens(lensInput());
    expect(s.overall).toBeGreaterThan(0);
    expect(s.overall).toBeLessThanOrEqual(100);
    expect(Object.keys(s.subscores)).toEqual(
      expect.arrayContaining(['demand', 'competition', 'monetization', 'domain', 'operatorBench', 'geoEconomics', 'buildability'])
    );
    expect(s.reasons.length).toBeGreaterThan(5);
    expect(s.lensVersion).toMatch(/^rr-opportunity/);
    expect(s.weightsVersion).toBeTruthy();
  });

  it('penalizes franchise-held SERPs', () => {
    const clean = runOpportunityLens(lensInput());
    const franchised = runOpportunityLens(
      lensInput({
        deep: deepEvidence({
          serp: {
            ...deepEvidence().serp!,
            results: deepEvidence().serp!.results.map((r, i) =>
              i < 2 ? { ...r, isDirectory: false, isFranchise: true, domain: 'garageexperts.com' } : r
            ),
          },
        }),
      })
    );
    expect(franchised.subscores.competition).toBeLessThan(clean.subscores.competition);
  });

  it('scores zero domain points when availability is unverified', () => {
    const s = runOpportunityLens(lensInput({ domainAvailability: { available: 0, bestDomain: null, checkedAt: null, registrarVerified: false } }));
    expect(s.subscores.domain).toBe(0);
  });

  it('keeps confidence separate from score and discounts proxy SERP evidence', () => {
    const proxy = computeConfidence(lensInput());
    const localized = computeConfidence(
      lensInput({ deep: deepEvidence({ serp: { ...deepEvidence().serp!, provider: 'serpapi' } }) })
    );
    expect(localized).toBeGreaterThan(proxy);
    expect(proxy).toBeLessThan(0.85);
  });

  it('confidence drops when deep evidence is missing entirely', () => {
    const c = computeConfidence(lensInput({ deep: null }));
    expect(c).toBeLessThan(0.65); // cannot enter Top 10 without deep research
  });

  it('estimates commission deals for high-ticket niches and flat rent for low-ticket', () => {
    const flat = estimateValue(lensInput());
    const commission = estimateValue(
      lensInput({
        niche: { slug: 'ok', attrs: { ...lensInput().niche.attrs, ticketLow: 15000, ticketHigh: 60000, margin: 0.4 } },
        // Flat rent caps at $2k/mo; with real volume the 10%-of-gross commission clears it.
        keyword: { term: 'x', volume: 200, cpc: 10, observedAt: null },
      })
    );
    expect(flat.dealType).toBe('flat');
    expect(commission.dealType).toBe('commission');
  });
});
