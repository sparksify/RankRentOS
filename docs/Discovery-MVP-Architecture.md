# Discovery MVP — Implemented Architecture & Decision Log
### 2026-08-04 · implements §15 of ARCHITECTURE.md (Master Architecture v3)

## Three-layer data doctrine (as built)

| Layer | Tables | Rules enforced |
|---|---|---|
| A — Raw evidence | `rros_raw_evidence` | Immutable; unique `checksum`; large payloads via `storage_ref` (`git:<path>` — the repo is the object store until Supabase Storage is adopted); provider/request/cost/job provenance |
| B — Canonical facts | `rros_geo_observations`, `rros_keyword_observations`, `rros_serp_snapshots` + `rros_serp_results`, `rros_business_observations`, `rros_domain_observations` | Append-only; every row carries `observed_at`, `source/provider`, `evidence_id`; newer observations append, never overwrite |
| C — Derived intelligence | `rros_candidates`, `rros_scores`, `rros_opportunities` (state), `rros_blueprint_versions`, `rros_batch_targets` | Versioned (`lens_version`, `weights_version`, `qualification_version`), `input_hash`, confidence separate from score, recomputable |

Entities: `rros_cities`, `rros_neighborhoods`, `rros_territories(+memberships)`, `rros_niches`, `rros_niche_services`, `rros_playbooks`, `rros_markets`, `rros_keywords`, `rros_businesses`, `rros_business_locations`, `rros_pipeline_memberships`, `rros_domains`, `rros_jobs`, `rros_tasks`, `rros_executions`, `rros_config`. 27 tables, migrations in `db/migrations/`.

## Code layout

```
src/
  core/       types, hashing (sha256 + stable stringify), freshness policy, versioned config
  db/         ids (UUIDv5), sql emitter, postgrest client, load-op emitter
  providers/  serp/ (serpapi, dataforseo, evidence-import) · domains/ (rdap, namecheap, evidence-import) · census
  pipeline/   corpus loader, serp-signals, qualify, domains, select, blueprint
  lens/       opportunity-v1 (+ confidence model)
  identity/   business identity resolution (domain > phone > fuzzy name)
  scripts/    ingest-v0, run-qualify, run-score, run-select, run-blueprints
app/          Next.js 15 App Router (TS + Tailwind), server-side PostgREST only
db/migrations/  0001 schema · 0002 corpus loader + qualification SQL functions
evidence/     committed raw evidence (deep research JSON, registrar batches)
legacy/       v0 pipeline + app, preserved untouched
tests/        vitest — qualification, lens, identity, dedup, selection, e2e pipeline
```

## Decision log

1. **DB host: `ai-employee-os` Supabase project, `rros_` prefix.** The v0 `LeadGenScout` project is paused and un-restorable (org at 2-active free limit); pausing another production app or upgrading was outside session authority. Additive, collision-checked, fully reversible: move = create project → replay `db/migrations` → copy `rros_*` rows. **Do not delete LeadGenScout** — it still holds v0 run history to import when restored.
2. **Deterministic UUIDv5 IDs everywhere** (namespace `1b671a64-40d5-491e-99b0-da01ff1f3341`), identical in TypeScript (`src/db/ids.ts`) and SQL (`rros_id(name)` via uuid-ossp). This is the backbone of idempotent ingestion, duplicate prevention, and restartability: reruns address the same rows.
3. **Qualification runs in two synchronized implementations**: `src/pipeline/qualify.ts` (reference, unit-tested) and `rros_qualify()` (SQL, lets the app rerun research with zero infrastructure). Verified output-identical on the full corpus (258/170/964). Bump both together with `QUALIFICATION_VERSION`; the TS implementation is authoritative on drift.
4. **Repo-as-object-store**: large raw payloads (`data/volumes.json`, `evidence/**`) are committed and referenced by `storage_ref='git:<path>'` with the checksum recorded in `rros_raw_evidence`; integrity is verifiable from the file. Swap to Supabase Storage by uploading the same files and rewriting `storage_ref`.
5. **Session egress constraints shaped the provider mix** (see Providers doc): container egress is policy-blocked to nearly all hosts, so this cycle's evidence channels were harness tools (web search, Vercel registrar) recorded as first-class providers with confidence discounts. Live HTTP adapters (SerpAPI, DataForSEO, RDAP, Namecheap, Census) ship ready for keys.
6. **Load path for pipeline output**: scripts emit both idempotent SQL (`out/sql/`) and row-level load ops (`app/data-snapshot/db-rows-*.json`); the deployed app's `/api/admin/load?token=<APP_PASSWORD>` applies them (the app always has DB egress). No manual database work required.
7. **PostGIS deferred.** Cities carry lat/lng columns; boundaries jsonb. Enabling PostGIS inside the shared host project adds footprint without an MVP query needing it. Revisit on the dedicated project.
8. **Single-admin auth** ported from v0 (password → hashed session cookie, middleware-gated). Not a user system, per brief. `APP_PASSWORD` env overrides the committed bootstrap default — rotate it (see Setup).
9. **Confidence model is deliberately capped this cycle** (~0.78 max): web-search SERP proxy + missing local pack can never reach the confidence a localized SERP provides. Score ≠ confidence; the Top-10 gate is score ≥60 AND confidence ≥0.65 AND registrar-verified domain.
10. **Selection is portfolio-aware, not raw-rank**: ≤3 per niche, ≤4 per region, niche-diversity swap pass, explicit inclusion reasons stored on every batch target.
11. **v0 preserved, not rewritten**: moved to `legacy/`, its scoring heuristics ported as versioned signal lists (`serp-signals.ts`), its value model ported into monetization/blueprint estimates, its data ingested with provenance.
12. **Pre-existing security finding surfaced**: the 11 original `ai-employee-os` tables have RLS disabled (fully exposed to anon key). Not caused by this work; remediation requires that app's owner to add policies. `rros_*` tables have RLS enabled with permissive policies (single-admin tradeoff, documented).
