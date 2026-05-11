---
title: Botsson Harness E2E Test — HANDOFF
status: done
updated: 2026-05-11
created: 2026-05-11
module: ai
tags: [botsson, e2e, harness, memory, save_memory, stage-engine]
---

# Botsson Harness E2E Test — HANDOFF

## What was built

Full-pipe E2E spec for the Botsson AI harness: `apps/e2e/tests/botsson-harness-e2e.spec.ts`

16 tests covering L1 UI → L2 BFF → L3 Stage Engine → L4 Capabilities → L5 DB:
- **A1–A13**: positive path (13 tests, all pass)
- **N1**: authority denial (skipped — requires a workspace without memory authority; seed admin belongs only to HQ workspace)
- **N2**: PII block — personnummer not persisted (passes)
- **N3**: voice channel guard (skipped — LiveKit not available in E2E environment)

Also ships: `apps/e2e/helpers/botsson-harness.ts` — reusable helpers.

## Why it exists

Manual bug found by Pontus: stale stage-engine container returned `save_memory = blocked`. LLM rephrased it as a polite Norwegian apology. Zero coverage, zero alarm. This spec catches that class of failure across 4 independent assertions (A3, A5/A6, A7, A8).

## Infrastructure gaps discovered during implementation

### 1. BFF field names (camelCase, not snake_case)
`/api/botsson/chat` schema: `workspaceId` + `userMessage`. No `profile_id` or `channel` in the body (server-derived per ADR-0151). Response: `{ text, sessionId, intent }`.

### 2. QueryClientProvider not available at /Botsson
The `/Botsson` standalone playground does not wrap `BotssonHistory` in a `QueryClientProvider`. Clicking "Ny chat" crashes into ErrorBoundary. Tests A3/A13/N2 use direct BFF calls instead of UI navigation.

### 3. WorkspaceProvider not available at /Botsson
`AdminChatView` (the textarea) requires `useWorkspaceOptional()` to return non-null. `/Botsson` standalone has no `WorkspaceProvider` → shows "Ingen aktiv arbeidsplass", no textarea. Same fix: direct BFF calls.

### 4. Next.js dev overlay intercepts pointer events
`<nextjs-portal>` sits on top of UI elements. `.click()` and `.click({ force: true })` target element coordinates, which the overlay intercepts. Fix: `.dispatchEvent("click")` fires directly on the DOM node, bypassing the overlay.

### 5. Stage-engine container freshness
The container was 338 minutes behind the latest commit. The freshness check in `assertStageEngineContainerFresh()` caught this. Run with `SKIP_FRESHNESS_CHECK=1` to bypass (downgrades to warning).

### 6. gate_action RPC param rename
Between old and new container, `gate_action` RPC renamed `p_profile_id` → `p_actor_profile_id`. Old container code used the old name → every `callGateAction` returned 404 "function not found". `save_memory` fell through to blocked path, LLM apologized. This is the exact stale-container bug class the spec was built to catch.

### 7. stage-engine DEV_API_KEY
Container `DEV_API_KEY` must be set to a non-blank, non-op:// string to disable the dev auth bypass. Without it, the auth middleware sets `workspaceId: undefined` → `/agent/chat` returns 403. Set in `infra/.env.local`:
```
STAGE_ENGINE_API_KEY=e2e-local-dev-key-not-a-secret-1234
```
Docker compose maps `DEV_API_KEY=${STAGE_ENGINE_API_KEY}`.

### 8. assert_gate_caller PostgREST-14 incompatibility (infrastructure bug)
Migration `20260512100100_assert_gate_caller.sql` uses:
```sql
v_is_service_role := COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role';
```
PostgREST ≤11 sets `request.jwt.claim.role` (individual string). PostgREST 14 (Supabase CLI 2.98.2) sets `request.jwt.claims` (JSONB object). The old GUC is NULL → `v_is_service_role = false` → every service_role call to `cascade_gate_write` → `assert_gate_caller` raises "gate call requires authenticated caller or service_role".

**Hotfix applied to local DB:**
```sql
CREATE OR REPLACE FUNCTION public.assert_gate_caller(p_actor_profile_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_is_service_role BOOLEAN;
  v_caller_uid      UUID;
  v_profile_user_id UUID;
  v_jwt_claims_raw  TEXT;
  v_jwt_role        TEXT;
BEGIN
  v_jwt_claims_raw := current_setting('request.jwt.claims', true);
  IF v_jwt_claims_raw IS NOT NULL AND v_jwt_claims_raw <> '' THEN
    v_jwt_role := (v_jwt_claims_raw::jsonb) ->> 'role';
  ELSE
    v_jwt_role := current_setting('request.jwt.claim.role', true);
  END IF;
  v_is_service_role := (v_jwt_role = 'service_role');
  -- ... (rest of function unchanged) ...
END;
$$;
```

**Required migration:** A proper migration must ship this fix. Until it does, the spec will fail on any environment running PostgREST 14+. Tracked as `assert_gate_caller-postgrest14-compat`.

## Decisions

### D1: Direct BFF calls for chat assertions
Tests A3, A13, N2 call `/api/botsson/chat` directly via `page.request.post()` instead of typing into a textarea. Rationale: `/Botsson` standalone lacks WorkspaceProvider + QueryClientProvider. The BFF call exercises L2→L3→L4→L5 fully.

### D2: Serial test mode for the whole spec
Both describe blocks (positive + negative) are wrapped in `test.describe.configure({ mode: "serial" })`. Rationale: positive and negative suites share `SEED_PROFILE_ID`/`SEED_WORKSPACE_ID`. `fullyParallel: true` caused N2's BFF call to land during A2's laziness check window.

### D3: BFF response field parsing
BFF returns `{ text, sessionId, intent }` not `{ message, response }`. Tests cast to the correct shape.

### D4: sessionId from BFF response preferred over DB lookup
A3 captures `body.sessionId` from the BFF response directly, with DB fallback. More reliable than a DB query that races the async commit.

## Known issues / debt

1. **N1 always skipped** — seed admin belongs only to HQ workspace. Testing authority denial needs a second profile in a workspace without memory authority seeded. One-time setup task.

2. **N3 always skipped** — full LiveKit voice session cannot be driven in Playwright. Channel guard is unit-tested in `packages/ai`. Tracked.

3. **assert_gate_caller PostgREST-14 fix not in migrations** — hotfix applied to local DB manually. Needs proper migration shipping with the next DB change that touches this area.

4. **A4–A8 depend on agent_session_recording being implemented** — the recorder tables and hooks must be live. If the recorder is disabled, A4/A5/A8 will timeout and fail.

5. **A13 depends on memory reader injection working** — if `collectContext()` doesn't inject memories into the prompt, A13 will fail. This exercises the full read path.

## Next steps

1. Write migration to fix `assert_gate_caller` for PostgREST 14
2. Seed a test workspace without memory authority for N1
3. Add `infra/.env.local` setup instructions to `infra/README.md`
4. CI: add this spec to the harness test suite once the infrastructure is stable
