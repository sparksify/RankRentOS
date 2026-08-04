// Minimal PostgREST client for Supabase — used by local runs and the worker
// when SUPABASE_URL / SUPABASE_KEY are configured. In-session runs emit SQL
// instead (db/sql.ts) because container egress cannot reach Supabase directly.

export class PostgrestClient {
  constructor(private url: string, private key: string) {}

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return {
      apikey: this.key,
      authorization: `Bearer ${this.key}`,
      'content-type': 'application/json',
      ...extra,
    };
  }

  async upsert(table: string, rows: unknown[], onConflict?: string): Promise<void> {
    if (!Array.isArray(rows) || rows.length === 0) return;
    for (let i = 0; i < rows.length; i += 500) {
      const params = onConflict ? `?on_conflict=${onConflict}` : '';
      const res = await fetch(`${this.url}/rest/v1/${table}${params}`, {
        method: 'POST',
        headers: this.headers({ prefer: 'resolution=ignore-duplicates,return=minimal' }),
        body: JSON.stringify(rows.slice(i, i + 500)),
      });
      if (!res.ok) throw new Error(`${table} upsert ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
  }

  async select<T = unknown>(table: string, query: string): Promise<T[]> {
    const res = await fetch(`${this.url}/rest/v1/${table}?${query}`, { headers: this.headers() });
    if (!res.ok) throw new Error(`${table} select ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return res.json() as Promise<T[]>;
  }
}

export function clientFromEnv(): PostgrestClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_ANON_KEY;
  return url && key ? new PostgrestClient(url, key) : null;
}
