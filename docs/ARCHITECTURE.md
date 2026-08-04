# RankRentOS — Master Architecture
### The canonical data model · v1 · 2026-08
### Companion to SPEC.md (product) — this file is the LAW of the data layer

> **The doctrine: facts are forever; opinions are recomputed.**
> Observations are immutable and append-only. Every score, recommendation,
> valuation, and blueprint is derived, timestamped, and disposable.
> Research once → reuse forever, across every business we run.

---

## 1. The two kinds of data

| Kind | Rule | Examples |
|---|---|---|
| **Facts (immutable)** | Append-only. Never updated, never deleted. Every fact records its source + observed_at. | SERP snapshot, review count on a date, domain availability on a date, CPC on a date, a call that happened, a payment received |
| **Derived (disposable)** | Computed from facts by a versioned function. Stored with inputs, weights version, confidence, computed_at. Recomputable at will. | All scores (every lens), valuations, blueprints, morning-brief deltas, "recommended domain," projected revenue |

A derived value may never be the source for another fact. Lenses read facts;
they do not write them.

---

## 2. Entities

### Geographic spine
- **City** — Census place (~19k US). pop, income, growth, geo point.
- **Neighborhood** — belongs to City. source: census-block | osm | llm-discovered
  (master-planned communities), validated flag, income, housing age, geo.
- **Territory** ⭐ new — a metro cluster of Cities/Neighborhoods treated as one
  strategic unit. The answer to *"what metro should I own next?"*
  Derived territory score = aggregate niche opportunities × operator bench
  density × income × one-relationship-many-sites leverage.

### Market intelligence
- **Niche** — service category. Criteria attributes (need/desire, ticket,
  margin, PE risk, brand loyalty, GBP dependence, seasonality). Owned by its Playbook.
- **Playbook** — the brain for one Niche: verdict (build | commission-only |
  avoid + evidence), discovery filters, scoring-weight overrides, keyword
  strategy, sitemap/schema templates, outreach scripts, operator profile,
  pricing model, authority strategy, per-playbook track record (from outcomes).
- **Keyword** — term + geo scope. Observations: volume, CPC, trends series.
- **Market** — the research unit: Niche × (City | Neighborhood). Holds research
  state + freshness. Promotes to Opportunity.
- **SerpSnapshot** (fact) — full raw payload per query per date. Stored in
  Supabase Storage, indexed in DB. Never on one laptop.

### The business graph (the moat)
- **Business** — one row per real-world company. Identity = name + domain +
  phone, fuzzy-deduped across all scans and FounderScout. THE central entity.
- **BusinessObservation** (fact) — timestamped: rank for keyword, review
  count/rating, website/tech stack, content depth, GBP state, backlinks/DR,
  franchise/multi-location/PE flags. Tiered by acquisition cost:
  `scan` (free, automatic) · `enrichment` (pennies, on promotion: owner name,
  email, employees, revenue est. — always source-tagged; inferences labeled
  inferred) · `operate` (earned only: answers-phone rate, response speed,
  close rate, lead feedback — the uncopyable tier).
- **PipelineMembership** — one Business, many roles:
  lead | prospect | seo_client | rankrent_operator | acquisition_target |
  franchise_candidate | ai_employee_candidate | site_buyer.

### Asset lifecycle
```
Market → Opportunity → Project → Asset → Revenue
```
- **Opportunity** — a promoted Market: deep CI ran, lenses scored, blueprint
  eligible. Carries freshness (auto-reverify > 30 days).
- **Project** — an approved blueprint with locked budget. Build in progress.
- **Asset** — a live site: domain, stack, deploy, GSC, tracked number.
  Carries occupancy, operator link, marketplace valuation (derived).
- **Domain** — candidate or owned. DomainObservations (fact): availability
  flips, price. Winner/strategy (EMD vs PMD) are derived.
- **Lead** (fact) — call/form/SMS per Asset, routed to a Business (operator).
- **Revenue** (fact) — payments per Asset per period.
- **Outcome** (fact) — predicted vs actual (rank-by-day, leads/mo, $/mo),
  keyed to Asset AND Playbook. Feeds weight calibration. The flywheel.

### Operations
- **Job** — queue row (type, params, status, progress, budget, cost actual).
  AI-employee personas are presentation labels over job types.
- **ApiKey** — encrypted, per-service, shared|dedicated.

---

## 3. Lenses (all scoring is a viewpoint)

A **lens** = versioned pure function: `facts → {score, subscores, confidence,
reasons[]}`. Stored in `scores(entity_id, entity_type, lens, value, confidence,
weights_version, inputs_hash, computed_at)`. Same facts, many opinions:

| Lens | Over | Consumes |
|---|---|---|
| Rank & Rent Opportunity | Market/Opportunity | demand, competition, authority-gap, monetization, automation + confidence |
| Territory | Territory | aggregate of member opportunities + operator bench |
| SEO (client-services) | Business | weak-SEO detection ("SEO company [city]" play) |
| Operator | Business | reviews/reputation (scan) + answers/closes (operate) |
| Acquisition | Business | owner-age (inferred), weak web presence, no automation, recurring revenue, reviews, single-location |
| Franchise Candidate | Business | FounderScout criteria |
| AI-Employee Candidate | Business | manual-process signals |
| Website Sale | Asset | profit × multiple, traffic, lead history |

Rules: lenses never write facts; every lens exposes its reasons and its
confidence; confidence below threshold blocks action buttons, not the truth;
adding a lens = adding a function, never a schema change.

---

## 4. Engine ownership matrix (who writes what)

| Entity/Fact | Written by | Read by |
|---|---|---|
| City, Neighborhood, Territory | Research (imports + LLM discovery) | all |
| Keyword observations | Research | Scoring, Planning |
| SerpSnapshots, BusinessObservations (scan) | Research | everything |
| BusinessObservations (enrichment) | Research (on promotion) | lenses, FounderScout |
| BusinessObservations (operate) | Operations | Operator lens, routing |
| Playbooks | human + flywheel calibration | Research, Scoring, Planning, Builder |
| scores (all lenses) | Scoring | UI, Planning, Morning Brief |
| Opportunities, blueprints | Planning | Builder |
| Projects, Assets | Builder | Operations, Portfolio |
| Leads, Revenue, Outcomes | Operations | Portfolio, flywheel, lenses |
| Jobs | all engines enqueue; worker executes | Automation UI |
| Knowledge Graph | **owns nothing, serves everything** — it IS the store | every engine, FounderScout, future products |

Consumers of the same research: RankRentOS · FounderScout · website sales ·
acquisition pipeline · AI-employee sales · franchise lead gen · territory
expansion. One database, many businesses.

---

## 5. Territory Mode (the discovery reframe)

Old query: "find a good plumbing keyword."
New query: **"find me the next metro I should own."**

- Territory = seed city + radius (or named metro) → member cities/neighborhoods.
- Territory research job: run every playbook-approved niche across members;
  aggregate; count operator-bench candidates per niche.
- Territory report: "Prosper cluster — 7 buildable niches, 23 open EMDs,
  $9.4k/mo aggregate est., 14 operator candidates. Own it in 90 days."
- Blanket sequencing honors the SOP: one niche mastered → stamp cities;
  one operator → many sites (Beverly Hills Deck Builders pattern).

---

## 6. The canonical relationship walk

```
Territory ─ City ─ Neighborhood
                │
   Niche ─ Playbook
                │
             Market ──promote──▶ Opportunity ──approve──▶ Project ──deploy──▶ Asset
                │                     │                                        │
         SerpSnapshot            Blueprint(derived)                     Lead ─ Revenue ─ Outcome
                │                                                              │
            Business ─ BusinessObservation(scan|enrich|operate)          Operator(=Business role)
                │                                                              │
        PipelineMembership ──▶ FounderScout / Acquisition / Franchise    Buyer(=Business role)
                │
             scores (one row per lens, recomputable)
```

The flagship query this model must answer in plain SQL + geo index:
*"Every affluent master-planned community in Texas with weak epoxy
competitors, available exact-match domains, and ≥3 operator candidates."*
(Postgres. Not a graph database. Graph infra only if multi-hop reasoning
ever outgrows SQL.)

---

## 7. Positioning (naming the thing correctly)

Not SEO software. A **market intelligence platform**: territory dominance,
expansion forecasting, operator intelligence, acquisition targeting,
omnipresence. Rank & Rent is the first *lens*, not the product.
