// Business identity resolution — one canonical business per real-world company.
// Match order: root domain (strongest) → normalized phone → fuzzy name.
import type { BusinessIdentity } from '../core/types.js';

export interface IdentityMatch {
  matched: boolean;
  confidence: number;
  reason: string;
  existingIndex?: number;
}

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\b(llc|inc|co|corp|company|ltd|the)\b\.?/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizePhone(phone: string | undefined): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, '');
  return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits.length === 10 ? digits : undefined;
}

export function rootDomainOf(domainOrUrl: string | undefined): string | undefined {
  if (!domainOrUrl) return undefined;
  let host = domainOrUrl;
  try {
    if (domainOrUrl.includes('://')) host = new URL(domainOrUrl).hostname;
  } catch { /* keep as-is */ }
  host = host.replace(/^www\./, '').toLowerCase();
  const parts = host.split('.');
  return parts.length > 2 ? parts.slice(-2).join('.') : host;
}

function nameTokens(name: string): Set<string> {
  return new Set(normalizeName(name).split(' ').filter((t) => t.length > 2));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return inter / (a.size + b.size - inter);
}

/** Match a new identity against a pool of existing ones. */
export function matchIdentity(candidate: BusinessIdentity, existing: BusinessIdentity[]): IdentityMatch {
  const candDomain = rootDomainOf(candidate.rootDomain);
  const candPhone = normalizePhone(candidate.primaryPhone);
  const candTokens = nameTokens(candidate.canonicalName);

  for (const [i, ex] of existing.entries()) {
    if (candidate.placeId && ex.placeId && candidate.placeId === ex.placeId) {
      return { matched: true, confidence: 0.99, reason: 'Google Place ID match', existingIndex: i };
    }
    const exDomain = rootDomainOf(ex.rootDomain);
    if (candDomain && exDomain && candDomain === exDomain) {
      return { matched: true, confidence: 0.95, reason: `Root domain match (${candDomain})`, existingIndex: i };
    }
  }
  for (const [i, ex] of existing.entries()) {
    const exPhone = normalizePhone(ex.primaryPhone);
    if (candPhone && exPhone && candPhone === exPhone) {
      return { matched: true, confidence: 0.9, reason: 'Phone match', existingIndex: i };
    }
  }
  for (const [i, ex] of existing.entries()) {
    const sim = jaccard(candTokens, nameTokens(ex.canonicalName));
    if (sim >= 0.8) return { matched: true, confidence: 0.7, reason: `Name similarity ${sim.toFixed(2)}`, existingIndex: i };
  }
  return { matched: false, confidence: 0, reason: 'No match' };
}

/** Dedupe a list of identities, returning canonical entries with merge provenance. */
export function dedupeIdentities(identities: BusinessIdentity[]): { canonical: BusinessIdentity; mergedFrom: number[]; confidence: number }[] {
  const out: { canonical: BusinessIdentity; mergedFrom: number[]; confidence: number }[] = [];
  for (const [idx, ident] of identities.entries()) {
    const match = matchIdentity(ident, out.map((o) => o.canonical));
    if (match.matched && match.existingIndex !== undefined) {
      const target = out[match.existingIndex]!;
      target.mergedFrom.push(idx);
      // Enrich canonical record with any missing identity fields
      if (!target.canonical.rootDomain && ident.rootDomain) target.canonical.rootDomain = ident.rootDomain;
      if (!target.canonical.primaryPhone && ident.primaryPhone) target.canonical.primaryPhone = ident.primaryPhone;
      if (!target.canonical.placeId && ident.placeId) target.canonical.placeId = ident.placeId;
    } else {
      out.push({ canonical: { ...ident }, mergedFrom: [idx], confidence: 1 });
    }
  }
  return out;
}
