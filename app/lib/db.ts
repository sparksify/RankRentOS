// Server-side PostgREST access to the canonical rros_* tables.
// All calls happen in server components / route handlers, never in the browser.
const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://drnsdklutxuohdpkjaou.supabase.co';
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRybnNka2x1dHh1b2hkcGtqYW91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1MTQyNzYsImV4cCI6MjEwMTA5MDI3Nn0.w_gowG5WCCC7lrASxXBKVjCnSHCor9Up2ceydnlih5E';

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: SUPABASE_KEY,
    authorization: `Bearer ${SUPABASE_KEY}`,
    'content-type': 'application/json',
    ...extra,
  };
}

export async function select<T = Record<string, unknown>>(table: string, query: string): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: headers(),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`${table}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

export async function count(table: string, filter = ''): Promise<number> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id${filter ? `&${filter}` : ''}&limit=1`, {
    method: 'HEAD',
    headers: headers({ prefer: 'count=exact' }),
    cache: 'no-store',
  });
  const range = res.headers.get('content-range');
  return range ? Number(range.split('/')[1]) : 0;
}

export async function patch(table: string, filter: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: headers({ prefer: 'return=minimal' }),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${table} patch: ${res.status} ${(await res.text()).slice(0, 200)}`);
}

export async function insert(table: string, rows: unknown[]): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: headers({ prefer: 'return=minimal,resolution=ignore-duplicates' }),
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`${table} insert: ${res.status} ${(await res.text()).slice(0, 200)}`);
}

export async function rpc<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`rpc ${fn}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
}
