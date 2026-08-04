# RankRentOS — Discovery MVP

Market intelligence OS for rank & rent asset discovery. Turns the 1,392-market
corpus (24 niches × 58 cities) plus current competitive/domain evidence into a
ranked, evidence-backed recommendation of the first 10 local lead-gen assets to
build — with approval workflow, provenance, and versioned scoring.

**Current Batch 1: see [`docs/Batch-1-Selection.md`](docs/Batch-1-Selection.md).**

## Layout

- `src/` — TypeScript pipeline: providers, qualification (`qual-v1.0`),
  Opportunity Lens (`rr-opportunity-v1.0`), identity resolution, selection,
  Blueprint Lite. Run stages via `npm run ingest|qualify|score|select|blueprints`.
- `app/` — Next.js app (Vercel project `rankrent-os`): dashboard, discovery
  runner, candidate explorer, opportunity reports, Batch 1 approval board.
- `db/migrations/` — canonical schema (`rros_*` tables in Supabase) + in-database
  corpus loader and qualification functions.
- `data/` — v0 corpus (niches, cities, DataForSEO volumes, trends) = raw evidence.
- `evidence/` — committed raw research evidence (SERP snapshots, registrar
  domain verification) referenced by `rros_raw_evidence.storage_ref`.
- `docs/` — audit, architecture + decision log, scoring, providers, setup,
  runbook, Batch 1 selection.
- `legacy/` — the v0 pipeline and app, preserved.

## Quick start

```bash
npm install && npm test        # 34 tests, offline
npm run pipeline               # full discovery pipeline over committed data
cd app && npm install && npm run dev   # UI on :3311
```

Setup, env vars and deployment: `docs/Discovery-MVP-Setup.md`.
Operating and rerunning research: `docs/Discovery-MVP-Runbook.md`.
