---
title: "Scrapling Domain — Gaps and Debt"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: scrapling
tags: [scrapling, gaps, debt, deviations, overlap]
mirror: verified
last_verified: 2026-05-23
---

# Gaps and Debt — Scrapling

## Spec/Plan Reconciliation

### Confirmed (spec intent matches code)

| Spec claim | Code evidence |
|---|---|
| Google Places v1 `enrich_from_places` replaces Serper as primary | `intelligence.py:1406` — `if GOOGLE_PLACES_API_KEY: _google_places_enrich(...)` |
| Serper fallback on 429/5xx | `intelligence.py:1437` — `except _GooglePlacesQuotaError: logger.info("fallback → Serper")` |
| `GOOGLE_TYPE_CUISINE_MAP` 25+ keywords | `intelligence.py:250` — 25 entries verified |
| `GOOGLE_PRICE_LEVEL_MAP` 5 enum → 4 buckets | `intelligence.py:240` — all 5 values present |
| `editorialSummary.text` → `menu_description` (≥30 char guard) | `intelligence.py:1381` — `if len(editorial_text) >= 30` |
| `[places.api_call]` structured cost log line | `intelligence.py:220` — `_log_places_call()` helper with key=value format |
| `GET /places-cost` endpoint | `main.py:806` — full implementation with log-grep + JSON response |
| Heartbeat job `google-places-quota-check [cooldown: 24h]` | In second-brain vault (outside this repo), confirmed by handoff |
| 6 godmode tools in `business_intelligence` capability | `tools.ts` (business-intelligence) — all 6 present and wired |
| 12 telemetry events (6 called + 6 cost) | `registry.ts:9889–9949` — all 12 confirmed |
| `/hospitality-search` endpoint + lead_research.py | `main.py:626`, `lead_research.py:324` — full pipeline |
| 3 onboarding bridge tools | `onboarding/tools.ts:579,640,694` — all 3 present |

**Spec/Plan reconciliation: 14 confirmed / 0 deviations / 3 gaps (below)**

### Deviations (code did it differently)

**None material.** The spec and code are well-aligned. One minor implementation detail:

- Spec (`:26`): "Keep Serper for `_places_lookup` (BRREG fallback)". Code confirms this — `_places_lookup` (`intelligence.py:561`) calls Serper only, while `enrich_from_places` uses Google-first. Confirmed, not a deviation.

### Gaps (spec/plan not fully implemented)

**GAP-1: Phase 6 prod smoke deferred**
Spec: manual smoke against 5 real prod workspaces (Strøm Mat & Bar, Bårdshaug, Yogurt Heaven, Olivia Aker Brygge, Dattebayo). PLAN Phase 6 tasks unchecked. HANDOFF status: `ready_to_close` with phase 6 marked as deferred.
- File: `docs/plans/PLAN-scrapling-google-places-api.md` (Phase 6 tasks)
- Roadmap: "Production smoke against real workspaces"

**GAP-2: ADR-0270 status is `proposed`, not `accepted`**
6 godmode tools are live but the formal council review for ADR-0270 has not completed.
- File: `docs/decisions/0000-decision-log.md:200`
- Roadmap: "Promote to accepted before adding new godmode tools"

**GAP-3: TripAdvisor integration stub**
`POST /tripadvisor` (`main.py:508`) returns `501 Not Implemented`. Spec mentions Apify actor. Not a regression — it was never built.
- Roadmap: "TripAdvisor integration" (long-term)

---

## Overlap Edges

Scrapling's BFF bridge code lives in two capability files that belong to adjacent domains. This is intentional (the contract lives with the consumer, not the service) but must be documented.

| Edge | Domain A | Domain B | Shared surface | Recommendation |
|---|---|---|---|---|
| O1 | scrapling | onboarding-wizard | 3 BFF bridge tools in `onboarding/tools.ts:579–727` + `scraplingHeaders/scraplingPost` at :60–91. The TS contract lives in the onboarding capability, not the scrapling domain. | **keep** — contract-with-consumer pattern. Scrapling domain documents the contract; onboarding domain owns the file. Never move the tool code into scrapling domain. |
| O2 | scrapling | agent-harness | `business_intelligence` capability is dispatched by the agent-harness router. Gate/route logic in agent-harness; tool execution in scrapling's BFF bridge. | **keep** — agent-harness provides the gate; scrapling provides the tools. Clear author/consumer. |
| O3 | scrapling | botsson | Godmode Botsson persona invokes `business_intelligence` capability. Botsson owns persona access; scrapling owns tool logic. | **keep** — botsson surfaces the tools; scrapling domain owns tool code. ADR-0270 governs. |
| O4 | scrapling | billing | 12 cost-events routed to `engine_event` enable future heartbeat-based cost-cap alerting → billing metering. Currently no billing integration. | **keep** — billing is a future consumer. No current shared tables. |
| O5 | scrapling | core-structure | `company.raw_scraped_data` + `company.onboarding_status` added by scrapling migration `00008`. Core-structure owns the `company` table. Scrapling enriches two columns. | **keep** — standard "enriches but doesn't own" pattern. Core-structure domain should note the column pointer in DATA-MODEL.md. |
| O6 | scrapling | onboarding-wizard | `/api/workspace-intelligence` Next.js route handler (in `apps/web/`) calls scrapling `/enrich` + `/generate` directly for Step 3. This is a second TS→scrapling call path alongside the capability tools. | **keep** — the route handler is an onboarding-wizard concern (pre-auth, non-LLM path). No ownership conflict. Note as edge. |

---

## Debt

**DEBT-1: Two duplicate worklog paths**
`docs/worklogs/WORKLOG-scrapling-extract.md` and `docs/reports/worklogs/WORKLOG-scrapling-extract.md` both exist. Content may differ. One is stale. Resolution: check content, archive the stale one. Not blocking.

**DEBT-2: DEV_API_KEY alignment trap**
After DB reset, `DEV_API_KEY` (configured as `…/api_key2`) diverged from `STAGE_ENGINE_API_KEY` (`api_key`), causing AUTH_FAILED on scrapling extract calls. Fix: align both to `api_key` in `.env.template`. Commit `9e9508a45` resolved this. The trap is documented but could recur if `.env.template` drifts. Add to pre-flight runbook.

**DEBT-3: `SCRAPLING_API.md` reference doc partially stale**
`docs/reference/SCRAPLING_API.md` (created 2026-03-10) lists callers as: `gather-workspace-intelligence` EF + `analyze-setup-documents` EF + Next.js `/api/scrape/raw` + `scrape-raw-data` EF. Auth section says "None" (pre-dates Bearer token). Several new endpoints (`/brreg-search`, `/brreg-lookup`, `/hospitality-search`, `/enrich`, `/generate`, `/places-cost`) are missing. The domain spine (this file + ARCHITECTURE.md) supersedes it for verified architectural facts. The reference doc should be updated to add the Bearer token auth and the 5 missing endpoints. Low priority — the spine is the authoritative source for agents.

**DEBT-4: `SCRAPLING_API.md` frontmatter missing domain cross-ref**
`docs/reference/SCRAPLING_API.md` lacks `domain: scrapling` and `mirror: source` frontmatter. Should be added without changing status/content.

**DEBT-5: ADR-0270 status `proposed` — council review pending**
The 6 godmode tools are live but ADR-0270 has not been council-reviewed. No new godmode tools should be added until ADR-0270 reaches `accepted`.
