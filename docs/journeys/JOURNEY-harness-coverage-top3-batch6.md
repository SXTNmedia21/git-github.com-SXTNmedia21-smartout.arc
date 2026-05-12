---
title: "Journey — harness-coverage-top3-batch6"
feature: harness-coverage-top3-batch6
branch: feat/harness-coverage-top3-batch6
created: 2026-05-12
updated: 2026-05-12
module: ai
status: verified
tags: [e2e, harness, coverage, communication, business-intelligence, journey]
---

# Journey — harness-coverage-top3-batch6

## Why

Sixth wave of Botsson harness E2E coverage. Closes 3 capability gaps: communication (8 tools — count higher than coverage matrix said), business-intelligence (6 tools), journey (4 tools). Total +18 tools.

## Journey 1 — Communication capability E2E

**Precondition:** Stage-engine fresh, seed admin profile.

1. BFF call per tool — 8 tools registered (get_conversations, get_unread_count, get_channel_context, compose_shift_briefing, compile_day_brief, compile_preclose_summary, search_knowledge, send_message)
2. Read-only tools (first 7) cover BFF + classifier + tool_call recording + activity_trail
3. `send_message` mutation: gate path + emit verified
4. Graceful degradation: compile_day_brief + compile_preclose_summary skip if no active department in seed

**Postcondition:** All 8 communication tools verified.

## Journey 2 — Business-intelligence capability E2E

**Precondition:** Same. Scrapling availability optional.

1. BFF call per tool — 6 tools (enrich_company_intelligence, search_brreg, lookup_brreg, scrape_website, find_hospitality_businesses, generate_company_copy)
2. 4 readOnly-tier, 2 suggest-tier
3. Pipe verification independent of scrapling response quality
4. M1 verifies gate_action NEVER called by BI tools (BI is pure data fetch, no mutation)

**Postcondition:** All 6 BI tools verified. Scrapling unreachable does not fail tests.

## Journey 3 — Journey capability E2E (runtime)

**Precondition:** Same. NOT journey-authoring (separate capability).

1. BFF call with runtime journey query
2. `run_dev` covers dev journey execution
3. `publish_mission` writes engine_missions row with is_active=false (ADR-0194 Gate)
4. `publish_guide` writes journey_guide row (is_public=false default)
5. `run_guided` covers graceful no_active_mission path (happy path requires separate activateMissionAction call out of scope)

**Postcondition:** All 4 journey tools verified. D1/D2 DB integrity checks confirm engine_state.context.capability + engine_stages.stage_id values.

**Error paths:** N1 voice path skipped. N2 cross-workspace soft-skip on FK constraints. D1/D2 soft-skip if preceding tool returned structured error.
