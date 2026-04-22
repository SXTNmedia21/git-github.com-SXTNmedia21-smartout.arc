---
name: Session ID not exposed to client
description: agent-sdk useAgent swallows session_id from /api/wizard/start response; BFF-side resolution is the required pattern
type: project
---

## The gap

`packages/agent-sdk/src/hooks/useAgent.ts` POSTs `/api/wizard/start` internally and the route returns `{ sessionId, joinUrl, callId }`. The hook only consumes `joinUrl` — `sessionId` is never exposed on the `AgentSession` return type or via callbacks.

`BotssonProvider` has no way to surface the active stage-engine session_id to client components like `BotssonArena` LogView.

## Why: the SDK is off-limits

Per the `botsson-harness-builder` scope rules, `packages/agent-sdk/src/hooks/useAgent.ts` and `packages/agent-sdk/src/types.ts` are **system-agent-coordinator territory** — not mine to edit. Adding `onSessionStart` callback or exposing `sessionId` on `AgentSession` requires coordination.

## How to apply

When building a BFF endpoint that needs to act on Emma's active session from a client caller that does NOT have session_id:

1. Do NOT try to route it through `/flag-session` with a forgeable session_id — that endpoint is strictly admin-scoped.
2. Build a dedicated endpoint. Resolve session_id server-side from the user's most recent `agent_session_recording` turn (last 30 min):
   ```sql
   SELECT session_id FROM agent_session_recording
   WHERE workspace_id = $1 AND profile_id = $2
     AND created_at >= now() - interval '30 minutes'
   ORDER BY created_at DESC LIMIT 1
   ```
3. Emit telemetry with resolved session_id (empty string = no recent session, still log the escalation intent).
4. Do NOT gate on admin/owner role when the caller is a normal user doing user-level actions (flagging, feedback).

Reference implementation: `apps/web/src/app/api/botsson/recorder/flag-log-entry/route.ts` (Phase 2b, 2026-04-22). Emits `recorder.user_flag_submitted`.

## When this becomes unnecessary

If a future SDK change surfaces session_id on the client (additive `onSessionStart` callback to AgentConfig, or a new field on AgentSession return), this pattern can be short-circuited. Endpoints already built using server-side resolution should accept an optional session_id hint and skip the lookup when provided — the telemetry shape stays stable either way.

## Trail

- Introduced 2026-04-22 in commit `4b5e6119` (Phase 2b task 2b-2).
- BotssonArena.tsx line ~18 `flagLogEntry()` consumes this endpoint.
- Architecture rationale lives in route.ts docblock at bottom of file.
