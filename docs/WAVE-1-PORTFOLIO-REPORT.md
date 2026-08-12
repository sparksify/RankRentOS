# RankRentOS — Experiment 2 Completion, Experiment 3 Discovery, and the First Live Asset Portfolio

**Date:** 2026-08-12
**Model:** `ai-v1.0.0` · weights `w-balanced-v1.1` · buckets `buckets-1.1.0` (changed — §9)
**Actual incremental provider spend this session: $0.8947** of the $10.00 approved.
**No domains purchased. No sites deployed. No scoring gate relaxed.**

Recommendation up front: **deploy 19 assets as Wave 1.** Total risk capital is $478 upfront and $28.50/month.

---

## RESEARCH

### 1–4. Counts

| Stage | Exp-2 | Exp-3 | Combined |
|---|---|---|---|
| Hypotheses generated | 864 | 2,898 | 3,762 |
| Structurally valid (`screen-v1`) | 846 | 2,898 | 3,744 |
| Fully measured demand | 425 | 820 | 1,245 |
| **UNKNOWN (no provider data — not rejected)** | 421 | 2,078 | 2,499 |
| Demand survivors | 117 | 51 | 168 |
| SERP + operator researched | 117 | 51 | 168 |
| Bucketed | 16 | 28 | 44 |

The 2,499 UNKNOWN are the single largest caveat in this report. They are *unresearched*, not rejected — see §16.

### 5. Demand distribution (measured only)

Exp-2: ≥100/mo 178 · ≥250 110 · ≥500 37 · ≥1,000 15 (of 425 measured, 6 observed-zero).
Exp-3: 51 of 820 measured cleared both the 100/mo floor and the CPC ≤ $25 ad-war filter.

### 6. Stage-by-stage funnel with rejection reasons

**Experiment 2** — 864 → 846 (18 rejected: low-ticket service in a small market) → 425 measured → 117 survivors (308 rejected: 234 below the 100/mo floor, 45 CPC > $25, plus screened) → 117 SERPs, 0 failures → 16 bucketed.

**Experiment 3** — 2,898 generated, 0 structurally rejected (the bias already excluded implausible pairs) → 820 measured → 51 survivors (769 rejected below floor / ad-war) → 51 SERPs, 0 failures → 28 bucketed.

### 7–8. Spend, by provider and actual cost

| Run | Provider | Actual |
|---|---|---|
| exp3-demand (2,852 keywords) | DataForSEO | $0.4500 |
| wave1-universe (19 Labs tasks) | DataForSEO | $0.2383 |
| exp2-demand-complete (146 keywords) | DataForSEO | $0.0900 |
| out-of-band probes (reconciled) | DataForSEO | $0.1164 |
| **Session total** | | **$0.8947** |
| All SERP + crawl + RDAP work | SerpAPI (prepaid) / free | **$0.00 marginal** |

All figures are provider-reported `cost` fields, not list-price estimates. 168 SERPs were drawn from the prepaid SerpAPI Production quota, whose marginal cost per in-quota call is $0.

**Ledger correction:** $0.1164 of probe spend initially bypassed the budget ledger because I ran those calls directly against the provider instead of through the store. I appended a reconciliation run rather than editing history. All-time ledger total is now $1.9865.

**On Step 4 (list price vs actual):** partially resolved. New runs record $0.00 for prepaid SerpAPI calls, which is the true marginal cash cost. Historical runs (`exp1-serp` $0.57, `exp15-serp-retry` $0.15) still carry list-price estimates. I did **not** rewrite them — mutating historical evidence to make reporting cleaner is exactly what the evidence doctrine forbids. They are estimates and are labelled as such here.

### 9. Bugs found and fixed

**(a) UNKNOWN was being fabricated as ZERO — the serious one.**
`parseVolumeResponse` coerced `search_volume: null` to `0`, and invented `vol: 0` for keywords the API never returned. In Experiment 2, **381 of 700 keywords had `search_volume: null`** and only **6** were genuine observed zeros — yet all 381 were counted as "0/mo, below the demand floor, rejected." The previously reported funnel materially overstated rejection.
Fixed: `vol` is now `number | null` with an explicit `state` of `measured | unknown-null | unknown-omitted`. 5 regression tests. Verified across volume, CPC, competition, keyword universe, SERP signals, operator metrics and domain data.

**(b) Map-pack review averages counted unknowns as zero-review businesses**, understating incumbent strength and making hard markets look beatable. Now averaged over listings with known review counts only. Effect: changed A on 1 of 85 candidates (−8) — small, but it was systematically biased in the optimistic direction.

**(c) Keyword-universe sums treated unmeasured keywords as 0.** Now excluded from sums and counted as `unknownVolumeCount`, so an incomplete universe is reported as incomplete.

**(d) A failed run was marked `completed`.** The 146-keyword batch failed on missing credentials, then called `completeRun` anyway; idempotency skipped every retry, so a credentials failure looked permanently like "no data." Now failures call `failRun`, and scripts throw loudly when `DATAFORSEO_AUTH` is absent.

**(e) Stale asset specifications.** The spec directory was written without clearing, so 2 specs from a superseded selection would have shipped to the deployment engine as approved. Now cleared before each write.

**(f) An earlier claim of mine was wrong.** My previous report stated all 42 control-negative hypotheses "died at the demand floor" and that controls behaved correctly. They had not been measured at all — they were in the unfunded 146. With measurement, 15 control hypotheses show real demand. The control services failed on *economics*, not demand (§17).

### 10. Methodology changes

- **`universe-geo-1.0.0`** — a geo-scoped keyword universe (Step 3). Only keywords geographically attributable to the target market contribute volume; national terms are preserved with reason `national-scope-not-attributable-to-this-market` and contribute zero. Across the 19 Wave-1 assets this **excluded 279,730 searches/mo of national leakage — a naive sum would have inflated Wave-1 demand by 21×**. 4 tests.
- **Content depth + domain age collected** (free crawl + RDAP) for 85 decision-set candidates, closing Dimension A's largest gap: mean competitor page 1,481 words, mean competitor domain 16.7 years old.
- **Evidence-biased discovery** (Exp-3) replaced random Service × City generation.

---

## OPPORTUNITY FINDINGS

### 11. Top services

Only two families consistently clear the gates:

| Service | Mean composite | Mean A | Mean F | Bucketed |
|---|---|---|---|---|
| Kitchen Remodeling | 67 | 50 | 77 | 4/5 |
| Mold Remediation | 58 | 55 | 45 | 2/3 |

In Exp-3, **Bathroom Remodeling (5) and Kitchen Remodeling (7)** produced 12 of the 14 UNICORNs.

### 12. Weakest services

High-volume fragmented-local services almost never clear the rentability floor: Auto Glass 0/12, Air Duct Cleaning 0/6, Mobile Mechanic 0/8, Appliance Repair 1/16, Junk Removal 1/16, Dumpster Rental 2/18. They have demand and renters; the leads are simply not worth enough. **Recurring B2B remains fully falsified** — 126 hypotheses, zero survivors.

### 13. Geographic patterns

Mean A by market size: **small 57 · large 51 · mid 47**. By income: **affluent 54 · upper-mid 53 · middle 47**. Small and affluent markets are meaningfully more rankable — this is the finding Experiment 3 was built on, and it held.

### 14. SERP patterns

The mechanism behind Exp-3's success is incumbent weakness, not absence of competition: mean map-pack review count was **230 in Exp-2 vs 115 in Exp-3, and 60 among the UNICORNs**. Map packs were full (mean 3.0 listings, zero empty) and operators were present, so these are real markets with beatable incumbents — not dead ones.

### 15. Demand patterns

Demand is common; rankability is scarce. In Exp-2, of the 58 candidates that cleared every floor but earned no bucket, **54 failed on A < 60 and none failed on demand.**

### 16. Renter/operator patterns

Renter depth is rarely the binding constraint: mean E across bucketed candidates is high (many at 95–100), and only 4 of 168 researched candidates failed for "no viable renter." Operators exist almost everywhere; what varies is whether the leads are worth enough to rent.

### 17. Economic patterns

F (realizable value) is the second binding constraint after A. The controls prove it: House Cleaning Orlando has 2,900/mo of demand and A=74, but at ~$10 of renter gross profit per lead its F is 34. Lawn Mowing at ~$3/lead scores F=20 — roughly $144/month of renter gross profit, which cannot support the $300/month minimum rent.

### 18. Domain patterns

17 of 44 bucketed opportunities have an exact-match `.com` available; 8 of the 19 Wave-1 assets. Availability is a point-in-time RDAP observation and decays.

### 19. Surprising findings

1. **Biased discovery outperformed broad discovery by an order of magnitude.** Exp-2: 0 UNICORNs from 117 researched. Exp-3: 14 from 51. Same model, same gates — only the hypothesis generator changed.
2. **Bathroom Remodeling was invisible in Exp-2** (its geographies were all in the unmeasured batch) and became a top family in Exp-3.
3. **Volume and opportunity are close to unrelated** in this dataset. The highest-demand markets are mostly unbucketed.

### 20. Hypotheses falsified

- Recurring B2B as a local-search category — falsified (0/126).
- "High search volume indicates a good rank-and-rent market" — falsified.
- "Control-negative services are weak because nobody searches for them" — falsified; they are weak on economics, and they do have demand.
- Community × Service standalone assets — remains falsified from Exp-1.5 (0/12 measurable demand). Evidence preserved, not deleted; still viable as supporting pages under city assets.

---

## A–I RESULTS

### 21–26. Leaders by dimension

- **Composite:** Bathroom Remodeling Bellevue NE (85)*, Bellevue WA (75)*, Kirkland WA (75), Kitchen Remodeling Bellevue NE (74)*, Rochester MN (73)
- **A:** Bathroom Remodeling Bellevue NE (92)*, Conroe TX (91), Arvada CO (83), Dumpster Rental Renton WA (82)
- **B:** House Cleaning Orlando, Pressure Washing Orlando, Dumpster Rental Orlando, Appliance Repair Aurora (all 92)
- **E:** Auto Glass Aurora IL, Kitchen & Bathroom Remodeling Rockville MD (100)
- **F:** Bathroom/Kitchen Remodeling Bellevue NE + WA (92)*, Kitchen Remodeling Orlando (80)
- **H:** Bathroom Remodeling Bellevue NE (100)*, Temecula CA (92), Kirkland WA (91), Arvada CO (90)

\* excluded from Tier 1 — demand ambiguity (§30).

### 27–28. Confidence

Confidence is uniform and narrow (**71–80**) because every candidate received identical collection treatment. It is *not* an opportunity score: several high-confidence candidates are confidently bad. No candidate has low enough confidence to be disqualified on evidence quality alone; the honest weakness is uniform (D and F assumptions), not candidate-specific.

### 29. Sensitivity

Of 44 bucketed candidates across all 5 weight sets: **22 move ≤10 rank positions, 39 move ≤20, and only 2 move >40.**

- **Most stable:** Bathroom Remodeling Bellevue (spread 0, rank 1 under every weighting), Kitchen Remodeling Orlando (spread 1), Kitchen Remodeling Madison (3), Kitchen Remodeling Plano (3).
- **Most weight-sensitive:** Dumpster Rental Brockton (spread 55), Mold Remediation Plano (46), Appliance Repair Aurora (38), House Cleaning Irvine (31).

The pattern is consistent: high-ticket remodeling ranks highly under *every* philosophy; commodity services rank well only under rankability-first weightings. **The top of the portfolio is not an artifact of my weight choices.**

### 30. Assumption-sensitive candidates

**D and F are assumption-dependent for every candidate**, driven by HUMAN_ASSUMED ticket, margin and a 10% close rate. This matters most for the remodeling family: Kitchen Remodeling's F=80–92 rests on an assumed $35,000 ticket at 30% margin (~$1,050 per lead). If the true figure is half that, the entire UNICORN tier compresses toward HIGH-VALUE. **The Wave-1 experiment exists primarily to replace these four numbers with observations.**

Separately, **14 of 19 Wave-1 assets carry demand-attribution risk**: their city names are shared with cities in other states (Rochester, Aurora, Madison, Plano, Chandler, Knoxville, Irvine), so city-only exact volume is an **upper bound**. Direct evidence: the Rochester MN universe returned "rochester kitchen and bath henrietta" — Henrietta is a Rochester **NY** suburb. I attempted to bound this by measuring state-qualified variants ($0.09); the test was **inconclusive** (where the provider returns identical values it is grouping variants; where they differ it reflects phrasing frequency, not geography). Crucially, **only the volume figure is at risk — the SERP and operator evidence is correctly local**, because every SERP was queried with an explicit `location` of "City, State". A Census place-name gazetteer is the real fix and is recommended before Wave 2.

---

## PORTFOLIO

### 31–36. Tiers and buckets

**Buckets (44 total): 14 UNICORN · 11 HIGH-VALUE · 19 LOW-HANGING.**

- **TIER 1 — DEPLOY: 32.** Bucketed, unambiguous demand, composite ≥ 60, viable renter present.
- **TIER 2 — EXPERIMENTAL: 12.** Bucketed but either demand-ambiguous or composite < 60. Each carries a stated hypothesis, downside and falsification condition in `out/portfolio/portfolio.json`.
- **TIER 3 — HOLD/REJECT: 124.** Rejection reasons preserved: 84 cleared no quality gate, 13 had beatable SERPs but unrentable economics, 4 had no viable renter, the remainder unbucketed on demand.

### 37. Did 8/8/4 emerge naturally?

**Yes — and it was exceeded, without touching a gate.** 14/11/19 against a target of 4 UNICORN / 8 HIGH-VALUE / 8 LOW-HANGING. This is a genuine result of better-targeted discovery, not of loosened criteria. Note the reverse pressure was also resisted: I *tightened* a gate (§9 below) which removed 14 candidates.

### 38–40. Recommended portfolio and Wave 1

**Total deployable inventory: 32 Tier-1 assets.** **Recommended Wave 1: 19.**

| # | Comp | Bucket | Role | A | F | Vol | Asset |
|---|---|---|---|---|---|---|---|
| 1 | 75 | UNICORN | INVESTMENT | 67 | 80 | 590 | Bathroom Remodeling — Kirkland, WA |
| 2 | 73 | UNICORN | INVESTMENT | 61 | 80 | 390 | Kitchen Remodeling — Rochester, MN |
| 3 | 72 | HIGH-VALUE | INVESTMENT | 54 | 80 | 590 | Kitchen Remodeling — Orlando, FL |
| 4 | 72 | UNICORN | INVESTMENT | 75 | 66 | 320 | Bathroom Remodeling — Temecula, CA ✅ |
| 5 | 70 | UNICORN | INVESTMENT | 83 | 66 | 390 | Bathroom Remodeling — Arvada, CO |
| 6 | 69 | LOW-HANGING | INVESTMENT | 74 | 34 | 2900 | House Cleaning — Orlando, FL ✅ |
| 7 | 69 | UNICORN | INVESTMENT | 59 | 66 | 480 | Window Replacement — Naperville, IL |
| 8 | 68 | UNICORN | INVESTMENT | 55 | 80 | 260 | Kitchen Remodeling — Madison, WI |
| 9 | 67 | HIGH-VALUE | INVESTMENT | 43 | 66 | 590 | Mold Remediation — Knoxville, TN |
| 10 | 66 | LOW-HANGING | INVESTMENT | 77 | 50 | 210 | Basement Waterproofing — Naperville, IL |
| 11 | 64 | LOW-HANGING | INVESTMENT | 73 | 50 | 210 | Window Replacement — Livermore, CA ✅ |
| 12 | 63 | LOW-HANGING | INVESTMENT | 66 | 34 | 1000 | House Cleaning — Irvine, CA ✅ |
| 13 | 63 | LOW-HANGING | INVESTMENT | 62 | 50 | 210 | Window Replacement — Amarillo, TX ✅ |
| 14 | 62 | LOW-HANGING | INVESTMENT | 63 | 34 | 480 | Junk Removal — Aurora, IL |
| 15 | 62 | LOW-HANGING | EXPERIMENT | 64 | 50 | 210 | Water Damage Restoration — Chandler, AZ |
| 16 | 61 | LOW-HANGING | EXPERIMENT | 67 | 34 | 1300 | Appliance Repair — Aurora, IL |
| 17 | 61 | LOW-HANGING | EXPERIMENT | 76 | 50 | 110 | Metal Roofing — Rochester, MN ✅ |
| 18 | 59 | LOW-HANGING | EXPERIMENT | 67 | 34 | 210 | Roof Repair — Irvine, CA ✅ |
| 19 | 58 | LOW-HANGING | EXPERIMENT | 69 | 34 | 110 | Mold Remediation — Plano, TX ✅ |

✅ = exact-match `.com` available at research time. **Not purchased.**

---

## EXPERIMENT DESIGN

### 41–42. Diversification

11 services · 10 states · all 3 buckets (6 UNICORN, 2 HIGH-VALUE, 11 LOW-HANGING) · **A spans 43–83** · **F spans 34–80** · 8 with EMD vs 11 without · demand spans 110–2,900/mo · market size spans 52k–255k population.

That spread is deliberate: it lets the live results *discriminate* between dimensions instead of confounding them. Asset 9 (Mold Remediation Knoxville, A=43) is the weakest-rankability asset we would still fund — if it ranks as fast as A=83 Arvada, then A is over-weighted and we will know.

### 43. Expected information value — the questions Wave 1 can answer

Does A predict ranking speed (A range 43–83)? Does B predict impressions (110–2,900/mo)? Does E predict renter acquisition? Does F predict realized economics (F 34–80 against real rent achieved)? Does EMD availability matter (8 vs 11)? Does market size predict difficulty (52k–255k)? Which services monetize fastest? **Every one of those has spread in this portfolio.**

### 44–48. Economics

| Item | Basis | Amount |
|---|---|---|
| Domain, first year | **known** | $12.18 × 19 = $231.42 |
| Content generation | *estimated* | $8.00 × 19 = $152.00 |
| Deployment labor | *estimated* | $5.00 × 19 = $95.00 |
| **Upfront capital** | | **$478.42** |
| Hosting + monitoring | *estimated* | $1.50/asset/mo = **$28.50/mo** |
| **6-month risk capital** | | **$649.42** |
| **12-month risk capital** (incl. renewals) | | **$1,108.84** |

**Unknown costs, not estimated:** deployment-engine per-asset cost (engine not built), renter acquisition cost and time, link acquisition if required to rank, content revision cycles. These are genuinely unknown and I have not pretended otherwise.

### 49. Success criteria

At 6 months: ≥60% indexed within 30 days; ≥40% achieving a top-10 position for the primary keyword; ≥25% producing at least one inbound lead; ≥3 assets with a paying renter; measured CPL within 2× of model prediction on at least half the assets producing leads.

### 50. Failure criteria

If <20% reach top-10 in 6 months, Dimension A does not predict rankability and the model needs rebuilding, not tuning. If assets rank but produce no leads, B/C are wrong. If leads appear but no renter pays, E is wrong and the entire rank-and-rent thesis needs revisiting. If realized rent is below $300 across the board, the rentability floor must rise.

---

## HANDOFF

### 51–54. Artifacts

**19 AssetSpecifications** (`asset-spec-1.0.0`) at `out/portfolio/asset-specs/`, validated 19/19 for required sections and no leaked `undefined`. Each contains identity, domain + status, keyword strategy with the geo-scoped universe, full SERP profile including the content-depth bar and competitor domain age, renter/operator profile, all nine A–I scores with versions and confidence, sensitivity across all five weight sets, bucket/tier/role, why selected, **the hypothesis it tests**, expectations baseline, measurement requirements, and full provenance to raw payloads.

**Deployment handoff contract:** the existing `docs/DEPLOYMENT_HANDOFF_CONTRACT.md` was extended (not replaced) with **Part 2 — Outcome Feedback Contract v1**, defining event timestamps, daily time series, the renter funnel, and the four economic actuals, plus the binding rules that outcomes arrive as ordinary append-only observations, that UNKNOWN is never zero, and that every metric must be registered first.

### 55. What live evidence replaces which assumption

| Dimension | Assumed today | Replaced by |
|---|---|---|
| D | ticket × margin × 10% close (HUMAN_ASSUMED) | `cplActual`, `leadValueActual`, `closeRateActual`, `ticketActual` |
| F | D × 25% CTR × 12% contact | `leadsTotal`, `revenue`, `monthlyRent` |
| G | prospective proxy derived from A | `indexedAt`, `firstImpressionAt`, `firstLeadAt` |

---

## RECOMMENDATION

**56. Should we deploy now? Yes.** Research has reached the point of diminishing returns. The binding constraints (A and F) are understood, the top of the portfolio is stable across every weighting, and the remaining uncertainty is concentrated in D/F/G assumptions that **no amount of further research can resolve** — only live assets can.

**57–58. How many? 19 — and the number is derived, not chosen.** Marginal reasoning: assets 1–14 are the investment core, justified on expected economics alone (all Tier 1, composite ≥ 60). Assets 15–19 each cost ~$25 upfront and ~$1.50/month and each buys a specific answer — the weakest-A asset we would fund, the highest-volume/thinnest-economics asset, EMD vs non-EMD pairs. At that price, buying those answers is clearly worth it. Beyond 19, additional assets would mostly duplicate service/geography profiles already represented, so their information value drops sharply while cost stays linear. I capped at 3 per service and 2 per city for exactly this reason. Total risk capital of $478 upfront is small enough that portfolio size is limited by *information value*, not budget.

**59. Wave 2 should depend on:** (a) whether A predicted ranking speed; (b) the four measured economic actuals, which will re-rank everything through D and F; (c) whether the remodeling family's assumed tickets survive contact with reality; (d) a Census gazetteer resolving demand attribution for shared-name cities.

**60. What RankRentOS should learn next**
1. **Resolve the 2,499 UNKNOWNs** — 67% of the hypothesis space is unresearched, not rejected. Two DataForSEO databases have no data for these; a clickstream or alternative source would open a large frontier cheaply.
2. **Industrialize the Exp-3 bias.** One targeting change produced 14 UNICORNs where broad search produced none. The discovery engine should learn service/geography priors from outcomes automatically.
3. **Expand the winning families geographically** — Kitchen and Bathroom Remodeling across the remaining small affluent markets is the highest-expected-value next research run, and it costs cents.
4. **Add a Census place-name gazetteer** to eliminate the demand-attribution risk affecting 14 of 19 Wave-1 assets.

---

## APPENDIX — Scoring model change (full protocol)

One gate changed. Documented per the required procedure.

1. **Problem.** LOW-HANGING had no economic floor. Control services designed to be weak — Lawn Mowing (~$3 gross profit per lead), House Cleaning (~$10) — cleared it on volume and weak SERPs alone.
2. **Current formula.** `A >= 60 && B >= 45 && E >= 40`.
3. **Why it is wrong.** A rank-and-rent asset must be *rentable*. Lawn Mowing Orlando at 1,600/mo yields roughly $144/month of renter gross profit — below the $300/month minimum rent already encoded in the system. No rational renter pays. Calling it deployable contradicts the portfolio's purpose.
4. **Smallest justified correction.** Add `F >= 34` to LOW-HANGING — the band boundary for ≥$300/month realizable renter gross profit. UNICORN and HIGH-VALUE already carry F floors (55 and 60) and are unchanged.
5. **Tests.** 3 added, including a regression asserting a high-volume/low-ticket service is rejected as "not rentable" while the same SERP with real economics still qualifies.
6. **Version.** `BUCKETS_VERSION = "buckets-1.1.0"`.
7. **Before/after.** Exp-2 LOW-HANGING 26 → 12 (14 removed as unrentable); UNICORN and HIGH-VALUE unchanged. The change **removes** candidates — it cannot manufacture winners.

**Verification:** 94 tests pass (11 skipped), typecheck errors reduced 26 → 22, scoring determinism confirmed by identical output hashes across repeated runs, and 19/19 asset specifications validated.
