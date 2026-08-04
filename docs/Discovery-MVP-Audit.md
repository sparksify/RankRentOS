# Discovery MVP — Phase 0 Audit

Date: 2026-08-04 · Auditor: Claude (lead architect session) · Branch: `claude/rankrentos-discovery-mvp-obs2lq`

## 1. What exists (v0 inventory)

### Code
| Component | Location | State | Verdict |
|---|---|---|---|
| Scan pipeline (SERP + autocomplete + trends + crawls + RDAP) | `src/run.js`, `src/serp.js`, `src/demand.js`, `src/domains.js` | Working JS, SerpAPI-based, disk-cached | **Preserve as v0 reference**; port logic into TS adapters + Lens v1 |
| Scoring heuristics (directories, inner pages, franchises, map pack, content depth, domain age, city fit, demand multipliers) | `src/score.js` | Working, practitioner-calibrated | **Reference implementation for Opportunity Lens v1** — signals ported and versioned |
| Volume/CPC fetcher (DataForSEO) | `src/volume.js` | Working | Port to provider adapter |
| Volume gates + rescore | `src/rescore.js` | Working | Port into qualification stage |
| Value model (rent vs commission) | `src/value.js` | Working | Port into monetization subscore + blueprint estimates |
| Keyword-variant deep check | `src/deep.js` | Working | Port into deep-research stage |
| Supabase sync | `src/sync.js` | Working (targets paused project) | Superseded by canonical schema |
| Next.js app (`app/`) | JS, password auth, 1 page, 3 API routes | Working shell | Superseded by TS app; auth middleware pattern retained |

### Data (in repo, committed 2026-08-03)
| Dataset | File | Contents | Freshness |
|---|---|---|---|
| Niche seed | `data/niches.json` | 24 niches with ticket/margin/archetype/domainTerms | Editorial, current |
| City seed | `data/cities.json` | 58 cities, 15 states, pop/income/growth/region | Curated v0 values; treat as observations dated 2026-08-03, source `v0-curated` |
| **1,392-market keyword corpus** | `data/volumes.json` | 1,392 keywords (24×58) with DataForSEO volume/CPC/competition; 447 with volume>0 | **Fresh** (≤90-day keyword policy) |
| Trends weights | `data/trends.json` | Google Trends niche weights + seasonality via SerpAPI | Fresh enough for weighting; has `builtAt` |

### Data NOT in repo (captive)
- `data/cache/` (raw SerpAPI payloads) and `out/results.json` (v0 scores) are gitignored — they exist only on Steve's machine and in the paused Supabase project.
- Supabase project **LeadGenScout** (`dmvkmbbpcvcetuepwhue`) is **INACTIVE (paused)** and **cannot be restored**: the org is at its 2-active-project free-plan limit (`Booking APP`, `ai-employee-os`). Restoring requires pausing another production app or upgrading — both outside this session's authority.

### Deployments
- Vercel project `rankrent-os` exists (`prj_2bk80miR66HnIAX3nyKU2bWPFH2P`, team `steves-projects-c6a4efb3`); latest deployment is in ERROR state; domains: `rankrent-os.vercel.app` (www.rankrentos.com not attached in Vercel).

### Docs
- `docs/SPEC.md` (v3) and `docs/ARCHITECTURE.md` (Master Architecture v3, "the constitution") — this MVP implements §15 (Discovery MVP) of that architecture.

## 2. Environment constraints discovered in this session

1. **No provider credentials present**: no `.env`; SERPAPI_KEY, DATAFORSEO_AUTH, Namecheap and Supabase keys are not in this environment.
2. **Egress policy blocks almost all outbound HTTPS from the container** (403 CONNECT): rdap.verisign.com, api.census.gov, supabase.co, api.vercel.com, serpapi.com, api.dataforseo.com all unreachable. Only package registries + GitHub are open. WebFetch is similarly gated.
3. **Working evidence channels in this session**:
   - **WebSearch** (harness tool): real current web results — used as a SERP-proxy provider (`web_search`), clearly labeled with reduced confidence vs. localized Google SERPs.
   - **Vercel domain availability + price** (MCP): registrar-grade current domain verification — used as the authoritative availability provider (Namecheap tools are not connected to this session).
   - **Supabase MCP**: full SQL access to active projects — used for migrations and data loading.
4. **No Namecheap tools are connected** despite the brief referencing them. Domain adapter interface includes a Namecheap implementation slot; current verification uses Vercel registrar data + (when run locally) free RDAP.

## 3. Database decision (recorded in decision log)

The new canonical schema is hosted in the **active `ai-employee-os` Supabase project** (`drnsdklutxuohdpkjaou`) using **`rros_`-prefixed tables** in `public`. Rationale: LeadGenScout is paused and un-restorable without disrupting other production apps or purchasing an upgrade; this option is additive, collision-free (verified no `rros_*` tables exist), fully reversible, and unblocks shipping. All schema lives in versioned SQL migrations, so moving to a dedicated project later is: create project → run migrations → copy `rros_*` data.

**Pre-existing issue surfaced (not caused by this work): the 11 existing `ai-employee-os` tables have RLS disabled** — anyone with the anon key can read/write them. Remediation SQL is available from Supabase advisors; applying it without policies would break that app, so it is Steve's call.

## 4. What must be migrated / ingested
1. `niches.json` → `rros_niches` (+ per-niche playbook seed with v0 economics as versioned assumptions).
2. `cities.json` → `rros_cities` + `rros_geo_observations` (population, income, growth — source `v0-curated`, observed 2026-08-03).
3. `volumes.json` → `rros_keywords` + `rros_keyword_observations` (provider `dataforseo`, observed 2026-08-03) with raw-evidence checksums.
4. `trends.json` → raw evidence + niche trend observations (provider `serpapi_trends`).
5. Markets generated as 24 niches × 58 cities = 1,392 `rros_markets`.
6. **Deferred (captive data)**: v0 SERP caches, `out/results.json` scores, and the paused Supabase `runs/markets/domains/pipeline` rows. The ingestion script (`src/ingest/v0.ts`) accepts these files/exports the moment they are available; v0 scores will be imported as derived intelligence tagged `lens=v0-scan`, never as facts.

## 5. Key risks
| Risk | Mitigation |
|---|---|
| SERP evidence in this session is proxy-grade (WebSearch, not localized Google SERP with local pack) | Confidence model explicitly penalizes `web_search` SERP evidence; every Batch 1 record shows missing-evidence list; re-verification job spec ships for when SerpAPI/DataForSEO keys are configured |
| Local pack / review-count data unavailable this session | Marked missing in evidence completeness; operator-candidate identification relies on organic results + business sites |
| v0 city demographics are curated, not Census-verified | Labeled `v0-curated`; Census adapter ships and runbook documents re-verification |
| Schema lives in a shared Supabase project | `rros_` prefix, migrations versioned, documented move path |
| Paused LeadGenScout data could be lost if deleted | Do NOT delete the project; restore + export when a slot frees |

## 6. Assumptions
- v0 keyword volumes (collected ~2026-08-03 via DataForSEO) are within the 90-day keyword freshness window: treated fresh.
- v0 curated city pop/income values are accurate enough for qualification gates (Census verification queued as follow-up).
- Steve's SOP-derived scoring heuristics in `score.js` remain the best available competition priors; they are versioned as inputs to Lens v1.
- Single-admin password auth (existing pattern) satisfies the security bar for a private app.
