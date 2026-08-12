# DEPLOYMENT ENGINE HANDOFF CONTRACT (DRAFT — documentation only)

Status: FUTURE CONTRACT, NOT IMPLEMENTED. The Deployment Engine is a
separate system being developed in parallel. RankRent Intelligence V2 does
not generate, deploy, host, or QA websites — its responsibility ends at an
approved investment decision. This document exists so nothing built in V2
makes the eventual handoff difficult.

## Conceptual flow

```
RankRent Intelligence V2                          Deployment Engine
────────────────────────                          ─────────────────
APPROVED OPPORTUNITY  ──►  ASSET SPECIFICATION  ──►  build / deploy / QA
(portfolioRuns entry)      (exported artifact)       (separate system)
```

## What V2 will eventually export per approved selection

An **AssetSpecification** — a self-contained JSON artifact derived from an
approved `portfolioRuns` selection. Anticipated shape (indicative, to be
versioned when implemented):

- `specVersion`, `generatedAt`, `portfolioRunId`, `opportunityId`
- **Identity:** service (name/slug/synonyms), geography (city/community,
  state, parent city), opportunity type (general | cluster)
- **Domain:** recommended domain + runner-up + reasoning (from domain
  research), registration status at export time
- **Keyword strategy:** primary keyword, known keyword universe with
  volumes/CPC (evidence-referenced)
- **SERP context:** latest serpSnapshot summary — who ranks, extracted
  weakness signals, content-depth bar to clear
- **Economics context:** ticket/margin/lead-value evidence with evidence
  types and confidence (so the builder knows what is assumed vs observed)
- **Renter context:** operator roster summary (names/reviews/websites)
- **Expectations baseline:** the frozen scores, predicted signal horizon,
  and assumptions — the numbers the Deployment Engine's outcomes will later
  be compared against
- **Provenance:** every number carries its observation reference

## Boundary rules (binding on V2 development)

1. V2 never writes deployment state; the Deployment Engine never writes
   evidence, scores, or portfolio records. If deployment outcomes flow back
   later, they arrive as ordinary V2 observations through the existing
   append-only observation layer — no new write path is required.
2. The handoff artifact is derived entirely from data V2 already stores
   (opportunity + evidence bag + scoreRun + portfolio selection). Keeping
   those queryable (already true) is the whole integration burden.
3. No V2 schema may embed Deployment Engine concepts (hosting, DNS, repos,
   build status). The only anticipated touchpoint is a future optional
   `assetSpecExportedAt` marker on a portfolio selection.
4. Export mechanism (file, API, queue) is deliberately undecided — nothing
   in V2 constrains it.

Nothing further is implemented until both systems agree to activate this
contract.

---

# PART 2 — OUTCOME FEEDBACK CONTRACT (v1, definition only)

Added 2026-08-12 alongside the first Wave-1 Asset Specifications
(`asset-spec-1.0.0`, emitted to `out/portfolio/asset-specs/`). The Deployment
Engine is still NOT built. This section defines only what it must eventually
return, so that live results can replace the assumptions currently carrying
Dimensions D, F and G.

## Why this exists

Three dimensions are not currently measured:

| Dim | Today | Replaced by |
|---|---|---|
| D — Lead economics | HUMAN_ASSUMED ticket x margin x 10% close | `leadValueActual`, `closeRateActual`, `cplActual` |
| F — Asset value | derived from D x benchmark funnel rates (25% CTR, 12% contact) | `leadsTotal`, `revenue`, `monthlyRent` |
| G — Time-to-signal | PROSPECTIVE proxy from A; never observed | `indexedAt`, `firstImpressionAt`, `firstLeadAt` |

Until these arrive, every economic number in an Asset Specification is a
falsifiable prediction, not a measurement.

## Transport

Outcomes enter RankRentOS as ORDINARY OBSERVATIONS through the existing
append-only layer. No new write path, no schema change, no mutation of prior
evidence. Each payload carries `assetId` (matching `AssetSpecification.assetId`),
`observedAt`, and a `source` of `deployment-engine:<version>`.

Rules that bind the feedback path, identical to all other evidence:
1. Append-only. A corrected value supersedes via `superseded_by`; nothing is edited.
2. UNKNOWN is never zero. "No leads yet" (`leadsTotal: 0`) and "not measured"
   (`leadsTotal: null`) are different facts and must not be conflated.
3. Every metric must exist in the metric registry before it can be written.
4. `evidenceType: "OBSERVED"` — these are the first true observations of outcome.

## Event timestamps (one-time, nullable until they occur)

`deployedAt`, `indexedAt`, `firstImpressionAt`, `firstClickAt`, `firstLeadAt`,
`firstRevenueAt`, `renterAcquiredAt`

Null means "has not happened yet OR not measured" — the engine MUST distinguish
these with an accompanying `measurementStartedAt`.

## Time series (daily grain, per asset)

`impressions`, `clicks`, `averagePosition`, `rankingsByKeyword[{keyword, position}]`,
`leadsTotal`, `leadsByChannel{call, form}`, `qualifiedLeads`, `revenue`, `operatingCost`

## Renter funnel (the E and F validators)

`renterOutreachCount`, `renterResponses`, `renterOffers`, `renterAcquired`,
`monthlyRent`, `rentModel` (`flat` | `commission` | `hybrid`), `churnedAt`

## Economic actuals (the D validators)

`cplActual`, `leadValueActual`, `closeRateActual`, `ticketActual`

These are the four numbers that convert D from HUMAN_ASSUMED to OBSERVED. They
are the single highest-value output of Wave 1.

## What RankRentOS does with them

1. Writes them as observations against the asset's market subject.
2. Compares each against `AssetSpecification.expectationsBaseline` — the frozen
   prediction — producing a per-dimension prediction error.
3. Accumulates errors across the portfolio to answer: does A predict ranking
   speed, does B predict impressions, does E predict monetization, does F predict
   realized economics? Those answers drive the next model version.

Nothing in Part 2 is implemented. It is a contract, not code.
