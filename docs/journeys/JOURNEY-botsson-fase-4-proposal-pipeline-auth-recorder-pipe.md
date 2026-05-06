---
title: "Journey — Voice agent auth bridge + recorder pipe"
feature: botsson-fase-4-proposal-pipeline
journey: auth-recorder-pipe
status: draft
verified_at: null
e2e_test: null
created: 2026-05-06
updated: 2026-05-06
module: Botsson
tags: [journey]
---

# Journey: Voice agent authenticates with stage-engine and recorder captures session

**Role:** system (no human action) — verified end-to-end via voice session start

**Precondition:** JWT minted in 1Password (`op://smartout_ai/stage-engine-local/anon-jwt` + `voice-agent-local/anon-jwt`). Supabase Local running. Stage-engine + voice-agent containers up.

## Happy Path

1. Voice session starts in browser → LiveKit room → voice-agent picks up session → `adapter.ts` calls stage-engine `/agent/chat` with `Authorization: Bearer <jwt>` header AND `workspace_context` field in body (server-mints workspace authority chain per B1: token route → session-context route → context_init → ctx.workspace) → stage-engine returns `200` → `agent_session_recording` row inserted with `session_id`, `workspace_id`, `started_at` → subsequent voice turns append to recorder buffer.

**Postcondition:** `/agent/chat` returns `200` (not `401`). `agent_session_recording` row exists for this session. `agent_session_recording_event` rows append per voice turn.

## Error Paths

- **JWT expired/invalid** → stage-engine returns `401` → voice-agent logs auth error → no recorder row (correct behavior — recorder must NOT be created without auth).
- **`workspace_context` missing from body** → stage-engine returns `400` → voice-agent surfaces error.
- **Recorder write fails after 200 auth** → escalation to `system-agent-coordinator` (post-Phase-A gate) — indicates stage-engine bug separate from auth.

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes — Task 14.1
- [ ] Manually tested with real microphone (Task 14, requires Pontus)
- [ ] Container rebuilt and dist verified (Task 13)

**Mark `status: verified` in frontmatter when all four boxes are checked.**
