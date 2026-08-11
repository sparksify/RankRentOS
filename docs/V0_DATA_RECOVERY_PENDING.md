# V0 DATA RECOVERY — PENDING

Status: **DEFERRED, NOT ABANDONED.** Last updated: 2026-08-11.

## Situation

The original V0 research pipeline wrote its paid research evidence and scored
outputs to directories that are **gitignored** and therefore exist only on the
machine where the V0 scans were run:

- `out/` — scored results (`results.json`, `national-results.json`),
  combined opportunities (`opportunities.json`), and the v0 portfolio
  (`portfolio.json`)
- `data/cache/` — cached SerpAPI responses, including `data/cache/raw/`
  (full raw SERP payloads — paid data, per-query files) and
  `data/cache/demand/` (autocomplete responses)

These directories are believed to reside on a **separate MacBook that is not
currently available**. They are **NOT confirmed missing**. No record counts or
contents are asserted here — the code references them and the git history
shows the scans ran, but the directories have not been inspected from this
environment (they are absent from the cloud clone, as expected for gitignored
paths).

Separately confirmed (2026-08-11, read-only inspection): no accessible
Supabase project contains the V0 `runs`/`markets`/`domains`/`pipeline`
tables, so **the MacBook copy is presumed to be the only copy** of this data.

## Required action when the MacBook becomes available

1. Inspect the RankRentOS working copy on that machine for `out/` and
   `data/cache/` (also check `data/volumes*.json` for any newer-than-repo
   versions, and any `.env` files for keys to rotate).
2. If present, archive before anything else:
   `tar czf rankrentos-v0-data-$(date +%F).tgz out/ data/cache/`
   and store the tarball in at least two locations (e.g., an orphan
   `v0-data-archive` branch or GitHub release asset, plus cloud storage).
3. Record the outcome in this file: archived (with file counts and checksum)
   or genuinely absent.
4. Do NOT delete or modify the originals.

## V2 import architecture obligation

The V2 importer must remain capable of accepting this data whenever it is
recovered. Specifically:

- V0 raw SERP payloads → historic `serpSnapshots` (marked historic; never
  used for selection-time freshness, valid as SERP-history evidence).
- V0 `out/*.json` scores → a v0 prediction-baseline reference dataset for
  future calibration (v0 predicted vs. actual outcomes).
- V0 cached volumes/autocomplete → backfilled `observations` with their
  original collection timestamps (OBSERVED, source-labeled, stale for
  selection but valid for triage/history).

Nothing in V2 may assume this data exists, and nothing in V2 may block on it.
The `observations` model is append-only and timestamped, so late import of
older evidence is inherently safe: it lands *behind* newer observations and
never overrides fresher data.
