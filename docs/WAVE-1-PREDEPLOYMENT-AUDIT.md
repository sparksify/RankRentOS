# Wave 1 — Pre-Deployment Decision-Model Audit

**Date:** 2026-08-12 · **Machine-readable:** `out/wave-1-experiment/decision-v2-comparison.json`
**New models:** `decision-v2.0.0` · `capturability-v1.0.0` · `rentability-v1.0.0` · `demand-attribution-v1.0.0`
**Frozen and unmodified:** `ai-v1.0.0` · `organic-v1.2` · `w-balanced-v1.1` · `buckets-1.1.0` · `WAVE-1-FROZEN-BASELINE`
**Provider spend: $0.00** — the audit runs entirely on evidence already collected.
**Nothing purchased. Nothing deployed.**

---

## 1. What was actually wrong with the old model

**a) Ambiguous demand was consumed as if it were local demand.** This is the serious defect. `Ev` has no attribution field, so `demand()` receives a bare number. Bellevue NE's 2,400/mo — a figure shared with Bellevue WA — produced **B=92, F=92, H=100, composite=85, bucket UNICORN**, identical to a cleanly attributable 2,400. The portfolio layer *labelled* it `measured-upper-bound-shared-city-name`, but **the scoring layer never saw the label.** Four frozen assets are affected: Bellevue NE, Rochester MN, Rockville MD, Aurora IL.

**b) Capturability was never gated.** `bucketOf` gates on demand (≥100), viable renters (≥1), F (≥34) and **A** — but never on **O**. Since A contains map-pack terms, map-pack weakness can help clear the A≥40/55/60 bucket thresholds for an asset that cannot enter a map pack. This is real, but small (see §3).

**c) The composite is a pure weighted average with no veto.** `scoreOpportunity` renormalizes over scoreable dimensions; no single dimension can block. The gates live only in `bucketOf`, which sits *outside* the composite. So a headline composite of 85 can coexist with an existential flaw.

**d) Monetization is under-modeled, not wrong.** D and F are correct post-audit (F consumes D's per-lead value; no double count). But nothing models sales cycle, attribution clarity, urgency, seasonality, operator sophistication or monetization-model compatibility. That is a *gap*, not a bug.

## 2. Which criticisms turned out NOT to be valid

**The claim that Dimension A ≈ 92 for Bellevue "because the map pack is weak" is factually wrong.** Ablation of the actual code shows map-pack signals contribute **exactly 0** to Bellevue's A. Its 92 decomposes as:

| Term | Contribution |
|---|---|
| 2 directories in top 3 | **+28** |
| competitor content averages 208 words | **+14** |
| incumbent domains young (3.9y) | +6 |
| top titles omit the city | +4 |
| base | 40 |
| **map pack (3 listings, 60 avg reviews)** | **0** — 60 falls in the neutral band |

Across all 11 frozen city assets: map-pack signals **add** to A on only 4 of 11, mean **+0.9 points overall**, while the mean A−O gap is **17.5**. **Map-pack credit explains roughly 5% of the A/O divergence** (correlation r=0.42). Two assets are actually *penalised* by map-pack (Temecula −18, Orlando −8).

The divergence is therefore overwhelmingly a **philosophy difference, not a GBP leak**: A treats directories in the top 3 as +28 ("Google lacks a strong local answer"), while O treats them as displaceable slots and still charges for the real competitors behind them and for geo-targeted incumbents.

**Also not valid:** "there are no hard gates." `bucketOf` has four. The problem is which variable they gate on, not their absence.

## 3. Exactly how A uses map-pack signals

`lib/scoring/dimensions.ts`, `rankability()`: `mapCount === 0` → −6; `mapReviews < 25` → **+16**; `< 60` → +8; `> 400` → −18; `> 120` → −8; `mapNoWebsite > 0` → **+4**. Maximum upward contribution **+20**, maximum downward **−24**.

## 4. Should A remain?

**Yes — retained, reinterpreted, not deleted.** A is a sound *general SERP opportunity* diagnostic and its non-map-pack terms (directories, inner pages, content depth, domain age, title targeting) carry real signal. It is simply the wrong instrument to gate an organic-only deployment. It stays as a diagnostic and as the H1 comparator.

## 5. Should O become the primary capturability gate?

**Yes, for organic-only assets.** `capturability-v1.0.0` gates on O and explicitly excludes map-pack size, review strength and no-website counts. Thresholds are **not invented here**: PASS ≥55 is the frozen Wave-1 Group-A standard; FAIL <45 is the organic-v1.2 CONTESTED/BRUTAL band boundary. A `GBP_CAPABLE` architecture is defined so a future asset type can legitimately consume local-pack evidence **without retroactively changing organic-only behaviour** (regression-tested).

## 6. The frozen 26 under decision-v2.0.0

| Decision | Count |
|---|---|
| **REVENUE_CANDIDATE** | **5** |
| **EXPERIMENTAL** | **21** |
| HOLD | 0 |
| REJECT | 0 |

**Revenue candidates** (all four gates pass on attributable evidence): Bathroom Remodeling Arvada CO · Window Replacement Midland TX · Window Replacement Temecula CA · Window Replacement Vancouver WA · Kitchen Remodeling Frisco TX.

Zero REJECTs is **structural, not flattering**: Wave 1 was deliberately built as an experiment portfolio, and all 21 non-Group-A assets carry a pre-registered hypothesis (H1/H2/H3). The label is load-bearing and audited — **7 EXPERIMENTAL assets have at least one FAILED gate** and would be REJECT without their hypothesis:

| Asset | Failed gate(s) |
|---|---|
| Pool Builder — Frisco, McKinney (controls) | capturability |
| Pool Builder — Prosper (control) | demand + capturability |
| Metal Roofing — Rochester | capturability (O=20) |
| Basement Waterproofing — Naperville | capturability (O=32) |
| Kitchen Remodeling — Rockville | capturability (O=24) |
| Appliance Repair — Aurora | capturability (O=39) |

A regression test confirms an identical failing asset **without** a hypothesis is not excused.

**Notable reversal:** Window Replacement Midland has **A=40** (would barely clear any bucket) but **O=62** — the corrected model promotes it to a revenue candidate. O surfaced something A nearly discarded.

## 7–9. Domains

All 21 remain justified **if you fund the experiment**. Split by purpose:

| Purpose | Domains |
|---|---|
| Revenue candidates | **5** |
| Experiments (6 B1 standalone + 1 shared hub + 3 controls + 6 model-validation) | **16** |
| **Total** | **21** |

**No additional experimental domains are justified.** The six B2 assets remain **pages on one hub**, not six sites.

## 10. Bellevue, NE — case study

| | |
|---|---|
| Old | composite **85**, A=92, O=58, bucket **UNICORN**, rank #1 |
| New | **EXPERIMENTAL** — demand UNKNOWN, economics UNKNOWN |

**Origin of the 2,400.** DataForSEO Google Ads `search_volume` for the exact string `"bathroom remodeling bellevue"`, requested with `location_name: "United States"` — a **national** request for a **city-only** keyword. The provider was never asked about Nebraska.

**Why it is not attributable.** Bellevue NE (pop 53,663) shares its name with Bellevue WA (pop 133,992) and others. The one query string aggregates all of them. Two prior attempts failed to resolve it: no geo-scoped keyword universe exists for this market, and a state-qualified probe was **inconclusive** (the provider groups variants). **Population share is not evidence of search share, so no discount factor is applied.** Attributable demand is `null`; 2,400 is retained as a `ceiling`.

**A=92 vs O=58.** Fully decomposed in §2 — driven by directories (+28) and thin content (+14), with **zero** map-pack contribution.

**Other evidence.** SERP verified local to NE (map-pack addresses in-state), 3 viable renters of 10 operators, D=78 and F=92 — but **F is computed from the unattributable 2,400**, so it inherits the defect. Ticket $18,000 × margin 0.32 are HUMAN_ASSUMED.

**Verdict: it collapses as a revenue candidate, and it should.** It remains worth deploying as an **experiment** — it is the pre-registered H1 shared-name probe, and it is paired with a Bellevue WA equivalent so live Search Console data can finally split the 2,400. That is the only instrument that can resolve this.

## 11. Does the community experiment survive?

**Yes, and the corrected model strengthens it.** All 12 community assets clear capturability (O 57–82) and renter depth; only demand is UNKNOWN — which **is the hypothesis**. `assessSearchOpportunity` has an explicit `isExperimentalDemandClass` branch that refuses to score demand for community assets rather than scoring it as zero. H2/H3 methodology, matched pairs and the standalone-vs-hub split are untouched.

## 12–13. Does the experiment still make sense?

**Yes.** Costs are unchanged because the asset list is unchanged.

| Scope | Domains | Upfront | Monthly | 6-month |
|---|---|---|---|---|
| **Revenue candidates only (5)** | $60.90 | $125.90 | $7.50 | **$170.90** |
| **Full Wave 1 (21 domains / 26 assets)** | $255.78 | $593.78 | $34.00 | **$797.78** |

The **$627 delta buys the entire learning agenda**: whether A or O predicts ranking, whether hyperlocal demand exists, and whether standalone beats hub.

## 14. What remains HUMAN_ASSUMED

Ticket and margin for every service; close rate; the 25% CTR × 12% contact funnel; and the whole `rentability-v1.0.0` vertical profile (sales cycle, attribution clarity, urgency, seasonality, operator sophistication). Every one carries a `basis` string beginning `HUMAN_ASSUMED`, and monetization confidence is **capped at 0.35** — regression-tested. **No LLM produces any number in this pipeline.**

## 15–16. What live data replaces them

`cplActual`, `leadValueActual`, `closeRateActual`, `ticketActual` replace D and F. Ranking trajectory (`daysToTop20`, `positionAtDay90`) replaces G and settles H1. Search Console impressions on **unpredicted** queries settle H2 and, for Bellevue, finally attribute the 2,400. Renter outreach → response → signed rent validates E and the rentability profile. Within-pair trajectory deltas settle H3.

## 17. Additional flaws found during this audit

1. **My own audit script keyed on `service|city`** and silently returned Bellevue WA's evidence for Bellevue NE — the exact defect under audit, reproduced in the audit tool. Fixed to state-qualified keys. **The same collision-prone key is used in `run-prepurchase-validation.ts`**; it is harmless today because the frozen 26 contain only one Bellevue, but it is a latent bug and is now documented.
2. **`assetValue` (F) inherits unattributable demand** without flagging it. `decision-v2` routes around this by projecting lead flow only from `attributableDemand`, but F itself still reports 92 for Bellevue. F should eventually carry the attribution state.
3. **Confidence is not acting as opportunity quality** — verified. A confidently-measured 30/mo market still REJECTs (regression-tested).
4. **No previous bug fix has regressed** — the volume `vol`/`volume` contract, UNKNOWN≠ZERO handling, host-matching and community-site classification all still pass.

---

**Tests: 143 passed, 11 skipped.** Includes all 14 required regressions plus a frozen-output test asserting Bellevue's A is still exactly 92 under `ai-v1.0.0`.
