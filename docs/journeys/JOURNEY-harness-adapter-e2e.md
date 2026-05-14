---
title: "HarnessAdapter chat E2E"
status: in_progress
updated: 2026-05-15
created: 2026-05-15
module: harness
tags: [e2e, playwright, adr-0327]
predecessor: harness-phase4-voice
---

# JOURNEY-harness-adapter-e2e

> ADR: `docs/decisions/0327-harness-adapter-unified-llm-consumer.md`
> Spec: `apps/e2e/tests/harness-adapter-chat-client-tool.spec.ts` (commit 22c6471e4)
> Predecessor: `docs/journeys/JOURNEY-harness-phase4-voice.md`

This sortie adds a Playwright E2E spec that proves the wired-up HarnessAdapter chat pipe — from BotssonProvider tool registration through BFF forwarding through stage-engine resolution and back to a final LLM reply that consumed the real tool result. Phase 3 and 3.5 unit-tested each layer independently; this spec drives the full stack together in a running environment.

The "users" in these journeys are operators — developers or QA running the spec to confirm the pipe works before or after a deploy. End-user experience (typing in BotssonChat and reading a tool-informed reply) is the observable outcome, but the spec drives it programmatically.

---

## Journey: Operator runs HarnessAdapter chat E2E spec

**Role:** Operator (developer / QA)
**Surface:** `apps/e2e/tests/harness-adapter-chat-client-tool.spec.ts`

**Precondition:**
- Supabase Local is running: `npx supabase start`
- stage-engine container rebuilt from latest code (container must have been started AFTER the latest commit — A1 enforces this)
- stage-engine started with `HARNESS_ADAPTER_CHAT=true` in its env (via `infra/.env.local` or `docker-compose.override.yml`)
- `infra/.env.local` contains non-`op://` values for `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `OPENROUTER_API_KEY`, `STAGE_ENGINE_API_KEY`
- Next.js dev server running on port 3060 (via `op run --env-file=.env.template -- pnpm --filter web dev` or with `SKIP_WEB_SERVER=1` if already running)
- `apps/e2e/.env.local` contains `HARNESS_ADAPTER_CHAT=true`

**Steps:**

1. Operator adds `HARNESS_ADAPTER_CHAT=true` to `infra/.env.local` and `apps/e2e/.env.local`.
   → Both files exist and contain the flag.

2. Operator rebuilds stage-engine container:
   ```bash
   cd infra
   docker compose -f docker-compose.yml -f docker-compose.override.yml \
     --env-file ../.env.template --env-file .env.local \
     build --no-cache stage-engine
   ```
   → Docker outputs build layers; stage-engine image tagged with latest source.

3. Operator restarts stage-engine container so the rebuilt image runs:
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.override.yml \
     --env-file ../.env.template --env-file .env.local \
     up -d stage-engine
   ```
   → Container reports healthy. `HARNESS_ADAPTER_CHAT=true` visible via `docker inspect`.

4. Operator runs the spec:
   ```bash
   cd /path/to/smartout.ai
   pnpm --filter @smartout/e2e exec playwright test harness-adapter-chat-client-tool.spec.ts
   ```
   → Playwright boots, logs into `/dashboard/notifications` as seed admin, runs A1–A8 then N1.

5. Operator observes test output.
   → With flag ON: A1–A8 pass, N1 is reported as skipped (expected — cannot flip env mid-run).
   → With flag OFF: A1 may pass, A2 skips the rest of the positive path, N1 runs and passes.

**Postcondition:**

- **All green (A1–A8 pass, N1 skipped):** The full pipe is verified. `getUnreadCount` registered by the notifications page bridge, forwarded in `client_tools[]` to the BFF, received by stage-engine, returned as `client_tool_calls[]`, executed by the browser, re-submitted as `client_tool_results[]`, consumed by the LLM, and echoed back as a reply mentioning a numeric count or the word "ulest". `activity_trail` has a `botsson.tool_invoked` row for the tool.
- **Any test red:** The pipe is broken at the layer identified by the failing assertion — see error paths below and the pass/fail interpretation table.

**Error paths:**

**A1 fails — stage-engine container is stale:**
The container was started before the latest commit. The freshness check (`assertStageEngineContainerFresh`) compares container start time against `git log` timestamp. Fix: rebuild and restart per steps 2–3 above.

**A2 fails — HARNESS_ADAPTER_CHAT flag not propagating:**
Either `apps/e2e/.env.local` is missing the flag (the E2E process-level guard reads from there) OR the container env is not set. Verify both: `echo $HARNESS_ADAPTER_CHAT` in the E2E process and `docker inspect <container> | grep HARNESS` for the container. Both must be `true`.

**A3 fails — page rendering issue:**
`/dashboard/notifications` did not load or the `<h1>` heading / BotssonChat textarea did not appear within 15s. This is not a pipe problem — it is a Next.js server or database issue. Check Next.js dev server logs and Supabase Local status. Escalate as page-render regression, not harness issue.

**A4 fails — BotssonProvider tool aggregation broken:**
The outbound BFF request did not include `client_tools[]` with `getUnreadCount`. The `NotificationsToolsBridge` at `apps/web/src/app/dashboard/notifications/_tools/notifications-tools-bridge.tsx` calls `useRegisterTools("notifications", tools)`, which should populate BotssonProvider's registry before BotssonChat assembles the request. Check: (a) the bridge component mounts on the notifications page, (b) `useRegisterTools` is called with the correct scope and tool list, (c) `BotssonChat.tsx`'s submit handler reads `botssonTools` from BotssonProvider context.

**A5 / A6 fails — BFF `/api/botsson/chat` not forwarding `client_tools` or stage-engine not returning `client_tool_calls`:**
The BFF must accept `client_tools[]` in the request body, forward it to stage-engine, and surface `client_tool_calls[]` from the stage-engine response. Check: (a) `apps/web/src/app/api/botsson/chat/route.ts` Zod schema includes `client_tools` field, (b) stage-engine `/agent/chat` handler has `HARNESS_ADAPTER_CHAT` guard active (docker env), (c) `resolveChatTools` in `services/stage-engine/src/core/chat-tool-resolver.ts` is merging client tools. Also check `dumpStageEngineLogs()` output in the failure message for resolver errors.

**A7 fails — stage-engine not returning `client_tool_calls` or LLM not consuming the result:**
The final assistant message does not mention a number or "ulest". Two possible causes: (1) stage-engine is not returning `client_tool_calls[]` so the roundtrip never happens and the LLM replies without tool context, or (2) the roundtrip happened but the LLM's final text did not reference the count. Check `responses` array in the failure output and stage-engine logs. If `client_tool_calls` is absent in turn-1 response, this is the same root cause as A5. If it is present but the final text is off, the LLM may need a stronger prompt or the tool result format changed.

**A8 fails — telemetry layer broken:**
`activity_trail` has no `botsson.tool_invoked` row for `getUnreadCount` within 15s of the trigger POST. The stage-engine harness recorder emits this row when it dispatches `client_tool_calls` to the browser. Check: (a) `SEED_WORKSPACE_ID` and `SEED_PROFILE_ID` match the local seed, (b) telemetry `emit()` call in stage-engine is not silently swallowed, (c) Supabase Local's `activity_trail` table is accessible from the test process. This failure is a telemetry regression, not a pipe failure — the roundtrip itself may have worked.

**N1 skipped in a flag-ON run (expected behavior):**
N1 is designed to run only when `HARNESS_ADAPTER_CHAT` is NOT `true`. If the E2E `.env.local` has the flag ON, N1 is skipped automatically — this is correct. To verify the negative path separately, see the next journey.

---

## Journey: Operator validates fallback path

**Role:** Operator (developer / QA)
**Surface:** same spec, N1 describe block

**Precondition:**
- Supabase Local is running
- stage-engine container running WITHOUT `HARNESS_ADAPTER_CHAT` (flag unset or `false`)
- `apps/e2e/.env.local` has `HARNESS_ADAPTER_CHAT` unset or set to `false`
- Next.js dev server running on port 3060

**Steps:**

1. Operator removes `HARNESS_ADAPTER_CHAT=true` from `apps/e2e/.env.local` (or sets it to `false`).
   → E2E process reads flag as `false`.

2. Operator restarts stage-engine container without the flag:
   Remove `HARNESS_ADAPTER_CHAT=true` from `infra/.env.local` (or `docker-compose.override.yml`), then:
   ```bash
   cd infra
   docker compose -f docker-compose.yml -f docker-compose.override.yml \
     --env-file ../.env.template --env-file .env.local \
     up -d stage-engine
   ```
   → Container starts without `HARNESS_ADAPTER_CHAT` in env.

3. Operator runs the same spec:
   ```bash
   pnpm --filter @smartout/e2e exec playwright test harness-adapter-chat-client-tool.spec.ts
   ```
   → A2 skips the positive path with message "HARNESS_ADAPTER_CHAT is not 'true'". N1 runs.

4. Operator observes N1 output.
   → N1 navigates to `/dashboard/notifications`, sends the same trigger message, intercepts the BFF request, and asserts that `client_tools[]` does NOT contain `getUnreadCount`.
   → N1 also polls `activity_trail` for 5s and asserts no `botsson.tool_invoked` row for `getUnreadCount` was written.

**Postcondition:**
- N1 green confirms that the feature flag gates tool forwarding correctly. Without the flag, the BotssonProvider bridge may still mount and register tools, but stage-engine's resolver does not expose them to the LLM, and no telemetry row is written.
- N1 red means the flag gate is broken — client tools leak through even when the feature is off.

**Dual-run requirement:**
A positive-path run (flag ON) and a negative-path run (flag OFF) cannot be combined in a single Playwright session because the process-level `HARNESS_ADAPTER_CHAT` constant is read once at import time and the container env cannot be flipped mid-run. Both runs are required to claim full pipe verification.

---

## Relationship to existing tests

This spec does NOT replace:
- `services/stage-engine/src/routes/agent/__tests__/chat-harness-pipeline.test.ts` — unit tests for bundle propagation and `client_tool_calls` emission at the stage-engine layer
- `apps/web/src/app/api/botsson/chat/__tests__/route.test.ts` — unit tests for BFF field forwarding in both directions
- `apps/web/src/app/Botsson/_components/__tests__/BotssonChat-roundtrip.test.tsx` — unit tests for browser-side roundtrip execution and loop-cap

This spec ADDS full end-to-end coverage of the wired-up pipe. The unit tests prove each layer in isolation with mocked neighbours; this spec proves all layers communicate correctly with real HTTP, real DOM interaction, real Supabase writes, and a live LLM call.

**Voice pipe E2E is deferred.** Phase 4 shipped the voice roundtrip via LiveKit data channel, but an E2E spec for voice requires either a LiveKit room mock in Playwright or a real audio session — neither is feasible in CI today. Voice coverage remains unit-test-only (agent-sdk 6/6 + client-tool-rpc 7/7 + voice-tool-resolver 7/7 from the Phase 4 JOURNEY).

**Phase 2 candidate sortie:** HarnessAdapter + Journey Engine interaction (ADR-0327 × ADR-0173). When a page tool triggers a journey step, the E2E spec pattern here (DOM trigger → intercept → DB assertion) extends naturally, but the journey execution layer introduces additional async state and a separate DB table.

---

## Pass/fail interpretation table

| Assertion failed | Likely cause | Layer |
|---|---|---|
| A1: container freshness | Container image predates latest commit; code changes not reflected in running container | Container build |
| A2: HARNESS_ADAPTER_CHAT flag | Flag missing from `apps/e2e/.env.local` or container env; both must be `true` | Env config |
| A3: page render | Next.js server error, Supabase Local down, or RSC hydration failure on `/dashboard/notifications` | Web server / DB |
| A4: `client_tools[]` absent in request | `NotificationsToolsBridge` not mounted, `useRegisterTools` not called, or BotssonChat submit handler not reading BotssonProvider context | Browser / Provider |
| A4: `getUnreadCount` missing from `client_tools[]` | Tool name mismatch between `use-notifications-tools.ts` registration and BotssonProvider aggregation; check `modelToolName` field | Browser / Bridge |
| A5: `client_tool_calls[]` absent in response | BFF not forwarding `client_tools` to stage-engine, stage-engine flag guard blocking resolution, or LLM chose not to invoke the tool | BFF / stage-engine / LLM |
| A5: `getUnreadCount` not in `client_tool_calls[]` | stage-engine `resolveChatTools` did not include `getUnreadCount` in the merged tool set presented to LLM | stage-engine resolver |
| A6: no roundtrip request seen within 60s | `BotssonChat.tsx` Phase 3.5b roundtrip logic not triggering; `client_tool_calls` may have been dropped before reaching the component | Browser |
| A6: `client_tool_results[]` missing or wrong `tool_call_id` | Browser-side `resolveClientToolCalls` not matching `capturedCallId` from A5; possible state loss between test bodies | Browser roundtrip |
| A6: `unreadCount` field missing or non-numeric | `getUnreadCount` implementation in `use-notifications-tools.ts:121` returned wrong shape | Tool implementation |
| A6: `is_error: true` | Tool implementation threw; check `use-notifications-tools.ts` body for DB query errors or auth issues against Supabase Local | Tool implementation |
| A7: final text has no digit or "ulest" | LLM ignored tool result (prompt did not force tool use), or roundtrip did not complete before A7 captured final response | LLM / timing |
| A8: no `botsson.tool_invoked` row in 15s | Telemetry `emit()` not called in stage-engine harness recorder, `activity_trail` INSERT failing (RLS or schema mismatch), or `SEED_WORKSPACE_ID` / `SEED_PROFILE_ID` mismatch | Telemetry / DB |
| N1: `getUnreadCount` present in `client_tools[]` when flag off | Feature flag gate in stage-engine `resolveChatTools` not checked, or flag leaking from a parallel E2E worker | stage-engine / env |
| N1: `botsson.tool_invoked` row written when flag off | `emit()` fires before flag check; telemetry must be gated behind the same flag as tool resolution | Telemetry gate |
