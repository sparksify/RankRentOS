// SQL emission for loading pipeline output into Postgres (Supabase).
// All inserts are idempotent (deterministic UUIDs + on conflict) so reruns
// never duplicate facts — the duplicate-ingestion guarantee lives here.

export function sqlLiteral(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

export interface InsertOptions {
  conflictTarget?: string;      // e.g. '(id)'
  onConflict?: 'nothing' | 'update';
  updateColumns?: string[];
}

export function insertSql(table: string, rows: Record<string, unknown>[], opts: InsertOptions = {}): string {
  if (!rows.length) return '';
  const first = rows[0]!;
  const cols = Object.keys(first);
  const values = rows
    .map((r) => `(${cols.map((c) => sqlLiteral(r[c])).join(',')})`)
    .join(',\n');
  let conflict = '';
  const target = opts.conflictTarget ?? '(id)';
  if (opts.onConflict === 'update' && opts.updateColumns?.length) {
    conflict = ` on conflict ${target} do update set ${opts.updateColumns.map((c) => `${c}=excluded.${c}`).join(', ')}`;
  } else {
    conflict = ` on conflict ${target} do nothing`;
  }
  return `insert into ${table} (${cols.join(',')}) values\n${values}${conflict};`;
}

/** Chunk large row sets into multiple statements to stay under statement limits. */
export function insertSqlChunked(table: string, rows: Record<string, unknown>[], opts: InsertOptions = {}, chunkSize = 200): string[] {
  const out: string[] = [];
  for (let i = 0; i < rows.length; i += chunkSize) {
    out.push(insertSql(table, rows.slice(i, i + chunkSize), opts));
  }
  return out;
}
