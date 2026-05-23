---
title: "Journey — Admin cancels announcement draft via Avbryt"
feature: inline-confirm-card-phase1
journey: cancel-publish
status: draft
verified_at: null
e2e_test: null
created: 2026-05-23
updated: 2026-05-23
module: MODULE_BOTSSON
tags: [journey, botsson, hitl, communication, announcement, cancel-path]
---

# Journey: Admin cancels announcement draft via Avbryt

**Role:** admin

**Precondition:**
- Identical setup to happy-publish journey
- Card already rendered inline per happy-publish steps 1-5

## Happy Path (cancel-as-happy)

1. Admin types: `"Lag en kunngjøring om brylluppet"` → LLM → `publish_announcement(confirm:false)` → descriptor → `show_proposal_card` → card rendered (steps 1-5 from happy-publish)
2. Admin reads draft, decides "ikke nå" (e.g. wrong audience, wrong wording, changed mind)
3. Admin clicks **Avbryt** button (OR presses **ESC** while card has focus — parity with help-takeover-kit)
4. Browser POSTs `client_tool_results [{tool_call_id, result: JSON.stringify({proposal_id, action:"cancel"})}]` → stage-engine resumes LLM
5. `show_proposal_card` client-tool impl (browser-side) emits `inline_confirm_card.cancelled` event with `{workspace_id, actor_id, surface, proposal_id}` via emit() → server-side write to activity_trail
6. LLM reads tool-result `{action:"cancel"}` → per system-prompt instruction: `"action: cancel → respond briefly, do not retry"` → LLM responds: `"Greit, kunngjøring avlyst."` (or similar Norwegian terse acknowledgment)
7. Card transitions to cancelled state (`mode: "cancelled"`, opacity 0.4, scale 0.97, red tint ring-2 ring-destructive/40 flash 300ms)

**Postcondition:**
- ZERO new rows in `channel_message` (no RPC fired)
- ZERO new rows in `engine_event` (no channel.message.sent)
- 1 new row in `activity_trail` with `event_name = "inline_confirm_card.cancelled"` + `workspace_id` + `actor_id` non-null
- 1 new row in `activity_trail` with `event_name = "inline_confirm_card.shown"` (from draft phase)
- PostHog received `inline_confirm_card.shown` + `inline_confirm_card.cancelled` events
- Conversation in BotssonChat continues — admin can immediately ask for a different announcement

## Error Paths

- **Admin clicks Avbryt then immediately Bekreft (race)** → first POST wins; card disables ALL buttons on first click (`mode: "loading"` → `mode: "cancelled"`); second click is no-op (button disabled). Optimistic UI prevents double-resolution.
- **Browser navigation away before resolve** → `client_tool_calls` is conversation state in-flight; on next session load via BotssonHistory, the card appears as resolved-orphan (not actionable). No commit fires. Acceptable V1 behavior (Phase 3 may add resume-pending-proposals).
- **emit fails (network blip)** → telemetry event lost but cancel proceeds. Activity_trail row may be missing — accept as best-effort telemetry V1. Phase 2 may add emit retry queue.
- **LLM responds verbosely instead of terse** → not a bug (depends on LLM choice). System prompt instructs terse but cannot guarantee.

## Verification

- [ ] Implementation matches steps 1-7 above
- [ ] E2E test at `apps/e2e/inline-confirm-card-phase1/cancel-publish.spec.ts` passes
- [ ] Manually tested via `op run --env-file=.env.template -- pnpm dev` — verify ESC also cancels
- [ ] activity_trail query confirms cancelled event + ZERO commit events: `SELECT event_name, count(*) FROM activity_trail WHERE properties->>'proposal_id' = '<id>' GROUP BY event_name`
- [ ] channel_message NULL query: `SELECT count(*) FROM channel_message WHERE client_message_id = '<proposal_id>'` returns 0

**Mark `status: verified` in frontmatter when all five boxes are checked.**
