// RDAP domain availability — free, registry-authoritative for .com/.net.
// Two-stage: DNS NS lookup (fast negative) then RDAP (definitive). Ported from v0.
import { promises as dns } from 'node:dns';
import type { DomainAvailabilityProvider } from '../types.js';
import type { DomainObservation } from '../../core/types.js';
import { evidenceChecksum } from '../../core/hash.js';

export class RdapDomainProvider implements DomainAvailabilityProvider {
  readonly name = 'rdap';

  async check(domains: string[]): Promise<DomainObservation[]> {
    const out: DomainObservation[] = [];
    const concurrency = 5;
    for (let i = 0; i < domains.length; i += concurrency) {
      const batch = domains.slice(i, i + concurrency);
      out.push(...(await Promise.all(batch.map((d) => this.checkOne(d)))));
      await new Promise((r) => setTimeout(r, 150)); // be polite to RDAP
    }
    return out;
  }

  private async checkOne(domain: string): Promise<DomainObservation> {
    const observedAt = new Date().toISOString();
    try {
      const ns = await dns.resolveNs(domain);
      if (ns?.length) {
        return { domain, available: false, provider: this.name, observedAt, evidenceChecksum: evidenceChecksum(this.name, 'availability', { domain }, { via: 'dns', ns }) };
      }
    } catch {
      /* NXDOMAIN — fall through to RDAP for a definitive answer */
    }
    try {
      const res = await fetch(`https://rdap.verisign.com/com/v1/domain/${domain}`, { headers: { accept: 'application/rdap+json' } });
      const available = res.status === 404 ? true : res.ok ? false : null;
      return { domain, available, provider: this.name, observedAt, evidenceChecksum: evidenceChecksum(this.name, 'availability', { domain }, { status: res.status }) };
    } catch (e) {
      return { domain, available: null, provider: this.name, observedAt, evidenceChecksum: evidenceChecksum(this.name, 'availability', { domain }, { error: String(e).slice(0, 80) }) };
    }
  }
}
