/**
 * RDAP (Verisign, .com/.net) — free domain availability + registration age.
 * Pure parse; HTTP via injected fetch in actions.
 */
export function rdapUrl(domain: string): string {
  return `https://rdap.verisign.com/com/v1/domain/${domain}`;
}

export interface RdapAvailability {
  domain: string;
  available: boolean | null; // null = indeterminate
  via: string;
}

export function parseRdapAvailability(
  domain: string,
  status: number,
): RdapAvailability {
  if (status === 404) return { domain, available: true, via: "rdap" };
  if (status >= 200 && status < 300)
    return { domain, available: false, via: "rdap" };
  return { domain, available: null, via: `rdap-${status}` };
}

/** Registration age in years from an RDAP payload, null when undeterminable. */
export function registrationAgeYears(raw: any, nowMs: number): number | null {
  const reg = (raw?.events ?? []).find(
    (e: any) => e.eventAction === "registration",
  );
  if (!reg?.eventDate) return null;
  const t = new Date(reg.eventDate).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.round(((nowMs - t) / 31_557_600_000) * 10) / 10;
}
