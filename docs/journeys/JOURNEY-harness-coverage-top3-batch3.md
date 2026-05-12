---
title: "Journey — harness-coverage-top3-batch3"
feature: harness-coverage-top3-batch3
branch: feat/harness-coverage-top3-batch3
created: 2026-05-12
updated: 2026-05-12
module: ai
status: verified
tags: [e2e, harness, coverage, profile, operations, mission]
---

# Journey — harness-coverage-top3-batch3

## Why

Third wave of Botsson harness E2E coverage. Closes 3 capability gaps: profile (4 tools), operations (5 tools), mission (2 tools).

## Journey 1 — Profile capability E2E

**Precondition:** Stage-engine fresh, Supabase healthy, seed admin profile.

1. BFF call with profile query (`"hvem er jeg"`)
2. `get_profile` fires → workspace/role/department state asserted from DB
3. `get_team`, `get_contract_status`, `search_profiles_by_name` covered
4. PII non-leak verified on every tool response

**Postcondition:** All 4 profile read tools end-to-end verified. defaultAuthority='read_only' means no authority seed needed.

## Journey 2 — Operations capability E2E

**Precondition:** Same. Department session present in seed.

1. BFF call with ops query (`"hvilke oppgaver har jeg"`)
2. `get_my_tasks`, `get_session_info`, `get_department_status` cover read-side
3. `create_deviation` exercises write-side gate path
4. `complete_task` skipped (UUID param trap — LLM cannot extract from natural language)

**Postcondition:** 4 of 5 tools verified. UUID-param-trap pattern documented (same class as schedule colleagues + shift_detail).

## Journey 3 — Mission capability E2E

**Precondition:** Same. Seed workspace may have 0 active missions.

1. BFF call with mission query (`"hva er mine aktive misjoner"`)
2. `get_active_missions` covers personal mission list
3. `get_workspace_roadmap` covers workspace fremover-plan
4. Empty-state returns structured `"Ingen aktive misjoner."` — no hallucination

**Postcondition:** Both mission tools end-to-end verified. N1 (authority denial) skipped — defaultAuthority='read_only', no deny path exists.

**Error paths:** DOCUSEAL_WEBHOOK_SECRET missing in start-local-next-app.sh caused initial 500s. Fixed in wt-10 commit.
