# RankRentOS ↔ Deployment Engine — Integration Guide

**Spec version:** `asset-spec-2.0.0` · **26 specs · 21 websites** (6 hub pages share one domain)
**Base URL:** wherever the RankRentOS app runs (locally `http://localhost:3311`)
**Auth:** `Authorization: Bearer <HANDOFF_TOKEN>` on every request. Set `HANDOFF_TOKEN` in `app/.env.local`; until then it falls back to `APP_PASSWORD`. Give the engine its own token before exposing this beyond localhost.

The contract is deliberately tiny: **two GETs in, one POST back.** The engine needs nothing else from RankRentOS, and RankRentOS accepts nothing else from the engine.

---

## 1. Pulling work — what to build

### Files (if the engine runs on this machine)
Canonical specs live at `out/handoff/`:
```
out/handoff/manifest.json
out/handoff/asset-specs/W1-A-001.json … (26 files)
```

### HTTP (if it runs anywhere else)
```bash
curl -H "Authorization: Bearer $TOKEN" $BASE/api/handoff            # manifest
curl -H "Authorization: Bearer $TOKEN" $BASE/api/handoff/W1-A-002   # one spec
```

The **manifest** lists every spec with `experimentId`, domain, cohort, classification and the recommended **deploy order** (Cohort B together first — the architecture experiment is only interpretable as one batch, and pool seasonality rewards speed).

Each **spec** contains everything needed to build without asking questions:

| Section | What the engine gets |
|---|---|
| `experimentId` | **The join key. Every outcome posted back must carry it.** |
| `identity` | service, geography, cohort, treatment, matched-pair membership |
| `decision` | REVENUE_CANDIDATE / EXPERIMENTAL, gate results, the pre-registered hypothesis and success/failure conditions |
| `build` | domain (+ purchase status), URL architecture (standalone root vs `hub.com/community/`), SERP-derived content directive, content-word bar, full site map tree, internal-linking plan, cannibalization guidance, suggested visual assets |
| `serpToBeat` | organic score/verdict, the actual top-5 with classifications, structure counts, intent class, local-pack context |
| `economics` | all HUMAN_ASSUMED and labelled — ticket, margin, lead value, modelled GP, recommended monetization model, per-asset cost basis |
| `outcomeContract` | exactly what to send back, and the cadence |

Two rules the engine must honour from `build`:
- **`doNotFabricate`** — local facts (landmarks, climate, regulations, pricing) were never collected. Pages are built from spec evidence only; no invented local claims.
- **`domainStatus`** — "verified-available-at-freeze" means *re-check and purchase before building*. RankRentOS never buys domains.

## 2. Posting results — the outcome feed

```
POST /api/outcomes
Authorization: Bearer <TOKEN>
{
  "engineVersion": "your-engine@1.0.0",
  "observations": [
    { "experimentId": "W1-A-002", "metric": "asset.published.date", "value": "2026-08-20T00:00:00Z" },
    { "experimentId": "W1-A-002", "metric": "asset.impressions.count", "value": 41, "period": "2026-W35" },
    { "experimentId": "W1-A-002", "metric": "asset.rank.check",
      "value": { "query": "window replacement midland", "role": "primary", "position": 63 }, "period": "2026-W35" }
  ]
}
```

- **Metrics are a closed vocabulary** — the 21 `asset.*` metrics listed in every spec's `outcomeContract` (registered in the v2 metric registry). Anything else is rejected.
- **Validation is all-or-nothing**: any invalid entry → `422` with per-entry reasons and *nothing* is written.
- Rows land in the append-only `observations` table as `OBSERVED` evidence, `subject_type: "asset"`, source `deployment-engine:<engineVersion>`. Corrections are made by appending, never editing.
- `period` (e.g. `2026-W35`) is appended to the source so time-series rows are self-describing.
- Max 500 observations per request.

### The three data rules (enforced, not advisory)
1. **UNKNOWN is never zero.** Don't post a metric you didn't measure. `asset.calls.count: 0` asserts *measured zero calls*.
2. **Rank checks:** `position` is 1–100 or the literal string `"notFound"` (checked, absent from top 100). `101` and `0` are rejected — this codifies the null-handling rule from the pre-registration.
3. **Cadence:** weekly rank checks through week 12, fortnightly to week 26. `role: "unpredicted"` marks Search Console queries no keyword tool predicted — the direct instrument for the community-demand hypothesis (H2).

## 3. What RankRentOS does with the feed
Outcomes join to pre-launch predictions by `experimentId` and settle the four pre-registered analyses: H1 (does A or organic-v1.2 predict ranking speed — primary endpoint `daysToTop20`), H2 (community demand), H3 (standalone vs hub, within matched pairs), H4 (the $300/mo rentability floor). Realized `asset.leadvalue.realized` and `asset.rent.monthly` replace the HUMAN_ASSUMED economics in D and F. The cockpit's zeros become real numbers with no further integration work.

## 4. Regenerating specs
Specs are derived, never hand-edited:
```bash
cd v2 && npx vite-node scripts/generate-handoff-specs.ts
```
Reruns clear stale spec files first. The frozen baseline never changes; a new spec version is cut instead.

**Verified end-to-end:** 401 without auth · manifest and spec pulls · 404 on unknown id · 422 with per-entry reasons for rank-101 / unknown-metric / unknown-id · valid 2-observation post written and confirmed in Supabase (smoke-test rows then removed by precise source predicate so no fake publish date pollutes the evidence store).
