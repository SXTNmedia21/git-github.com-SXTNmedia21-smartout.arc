---
title: "Scrapling Domain — Roadmap"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: scrapling
tags: [scrapling, roadmap, google-places, brreg, serper, lead-research, adr]
mirror: aspirational
last_verified: 2026-05-23
---

# Roadmap — Scrapling

> `mirror: aspirational` — this file holds forward intent, not current state. For what is built, see ARCHITECTURE.md and GAPS-AND-DEBT.md.

## Governing ADRs

| ADR | Title | Status |
|---|---|---|
| [ADR-0270](../../decisions/0270-business-intelligence-capability-godmode.md) | Business Intelligence capability — godmode-only scrapling toolkit | proposed |
| ADR-0275 | Phase E R4 — onboarding tool contract refinement | accepted |

ADR-0270 status `proposed` means the BI capability is shipped but the ADR has not gone through formal council review. Promote to `accepted` before adding new godmode tools.

---

## Delivered (from spec/plan reconciliation)

See GAPS-AND-DEBT.md §Confirmed for full list. Short summary:

- Google Places v1 in `enrich_from_places` (search→details, cost telemetry, Serper fallback)
- `/hospitality-search` endpoint + lead research pipeline (`lead_research.py`)
- 6 godmode tools in `business_intelligence` capability
- 3 onboarding bridge tools (`scrape_website`, `search_company`, `identify_company`)
- 12 telemetry events (6 called + 6 cost)
- `/places-cost` cost-aggregation endpoint + heartbeat alert

---

## Forward Plan

### Near-term

**Cost-cap enforcement** — Currently the heartbeat job alerts at 80% of the $200/mo free tier but does NOT block calls. Forward: add a hard-block gate in `_google_places_enrich` that returns a quota-error response when `alert_active=true` from `/places-cost`, preventing runaway spend.

**Quota-aware routing** — The BRREG fallback `_places_lookup` (inside `smart_brreg_search`) always calls Serper Places. If Google Places is available and under quota, prefer Google here too for consistency. Currently the two Places calls (enrichment path vs BRREG fallback path) use different providers.

**Serper cost metering** — `_log_places_call("serper", "places", ...)` logs `cost=0.0` because Serper bills per credit (not per USD). Wire Serper credit tracking to the `/places-cost` aggregator for real per-call accounting.

**Production smoke against real workspaces** — PLAN Phase 6 tasks (manual smoke against 5 real workspaces: Strøm Mat & Bar, Bårdshaug Vegkro, Yogurt Heaven, Olivia Aker Brygge, Dattebayo) were deferred at handoff. Complete before promoting ADR-0270 to `accepted`.

### Medium-term

**More extractors** — The extractor suite covers PDF/DOCX/XLSX/CSV/image/text/JSON-LD/OGtags. Potential additions: EPUB (for handbook imports), video transcript extraction (Remotion pipeline), PowerPoint (PPTX).

**Public companies enrichment beyond BRREG** — BRREG covers Norwegian-registered entities. Extend to Proff.no scraping for richer firmographic data (annual revenue, employee count, board members).

**TripAdvisor integration** — `POST /tripadvisor` stub returns 501. Forward: Apify TripAdvisor actor integration. Blocked on Apify API key + GDPR review for review aggregation.

### Long-term / Aspirational

**Caching layer** — Enrichment results are ephemeral today. For high-volume onboarding, cache `WorkspaceIntelligence` per org-number in Redis (Upstash) with 24h TTL. Avoids re-fetching Google Places data on retry.

**Streaming enrichment** — The `/enrich` pipeline runs sequentially from the caller's perspective (30–45s timeout). Forward: SSE or WebSocket streaming so the wizard can show partial results as each phase completes.

**Multi-country BRREG** — Currently BRREG only covers Norway. For future expansion to Sweden/Denmark: Bolagsverket API (Sweden) + CVR API (Denmark) as parallel adapters.

**Structured journeys for lead research** — A journey file for the godmode lead-research flow does not exist. Create `JOURNEY-scrapling-lead-research-godmode.md` when the `/hospitality-search` feature is formally accepted.

---

## Plan / Spec Sources (for reconciliation)

| Source | Path | Scope |
|---|---|---|
| Spec | `docs/superpowers/specs/2026-05-04-scrapling-google-places-api.md` | Google Places v1 + BI capability |
| Plan | `docs/plans/PLAN-scrapling-google-places-api.md` | Phase 1–7 task list |
| Handoff | `docs/handoffs/HANDOFF-scrapling-google-places-api.md` | What was built, commits, acceptance |
