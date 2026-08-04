// DB load operations emitted as JSON so any environment with DB access —
// the deployed app's admin loader, a local script, or PostgREST directly —
// can apply pipeline results without re-running the pipeline.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { ROOT } from '../pipeline/corpus.js';

export type LoadOp =
  | { op: 'upsert'; table: string; onConflict?: string; merge?: boolean; rows: Record<string, unknown>[] }
  | { op: 'update'; table: string; filter: string; set: Record<string, unknown> };

export function writeLoadOps(stage: string, ops: LoadOp[]): void {
  const payload = JSON.stringify({ stage, emittedAt: new Date().toISOString(), ops });
  const outDir = join(ROOT, 'out', 'state');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, `db-rows-${stage}.json`), payload);
  // App snapshot ships gzipped (deploy payloads and repo stay lean).
  const appDir = join(ROOT, 'app', 'data-snapshot');
  mkdirSync(appDir, { recursive: true });
  writeFileSync(join(appDir, `db-rows-${stage}.json.gz`), gzipSync(Buffer.from(payload)));
}
