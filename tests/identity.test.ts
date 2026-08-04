import { describe, expect, it } from 'vitest';
import { dedupeIdentities, matchIdentity, normalizeName, normalizePhone, rootDomainOf } from '../src/identity/resolve.js';

describe('business identity resolution', () => {
  it('normalizes names, phones and root domains', () => {
    expect(normalizeName('The Epoxy Co., LLC')).toBe('epoxy');
    expect(normalizePhone('(214) 555-0134')).toBe('2145550134');
    expect(normalizePhone('+1 214 555 0134')).toBe('2145550134');
    expect(rootDomainOf('https://www.sub.example.com/page')).toBe('example.com');
    expect(rootDomainOf('www.example.com')).toBe('example.com');
  });

  it('matches on root domain with high confidence', () => {
    const m = matchIdentity(
      { canonicalName: 'Epoxy Bros', rootDomain: 'https://www.epoxybros.com/garage' },
      [{ canonicalName: 'Epoxy Brothers LLC', rootDomain: 'epoxybros.com' }]
    );
    expect(m.matched).toBe(true);
    expect(m.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('matches on phone when domains are missing', () => {
    const m = matchIdentity(
      { canonicalName: 'A Totally Different Name', primaryPhone: '214-555-0134' },
      [{ canonicalName: 'Epoxy Brothers', primaryPhone: '(214) 555-0134' }]
    );
    expect(m.matched).toBe(true);
  });

  it('does not merge distinct businesses', () => {
    const m = matchIdentity(
      { canonicalName: 'Alpha Flooring', rootDomain: 'alphafloors.com' },
      [{ canonicalName: 'Bravo Concrete', rootDomain: 'bravoconcrete.com' }]
    );
    expect(m.matched).toBe(false);
  });

  it('dedupes a mixed list and preserves merge provenance', () => {
    const deduped = dedupeIdentities([
      { canonicalName: 'Epoxy Brothers LLC', rootDomain: 'epoxybros.com' },
      { canonicalName: 'Epoxy Bros', rootDomain: 'www.epoxybros.com', primaryPhone: '214-555-0134' },
      { canonicalName: 'Bravo Concrete', rootDomain: 'bravoconcrete.com' },
    ]);
    expect(deduped).toHaveLength(2);
    const merged = deduped.find((d) => d.canonical.rootDomain?.includes('epoxybros'))!;
    expect(merged.mergedFrom).toHaveLength(2);
    expect(merged.canonical.primaryPhone).toBe('214-555-0134'); // enriched from merged record
  });
});
