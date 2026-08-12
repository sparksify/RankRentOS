# Wave 1 — FROZEN BASELINE & PURCHASE LIST

**Frozen:** 2026-08-12 · **Baseline:** `WAVE-1-FROZEN-BASELINE`
**Machine-readable:** `out/wave-1-experiment/portfolio-v2.json` (`wave1-v3-matched-architecture`, `frozen.isFrozen = true`)
**Models at freeze:** Dimension A `ai-v1.0.0` · organic `organic-v1.2` · weights `w-balanced-v1.1` · buckets `buckets-1.1.0`
**Nothing purchased. Nothing deployed.**

---

## 1. Domain re-verification — all 21 confirmed AVAILABLE

Re-checked live via RDAP at freeze time. Every domain in the purchase list returned HTTP 404 (unregistered).

**26 rankable assets across 21 websites / 21 domains** — the six hub pages share one domain.

## 2. The Conroe contradiction — resolved, and it was a real error of mine

**Bathroom Remodeling — Conroe, TX had `viableRenters: 0`** (E=9, map-pack website adoption 0%) yet sat at the top of Group A.

The cause was a defect in my selection logic, not in the data. `bucketOf()` requires `opViable >= 1` for every bucketed candidate — without a viable renter there is nobody to rent the asset, which is the entire business model. My Group A filter checked demand, F, organic score and geography, and **omitted the renter gate**. Conroe entered through that gap.

Its organic top-5 corroborated the problem: `en.wikipedia.org`, `ikea.com`, `lowes.com`, `homedepot.com`, `houzz.com` — not one local operator. organic-v1.2 scored it 67 ("viable") precisely because every slot is displaceable, but a SERP of encyclopaedia and big-box retail alongside zero rentable operators indicates a query without local commercial intent, not an opportunity.

**Resolution:** the renter gate `viableRenters >= 1` is now applied to Group A, matching the bucket gate. Conroe is removed. **No candidate qualified to replace it, so Group A is 5 rather than 6** — I did not lower a threshold to backfill.

I then checked the same signature across the whole portfolio: **every remaining asset has ≥1 viable renter.** Two assets have no local operator in the top-5 — Window Replacement Vancouver (directories + a franchise, 3 viable renters) and Pool Builder Painted Tree (community site + home builders) — both legitimate, and Painted Tree's profile *is* the community hypothesis.

## 3. Ranking-trajectory measurement — added to the pre-registration

A single end-state rank cannot distinguish "ranked fast then stalled" from "climbed steadily." Both rankability models make claims about *speed*, so speed is now sampled.

**Observation schema (per query, per check):** `experimentId`, `query`, `queryRole` (primary / secondary / community-modified / city-level / **unpredicted**), `checkDate`, `position`, `rankingUrl`, `serpFeaturesPresent`, `device`, `location`.

**Cadence:** weekly from publish through week 12, then fortnightly through week 26.

**Queries per asset:** 1 primary (exact service+geography), 2–4 secondary variants, plus for community assets the community-name and service+community queries — and **any query Search Console reports impressions for that no keyword tool predicted**, which is the direct instrument for the under-measurement hypothesis.

**Derived:** `daysToFirstTop100`, `daysToTop50`, `daysToTop20`, `daysToTop10`, `daysToTop5`, `positionSlopePerWeek`, `positionVolatility`, `peakPosition`, `positionAtDay90`, `positionAtDay180`.

**Null handling:** `position: null` means *not found in the top 100*. It must never be stored as 101 or 0, and an unchecked week must be absent rather than null — the same UNKNOWN ≠ ZERO rule that this project has already been bitten by twice.

**Endpoints fixed before launch** so the analysis cannot be chosen to fit the result:
- **Primary endpoint:** `daysToTop20` on the primary query.
- **Secondary:** `positionAtDay90`, `daysToFirstImpression`, `impressionsAtDay180`, `leadsAtDay180`.

**Pre-registered analyses:**

| ID | Question | Decision rule |
|---|---|---|
| **H1** | Does Dimension A or organic-v1.2 better predict ranking speed? | Spearman correlation of each score vs `daysToTop20` across the 11 city assets. If organic-v1.2 correlates more strongly **and** both ~50-point disagreement assets (Rochester, Naperville) miss top 20, rebuild A as `A-2.0.0`. If they rank, retain A unchanged. |
| **H2** | Do zero-volume community queries produce real search activity? | Compare community impressions and unpredicted-query counts against the control gradient (320 / 210 / 10 / 0). |
| **H3** | Standalone or regional hub? | **Within-pair** difference in `daysToTop20` and `positionAtDay90` across the 6 pairs; paired sign test. **Requires ≥4 of 6 pairs to yield interpretable data or the verdict is declared VOID** rather than reported weakly. |
| **H4** | Is the $300/mo rentability floor correctly placed? | Realised rent vs `assetValueF`, with House Cleaning Orlando (F=34) as the designated below-floor probe. |

## 4. Final structure

| Cohort | Assets | Websites |
|---|---|---|
| A — Best-evidence / exploitation | 5 | 5 |
| B1 — NTX pool, standalone | 6 | 6 |
| B2 — NTX pool, regional hub | 6 pages | 1 (shared) |
| B3 — City controls | 3 | 3 |
| C — Model validation (EXPERIMENTAL) | 6 | 6 |
| **Total** | **26** | **21** |

**Cost:** domains **$255.78** · upfront **$593.78** · monthly **$34.00** · **six-month experiment $797.78**.

---

## 5. THE PURCHASE LIST — 21 domains, $255.78

All verified available at freeze. Availability decays; re-check immediately before buying.

### Group A — best-evidence (5)
| # | Domain | Asset |
|---|---|---|
| 1 | `bathroomremodelingofarvada.com` | Bathroom Remodeling — Arvada, CO (390/mo, organic 62, A 83, F 66) |
| 2 | `windowreplacementmidland.com` | Window Replacement — Midland, TX (110/mo, organic 62, A 40) |
| 3 | `windowreplacementtemecula.com` | Window Replacement — Temecula, CA (140/mo, organic 58) |
| 4 | `windowreplacementvancouverwa.com` | Window Replacement — Vancouver, WA (110/mo, organic 57) |
| 5 | `kitchenremodelingfriscotx.com` | Kitchen Remodeling — Frisco, TX (170/mo, organic 56, F 66) |

### Group B1 — NTX pool, STANDALONE arm (6)
| # | Domain | Community | organic | arm |
|---|---|---|---|---|
| 6 | `poolbuildersuttonfields.com` | Sutton Fields (Celina) | 82 | virgin |
| 7 | `poolbuilderpaintedtree.com` | Painted Tree (McKinney) | 73 | virgin |
| 8 | `poolbuildermosaic.com` | Mosaic (Celina) | 67 | incumbent |
| 9 | `poolbuildersandbrockranch.com` | Sandbrock Ranch (Aubrey) | 66 | virgin |
| 10 | `poolbuildernewmanvillage.com` | Newman Village (Frisco) | 65 | incumbent |
| 11 | `poolbuildercambridgecrossing.com` | Cambridge Crossing (Celina) | 57 | incumbent |

### Group B2 — NTX pool, REGIONAL HUB (1 domain, 6 pages)
| # | Domain | Pages |
|---|---|---|
| 12 | `poolbuildersnorthtexas.com` | `/legacy-gardens/` (79) · `/union-park/` (73) · `/star-trail/` (67) · `/harvest/` (64) · `/stonebridge-ranch/` (63) · `/trinity-falls/` (60) |

### Group B3 — city controls (3)
| # | Domain | Control |
|---|---|---|
| 13 | `poolbuilderfriscotx.com` | Frisco — 320/mo (high measured demand) |
| 14 | `poolbuildermckinneytx.com` | McKinney — 210/mo (mid) |
| 15 | `poolbuilderprospertx.com` | Prosper — 10/mo (low; matched to cluster geography) |

### Group C — model validation, EXPERIMENTAL (6)
| # | Domain | Test |
|---|---|---|
| 16 | `metalroofingrochester.com` | A=76 vs organic 20 — **Δ56, the largest disagreement** |
| 17 | `basementwaterproofingofnaperville.com` | A=77 vs organic 32 — Δ45, independent replicate |
| 18 | `bathroomremodelingbellevuene.com` | Highest composite (85) + shared-name demand attribution |
| 19 | `housecleaningoforlando.com` | 2,900/mo, F=34 — tests the rentability floor |
| 20 | `kitchenremodelingrockvillemd.com` | E=100 vs A=45 — can renter depth carry a hard SERP? |
| 21 | `appliancerepairofaurora.com` | V0 vs V2 thesis on commodity services |

---

## 6. What freezing means

Scores, selections, matched pairs, endpoints and analyses are fixed as of this build. Live outcomes are compared against these recorded values; nothing may be edited retrospectively. Any change requires a new version and an explicit note. The six matched pairs and the H1–H4 decision rules were all fixed **before** any site exists, so the analysis cannot be selected after seeing results.

**Next action requires your approval: purchase 21 domains, ~$255.78. I will not purchase them.**
