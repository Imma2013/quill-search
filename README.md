# Quill

Quill is an evidence-first AI search engine. It writes short editorial answers, but renders key quotations from the source text stored by the backend instead of trusting model-generated quotations.

## Services

- `apps/web`: Next.js frontend for Vercel.
- `apps/api`: Express API for Render. It owns SearXNG, OpenRouter, caching, and rate limits.
- `convex`: schema and functions for optional search-history persistence and cache metadata.

## Local setup

1. Copy `apps/api/.env.example` to `apps/api/.env` and set `SEARXNG_URL` plus `OPENROUTER_API_KEY`.
2. Copy `apps/web/.env.example` to `apps/web/.env.local` and set `NEXT_PUBLIC_API_URL`.
3. Install dependencies from this directory with `npm install`.
4. Start the API with `npm run dev:api` and the web app with `npm run dev:web`.

Never put the OpenRouter key in a `NEXT_PUBLIC_*` variable, the browser, Convex, or a committed file.

## Deployment

Deploy `apps/web` to Vercel and `apps/api` to Render. SearXNG must be a private service reachable only from the Render API. Set `ALLOWED_ORIGIN` on the API to the Vercel production URL and `NEXT_PUBLIC_API_URL` on Vercel to the Render API URL.

The optional DuckDuckGo and Playwright extractor endpoints remain disabled unless their internal URLs are configured. They are fallbacks for discovery and JavaScript-rendered public pages, not unrestricted browser agents.
