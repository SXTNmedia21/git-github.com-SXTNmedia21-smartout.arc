---
title: "Journey — harness-coverage-top3-batch5"
feature: harness-coverage-top3-batch5
branch: feat/harness-coverage-top3-batch5
created: 2026-05-12
updated: 2026-05-12
module: ai
status: verified
tags: [e2e, harness, coverage, engine-world, personal, training]
---

# Journey — harness-coverage-top3-batch5

## Why

Fifth wave of Botsson harness E2E coverage. Closes 3 capability gaps: engine-world (3 tools), personal (5 tools), training (3 tools). Total +11 tools.

## Journey 1 — Engine-world capability E2E

**Precondition:** Stage-engine fresh, Phase 1 migration applied (`20260526000000_engine_world_phase_1.sql`).

1. BFF call with engine-world query (`"vis world state for schedule"`)
2. `read_surface` + `read_surface_class` cover read-side
3. `report_observation` exercises write-side with ADR-0151 workspace scope
4. DB sanity: `engine_world_state` table query matches return

**Postcondition:** All 3 engine-world tools verified.

## Journey 2 — Personal capability E2E

**Precondition:** Same. Seed admin profile.

1. BFF call with personal query per tool
2. `add_note` writes `engine_memory` (memory_type='general')
3. `create_task` writes `personal_task`
4. `set_reminder` writes `engine_delayed_trigger`
5. `update_setting` writes `engine_memory` (memory_type='preference')
6. `get_history` reads recent activity (read-only, no activity_trail emit)

**Postcondition:** 5 personal tools verified. A16 documented as gap `personal-history-activity-trail-emit` (routes to posthog+logger only).

## Journey 3 — Training capability E2E

**Precondition:** Same. SEED_PROFILE_ID has 0 protocol_assignment rows (natural empty-state).

1. BFF call with training query
2. `get_my_training_status` (readOnlyTools tier)
3. `get_next_protocol` (readOnlyTools tier)
4. `get_team_readiness` (suggestTools tier — authority seeded in beforeAll, restored in afterAll)
5. DB sanity verifies seed preconditions independently

**Postcondition:** All 3 training tools verified. Authority lifecycle non-destructive.

**Error paths:** N1 voice path skipped (ADR-0163 chat-only). A9–A12 conditional skip if authority seed fails (diagnostic, not hard-fail).
