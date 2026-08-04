# Discovery MVP — Runbook

## Full discovery run (repeatable)

```bash
npm run ingest       # v0 corpus → canonical rows + evidence (idempotent, checksummed)
npm run qualify      # free qualification over all markets → candidates + deep-research queue
# — deep research (see below) writes evidence/deep/*.json and evidence/domains/*.json —
npm run score        # Opportunity Lens v1 over deep-researched markets
npm run select       # Batch recommendation + alternates
npm run blueprints   # Blueprint Lite per target
```

Every stage is **restartable and idempotent**: deterministic UUIDv5 IDs + checksum-unique evidence + on-conflict upserts mean reruns never duplicate facts. A failed stage is resumed by rerunning it; inputs are files + DB state, not in-memory.

## Deep research inputs
- **With provider keys**: use the live adapters (SerpAPI/DataForSEO for localized SERPs, RDAP/Namecheap for domains) to write the same evidence-file formats (`RawSerpEvidenceFile`, `RawDomainEvidenceFile`).
- **Without keys** (as in the 2026-08-04 run): harness/web research produces the evidence files; the import adapters checksum and classify them identically. Provider names are preserved so confidence scoring discounts proxy-grade sources automatically.
- Cost controls: `BUDGET_DEFAULTS` in `src/core/config.ts`; `assertBudget` gates every paid call.

## Loading results into the database
Preferred (no local DB access needed): commit, deploy, then
`GET https://<app-url>/api/admin/load?token=<APP_PASSWORD>` — applies `app/data-snapshot/db-rows-*.json`, idempotent, safe to repeat.
Alternative: apply `out/sql/0*.sql` in order via any SQL client (all statements are `on conflict` safe).

## Rerunning qualification from the app
Dashboard → Run Discovery → "Run Qualification (free)" calls the in-database `rros_qualify()` — no worker required. Refreshed candidates appear immediately in the Candidate Explorer.

## Re-verifying freshness before approving a target
1. **Domains** (mandatory, availability decays): re-check the recommended + alternate domains; registrar-grade (Vercel/Namecheap). Verify-and-register in one sitting.
2. **Localized SERP** (strongly recommended): one SerpAPI/DataForSEO call per target market (~$0.05); import as evidence and rerun `score → select → blueprints` — confidence rises to ~0.9+ or the market self-demotes.
3. **Keywords**: fresh until ~2026-11-01 (90-day policy from 2026-08-03).

## Failure modes
- **Egress-blocked environment** (Claude sessions): live adapters fail fast; use harness channels + evidence import as above.
- **Supabase paused/full**: see Architecture decision log — schema is fully re-creatable from `db/migrations/` + this runbook; nothing lives only in the DB (evidence and state are in git).
- **Interrupted deep research**: evidence files are per-market; rerunning agents/searches for missing markets only, then `npm run score` picks up whatever exists.
- **v0 Supabase (LeadGenScout) recovery**: when a project slot frees, restore it and export `runs/markets/domains/pipeline`; import v0 scores as derived intelligence tagged `lens=v0-scan` (never as facts) via a new evidence file.
