# Discovery Experiment 2 — Report

**Status:** complete, with one external blocker (DataForSEO unfunded).
**Model:** `ai-v1.0.0`, weights `w-balanced-v1.1`, screen `screen-v1`, signals `1.0.0`.
**Actual provider spend this experiment: $0.09.** No domains purchased. No sites deployed. No gates relaxed.

---

## 1. Preflight: D/F dependency audit (the condition of approval)

**Finding: yes, D and F were double-counting.** Dimension D (lead economics) scored the gross profit of a *job*, while F (asset value) independently re-derived job economics from ticket × margin. A high-ticket service was therefore rewarded twice through two nominally independent dimensions, and the composite inherited both.

**Corrections made (deliberately conservative — they lower scores, they cannot create winners):**

| Change | From | To |
|---|---|---|
| D basis | gross profit per *job* | gross profit per *lead* (`gpJob × BENCH_CLOSE`) — `D-1.1.0` |
| F basis | re-derived its own economics | consumes D's per-lead value; cites `D.leadEconomics` — `F-1.1.0` |
| D weight | 0.08 | 0.05, reallocated to the OBSERVED dimensions B and E — `w-balanced-v1.1` |
| Close rate | duplicated in two files | single constant `BENCH_CLOSE = 0.10` |

A regression test now asserts F is not a copy of D: a market with a $40,000 ticket and zero measured demand scores D > 70 (per-lead economics look excellent) but F < 25 (there is no lead flow to own). 20/20 scoring tests pass.

---

## 2. A defect found and fixed mid-run — read this before trusting any Stage-2 number

The first Stage-2 pass reported **0 survivors from 700 measured keywords**. That was a bug, not a finding, and I treated it as one because Experiment 1 had measured real volume from the same endpoint.

**Root cause:** `parseVolumeResponse` returns each row's demand on a field named `vol`. Both consumers read `r.volume`, which is `undefined`, and `undefined ?? 0` silently became "zero demand." Every keyword looked dead.

**Fix:** corrected both consumers to read `vol`, and added `tests/providers/volume-parse.test.ts` (3 tests) asserting the field contract and that a batch carrying `search_volume` never yields all-zero. The corrected parse yields **85 survivors**. This class of failure — a silent coercion that fabricates a confident negative — is the most dangerous one in this system, because a wrong "nothing here" is invisible.

---

## 3–6. Hypothesis universe and generation

- **48 services** across 7 categories (42 from taxonomy, 6 data-mined from cached SERP `related_searches` at $0), **18 geographies** (2 per stratum × 9 population/income strata), deterministically ordered by population for reproducibility.
- **864 hypotheses generated**, 846 passed the free structural screen, 18 rejected.
- No standalone Community × Service hypotheses, per your instruction.

**Category distribution (of 846):** specialty-trade 180, fragmented-local 180, high-ticket-home 180, recurring-b2b 126, emergency 120, control-negative 42, discovered-from-data 18.

**`screen-v1` rejections (18):** all "low-ticket service in small market: rent ceiling implausible."

---

## 7–9. Funnel, with rejection reasons at every stage

| Stage | Method | In | Out | Rejections |
|---|---|---|---|---|
| 0–1 Structural | free, deterministic | 864 | 846 | 18 rent-ceiling implausible |
| 2 Measured demand | DataForSEO, **$0.09 actual** | 846 | 85 | 570 below 100/mo floor; 45 CPC > $25 (ad war); **146 never measured — account unfunded** |
| 3 SERP + operators | SerpAPI, prepaid quota, $0 marginal | 85 | 85 | 0 failures |
| 4 Scoring / bucketing | pure computation, $0 | 85 | 24 bucketed | 58 cleared floors but no bucket; 3 no viable renter |

**Spend:** $0.09 actual (DataForSEO reported cost, not list price). SerpAPI calls were in-quota on the prepaid Production plan, so their marginal cost is $0; 85 calls consumed of ~15,000/month.

---

## 10. Portfolio buckets

**UNICORN: 0.** Nothing cleared `H ≥ 60 AND A ≥ 55 AND F ≥ 55`. I did not lower the gate to produce one.

**HIGH-VALUE: 4** — all Kitchen Remodeling: Orlando FL (72), Plano TX (67), Madison WI (65), Chandler AZ (63, `.com` open).

**LOW-HANGING: 20** — led by Junk Removal Aurora IL (64), Window Replacement Amarillo TX (63, `.com` open), Water Damage Restoration Chandler AZ (62), Auto Glass Repair Aurora IL (61, `.com` open), Stucco Repair Orlando FL (60).

Bucketed markets spread across 8 of 9 strata, so the result is not an artifact of one city size or income band.

---

## 11. Top 20 (default weights)

| # | Score | Bucket | Vol | A | B | E | F | H | Market |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 72 | HIGH-VALUE | 590 | 54 | 78 | 79 | 80 | 67 | Kitchen Remodeling — Orlando, FL |
| 2 | 67 | HIGH-VALUE | 390 | 54 | 62 | 73 | 80 | 67 | Kitchen Remodeling — Plano, TX |
| 3 | 66 | — | 260 | 38 | 62 | 95 | 80 | 57 | Kitchen Remodeling — Knoxville, TN |
| 4 | 65 | — | 1600 | 56 | 92 | 72 | 50 | 58 | Dumpster Rental — Orlando, FL |
| 5 | 65 | HIGH-VALUE | 260 | 48 | 62 | 64 | 80 | 64 | Kitchen Remodeling — Madison, WI |
| 6 | 64 | LOW-HANGING | 480 | 68 | 78 | 81 | 34 | 51 | Junk Removal — Aurora, IL |
| 7 | 63 | LOW-HANGING | 210 | 62 | 62 | 65 | 50 | 68 | Window Replacement — Amarillo, TX ✅ |
| 8 | 63 | HIGH-VALUE | 170 | 54 | 48 | 81 | 66 | 60 | Kitchen Remodeling — Chandler, AZ ✅ |
| 9 | 62 | — | 590 | 38 | 78 | 74 | 66 | 51 | Water Damage Restoration — Orlando, FL |
| 10 | 62 | LOW-HANGING | 210 | 64 | 62 | 64 | 50 | 61 | Water Damage Restoration — Chandler, AZ |
| 11 | 61 | — | 1300 | 36 | 92 | 87 | 50 | 43 | Dumpster Rental — Knoxville, TN |
| 12 | 61 | — | 590 | 52 | 78 | 95 | 34 | 41 | Appliance Repair — Alexandria, VA |
| 13 | 61 | LOW-HANGING | 320 | 66 | 62 | 100 | 20 | 46 | Auto Glass Repair — Aurora, IL ✅ |
| 14 | 60 | — | 1000 | 40 | 92 | 95 | 34 | 37 | Junk Removal — Orlando, FL |
| 15 | 60 | — | 590 | 46 | 78 | 95 | 34 | 39 | Appliance Repair — Irvine, CA |
| 16 | 60 | LOW-HANGING | 210 | 62 | 62 | 61 | 50 | 60 | Stucco Repair — Orlando, FL |
| 17 | 59 | LOW-HANGING | 1300 | 60 | 92 | 53 | 34 | 49 | Appliance Repair — Aurora, IL |
| 18 | 59 | — | 720 | 28 | 78 | 95 | 50 | 39 | Roof Repair — Orlando, FL |
| 19 | 58 | — | 1600 | 28 | 92 | 87 | 50 | 39 | Appliance Repair — Orlando, FL |
| 20 | 58 | — | 880 | 56 | 78 | 70 | 34 | 48 | Appliance Repair — Madison, WI |

✅ = exact-match `.com` available (RDAP, free). Confidence is 80 for all 85 — evidence quality is uniform because every market got the same collection treatment.

---

## 12. Sensitivity

Each market was rescored under all 5 weight sets. **12 of the top 20 stay within 15 rank positions across every weighting**, including the top 2 (Kitchen Remodeling Orlando holds rank 1 under all five). The unstable half are the high-volume/low-value fragmented-local markets (Appliance Repair, Dumpster Rental), which swing 30–50 positions between economics-first and rankability-first weightings. **Interpretation: the ranking is weighting-dependent for commodity services and weighting-robust at the top.** Only the stable head should be treated as a decision.

---

## 13–15. What surprised me

1. **Recurring B2B is completely absent.** 126 hypotheses, **zero** cleared the 100/mo demand floor. Commercial cleaning, hood cleaning, grease trap, medical waste — these are real businesses that apparently are not bought through local search at measurable volume. This is the single biggest strategic finding, and it contradicts the intuition that recurring B2B revenue is the premium target.
2. **Kitchen Remodeling swept HIGH-VALUE**, but on **D/F economics, not rankability** — its A scores are 48–54, i.e. contested SERPs. These are the hardest builds in the portfolio, not the easiest.
3. **Rankability is the binding constraint, not demand.** Of the 58 that cleared all floors but earned no bucket, **54 failed on A < 60** and 56 on F < 60, while **zero** failed on demand. Median A across all 85 is 52. In 2026 there are few genuinely weak local SERPs left.
4. **Controls behaved correctly**, which is evidence the screen works: all 42 control-negative hypotheses (house cleaning, lawn mowing, pressure washing) died at the demand floor. The only surviving controls were 3 Garage Door Repair markets — flagged as GBP-dependent, and I would not build those.

**Contradiction with V0:** V0's enthusiasm for high-volume fragmented-local niches (appliance repair especially) does not survive contact with A-and-F scoring. Appliance Repair Orlando has the joint-highest demand in the dataset (1,600/mo) and lands 19th, because A = 28 and F = 50 — lots of searches, brutal SERP, and $22 of gross profit per lead. High volume was V0's proxy for opportunity; it is not one.

---

## 16–17. Evidence gaps

- **146 of 846 hypotheses were never measured** (17%) — DataForSEO batch 2 returned `Payment Required`, 0 rows, $0. The account holds a **negative balance (−$0.041)**; the $1.00 trial credit is exhausted and the $50 deposit was never made. Those 146 are unknown, not rejected.
- **`contentWords` and `domainAge` were not collected** (no competitor crawl in this experiment). Dimension A scored without them — they are reported as gaps, never imputed. Median evidence completeness is 100% on collected dimensions, but A itself is thinner than in Experiment 1.5.
- **Keyword universe research is unavailable** while DataForSEO is unfunded, so every demand figure here is exact-match head volume only. True market demand is larger by an unmeasured factor.
- **Dimension G is prospective** by construction — no live ranking data exists yet.

---

## 18. Is 8/8/4 sufficiency met?

**No.** Target 8 LOW-HANGING / 8 HIGH-VALUE / 4 UNICORN; actual **20 / 4 / 0**. LOW-HANGING is oversupplied, HIGH-VALUE is half-supplied, UNICORN is empty. I am explicitly **not** relaxing gates to close the gap. The honest read: this hypothesis space (48 services × 18 geos, 17% unmeasured) does not contain 4 unicorns, and finding them requires a wider net, not a lower bar.

---

## 19. Recommended next discovery iteration

1. **Fund DataForSEO ($50)** — it is the cheapest unblock available; Stage 2 cost $0.09 for 700 keywords, so the entire remaining program costs single-digit dollars.
2. **Measure the missing 146** first — same batch, ~$0.02.
3. **Widen geography, not services.** Rankability is the constraint and it is geography-driven; 18 cities is too few. Expand to the 491-city national universe for the ~12 services that cleared Stage 2, targeting small/mid markets where A scores run higher.
4. **Drop recurring-b2b** from local-search discovery. It failed decisively; it is not a search-acquired category.
5. **Add the competitor crawl** (`contentWords`, `domainAge`) so A stops being the thinnest dimension while being the binding one.

---

## 20–21. Recommended domains — NOT purchased

Available now per RDAP, for the bucketed markets only:

| Domain | Market | Score | Bucket |
|---|---|---|---|
| `windowreplacementamarillo.com` | Window Replacement — Amarillo, TX | 63 | LOW-HANGING |
| `kitchenremodelingchandler.com` | Kitchen Remodeling — Chandler, AZ | 63 | HIGH-VALUE |
| `windshieldreplacementaurora.com` | Auto Glass Repair — Aurora, IL | 61 | LOW-HANGING |
| `dumpsterrentalbrockton.com` | Dumpster Rental — Brockton, MA | 57 | LOW-HANGING |
| `windshieldreplacementmadison.com` | Auto Glass Repair — Madison, WI | 57 | LOW-HANGING |

Availability is a point-in-time observation and decays. **No purchase was made and none will be without your explicit instruction.**

---

## 22–24. Proposed Deployment Engine spec (design only, not built)

Deployment stays gated behind your approval. The specification that follows falls out of this experiment's evidence:

- **Input contract:** a bucketed opportunity with `A ≥ 60` (LOW-HANGING) or `F ≥ 60` (HIGH-VALUE), a viable renter (`opViable ≥ 1`), and an available exact-match domain. Nothing deploys from an unbucketed row.
- **Evidence-driven build brief:** page count and content depth derived from the *observed* SERP, not a template — `competitorAvgWords` sets the content target, `serp.directory.count` and `serp.innerpage.count` set how aggressive the on-page targeting needs to be.
- **Renter shortlist attached at build time:** `op.*` signals already identify who in that market has no website (`op.website.adoptionpct`) and who is already buying ads (`op.count.advertiser`) — the latter is the renter with proven willingness to pay for leads.
- **Rent model:** flat $300–$2,000/mo or per-lead commission, chosen by D's per-lead gross profit. At Appliance Repair's ~$22/lead, only commission makes sense; at Kitchen Remodeling's ~$1,050/lead, flat rent underprices the asset badly.
- **Observation loop:** first-rank date and indexed-page count write back as OBSERVED evidence, which finally converts Dimension G from prospective to measured and lets the model learn what actually ranked.

**Blocking human action: fund the DataForSEO account ($50).** Everything else in the pipeline is unblocked and running.
