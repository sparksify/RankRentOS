# RankRentOS — The Opportunity Operating System
### Full build specification · v2 · 2026-08

> Everyone else builds tools that answer *"how do I rank this website?"*
> RankRentOS answers *"what should I build next?"*

The system discovers underserved local-service markets before anyone notices,
scores them 0–100 with practitioner-calibrated guardrails, finds the domain,
builds the site, and tracks the asset from watchlist to renting. The loop:

```
DISCOVER → SCORE → BUILD → DEPLOY → MONITOR → MONETIZE
                     ↑__________ outcome flywheel __________|
```

---

## 0. What already exists (v1 assets, all kept)

| Asset | Location | Role in v2 |
|---|---|---|
| Scan engine (SERP + autocomplete + Trends + content crawl + RDAP) | `src/serp.js, demand.js, domains.js` | Becomes the library the job runner calls |
| Scoring + demand gates + value model | `src/score.js, rescore.js, value.js` | Core of Opportunity Scoring; weights become DB-config |
| Deep-check (keyword variants) | `src/deep.js` | Auto-runs on anything entering the pipeline |
| DataForSEO volume/CPC | `src/volume.js` | Demand pricing layer |
| Supabase (runs/markets/domains/pipeline) | project `LeadGenScout` | Spine; schema extends, nothing dropped |
| Next.js app w/ auth + pipeline stages | `app/` | Grows into the full left-nav product |
| 1,392-market definitive dataset | Supabase + caches | Seed corpus + scoring calibration baseline |
| Practitioner knowledge (32 videos, 2 SOPs) | encoded in score.js + niches.json | Becomes the explicit Criteria Guardrail layer |

---

## 1. Architecture

### 1.1 The job engine (structural decision everything hangs on)
Discovery becomes **query-driven, not batch-driven**.

- `discovery_jobs` table: query params (service/radius/population/competition/
  AOV/recurring filters), status, progress log, API budget, results count.
- **Runner v1**: a persistent local/cron Node process that polls `discovery_jobs`
  (Vercel functions can't run 40-min scans). The app inserts a job; the runner
  streams progress rows; the UI subscribes. Identical UX to "cloud," zero infra.
- **Runner v2** (later): move to a hosted worker (Supabase queue / Inngest / small VPS).
- Every module call is cached-first (SERP, autocomplete, RDAP, volumes) — re-runs
  and overlapping jobs cost near zero.

### 1.2 Cost governor
- Each job gets a **projected-cost preview** (SerpAPI calls + DataForSEO cents)
  before it runs, and a hard per-job cap.
- Monthly budget tracker across all jobs; morning feed draws from a fixed
  nightly allowance.

### 1.3 Data model (new/changed tables)
```
niches          ← replaces niches.json; criteria attributes + source (manual|ai)
cities          ← full US Census places (~19k) + income/pop/growth; kills the curated-58 limit
neighborhoods   ← city_id, name, source (census|osm|llm), income, housing_age, validated bool
discovery_jobs  ← query, filters, status, budget, progress jsonb
markets         ← + neighborhood_id, keyword_set text[], freshness_at, flags text[]
opportunities   ← view: markets × domains × pipeline × niche criteria (what the UI reads)
sites           ← built assets: domain, stack, deploy url, gsc property, built_at
leads           ← calls/forms per site (CallRail/Twilio webhook ingest)
outcomes        ← predicted vs actual: rank_by_day, leads_mo, revenue_mo  ← THE FLYWHEEL
api_keys        ← encrypted per-service creds (Settings UI)
```

### 1.4 Criteria Guardrails (non-negotiable layer)
Hard filters that run BEFORE scoring, from the SOPs — a weak SERP in a bad
niche is a trap, not an opportunity:
- ticket floor OR ~100% margin; need > desire (desire allowed only as
  commission-flagged); no brand-loyalty niches (solar, med-spa, roofing
  replacement); no GBP-dependent niches; PE-saturation list; DIY-ability check.
- Guardrail failures still display — as flagged warnings ("scored 94 but:
  brand-loyalty niche") — the system explains its refusals.

---

## 2. Modules by phase

### Phase 1 — Discovery OS (the moat)
1. **Discovery Engine as a query**
   UI: Service · Radius · Population · Competition · AOV · Recurring → [Build]
   Streams: cities → demand → CPC → SERP → domains → done. Results ranked 0–100.
2. **Full-US city database** — Census places import w/ income, pop, growth.
3. **Neighborhood Finder** — per city: Census block groups + OSM place nodes +
   LLM pass for master-planned communities (Windsong Ranch, Light Farms…),
   validated against Maps. Neighborhoods = demographic precision + exact-match
   domain angles + the site's location-page architecture (NOT separate SERPs —
   Google localizes at city level; be honest about this in the UI).
4. **AI Demand Discovery** — LLM proposes services for a demographic
   ("what do affluent Windsong Ranch homeowners hire for?") → autocomplete
   confirms → DataForSEO prices → guardrails filter → scan scores survivors.
   Feeds the `niches` table forever; no more hand-curated lists.
5. **Opportunity Page (Zillow-style report)** — score + letter grades
   (Demand/Competition/EMD/Difficulty), "Why this scored highly" checklist,
   neighborhoods count, monthly search, suggested revenue, keyword set,
   who-you'd-outrank, domain picks w/ price + strategy (EMD vs PMD).
6. **Domain Finder v2** — availability + live price, PMD/brand-name generation
   (NashvilleTreePros pattern), one-click purchase link (buying stays manual).
7. **Freshness** — opportunities decay; auto-reverify (cached-aware rescan +
   deep-check) before Build unlocks on anything older than 30 days.
8. **Morning Opportunity Feed** — nightly cron walks unscanned frontier combos
   within budget; dashboard greets: "Good morning Steve — 17 new opportunities."

### Phase 2 — Builder (the machine)
Wizard: Business → Location → Neighborhoods → Services → Brand → Pages → Deploy.
- Consumes the opportunity row directly: keyword_set = service pages (§2.2:
  keyword research IS the sitemap), neighborhoods = location pages, competitor
  content map = the bar to clear (2–4× their depth).
- Generates: homepage, service pages, neighborhood pages, FAQ/semantic blocks,
  LocalBusiness+FAQ schema, images (alt/geo-tagged), internal links → homepage,
  sitemap/robots, tracked number + form on every page, GSC + analytics.
- Stack: Astro + Cloudflare (Kyle-host-validated: page one in ~1 week) with the
  build encoded as a skill file. Ticket-calibrated design: simple for rent-model,
  professional for commission-grade.
- **Site #1 gets built manually first** — the SOP's own rule: learn the manual
  criteria so you can debug the automated version. The Builder codifies what
  site #1 taught us.
- Build checklist enforcement incl. "noindex REMOVED" check.

### Phase 3 — Operate & Monetize
9. **Lead Engine** — CallRail/Twilio + form webhooks → `leads`; call volume is
   the health metric (never rankings); per-site occupancy.
10. **Operators v1 = prospect-list generator** (NOT a marketplace): every scan
    already stores businesses ranking below #5 — the SOP "20-list" of renters
    getting nothing. One click → export to FounderScout outreach pipeline
    (SerpAPI discovery → owner name → verified email → Smartlead). Trial-close
    and no-business-angle scripts embedded.
11. **Authority Engine** — citations orders, foundational-link checklists,
    copycat-backlink pulls, GBP tracker (legit-only; organic-first doctrine).
12. **Portfolio v2** — assets, revenue, occupancy %, leads, avg rank, winners;
    predicted-vs-actual per site.
13. **Outcome flywheel** — `outcomes` feeds scoring-weight calibration. After
    ~20 sites the 0–100 score is calibrated on OUR portfolio, which no
    competitor can copy. This is the compounding moat.

### Phase 4 — Scale & Platform
14. Analytics (traffic, calls, AI referrals: ChatGPT/Perplexity/Gemini).
15. Settings UI (encrypted `api_keys`; no .env editing).
16. Automation dashboard (the "AI employees" — architecturally: named jobs on
    the queue; marketing language only at the surface).
17. Operator Marketplace (self-serve operator accounts, capacity, close rates,
    lead assignment) — a startup of its own; only after portfolio proof.
18. Multi-user/SaaS hardening (RLS, roles, billing) IF it ever sells to others.

---

## 3. UI map (left nav)

| Nav | Phase | Reads |
|---|---|---|
| Dashboard (morning feed, portfolio KPIs) | 1 | opportunities, outcomes |
| Discovery (query builder + job progress) | 1 | discovery_jobs |
| Markets (all scored, filters, heatmap) | 1 | opportunities |
| Domains | 1 | domains |
| Builders | 2 | sites, build jobs |
| Portfolio | 1 (v1) / 3 (v2) | pipeline, sites, outcomes |
| Leads | 3 | leads |
| Operators | 3 | top_organic prospect lists |
| Automation | 4 | job queue |
| Analytics | 4 | leads, GSC, referrals |
| Settings | 4 | api_keys |

Design system: current SaaS look (light gray canvas, white cards, colored
status words, segmented KPI cells) — already approved.

---

## 4. Honest constraints & guardrails (keep these visible)

- **Neighborhood ≠ separate SERP.** Value = demographics + domain angle +
  content architecture. Don't let the UI imply 22 neighborhoods = 22 markets.
- **Keyword tools under-report hyper-local volume**; autocomplete floor
  assumptions are labeled on every estimate until real sites calibrate them.
- **Guru math is discounted 50%** everywhere revenue is projected.
- **GBP is upside, never a dependency** (2026 verification regime).
- **Buying is always a human click** — domains, citations, anything with money.
- Rent bands stay realistic ($300–$2k flat; commission for high-ticket).

---

## 5. Build order (working sessions)

1. **Session A — Foundations:** cities import (Census), niches → DB, schema
   migration (jobs/neighborhoods/outcomes/keyword_set), job runner v1 polling
   loop, cost governor.
2. **Session B — Discovery UI:** query builder, progress stream, results grid,
   guardrail flags surfaced.
3. **Session C — Neighborhood + AI discovery:** OSM/Census/LLM neighborhood
   pipeline, AI niche proposal loop, both wired into jobs.
4. **Session D — Opportunity page + Domain finder v2 + freshness.**
5. **Session E — Morning feed cron + Dashboard v2.**
6. **Session F+ — Builder** (after site #1 is built by hand).

Each session ends deployed (Vercel) and committed (GitHub: sparksify/RankRentOS).

---

## 6. North star

Every morning RankRentOS wakes up and says:
**"I found 17 businesses you should build today"** — not because someone
searched keywords, but because the system found underserved neighborhoods,
open exact-match domains, weak competitors, high CPC, high-income
demographics, recurring demand, and AI-search gaps — scored them, explained
itself, and put a Build button next to each one.
