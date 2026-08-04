// Domain candidate generation + winner ranking. Ported from v0 domains.js.
import type { NicheAttrs } from '../core/types.js';

export function domainCandidates(niche: { attrs: NicheAttrs }, cityName: string): string[] {
  const c = cityName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const out = new Set<string>();
  for (const term of niche.attrs.domainTerms) {
    out.add(`${c}${term}.com`);
    out.add(`${term}${c}.com`);
  }
  const primary = niche.attrs.domainTerms[0];
  if (primary) out.add(`${c}${primary}pros.com`);
  return [...out];
}

export interface DomainPick {
  domain: string;
  why: string;
  runnerUp: string | null;
}

export function pickWinner(availableDomains: string[], niche: { attrs: NicheAttrs }, cityName: string): DomainPick | null {
  if (!availableDomains.length) return null;
  const c = cityName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const primary = niche.attrs.domainTerms[0] ?? '';

  const ranked = availableDomains
    .map((d) => {
      const name = d.replace(/\.com$/, '');
      let pts = 0;
      const reasons: string[] = [];
      if (name.startsWith(c)) { pts += 30; reasons.push('city-first (the geography+service formula)'); }
      else if (name.endsWith(c)) { pts += 20; reasons.push('service+city order (still an exact match)'); }
      const termIdx = niche.attrs.domainTerms.findIndex((t) => name.includes(t));
      if (termIdx === 0) { pts += 25; reasons.push(`primary keyword "${primary}"`); }
      else if (termIdx > 0) { pts += 25 - termIdx * 5; reasons.push(`variant keyword "${niche.attrs.domainTerms[termIdx]}"`); }
      if (!name.includes('pros')) pts += 10; else reasons.push("'pros' suffix — fallback pattern");
      pts += Math.max(0, 15 - Math.max(0, name.length - 18));
      if (name.length <= 22) reasons.push(`short (${name.length} chars)`);
      return { domain: d, pts, reasons };
    })
    .sort((a, b) => b.pts - a.pts);

  const w = ranked[0]!;
  return { domain: w.domain, why: w.reasons.join('; '), runnerUp: ranked[1]?.domain ?? null };
}
