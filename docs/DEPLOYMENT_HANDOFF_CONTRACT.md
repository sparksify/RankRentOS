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
