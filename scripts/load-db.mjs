// Loads committed pipeline output (app/data-snapshot/db-rows-*.json.gz) into
// Supabase via PostgREST. Idempotent (deterministic IDs + ignore/merge-duplicates).
// Runs anywhere with DB egress: GitHub Actions, local machine, the app's admin route.
import { readFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// `||` not `??`: CI sets unset secrets to empty strings.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://drnsdklutxuohdpkjaou.supabase.co';
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRybnNka2x1dHh1b2hkcGtqYW91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1MTQyNzYsImV4cCI6MjEwMTA5MDI3Nn0.w_gowG5WCCC7lrASxXBKVjCnSHCor9Up2ceydnlih5E';

const headers = (extra = {}) => ({
  apikey: SUPABASE_KEY,
  authorization: `Bearer ${SUPABASE_KEY}`,
  'content-type': 'application/json',
  ...extra,
});

const dir = join(ROOT, 'app', 'data-snapshot');
const files = readdirSync(dir).filter((f) => f.startsWith('db-rows-') && f.endsWith('.json.gz')).sort();
let totalRows = 0;
let totalUpdates = 0;

for (const file of files) {
  const { stage, ops } = JSON.parse(gunzipSync(readFileSync(join(dir, file))).toString('utf8'));
  let rows = 0, updates = 0;
  for (const op of ops) {
    if (op.op === 'upsert') {
      // PostgREST bulk inserts require identical keys on every row (PGRST102):
      // normalize each chunk to the union of keys, filling gaps with null.
      const keys = [...new Set(op.rows.flatMap((r) => Object.keys(r)))];
      const normalized = op.rows.map((r) => Object.fromEntries(keys.map((k) => [k, r[k] ?? null])));
      for (let i = 0; i < normalized.length; i += 400) {
        const chunk = normalized.slice(i, i + 400);
        const params = op.onConflict ? `?on_conflict=${op.onConflict}` : '';
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${op.table}${params}`, {
          method: 'POST',
          headers: headers({ prefer: `return=minimal,resolution=${op.merge ? 'merge-duplicates' : 'ignore-duplicates'}` }),
          body: JSON.stringify(chunk),
        });
        if (!res.ok) throw new Error(`${op.table}: ${res.status} ${(await res.text()).slice(0, 300)}`);
        rows += chunk.length;
      }
    } else {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${op.table}?${op.filter}`, {
        method: 'PATCH',
        headers: headers({ prefer: 'return=minimal' }),
        body: JSON.stringify(op.set),
      });
      if (!res.ok) throw new Error(`${op.table} update: ${res.status} ${(await res.text()).slice(0, 300)}`);
      updates += 1;
    }
  }
  console.log(`${file} (${stage}): ${rows} rows upserted, ${updates} updates`);
  totalRows += rows;
  totalUpdates += updates;
}
console.log(`Done: ${totalRows} rows, ${totalUpdates} updates across ${files.length} stage files.`);
