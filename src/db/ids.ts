// Deterministic UUIDv5 IDs from natural keys so every pipeline run — TypeScript
// or SQL (extensions.uuid_generate_v5) — addresses the same canonical rows.
// This is the backbone of idempotent ingestion and restartability.
import { createHash } from 'node:crypto';

/** Fixed RankRentOS namespace. SQL side: uuid_generate_v5('1b671a64-40d5-491e-99b0-da01ff1f3341'::uuid, name) */
export const RROS_NAMESPACE = '1b671a64-40d5-491e-99b0-da01ff1f3341';

function uuidToBytes(uuid: string): Buffer {
  return Buffer.from(uuid.replace(/-/g, ''), 'hex');
}

export function uuidv5(name: string, namespace: string = RROS_NAMESPACE): string {
  const hash = createHash('sha1').update(Buffer.concat([uuidToBytes(namespace), Buffer.from(name, 'utf8')])).digest();
  hash[6] = (hash[6]! & 0x0f) | 0x50; // version 5
  hash[8] = (hash[8]! & 0x3f) | 0x80; // RFC 4122 variant
  const hex = hash.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export const deterministicUuid = (namespace: string, key: string): string => uuidv5(`${namespace}:${key}`);

export const ids = {
  niche: (slug: string) => uuidv5(`niche:${slug}`),
  city: (name: string, state: string) => uuidv5(`city:${name}|${state}`),
  market: (nicheSlug: string, city: string, state: string) => uuidv5(`market:${nicheSlug}|${city}|${state}`),
  keyword: (term: string, geoScope: string) => uuidv5(`keyword:${term}|${geoScope}`),
  keywordObs: (term: string, provider: string, observedAt: string) => uuidv5(`kwobs:${term}|${provider}|${observedAt}`),
  geoObs: (geoId: string, metric: string, source: string, observedAt: string) => uuidv5(`geoobs:${geoId}|${metric}|${source}|${observedAt}`),
  evidence: (checksum: string) => uuidv5(`evidence:${checksum}`),
  domain: (domain: string) => uuidv5(`domain:${domain}`),
  domainObs: (domain: string, provider: string, observedAt: string) => uuidv5(`domobs:${domain}|${provider}|${observedAt}`),
  business: (rootDomainOrName: string) => uuidv5(`business:${rootDomainOrName}`),
  bizObs: (bizId: string, obsType: string, source: string, observedAt: string) => uuidv5(`bizobs:${bizId}|${obsType}|${source}|${observedAt}`),
  serpSnapshot: (query: string, provider: string, observedAt: string) => uuidv5(`serpsnap:${query}|${provider}|${observedAt}`),
  serpResult: (snapshotId: string, resultType: string, position: number, url: string) => uuidv5(`serpres:${snapshotId}|${resultType}|${position}|${url}`),
  candidate: (marketId: string, version: string, inputHash: string) => uuidv5(`candidate:${marketId}|${version}|${inputHash}`),
  opportunity: (marketId: string) => uuidv5(`opportunity:${marketId}`),
  score: (entityId: string, lens: string, lensVersion: string, inputHash: string) => uuidv5(`score:${entityId}|${lens}|${lensVersion}|${inputHash}`),
  blueprint: (opportunityId: string, version: number) => uuidv5(`blueprint:${opportunityId}|${version}`),
  batchTarget: (batch: string, opportunityId: string) => uuidv5(`batchtarget:${batch}|${opportunityId}`),
  job: (type: string, runKey: string) => uuidv5(`job:${type}|${runKey}`),
  task: (jobId: string, idempotencyKey: string) => uuidv5(`task:${jobId}|${idempotencyKey}`),
  playbook: (nicheSlug: string, version: number) => uuidv5(`playbook:${nicheSlug}|${version}`),
  membership: (bizId: string, role: string, marketId: string) => uuidv5(`membership:${bizId}|${role}|${marketId}`),
};
