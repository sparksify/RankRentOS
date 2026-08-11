# RANKRENT OS V2 — IMPLEMENTATION MASTER PLAN

Date: 2026-08-11
Status: PLAN ONLY — no implementation performed. Companion to `docs/RANKRENT_V2_AUDIT.md` (Option B accepted).
Inspection performed for this plan: full repo re-inspection, local gitignored-directory check, and **read-only** Supabase inspection via existing credentials. No external system was modified.

---

## 1. Executive Implementation Recommendation

Build V2 inside the existing `RankRentOS` repository on a clean `v2` branch that restructures the root (v0 moves intact to `legacy/v0/`), using Next.js + TypeScript + Convex, in 11 phases (0–10) ordered so that the **evidence/provenance spine exists before any collector, and every collector exists before the score that consumes it**. Port v0's deterministic SERP/domain/demand logic as tested TypeScript. Add exactly two new data integrations for V1: (1) an operator/renter research source (Google Places API recommended) and (2) a provider-neutral AI research layer (one adapter implemented first, interface vendor-neutral). Research runs as a 5-stage cost funnel (free discovery → cheap screen → paid qualification → deep research → due diligence) so paid APIs only touch survivors. The output of V1 is a frozen, immutable `portfolioRuns` record: 8 Low-Hanging + 8 High-Value + 3 Unicorns + 1 North Texas Community × Service cluster thesis (~4–6 sites), every selection traceable to labeled evidence.

**Most urgent non-coding fact:** this plan's inspection confirmed the v0 scored corpus and raw paid SERP cache exist **only on the original development machine** (details in §3). Phase 0 (data preservation) requires a human action before any rebuild and is the exact first task after approval.

## 2. V2 Repository Strategy

**Recommendation: OPTION A — clean V2 structure on a new branch of the existing repo, with v0 relocated to `legacy/v0/`.**

Mechanics (Phase 1, after approval):
1. Branch `v2` from `main`.
2. Single restructure commit: `git mv src app data docs/SPEC.md docs/ARCHITECTURE.md supabase legacy/v0/` (keeps `docs/RANKRENT_V2_AUDIT.md` and this plan at `docs/`). Git history is fully preserved and `git log --follow` works.
3. Scaffold V2 at repo root (`app/`, `convex/`, `lib/`, `tests/`, `data/seeds/`).
4. When V1 reaches its first working scoring run, merge `v2` → `main`. `main` remains the only long-lived branch.

Why not the alternatives:
- **B (`/v2` subdirectory):** creates a permanent nested duality; Vercel/Convex/tooling all want the app at a sane root; "which package.json is real?" confusion forever.
- **C (new GitHub repo):** loses in-place history (the audit, the v0 reference implementation, the seed data lineage), splits issues/branches across repos, and adds zero benefit — v0 in `legacy/` is inert and cannot interfere.

V0 stays runnable from `legacy/v0/` (it has no dependencies) in case a reference comparison against old scoring is ever wanted.

## 3. V0 Data Preservation Manifest

Verified in this session. "This clone" = the fresh cloud checkout of `main`.

| Dataset | Location | Format | ~Records | Git-tracked | Reproducible | Paid | Useful to V2 | Migration method |
|---|---|---|---|---|---|---|---|---|
| Niche seeds (economics assumptions) | `data/niches.json` | JSON | 24 niches | ✅ | ✅ (hand-curated) | ❌ | ✅ High | Import → `services` + HUMAN_ASSUMED observations |
| Curated cities | `data/cities.json` | JSON | 58 | ✅ | ✅ | ❌ | ✅ High | Import → `geographies` |
| National city list | `data/cities-national.json` | JSON | 491 | ✅ | ✅ (public data) | ❌ | ✅ Medium | Import → `geographies` |
| Keyword volume/CPC (curated scan) | `data/volumes.json` | JSON | 1,392 keywords (447 with vol>0) | ✅ | ⚠️ re-buyable (~cheap) | ✅ DataForSEO | ✅ High | Import → `observations` (OBSERVED, source=dataforseo, observedAt≈2026-07) |
| Keyword volume/CPC (national sweep) | `data/volumes-national.json` | JSON | 2,400 keywords | ✅ | ⚠️ re-buyable | ✅ DataForSEO | ✅ High | Same |
| Demand-qualified national survivors | `data/national-survivors.json` | JSON | 669 markets | ✅ | ✅ derivable from volumes | ✅ derived from paid | ✅ Medium | Import → stage-1 survivor flags |
| Google Trends niche stats | `data/trends.json` | JSON | 24 terms, built 2026-07-17 | ✅ | ⚠️ re-buyable (7 calls) | ✅ SerpAPI | ✅ Medium | Import → observations |
| **Raw SERP payloads + trimmed cache** | `data/cache/` (+ `data/cache/raw/`, `data/cache/demand/`) | JSON per query | ~2,000–4,500 files est. (58-city scan ×2 calls + deep checks + national scan) | ❌ **gitignored** | ❌ expensive to re-buy in full | ✅ SerpAPI | ✅ High (SERP evidence + future calibration) | **DOES NOT EXIST IN THIS CLONE — original machine only.** See action below |
| **Scored results / opportunities / portfolio** | `out/results.json`, `out/national-results.json`, `out/opportunities.json`, `out/portfolio.json` | JSON | ~58×24 + ~669 rows | ❌ **gitignored** | ⚠️ recomputable ONLY if `data/cache/` survives | ✅ derived from paid | ✅ High (v0 baseline predictions) | **DOES NOT EXIST IN THIS CLONE — original machine only** |
| Env / API keys | `.env`, `app/.env.local`, `../hermes-os/.env.local` | env | — | ❌ | — | — | keys needed for V2 collectors | Re-provision into Convex env vars (do not copy files) |
| Supabase v0 tables (`runs`/`markets`/`domains`/`pipeline`) | — | — | — | — | — | — | — | **DO NOT EXIST** — see §18. Nothing to export |
| Supabase "RankRent OS" project `app_*` data | project `jhzpmmdyqzynjvkwgdbg` | Postgres | ~64 meaningful rows total | ❌ | mostly ✅ | ❌ (domain prices are from a mock source) | ⚠️ Low (16 North-Texas seeds + one scoring-weight config worth a reference export) | One-time read-only JSON export for reference; then leave untouched |

**MANDATORY PHASE-0 HUMAN ACTION (only Steve can do this):** on the original development machine, from the repo root run roughly:
`tar czf rankrentos-v0-data-$(date +%F).tgz out/ data/cache/` — then preserve it twice (e.g., commit to an orphan `v0-data-archive` branch or a release asset, plus cloud storage). Until this happens, the paid SERP corpus and every v0 prediction baseline are one disk failure from gone. If the directories turn out not to exist on that machine either, record that fact in the archive README — V2 proceeds regardless (fresh SERP pulls are budgeted in the funnel), but calibration against v0 predictions is lost.

## 4. V0 Components to Migrate

Port as TypeScript (never copy JS verbatim), each with unit tests:

| V0 source | Becomes | Notes |
|---|---|---|
| `src/score.js` signal extraction + curated lists (directories, franchises, lead marketplaces, intent-mismatch) | `lib/serp/signals.ts`, `lib/serp/domains-lists.ts` | Crown jewels; outputs typed `SerpSignals` |
| `src/serp.js` | `convex/research/serp.ts` (action) + `lib/providers/serpapi.ts` | Keep trim-and-preserve-raw pattern; raw → Convex file storage |
| `src/demand.js` (autocomplete floor, Trends anchor-rescaling, content-depth crawl) | `lib/providers/serpapi.ts`, `lib/crawl/contentDepth.ts`, `convex/research/{autocomplete,trends}.ts` | Autocomplete also reused for community-name emergence checks |
| `src/volume.js` + `src/national.js` DataForSEO wrapper | `lib/providers/dataforseo.ts` + `convex/research/keywords.ts` | Extend with Related Keywords endpoint (kills `kwUniverse=2.5`) |
| `src/domains.js` (candidates, DNS+RDAP, winner reasoning, age) | `lib/domains/*.ts` + `convex/research/domains.ts` | Add pricing lookup later; availability logic ports as-is |
| `src/strategy.js` `computeEconomics` skeleton | `lib/scoring/leadEconomics.ts` | Constants become versioned labeled assumptions in `scoringModels` |
| `src/portfolio.js` diversity caps + no-padding | `lib/portfolio/select.ts` | Caps become config in `scoringModels` |
| `src/deep.js` variant verification | `convex/research/serpVariants.ts` | Feeds Confidence |
| `whyBullets` narration (page.jsx / dashboard.js) | `lib/explain/narrate.ts` | Signal→plain-English mapping for Opportunity Detail |
| `src/strategy.test.js` patterns | `tests/scoring/*.test.ts` | Directional/boundary test style |
| Seed/paid data files (§3) | `data/seeds/` + import script | Imported as labeled observations |

## 5. V0 Components to Leave Behind

- Pipeline orchestration (`run.js`, `rescore.js`, `value.js`, `national-scan.js` control flow, mutate-in-place files) → replaced by Convex actions + funnel state.
- `computeRankability` as a monolith (decomposed into Score A sub-blocks), `computeAssetValue` blend, `computeArbitrage`, `overall`, `classify()`, `timeTo2k`, 3-tier `computeConfidence`.
- All Supabase code (`sync.js`, `app/lib/config.js`, API routes) and the `supabase/` migration.
- The entire `app/` Next.js v0 UI, both static HTML report generators.
- `env.js` sibling-repo fallback (explicit security removal, §24).
- `docs/SPEC.md` + `docs/ARCHITECTURE.md` as living specs (archived under `legacy/v0/docs/`).

## 6. Proposed V2 Architecture

```
RankRentOS/  (v2 branch → main)
  app/                          # Next.js App Router
    (overview)/page.tsx         # Overview: research status + portfolio progress
    discovery/page.tsx
    opportunities/page.tsx
    opportunities/[id]/page.tsx
    cluster/page.tsx
    portfolio/page.tsx
    data-quality/page.tsx
  components/                   # ScoreChip, EvidenceRow, FunnelBadge, tables
  convex/
    schema.ts
    research/                   # ACTIONS (external I/O only)
      serp.ts  keywords.ts  relatedKeywords.ts  autocomplete.ts
      trends.ts  domains.ts  operators.ts  crawl.ts
      ai/agent.ts               # researchAgent(task, evidence, schema)
      ai/providers/anthropic.ts # first adapter
      ai/tasks/{economics,communityDiscovery,servicePropensity,
               serpNarrative,hypothesisGen}.ts
    funnel.ts                   # stage gating, budget ledger, promotion mutations
    scoring.ts                  # mutations: runScoring(opportunityIds, modelVersion)
    portfolio.ts                # buildPortfolio(modelVersion) → frozen run
    importers/v0.ts             # one-time seed/corpus import
  lib/                          # PURE deterministic TS (no I/O, fully tested)
    serp/signals.ts
    scoring/
      scores/{rankability,demand,intent,leadEconomics,renterDepth,
              assetValue,speed,asymmetry,confidence}.ts
      cluster/{communityGrowth,householdValue,propensity,
               searchEmergence,timeToDemand}.ts
      engine.ts                 # evidence bag → ScoreSet (versioned)
      types.ts
    portfolio/select.ts         # bucket models + caps
    domains/{candidates,pick,age}.ts
    explain/narrate.ts
    providers/{serpapi,dataforseo,places,rdap,census}.ts  # thin HTTP clients
  data/seeds/                   # niches, cities, v0 volume/trends caches, community candidates
  tests/                        # vitest: scoring/, portfolio/, funnel/, providers/ (fixture-based)
  docs/
  legacy/v0/                    # entire v0, untouched
```

Rules carried from the spec: no business logic in React; providers behind `lib/providers` interfaces; AI never inside `lib/scoring`; every score result carries reasons + missing inputs; all weights/thresholds live in `scoringModels` documents, not code constants.

## 7. Convex Schema

Minimal V1 set — 12 tables. (Names indicative; `v.id()` refs shown as →.)

**`services`** — why: the niche/service catalog, including AI-discovered candidates. Fields: `name, slug, synonyms[], category, discoveryType (SEED|AI_DISCOVERY|HUMAN_HYPOTHESIS|...), status (candidate|active|excluded), notes`. Index: `by_slug`, `by_status`. Queries: list active services; dedupe on slug. V1 because opportunities reference it.

**`geographies`** — why: one table for city and community avoids premature layer-cake. Fields: `kind ('city'|'community'), name, state, slug, parentGeographyId?→geographies (community→city), region, lat?, lng?, discoveryType, status`. Static demographics live as observations, not columns. Indexes: `by_slug`, `by_kind_state`, `by_parent`. Queries: cities for scan; communities for cluster view. V1: both opportunity types need it. (No separate `communities` table — a community is `kind:'community'` with community metrics as observations; one fewer entity, same queries.)

**`opportunities`** — why: the fundamental investment hypothesis (Service × Geography). Fields: `serviceId→, geographyId→, type ('general'|'cluster'), discoveryType, funnelStage (0..4), stageHistory[{stage,at,reason}], status (active|eliminated|finalist|selected|rejected), eliminationReason?, primaryKeyword, createdAt`. Indexes: `by_service_geography` (uniqueness), `by_funnelStage`, `by_status`, `by_type`. Queries: funnel boards, stage-gated research batches, opportunity table. V1 core.

**`observations`** — why: the evidence/provenance spine (see §8). Fields: `opportunityId?→, geographyId?→, serviceId?→, metric (string enum), value (number|string|json), rawValue?, unit?, source, sourceUrl?, evidenceType (OBSERVED|DERIVED|AI_ESTIMATED|HUMAN_ASSUMED), confidence (0..1), observedAt, researchRunId?→, rawFileId? (Convex storage), staleAfter?`. Indexes: `by_opportunity_metric`, `by_geography_metric`, `by_service_metric`, `by_researchRun`. Queries: "evidence bag for opportunity X" (scoring input), "stale/missing evidence" (data-quality view). Append-only by convention: no update mutation is ever written for it. V1 foundation.

**`serpSnapshots`** — why: SERPs are structured multi-part evidence; a flat observation row can't hold them queryably. Fields: `opportunityId→, keyword, location, engine, fetchedAt, organic[{pos,title,link,domain}], localPack[{name,rating,reviews,website?}], ads[], signals (typed SerpSignals from lib/serp), rawFileId, cost`. Index: `by_opportunity`, `by_keyword_location`. Queries: detail-page SERP evidence; signal inputs to Score A/G. V1 core.

**`operators`** — why: renter-depth evidence (Score E) is per-business, needed for lists in UI. Fields: `opportunityId→ (or geographyId+serviceId), name, source ('places'|'serp_local_pack'|'ads'), placeId?, rating?, reviews?, website?, phone?, yearsInBusiness?, advertiserSeen (bool), observedAt`. Index: `by_opportunity`. Queries: operator table on detail page; count/quality aggregates into Score E. V1 core (biggest v0 gap).

**`domainCandidates`** — why: Part 13 domain research per finalist. Fields: `opportunityId→, domain, available?, availabilityVia, checkedAt, registrationPrice?, renewalPrice?, ageYears?, pickRank?, pickReasons[], category (CITY_EMD|ALT_EMD|PMD|BRAND)`. Index: `by_opportunity`, `by_domain`. V1: needed for finalists + Asymmetry cost side.

**`researchRuns`** — why: execution history, cost accounting, idempotency, and the Data Quality view. Fields: `kind (serp|keywords|related|trends|autocomplete|operators|domains|crawl|ai:<task>), targetOpportunityIds[]|targetGeographyIds[], params, status (queued|running|done|failed), startedAt, finishedAt?, error?, apiCalls, estCostUsd, provider, requestedBy ('funnel'|'human')`. Indexes: `by_status`, `by_kind`. Queries: progress UI; spend ledger sum; "has this exact research already run?" (idempotency key = kind+target+paramsHash). V1 core.

**`scoringModels`** — why: Part 10 — weights/config are versioned data, not code. Fields: `version (e.g. 'v1.0'), status (draft|active|retired), createdAt, weights {bucket→dimension→weight}, gates {bucket→dimension→min}, constants {funnel benchmarks, thresholds}, assumptions[{name,value,evidenceType,rationale}], changelog`. Index: `by_version`, `by_status`. Immutable once a `scoreRun` references it. V1 core.

**`scoreRuns`** — why: frozen scoring outputs (Part 12). Fields: `opportunityId→, scoringModelVersion, inputObservationIds[], inputsHash, scores {A..I: {value, subScores, reasons[], missingInputs[]}}, clusterScores? {growth, householdValue, propensity, emergence, timeToDemand}, bucketScores {lhf, highValue, unicorn}, computedAt`. Indexes: `by_opportunity_computedAt`, `by_modelVersion`. Never updated; re-scoring inserts a new document. Queries: latest score per opportunity (table view); history. V1 core.

**`portfolioRuns`** — why: the frozen 8/8/4 deliverable + experiment baseline (Part 23). Fields: `scoringModelVersion, createdAt, status (draft|approved), approvedAt?, buckets {lhf[], highValue[], unicorns[], clusterThesis {communityServicePairs[], narrative}}, totals, notes`. Each bucket entry embeds a **`portfolioSelections`** row: `portfolioRunId→, opportunityId→, bucket, rank, bucketScore, scoreRunId→, domainCandidateId?→, selectionReason, assumptions[], risks[], confidence`. Index: `by_portfolioRun`, `by_opportunity`. Approval sets `status:'approved'`; no mutation may modify an approved run (enforced in the mutation + tested). V1 deliverable.

**`budgetLedger`** — why: hard cost control (§13). Fields: `researchRunId→, provider, usd, at`. Query: sum per stage/provider; funnel gate reads remaining budget. (Could live inside researchRuns; separate table keeps append-only accounting trivial.) V1 core.

Deliberately excluded from V1: users/workspaces (single operator + simple password), jobs/tasks/executions hierarchy (researchRuns suffices), businesses-as-global-entities/identity resolution (operators are per-opportunity), assets/leads/revenue/outcomes (post-build).

## 8. Evidence / Provenance Model

Every material number enters the system as an `observations` document (or a `serpSnapshots` structure) carrying: metric, raw value, normalized value, unit, source, sourceUrl, collection timestamp, staleness horizon, evidence type, confidence, and its opportunity/geography/service association. Conventions:

- **Metric registry** in `lib/scoring/metrics.ts`: a typed enum of every metric the scoring engine may consume (e.g. `kw.volume.exact`, `kw.volume.universe`, `kw.cpc`, `serp.signals.*`, `ops.count.viable`, `ops.reviews.median`, `econ.ticket.avg`, `econ.margin.gross`, `econ.lead.value`, `community.homes.planned`, `community.homes.remaining`, `community.price.median`, `emergence.trend.communityName`, …) with expected unit + evidence-type expectations. Prevents stringly-typed drift.
- **Evidence types:** OBSERVED (came off an API/page), DERIVED (deterministic computation over observed inputs — records the formula id), AI_ESTIMATED (LLM research; must carry ≥1 sourceUrl citation and the researchRun ref), HUMAN_ASSUMED (entered/confirmed by Steve; carries rationale).
- **Append-only:** re-collection appends with newer `observedAt`; scoring reads "latest non-stale per metric" via `by_opportunity_metric` + timestamp; history stays queryable.
- **Design order:** schema + metric registry + import of v0 data as observations happen in Phase 1, before any score function exists. The scoring engine consumes only evidence bags; it can never invent a number without a metric-registry entry.

## 9. Opportunity Model

- Unit: **Service × Geography** — covers both `Pool Builder × Frisco` (general, geography kind=city) and `Pool Builder × Windsong Ranch` (cluster, kind=community). One model, two `type` values; cluster opportunities additionally get cluster-dimension observations and scores.
- Lifecycle = **funnel stage** (0 discovery → 4 due diligence) + status. Elimination is recorded with reason, never deleted — the Discovery view shows the funnel honestly, and "what did we discard and why" remains answerable.
- Every opportunity records `discoveryType` (SEED | AI_DISCOVERY | SEARCH_ANOMALY | COMMUNITY_DISCOVERY | HUMAN_HYPOTHESIS | DATA_ANOMALY | OTHER) so we can later measure which discovery channels produce winners.
- The thesis text ("what is it, why did we find it") is generated by `lib/explain/narrate.ts` from signals + an AI narrative pass, stored on the scoreRun's reasons, not hand-maintained.

## 10. AI Research Architecture

Provider-neutral, minimal:

```ts
// convex/research/ai/agent.ts
interface ResearchProvider {
  complete(req: {system: string; user: string; schema: JsonSchema;
                 maxTokens?: number}): Promise<{json: unknown; usage: TokenUsage}>
}
async function researchAgent<T>(task: ResearchTask, evidence: EvidenceBag,
                                schema: ZodSchema<T>): Promise<AiFinding<T>[]>
```

- One `ResearchProvider` interface; V1 implements a single adapter (Anthropic first — key already in the ecosystem; the adapter is ~60 lines, so adding OpenAI later is trivial). Model id + prompt version recorded on each researchRun.
- `researchAgent` always: (1) receives existing evidence so it doesn't re-research knowns, (2) returns **schema-validated structured output**, (3) requires each claimed fact to include `sourceUrl` + its own confidence, (4) writes results as AI_ESTIMATED observations via a mutation — never directly into scores.
- V1 AI tasks (each a file in `convex/research/ai/tasks/`):
  - `economics.ts` — per-service ticket/margin/close-rate research with citations (Score D inputs).
  - `communityDiscovery.ts` — North Texas MPC/development sweep → structured community records flagged "verify".
  - `servicePropensity.ts` — evidence synthesis for new-home purchase timing (0–6/6–12/12–24 mo).
  - `serpNarrative.ts` — "why is this SERP beatable" narrative over deterministic signals.
  - `hypothesisGen.ts` — candidate service/geography hypotheses outside the seed lists (feeds Stage 0 with discoveryType AI_DISCOVERY).
- AI web access: use the provider's native web-search/tool capability where available; otherwise the agent runs against fetched page text supplied by `crawl.ts`. Decision deferred to Phase 5 implementation detail; interface unchanged either way.

## 11. External Data Sources

| Need | V1 source | Status | Est. cost | Notes |
|---|---|---|---|---|
| SERP + local pack + ads | SerpAPI (existing wrapper) | keep | ~$0.01–0.015/query | Consolidation onto DataForSEO SERP is a cost optimization, not V1-blocking; keep SerpAPI to reuse code + cache format |
| Autocomplete | SerpAPI | keep | ~same | Also community-name emergence probe |
| Trends | SerpAPI Google Trends | keep | few calls | Add metro-level geo + community-name timelines |
| Keyword volume/CPC | DataForSEO Google Ads | keep | ~$0.05/1k keywords | |
| Related keywords / universe | DataForSEO Labs (Related Keywords / Keyword Ideas) | **new endpoint, existing account** | ~$0.01–0.1/query | Replaces `kwUniverse=2.5` |
| Domain availability/age | RDAP + DNS | keep | free | |
| Domain pricing | Registrar API (Porkbun or Namecheap) — Stage 4 only, or manual lookup for ≤30 finalists | new, optional | free API | Manual acceptable for V1 |
| Operators/renter depth | **Google Places API (Text Search + Place Details)** | **NEW — recommended** | $200/mo free credit ≈ 6k searches; V1 fits inside free tier | Fallback: DataForSEO Business Data if Places terms/quota bite |
| Backlink/authority proxies | Free proxies first: domain age (RDAP), indexed-page count (`site:` via SerpAPI), content depth, brand-search presence. DataForSEO Backlinks only if Stage-3 evidence shows proxies insufficient | defer decision | $0 vs ~$0.02/domain | Explicit V1 posture: **do not buy an authority API up front** |
| Demographics/income/growth | Census ACS + PEP APIs | new, free | free | Block-group income for communities' parent areas |
| Housing/construction velocity | Census Building Permits Survey (place/county monthly) | new, free | free | North Texas places are well covered |
| Community/MPC facts (planned homes, builders, prices) | AI research over developer/builder sites + RCLCO/John Burns MPC rankings + local news, each fact cited + human-verified | AI + manual | ~LLM tokens | No real-estate data platform in V1 |
| Economics (ticket/margin/close) | AI research (industry cost guides, franchise disclosure documents, trade pubs) + Steve's judgment | AI + manual | tokens | Every figure labeled AI_ESTIMATED or HUMAN_ASSUMED |

## 12. Data Acquisition Funnel

| Stage | Name | Input | Data used | Cost/opportunity | Elimination rules (v1 defaults, live in `scoringModels`) | Output |
|---|---|---|---|---|---|---|
| **0** | Discovery | Seeds (24 niches × 58 cities), v0 survivor list, AI hypotheses, human hypotheses, community discovery | Free: existing imported data, AI generation (token cost only) | ~$0 | none — everything enters as a candidate with discoveryType | `opportunities` at stage 0 (~1,500–2,500 candidates) |
| **1** | Cheap screen | Stage-0 candidates | Cached/imported volume+CPC where fresh-enough (≤12 mo for triage), autocomplete (1 cheap call) for cache misses that matter, service economics floor from seeds | <$0.01 | vol=0 AND no autocomplete activity → eliminate `no_demand_signal`; CPC null/0 AND no ads history → flag; assumed ticket×margin below floor → eliminate `economics_floor`; obvious brand-loyalty/excluded categories → eliminate | ~200–400 survivors at stage 1 |
| **2** | Qualification | Stage-1 survivors | Fresh DataForSEO volume/CPC batch (cheap in bulk), related-keyword universe for the primary term, Trends direction | ~$0.05–0.15 | universe volume below bucket-specific floor → eliminate; CPC > $16 war zone → flag (not auto-kill for High-Value); negative multi-year trend → flag | ~80–150 survivors at stage 2 |
| **3** | Deep research | Stage-2 survivors (cap: top ~100 by provisional demand×economics) | SERP snapshot + variant check (2–3 SerpAPI calls), content-depth crawl (free), domain availability (free), **Places operator pull (1–2 searches)**, AI economics research (once per service, amortized) | ~$0.10–0.30 | Rankability signals below floor AND bucket gates unmet → eliminate; <2 plausible operators → eliminate `renter_depth` (Unicorn exempt with justification); no viable domain path → flag | ~40–60 scored finalists |
| **4** | Due diligence | Bucket-model top ~35 (LHF top12, HV top12, Unicorn top8, cluster pairs) | Second/third keyword-variant SERPs, full operator detail pull, domain pricing, AI SERP narrative, cluster deep-dive, human verification queue | ~$0.50–1.50 | human review; confidence gates; diversity caps at selection | Frozen `portfolioRun` |

Total projected external research spend for V1: **~$75–200** (SerpAPI ~$30–80, DataForSEO ~$10–30, Places free tier, AI tokens ~$30–80). Well under the experiment's scale.

## 13. Cost-Control Strategy

- **Budget object per stage** in `scoringModels.constants` (defaults: stage2 ≤ $30, stage3 ≤ $75, stage4 ≤ $60, AI ≤ $80, total hard cap **$250**). `convex/funnel.ts` refuses to enqueue a researchRun whose `estCostUsd` would exceed the remaining stage budget; every run writes actuals to `budgetLedger`.
- **Idempotency:** researchRun key = `(kind, target, paramsHash)`; a completed identical run is returned from cache, not re-bought. Raw payloads stored → re-parsing is free forever.
- **Stage gating is enforced in code**, not convention: `research/serp.ts` etc. assert `opportunity.funnelStage >= requiredStage` (tested — see §23 COST/FUNNEL tests).
- **Freshness policy** per metric (registry): volume 90d, SERP 45d, domains 7d at selection time, community facts 180d. Stale evidence lowers Confidence rather than silently blocking.
- AI calls record token usage → USD on the ledger like any provider.

## 14. A–I Scoring Architecture

`lib/scoring/engine.ts`: `score(evidenceBag, model: ScoringModel) → ScoreSet` — pure, deterministic, versioned. Each dimension is its own module returning `{value: 0–100, subScores, reasons: string[], missingInputs: MetricId[]}`. Identical evidence + identical model version ⇒ identical output (property-tested).

- **A Rankability** (`rankability.ts`): sub-blocks — `serpComposition` (ported v0 signals: directories, inner pages, intent mismatch, out-of-town, franchises), `localPack` (size, review strength, no-website count), `onPage` (title targeting, content depth; H1/schema from crawl where available), `authorityGap` (proxy: competitor domain age + indexed-page count + directory share; explicit `missingInputs` when proxies only), `domainOpportunity` (EMD/PMD availability), plus a required `whyBeatable` reasons array. Weights per sub-block from model config.
- **B Demand** (`demand.ts`): exact volume, related-keyword universe volume (measured, replaces ×2.5 — the constant survives only as a labeled fallback assumption when the related-keyword call hasn't run, and Confidence drops accordingly), autocomplete floor, trend direction/seasonality, query diversity count.
- **C Commercial Intent** (`intent.ts`): CPC banding, advertiser presence, transactional-language share of the keyword universe (deterministic term classifier: quote/cost/near-me/emergency patterns), service urgency flag from service seed.
- **D Lead Economics** (`leadEconomics.ts`): ported funnel math over evidence-backed ticket/margin/close observations; outputs gross-profit-per-job, estimated qualified-lead value, acceptable CAC. Every constant it reads is an assumption row in the model.
- **E Renter Depth** (`renterDepth.ts`): viable-operator count (rating ≥ threshold, reviews ≥ floor, has website ≠ required), maturity distribution, advertiser overlap, plausible-renter count ≥2 preference, absorption heuristic (jobs/mo capacity vs projected lead flow).
- **F Asset Value** (`assetValue.ts`): projected qualified-lead volume × lead value × renter-market ability to pay → plausible rent band; exclusivity/territory bonus; **no rankability inputs** (enforced by its input type).
- **G Speed** (`speed.ts`): SERP weakness intensity, long-tail availability, geographic specificity, domain exactness, demand-now vs emerging → expected weeks-to-first-signal class.
- **H Asymmetry** (`asymmetry.ts`): `upside = plausible 24-mo rent value × P(rank proxy from A)`; `costToTest = domain reg+renewal + build estimate (assumption) + carry`; score from upside/cost ratio + rarity bonuses (domain scarcity, emerging demand, unusual SERP anomalies). Replaces v0 Arbitrage.
- **I Confidence** (`confidence.ts`): computed from the evidence bag itself — evidence-type mix (share OBSERVED vs AI_ESTIMATED vs HUMAN_ASSUMED, weighted by each dimension's materiality), freshness, source agreement (e.g., CPC vs ads presence coherence), missingInputs count. Output 0–100 + HIGH/MED/LOW display band + list of the weakest links.

## 15. Cluster-Specific Scoring

`lib/scoring/cluster/` — computed only for `type:'cluster'` opportunities and community geographies:

- **Community Growth** — planned homes, remaining %, permits velocity (Census BPS for parent place/county), builder count, announced infrastructure. Mostly OBSERVED/AI_ESTIMATED.
- **Household Value** — new-home price band (builder sheets), ACS income for surrounding block groups, discretionary-spend proxy (price × income banding).
- **New-Home Service Propensity** — per Service: probability-of-purchase classes for 0–6 / 6–12 / 12–24 months, from `servicePropensity.ts` AI synthesis + any survey/industry evidence; always carries AI_ESTIMATED or HUMAN_ASSUMED labels; drives the Community × Service matrix more than raw keyword volume does.
- **Search Emergence** — community-name Trends slope, autocomplete presence for `<service> <community>` and `<community>` itself, indexed-page growth (`site:`-style counts over time once we have 2 datapoints; first run stores the baseline), local business entry (Places results mentioning the community). Output classes: ABSENT vs EMERGING vs PRESENT — explicitly designed so zero keyword volume does **not** read as no demand.
- **Time-to-Demand** — deterministic classifier over Growth + Emergence + delivery velocity → NOW / NEAR_TERM / EARLY / SPECULATIVE.

Community × Service bucket score = weighted blend defined in the model config (cluster weight vector), never averaged with the general buckets.

## 16. Bucket-Specific Selection Models

`lib/portfolio/select.ts`. Three (plus cluster) weight vectors + gates in `scoringModels` v1.0 defaults:

| Dimension | LHF weight | HV weight | Unicorn weight |
|---|---|---|---|
| Rankability | 0.25 | 0.10 gate ≥40 | 0.10 |
| Speed | 0.20 | — | — |
| Demand | 0.15 | 0.10 | 0.05 |
| Commercial Intent | 0.15 | 0.15 | 0.05 |
| Lead Economics | 0.10 gate | 0.25 | 0.10 |
| Renter Depth | 0.10 gate ≥2 ops | 0.15 | 0.10 |
| Asset Value | 0.05 | 0.25 | 0.20 |
| Asymmetry | — | — | 0.30 |
| Confidence | multiplier* | multiplier* | 0.10 + floor |

\*Confidence acts as a dampener (score × (0.7 + 0.3·I/100)) for LHF/HV so assumption-castles sink; for Unicorns it is also a scored dimension with a hard floor (default ≥35) because "surprising" must still be evidenced. Gates: LHF requires plausible rent ≥ ~$500/mo (soft floor toward the $750–1,500 target); HV requires plausible rent ceiling ≥ $1,500. All numbers are v1.0 hypotheses in config — changing any of them is a new model version.

Diversity caps (ported + extended): ≤1 per exact city×service, ≤4 per service across the whole portfolio, ≤6 per state outside the intentional North-Texas cluster, ≥3 discoveryTypes represented among the 20 if quality permits. **No padding:** a bucket ships short before it ships junk.

## 17. Discovery System

Stage-0 intake from six channels, all writing `opportunities` with `discoveryType`:
1. **SEED** — importer crosses the 24 v0 niches × 58 curated cities (+ the 669 national survivors as pre-screened seeds).
2. **AI_DISCOVERY** — `hypothesisGen.ts` prompted with: the seed list *to avoid duplicating it*, the scoring dimensions, and instructions to propose services/geographies **outside** current thinking (guarding §32); returns candidates with rationale.
3. **SEARCH_ANOMALY** — deterministic sweep of imported keyword data for oddities (high CPC + low competition, volume spikes vs trend).
4. **COMMUNITY_DISCOVERY** — the North Texas community sweep (§18) generating Community × Service pairs.
5. **HUMAN_HYPOTHESIS** — a simple "add hypothesis" form in the Discovery UI.
6. **DATA_ANOMALY** — reserved enum value; no V1 automation beyond (3).

No generalized crawler. The channel field is the point: V2 will eventually learn which channels produce winners.

## 18. Existing Supabase Data (inspection findings) & North Texas Community Research System

**Supabase findings (read-only, this session):** four projects visible. No project named "LeadGenScout". The active **"RankRent OS"** project (`jhzpmmdyqzynjvkwgdbg`, created 2026-07-19) contains a **different prototype's schema** — 28 `app_*` tables (opportunities, domain queues, deployment jobs, tenant prospects, scoring models…) that this repo's code never references. It is nearly empty: 16 North-Texas discovery seeds (Concrete Leveling/Foundation Repair × Frisco/McKinney etc.), 1 "Rentability-First v2" scoring-weight config, 32 domain candidates from a **mock registrar source**, a handful of settings rows; every substantive table (opportunities, research runs, evaluations, pipeline) has 0 rows. The v0 tables (`runs`/`markets`/`domains`/`pipeline`/`site_outcomes`) exist in **no accessible project**; the two remaining projects are INACTIVE (paused) with unrelated names and cannot be queried while paused. **Migration recommendation:** take a one-time reference JSON export of `app_discovery_seeds`, `app_scoring_models`, `app_domain_candidates` (interesting priors: another attempt's seed niches + weight choices), then leave the project untouched; nothing else there is worth migrating, and nothing from v0 can be recovered from Supabase — which elevates the Phase-0 local-machine archive (§3) from "important" to **the only copy**.

**North Texas Community Research workflow (pragmatic, not a platform):**
1. `communityDiscovery.ts` AI sweep: "enumerate master-planned communities / major active developments in Collin, Denton, Grayson, Rockwall (+DFW-north edge) with >500 planned homes or luxury positioning" — sources: RCLCO/John Burns annual MPC rankings, developer sites (Hillwood, PMB, Republic, Huffines…), builder division pages, DFW real-estate press. Output: structured community records (planned/completed/remaining homes, price band, builders, developer, expected buildout) — each field cited, each flagged `verify:true`.
2. Human verification pass in the Cluster UI (accept/correct/reject per fact) → fields flip to HUMAN_ASSUMED-confirmed or stay AI_ESTIMATED.
3. Deterministic enrichment: Census ACS income + BPS permits for parent places; Trends + autocomplete on community names.
4. Service shortlist: `servicePropensity.ts` researches the "first-24-months purchases of affluent new-construction buyers" question generically (not just the casual list), returns ranked service candidates with evidence.
5. Cross product: top ~6–10 communities × top ~5–8 services → cluster opportunities → normal funnel stages 3–4 (SERP, operators around each community's city, domains like `<community><service>.com` / `<service><community>.com`) + cluster scores.
6. Cluster thesis assembly: best coherent 4–6 Community × Service pairs (caps: ≤2 per community, ≤3 per service) → the portfolio's 4th Unicorn slot.

## 19. Operator / Renter Research System

- **Source decision: Google Places API** (Text Search `"{service} near {city/community}"` + Place Details for rating/reviews/website/phone). Rationale: authoritative review data, generous free tier covers V1 volume (~150 finalists × 1–2 searches + ~10 detail calls), trivial client. Fallback documented: DataForSEO Business Data (no Google ToS surface, similar fields) if quota/terms become a problem — behind the same `lib/providers/places.ts` interface either way.
- Enrichment: cross-reference SERP ads/local-pack (already captured) to set `advertiserSeen`; content-depth crawler doubles as operator-website quality check for the top operators.
- Deterministic aggregation into Score E: viable count, median reviews, maturity mix, ≥2-plausible-renters flag, advertiser share.
- Stage-3 only (never run on unqualified candidates).

## 20. Domain Research System

Port v0 wholesale (`lib/domains/`): candidate generation (city/community × domainTerms permutations + "pros" fallback), DNS→RDAP availability, winner ranking with reasons, competitor domain age. V1 additions: community-name patterns for cluster opportunities; registration/renewal pricing at Stage 4 (registrar API if trivial, else a manual-entry field in the finalist UI — human-in-the-loop is acceptable per §15 of the brief); Wayback-based spam-history check as a stretch item, not a blocker. Domain cost feeds Score H's denominator.

## 21. Portfolio Selection System

`convex/portfolio.ts` `buildPortfolio(modelVersion)`:
1. Load latest scoreRun per active stage-4 opportunity.
2. Compute the three bucket rankings + cluster assembly (§16, §18).
3. Apply gates → caps → fill buckets (no padding).
4. Write a `portfolioRuns` draft with per-selection reason, assumptions, risks, confidence, recommended domain.
5. Human review in the Portfolio UI: swap/reject with recorded reason → new draft run (drafts are cheap; each is a full document).
6. **Approve** → `status:'approved'`, timestamp; the run and its referenced scoreRuns/observations become the immutable experiment baseline (Part 23). Guard: no mutation path exists that edits an approved run; re-selection creates a new run. Tested.

## 22. UI Plan

Next.js + Tailwind + shadcn/ui, Convex `useQuery` for live reactivity. Seven routes (§6). Deliberately thin:
- **Overview** — funnel counts per stage, budget spent vs cap, portfolio status, last research activity.
- **Discovery** — candidate table with discoveryType + stage + elimination reasons; "add hypothesis" form; promote/eliminate controls.
- **Opportunities** — the comparison table: service, geography, type, A–I chips, bucket scores, confidence band; sort/filter; column set from Part 24 of the brief.
- **Opportunity Detail** — thesis narrative, score breakdown with reasons + missingInputs, SERP evidence (positions, signals, "why beatable"), keyword universe, economics with evidence-type badges, operator list, domain candidates, assumptions list, risks, every observation's source+timestamp.
- **Cluster** — community cards (growth/household/emergence chips), service shortlist, Community × Service matrix heat-grid, time-to-demand tags, verification queue for AI-extracted facts.
- **Portfolio** — the 8/8/3+1 with per-selection explanation; draft vs approved states; approve button.
- **Data Quality** — missing/stale/low-confidence evidence by opportunity; assumption-heavy warnings; failed researchRuns.
Auth: single-password middleware (v0 pattern, rewritten cleanly) — adequate for one user; Convex Auth is a later swap.

## 23. Testing Plan

Vitest; fixtures over mocks-of-mocks. Materiality-ordered:
1. **SCORING** — golden evidence bags → exact expected ScoreSets for each dimension; directional tests (weaker SERP ⇒ higher A; more assumptions ⇒ lower I); determinism property test (same bag + version ⇒ identical output, hash-compared).
2. **VERSIONING** — re-scoring under model v1.1 inserts new scoreRuns and leaves v1.0 documents byte-identical; approved portfolioRuns reject mutation.
3. **PORTFOLIO** — caps, gates, no-padding (feed 5 qualifying LHF ⇒ bucket of 5), deterministic tie-breaks, cluster assembly caps.
4. **PROVENANCE** — every score's inputs resolve to observation ids; a metric outside the registry throws; AI_ESTIMATED without sourceUrl is rejected at the mutation boundary.
5. **COLLECTORS** — recorded provider fixtures (SerpAPI, DataForSEO, Places, RDAP) → normalized observations; malformed-payload handling.
6. **COST/FUNNEL** — stage-3 collector invoked on a stage-1 opportunity throws; budget-exceeded enqueue refused; idempotent re-run returns cache without ledger entry.
7. **CONFIDENCE** — observed-heavy vs assumption-heavy bags with equal headline scores produce materially different I (asserted spread).
No UI e2e for V1; component smoke tests only where a table's sorting logic is nontrivial.

## 24. Security / Secrets

- All provider keys (SerpAPI, DataForSEO, Google Places, AI provider) live in **Convex environment variables** (dashboard-set), read only inside actions; never in the Next.js bundle, never in git.
- Next.js needs only `CONVEX_URL` (public) + `APP_PASSWORD` (Vercel env).
- The v0 `../hermes-os/.env.local` fallback is **not ported**; V0's `.env` keys should be rotated if they were ever shared with other projects (the v0 code deliberately read a sibling repo's keys — treat them as shared).
- `.gitignore` for V2 excludes env files; a `env.example` documents required names.
- Supabase credentials become unnecessary after the Phase-0 reference export; remove from all env stores at that point.

## 25. V0 → V2 Migration Plan

1. **Phase 0 (human):** archive `out/` + `data/cache/` from the original machine (§3). Reference-export the 3 Supabase `app_*` tables. Nothing deleted anywhere.
2. **Phase 1:** repo restructure (`legacy/v0/`), V2 scaffold.
3. **Phase 2:** `convex/importers/v0.ts` ingests: niches → `services` (+ economics as HUMAN_ASSUMED observations), cities → `geographies`, volumes/volumes-national → keyword observations (OBSERVED, observedAt from file provenance ≈ 2026-07, marked stale-for-selection but valid-for-triage), trends → observations, survivors → stage-1 pre-screen flags. If the Phase-0 archive materializes: raw SERP payloads → serpSnapshots (historic, non-selectable) and v0 `out/*.json` scores → a `v0Baseline` reference file in `data/seeds/` for future calibration (no schema needed yet).
4. Code migration proceeds per §4 inside Phases 2–7; nothing in `legacy/v0/` is ever imported at runtime.

## 26. Implementation Phases

Complexity scale: S (<½ day), M (½–1.5 days), L (2–4 days) of focused agent implementation.

**PHASE 0 — PRESERVE V0 DATA** *(blocks nothing except calibration; do first anyway)*
Objective: the §3 archive + Supabase reference export. Modules: none (ops). Schema: none. External: original dev machine (HUMAN REQUIRED), Supabase read-only. Tests: checksum listing in archive README. Done when: archive exists in two locations, or the absence of the directories is documented. Complexity: S. Human: **yes — only Steve can reach that machine**.

**PHASE 1 — V2 FOUNDATION + EVIDENCE SPINE**
Objective: restructure repo (§2), scaffold Next.js+Convex+Vitest, define `schema.ts` (all 12 tables), metric registry, provenance mutation layer (append-only observation writes, AI-citation guard), password auth shell. Depends: approval. External: Convex project creation (free tier). Tests: provenance tests (§23.4), schema round-trips. Done when: `pnpm test` green; empty app deploys; observations can be written/read with full provenance. Complexity: L. Human: Convex account/project creation + env keys (5 min).

**PHASE 2 — V0 IMPORT + COLLECTOR MIGRATION**
Objective: importer (§25.3) + port SerpAPI/DataForSEO/autocomplete/Trends/RDAP/crawl collectors as actions writing observations; SERP signal extraction (`lib/serp/signals.ts`) with fixture tests; researchRuns + budgetLedger + idempotency. Depends: P1. External: SerpAPI + DataForSEO keys in Convex env (no paid calls yet beyond a smoke test batch ≤$1). Tests: collector fixtures, cost/funnel guards, signal extraction goldens (reuse real cached SERPs from the archive if available). Done when: one real opportunity can be researched end-to-end for <$0.05 with every datum provenance-tagged. Complexity: L. Human: provide keys.

**PHASE 3 — RELATED-KEYWORD UNIVERSE + OPERATOR RESEARCH** *(the two new capabilities)*
Objective: DataForSEO Related Keywords collector (universe demand); Google Places operators collector + Score-E aggregation inputs; `operators` UI-ready data. Depends: P2. External: enable Places API (HUMAN: Google Cloud project + key, ~10 min). Tests: fixtures + viable-operator aggregation. Done when: a finalist-shaped opportunity has measured universe volume + an operator roster. Complexity: M. Human: Places key.

**PHASE 4 — DETERMINISTIC SCORING ENGINE (A–I)**
Objective: all nine dimension modules + engine + `scoringModels` v1.0 seed document + scoreRun freezing. Depends: P2 (P3 for full E/B inputs; modules ship with missingInputs handling regardless). Tests: §23.1–2, 7 — the largest test surface in V1. Done when: scoring the P2 smoke opportunity yields a full explained ScoreSet, reproducible, frozen. Complexity: L. Human: none (weights ship as recommended defaults, §27).

**PHASE 5 — AI RESEARCH LAYER**
Objective: `researchAgent` + provider adapter + tasks (economics, serpNarrative, hypothesisGen); AI observations flow with citations. Depends: P1 spine; P4 to consume outputs. External: AI provider key. Tests: schema-validation rejection paths, citation guard, cost recording (live-call smoke ≤$1). Done when: one service has AI-researched economics with sources, visible in evidence. Complexity: M. Human: provider key + pick (default: Anthropic, §27).

**PHASE 6 — DISCOVERY FUNNEL**
Objective: `convex/funnel.ts` stages 0–4, elimination rules from model config, stage boards, seed/AI/human/anomaly intake channels. Depends: P2, P4, P5. Tests: §23.6 + elimination-rule goldens. Done when: full seed corpus loads at stage 0 and stages 1–2 run within budget producing a survivor set with recorded eliminations. Complexity: M. Human: none.

**PHASE 7 — NORTH TEXAS CLUSTER SYSTEM**
Objective: community discovery AI task + verification workflow, Census ACS/BPS collectors, propensity task, emergence probes, cluster scoring modules, Community × Service generation. Depends: P5, P4, P6. Tests: cluster-score goldens, time-to-demand classifier. Done when: ≥8 discovered communities with verified-or-flagged facts and a scored Community × Service matrix exist. Complexity: L. Human: **yes — fact verification pass (~1–2 hrs)**.

**PHASE 8 — BUCKET SELECTION + PORTFOLIO**
Objective: `lib/portfolio/select.ts` + `buildPortfolio` + immutable approval. Depends: P4, P6, P7. Tests: §23.3 + baseline-immutability. Done when: a draft 8/8/3+1 generates from whatever finalists exist, with explanations. Complexity: M. Human: none until approval.

**PHASE 9 — UI**
Objective: the seven screens (§22), built against live Convex queries. Depends: usable from P6 onward; final polish after P8. Tests: minimal (§23). Done when: every §33 success question is answerable on-screen for a finalist. Complexity: L. Human: none.
*(Note: build Overview/Discovery/Data-Quality early — during P6 — so research runs are observable; Opportunities/Detail/Cluster/Portfolio land with their engines. Listed as one phase, executed as two slices.)*

**PHASE 10 — RESEARCH EXECUTION + HUMAN VERIFICATION + FINAL PORTFOLIO**
Objective: run the funnel for real across all channels; stage-4 due diligence; Steve verifies flagged facts, adjusts HUMAN_ASSUMED entries, reviews draft portfolio, approves. Depends: everything. External: the real ~$75–200 research spend. Done when: an **approved** portfolioRun exists answering all §33 questions. Complexity: M (mostly runtime + review). Human: **yes — verification + approval (~½ day)**.

Dependency-driven deviations from the brief's sketch: scoring (P4) lands before the funnel (P6) because elimination rules reuse score sub-functions; AI layer (P5) sits between them because Stage-0/economics need it; UI is sliced rather than last.

## 27. Human Decisions Required

Only decisions where business judgment changes outcomes. **All have defaults; implementation can proceed on every default without waiting.**

1. **Total V1 research budget cap.** Matters: bounds funnel breadth. Default: **$250 hard cap** (projection $75–200). Consequence: lower cap → fewer stage-3 finalists → thinner Unicorn tail. Proceed on default: ✅.
2. **Scoring model v1.0 weights/gates (§16 table).** Matters: directly shapes the portfolio. Default: ship the table as v1.0. Consequence: they're hypotheses by design; versioning makes revision cheap and auditable. Proceed: ✅ (review the draft portfolio, not the weights, unless something looks systematically off).
3. **LHF minimum plausible rent.** Matters: kills/admits small easy markets. Default: soft floor $500/mo plausible, target band $750–1,500. Consequence: hard $750 floor would discard fast cheap validation experiments. Proceed: ✅.
4. **Category exclusions.** Matters: e.g., v0 lore says avoid brand-loyalty niches (salons), roofing/solar PE wars, YMYL-adjacent services. Default: exclude v0's known-avoid list; log every exclusion as an eliminated candidate with reason. Proceed: ✅ — flag list shown in Data Quality for veto.
5. **Google Places adoption** (new Google Cloud dependency). Matters: Score E quality. Default: yes, free tier. Consequence of no: fall back to DataForSEO Business Data (slightly weaker reviews fidelity). Proceed: ✅ but needs the key from Steve at P3.
6. **AI provider first adapter.** Default: Anthropic. Consequence: none long-term (interface is neutral). Proceed: ✅ — needs a key at P5.
7. **v0 API keys rotation** (they were shared with a sibling project). Default: rotate SerpAPI/DataForSEO keys when provisioning Convex env. Proceed: ✅ — 10 minutes of Steve's time at P2.
8. **Ranking-horizon tolerance for High-Value** (how hard is "acceptable rankability"). Default: gate A ≥ 40 with no time cap; HV explicitly accepts 6–12+ month horizons. Consequence: raising the gate converges HV toward LHF. Proceed: ✅.
9. **Phase 0 archive** — not a decision but the one blocking human *action*: only Steve can archive the original machine's `out/` + `data/cache/`.

## 28. Risks / Unknowns

- **v0 evidence may already be lost** — if the original machine's gitignored dirs are gone, the paid SERP corpus and v0 prediction baseline are unrecoverable (Supabase holds nothing, confirmed). Mitigation: none retroactive; V1 budget covers fresh pulls; calibration story starts at V2's own baseline.
- **Hyper-local zero-volume trap** — community-level tools will read 0; the Emergence design must be validated against known-good cases (e.g., does `pool builder prosper` behave as expected) before trusting ABSENT verdicts. Built into P7 tests.
- **AI-researched community/economics facts are the softest inputs** — mitigated by mandatory citations, verify flags, human pass (P7/P10), and Confidence dampening; residual risk acknowledged: the cluster thesis will carry lower Confidence than general picks, correctly.
- **Places API terms/quota** — fallback provider identified behind the same interface.
- **Funnel calibration unknowns** — elimination thresholds at stages 1–2 are guesses until the first run; mitigation: every elimination is recorded and reversible (re-promote), and thresholds live in versioned config.
- **Convex free-tier limits** (function runtime for long batches) — mitigated by small-batch actions + scheduler chaining; V1 volumes are far below limits.
- **Scope creep toward the old seven-engine vision** — the non-goals list (§25 of the brief) is restated in the repo README of V2; any PR adding operational features is out of scope by definition.

## 29. Estimated Complexity

| Slice | Complexity |
|---|---|
| Foundation + spine (P1) | L |
| Import + collectors (P2) | L |
| New integrations (P3) | M |
| Scoring engine (P4) | L |
| AI layer (P5) | M |
| Funnel (P6) | M |
| Cluster (P7) | L |
| Portfolio (P8) | M |
| UI (P9) | L |
| Execution + review (P10) | M (elapsed time dominated by human review) |

Rough total: ~10–14 focused implementation days plus Steve's ~1 day of verification/approval across P0/P7/P10, plus $75–200 research spend. Largest single risk to schedule: P7 (most novel, most AI-dependent).

## 30. Definition of Done

V1 is done when:
1. An **approved, immutable** `portfolioRuns` document exists containing 8 LHF + 8 HV + 3 Unicorns + 1 cluster thesis (4–6 Community × Service pairs) — or fewer per bucket with recorded shortfall reasons (quality over quota).
2. Every selection answers all §33 questions in the UI, with every material number traceable to observations carrying source, timestamp, and evidence type.
3. Identical evidence + model version reproduces identical scores (test-proven).
4. Total research spend is visible in the ledger and ≤ the cap.
5. The baseline is protected: no code path can mutate an approved run (test-proven).
6. v0 remains intact under `legacy/v0/` and the Phase-0 archive status is documented.

## 31. Exact First Implementation Task After Approval

**Task 0 (Steve, ~15 min, before or in parallel with any coding):** on the original dev machine run the §3 archive command for `out/` + `data/cache/` and store the tarball in two places; reply with "archived" or "directories missing".

**Task 1 (first coding task):** on branch `v2`:
1. `git mv` v0 into `legacy/v0/` (single restructure commit).
2. Scaffold: Next.js (App Router, TS strict) + Convex + Tailwind/shadcn + Vitest.
3. Implement `convex/schema.ts` (the 12 tables of §7), `lib/scoring/metrics.ts` (metric registry), and the provenance mutation layer (`convex/observations.ts`: append-only insert, AI-citation guard, latest-per-metric query).
4. Write and pass the provenance test suite (§23.4).
5. Commit: *"V2 foundation: repo restructure, Convex evidence spine, metric registry, provenance guarantees."*

Everything else follows the phase order in §26.
