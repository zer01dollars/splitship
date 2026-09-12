# SplitShip — agent conventions

## Context.dev

Server-side web data via [Context.dev](https://docs.context.dev). Use for discovery/automation at scale (search, scrape, sitemap → Batch for large jobs).

| Item | Value |
|------|--------|
| Env var | `CONTEXT_DEV_API_KEY` (see `.env.example`; never commit `.env`) |
| Wrapper | `src/context/client.js` — **all** Context.dev calls go through this module |
| Goal helper | `src/context/discoverApps.js` — “many apps” discovery via web search |
| Prove script | `node scripts/prove-context.js` (1 live call; costs credits) |
| Base URL | `https://api.context.dev/v1` |

### Endpoints in use

| Helper | Endpoint | Why | Docs |
|--------|----------|-----|------|
| `webSearch` | `POST /web/search` | Find many apps/tools in one call | https://docs.context.dev/api-reference/web-scraping/search |
| `scrapeMarkdown` | `GET /web/scrape/markdown` | Pull one URL to LLM-ready Markdown | https://docs.context.dev/api-reference/web-scraping/markdown |
| `scrapeSitemap` | `GET /web/scrape/sitemap` | Enumerate many URLs before Batch | https://docs.context.dev/api-reference/web-scraping/sitemap |

For hundreds+ of URLs use Batch (`POST /batch/submit`) — https://docs.context.dev/guides/scrape-websites-in-batches — not a scrape loop.

### Rules

- Never hardcode the API key; never ship it in the Action browser/client path.
- Unit tests mock the wrapper; do not hit the live API in `npm test`.
- On `429`, honor `Retry-After`; retry `408`/`5xx` with bounded backoff (see `withRetry`).
- Prefer official SDK `context.dev` over raw `fetch`.

## SplitShip Action

Polar-licensed GitHub Action — release notes for DEV / customer / LinkedIn / X. See README.
