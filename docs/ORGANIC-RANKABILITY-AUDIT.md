# Organic-Only Rankability Audit — Wave-1 Candidates

**Date:** 2026-08-12 · **Module:** `organic-v1` (`v2/lib/serp/organic.ts`, 14 tests)
**Cost:** $0 — reparses SERPs already held, plus free crawl/RDAP for the cluster.
**Question:** if we build organic-only sites with no Google Business Profile, which of the 28 Wave-1 candidates can actually rank?

---

## 1. What was wrong with Dimension A

Dimension A blends map-pack weakness into rankability. Reading the code: a pack averaging under 25 reviews adds **+16**, map listings without websites add **+4**. So **up to +20 points of A can come from a pack we cannot enter.** For an organic-only asset that credit is unearned — we cannot rank in a local pack without a GBP.

`organic-v1` scores only positions 1–10 of the blue links. Local-pack facts are preserved in a separate `localPackEvidence` field, explicitly labelled *market evidence only*, and never added to the score.

**How the split is scored.** Each organic slot is classified as **displaceable** (directory, marketplace, social, forum, reference, news, national content, or a page that never names the service) or **hard** (an independent local operator whose page targets this service). National brands and franchises are hard but weighted 0.6 — they rank on authority, not local relevance. Penalties then apply for competitors explicitly targeting the geography, content depth, and domain age.

---

## 2. Two defects found and fixed before trusting the output

The first run returned **0 of 28 viable**, which has the same shape as the "0 of 700" parsing bug earlier in this project. It was investigated before being reported, and it was indeed partly defective.

**(a) Substring host matching.** `host.includes(d)` matched `"x.com"` inside `"paintedtreetx.com"`, classifying a community's own website as social media. Fixed to exact-host-or-subdomain matching.

**(b) Everything unrecognised was treated as a tough local competitor.** Re-Bath and Pella (national brands), EcoWatch (a national affiliate/listicle site), Coventry Homes and Bloomfield Homes (home builders, not pool builders), and community websites were all scored as independent local specialists defending the SERP. Fixed by adding national-brand and national-content lists, and by a general rule: **a result whose title never names the service is not a competing service page** — it holds the slot by topical adjacency and a dedicated page displaces it.

Both defects pushed scores down. After fixing, 4 candidates are viable rather than 0. Regression tests cover both.

**Calibration caveat:** `organic-v1` is a new heuristic with no live validation. Its *absolute* thresholds are judgement. The *relative* findings below are robust to where the thresholds sit.

---

## 3. Headline finding: A and organic rankability are nearly unrelated

Across all **168 researched city candidates**:

| | |
|---|---|
| Correlation between Dimension A and organic-only score | **r = 0.30** |
| Mean Dimension A | 52.0 |
| Mean organic-only score | **32.5** |
| Bucketed candidates that are ORGANIC-VIABLE | **0 of 44** |
| All researched candidates that are ORGANIC-VIABLE | **2 of 168** |

A is systematically optimistic by roughly the map-pack credit it awards. The two organically-viable city candidates — Appliance Repair Kenosha (F=20) and Asbestos Abatement Rochester (F=35) — both fail on economics. **Where city organic is soft, the money is thin.**

---

## 4. Cohort results

Mean organic score: **Cohort A 29 · Cohort B communities 57 · Cohort B city controls 30 · Cohort C 37.**

### Cohort A (core) — no asset is organically viable

| Organic | Verdict | Prior A | Δ | soft/5 | hard/3 | Asset |
|---|---|---|---|---|---|---|
| 50 | CONTESTED | 75 | −25 | 2 | 1 | Bathroom Remodeling — Temecula, CA |
| 48 | CONTESTED | 61 | −13 | 3 | 1 | Kitchen Remodeling — Rochester, MN |
| 40 | BRUTAL | 59 | −19 | 3 | 1 | Window Replacement — Naperville, IL |
| 39 | BRUTAL | 60 | −21 | 2 | 2 | Kitchen Remodeling — Bellevue, NE |
| 37 | BRUTAL | 62 | −25 | 2 | 2 | Window Replacement — Amarillo, TX |
| 33 | BRUTAL | 62 | −29 | 2 | 2 | Stucco Repair — Orlando, FL |
| 28 | BRUTAL | **77** | **−49** | 2 | 1 | Basement Waterproofing — Naperville, IL |
| 20 | BRUTAL | 54 | −34 | 1 | 2 | Kitchen Remodeling — Orlando, FL |
| 20 | BRUTAL | **76** | **−56** | 1 | 2 | Metal Roofing — Rochester, MN |
| 16 | BRUTAL | 67 | −51 | 1 | 2 | Bathroom Remodeling — Kirkland, WA |
| 16 | BRUTAL | 66 | −50 | 1 | 2 | Water Damage Restoration — Bellevue, WA |
| 14 | BRUTAL | 64 | −50 | 1 | 2 | Water Damage Restoration — Chandler, AZ |
| 12 | BRUTAL | 58 | −46 | 1 | 2 | Bathroom Remodeling — Bellevue, WA |

**16 of 28 candidates lost ≥15 points**, the worst being Metal Roofing Rochester (A=76 → organic 20) and Basement Waterproofing Naperville (A=77 → organic 28). In both, the map pack was moderate and the organic top-5 is wall-to-wall local operators explicitly targeting the city.

### Cohort B (community cluster) — the strongest cohort on organic grounds

| Organic | Verdict | soft/5 | hard/3 | Community |
|---|---|---|---|---|
| **82** | VIABLE | 5 | 0 | Painted Tree (McKinney) |
| **73** | VIABLE | 4 | 1 | Sandbrock Ranch (Aubrey) |
| **67** | VIABLE | 3 | 1 | Star Trail (Prosper) |
| **67** | VIABLE | 4 | 1 | Trinity Falls (McKinney) |
| 46 | CONTESTED | 3 | 2 | Light Farms (Celina) |
| 41 | BRUTAL | 2 | 2 | Mustang Lakes (Celina) |
| 39 | BRUTAL | 2 | 2 | Canyon Falls (Argyle) |
| 38 | BRUTAL | 1 | 2 | Windsong Ranch (Prosper) |
| 36 | BRUTAL | 2 | 3 | **Prosper (city control)** |
| 23 | BRUTAL | 1 | 2 | **Frisco (city control)** |

Painted Tree's entire top 5 is the community's own site plus two home builders — **not one pool service page**.

### Cohort C (contrarian)

Bellevue NE bathroom remodeling 58 (CONTESTED, A=92 → −34), Appliance Repair Aurora 41, Mold Remediation Knoxville 33, House Cleaning Orlando 30 (A=74 → −44), Kitchen Remodeling Rockville 22.

---

## 5. The pattern that matters most

Scoring all 22 researched communities plus the 6 city controls produces a clean monotonic gradient:

| Class | n | Mean organic |
|---|---|---|
| **Virgin communities** (no competitor pool page) | 10 | **68** |
| **Incumbent communities** (a competitor already holds a community pool page) | 12 | 51 |
| **City controls** (same service, city geography) | 6 | 34 |

Two things follow. First, the incumbent/virgin distinction built into the experiment design is **predictive**, not decorative. Second, the community-versus-city difference is large and in the direction the neighborhood hypothesis predicted — on the *supply* side. Community SERPs are soft because nobody has built a community-specific service page; city SERPs are hard because everybody has.

This says nothing about whether anyone *searches* those community terms. Demand remains the open question, and it is exactly what Wave 1 exists to measure.

---

## 6. Do any of the 28 selections materially change? Yes — substantially

**Cohort B is now the strongest part of the portfolio, not the speculative part**, and the selection within it is wrong in three places.

### Recommended changes

**Swap out of Cohort B (organically brutal):** Windsong Ranch (38), Mustang Lakes (41), Canyon Falls (39).
**Swap in (organically viable, none currently selected):** Sutton Fields (82, 1,500 homes), Legacy Gardens (79, 400 homes), Union Park (65, 2,000 homes), Harvest (66, 1,800 homes), Newman Village (65, 800 homes).

Keep **Light Farms** (46, contested) and **Trinity Falls** (67) as the incumbent arm — we still need assets where a competitor has proven the demand, even though they are harder. Ramble (86) and Serenade (73) score highest of all but remain **excluded**: they are pre-occupancy, so there are no homeowners to search.

**Cut Cohort A from 13 to ~6.** No core asset is organically viable, and 8 of the 13 score below 25. Deploying 13 organically-brutal city assets as *investments* is not supportable now.

**Convert the biggest disagreements into the experiment.** Metal Roofing Rochester (A=76, organic 20) and Basement Waterproofing Naperville (A=77, organic 28) should move from Cohort A to Cohort C with an explicit hypothesis: *A and organic-v1 disagree by ~50 points; whichever ranks tells us which model is measuring rankability.* That is a better use of those two sites than treating them as investments.

**Indicative revised shape:** A ≈ 6 · B ≈ 12 (10 communities + 2 controls) · C ≈ 7 → **~25 sites**, with capital shifted from brutal city SERPs toward viable community SERPs at identical cost per asset.

### What has *not* changed

The economics. Cohort B still rests on an assumed $85,000 pool ticket, and the organic audit says nothing about whether community queries have any search volume. This audit improves our estimate of *whether we can rank*; it does not touch *whether it is worth ranking*.

---

## 7. Recommendation on the model itself

Do **not** overwrite Dimension A yet. Two models now disagree at r=0.30 and neither is validated against a live outcome. `organic-v1` is structurally more appropriate for an organic-only asset — that much is definitional — but its calibration is untested.

The right response is to carry both scores on every asset (now done in `portfolio.json`), select using the organic score, and let Wave 1 decide. If organic-v1 predicts ranking better than A, fold it into A as `A-2.0.0` and re-run selection across the existing 168 candidates at zero research cost.
