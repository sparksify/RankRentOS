# RankRentOS — The Opportunity Operating System
### Full specification · v3 · 2026-08

> People think they're buying SEO.
> They're buying **confidence about where to invest the next $500**.

RankRentOS discovers underserved local-service markets, scores them with
practitioner-calibrated judgment, plans exactly what to build, builds it,
operates it, and learns from every outcome. The code is generic; the
intelligence lives in the **Playbooks**.

---

## 0. The six engines

```
Research Engine → Scoring Engine → Planning Engine → Builder Engine → Operations Engine → Portfolio Engine
        ↑______________________________ outcome flywheel ______________________________|
```

Entity lifecycle (each stage is its own table + screen + KPIs):

```
Research → Opportunity → Project → Asset → Revenue
```

---

## 1. Playbooks — the company's brain (top-level module)

One playbook per niche. The OS "already knows how to think" when you click one.

Each playbook stores:
- **verdict**: `build | commission-only | avoid` + evidence (a Hair Salon
  playbook exists to say *avoid: brand-loyalty purchase, low AOV* — knowing
  why-not is as proprietary as knowing how)
- discovery filters (population band, income floor, geography/climate match)
- scoring weight overrides
- keyword strategy (the 5–6 core service keywords; acQuery; long-tail patterns)
- sitemap + schema templates; content depth targets
- domain strategy (EMD vs PMD) + domainTerms
- outreach scripts (trial close, no-business angle, cold email)
- operator profile (who buys these leads; reachability; screen criteria)
- pricing model (ticket, margin, flat-rent band vs commission %)
- authority strategy (citations count, link approach, GBP stance)
- **track record** (from the flywheel): assets built, avg time-to-rank,
  prediction error, revenue accuracy — per-playbook, from asset #1 onward

Seed: ~30 playbooks encoded from the 24 scanned niches + both SOPs (including
avoid-verdict playbooks for plumbing/HVAC/roofing/solar/salons/etc.).
Version-controlled; updated by outcomes, never overwritten silently.

---

## 2. Research Engine

Eight research surfaces, all cached-first, all budget-governed:

| Surface | Source | Status |
|---|---|---|
| Market Research | SerpAPI SERP scans | built |
| Demand Research | autocomplete + Trends + DataForSEO volume/CPC | built |
| Neighborhood Research | Census block groups + OSM + LLM (master-planned communities) + Maps validation | new |
| Competitor Research | see Competitive Intelligence §3 | partial |
| Domain Research | RDAP + winner picker + PMD generation + price | built (v1) |
| Operator Research | below-#5 rankers per keyword (the SOP "20-list") → FounderScout outreach | data exists |
| Entity Research | GBP categories, citations presence, brand-search checks | new |
| AI Search Research | ChatGPT/Perplexity/Gemini answer probes per market | new |

Research runs as **query-driven jobs** ("Roofing · 50mi of Prosper · pop 50k+ ·
competition <35 · AOV $1.5k+ · recurring") with a projected-cost preview and a
hard per-job budget cap. Full-US Census places DB (~19k cities) replaces the
curated 58.

**Criteria Guardrails** run before scoring (playbook verdicts + need/desire,
ticket floors, brand-loyalty, PE saturation, GBP-dependence, DIY-ability).
Failures are shown, not hidden: "scored 94 — flagged: brand-loyalty niche."

---

## 3. Competitive Intelligence (own engine, feeds Builder)

Two depths, cost-scoped:
- **Shallow** (every scanned market, ~free): top organic, inner-page/dir
  composition, content word counts, domain ages — current behavior.
- **Deep** (auto-runs on promotion to Opportunity): top-20 competitor cards —
  services offered, review counts, GBP categories, internal links, schema,
  backlinks (DataForSEO), entities, content coverage map, neighborhood
  coverage, missing services, AI mentions.

The Builder consumes the deep card as "the bar to clear" (2–4× depth,
missing-services exploitation). Flywheel: every built asset's ranking outcome
validates which competitor weaknesses actually mattered.

---

## 4. Scoring Engine

Six sub-scores → one overall:

| Sub-score | Computed from |
|---|---|
| Demand | volume, CPC, autocomplete, trends, seasonality |
| Competition | SERP composition, content depth, domain ages, backlinks, franchises |
| Authority (required) | gap between competitor authority and zero-DR start |
| Monetization | ticket × margin, rent band vs commission, operator availability, buyer proof |
| Automation | how fully the playbook can build/operate this unattended |
| **Confidence** | data completeness: measured volume? deep-checked? fresh <30d? CI deep card? |

**Confidence is honest**: score 94 / confidence 42 renders as
*"I don't know enough yet — run Deep Research ($0.40) to find out"* with a
one-click job. No pretending.

Weights live in DB config, overridable per playbook, calibrated by outcomes.

---

## 5. Planning Engine (new — sits between Score and Build)

Click an opportunity → get a **blueprint**, not a build:

```
Epoxy Garage Floors — Prosper          Build Score 97
Recommended assets: main site · 8 neighborhood pages · 6 service pages ·
18 FAQs · 22 supporting articles · GBP · Facebook · YouTube · Nextdoor ·
Chamber listing · 220 citations · authority goal DR18
Estimated cost $42 · estimated time 18 min · projected revenue $2,700/mo
[Approve → creates Project]
```

Rules:
- Every number is **computed, never decorative**: cost from live API/token
  price sheets; time from measured past builds; revenue from the value model
  with assumptions labeled. V1 shows ranges + its work.
- The blueprint = the SOP per-site build checklist instantiated from the
  playbook template × the CI deep card × the neighborhood set.
- Approving a blueprint promotes Opportunity → Project and locks a budget.
- Freshness gate: research older than 30 days auto-reverifies before approval.

---

## 6. Builder Engine

Consumes an approved Project: keyword set = service pages; neighborhoods =
location pages; CI card = content bar; playbook = templates/schema/design tier
(simple for rent-model, professional for commission-grade).

Generates: homepage, service pages, neighborhood pages, FAQ/semantic blocks,
LocalBusiness+FAQ schema, geo-tagged images, internal links → homepage,
sitemap/robots, tracked number + form every page, GSC + analytics, deploy
(Astro + Cloudflare). Checklist enforcement incl. noindex-removed.

**Asset #1 is built by hand** (SOP rule: learn the manual criteria before
automating). The Builder codifies what it teaches.

---

## 7. Operations Engine

- **Lead Engine**: CallRail/Twilio + form webhooks → `leads`; call volume is
  the only health metric; alerts on drops.
- **Operator pipeline v1** = prospect-list generator from stored below-#5
  rankers → FounderScout stack (discovery → owner → verified email →
  Smartlead) with playbook scripts. Marketplace is Phase 4+.
- **Authority ops**: citation orders, foundational links, copycat pulls,
  GBP tracker (legit-only; organic-first doctrine).
- Occupancy per asset; renter screening notes; Stripe billing later.

---

## 8. Portfolio Engine + the flywheel

Assets, revenue, occupancy %, leads, avg rank, winners/losers.
`outcomes` table records predicted vs actual (rank-by-day, leads/mo, $/mo)
**per asset AND per playbook**. The per-playbook track record ("Dumpster
Rental: 6 assets, 3.1 wks avg to rank, ±18% prediction error") is the number
that makes the OS credible — and eventually sellable. Recording starts at
asset #1.

---

## 9. Morning Brief (the addictive surface)

Nightly budgeted job: scans new frontier combos + re-scans a rotating slice of
known opportunities/assets, then **diffs against snapshots**:

```
Good Morning Steve — 17 new opportunities
· 3 opportunities improved overnight   · 2 competitors disappeared
· 5 domains became available           · 1 neighborhood passed demand threshold
· 2 opportunities lost score           · 1 asset dropped rankings
Estimated new monthly revenue: $8,300          [Review →]
```

---

## 10. AI employees (embraced, as presentation)

Named personas over queue job types — visible work streams, real psychology;
underneath, debuggable jobs (`research.neighborhoods`, `build.content`, …).

- **Research**: 🔍 Scout · 🌎 Atlas · 🏘 Neighborhoods · 📊 Analyst · 🧠 Strategist
- **Build**: 🏗 Builder · ✍ Writer · 🖼 Designer · 🔗 Linker · 📈 Optimizer
- **Operations**: ☎ Dispatcher · 📞 Call Monitor · 💰 Revenue · 📈 Portfolio · 🤖 Automation

---

## 11. Infrastructure decisions

- **Job runner v1**: plain Node poller (`npm run worker`) on the Mac Studio
  against a Supabase `jobs` table (persistence, retry columns, progress
  stream). **No BullMQ/Redis until concurrency demands it** — the job contract
  is the table, so upgrading the runner later (VPS, BullMQ, Cloudflare Queues)
  is zero-rewrite by design.
- **API keys**: RankRentOS gets **dedicated keys** (own SerpAPI account before
  the next big scan — the FounderScout quota collision taught this). Settings
  UI stores encrypted creds with a per-service `Shared | Dedicated` toggle.
- App: Next.js on Vercel (repo `sparksify/RankRentOS`, root `app/`), password
  auth, server-side Supabase. Domain: www.rankrentos.com.
- DB: Supabase `LeadGenScout` → new tables: `playbooks, jobs, neighborhoods,
  opportunities, projects, assets, leads, outcomes, api_keys, snapshots`.

---

## 12. Honest constraints (visible in-product)

- Neighborhoods ≠ separate SERPs — demographic precision + domain angle +
  content architecture. UI never implies 22 neighborhoods = 22 markets.
- Keyword tools under-report hyper-local; assumption floors are labeled until
  the flywheel calibrates them.
- Revenue projections discounted ~50% (guru-math rule) until own-portfolio data.
- GBP = upside, never dependency. Buying anything = human click.
- Confidence < threshold blocks the Build button, not the truth.

---

## 13. Build order

| Session | Delivers |
|---|---|
| A | Schema v3 (playbooks/jobs/lifecycle/outcomes/snapshots) · Census cities import · playbook seeding (~30 from SOPs+scans) · `npm run worker` poller · cost governor |
| B | Research query UI + job progress stream + guardrail flags + Markets grid on new schema |
| C | Neighborhood Research (Census/OSM/LLM) · AI Demand Discovery loop |
| D | CI deep cards · six sub-scores + Confidence · Opportunity page (Zillow-style) |
| E | Planning Engine blueprints · freshness gate · Domain finder v2 |
| F | Morning Brief cron + snapshot diffing + Dashboard v2 |
| G | Asset #1 built by hand → Builder Engine codifies it |
| H+ | Operations (leads, operator lists) · Portfolio v2 · employees UI |

Each session ends deployed (Vercel) + committed (GitHub).

---

## 14. North star

Every morning the OS says: *"I found 17 businesses you should build today"* —
because it found underserved neighborhoods, open exact-match domains, weak
competitors, high CPC, high-income demographics, recurring demand, and AI
search gaps — scored them, **told you how confident it is**, showed you the
blueprint and the cost, and put a Build button next to each one.
