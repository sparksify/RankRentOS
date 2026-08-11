/**
 * Domain candidate generation + winner ranking — V0 logic preserved
 * (geography+service formula; primary keyword beats variants; brevity;
 * "pros" suffix as fallback of last resort). Pure functions.
 */

export function slugCity(city: string): string {
  return city.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function domainCandidates(
  domainTerms: string[],
  city: string,
): string[] {
  const c = slugCity(city);
  const out = new Set<string>();
  for (const term of domainTerms) {
    out.add(`${c}${term}.com`);
    out.add(`${term}${c}.com`);
  }
  if (domainTerms[0]) out.add(`${c}${domainTerms[0]}pros.com`);
  return [...out];
}

export interface DomainPick {
  domain: string;
  why: string;
  runnerUp: string | null;
}

export function pickWinner(
  availableDomains: string[],
  domainTerms: string[],
  city: string,
): DomainPick | null {
  if (availableDomains.length === 0) return null;
  const c = slugCity(city);
  const primary = domainTerms[0];

  const ranked = availableDomains
    .map((d) => {
      const name = d.replace(/\.com$/, "");
      let pts = 0;
      const reasons: string[] = [];
      if (name.startsWith(c)) {
        pts += 30;
        reasons.push("city-first (the geography+service formula)");
      } else if (name.endsWith(c)) {
        pts += 20;
        reasons.push("service+city order (still an exact match)");
      }
      const termIdx = domainTerms.findIndex((t) => name.includes(t));
      if (termIdx === 0) {
        pts += 25;
        reasons.push(`primary keyword "${primary}"`);
      } else if (termIdx > 0) {
        pts += 25 - termIdx * 5;
        reasons.push(`variant keyword "${domainTerms[termIdx]}"`);
      }
      if (!name.includes("pros")) pts += 10;
      else reasons.push("'pros' suffix — fallback pattern");
      pts += Math.max(0, 15 - Math.max(0, name.length - 18)); // brevity
      if (name.length <= 22) reasons.push(`short (${name.length} chars)`);
      return { domain: d, pts, reasons };
    })
    .sort((a, b) => b.pts - a.pts);

  const w = ranked[0]!;
  return {
    domain: w.domain,
    why: w.reasons.join("; "),
    runnerUp: ranked[1]?.domain ?? null,
  };
}
