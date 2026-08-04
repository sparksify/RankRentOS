// Namecheap availability adapter — final-verification provider when API
// credentials are configured (NAMECHEAP_API_USER, NAMECHEAP_API_KEY,
// NAMECHEAP_CLIENT_IP must be whitelisted in the Namecheap dashboard).
import type { DomainAvailabilityProvider } from '../types.js';
import type { DomainObservation } from '../../core/types.js';
import { evidenceChecksum } from '../../core/hash.js';

export class NamecheapDomainProvider implements DomainAvailabilityProvider {
  readonly name = 'namecheap';
  constructor(private apiUser: string, private apiKey: string, private clientIp: string) {}

  async check(domains: string[]): Promise<DomainObservation[]> {
    const out: DomainObservation[] = [];
    for (let i = 0; i < domains.length; i += 50) { // API limit: 50 domains/call
      const batch = domains.slice(i, i + 50);
      const params = new URLSearchParams({
        ApiUser: this.apiUser, ApiKey: this.apiKey, UserName: this.apiUser,
        ClientIp: this.clientIp, Command: 'namecheap.domains.check', DomainList: batch.join(','),
      });
      const res = await fetch(`https://api.namecheap.com/xml.response?${params}`);
      if (!res.ok) throw new Error(`Namecheap ${res.status}`);
      const xml = await res.text();
      const observedAt = new Date().toISOString();
      for (const domain of batch) {
        const m = xml.match(new RegExp(`Domain="${domain.replace('.', '\\.')}"[^>]*Available="(true|false)"[^>]*(?:IsPremiumName="(true|false)")?`, 'i'));
        const premium = xml.match(new RegExp(`Domain="${domain.replace('.', '\\.')}"[^>]*PremiumRegistrationPrice="([0-9.]+)"`, 'i'));
        out.push({
          domain,
          available: m ? m[1]?.toLowerCase() === 'true' : null,
          premiumPrice: premium?.[1] ? Number(premium[1]) : null,
          registrar: 'namecheap',
          provider: this.name,
          observedAt,
          evidenceChecksum: evidenceChecksum(this.name, 'availability', { domain }, m?.[0] ?? null),
        });
      }
    }
    return out;
  }
}
