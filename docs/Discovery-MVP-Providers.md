# Discovery MVP — Providers & Cost Report

## Provider matrix

| Provider | Adapter | Status | Used this cycle | Cost basis |
|---|---|---|---|---|
| DataForSEO (volume/CPC) | `providers/serp/dataforseo.ts` | Live-ready (needs `DATAFORSEO_AUTH`) | Corpus imported (1,392 kw observed 2026-08-03) | ~$0.05/1k keywords |
| DataForSEO (SERP) | same file | Live-ready | — | ~$0.002/SERP |
| SerpAPI (SERP/autocomplete/trends) | `providers/serp/serpapi.ts` | Live-ready (needs `SERPAPI_KEY`) | Trends weights imported (2026-07-17) | ~$0.015/search |
| Web search (harness) | `providers/serp/evidence-import.ts` | Session channel | **30 SERP-proxy snapshots** | $0 |
| Vercel registrar | `providers/domains/evidence-import.ts` | Session channel (MCP) | **269 domains verified 2026-08-04** | $0 to check; $11.25/yr to register |
| RDAP (Verisign) | `providers/domains/rdap.ts` | Live-ready (free, no key) | blocked by session egress | $0 |
| Namecheap | `providers/domains/namecheap.ts` | Needs API creds + IP whitelist | not connected to this session | $0 to check |
| US Census ACS | `providers/census.ts` | Live-ready (free) | blocked by session egress | $0 |

Provider payloads never leak past adapters; evidence-import adapters treat out-of-band collection (harness tools, manual exports) as first-class providers with named provenance and confidence discounts.

## Cost report — production run 2026-08-04

| Item | Requests | Cost |
|---|---|---|
| Qualification (owned observations) | 1,392 markets | $0.00 |
| Deep research (web-search proxy) | ~40 searches / 30 markets | $0.00 |
| Domain verification (Vercel registrar) | 269 domains / 27 calls, 1 price-check 502 retry-covered | $0.00 |
| Keyword corpus (already owned, v0 spend) | 1,392 keywords | ~$0.07 (historical) |
| **Total new provider spend** | | **$0.00** |
| Pending (recommended before build) | 30 localized SERPs | ~$0.06–0.45 |
| Pending (domain registration, 10 primaries) | 10 × $11.25 | $112.50 |

## Budget controls
`rros_jobs.budget_usd` + `actual_cost_usd`; per-run caps in `src/core/config.ts` (`BUDGET_DEFAULTS`): max total $25, ≤30 deep-research candidates, ≤5 keywords/market, ≤3 SERP calls/market. `assertBudget()` throws before any paid call that would exceed the cap. Preference order enforced by the pipeline: fresh owned facts → stale owned facts (flagged) → free evidence → paid research on promising candidates only. Freshness windows (config): domains verify-before-recommend · SERP 30d · reviews/GBP 30d · keywords 90d · census by dataset year · unknown-dated v0 data stale until verified.
