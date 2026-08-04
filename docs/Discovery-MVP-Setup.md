# Discovery MVP — Setup

## Local development

```bash
git clone git@github.com:sparksify/RankRentOS.git && cd RankRentOS
npm install            # pipeline deps (tsx, vitest, typescript)
npm test               # 34 tests, no network needed
npm run pipeline       # ingest → qualify → score → select → blueprints (reads data/ + evidence/)

cd app && npm install && npm run dev   # http://localhost:3311
```

## Environment variables

Root `.env` (pipeline, never committed):
```
SERPAPI_KEY=            # localized SERPs, autocomplete, trends
DATAFORSEO_AUTH=        # base64 login:password — volumes/CPC + SERPs
NAMECHEAP_API_USER=     # optional final-verification registrar
NAMECHEAP_API_KEY=
NAMECHEAP_CLIENT_IP=    # must be whitelisted in Namecheap
SUPABASE_URL=https://drnsdklutxuohdpkjaou.supabase.co
SUPABASE_ANON_KEY=      # or SUPABASE_SERVICE_KEY for loads
```

App (`app/.env.local` locally; Vercel project env in production):
```
APP_PASSWORD=           # login password — overrides the committed bootstrap default; SET THIS AND ROTATE
APP_SECRET=             # cookie-hash salt
SUPABASE_URL=
SUPABASE_ANON_KEY=
```

**Security notes**
- A bootstrap `APP_PASSWORD` default is committed (`app/lib/auth.ts`) so the first deploy works without env access: `prosper-batch1-2026`. Set the env var in Vercel and change it immediately.
- The Supabase anon key is embedded as a server-side fallback in `app/lib/db.ts`; it grants full access to `rros_*` tables (permissive RLS, single-admin design). Keep the repo private; move to env-only + restrictive policies when convenient.
- Pre-existing issue in the host Supabase project: the original 11 `ai-employee-os` tables have **RLS disabled** entirely — worth fixing separately.

## Database

Schema lives in `db/migrations/` (0001 core schema, 0002 DB-side corpus loader + qualification). Applied to the `ai-employee-os` Supabase project (see Architecture decision log for why, and the move path to a dedicated project). Corpus loading: insert the four raw-evidence payload rows, then `select rros_load_corpus(); select rros_qualify();`.

## Production deployment (Vercel)

Project `rankrent-os` (team `steves-projects-c6a4efb3`), app root `app/`, framework Next.js. Deploys via Vercel MCP file-tree deploy or git integration. After deploying new pipeline output, load it: `GET /api/admin/load?token=<APP_PASSWORD>` (applies `app/data-snapshot/db-rows-*.json`, idempotent).
