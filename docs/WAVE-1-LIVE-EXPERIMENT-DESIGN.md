# RankRentOS — Wave 1 Live Experiment Design

**Date:** 2026-08-12 · **Status:** design + research only. Nothing purchased, nothing deployed.
**Model:** `ai-v1.0.0` · weights `w-balanced-v1.1` · buckets `buckets-1.1.0`
**Actual provider spend for this redesign: $0.09** (all-time ledger: $2.0765)
**Machine-readable portfolio:** `out/wave-1-experiment/portfolio.json`

---

## 1. Executive summary

**28 sites in three cohorts.** $705 upfront, $42/month, $957 six-month risk capital.

| Cohort | Sites | Purpose |
|---|---|---|
| **A — Core** | 13 | Exploitation. What the A–I model believes will win. |
| **B — North Texas pool cluster** | 10 | A controlled test of whether community-level targeting works at all (8 communities + **2 city-level controls**). |
| **C — Contrarian** | 5 | Exploration. Assets chosen because they might prove A–I *wrong*. |

The selected cluster service is **Pool Builder**, chosen on evidence, not intuition (§8). The cluster is *not* admitted through the city gates — it is a separate experimental class with its own stated admission rules, because exact-match volume is the very thing under test.

---

## 2. What was wrong with the previous portfolio

1. **It silently killed the community experiment.** Community candidates were run through the city gates, failed on zero measured volume, and disappeared. But zero measured volume *is the hypothesis*, so using it as the gate assumed the answer.
2. **It was pure exploitation.** Every asset was selected by composite score. A portfolio selected entirely by the model can only ever confirm the model — it cannot discover where the model is blind. That is circular.
3. **It left geography ambiguity unresolved.** 14 of 19 assets carried a demand-attribution risk that was flagged but never actually investigated.
4. **It had no controls.** Nothing in it could separate "this service/metro is good" from "our targeting strategy works."

---

## 3. Experimental philosophy

Wave 1 is a **portfolio of experiments**, not a portfolio of bets. Three commitments follow:

- **Exploitation and exploration are separated, not blended.** Cohort A tests whether A–I is right. Cohort C tests specific ways it may be wrong. An asset belongs to exactly one cohort — no asset is both an investment holding and a probe.
- **A–I is a hypothesis, not truth.** It is therefore not permitted to veto the experiments designed to falsify it. Cohort B is scored by A–I for information but **not gated** by it.
- **Gates were never lowered.** Cohort A is actually *stricter* than the bucket gates (adds `F >= 50`). Thin-economics assets were not admitted by relaxation — they were moved to Cohort C where their weakness is the hypothesis.

---

## 4–5. Candidate universe and methodology

**Universe carried into this design:** 168 fully-researched city candidates (Exp-2 + Exp-3), of which 44 are bucketed; plus 22 newly-researched North Texas communities and 6 city controls; plus 22 services × 20 NT cities of new demand data.

**Staged funnel, cheap evidence first:**

| Stage | Method | Cost |
|---|---|---|
| Service selection for the cluster | DataForSEO volume/CPC, 440 keywords | **$0.09 actual** |
| Community SERP + operator research | SerpAPI (prepaid quota), 28 SERPs | $0 marginal |
| Domain availability | RDAP, ~150 lookups | free |
| Geography verification | re-analysis of SERPs already held | free |

---

## 6. Neighborhood-service comparison

22 candidate services ranked on measurable evidence. Because a hyper-local asset receives very little traffic, **lead value dominates** — a community site cannot pay for itself on volume.

Cluster fitness = 0.40 lead value + 0.25 metro demand + 0.15 new-home fit + 0.10 outdoor-living + 0.10 visual-content suitability. Weighting is HUMAN_ASSUMED and used **for service selection only** — it never touches A–I scoring.

| Fit | Lead value | NT metro vol | Median CPC | Service |
|---|---|---|---|---|
| **85** | **$2,125** | **1,030** | $5.23 | **Pool Builder** |
| 52 | $875 | 80 | $11.45 | Outdoor Kitchen |
| 47 | $630 | 20 | $43.32 | Pergola / Patio Cover |
| 47 | $525 | 240 | $18.89 | Landscape Design |
| 45 | $60 | 2,700 | $17.10 | Sprinkler / Irrigation |
| 42 | $900 | 270 | $31.96 | Pool Remodeling |
| 41 | $480 | 120 | $95.52 | Artificial Turf |
| 37 | $293 | 150 | $8.18 | Landscape Lighting |
| 31 | $193 | 20 | — | Epoxy Garage Floor |

Full table in `out/wave-1-experiment/nt-service-ranking.json`.

**Sprinkler/Irrigation is the instructive failure**: 2,700/mo — by far the most demand — but a $60 lead. It would generate traffic and no rent. This is the same lesson the rentability floor encodes.

---

## 7. North Texas community research

22 communities researched fresh (not limited to the six previously tested), sourced from developer and market reporting, then measured directly via SERP.

**Two findings changed the design.**

**(a) There is no such thing as a community map pack.** Google returns the *parent city's* local pack regardless of the community modifier — in Celina, 5 of 7 communities returned the identical three businesses, and elsewhere the same businesses simply reorder. Across all 22 communities only 24 distinct pool builders appear at all, with Lonestar Pool & Spa Design present in 12 of 22.

*Consequence:* a community asset **cannot win a community map pack, because none exists.** It must win **organic**. Any "community SERP weakness" measured from map-pack review counts was an artifact of the parent city and has been discarded from the reasoning.

**(b) Competitors are already doing this — in half the communities.** 12 of 22 communities have some community-specific pool content ranking (foleypools.com for Windsong Ranch and Whitley Place; prestigepp.com for Light Farms, Mustang Lakes and Fields; vtechpools.com for Cambridge Crossing). This is genuine third-party validation that operators believe community-level demand exists — and it means the territory is not virgin.

The cluster therefore deliberately balances **4 communities with an incumbent community page** (demand validated by a competitor's own investment) against **4 with none** (virgin organic slot).

**Excluded:** Ramble and Serenade (first phases opening 2026 — no homeowners yet, so no pool demand); Stonebridge Ranch and other mature communities were deprioritised as most homes are already improved.

---

## 8. Selected neighborhood service: Pool Builder

Chosen on a wide margin (fitness 85 vs 52):

- **$2,125 assumed gross profit per lead** — high enough that a handful of leads per year justifies the asset. This is the only way a zero-measured-volume asset can ever pay.
- **Highest measured NT metro demand of any high-ticket service** (1,030/mo) — the metro provably wants pools, even where the community-level query is unmeasured.
- **$5.23 median CPC** — strikingly low relative to a $2,125 lead. Advertisers are not yet bidding this up.
- **Maximal new-home relevance.** A pool is bought 1–3 years after moving into a new build, which is exactly the population of an active-buildout community.
- **Strong visual content fit** and **one contractor can serve every community in the cluster** (24 operators cover all 22).

**No second cluster is proposed.** Outdoor Kitchen ranked second but has only 80/mo of metro demand; adding it would spend sites on a weaker hypothesis and introduce a service variable into an experiment whose entire purpose is to hold service constant. Revisit for Wave 2.

---

## 9. Cohort A — Core (13 sites)

Admission: bucketed, composite ≥ 60, **F ≥ 50** (stricter than the gate — a core asset is an investment, not an experiment), geography verified, max 3 per service and 2 per city.

| Score | Bucket | A | F | Vol | Asset | Domain |
|---|---|---|---|---|---|---|
| 75 | UNICORN | 58 | 92 | 2400* | Bathroom Remodeling — Bellevue, WA | `bathroomremodelingbellevuewa.com` |
| 75 | UNICORN | 67 | 80 | 590* | Bathroom Remodeling — Kirkland, WA | `bathroomremodelingofkirkland.com` |
| 74 | UNICORN | 60 | 92 | 880* | Kitchen Remodeling — Bellevue, NE | `kitchenremodelingbellevuene.com` |
| 73 | UNICORN | 61 | 80 | 390* | Kitchen Remodeling — Rochester, MN | `kitchenremodelingrochestermn.com` |
| 72 | HIGH-VALUE | 54 | 80 | 590 | Kitchen Remodeling — Orlando, FL | `kitchenremodelingorlandofl.com` |
| 72 | UNICORN | 75 | 66 | 320 | Bathroom Remodeling — Temecula, CA | `bathroomremodelingtemecula.com` |
| 69 | UNICORN | 59 | 66 | 480 | Window Replacement — Naperville, IL | `windowreplacementofnaperville.com` |
| 66 | LOW-HANGING | 77 | 50 | 210 | Basement Waterproofing — Naperville, IL | `basementwaterproofingofnaperville.com` |
| 63 | LOW-HANGING | 62 | 50 | 210 | Window Replacement — Amarillo, TX | `windowreplacementamarillo.com` |
| 62 | LOW-HANGING | 64 | 50 | 210 | Water Damage Restoration — Chandler, AZ* | `waterdamagerestorationofchandler.com` |
| 61 | LOW-HANGING | 66 | 50 | 210 | Water Damage Restoration — Bellevue, WA* | `waterdamagerestorationofbellevue.com` |
| 61 | LOW-HANGING | 76 | 50 | 110 | Metal Roofing — Rochester, MN* | `metalroofingrochester.com` |
| 60 | LOW-HANGING | 62 | 50 | 210 | Stucco Repair — Orlando, FL | `stuccorepairorlandofl.com` |

\* volume is an **upper bound** (shared city name) — SERP evidence is verified local. See §13.

---

## 10. Cohort B — North Texas pool cluster (10 sites)

**Controlled design: same service × same metro × same template × same content depth × same technical SEO × different community.**

**8 community assets**

| Community | Parent city | Homes | Incumbent community page? | Domain |
|---|---|---|---|---|
| Windsong Ranch | Prosper | 3,300 | **Yes** (foleypools.com) | `poolbuilderwindsongranch.com` |
| Star Trail | Prosper | 1,300 | No — virgin | `poolbuilderstartrail.com` |
| Light Farms | Celina | 3,000 | **Yes** (prestigepp.com) | `poolbuilderlightfarms.com` |
| Mustang Lakes | Celina | 1,200 | **Yes** (prestigepp.com) | `poolbuildermustanglakes.com` |
| Painted Tree | McKinney | 3,400 | No — virgin | `poolbuilderpaintedtree.com` |
| Trinity Falls | McKinney | 3,000 | No — virgin | `poolbuildertrinityfalls.com` |
| Sandbrock Ranch | Aubrey | 1,400 | No — virgin | `poolbuildersandbrockranch.com` |
| Canyon Falls | Argyle | 1,300 | No — virgin | `poolbuildercanyonfalls.com` |

**2 city-level controls — the most important part of the design**

| Control | Measured volume | Role |
|---|---|---|
| Prosper (city) | **10/mo** | Low-measured-demand control. A 35k-person affluent city building pools constantly measures 10/mo — city-level under-measurement is testable here. |
| Frisco (city) | **320/mo** | High-measured-demand control. The market where the tools *do* report demand. |

This produces a **demand-measurement gradient**: Frisco 320 → McKinney 210 → Prosper 10 → community 0. If impressions track measured volume, the tools are accurate and the community thesis dies cleanly. If Prosper and the community sites over-perform their measured volume, the tools systematically under-measure hyper-local demand — which would be the single most valuable finding available to this company.

---

## 11. Cohort C — Contrarian (5 sites)

| Asset | What it tests |
|---|---|
| **House Cleaning — Orlando, FL** (2,900/mo, A=74, F=34) | High demand × thin economics. Directly tests the new rentability floor: can volume compensate for ~$10 per-lead gross profit? |
| **Appliance Repair — Aurora, IL** (1,300/mo, A=67, F=34) | V0 loved this family; V2 bucketed 1 of 16. Tests which thesis is right about commodity high-volume services. |
| **Mold Remediation — Knoxville, TN** (A=**43**, F=66) | The worst rankability we would still fund. Tests whether A predicts ranking speed — the most load-bearing assumption in the model. |
| **Kitchen Remodeling — Rockville, MD** (E=**100**, A=45) | Max renter depth × poor rankability. Can renter depth carry a hard SERP? |
| **Bathroom Remodeling — Bellevue, NE** (composite **85**, ambiguous demand) | Highest-scoring candidate in the dataset, excluded from core on ambiguity. Tests whether shared-name markets are capturable. |

**A deliberate paired design:** Bathroom Remodeling runs in **both** Bellevue WA (Cohort A) and Bellevue NE (Cohort C). Same query string, two cities, both instrumented — so we can observe directly how shared-name volume splits between them. That single pair may resolve the attribution question that keyword tools cannot.

---

## 12. Rejected finalists

- **Ramble, Serenade (Celina)** — pre-occupancy; no homeowners means no pool demand regardless of SERP.
- **Stonebridge Ranch, Phillips Creek Ranch, Newman Village, Fields, Whitley Place, Legacy Gardens, Mosaic, Cambridge Crossing, Sutton Fields, Harvest, Union Park, The Preserve** — researched and viable, held for cluster expansion. 8 is enough to detect the effect; 22 would spend capital before knowing whether the effect exists.
- **Radon Mitigation — Madison WI, Dumpster Rental — Brockton MA, Window Replacement — Livermore CA** — excluded from core: SerpAPI returned map-pack addresses with no parseable state, so localization is **unverified**. Not evidence of a problem, but not evidence of soundness either.
- **Junk Removal — Aurora IL, Roof Repair — Irvine CA, Mold Remediation — Plano TX** and other F=34 assets — bucketed but below the core's `F >= 50` economic bar; not deployed as investments.
- **Outdoor Kitchen as a second cluster** — see §8.

---

## 13. Geography validation results

All 44 bucketed candidates were re-examined against map-pack **addresses** in SERPs already collected.

| Verdict | Count | Meaning |
|---|---|---|
| `verified` | 21 | Unique city name **and** map pack entirely in-state. |
| `serp-local-volume-upper-bound` | 20 | Map pack entirely in-state, but city name shared nationally — competitive evidence sound, **volume is an upper bound**. |
| `unverified-no-address-evidence` | 3 | Addresses returned without a parseable state token. |
| `serp-not-localized` | **0** | — |

**The key result: not one candidate had an out-of-state map pack.** Every SERP we collected is genuinely the market we thought it was, because each was queried with an explicit `location` of "City, State". So Dimensions A and E are trustworthy throughout; only the *demand number* is inflated for shared-name cities. That is a much better outcome than excluding 20 candidates, and it is why the flag now appears on 20 assets rather than the previous over-broad 14-of-19.

---

## 14. Domain availability

**28 of 28 assets have an available domain.** Every asset carries up to 5 checked candidates (exact match, state-qualified, reversed, "of", "pros") in `portfolio.json`, each with availability and ~$12.18 first-year cost. No strong opportunity was dropped for lack of a perfect EMD.

Preference order: exact match → **state-qualified** (preferred outright for shared-name cities such as `kitchenremodelingrochestermn.com`, since it disambiguates for users and for us) → natural local variants.

**All availability is a point-in-time RDAP observation and decays. Nothing has been purchased.**

---

## 15–19. Final portfolio and cost

| | |
|---|---|
| **Total sites** | **28** (A 13 · B 10 · C 5) |
| Domain cost (est.) | $341.04 (28 × $12.18) — **known** |
| Content + deployment (est.) | $364.00 — *estimated* |
| **Upfront capital** | **$705.04** |
| **Monthly carrying** | **$42.00** ($1.50/asset: hosting + monitoring) |
| 6-month risk capital | $957.04 |
| 12-month risk capital | $1,634.08 (incl. renewals) |
| **Research spend (this redesign)** | **$0.09 actual** (all-time $2.0765) |

**Unknown costs, not estimated:** deployment-engine per-asset cost (engine not built), renter acquisition cost/time, link or citation acquisition if required to rank, content revision cycles, and pool-cluster content being photo-heavy (likely above the generic content estimate).

---

## 20. Hypothesis for every site

Every one of the 28 assets carries its own `hypothesis`, `reasonSelected`, `falsificationCondition` and `scalingCondition` in `out/wave-1-experiment/portfolio.json`. Summarised by cohort:

- **A:** "A=*n* predicts this SERP is winnable and F=*m* predicts the lead flow is worth renting."
- **B (community):** "Keyword tools report zero volume, but real homeowners in a large affluent community search using their community name."
- **B (control):** "If impressions track measured volume, the tools are accurate and the community bet fails."
- **C:** each states the specific way A–I may be wrong.

---

## 21. Cohort-level success and failure criteria

**Cohort A — succeeds** if ≥50% reach top-10 for the primary keyword within 6 months and ≥30% produce a lead. **Fails** if <20% reach top-20 — that would mean A does not predict rankability and the model needs rebuilding, not tuning.

**Cohort B — succeeds** if ≥3 of 8 community sites produce ≥100 impressions/month or ≥1 qualified lead within 6 months, *and* community sites over-perform their zero measured volume relative to the Prosper/Frisco controls. **Fails** if community sites index but stay under ~20 impressions/month while the controls perform in line with measured volume — that cleanly falsifies hyper-local under-measurement.

**Cohort C — cannot fail.** Every outcome is information: each asset either confirms a model assumption or identifies a specific dimension to re-calibrate.

---

## 22. Measurement plan

**All assets:** indexed y/n, time to first index, impressions, time to first impression, queries generating impressions, average position, pages receiving impressions, clicks, calls/forms/leads, lead quality, lead value, renter interest, time to first renter conversation, rent/revenue achieved.

**Community assets additionally:**
- impressions on **community-name** queries vs **service + community** queries
- **long-tail queries the keyword tools did not predict** (the direct test of under-measurement)
- city-level queries the community site ranks for incidentally
- whether Google treats the community as a meaningful geography (does it ever render a distinct local pack?)
- **whether impressions appear at all despite provider-reported zero volume**
- whether the site begins ranking outside the community modifier

These become the first OBSERVED evidence for Dimension G, which today is purely prospective.

---

## 23. What would falsify each strategy

- **Core/A–I strategy:** high-A assets failing to rank while low-A assets rank → A is not measuring rankability.
- **Community strategy:** indexed community sites with near-zero impressions after 6 months while city controls perform as predicted → tools measure hyper-local demand correctly and the community thesis is dead.
- **Rentability floor:** House Cleaning Orlando earning ≥$300/mo rent → the floor is too strict and is discarding viable assets.
- **Economic assumptions:** measured lead value materially below the assumed ticket × margin × 10% → the entire UNICORN tier is overstated.

---

## 24. What would cause us to scale each strategy

- **Core:** top-10 within 6 months + ≥1 lead/month → expand that service across remaining small affluent markets (research already cheap, ~$0.09 per 700 keywords).
- **Community:** ≥1 qualified lead or ≥100 impressions/month → build the remaining ~14 researched NT communities and replicate the pattern in a second metro. This is the highest-leverage scaling path in the business, because community assets are cheap, uncontested and infinitely repeatable.
- **Contrarian:** any probe that beats its prediction → re-weight that dimension and re-run selection over the existing 168-candidate dataset at zero research cost.

---

## 25. Recommended deployment order

1. **Cohort B first (all 10 together).** It is time-sensitive — indexing lag and pool seasonality (spring/summer) mean late deployment wastes a season — and the cluster is only interpretable if its members and controls launch together.
2. **Cohort A next**, highest composite first, so the strongest investment assets start accruing age.
3. **Cohort C last** — its value is diagnostic, not economic, so it should not delay the others.

---

## 26. Risks and unresolved unknowns

- **D and F remain HUMAN_ASSUMED.** The pool cluster rests on an assumed $85,000 ticket at 25% margin. If real pool economics are materially different, the cluster's justification weakens even if the traffic hypothesis proves true.
- **Renter concentration in the cluster.** Only 24 pool builders serve all 22 communities and one appears in 12 of them. One renter could take the whole cluster — excellent for monetisation, but it is a single point of failure.
- **2,499 UNKNOWN hypotheses** remain unresearched across Exp-2/3 — 67% of that space. Two DataForSEO databases have no data for them.
- **Community organic is not virgin.** Half the communities already have a competitor page; we may be arriving second in the ones with the most validated demand.
- **Three candidates could not be geo-verified** and were excluded rather than resolved.
- **Seasonality confound:** pool demand peaks spring/summer. A cluster launched into the wrong season may under-read; the city controls partially absorb this since they share the season.

---

## 27. Exact next action after approval

1. **You approve the 28-site portfolio** (or amend the counts/cohorts).
2. Re-verify all 28 domains — availability decays — then **you** purchase them (~$341). I will not.
3. Freeze `portfolio.json` as the Wave-1 baseline and emit AssetSpecifications for all 28 (the Exp-2 spec generator already exists and conforms to the handoff contract).
4. Deployment engine implements the Part 2 Outcome Feedback Contract so live results return as observations.
5. Deploy Cohort B together, then A, then C.

**Nothing proceeds without your explicit approval.**
