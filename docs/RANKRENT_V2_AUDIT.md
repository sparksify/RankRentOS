# RANKRENT OS — V2 ARCHITECTURE & REPOSITORY AUDIT

Date: 2026-08-11
Scope: full audit of `sparksify/RankRentOS` (`main` @ `60c3662`) against the current V1 product specification (8/8/4 portfolio + North Texas cluster experiment, Convex backend).
Constraint honored: no code was modified. This document is the only change.

---

## 1. Executive Recommendation

**OPTION B — CREATE A CLEAN RANKRENT OS V2 AND SELECTIVELY MIGRATE REUSABLE PIECES.**

One-paragraph version: the existing repository is a small, well-written **v0 prototype** (~1,800 lines of plain-JavaScript pipeline scripts plus a ~500-line single-page Next.js dashboard), not a platform. Its genuinely valuable parts are (a) the deterministic SERP-weakness heuristics, (b) the free/cheap data-acquisition wrappers (SerpAPI, DataForSEO, RDAP, autocomplete, Trends, content-depth crawling), (c) the curated seed data (24 niches with economics assumptions, 58 hand-picked cities including the DFW-north corridor), and (d) already-paid-for cached keyword data (~1,392 + ~2,400 keyword volume/CPC observations). Everything structural — the file-based pipeline, the mutate-in-place scoring, the Supabase tables, the single-score-plus-classifier model, the UI — either conflicts with the new spec (provenance, scoring versioning, Community × Service, per-bucket weighting, Convex) or is too thin to be worth bending. Porting ~800 lines of pure functions into a fresh TypeScript + Convex codebase is days of work; retrofitting the new requirements into this repo would take longer and produce a worse result.

The repository's two large docs (`SPEC.md` v3/v4 and `ARCHITECTURE.md` v3) describe a seven-engine operating system that was **never implemented** — zero code exists for playbooks, jobs, knowledge graph, builder, operations, or lenses. They should be treated as superseded strategy documents, not as architecture to preserve. Notably, `ARCHITECTURE.md` §24.2 itself already prescribed "rebuild; demote the existing pipeline to v0 / seed data" — this audit reaches the same conclusion with a different (Convex, narrower-V1) target.

---

## 2. Current Repository Summary

| Area | Reality |
|---|---|
| Total tracked code | ~1,350 lines `src/` (Node ESM scripts, no framework, no deps), ~550 lines `app/` (Next.js 15 + React 19, no other deps) |
| Language | Plain JavaScript. Zero TypeScript. |
| Dependencies | Root `package.json` has **no dependencies at all** (native `fetch`/`fs`/`dns`). App depends only on `next`, `react`, `react-dom`. |
| AI/LLM integration | **None.** No AI calls anywhere in the code. |
| Tests | One file: `src/strategy.test.js` (8 unit tests over the pure scoring functions). |
| Database | Supabase via raw REST `fetch` (no SDK). Only one migration file committed (`002`); the base schema (`runs`, `markets`, `domains`, `pipeline`) is **not in the repo**. |
| Data files | `niches.json` (24 niches), `cities.json` (58 curated cities), `cities-national.json` (491), `volumes.json` (1,392 paid keyword observations), `national-survivors.json` (669 demand-qualified markets), `trends.json` (5-yr Trends stats for 24 niches). |
| At-risk data | `out/` (scored results, opportunities, portfolio) and `data/cache/` (raw paid SERP payloads) are **gitignored** — they exist only on the original machine and partially in Supabase. |
| Docs | `SPEC.md` + `ARCHITECTURE.md`: large, thoughtful, unimplemented v3/v4 platform visions. |
| Git history | 8 commits; last real code commit added dual-strategy scoring + portfolio builder. |

What was actually shipped is a **market scout**: scan (niche × city) pairs → score SERP weakness → gate by volume/CPC → estimate rent → classify into strategy buckets → pick a 20-asset portfolio → sync to Supabase → view in a password-gated dashboard.

---

## 3. Current Architecture

- **Framework:** two disconnected halves.
  - `src/` — a manually-orchestrated CLI pipeline: `run.js` → `volume.js` → `rescore.js` → `value.js` → `deep.js` → `strategy.js` → `portfolio.js` → `sync.js` / `dashboard.js`. State passes between stages by **mutating JSON files in `out/` in place**.
  - `app/` — Next.js App Router, one page (`page.jsx`, 244 lines), three API routes (`/api/markets`, `/api/pipeline`, `/api/login`), Edge middleware for auth.
- **Backend/database:** Supabase (project referred to as "LeadGenScout" in docs), accessed via hand-rolled REST calls with the anon key. Tables in use: `runs`, `markets`, `domains`, `pipeline` (+ `site_outcomes` from migration 002, likely never populated). No RLS evidence in repo, no edge functions, no storage usage, no generated types, no Supabase Auth (auth is a shared password → SHA-256 cookie).
- **External services:** SerpAPI (SERP, autocomplete, Trends), DataForSEO (Google Ads volume/CPC), Verisign RDAP (free domain availability + registration age), plain HTTP crawling of competitor pages for word counts. All responses disk-cached under `data/cache/` so re-runs are free.
- **Background jobs:** none. Everything is a manually-invoked foreground script.
- **AI integrations:** none in code (only aspirational in docs).
- **Deployment assumptions:** Vercel with root `app/`; pipeline runs on a local machine; env loaded from `.env` with a fallback to a **sibling repo's env file** (`../hermes-os/.env.local`) — a machine-specific coupling.
- **Auth:** single shared `APP_PASSWORD`, hashed with a static secret into an httpOnly cookie; middleware gates all pages.

## 4. Current Functionality

| Capability | Status | Notes |
|---|---|---|
| Niche discovery | ❌ Not built | Niches are a hand-curated static list of 24. No discovery. |
| Geographic discovery | ❌ Not built | Cities are static lists (58 curated / 491 national). No neighborhood/community concept anywhere. |
| Opportunity discovery | ⚠️ Partial | Brute-force scan of the niche×city cross-product; no hypothesis generation, nothing can "surprise" you. |
| Keyword research | ⚠️ Partial | One keyword per market (`acQuery + city`) + a hardcoded ×2.5 "keyword universe" multiplier. `deep.js` re-checks 2 variants for top markets. No related-keyword or long-tail expansion. |
| SERP analysis | ✅ Works, good | The strongest part: directory/inner-page/intent-mismatch/out-of-town/franchise composition analysis, map-pack review strength, title targeting, ads-block presence. |
| Competition analysis | ⚠️ Partial | Content word-count crawl of top 3, domain age via RDAP. No backlinks/authority, no GBP detail, no on-page beyond titles. |
| Lead economics | ⚠️ Assumption-driven | Ticket/margin are hand-entered per niche; funnel is fixed benchmark constants (CTR 25%, contact 12%, close 10–25%). Deterministic but almost entirely HUMAN-ASSUMED. |
| Business/operator discovery | ❌ Not built | Map-pack size + "buyer proof" (marketplaces/ads present) is the entire renter-depth signal. No operator list, no review-based operator quality. |
| Domain research | ✅ Works, good | Candidate generation, DNS+RDAP two-stage availability, winner-picking with reasons, competitor domain age. Free. No pricing, no spam-history. |
| Scoring | ✅ Works | See §5. Deterministic, tested, but structurally misaligned with the new model. |
| Portfolio selection | ⚠️ Partial | `portfolio.js` already targets **8 LHF / 8 High-Value / 4 Unicorn** with per-niche/city/state diversity caps — the right shape, but it selects from classifier labels, not per-bucket weighted scoring. |
| AI research | ❌ Not built | |
| Data persistence | ⚠️ Fragile | JSON files (gitignored) + Supabase snapshot inserts. Scores are overwritten in place across pipeline stages. |
| UI | ⚠️ Basic | One filterable card list with score/demand/value cells, "why this market" bullets, top-organic evidence, domain pick, and a 5-stage pipeline tracker. Reads the **old** score fields; strategy-v2 fields only ship inside a JSONB blob. |
| Reporting | ✅ Works | Two static-HTML generators (`report.js`, `dashboard.js`) with genuinely good plain-English evidence narration. |

---

## 5. Current Scoring Model (exact documentation)

Two generations coexist:

### 5.1 Generation 1 — `score.js` `scorePair()` (winnability 0–100)
Additive points over SERP signals, then multiplied by fit and demand:

- directories in top-3: +15 each, cap 30
- intent-mismatch (retail/info) in top-5: +6 each, cap 12
- out-of-town competitors in top-3: +4 each, cap 8
- franchise brands in top-3: **−8 each, cap −16**
- buyer proof (lead marketplace in top-10 OR any ads): +8
- inner pages in top-5: +5 each, cap 20
- map pack: absent → −10 unless autocomplete proves demand; avg reviews <40 → +15; <100 → +6; listing without website → +4
- ads: 1–3 ads → +10; >3 → +4
- top-3 titles missing city: +4 each, cap 10
- competitor avg words: <250 → +15; <500 → +10; <900 → +5
- competitor avg domain age: <4y → +6; <8y → +3
- × city-fit multiplier (income ≥120k → 1.15 … <80k → 0.8; growth high +0.05)
- × demand multiplier (autocomplete floor 0.6/0.8/1.0 × Trends weight 0.7–1.15)
- clamped to 100.

Then `rescore.js` mutates it: × volume factor (≥300 → 1.1 … <10 → 0.5–0.65) + CPC adjustment (null/0 → −5; $2–15 → +5; >$16 → −8).

### 5.2 Generation 2 — `strategy.js` (the current model)
Pure functions, unit-tested:

- **Rankability (0–100):** same SERP-weakness points as Gen 1 without fit/demand multipliers.
- **Economics:** fixed benchmarks `{ctr:0.25, contactRate:0.12, closeNeed:0.25, closeDesire:0.10, rentShare:0.15–0.25, kwUniverse:2.5}` → leads/mo, gross profit/mo, rent band, rent tier S/A/B/C/D, coverage ratio.
- **Asset Value (0–100):** gross-profit-per-job points (up to 30) + CPC points (10) + volume points (20) + need +8 / seasonal −5 + renter-depth points (map pack ≥3, mature reviews, buyer proof, ads; cap 20) + income points (4), normalized by /0.92.
- **Arbitrage (0–100):** `100 × (AV/100)^0.6 × (R/100)^0.4`.
- **Overall:** `0.35·R + 0.35·AV + 0.30·Arb` — one universal blend.
- **Classification (hard thresholds):** UNICORN (R≥60 ∧ AV≥55 ∧ renterDepth ∧ vol≥100 ∧ rentMid≥750), HIGH-VALUE (AV≥55 ∧ R≥40 ∧ rentHigh≥1500), LOW-HANGING FRUIT (R≥55 ∧ rentMid≥150), plus LOW VALUE / LONG SHOT / STANDARD.
- **timeTo2k:** probability heuristic of $2k MRR in 6–12 months.
- **Confidence:** 3-tier — high (volume + CPC measured + deep-check confirmed), medium (volume + CPC), low (else).
- **Portfolio (`portfolio.js`):** filter by classifier label, sort UNICORN by overall, HIGH-VALUE by arbitrage, LHF by rankability; apply diversity caps (≤6/niche, 1/city, ≤5/state); do not pad short buckets.

All deterministic; no AI-generated scores exist. Hard-coded thresholds are everywhere (every number above).

### 5.3 Classification of every existing component vs. the new model

| Existing component | New-model counterpart | Verdict |
|---|---|---|
| SERP-weakness signal extraction (directories, inner pages, intent mismatch, out-of-town, franchises, titles, map-pack reviews, content depth, domain age) | Score A inputs | **KEEP** (port to TS; these are the crown jewels) |
| `computeRankability` point weights | Score A | **MODIFY** — keep as the SERP/local/on-page sub-blocks of a richer Rankability; add authority-requirement estimation and explicit "why beatable" output; version it |
| Autocomplete demand floor | Score B input | **KEEP** |
| Trends batching + anchor rescaling + seasonality | Score B input | **KEEP** |
| Volume/CPC acquisition (DataForSEO) | Scores B & C inputs | **KEEP** |
| `kwUniverse = 2.5` multiplier | Score B (demand universe) | **REPLACE** — measure the related-keyword universe instead of assuming it |
| Volume gates / CPC bands in `rescore.js` | Score B / C | **MODIFY** — keep the thresholds as inputs, stop mutating scores in place |
| CPC + ads-presence as intent proxy | Score C | **MODIFY** — promote into an explicit Commercial Intent score with query-language analysis |
| `computeEconomics` benchmark funnel | Score D | **MODIFY** — keep the deterministic skeleton; every constant must become a labeled AI-ESTIMATED/HUMAN-ASSUMED input with provenance |
| niches.json ticket/margin/need/seasonal | Score D inputs | **KEEP data, MODIFY status** — re-label as HUMAN-ASSUMED seeds pending evidence |
| Map-pack size + buyerProof + adCount as renter depth | Score E | **REPLACE** — far too thin; new model needs actual operator enumeration and quality |
| `computeAssetValue` | Score F | **MODIFY** — currently blends demand and renter depth into it; must be decomposed so F stays separate from B and E |
| `computeArbitrage` | Score H | **REPLACE** — it's a mispricing blend of two scores, not upside-vs-cost-to-test; H needs domain/build/carry cost and upside |
| `timeTo2k` | Score G (partially) | **REPLACE** — G asks "time to signal", not "probability of $2k MRR" |
| `computeConfidence` 3-tier | Score I | **REPLACE** — must derive from provenance (evidence types, freshness, agreement), not just volume/CPC presence |
| `overall = 0.35/0.35/0.30` universal blend | Part 9 explicitly forbids this | **REMOVE** — replaced by per-bucket weighted selection models |
| `classify()` hard-threshold labels | Per-bucket selection | **REPLACE** — buckets should be selected by bucket-specific weighted ranking, not pre-labeled |
| `portfolio.js` diversity caps + no-padding rule + 8/8/4 shape | Portfolio selection | **KEEP WITH MODIFICATION** — the caps and quality-over-quota rule are exactly right |
| Community Growth / Household Value / Service Propensity / Search Emergence / Time-to-Demand / Community × Service | Part 7–8 | **MISSING** — nothing exists |
| Data provenance (source, timestamp, evidence type, raw vs normalized) | Part 10 | **MISSING** |
| Scoring versioning (model version, weights, frozen history) | Part 12 | **MISSING** — pipeline overwrites scores in place; only `site_outcomes` (migration 002) gestures at predicted-vs-actual |
| AI research of any kind | Part 11 | **MISSING** |

---

## 6. New Scoring Model Gap Analysis (Score-by-score)

| New score | Coverage today | Gap |
|---|---|---|
| **A Rankability** | ~55% — strongest area. SERP composition, local-pack reviews, title targeting, content depth, domain age. | Authority/backlink estimation (none), local-competitor enumeration beyond the pack, H1/schema/internal-link observation, structured "why beatable" narrative, domain-opportunity sub-input. |
| **B Demand** | ~40% — exact keyword volume, autocomplete floor, 5-yr Trends per niche. | Related-keyword universe (currently a ×2.5 constant), long-tail expansion, query diversity, geographic demand distribution, growth direction per market. |
| **C Commercial Intent** | ~20% — CPC and ads presence exist as inputs to other scores. | No dedicated score; no transactional-language/query-stage analysis; no "near me" behavior. |
| **D Lead Economics** | ~35% — deterministic formula exists. | All inputs are hand-assumed ticket/margin; no per-niche evidence gathering (job values, margins, close rates), no lead-market-value estimation, revenue vs. margin distinction is only as good as the hand-entered `margin`. |
| **E Renter Depth** | ~15% — map-pack size, buyer proof. | No operator enumeration, review-count/quality profiles, service radius, absorption capacity, marketing sophistication. Biggest scoring gap. |
| **F Asset Value** | ~50% — exists and is separate from Rankability (good). | Needs decomposition (demand and renter depth currently leak in), exclusivity/territory value, plausible-rent grounding beyond benchmark funnel. |
| **G Speed / Time-to-Signal** | ~10% — timeTo2k measures something else. | Ranking-velocity expectations, indexability, long-tail availability; explicitly required for the LHF bucket. |
| **H Asymmetry** | ~20% — arbitrage captures "mispriced" but not "cheap to test." | Cost side (domain, build, carry) entirely absent; emerging-demand and domain-scarcity signals absent. |
| **I Confidence** | ~25% — a 3-tier flag exists and there's an "honest confidence" culture in the docs. | Must be computed from provenance: evidence types, source count/agreement, freshness, estimation share. Requires the provenance layer that doesn't exist. |
| **Community Growth / Household Value / Propensity / Search Emergence / Time-to-Demand** | 0% | Nothing below city granularity exists. `cities.json` has static pop/income/growth-flag only. |
| **Community × Service unit** | 0% | The research unit is Niche × City throughout code and schema. |

---

## 7. Data Source Inventory

| Source | Provides | Used in | Works? | Cost | Limitations | Supports new model? | Retain? |
|---|---|---|---|---|---|---|---|
| **SerpAPI — Google SERP** | organic top-10, local pack (title/rating/reviews/website), ads | `serp.js` → run/national-scan/deep | Yes (key required) | Paid per search (~$0.01–0.015/call at typical plans) | 10 results; trimmed payload keeps essentials; raw kept on disk only | Yes — core of Score A | **Yes** (or consolidate onto DataForSEO SERP, an open decision already logged in ARCHITECTURE §24.1) |
| **SerpAPI — Autocomplete** | suggestion list for typed prefix | `demand.js` | Yes | Paid per call | Binary-ish signal | Yes — Score B floor + Search Emergence leading indicator | **Yes** |
| **SerpAPI — Google Trends** | 5-yr interest timelines, seasonality | `demand.js buildTrends` | Yes | 2–7 calls total (batched) | US-level only as used; community-level Trends often too sparse | Yes — Score B; needs geo-level runs for emergence | **Yes** |
| **DataForSEO — Google Ads search volume** | volume, CPC, competition per keyword | `volume.js`, `national.js` | Yes | ~$0.05–0.075 per 1k keywords batch (cheap) | Under-reports hyper-local; exact-keyword only as used | Yes — Scores B, C | **Yes** — also has Related Keywords, SERP, and Backlinks endpoints the new model needs |
| **Verisign RDAP** | .com/.net availability, registration date | `domains.js` | Yes | Free | .com/.net only; no pricing, no premium detection | Yes — Score A domain input + H cost side (partial) | **Yes** |
| **DNS NS lookup** | fast taken-domain filter | `domains.js` | Yes | Free | Pre-filter only | Yes | **Yes** |
| **Direct page crawl** | competitor word counts | `demand.js contentDepth` | Yes | Free | Crude text extraction; JS-rendered sites undercounted | Yes — Score A on-page input | **Yes** |
| **Supabase** | persistence + dashboard reads | `sync.js`, `app/` | Presumably (migration 002 header says "when DB write access restores" — there was an outage/limit at last commit) | Free tier likely | Snapshot-insert model; no provenance | Being replaced by Convex | **No** (export data, then retire) |

### Data gaps required by the new model (no current source)
Backlink/authority metrics · related-keyword universe · operator enumeration + reviews (Google Places/Maps data) · job/margin economics evidence · domain pricing · community/development data (planned homes, builders, velocity, prices) · Census demographics · construction/permit activity · search-emergence indicators. Detailed in §8.

---

## 8. Data Acquisition Gap Analysis (per required input)

Legend — **Have:** ✅ yes / ⚠️ partial / ❌ no. **Auto:** can be automated. **AI:** AI research appropriate. **Manual-first:** manual verification initially preferable.

| Required data | Have | Current source | Candidate source if missing | Free option? | Reliability | Auto | AI | Manual-first |
|---|---|---|---|---|---|---|---|---|
| Keyword demand (exact) | ✅ | DataForSEO Google Ads | — | ❌ (cheap) | Medium (hyper-local under-report) | ✅ | ❌ | ❌ |
| Related search demand / long-tail universe | ❌ | ×2.5 constant | DataForSEO Related Keywords / Keyword Ideas; autocomplete expansion | ⚠️ autocomplete partly | Medium | ✅ | ⚠️ (cluster naming) | ❌ |
| CPC | ✅ | DataForSEO | — | ❌ (cheap) | Medium-high | ✅ | ❌ | ❌ |
| Trends / growth direction | ✅ | SerpAPI Trends (US-level) | Same, per-metro geo; keep history for deltas | ⚠️ | Medium | ✅ | ❌ | ❌ |
| SERP results | ✅ | SerpAPI (raw cached locally) | Or DataForSEO SERP (cheaper; consolidation candidate) | ❌ | High | ✅ | ⚠️ (weakness classification) | ❌ |
| Competitor strength (on-page) | ⚠️ | word-count crawl | Richer crawl (H1/title/schema/links) — deterministic parse + AI classification | ✅ | Medium | ✅ | ✅ | ❌ |
| Backlink/authority proxies | ❌ | — | DataForSEO Backlinks (account exists); free proxy: domain age + indexed-page counts | ⚠️ weak proxies free | Medium | ✅ | ❌ | ❌ |
| Local operators (count, names, websites) | ⚠️ | SERP local pack (top 3 only) | Google Places API text/nearby search; DataForSEO Business Data | ⚠️ Places has free monthly credit | High | ✅ | ❌ | ❌ |
| Google review signals (counts, ratings, recency) | ⚠️ | pack top-3 only | Google Places details | ⚠️ | High | ✅ | ❌ | ❌ |
| Project/job economics (ticket) | ⚠️ | hand-entered niches.json | AI open-web research (cost guides, contractor forums, industry reports) with citations | ✅ | Low-medium | ⚠️ | ✅ | ✅ |
| Gross-margin estimates | ⚠️ | hand-entered | Same as above; industry benchmarks | ✅ | Low | ⚠️ | ✅ | ✅ |
| Lead values | ❌ | derived from benchmarks | CPC×funnel triangulation + lead-marketplace posted prices (Angi/Networx rate cards) + AI research | ⚠️ | Low-medium | ⚠️ | ✅ | ✅ |
| Advertiser activity | ✅ | SERP ads block | + Google Ads Transparency Center (free) | ✅ | Medium | ✅ | ❌ | ❌ |
| Domain availability | ✅ | RDAP/DNS | — | ✅ | High | ✅ | ❌ | ❌ |
| Domain pricing (incl. premium) | ❌ | — | Registrar API (Namecheap/Porkbun/GoDaddy aftermarket) | ⚠️ | High | ✅ | ❌ | ⚠️ |
| Domain spam/history | ❌ | — | Wayback Machine API (free) + expired-domain checkers | ✅ | Medium | ✅ | ⚠️ | ⚠️ |
| Population growth | ⚠️ | static growth flag | Census ACS + PEP (free API) | ✅ | High | ✅ | ❌ | ❌ |
| Housing growth / construction velocity | ❌ | — | Census Building Permits Survey (free, county/place); HUD SOCDS | ✅ | High (county), Medium (place) | ✅ | ❌ | ❌ |
| Master-planned developments (discovery) | ❌ | — | AI open-web research (RCLCO/John Burns top-MPC rankings, builder sites, DFW news) → structured records | ✅ | Medium — needs citation discipline | ⚠️ | ✅ | ✅ |
| Planned home counts / homes remaining | ❌ | — | Developer/builder websites, MPC annual rankings, county plat records — AI-extracted, human-spot-checked | ✅ | Low-medium | ⚠️ | ✅ | ✅ |
| Home prices (community-level) | ❌ | — | Builder price sheets, Zillow/Realtor scrape or AI summary; Census ACS for area medians | ⚠️ | Medium | ⚠️ | ✅ | ✅ |
| Household income / purchasing power | ⚠️ | static per city | Census ACS block-group level (free) | ✅ | High | ✅ | ❌ | ❌ |
| Community development stage / delivery velocity | ❌ | — | AI research + permit data + builder activity | ✅ | Low-medium | ⚠️ | ✅ | ✅ |
| New-home service propensity (0–6/6–12/12–24 mo) | ❌ | — | AI evidence synthesis: industry surveys (pool/landscape install timing), forum/Reddit/Nextdoor evidence, advertiser targeting behavior | ✅ | Low — the most estimate-heavy dimension | ❌ | ✅ | ✅ |
| Search-emergence indicators (community-name query growth, indexed-page growth, business entry) | ❌ | — | Trends on community names, autocomplete on community names, dated site: searches, GBP business counts over time, news monitoring | ✅ mostly | Low-medium | ⚠️ | ✅ | ⚠️ |

**Honest summary:** Scores A, B, C and the domain inputs are largely measurable today with existing/known APIs. Score E needs one new integration (Google Places or equivalent). Scores D, and the entire Part-7 cluster dimension set, are **estimate-heavy** — they are exactly where AI research with mandatory provenance labeling (OBSERVED / DERIVED / AI-ESTIMATED / HUMAN-ASSUMED) earns its keep, and where initial manual verification is warranted.

---

## 9. Supabase Dependency Analysis

**Depth of embedding: SHALLOW. Removal difficulty: LOW (≈ half a day plus data export).**

- **Configured?** Yes, historically live (`runs`/`markets`/`domains`/`pipeline` were populated by real syncs; the app reads them). But migration 002's own comment ("apply when DB write access restores") shows writes were already broken/paused at the last commit.
- **Production data?** Yes — the 1,392-market scored corpus (and possibly the 491-city national scan) lives there. **This is the main thing to export before retiring the project.** Note the same data also exists as local `out/*.json` on the original machine.
- **Tables:** `runs`, `markets`, `domains`, `pipeline`, `site_outcomes` (+ columns from 002). The base migration (001) was **never committed** — schema exists only in the live project.
- **RLS / Auth / Storage / Edge functions / generated types:** none in the repo. App auth is homegrown password auth, not Supabase Auth.
- **Client code touching Supabase:** `src/sync.js` (write path, 100 lines), `app/lib/config.js` (20-line REST wrapper), 2 API routes, plus a browser-side fallback block in `page.jsx` that hits Supabase REST directly with `NEXT_PUBLIC_` keys. That's the entire surface. No `@supabase/supabase-js` anywhere.
- **Removal plan:** export `markets` + `runs` (+ raw SERP cache from the original machine) to JSON; ingest as historical seed evidence in Convex; delete `sync.js`, `app/lib/config.js`, the API routes; pause/retire the Supabase project.

---

## 10. Convex Migration Analysis

Nothing in the repo fights Convex, because almost nothing depends on the database shape — the pipeline is file-based and the scoring functions are pure. Convex actually fits this product's access patterns well:

- **Research jobs → Convex actions + scheduler.** External API calls (SerpAPI/DataForSEO/RDAP/Places/AI) live in actions; results written via mutations. Replaces the manual 8-script pipeline with resumable, observable per-market research steps — and gives the "Research Status" UI reactivity for free.
- **Append-only observations → documents.** The new model's provenance records (metric, value, source, timestamp, evidence type, confidence) are naturally documents in an `observations` table indexed by (opportunityId, metric, observedAt). No SQL translation needed because the SQL schema isn't worth translating.
- **Scoring versioning → immutable `scoreRuns` documents.** Deterministic scoring runs inside mutations/queries over collected observations; each run stores model version, weights, inputs hash, and outputs; never overwritten.
- **Cautions:** don't mechanically mirror `markets` as one fat document with a `signals` blob — split entities (opportunity, observation, scoreRun, domainCandidate, community) by access pattern; keep raw provider payloads out of hot documents (store trimmed observations; raw payloads in Convex file storage or R2 if kept at all).

---

## 11. UI Reuse Analysis

| Area | Exists as | Verdict |
|---|---|---|
| Overall layout/nav | One page, topbar + KPI row | **REBUILD** — V1 needs 6 views (Discovery, Table, Detail, Cluster, Portfolio, Data Quality); nothing structural to keep |
| Opportunity cards/table | Card list with score/demand/value cells | **REBUILD** — bound to the old score fields; but keep the *layout ideas* (evidence-first cells, verdict chips) |
| "Why this market" evidence bullets | `whyBullets()` in page.jsx and dashboard.js | **KEEP WITH MODIFICATION** — the best UI asset in the repo; the signal→plain-English mapping ports directly into the new Opportunity Detail explanation section |
| Filters/sort toolbar | Selects + search | **REBUILD** (trivial to rewrite; not worth extracting) |
| Pipeline stage tracker (watchlist→renting) | Chips + Supabase `pipeline` | **DISCARD** — post-selection operations tracking is a V1 non-goal |
| Signal bar mini-chart | `Bars` component | **DISCARD** — tied to old signal caps |
| Login/auth | Password + cookie middleware | **KEEP WITH MODIFICATION** — acceptable stopgap pattern for a 1-person tool, or replace with Convex Auth; either is a day at most |
| Static HTML report generators | `report.js`, `dashboard.js` | **DISCARD as code**; keep the narrative copy patterns |
| Design system | None (hand-rolled CSS) | **REBUILD** (e.g., Tailwind + shadcn/ui as the old ARCHITECTURE doc itself recommends) |

## 12. Business Logic Reuse Analysis

Worth migrating (as TypeScript ports with tests):

- **`score.js` signal extraction + the domain lists** (directories, franchises, lead marketplaces, intent-mismatch domains) — the distilled practitioner knowledge; becomes Score A's SERP/local/on-page sub-inputs.
- **`domains.js` entirely** — candidate generation, DNS+RDAP availability, winner ranking with reasons, domain-age lookup.
- **`demand.js` entirely** — autocomplete floor, Trends batching/anchor-rescaling/seasonality, content-depth crawler.
- **`serp.js`** — SerpAPI wrapper + trim-and-cache-raw pattern (re-target caching at Convex).
- **`volume.js` / `national.js` DataForSEO wrapper** — batch volume/CPC fetch with incremental caching.
- **`strategy.js` economics skeleton** — the deterministic funnel math survives; its constants become labeled, versioned assumptions.
- **`portfolio.js` selection discipline** — 8/8/4 targets, diversity caps, "quality thresholds beat quotas."
- **`deep.js` keyword-variant verification** concept.
- **Seed data:** `niches.json` (24 niches with economics), `cities.json` (58 curated cities — already DFW-north-heavy: Prosper, Celina, Frisco, McKinney, Anna, Melissa…), `cities-national.json`, and the **paid caches** `volumes.json`, `national-survivors.json`, `trends.json`.

Not worth migrating: the pipeline orchestration (file-mutating scripts), `rescore.js`/`value.js` (superseded by strategy.js and by the new model), `sync.js`, the `overall` blend, `classify()`, `timeTo2k`.

## 13. Test Reuse Analysis

- **Exists:** `src/strategy.test.js` only — 8 focused unit tests over the pure scoring functions (rankability direction, economics tiers/coverage, asset-value ordering, arbitrage shape, classification boundaries, no-unicorn-without-demand, honest timeTo2k, confidence tiers). No integration tests, no E2E, no fixtures/mocks beyond inline objects.
- **Useful under V2:** the *test patterns* (directional assertions on scoring behavior, boundary tests on selection rules) port directly; the specific assertions mostly die with the functions they test. Net: keep as a template, expect to rewrite.

## 14. Technical Debt / Conflicts with the New Spec

1. **Mutate-in-place scoring** — `rescore.js`/`value.js`/`strategy.js` all overwrite `out/results.json`; directly conflicts with Part 12 (never overwrite scoring history).
2. **No provenance anywhere** — signals carry no source, timestamp, or evidence type; conflicts with Part 10.
3. **Gitignored evidence** — the paid raw SERP corpus and all scored outputs live only on one machine; the "database is the moat" doctrine was never actually secured.
4. **Niche × City is the only unit** — no neighborhood/community entity; conflicts with Parts 5, 7, 8.
5. **One universal overall score + hard-threshold classifier** — conflicts with Part 9 (per-bucket weights).
6. **Assumed economics presented as outputs** — benchmark constants produce dollar figures with only a code-comment disclaimer; conflicts with Part 10's evidence-type discipline.
7. **Missing base migration** — the live Supabase schema is unreproducible from the repo.
8. **Env coupling to a sibling repo** (`../hermes-os/.env.local`) — machine-specific.
9. **Plain JS, no types** — the new spec's provenance/versioning discipline practically requires TypeScript.
10. **Docs describe a system that doesn't exist** — SPEC/ARCHITECTURE v3/v4 describe seven engines, playbooks, knowledge graph; a reader (or agent) could easily mistake ambition for reality. They also enshrine Supabase/PostGIS/Drizzle, now superseded by the Convex decision, and a scope (builder, operations, marketplace) that Part 15 explicitly forbids for V1.

---

## 15. Reuse Matrix

| Subsystem | Current State | Strategic Fit | Convex Compatibility | Recommendation | Reason |
|---|---|---|---|---|---|
| SERP-weakness signal extraction (`score.js` heuristics + domain lists) | Working, tested via strategy tests | High — core of Score A | High (pure functions) | **MIGRATE** | Distilled practitioner knowledge; expensive to re-derive |
| SerpAPI wrapper + raw-payload caching (`serp.js`) | Working | High | High (becomes an action) | **MIGRATE** | Correct trim-and-keep-raw pattern |
| Demand layers (`demand.js`: autocomplete, Trends, content depth) | Working | High — Score B + emergence seed | High | **MIGRATE** | Clever, cheap, correct |
| DataForSEO volume/CPC (`volume.js`, `national.js`) | Working | High — Scores B/C | High | **MIGRATE** | Cheap measured demand |
| Domain research (`domains.js`) | Working | High — Score A + Part 13 | High | **MIGRATE** | Free, complete for availability; extend with pricing later |
| Economics skeleton (`strategy.js computeEconomics`) | Working, tested | Medium — Score D core | High | **MIGRATE** (constants become labeled versioned assumptions) | Deterministic funnel math survives |
| Rankability/AssetValue/Arbitrage/classify/overall | Working, tested | Low-medium — structurally misaligned | High | **REFACTOR** into new Scores A/F; **DISCARD** arbitrage blend, overall, classifier | New model demands separate dimensions + per-bucket weights |
| Portfolio builder (`portfolio.js`) | Working | High — already 8/8/4 + caps | High | **KEEP WITH MINOR CHANGES** (port; swap label-filtering for bucket-weighted ranking) | Selection discipline is exactly right |
| Deep keyword-variant check (`deep.js`) | Working | Medium | High | **MIGRATE** (as a confidence input) | Cheap confirmation step |
| Pipeline orchestration (run→…→sync file mutation) | Working but fragile | Low | N/A | **DISCARD** | Replaced by Convex actions/scheduler |
| Supabase persistence (`sync.js`, schema) | Partially broken at last commit | Low | N/A | **DISCARD** (after data export) | Convex decision; shallow embedding |
| Next.js app (page, API routes, auth) | Working | Low — wrong views, old schema | Medium | **DISCARD**; salvage `whyBullets` copy + auth pattern | Cheaper to rebuild 6 views than bend 1 |
| Static report generators | Working | Low | N/A | **DISCARD** (keep narrative copy) | UI supersedes |
| Seed data (niches, cities, curated DFW list) | Good | High | High (import) | **MIGRATE** | Direct inputs to V1 |
| Paid caches (volumes, survivors, trends) | Good | High | High (import as historical observations) | **MIGRATE** | Already-paid evidence; baseline for deltas |
| Old scored corpus (Supabase `markets` + local `out/`, raw SERP cache) | Off-repo | Medium-high | High (import) | **MIGRATE** (export first — at risk) | Historical observations; future calibration baseline |
| SPEC.md / ARCHITECTURE.md | Unimplemented visions | Conflicts with V1 scope + Convex | N/A | **DISCARD** as spec (archive as strategy docs) | Superseded by the new product spec |
| Tests (`strategy.test.js`) | 8 passing unit tests | Medium | High | **KEEP** as pattern; rewrite assertions | Tests the functions being replaced |
| Cluster / Community × Service / emerging-territory anything | Does not exist | — | — | **MISSING / BUILD NEW** | Zero coverage |
| Provenance + scoring-version storage | Does not exist | — | — | **MISSING / BUILD NEW** | Zero coverage |
| AI research layer | Does not exist | — | — | **MISSING / BUILD NEW** | Zero coverage |
| Operator/renter discovery | Does not exist (pack-top-3 only) | — | — | **MISSING / BUILD NEW** | Biggest scoring-input gap |

## 16. Reusable Value Estimates (deliberately un-inflated)

- **Frontend worth preserving: ~10%** — evidence-narration copy and a few layout ideas; no components survive as code.
- **Business logic worth preserving: ~60%** — signal extraction, domain logic, demand layers, economics skeleton, portfolio discipline all port; scoring superstructure does not.
- **Data layer worth preserving: ~5%** — the `site_outcomes` predicted-vs-actual idea and the data itself; no schema or persistence code.
- **Research/API work worth preserving: ~80%** — all four provider integrations + caching patterns + the paid cached datasets.
- **Total codebase providing meaningful V1 value: ~30–35%** — concentrated almost entirely in `src/` pure functions and `data/`.

---

## 17. Recommended Architecture (V2)

**Stack:** Next.js (App Router) · React · TypeScript · Convex (db + actions + scheduler + file storage) · SerpAPI + DataForSEO + RDAP + Google Places + Census/permits APIs · Anthropic API for research agents (structured outputs, citations mandatory).

### Repository structure
```
rankrentos-v2/
  app/                     # Next.js routes (6 views)
    discovery/  opportunities/  opportunities/[id]/
    cluster/    portfolio/      data-quality/
  components/              # tables, score chips, evidence panels, filters
  convex/
    schema.ts
    research/              # actions: serp.ts, volume.ts, trends.ts,
                           #   autocomplete.ts, domains.ts, places.ts,
                           #   census.ts, aiResearch.ts (LLM w/ citations)
    scoring/               # PURE deterministic TS, versioned:
                           #   signals.ts (SERP extraction — ported)
                           #   scores/{rankability,demand,intent,leadEcon,
                           #     renterDepth,assetValue,speed,asymmetry,
                           #     confidence,cluster}.ts
                           #   weights.ts (per-bucket weight sets, versioned)
                           #   scoreRun.ts (freeze inputs+outputs per run)
    portfolio/             # bucket ranking + diversity caps + selection freeze
    lib/                   # provider clients, normalization, provenance helpers
  data/seeds/              # niches, cities, communities-candidates, imports
  scripts/                 # one-off importers (old corpus, volumes.json)
  tests/                   # vitest over scoring + selection
```

### Conceptual data model (Convex tables)
- `services` (niche + service variants; economics assumptions as *references to observations*, not inline truth)
- `geographies` (city | community — community carries subtype, parentCity, MPC fields)
- `opportunities` (service × geography; status: candidate → researching → scored → finalist → selected/rejected)
- `observations` — **append-only provenance records**: {opportunityId | geographyId | serviceId, metric, value, unit, source, sourceUrl, evidenceType: OBSERVED|DERIVED|AI_ESTIMATED|HUMAN_ASSUMED, observedAt, rawRef?, confidence}
- `serpSnapshots` (trimmed parse + raw file ref)
- `scoreRuns` — immutable: {opportunityId, modelVersion, weightsVersion, inputObservationIds/hash, scores A–I (+ cluster dims), reasons[], confidence, computedAt}
- `domainCandidates` (+ availability observations)
- `operators` (per opportunity territory: name, reviews, rating, website, source)
- `portfolios` — frozen selections: {selectionDate, modelVersion, buckets{lhf[], highValue[], unicorns[], clusterThesis}, rationale}
- `researchTasks` (what's collected / missing / stale — powers the Data Quality view)

### Scoring engine structure
Deterministic pure functions per score, taking a bag of typed observations → {value 0–100, subScores, reasons[], missingInputs[]}. Confidence (Score I) computed from the observation set itself (evidence-type mix, freshness, source agreement). Bucket selection = weighted rank over scores with bucket-specific weight vectors defined in versioned `weights.ts`. AI is used **only** upstream (research, extraction, SERP-weakness classification with the deterministic signals as features, hypothesis generation) — never inside score arithmetic.

### UI structure
The six Part-14 views, plain shadcn/ui tables and detail panes; the ported `whyBullets`-style evidence narration on the detail page; no polish beyond sortable/filterable.

### Testing strategy
Vitest unit tests on every score function (directional + boundary, in the spirit of `strategy.test.js`), on bucket selection (caps, no-padding, reproducibility: same observations + same version ⇒ identical scores), and on provenance invariants (no score without inputs; no AI value without source labeling). No E2E for V1.

## 18. Migration Plan

**MIGRATE (port to TS in `convex/scoring` + `convex/lib` + `data/seeds`):**
1. SERP signal extraction + curated domain lists (`score.js`)
2. `domains.js` (all of it)
3. `demand.js` (all of it)
4. `serp.js` fetch/trim/cache pattern
5. DataForSEO batch wrapper (`volume.js`/`national.js`)
6. `computeEconomics` skeleton (constants re-labeled as versioned HUMAN-ASSUMED/AI-ESTIMATED observations)
7. Portfolio diversity caps + no-padding rule (`portfolio.js`)
8. `deep.js` variant-verification concept (as a confidence input)
9. Seed data: `niches.json`, `cities.json`, `cities-national.json`
10. Paid caches as historical observations: `volumes.json`, `national-survivors.json`, `trends.json`
11. **Off-repo, urgent:** export Supabase `markets`/`runs` + the local `out/*.json` + `data/cache/raw/` SERP payloads from the original machine before they're lost
12. Test patterns from `strategy.test.js`
13. `whyBullets` narrative mapping (as detail-page copy logic)

**DO NOT MIGRATE:**
- Pipeline orchestration scripts (`run.js`, `rescore.js`, `value.js`, `national-scan.js` control flow), `sync.js`, `report.js`/`dashboard.js` HTML generators
- `computeArbitrage`, `overall` blend, `classify()`, `timeTo2k`, `computeConfidence`
- The entire `app/` directory
- Supabase schema/migrations/REST wrappers
- `SPEC.md` / `ARCHITECTURE.md` as living specs (archive them)
- `env.js` sibling-repo env coupling

## 19. Minimal V1 Implementation Sequence (to first 8/8/4 recommendation)

1. **Scaffold + evidence spine.** Next.js + Convex; `observations`/`opportunities`/`scoreRuns` schema; provenance helpers; import seeds + paid caches + old corpus export. *(Everything after this deposits evidence.)*
2. **Port the collectors.** SERP, autocomplete, Trends, volume/CPC, domains as Convex actions writing observations; port signal extraction with tests.
3. **New integration #1: operator research.** Google Places (or DataForSEO Business Data) per opportunity territory → `operators` + review observations. *(Unblocks Score E, the biggest gap.)*
4. **Deterministic scoring v1.** Scores A–I as pure versioned functions; per-bucket weight vectors; `scoreRuns` frozen per computation; reproducibility test.
5. **AI research layer.** Structured-output research actions with mandatory citations + evidence-type labels: job/margin economics per service (Score D inputs), SERP-weakness narrative ("why beatable"), service-hypothesis generation for the general Unicorn search.
6. **Core UI.** Opportunity Table + Opportunity Detail + Data Quality views (reactive off Convex).
7. **General scan.** Run the pipeline over seeded services × cities (reusing cached volumes where fresh enough); produce ranked LHF and High-Value candidate lists.
8. **Cluster module.** `geographies` community records; AI community-discovery (North Texas MPC sweep) + Census/permit collectors; propensity + emergence + growth + household-value scores; Community × Service opportunity generation; Cluster view.
9. **Portfolio selection.** Bucket-weighted ranking + diversity caps + manual review UI → freeze the 8/8/4 (+4–6 cluster sites) `portfolios` record with full evidence trail.
10. **Domain finalist pass.** Availability + candidates for every finalist (pricing lookup optional/manual).

Stop there. No builder, no operations, no learning engine.

## 20. Risks / Unknowns

- **Evidence loss:** the raw SERP corpus and scored outputs are gitignored and live on one machine; the Supabase project may be paused/expired (writes were already failing at last commit). Export before anything else.
- **Estimate-heavy dimensions:** Lead Economics and all cluster dimensions (propensity, planned homes, velocity) rest on AI/manual research; confidence scoring must keep them visibly softer than measured dimensions or the portfolio will over-trust them.
- **Hyper-local demand under-reporting:** community-level keyword volume will frequently read zero; the Search Emergence design must prevent false "no demand" rejections (the old autocomplete-floor trick is the right instinct, extended).
- **Provider cost/quota:** a full re-scan (new scores need richer SERP + Places data) is a real, budgetable spend; per-run cost preview is worth building early.
- **Weight subjectivity:** per-bucket weight vectors are themselves HUMAN-ASSUMED v1 values; versioning them (Part 12) is what makes that acceptable.
- **Stale caches:** `volumes.json` observations date from the v0 scans; usable for triage, but finalists need fresh pulls.

## 21. Final Recommendation

**OPTION B.** Create a clean `RankRentOS` V2 on Next.js + TypeScript + Convex. Migrate the deterministic research/scoring functions, the provider wrappers, the seed data, and the already-paid evidence caches. Leave behind the pipeline plumbing, the Supabase layer, the single-score/classifier model, the app UI, and the unimplemented platform specs. First milestone: an evidence-backed, provenance-labeled, versioned-scored 8/8/4 portfolio recommendation plus the North Texas Community × Service cluster analysis — and nothing else.

Rationale against the alternatives: **Option A** fails because everything structural (persistence, scoring lifecycle, research unit, UI, language) must change anyway — "continuing" would be a rewrite conducted inside old constraints. **Option C** fails because it discards the ~30–35% of the repo that is genuinely valuable and slow to re-derive: calibrated SERP-weakness heuristics, four working provider integrations, curated niche/city economics seeds, and paid keyword evidence that directly accelerates the first scan.
