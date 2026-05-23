---
title: "Journey — Admin cancels message draft via Avbryt"
feature: inline-confirm-card-send-message
journey: cancel-send
status: verified-pending-live
verified_at: null
e2e_test: null
created: 2026-05-23
updated: 2026-05-23
module: MODULE_BOTSSON
tags: [journey, botsson, hitl, communication, send-message, cancel-path]
---

# Journey: Admin cancels message draft via Avbryt

**Role:** admin

**Precondition:** Same as happy-send. Card rendered (steps 1-5).

## Happy Path (cancel-as-happy)

1-5. Same as happy-send — get card rendered
2. Admin clicks **Avbryt** (OR presses ESC)
3. Browser POSTs `client_tool_results [{result: '{"proposal_id","action":"cancel"}'}]`
4. `show_proposal_card` browser-side impl emits `inline_confirm_card.cancelled` event (workspace_id, actor_id from threaded profileId, surface:"message", proposal_id)
5. LLM per system prompt: "action: cancel → respond briefly" → "Greit, melding ikke sendt."
6. Card transitions to cancelled state

**Postcondition:**
- ZERO new rows in `channel_message`
- ZERO new rows in `engine_event`
- activity_trail has `inline_confirm_card.shown` (server) + `inline_confirm_card.cancelled` (browser-routed)
- actor_id on cancelled event = real profile_id (NOT workspaceId — verifies Phase 1 fix-3 thread-through works for send_message surface too)

## Error Paths

- **Race click (Avbryt then Send)** — first POST wins, second click no-op (button disabled in loading state)
- **Navigation before resolve** — orphan card, no commit, acceptable V1
- **emit fails** — telemetry lost, cancel proceeds (best-effort)

## Verification

- [ ] Implementation matches steps 1-6
- [ ] E2E test at `apps/e2e/tests/inline-confirm-card-send-message/cancel-send.spec.ts`
- [ ] Manually tested via `op run pnpm dev`
- [ ] activity_trail confirms cancelled + ZERO commit events
- [ ] channel_message NULL query returns 0

**Mark `status: verified` after Pontus runs `close-feature.sh 6` + confirms manual smoke.**
