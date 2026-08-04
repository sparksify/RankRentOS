import { describe, expect, it } from 'vitest';
import { evidenceChecksum, inputHash, stableStringify } from '../src/core/hash.js';
import { ids, uuidv5 } from '../src/db/ids.js';
import { insertSql } from '../src/db/sql.js';

describe('duplicate-ingestion protection', () => {
  it('evidence checksums are stable across key order', () => {
    const a = evidenceChecksum('serpapi', 'serp', { q: 'x', loc: 'y' }, { b: 2, a: 1 });
    const b = evidenceChecksum('serpapi', 'serp', { loc: 'y', q: 'x' }, { a: 1, b: 2 });
    expect(a).toBe(b);
  });

  it('different payloads yield different checksums', () => {
    const a = evidenceChecksum('serpapi', 'serp', { q: 'x' }, { result: 1 });
    const b = evidenceChecksum('serpapi', 'serp', { q: 'x' }, { result: 2 });
    expect(a).not.toBe(b);
  });

  it('deterministic UUIDv5 is stable and RFC-shaped', () => {
    const a = ids.market('epoxy', 'Prosper', 'TX');
    const b = ids.market('epoxy', 'Prosper', 'TX');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(ids.market('epoxy', 'Prosper', 'TX')).not.toBe(ids.market('epoxy', 'Celina', 'TX'));
  });

  it('matches the RFC 4122 v5 reference vector', () => {
    // uuidv5(DNS namespace, "www.example.com") canonical result
    expect(uuidv5('www.example.com', '6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe('2ed6657d-e927-568b-95e1-2665a8aea6a2');
  });

  it('emitted insert SQL is idempotent (on conflict do nothing)', () => {
    const sql = insertSql('rros_raw_evidence', [{ id: 'x', checksum: 'abc' }], { conflictTarget: '(checksum)' });
    expect(sql).toContain('on conflict (checksum) do nothing');
  });

  it('stableStringify sorts deeply', () => {
    expect(stableStringify({ z: [{ b: 1, a: 2 }], a: 1 })).toBe('{"a":1,"z":[{"a":2,"b":1}]}');
  });
});
