import { NextResponse } from 'next/server';
import { readFile, readdir } from 'fs/promises';
import path from 'path';
import { appPassword } from '@/lib/auth';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://drnsdklutxuohdpkjaou.supabase.co';
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRybnNka2x1dHh1b2hkcGtqYW91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1MTQyNzYsImV4cCI6MjEwMTA5MDI3Nn0.w_gowG5WCCC7lrASxXBKVjCnSHCor9Up2ceydnlih5E';

interface LoadOpUpsert { op: 'upsert'; table: string; onConflict?: string; merge?: boolean; rows: Record<string, unknown>[] }
interface LoadOpUpdate { op: 'update'; table: string; filter: string; set: Record<string, unknown> }
type LoadOp = LoadOpUpsert | LoadOpUpdate;

// Applies committed pipeline output (data-snapshot/db-rows-*.json) into Supabase.
// The pipeline runs wherever it can (local machine, CI, a Claude session);
// this route is the load path that always has database egress.
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get('token') !== appPassword()) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const dir = path.join(process.cwd(), 'data-snapshot');
  const summary: Record<string, unknown>[] = [];
  try {
    const files = (await readdir(dir)).filter((f) => f.startsWith('db-rows-') && f.endsWith('.json')).sort();
    for (const file of files) {
      const { stage, ops } = JSON.parse(await readFile(path.join(dir, file), 'utf8')) as { stage: string; ops: LoadOp[] };
      let rows = 0, updates = 0;
      for (const op of ops) {
        if (op.op === 'upsert') {
          for (let i = 0; i < op.rows.length; i += 400) {
            const chunk = op.rows.slice(i, i + 400);
            const params = op.onConflict ? `?on_conflict=${op.onConflict}` : '';
            const res = await fetch(`${SUPABASE_URL}/rest/v1/${op.table}${params}`, {
              method: 'POST',
              headers: {
                apikey: SUPABASE_KEY,
                authorization: `Bearer ${SUPABASE_KEY}`,
                'content-type': 'application/json',
                prefer: `return=minimal,resolution=${op.merge ? 'merge-duplicates' : 'ignore-duplicates'}`,
              },
              body: JSON.stringify(chunk),
            });
            if (!res.ok) throw new Error(`${op.table}: ${res.status} ${(await res.text()).slice(0, 200)}`);
            rows += chunk.length;
          }
        } else {
          const res = await fetch(`${SUPABASE_URL}/rest/v1/${op.table}?${op.filter}`, {
            method: 'PATCH',
            headers: {
              apikey: SUPABASE_KEY,
              authorization: `Bearer ${SUPABASE_KEY}`,
              'content-type': 'application/json',
              prefer: 'return=minimal',
            },
            body: JSON.stringify(op.set),
          });
          if (!res.ok) throw new Error(`${op.table} update: ${res.status} ${(await res.text()).slice(0, 200)}`);
          updates += 1;
        }
      }
      summary.push({ file, stage, rows, updates });
    }
    return NextResponse.json({ ok: true, summary });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e), summary }, { status: 500 });
  }
}
