// DB load operations emitted as JSON so any environment with DB access —
// the deployed app's admin loader, a local script, or PostgREST directly —
// can apply pipeline results without re-running the pipeline.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../pipeline/corpus.js';

export type LoadOp =
  | { op: 'upsert'; table: string; onConflict?: string; merge?: boolean; rows: Record<string, unknown>[] }
  | { op: 'update'; table: string; filter: string; set: Record<string, unknown> };

export function writeLoadOps(stage: string, ops: LoadOp[]): void {
  const payload = JSON.stringify({ stage, emittedAt: new Date().toISOString(), ops });
  for (const dir of [join(ROOT, 'out', 'state'), join(ROOT, 'app', 'data-snapshot')]) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `db-rows-${stage}.json`), payload);
  }
}
