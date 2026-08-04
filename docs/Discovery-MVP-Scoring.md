# Discovery MVP — Scoring
### Qualification `qual-v1.0` · Lens `rr-opportunity-v1.0` · Weights `w1.0` · Selection `select-v1.0`

All weights/thresholds live in `src/core/config.ts` and are mirrored to `rros_config` — configurable without schema changes; any change requires bumping the version string.

## Stage 3 — Low-cost qualification (free)

Gates (each records pass/fail/warn/info + detail):
- **Population** ≥15,000 (fail below)
- **Income** ≥$90k median for `affluent-suburb` archetype niches (fail below); informational otherwise
- **Demand**: measured volume ≥100 strong · ≥30 modest · ≥10 thin (passes only for ≥$15k-ticket niches as commission plays) · below → fail (the "#1 rookie failure": zero-demand markets)
- **CPC band** (SOP v2 §2.3): $2–15 healthy (+15) · >$16 ad-war (+8, warning) · 0/null warning
- **Niche economics**: closed-job value (ticket × margin × 10% close) ≥$300 strong / ≥$100 workable
- **Growth** bonus; **trend weight** multiplier (niche-relative Google Trends, seasonal niches judged on peak)

Result: `passed | needs_research | failed` + preliminary score (0–100) + confidence (0.9 − 0.15/warning, floor 0.2) + input hash. Rejected markets stay visible with reasons.

Deep-research queue: top qualified markets, **max 3 per niche, cap 30** — diversification is deliberate so high-ticket niches reach deep research despite lower raw volume.

## Stage 6 — Rank & Rent Opportunity Lens v1 (0–100)

| Subscore | Max | Main signals |
|---|---|---|
| Demand | 20 | measured volume bands, CPC-proven buyer intent, trend weight, city growth |
| Competition & authority gap | 25 | directories in top-3, inner pages in top-5, franchise penalty (−), intent mismatch, EMD saturation (−), untargeted titles, competitor content depth, dedicated-specialist absence |
| Monetization | 15 | flat-rent vs commission value model, projected lead flow, buyer proof (ads/lead marketplaces), margin |
| Domain quality | 10 | verified availability (0 if unverified), city-first exact match, naming optionality |
| Operator bench | 10 | count of real observed operator candidates (0 research → 0 observed) |
| Geographic economics | 10 | population sweet spot 40k–250k, income fit to archetype, growth |
| Buildability & repeatability | 10 | non-seasonal, PE risk, need/desire, niche repeat count in pool |

Value model (ported from v0, labeled uncalibrated): leads = volume × 25% CTR × 12% contact; deal = flat rent (capped $300–2,000, formula-rent × 50% discount) vs commission (10% of gross), whichever is larger.

## Confidence (separate from score, never blended)

| Evidence | Weight |
|---|---|
| Measured keyword volume | +0.20 (+0.05 if ≤90 days old) |
| SERP evidence | +0.25 localized (SerpAPI/DataForSEO) / **+0.13 web-search proxy** / 0 none |
| Local pack observed | +0.07 |
| ≥3 competitors resolved | +0.10 |
| Domain availability verified | +0.15 registrar-grade / +0.12 registry-grade |
| Operator candidates | +0.10 (≥3) / +0.08 (≥1) |
| Population known | +0.05 |

This cycle's ceiling ≈0.78 (proxy SERP, no local pack). A localized SERP re-check raises eligible markets to ≈0.97.

## Action thresholds
- 80–100 strong build · 70–79 investigate/build with caveats · 60–69 watchlist · <60 reject
- **Top-10 eligibility**: score ≥60 AND confidence ≥0.65 AND registrar-verified available domain. High score with low confidence is surfaced in selection notes, never silently promoted.

## Stage 7 — Selection (`select-v1.0`)
Raw ranked list preserved; recommended batch applies: ≤3 per niche and ≤4 per region (overconcentration guards, deferrals noted), niche-diversity swap pass (widen learning if <3 niches), inclusion reasons on every target (repeatability leverage, clustering leverage, revenue). 10 primaries + ≥10 alternates, all with stored reasons.
