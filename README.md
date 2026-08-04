# RankRentOS

Rank-and-rent market intelligence and pipeline OS. Scans (niche × city) markets,
scores organic winnability × demand, checks exact-match domains, estimates
rent/commission value, and tracks each market from watchlist → renting.

## Structure

- `src/` — data pipeline (Node, no framework)
  - `run.js` — main scan: SerpAPI SERP + autocomplete + Trends, content crawls, RDAP domains
  - `volume.js` — DataForSEO search volume + CPC for every market keyword
  - `rescore.js` — volume/CPC gates applied to scores
  - `value.js` — expected monthly $ value + value-weighted rank
  - `deep.js` — keyword-variant verification of top markets
  - `sync.js` — push results to Supabase (`runs`/`markets`/`domains`/`pipeline`)
  - `dashboard.js` — static HTML report generator (artifact)
- `app/` — Next.js app (the SaaS UI), reads Supabase, writes pipeline stages
- `data/` — niche & city seed tables, cached volumes/trends

## Run a scan

```bash
node src/run.js            # full scan (SERP cached to data/cache/)
node src/volume.js         # volume + CPC (cached)
node src/rescore.js        # apply volume gates
node src/value.js          # value model
node src/deep.js --top 30  # verify top markets
node src/sync.js --label "my run"
```

## App

```bash
cd app && npm install && npm run dev   # http://localhost:3311
```

Env (never committed): `.env` in root needs `SERPAPI_KEY`, `DATAFORSEO_AUTH`,
`SUPABASE_URL`, `SUPABASE_ANON_KEY`. The app needs `APP_PASSWORD` (login) —
set in `app/.env.local` locally and in Vercel project env for production.

## Deploy (Vercel)

Root directory: `app/`. Set env vars `APP_PASSWORD` (+ optional `APP_SECRET`).
Domain: www.rankrentos.com → add in Vercel → CNAME per Vercel instructions.
