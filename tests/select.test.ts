import { describe, expect, it } from 'vitest';
import { selectBatch, type SelectableMarket } from '../src/pipeline/select.js';

function market(key: string, niche: string, region: string, overall: number, confidence = 0.8, domainAvailable = true): SelectableMarket {
  const [city, state] = key.split('|').slice(1);
  return {
    marketKey: key, nicheSlug: niche, city: city ?? 'City', state: state ?? 'TX', region,
    score: { lens: 'l', lensVersion: 'v', weightsVersion: 'w', overall, subscores: {} as never, confidence, reasons: [], inputHash: 'h', computedAt: '' },
    domainAvailable,
    estRevenueMid: 1000,
  };
}

describe('Batch 1 selection', () => {
  it('excludes low-confidence markets from primaries no matter the score', () => {
    const markets = [
      market('a|A|TX', 'n1', 'r1', 95, 0.4),
      ...Array.from({ length: 10 }, (_, i) => market(`m${i}|C${i}|TX`, `niche${i % 5}`, `region${i % 4}`, 70 + i * 0.5)),
    ];
    const result = selectBatch(markets, 10, 5);
    expect(result.primaries.some((p) => p.marketKey === 'a|A|TX')).toBe(false);
    expect(result.notes.join(' ')).toContain('a|A|TX');
    // still visible in the raw ranking at position 1
    expect(result.rawRanked[0]!.marketKey).toBe('a|A|TX');
  });

  it('excludes markets without verified available domains', () => {
    const markets = [
      market('nodomain|B|TX', 'n1', 'r1', 90, 0.9, false),
      ...Array.from({ length: 10 }, (_, i) => market(`m${i}|C${i}|TX`, `niche${i % 5}`, `region${i % 4}`, 70)),
    ];
    const result = selectBatch(markets, 10, 5);
    expect(result.primaries.some((p) => p.marketKey === 'nodomain|B|TX')).toBe(false);
  });

  it('caps niche concentration at 3 and explains the deferral', () => {
    const markets = [
      ...Array.from({ length: 6 }, (_, i) => market(`dom${i}|D${i}|TX`, 'same-niche', `region${i}`, 90 - i)),
      ...Array.from({ length: 8 }, (_, i) => market(`o${i}|O${i}|TX`, `other${i}`, `region${i % 3}`, 75 - i)),
    ];
    const result = selectBatch(markets, 10, 5);
    const sameNiche = result.primaries.filter((p) => p.marketKey.startsWith('dom'));
    expect(sameNiche.length).toBeLessThanOrEqual(3);
    expect(result.notes.join(' ')).toContain('overconcentration');
  });

  it('records repeatability leverage in inclusion reasons', () => {
    const markets = [
      market('a1|A|TX', 'epoxy', 'r1', 85),
      market('a2|B|TX', 'epoxy', 'r2', 84),
      market('b1|C|TX', 'turf', 'r3', 83),
      market('b2|D|TX', 'other', 'r4', 82),
    ];
    const result = selectBatch(markets, 4, 2);
    const second = result.primaries.find((p) => p.marketKey === 'a2|B|TX')!;
    expect(second.inclusionReasons.join(' ')).toContain('one-niche-many-cities');
  });

  it('produces alternates with blocking explanations', () => {
    const markets = [
      ...Array.from({ length: 12 }, (_, i) => market(`m${i}|C${i}|TX`, `niche${i % 6}`, `region${i % 5}`, 80 - i)),
      market('lowconf|Z|TX', 'nz', 'rz', 79, 0.5),
    ];
    const result = selectBatch(markets, 10, 5);
    const alt = result.alternates.find((a) => a.marketKey === 'lowconf|Z|TX');
    expect(alt).toBeDefined();
    expect(alt!.inclusionReasons.join(' ')).toContain('confidence');
  });
});
