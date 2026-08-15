# Wave 1 v4 — The De-Confounded Factorial (DRAFT, awaiting approval)

**Machine-readable:** `out/wave1-v4/portfolio-v4.json` · **Status: DRAFT** — freezes on your approval; v3 remains the frozen baseline until then.
**Research spend for the redesign: $0.18** (transactional demand pass $0.09 + prior probes; SERPs on prepaid quota).
**Nothing purchased. Nothing deployed.**

## What changed and why

Your critique, adopted: v3 asked the community pool sites to prove pools *and* hyperlocal *and* template conversion simultaneously. v4 separates the variables as a **2×2 factorial with same-community service pairs**:

| | City (Frisco / McKinney / Prosper) | Community (Sutton Fields / Painted Tree / Sandbrock Ranch / Star Trail) |
|---|---|---|
| **Pool Builder** (considered, visual, ~$2,125/lead) | 3 sites — *predicted-hard probes* (organic 23–39; the model expects them NOT to rank, and says so up front) | 4 sites — the only pool SERPs our model says are winnable |
| **Sprinkler Repair** (transactional, ~$60/lead) | 3 sites — the control anchor (demand gradient **390 / 320 / 40**) | 4 sites — same communities as the pool sites |

Plus: **2 sprinkler hub pages** (Trinity Falls, Union Park on `sprinklerrepairnorthtexas.com`) keeping the architecture question alive as an *exploratory* arm, and **Groups A (5) and C (6) unchanged** from v3.

## Why Sprinkler Repair won the S2 selection (data, not vibe)

Seven candidates measured across 8 NT cities ($0.09):

| Service | Fitness | Lead $ | Metro vol | Note |
|---|---|---|---|---|
| Landscape Lighting | 74 | $293 | 90 | best economics, but 90/mo metro demand **cannot anchor the city control arm** |
| **Sprinkler Repair** | **67** | $60 | **1,220** | the only transactional candidate with a real city gradient; urgent, call-now journey; universal in irrigated TX communities |
| Epoxy Garage | 64 | $193 | 20 | demand too thin everywhere |
| Christmas Lights | 61 | $83 | 140 | **rejected for a design reason**: annual-average volume hides its seasonal spike — a *second* under-measurement effect stacked on the hyperlocal one under test |

Sprinkler repair is picked for **instrument quality over economics**, and the pre-registration says so plainly: *"~$60/lead is below the rentability floor; this arm is information spend, the cheapest clean instrument for the hyperlocal mechanism — do not reinterpret a working experiment as a failed business."* Bonus finding: **every one of the 9 sprinkler SERPs classified LOCAL_COMMERCIAL** — the cleanest intent slate of any cohort — and McKinney city is unexpectedly ORGANIC-VIABLE (70).

## The pre-registered questions (prereg-v4)

- **H1** (unchanged): does A or organic-v1.2 predict ranking speed — Rochester/Naperville probes.
- **H2**: do zero-volume community queries produce impressions — now measured against *two* demand gradients.
- **H3** (demoted to exploratory): standalone vs hub, 4-vs-2 on sprinkler only; confirmatory version deferred to Wave 2.
- **H4** (unchanged): the $300/mo rentability floor — House Cleaning Orlando probe.
- **H5 (new, the heart of v4)**: within the 4 paired communities, pool vs sprinkler on impressions → clicks → calls-per-click. Same community holds geography constant, so divergence isolates **purchase psychology**. If sprinkler rings and pool doesn't, the visual-luxury archetype becomes a prerequisite for considered niches. If *neither* gets impressions, hyperlocal demand fails cleanly.
- **H6 (new)**: pool arm vs sprinkler arm on realized economics at 9 months (pool's ~90-day sales cycle needs the longer horizon).

Every asset now carries an **`archetype`** field for your deployment engine: `visual-luxury` (7 pool sites — galleries, project photography, design credibility) vs `transactional-lead-gen` (everything else — phone-first). The pool sites' spec says explicitly that a generic template is *expected* to under-convert and that expectation is part of H5.

## Numbers

| | v3 (frozen) | **v4 (draft)** |
|---|---|---|
| Rankable assets | 26 | **27** |
| Websites/domains | 21 | **26** |
| Domain cost | $255.78 | **$316.68** |
| Upfront | $593.78 | **$667.68** |
| Monthly | $34.00 | **$39.50** |
| Six-month | $797.78 | **$904.68** |

All 26 domains verified available at build time, including the two alternates (`sprinklerrepairoffrisco.com`, `sprinklerrepairofmckinney.com` — first choices taken) and the hub. **Every S2 SERP passed intent validation.**

What left vs v3: 4 pool community sites (Mosaic, Newman Village, Cambridge Crossing) and the 6-page pool hub — replaced by the sprinkler arm. What that surrenders: the confirmatory architecture test. What it buys: the ability to attribute any community result to demand vs psychology, which v3 could not do at any price.

## On approval

1. v4 freezes (prereg locked, `isFrozen: true`), v3 archived unchanged.
2. Validation + decision layers re-run over v4; cockpit and handoff specs regenerate (all existing pipelines, pointed at v4).
3. Purchase list re-verified and issued: **26 domains, ~$316.68.**
4. Deploy order: sprinkler arm + pool communities together (the paired design launches as one batch), then Group A, then C.
