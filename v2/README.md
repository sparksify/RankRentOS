# RankRent OS V2

The smallest research + data + discovery + scoring + experiment-selection
engine that can make a better first 20-asset investment decision than manual
analysis. See `../docs/RANKRENT_V2_IMPLEMENTATION_PLAN.md` (approved, with
amendments) and `../docs/RANKRENT_V2_AUDIT.md`.

**Explicit non-goals:** Site Engine, deployment automation, rank tracking,
renter CRM, lead routing, billing, multi-tenant SaaS. Do not add them.

## Layout

- `convex/` — schema + functions. **Incremental schema** (plan Amendment 4):
  only Phase-1 tables exist (`services`, `geographies`, `opportunities`,
  `observations`, `researchRuns`). Later tables land with their phases.
- `convex/_generated/` — authored to match `npx convex codegen` output
  (this sandbox cannot reach a Convex deployment); running codegen against a
  real deployment regenerates them identically.
- `lib/evidence/` — pure provenance core: metric registry, validation
  (evidence types, AI citation guard, freshness), evidence-mix accounting.
- `app/` — Next.js shell (static Phase-1 status page; real screens Phase 9).
- `tests/` — vitest; Convex functions tested in-memory via `convex-test`
  (no deployment needed).

## Provenance guarantees (tested)

1. `observations` is append-only — no update/delete function exists.
2. Every write validates against the metric registry (unknown metric, wrong
   value kind, disallowed evidence type → rejected).
3. AI_ESTIMATED requires an http(s) citation; HUMAN_ASSUMED requires a
   rationale.
4. Every observation has ≥1 subject and full source/timestamp provenance.
5. Reads are freshness-aware (`latestByMetric`, `evidenceBag`) and
   reproducible at a point in time (`asOf`).
6. Research runs are idempotent on (kind, paramsHash) — identical research
   is never re-bought — and carry cost accounting.

## Commands

```bash
npm install
npm test          # vitest (pure + convex-test)
npm run typecheck
npm run build     # Next.js shell
npm run convex:dev  # requires a Convex project (not yet provisioned)
```

## V0

V0 remains untouched at the repo root (`src/`, `app/`, `data/`). Its
historical research data may exist on a currently unavailable machine — see
`../docs/V0_DATA_RECOVERY_PENDING.md`. The importer (Phase 2) is designed to
accept that data whenever recovered.
