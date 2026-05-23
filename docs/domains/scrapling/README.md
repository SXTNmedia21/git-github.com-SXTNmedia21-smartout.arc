---
title: "Scrapling Domain — README"
status: done
updated: 2026-05-23
created: 2026-05-23
domain: scrapling
tags: [scrapling, research, scraping, brreg, google-places, serper, godmode, python, fastapi]
mirror: verified
last_verified: 2026-05-23
---

# Scrapling Domain

> Python research/scraping service (port 8000) + TS BFF bridge. Adapts BRREG, Google Places, Serper, and generic web scraping for the Smartout onboarding pipeline.

## Build State

| Layer | Status |
|---|---|
| Python service (`services/scrapling/`) | Live — FastAPI, 10 endpoints verified |
| Extractors (PDF/DOCX/XLSX/CSV/image) | Live — `extractors/` package, 8 extractors |
| BRREG smart-search | Live — Jaro-Winkler scoring + relax-sequence |
| Google Places v1 enrich | Live — search→details pipeline in `intelligence.py` |
| Serper fallback | Live — falls back on 429/5xx from Google |
| `/hospitality-search` lead research | Live — `lead_research.py`, Google Places + email-scrape |
| BFF bridge (onboarding/tools.ts) | Live — 3 tools (`scrape_website`, `search_company`, `identify_company`) |
| business_intelligence capability | Live — 6 tools, godmode-only (ADR-0270) |
| Telemetry | Live — 12 events in registry.ts:9889 |
| Cost observability (`/places-cost`) | Live — reads scrapling.log, heartbeat alert |

## Reading Order

1. **OVERVIEW.md** — what this domain does and why
2. **ARCHITECTURE.md** — L1–L5 layered code map
3. **DATA-MODEL.md** — `company_scraped_data` table + telemetry registry
4. **USER-FLOWS.md** — upstream consumer journey links
5. **ROADMAP.md** — forward plan + ADR references
6. **GAPS-AND-DEBT.md** — deviations, gaps, overlap, debt
7. **E2E-COVERAGE.md** — test matrix

## Agent Guardrails

**Service access:** The scrapling service is internal-only. Never exposed publicly — `http://scrapling:8000` on the Docker network, `https://scrape.smartout.ai` via Caddy from inside the droplet. No public Caddy route exists.

**Shared secret:** Auth uses `SCRAPLING_AUTH_TOKEN` (Bearer header). The env var must be the same value in both the Python service and the TS BFF callers. The BFF sets it via `process.env.SCRAPLING_AUTH_TOKEN`. The DEV_API_KEY mismatch trap (commit `9e9508a45`): after a DB reset, `DEV_API_KEY` (was `…/api_key2`) diverged from `STAGE_ENGINE_API_KEY` (`api_key`), causing AUTH_FAILED on extract. Fix: align both to `api_key` in `.env.template`. Never insert `platform_api_key` rows manually.

**BFF bridge is THE contract:** TypeScript code NEVER calls scrapling directly except through the two BFF bridge locations:
1. `packages/ai/src/capabilities/onboarding/tools.ts` — `scraplingPost()` + 3 wizard tools (lines 60–727)
2. `packages/ai/src/capabilities/business-intelligence/tools.ts` — `scraplingPost()` + 6 godmode tools (lines 43–477)

Do NOT call scrapling from any other TS location.

**Godmode-only access for business_intelligence:** `toolAuthPattern: "direct_admin"` per ADR-0270. The `business_intelligence` capability (6 tools) is restricted to platform-admin surfaces. The 3 onboarding bridge tools (`scrape_website`, `search_company`, `identify_company`) are available in the onboarding flow to any admin.

**Cost telemetry is mandatory:** Google Places API costs real money ($0.005/search, $0.017/detail). Every scraping tool call emits `called` + `cost` events. The `/places-cost` endpoint aggregates from logs. Heartbeat job `google-places-quota-check` alerts at 80% of the $200/month free tier. Never add Google Places calls without cost telemetry.

**Voice is blocked:** All scrapling tools reject `ctx.channel === "voice"` per ADR-0078. Scrapling is chat-only.

**No Smartout DB writes:** Scrapling tools are read-only proxies. Enrichment output is ephemeral (returned to chat). `company_scraped_data` on the `company` table is the only DB persistence path, written via `create_workspace_transaction` RPC during onboarding finalization — not by any capability tool (ADR-0173).

**12-event telemetry registry:** `business_intelligence.*` namespace. 6 called-events → posthog+logger+activity_trail. 6 cost-events → posthog+logger+engine_event. See `packages/telemetry/src/registry.ts:9889`.

**Python service is blocking I/O:** `scrapling.Fetcher.get()` is synchronous. `enrich_from_scrape` wraps it in `asyncio.to_thread`. Never call Fetcher directly in an async context.

**SCRAPLING_API.md is source-level reference:** `docs/reference/SCRAPLING_API.md` is a raw endpoint reference (`mirror: source`). It predates this domain spine (2026-03-10) and is partially stale (auth section doesn't reflect Bearer token). The spine (this domain) is the authoritative compiled view.
