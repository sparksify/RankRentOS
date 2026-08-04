import { describe, expect, it } from 'vitest';
import { qualifyMarket, type QualifyInput } from '../src/pipeline/qualify.js';
import { QUALIFICATION_VERSION } from '../src/core/config.js';

const baseInput = (): QualifyInput => ({
  marketKey: 'epoxy-garage-floors|Prosper|TX',
  niche: {
    slug: 'epoxy-garage-floors',
    attrs: {
      query: 'epoxy garage floor coating', acQuery: 'epoxy flooring', domainTerms: ['epoxyfloors'],
      ticketLow: 2000, ticketHigh: 6000, margin: 0.5, seasonal: false, peRisk: 'low',
      archetype: 'affluent-suburb', need: false,
    },
  },
  city: { name: 'Prosper', state: 'TX', population: 42000, householdIncome: 160000, growth: 'high' },
  keyword: { term: 'epoxy flooring prosper', volume: 320, cpc: 5.5, competition: 0.5, observedAt: '2026-08-03T00:00:00Z' },
  trendWeight: 1.0,
});

describe('qualification gates (qual-v1.0)', () => {
  it('passes a strong market with reasons for every gate', () => {
    const q = qualifyMarket(baseInput());
    expect(q.result).toBe('passed');
    expect(q.version).toBe(QUALIFICATION_VERSION);
    expect(q.reasons.length).toBeGreaterThanOrEqual(5);
    expect(q.preliminaryScore).toBeGreaterThan(60);
    expect(q.inputHash).toHaveLength(16);
  });

  it('fails below the population floor', () => {
    const input = baseInput();
    input.city.population = 8000;
    const q = qualifyMarket(input);
    expect(q.result).toBe('failed');
    expect(q.reasons.some((r) => r.gate === 'population' && r.outcome === 'fail')).toBe(true);
  });

  it('fails affluence-gated niches in low-income cities', () => {
    const input = baseInput();
    input.city.householdIncome = 60000;
    const q = qualifyMarket(input);
    expect(q.result).toBe('failed');
    expect(q.reasons.some((r) => r.gate === 'income' && r.outcome === 'fail')).toBe(true);
  });

  it('does not income-gate non-affluent niches', () => {
    const input = baseInput();
    input.niche.attrs.archetype = 'need-evergreen';
    input.city.householdIncome = 60000;
    const q = qualifyMarket(input);
    expect(q.result).toBe('passed');
  });

  it('fails zero-volume low-ticket markets (the #1 rookie failure)', () => {
    const input = baseInput();
    input.keyword.volume = 0;
    const q = qualifyMarket(input);
    expect(q.result).toBe('failed');
  });

  it('lets high-ticket niches survive thin volume as commission plays', () => {
    const input = baseInput();
    input.niche.attrs.ticketLow = 15000;
    input.niche.attrs.ticketHigh = 60000;
    input.keyword.volume = 10;
    const q = qualifyMarket(input);
    expect(q.result).toBe('passed');
    expect(q.reasons.some((r) => r.detail.includes('commission-grade'))).toBe(true);
  });

  it('marks unknown-volume markets needs_research, never silently passed', () => {
    const input = baseInput();
    input.keyword.volume = null;
    const q = qualifyMarket(input);
    expect(q.result).toBe('needs_research');
    expect(q.confidence).toBeLessThan(0.9);
  });

  it('is deterministic: same input, same hash and score', () => {
    const a = qualifyMarket(baseInput());
    const b = qualifyMarket(baseInput());
    expect(a.inputHash).toBe(b.inputHash);
    expect(a.preliminaryScore).toBe(b.preliminaryScore);
  });
});
