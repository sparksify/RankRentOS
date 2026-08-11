# V2 → Supabase Reconciliation Audit
### 2026-08 · audit only — no code modified, no Convex provisioned, nothing implemented

## 1. Executive Recommendation
**YES — most Phase 1/2 intelligence work survives without Convex.** The `origin/v2`
branch's `v2/` workspace cleanly separates pure-TypeScript domain logic
(`v2/lib/**`, 14 modules + 34 tests + golden fixtures) from Convex infrastructure
(`v2/convex/**`, 7 tables + functions + 33 convex-test tests). The lib layer has
no backend coupling and ports as-is; the Convex functions' *business rules*
(append-only observations, run idempotency, budget ledger, V0 import) port as
Postgres tables + constraints + small server-side modules against the existing
Supabase project. Discard only Convex runtime glue and generated code.

**Quantified:** ~45% directly reusable (lib modules, 34 non-Convex tests,
2 golden SERP fixtures, docs) · ~35% reusable via port (logic inside
`convex/{observations,researchRuns,budget,subjects,importers,research/*}.ts`
re-expressed as SQL DDL + plain TS services) · ~20% discard
(`_generated/**`, Convex client/server wiring, `convex-test` harness,
`convex` + `convex-test` deps).

## 2. Current Supabase Architecture (main)
- Project `LeadGenScout` (dmvkmbbpcvcetuepwhue). Tables: `runs`, `markets`
  (signals JSONB incl. strategyV2), `domains`, `pipeline`; view `market_board`.
  Versioned-but-unapplied: `supabase/migrations/002_dual_strategy.sql`
  (dual-strategy columns + `site_outcomes`). **Status: currently unreachable
  (paused or MCP re-auth needed) — restoring it is a precondition (§19).**
- App: Next.js (JS) in `app/`, password middleware, server-side REST via
  `app/lib/config.js`. No RLS (anon key, single-user).
- Pipeline: plain-JS collectors in `src/` (serp, demand, volume, domains,
  strategy, families, portfolio) with disk caches; 17 passing node:test tests.
- Data: 2,029 scored markets (out/opportunities.json), 668-market national
  sweep, 1,445 raw SERP payloads on disk.

## 3. Convex V2 Architecture Created (origin/v2 → `v2/`)
- Convex schema: `services, geographies, opportunities, observations,
  serpSnapshots, budgetLedger, researchRuns` + functions: `observations.ts`
  (append-only + taxonomy + supersession), `researchRuns.ts` (idempotency,
  stage guards, asOf), `budget.ts` (ledger/guards), `subjects.ts`,
  `importers/v0.ts`, `research/{serp,keywords,autocomplete,trends,domains}.ts`
  collectors.
- Pure lib: `evidence/{types,metrics,validate}` (OBSERVED/DERIVED/AI_ESTIMATED/
  HUMAN_ASSUMED taxonomy, metric registry, validation), `providers/{serpapi,
  dataforseo,rdap}`, `serp/{signals,lists}`, `domains/candidates`,
  `crawl/contentDepth`, `research/guards`, `geo/states`, `import/v0`.
- Tests: 34 pure (evidence 13, providers 10, parsers 7, serp signals 4) +
  33 Convex-coupled + golden fixtures (`serpapi-{strong,weak}-market.json`).
- Stack: TS + vitest + Next 15; deps `convex@1.17`, `convex-test`.
- Docs: RANKRENT_V2_AUDIT.md, RANKRENT_V2_IMPLEMENTATION_PLAN.md,
  DEPLOYMENT_HANDOFF_CONTRACT.md, V0_DATA_RECOVERY_PENDING.md.

## 4. Portable Phase 1/2 Components (keep, no changes)
All of `v2/lib/**` (backend-agnostic TS): evidence taxonomy + metric registry +
validation · SERP signal extraction + directory/franchise lists · provider
logic (SerpAPI, DataForSEO, RDAP) · domain candidate generation · content-depth
crawler · research stage guards · state/geo normalization (incl.
ambiguous-geography rejection) · V0 importer/parser · the 34 pure tests +
golden fixtures · all four docs.

## 5. Convex-Specific Components to Discard
`v2/convex/_generated/**` · Convex client/server imports and function wrappers ·
`convex-test` harness + `tests/convex/helpers.ts` · `convex`/`convex-test`
dependencies · Convex deployment config. (Their embedded business rules are
NOT discarded — they move, see §8.)

## 6. Existing Supabase Components to Reuse
`runs` ≈ researchRuns (extend, don't duplicate) · `markets` ≈ opportunities
(v2's `services`/`geographies` map onto existing `niches.json→niches table`
and `cities*` data rather than new parallel subject tables) · `domains` stays ·
migration 002's `site_outcomes` stays · existing app auth/API routes stay ·
existing `src/` collectors remain the working engine until ports land.

## 7. Required Supabase Schema Changes (new migration 003, not yet applied)
```sql
observations (id, subject_type, subject_id, metric text REFERENCES metric registry
  (enforced in code), value jsonb, basis text CHECK (basis IN
  ('OBSERVED','DERIVED','AI_ESTIMATED','HUMAN_ASSUMED')), source, confidence,
  observed_at, ingested_at default now(), run_id, evidence_ref, superseded_by uuid NULL,
  legacy boolean default false)          -- append-only: no UPDATE/DELETE grants
serp_snapshots (id, keyword, geography, engine, device, observed_at, provider,
  cost, storage_path, checksum, run_id)  -- payloads → Supabase Storage
budget_ledger (id, run_id, provider, units, est_cost, actual_cost, created_at)
runs: ADD stage text, as_of timestamptz, idempotency_key text UNIQUE,
  budget_cap numeric, status
```
Append-only enforced by REVOKE UPDATE/DELETE + (later) RLS; supersession via
`superseded_by` pointer, never mutation. No duplicate subject tables.

## 8. Required Code Ports (logic out of Convex functions → plain TS services)
`observations.ts` append/supersede/legacy rules → `lib/store/observations.ts`
(REST inserts + constraint reliance) · `researchRuns.ts` idempotency/asOf/stage
guards → `lib/store/runs.ts` · `budget.ts` → `lib/store/budget.ts` (guard called
by collectors; mirrors existing cost-governor intent) · `research/*.ts`
collectors → thin orchestrators composing existing `v2/lib/providers` + new
stores · `importers/v0.ts` → script targeting Supabase using `lib/import/v0.ts`
unchanged. Estimated: each port is small — the logic is already isolated.

## 9. Test Migration Strategy
34 pure tests: run unchanged under vitest (zero edits expected; verify no stray
convex imports). 33 Convex tests: rewrite assertions against a store interface
with an in-memory fake (the tests encode the *rules* — append-only, idempotent
runs, budget refusal — which are backend-independent); est. 1:1 rewrite,
keep names. Golden fixtures reused verbatim by signal-extraction tests.

## 10. V0 Data Import Strategy
Source of truth already local: out/results.json (1,392), national-results.json
(668), opportunities.json (2,029), 1,445 raw payloads, volumes/trends caches,
plus Supabase's 5 historical runs. Sequence: restore project → apply 002+003 →
run ported importer: raw payloads → Storage + serp_snapshots; per-market signals
→ observations with basis=OBSERVED (SERP/vol/CPC), DERIVED (scores, marked
legacy supersedable), HUMAN_ASSUMED (benchmarks); tag `legacy=true`, provenance
`v0-import`, preserving V0 survivor provenance and original observed_at.

## 11. Research Collector Integration Strategy
Keep `src/` JS engine operational (it produced the current portfolio). New
collectors write to observations/serp_snapshots via stores; disk cache remains
a read-through layer. Cutover per-collector (serp → volume → domains →
autocomplete), verified by comparing outputs on cached inputs; retire `src/`
duplicates only after parity.

## 12. Evidence/Provenance on Supabase
Taxonomy = CHECK constraint (§7) + `lib/evidence/validate.ts` unchanged at the
boundary. Every observation carries source, run_id, evidence_ref (snapshot/
payload), confidence. Derived values are recomputable rows referencing input
hashes — matches ARCHITECTURE.md §2 doctrine exactly; Convex added no semantics
Postgres can't express.

## 13. Research Job/Async Strategy
No Convex scheduler needed: existing plan (ARCHITECTURE §9 / worker decision)
stands — `runs` table + local `npm run worker` poller; stage guards run
in-process. Idempotency via `idempotency_key` UNIQUE + upsert-or-return.

## 14. Cost/Budget Guard Strategy
`budget_ledger` rows per provider call (cost fields already captured by
providers); guard checks run budget before each Task; refusal recorded as an
observation-free ledger entry. Mirrors v2 `budget.ts` semantics 1:1.

## 15. Security/RLS Impact
Current: no RLS (single-user anon). Reconciliation adds: REVOKE UPDATE/DELETE
on observations/serp_snapshots/budget_ledger (append-only at the grant level);
defer full RLS to multi-user per ARCHITECTURE §10. Service-role key needed for
imports — retrieve from dashboard when restoring the project.

## 16. Estimated Work
Schema migration 003: small · store ports (4 modules): the bulk, each isolated ·
test rewrite (33): mechanical · importer run: one command after restore ·
collector cutover: incremental. Total: a few focused sessions; nothing
research-blocking meanwhile (v0 engine still runs).

## 17. Exact Implementation Sequence
1) Restore Supabase + re-auth MCP (human) → 2) apply 002 then 003 →
3) copy `v2/lib/**` + pure tests + fixtures onto main; CI green →
4) port stores (observations→runs→budget) with rewritten tests →
5) run V0 importer; verify counts/provenance → 6) collector cutover w/ parity
checks → 7) delete `v2/convex/**` + deps; merge v2→main → 8) resume V2 plan
on Supabase.

## 18. Materially Worse on Supabase?
Nothing material. Convex advantages lost: generated end-to-end types (mitigate:
Drizzle/typegen later per §16 of ARCHITECTURE), built-in reactive queries
(unused by V1), integrated scheduler (replaced by worker, already decided).

## 19. Critical Blockers
Only one, pre-existing: **the Supabase project is unreachable and the MCP token
lacks permissions.** Human action: Supabase dashboard → restore/unpause
LeadGenScout → reconnect MCP (write scope) → provide service-role key for the
importer. No Convex-related blockers; no reason found to revisit the decision.

## 20. Exact First Task After Approval
`git checkout main && git checkout origin/v2 -- v2/lib v2/tests/evidence
v2/tests/import v2/tests/lib v2/tests/serp v2/tests/fixtures` + vitest config →
run the 34 pure tests green on main. (Zero backend required; unblocks
everything else while Supabase is being restored.)
