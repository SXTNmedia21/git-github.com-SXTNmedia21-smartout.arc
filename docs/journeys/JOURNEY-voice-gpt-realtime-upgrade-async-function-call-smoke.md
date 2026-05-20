---
title: "Journey — Async function call smoke (long tool call doesn't freeze convo)"
feature: voice-gpt-realtime-upgrade
journey: async-function-call-smoke
status: draft
verified_at: null
e2e_test: null
created: 2026-05-19
updated: 2026-05-19
module: ai
tags: [journey, voice, tool-calling, async, query-smartout]
---

# Journey: Async function call smoke

**Role:** Pontus (sortie operator)

**Precondition:**
- Code changes T1.1 + T1.2 merged with `model: "gpt-realtime"` (async function calls native per OpenAI announce 2025-Q3)
- Dev workspace has data for `query_smartout` to return >50 rows so tool call takes >2s (e.g. large schedule_shift slice or workforce snapshot rebuild)
- LiveKit voice session active, mic + speaker working

## Happy Path

1. User asks Botsson via voice: "Hvor mange vakter har vi neste uke?" → Agent triggers `query_smartout` capability → Tool call begins (expected >2s)
2. Before tool call completes, user interrupts mid-air: "Vent — hva med uka etter også?" → Agent acknowledges interruption verbally without losing tool context → User experiences conversational fluidity
3. Tool result returns → Agent integrates result with interrupted query → Combined response covers both weeks in single answer

**Postcondition:**
- Long tool call did NOT freeze conversation surface
- User interrupt accepted during in-flight tool call
- Tool result still consumed (not dropped) when arrives
- `status: verified` set

## Error Paths

- **Scenario:** Agent freezes during tool call (old preview behavior) → confirms async function call not effective; verify plugin `^1.4.3` actually carries the feature, check `RealtimeModel` constructor for required `async: true` flag
- **Scenario:** Tool result dropped after interrupt → escalate as bug, file follow-up Linear ticket, document in HANDOFF as known limitation
- **Scenario:** Agent calls `query_smartout` twice in parallel (double-dispatch from interrupt) → check voice-tool-resolver dedup logic at `services/voice-agent/src/voice-tool-resolver.ts`
- **Scenario:** Tool call timeout (LiveKit room kicks session at 10s default) → tune room timeout config; document in HANDOFF

## Verification

- [ ] Implementation matches the steps above
- [ ] Manually tested — long `query_smartout` call interrupted mid-flight, conversation stayed fluid, result integrated
- [ ] No regression in `services/voice-agent/__tests__/voice-tool-resolver.test.ts`

**Mark `status: verified` in frontmatter when all three boxes are checked.**
