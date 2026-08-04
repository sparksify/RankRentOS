# RankRentOS — Master Architecture
### Canonical Product and Data Architecture · v3 · 2026-08
### Companion to `SPEC.md`

> **This document is the constitution of RankRentOS.**
>
> Product features may evolve. Interfaces may change. Providers may be replaced.
> The principles, entity boundaries, and data doctrine defined here must not be bypassed without an explicit architecture revision.

---

# 1. Product Definition

RankRentOS is not primarily an SEO application, website builder, or collection of AI agents.

It is a:

> **Market intelligence and opportunity operating system for discovering, evaluating, building, operating, valuing, and compounding local-business digital assets.**

The system continuously converts external market activity into structured intelligence and structured intelligence into economic decisions.

The operating loop is:

```text
Observe → Normalize → Understand → Score → Plan → Build → Operate → Measure → Learn → Recompute
```

Rank & Rent is the first commercial lens applied to this intelligence layer. It is not the limit of the platform.

The same underlying research can support: Rank and Rent asset discovery · Territory expansion · Local SEO client acquisition · Operator identification · Franchise candidate discovery · Business acquisition targeting · AI employee sales · Website sales · Franchise lead generation · Asset valuation · Lead-buyer marketplaces.

The principle is:

> **Collect once. Normalize once. Reuse indefinitely.**

Every new product should primarily add lenses, workflows, actions, or outputs — not parallel data silos.

---

# 2. The Core Doctrine

> **Facts are forever. Opinions are recomputed.**

RankRentOS contains three logical data layers.

## 2.1 Raw Evidence
Raw external payloads preserved as received (DataForSEO SERP response, Google Places response, Census row, domain lookup, website HTML, call recording metadata, form payload, Stripe payload).

Raw evidence is immutable and stored with: provider · acquisition method · source identifier · request parameters · observed timestamp · ingestion timestamp · payload checksum · storage location · provider cost · job and execution identifiers.

Large raw payloads belong in object storage. Searchable metadata and normalized indexes belong in PostgreSQL.

## 2.2 Canonical Facts
Normalized, append-only observations derived directly from raw evidence ("a business had 47 reviews on August 4, 2026"; "a domain was available"; "a call lasted 94 seconds"; "a payment of $1,500 was received").

Canonical facts are not overwritten when the external world changes — a newer observation is appended.

Every canonical fact records: entity identity · observation type · observed value · source · source confidence · observed timestamp · ingestion timestamp · raw evidence reference · collection method · job and execution identifiers.

## 2.3 Derived Intelligence
Recomputable interpretations of facts (opportunity score, competition score, recommended domain, suggested sitemap, territory score, operator score, asset valuation, projected revenue, acquisition likelihood, Morning Brief recommendation).

Every derived value records: derivation type · function/lens version · input references or hash · weights version · model version when applicable · confidence · reasons · computed timestamp · expiration/freshness policy.

Derived intelligence may be cached for performance, comparison, and history. It is never treated as permanent truth. A derived value may not be converted into a canonical fact merely because the system produced it.

---

# 3. Product Architecture

```text
                            RANKRENTOS
                 ┌────────────────────────┐
                 │   COLLECTION LAYER     │
                 │ Providers · Crawlers   │
                 │ Imports · Operations   │
                 └────────────┬───────────┘
                              │
                 ┌────────────▼───────────┐
                 │  CANONICAL KNOWLEDGE   │
                 │ PostgreSQL + Storage   │
                 └────────────┬───────────┘
                              │
          ┌───────────────────┼────────────────────┐
          │                   │                    │
          ▼                   ▼                    ▼
   Research Engine       Scoring Engine       Identity Engine
          │                   │                    │
          └───────────────────┼────────────────────┘
                              ▼
                      Opportunity Engine
                              ▼
                       Planning Engine
                              ▼
                        Builder Engine
                              ▼
                      Operations Engine
                              ▼
                       Portfolio Engine
                              ▼
                     Marketplace Engine
```

The canonical knowledge layer serves every engine. Engines do not maintain private copies of shared market entities.

---

# 4. Engine Responsibilities

## 4.1 Collection Layer
Connects RankRentOS to external reality: provider adapters, crawlers, importers, webhooks, telephony ingestion, payment ingestion, analytics ingestion, Search Console ingestion, human-entered observations.

Its only responsibilities: (1) acquire evidence, (2) preserve raw payloads, (3) normalize canonical observations, (4) record provenance and cost, (5) resolve or queue entity identity. It does not score opportunities or make recommendations.

## 4.2 Identity Engine
Determines whether two records represent the same real-world entity. Its most important responsibility is one canonical `Business` record per real-world company.

Identity signals: normalized name · root domain · phone · address · geographic proximity · Google Place ID · state registration identifiers · brand/franchise affiliation · social profile identity.

Must support: exact matches · probable matches · human review · merge operations · split operations · match confidence · identity history. **A merge must not destroy observation history.** All source records remain traceable to their original evidence.

## 4.3 Research Engine
> Discover and observe markets before deciding what to do with them.

Modules: territory / city / neighborhood / master-planned-community discovery · niche & service discovery · keyword discovery · search-demand & AI-demand discovery · competition discovery · business discovery · domain discovery · authority discovery · website technology discovery · operator discovery · historical trend discovery · entity & ownership discovery.

Research produces facts. It does not approve builds.

## 4.4 Scoring Engine
> Apply versioned viewpoints to canonical facts.

A lens is a versioned pure function: `facts → score + subscores + confidence + reasons`. All lenses share a common interface and write to a generalized score store: entity type · entity ID · lens · value · subscores · confidence · reasons · weights version · function version · input hash · computed timestamp · freshness timestamp.

Adding a new lens must not require a new core entity schema.

## 4.5 Opportunity Engine
> Convert researched markets into actionable candidates and qualified opportunities.

```text
Market → Candidate → Opportunity → Approved Blueprint → Project
```

A `Market` is a research unit. A `Candidate` passed inexpensive preliminary gates. An `Opportunity` completed deeper competitive intelligence and scoring. An approved opportunity receives a versioned blueprint. Promotion is explicit, auditable, and reversible without deleting history.

## 4.6 Planning Engine
> Decide what should be built, why, and with what resources.

Produces a versioned `Blueprint`: target niche & geography · keyword strategy & clusters · domain strategy & recommended domain · service architecture · geographic architecture · sitemap · content plan · schema plan · internal-linking plan · authority plan · citation plan · GBP strategy · tracking plan · operator strategy · budget · timeline · revenue projection · risks · assumptions · confidence · approval requirements.

Planning decides what should exist. Builder executes.

## 4.7 Builder Engine
> Convert approved blueprints into deployed assets.

Capabilities: repository creation · site generation · content generation · image generation/selection · schema · internal links · robots · sitemap · analytics config · call tracking config · deployment · Search Console config · health verification.

Providers/technologies: Astro, Next.js, Cloudflare, Vercel, Supabase, GitHub, GSC, CallRail, Twilio.

Builder outputs are versioned. A rebuild does not erase the previous asset state.

## 4.8 Operations Engine
> Operate live assets and measure what happens after deployment.

Owns operational facts: calls · forms · SMS · bookings · qualified/routed leads · operator responses · answer speed · call outcomes · lead feedback · closed jobs · revenue · refunds · operator performance.

Performs: lead routing · operator assignment · call quality review · delivery notifications · revenue reconciliation · health checks · SLA monitoring · operator escalation.

**The Operations Engine creates the least copyable data in the system** because it observes what businesses actually do with real leads.

## 4.9 Portfolio Engine
> Treat each digital asset as an owned economic instrument.

Per asset: revenue · direct/allocated expenses · gross/net profit · leads · qualified leads · close rate · revenue per lead · traffic · ranking distribution · growth rate · operator concentration · customer concentration · asset health · current/projected valuation · actual sale value · ROIC · payback period · portfolio fit.

Portfolio values are derived. Payments, expenses, leads, and sales are facts.

## 4.10 Marketplace Engine
> Match owned intelligence and digital assets with operators, lead buyers, licensees, and purchasers.

Future capabilities: asset listings · website sales · lead-buyer matching · operator matching · territory licensing · portfolio sales · broker network · due-diligence rooms · historical performance verification · buyer qualification.

The Marketplace is a future application of the existing data graph. It must not become a separate source of truth.

---

# 5. Canonical Entities

## 5.1 Geographic Spine
- **City** — Census place / normalized municipality: name, state, county, population, household income, growth, boundary, point, source identifiers. Demographic values are observations by dataset year, not overwritten columns.
- **Neighborhood** — belongs to a City. Sources: census blocks, OSM, government datasets, real-estate sources, human research, LLM-assisted discovery. Attributes: name, type, boundary, point, parent city, source, validation status. **Master-planned communities are neighborhoods with a subtype.**
- **Territory** — a strategic geographic cluster (seed city + radius | named metro | selected cities | selected neighborhoods | custom polygon). Not a reporting label — the unit that answers *"what metro should we own next?"* Membership lives in a join table (cities/neighborhoods can belong to multiple territories).

## 5.2 Market Intelligence
- **Niche** — normalized local-business category. Attributes: need vs desire, average ticket, margin, recurring potential, seasonality, brand loyalty, GBP dependence, PE risk, automation potential, operator requirements. Values may be canonical editorial data, observations, or playbook assumptions depending on origin.
- **NicheService** — a service/subservice/commercial intent within a Niche (Epoxy Flooring → garage floor epoxy, commercial epoxy, polyaspartic coating, concrete resurfacing). Avoids `Service` as a competing top-level concept.
- **Playbook** — the operational intelligence package for a Niche: build verdict + evidence · discovery filters · scoring overrides · keyword strategy · site architecture · schema templates · content requirements · internal-linking patterns · authority strategy · citation strategy · outreach scripts · operator profile · pricing model · KPIs · expected timeline · failure modes · known exceptions · historical track record · version · approval status. **Versioned; past projects link to the exact version used.**
- **Keyword** — normalized term/intent: text, intent, niche, niche service, geographic scope, parent topic, normalized form. Volume/CPC/trend/rank/SERP data are observations, not static truth.
- **Market** — the fundamental research unit: `Niche × Geography` (city | neighborhood | territory member | custom target). Contains workflow state and research freshness; does not store mutable external metrics as truth.
- **SerpSnapshot** — immutable observation of a results page: keyword, geography, engine, device, language, result type, observed timestamp, raw payload reference, parsed results, provider, cost.
- **KeywordObservation** — append-only: volume, CPC, competition, trend, search growth, AI mention frequency.

## 5.3 Business Intelligence
- **Business** — one row per real-world company; the central commercial entity. Can simultaneously be competitor, operator, lead, SEO prospect, acquisition target, franchise candidate, AI-employee candidate, site buyer, lead buyer. Core identity fields minimal and stable; changing characteristics live in observations.
- **BusinessLocation** — a physical or service-area location (multiple offices, multiple GBPs, franchise locations, branch phone numbers, different local performance).
- **BusinessObservation** — append-only, tiered:
  - **Scan** (free/automatic): rank, reviews, rating, website, tech stack, content depth, GBP condition, backlinks, franchise/multi-location/PE signals.
  - **Enrichment** (paid, post-promotion): owner identity, owner email, employee estimate, revenue estimate, founding year, ownership structure. **Every inferred field labeled inferred with confidence.**
  - **Operate** (earned through commercial interaction): answer rate, response time, booking rate, close rate, lead feedback, dispute rate, payment reliability. **The major competitive moat.**
- **PipelineMembership** — Business ↔ commercial roles (lead, prospect, SEO client, R&R operator, acquisition target, franchise candidate, AI-employee candidate, website buyer, lead buyer, partner). Pipeline state belongs to the membership, not the Business.
- **EntityRelationship** — sourced relationships (Business owns Business; Person owns Business; Business belongs to FranchiseBrand; PE firm owns Business; Business operates Location; Business buys leads from Asset). Each: subject, predicate, object, source, confidence, effective dates, observed timestamp, inferred flag. **Use generic triples selectively — high-volume operational relationships get explicit relational tables.**

## 5.4 Domain Intelligence
- **Domain** — normalized name; states: discovered, available, premium, auctioned, owned, attached to Asset, previously owned, expired.
- **DomainObservation** — append-only: availability, registration price, premium price, auction price, registrar, expiration, DNS state, historical usage, authority metrics. EMD-vs-PMD strategy and recommended winner are derived decisions.

## 5.5 Opportunity Lifecycle
```text
Market → Candidate → Opportunity → Blueprint → Project → Asset → Lead → Conversion → Revenue → Outcome
```
- **Candidate** — passed inexpensive gates; prevents deep-research spend on every Market.
- **Opportunity** — completed required research + lens evaluation. Records market, qualification state, required-evidence state, freshness, approval state, blocking conditions. Scores remain separate derived records.
- **Blueprint** — versioned planning artifact; own entity because it is reviewed, edited, approved, rejected, versioned, locked, and executed by multiple jobs.
- **Project** — approved execution effort: blueprint version, budget, owner, status, target dates, actual cost, build jobs, approval history.
- **Asset** — owned/managed live property (lead-gen site, directory, territory portal, authority site, content property): domain relationship, deployment state, repository, analytics identity, GSC identity, tracked numbers, operator assignment, occupancy, lifecycle status.
- **AssetVersion** — a versioned deployed state (launch, rebuild, CMS migration, domain migration, architecture change, major content revision, tracking change). **Performance outcomes attribute to the active AssetVersion.**

## 5.6 Commercial Outcomes
- **Lead** — immutable inbound commercial event (call, form, SMS, chat, booking, email): asset, source, timestamp, contact info, consent info, routing result, assigned Business, raw payload reference.
- **LeadEvent** — append-only lifecycle: received, routed, accepted, contacted, qualified, booked, quoted, won, lost, disputed, refunded. Preserves the funnel without overwriting a status field.
- **Revenue** — factual transactions: operator rent, lead fee, commission, asset sale, setup fee, refund, credit. Not a substitute for payment-processing evidence.
- **Expense** — factual costs: provider usage, domains, hosting, content, links, call tracking, operator management, development, advertising, maintenance.
- **Outcome** — structured predicted-vs-actual comparison (rank-by-day, lead volume, revenue, build cost, operator response), linked to Asset, AssetVersion, Opportunity, Blueprint, Playbook version, lens version, prediction version. **Outcomes power calibration; they never rewrite the historical prediction.**

---

# 6. Lenses

A lens is a named, versioned interpretation of facts.

**Initial lenses:**
- **Rank & Rent Opportunity** (Market/Candidate/Opportunity): demand, competition, authority gap, domain conditions, monetization, automation potential, operator availability, confidence.
- **Territory** (Territory): member opportunity distribution, aggregate revenue potential, operator bench, household economics, adjacency, one-relationship-many-assets leverage, niche repeatability.
- **SEO Client** (Business/Location): weak visibility, website quality, review strength, market value, ability to pay, service fit, existing marketing signals.
- **Operator** (Business): reputation, review velocity, coverage, response rate, answer speed, qualification rate, booking rate, close rate, payment reliability.
- **Acquisition** (Business): recurring revenue, ownership signals, weak web presence, lack of automation, reputation, location count, industry attractiveness, owner dependence, succession risk.
- **Franchise Candidate** (Business): FounderScout criteria + franchise-readiness observations.
- **AI Employee Candidate** (Business): manual-process signals, staffing patterns, responsiveness, workflow complexity, automation potential.
- **Website Sale** (Asset): profit, revenue stability, traffic, ranking stability, lead history, operator concentration, niche risk, asset age, growth, transferability.

**Lens rules:**
1. Lenses never write canonical facts.
2. Every lens exposes reasons.
3. Every lens exposes confidence.
4. Confidence may block action without hiding the score.
5. Lens versions are immutable after use.
6. A new lens must not require core schema changes.
7. Model-generated reasoning must be distinguishable from deterministic calculations.

---

# 7. Territory Mode

The product should not train the user to ask *"what keyword should we build?"* The higher-value question is:

> **"What territory should we own next?"**

A Territory research job: (1) resolve member cities/neighborhoods → (2) run all approved Playbooks across members → (3) discover candidate Markets → (4) low-cost qualification → (5) count relevant Businesses → (6) estimate operator bench → (7) check domain availability → (8) aggregate buildable Opportunities → (9) produce a territory-level plan.

```text
Prosper Territory: 7 buildable niches · 23 viable domains · 14 operator candidates
$9,400 estimated monthly revenue · 3 high-confidence first builds · 90-day deployment sequence
```

Two repeatable expansion patterns: **master one niche → stamp it across cities**; **master one operator relationship → supply multiple assets**.

---

# 8. Playbooks as Institutional IP

A Playbook is the accumulated operating knowledge for winning in a Niche — not a prompt or weight set. Each Playbook should eventually answer: build/sell/commission/avoid? · which geographies work · which demand patterns matter · which competitive patterns are deceptive · domain strategy · page types that rank · authority required · conversion model · operator profile (and what a weak operator looks like) · pricing · time-to-rank · kill criteria · observed exceptions · prediction accuracy history.

Every Opportunity and Project references the exact Playbook version used.

---

# 9. Jobs, Tasks, and Executions

Three levels — a single generic Job record is insufficient for long-running multi-stage workflows.

- **Job** — user-facing unit ("Research Prosper Territory", "Build Approved Opportunity"): type, parameters, priority, status, progress, budget, actual cost, requested-by, parent job, timestamps.
- **Task** — discrete step (resolve geography, fetch keywords, fetch SERPs, parse competitors, enrich businesses, check domains, run lenses, generate blueprint), with dependencies and retry behavior.
- **Execution** — one attempt at a Task: provider, AI model, worker, prompt/function version, start/end, latency, input/output references, token usage, provider cost, error, retry number, success state. Gives cost accounting, debugging, reliability analysis, provider comparison.

AI-employee personas are presentation labels over Jobs, Tasks, tools, and permissions — not separate backend architectures.

---

# 10. Horizontal Platform Services

Shared services: authentication · organizations · workspaces · roles/permissions · approval policies · job orchestration · scheduling · notifications · audit logging · billing · usage metering · provider credentials · secrets management · model routing · object storage · caching · feature flags · error monitoring · cost controls · data retention · export · human review queues.

**Multi-tenancy:** core business tables are workspace-aware **where ownership or privacy requires it**. Shared reference data (cities, census observations, general niches, public SERP evidence) is not workspace-bound. Workspace-owned data: opportunities, projects, assets, leads, revenue, private operator observations, credentials, internal playbooks. **Do not place `workspace_id` mechanically on every table.**

---

# 11. Data Ownership Matrix

| Data | Written By | Primary Consumers |
| --- | --- | --- |
| Geographic entities | Research + imports | All engines |
| Raw provider payloads | Collection Layer | Normalizers, audit |
| Keyword observations | Research | Scoring, Planning |
| SERP snapshots | Research | Scoring, Opportunity |
| Business identity | Identity Engine | All commercial applications |
| Scan observations | Research | All lenses |
| Enrichment observations | Research | Lenses, FounderScout |
| Operate observations | Operations | Operator Lens, Portfolio |
| Domains + observations | Research | Opportunity, Planning |
| Playbooks | Human owners + calibration workflows | Research, Scoring, Planning, Builder |
| Scores | Scoring Engine | Opportunity, UI, Briefs |
| Candidates + Opportunities | Opportunity Engine | Planning |
| Blueprints | Planning Engine | Approvals, Builder |
| Projects + AssetVersions | Builder Engine | Operations, Portfolio |
| Leads + lead events | Operations Engine | Portfolio, Operator Lens |
| Revenue + expenses | Operations + financial integrations | Portfolio |
| Outcomes | Calibration workflows | Playbooks, lens development |
| Jobs, Tasks, Executions | All engines + workers | Automation UI, audit, cost controls |

The canonical knowledge layer owns no business process. It is the shared store through which all engines cooperate.

---

# 12. The Canonical Relationship Walk

```text
Territory ─┬─ City
           └─ Neighborhood

Niche ─ NicheService ─ PlaybookVersion
  │
  └──────────── Market
                  │
                  ├─ KeywordObservation
                  ├─ SerpSnapshot
                  ├─ Candidate
                  └─ Business observations
                           │
                           ▼
                     Opportunity
                           │
                     BlueprintVersion
                           │
                        Project
                           │
                         Asset
                           │
                     AssetVersion
                           │
            Lead ─ LeadEvent ─ Revenue ─ Outcome
                           │
                        Business
                           │
                 PipelineMembership
                           │
          Operator · Buyer · Prospect · Candidate

All applicable entities
          ├─ Scores
          ├─ Relationships
          ├─ Jobs
          └─ Evidence provenance
```

---

# 13. Flagship Query Requirement

The architecture must support, in ordinary PostgreSQL with relational joins and geographic indexes:

> **Find every affluent master-planned community in Texas with weak epoxy competitors, available exact-match domains, and at least three viable operator candidates.**

Requires: geographic boundaries/points · validated neighborhood subtypes · niche normalization · market membership · business deduplication · BusinessLocation support · competitor observations · domain observations · Operator Lens scores · observation freshness · confidence thresholds.

**PostgreSQL with PostGIS is the canonical datastore.** A separate graph database only after measured SQL limitations emerge from real multi-hop workloads.

---

# 14. Product Surfaces

Initial surfaces:
- **14.1 Discover** — search territories, niches, cities, neighborhoods, markets, businesses, domains.
- **14.2 Opportunities** — candidates, opportunity reports, scores, evidence, confidence, recommended actions, freshness, blocking conditions.
- **14.3 Blueprint** — inspect/approve domain strategy, sitemap, services, neighborhood coverage, content, authority plan, operator strategy, cost, timeline, revenue estimate.
- **14.4 Automation** — jobs, tasks, executions, provider costs, failures, retries, human review queues.

Future surfaces: Build · Operations · Portfolio · Businesses · FounderScout · Marketplace · Morning Brief.

---

# 15. Discovery MVP

The first production milestone is not the entire operating system. It is:

```text
Research → Canonical Facts → Candidate Qualification → Opportunity Scoring → Blueprint
```

**MVP input:** niche · seed location · radius/territory · population constraints · competition constraints · revenue assumptions.

**MVP output:** opportunity score · demand analysis · competition analysis · authority gap · suggested domains · suggested cities/neighborhoods · suggested keywords · suggested services · competitor summary · suggested sitemap · revenue estimate · confidence · reasons · evidence freshness · recommended next action.

**MVP product pages:** discovery form · job progress · territory/market results · opportunity report · business detail · evidence viewer · blueprint viewer · provider & API settings.

**Explicitly excluded from MVP:** full website builder · CRM · marketplace · automated lead routing · full portfolio accounting · franchise workflows · acquisition workflows · complex AI-employee personas · autonomous GBP management · full backlink execution.

The MVP must preserve the architecture required for these future products without prematurely building them.

---

# 16. Recommended Technical Architecture

- **Application:** Next.js · TypeScript · Tailwind CSS · shadcn/ui
- **Database:** PostgreSQL · Supabase · PostGIS · Drizzle ORM
- **Storage:** Supabase Storage or S3-compatible object storage
- **Workers:** Node.js workers · durable job definitions · database-backed queue initially · BullMQ-ready adapter if Redis is introduced · idempotent task execution · retry and dead-letter support
- **AI:** provider-independent model interface · OpenAI adapter · Anthropic adapter · OpenRouter-compatible adapter · structured outputs · prompt versioning · model and token cost tracking
- **Initial data providers:** DataForSEO · Google Places · OpenStreetMap · US Census · domain availability provider
- **Future integrations:** GSC · GBP · Twilio · CallRail · Stripe · Cloudflare · Vercel · GitHub · Namecheap

Provider-specific objects must not leak into domain logic.

---

# 17. Engineering Rules

1. Strong typing throughout the system.
2. No business logic inside React components.
3. External providers must sit behind interfaces.
4. Provider payloads must be preserved before normalization.
5. Every observation must include provenance.
6. Every task must be idempotent where practical.
7. Every derived result must be versioned.
8. Every AI call must record model, prompt version, cost, and output.
9. Every expensive research step must have a budget gate.
10. Entity resolution must occur before creating duplicate Businesses.
11. Operational facts must never be replaced with estimated values.
12. Inferred data must be visibly labeled.
13. Observation freshness must be queryable.
14. Human overrides must be audited, not silently substituted.
15. Project code organized by domain, not provider.
16. Database tables represent durable concepts, not individual screens.
17. Generic JSON fields may supplement a model but must not replace important relational structure.
18. No separate data silo may be created for a new commercial application.
19. No score may be presented without reasons and confidence.
20. No action should proceed automatically below its required confidence threshold.
21. **Compliance is architectural:** every personal datum (owner names, emails, phones) records its source and collection basis; outreach flows remain CAN-SPAM/TCPA-compliant; consent captured on leads; deletion requests honored across raw evidence, facts, and derived stores. *(Added at ratification — carried from SPEC v4.)*

---

# 18. Suggested Initial Bounded Contexts

```text
src/modules/
  geography/  niches/  playbooks/  keywords/  markets/  businesses/
  domains/  evidence/  research/  identity/  scoring/  opportunities/
  blueprints/  jobs/  providers/  workspaces/  audit/
```

Future contexts: `projects/ assets/ operations/ portfolio/ marketplace/ founder-scout/`

Each module contains its own domain types, repository interfaces, application services, validation, tests, and provider-independent contracts.

---

# 19. Discovery Pipeline v1

```text
1. Accept research request
2. Resolve Niche and geography
3. Create Job and Tasks
4. Discover cities and neighborhoods
5. Generate or retrieve keyword universe
6. Acquire keyword observations
7. Select representative queries
8. Acquire SERP snapshots
9. Resolve Businesses and BusinessLocations
10. Append Business observations
11. Check candidate domains
12. Run inexpensive qualification gates
13. Promote qualifying Markets to Candidates
14. Run deep research for Candidates
15. Execute Opportunity Lens
16. Produce Opportunity records
17. Generate versioned Blueprint
18. Present evidence, confidence, and recommended action
```

Every stage must be restartable without duplicating facts.

---

# 20. Calibration Flywheel

```text
Playbook → Research → Score → Blueprint → Asset → Actual performance → Outcome → Calibration analysis → New lens or Playbook version
```

Calibration may recommend weight changes, confidence adjustments, new research requirements, provider changes, niche-specific exceptions, kill criteria, timeline changes, revenue-model changes. **Calibration never modifies historical scores or Playbook versions — it creates new versions.**

Experiments (hypothesis, cohort, treatment, control, metrics, dates, results, confidence, decision) arrive when there are enough comparable assets for controlled testing. Not a first-wave entity in Discovery MVP.

---

# 21. Strategic Positioning

> **A decision-intelligence platform for local-market ownership.**

It answers: which market to enter · which territory to own · which niche to repeat · which domain to buy · which business should operate the leads · which company to sell SEO to · which business to acquire · which business could become a franchise · which asset to hold, improve, license, or sell · what we predicted incorrectly · what to do next.

The websites are outputs. The research is an input. The database is infrastructure. **The product is the quality and speed of the decisions RankRentOS enables.**

---

# 22. North-Star Principle

Every feature must strengthen at least one part of this compounding loop:

```text
More observations → better identity resolution → better market intelligence →
better decisions → more successful assets → more operational outcomes →
better Playbooks and lenses → better future decisions
```

If a proposed feature does not improve observation quality, decision quality, execution quality, operational learning, or economic outcomes, it should not be prioritized merely because it is technically impressive.

---

# 23. Final Architecture Statement

RankRentOS is one shared intelligence system with multiple commercial applications.

```text
                    Canonical Market Intelligence
      ┌──────────────────┬───────────────────┬──────────────────┐
 Rank and Rent      FounderScout       SEO Services       Acquisitions
      │                  │                   │                  │
 Territory          Franchise          Website Sales      AI Employees
 Ownership          Expansion               │                  │
      └──────────────────┴───────────────────┴──────────────────┘
                                │
                        Portfolio and Marketplace
```

Each application reads from the same canonical facts. Each application contributes new observations and outcomes. Each application adds its own lenses and workflows without creating its own copy of reality.

That is the architecture. That is the moat.

---

# 24. Ratification Notes (v3 adoption, 2026-08)

**Open decisions logged at adoption:**

1. **SERP provider consolidation.** §16 lists DataForSEO but not SerpAPI as an initial provider; the current v0 pipeline is SerpAPI-based. DataForSEO also sells SERP data (cheaper; account already funded). Decision pending: consolidate SERP acquisition onto DataForSEO vs. keep SerpAPI behind an adapter. The provider-interface rule makes this reversible either way.
2. **Migration posture.** This architecture prescribes a rebuild (TypeScript + Drizzle + PostGIS + bounded contexts). The existing JS pipeline + app is designated **v0**: it keeps running, its 1,392-market corpus and raw SERP caches become the first evidence ingested into the new Collection Layer, and its scoring logic serves as the reference implementation for Lens v1. Nothing is discarded; it is demoted to seed data + prototype.
3. **Multi-tenancy scope for MVP.** Hold to §10's own caveat: workspace-awareness only where ownership/privacy actually exists. Any broader workspace work is out-of-MVP unless FounderScout integration forces it.
