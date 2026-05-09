---
title: "HANDOFF — B1 Server-Derive workspace_id (ADR-0151 Enforcement)"
status: done
created: 2026-05-08
updated: 2026-05-08
module: MODULE_BOTSSON
tags: [security, adr-0151, botsson, harness, workspace-id, forgery]
sortie: feat/b1-server-derive-workspace-id
---

# HANDOFF — B1 Server-Derive workspace_id

## What Was Built

Closed the ADR-0151 Invariant I4 forgery surface on the Ultravox voice path.

Before this sortie, `apps/web/src/app/api/wizard/start/route.ts` used
`body.workspace_id ?? profile?.workspace_id` — meaning a client could supply a
forged workspace_id in the POST body and it would silently override the
JWT-resolved profile workspace. The same vulnerability existed in the stage-engine
ultravox adapter, which accepted `body.workspace_id` without comparing it to the
auth context.

## Two Callsites Fixed

### Callsite 1: `apps/web/src/app/api/wizard/start/route.ts`

- Replaced `body.workspace_id ?? profile?.workspace_id` with server-derived only
- Added Council R3 truthy-guard: mismatch check only fires when `resolvedWorkspaceId`
  is truthy. A user with profile.workspace_id = NULL gets a 400 (No workspace found)
  not a false 403.
- 403 branch emits `security.workspace_id_forgery_rejected` via telemetry + console.warn
- Onboarding path (`missionId === "onboarding-interview"`, no user) is completely
  unaffected — the profile lookup block is inside `if (user)`

### Callsite 2: `services/stage-engine/src/routes/adapters/ultravox.ts`

- Added `authWorkspaceId` resolution from `auth.workspaceId` (the typed AuthContext)
- Mismatch guard: if `authWorkspaceId` is set and `body.workspace_id` disagrees → 403
- `effectiveWorkspaceId = authWorkspaceId ?? body.workspace_id` — server always wins
- Onboarding path (auth has no workspaceId, API-key-only) uses body fallback because
  the BFF is the upstream trust boundary

## Telemetry Event Registered (Task 0)

`security.workspace_id_forgery_rejected` added to `packages/telemetry/src/registry.ts`:
- Interface: `SecurityWorkspaceIdForgeryRejected extends BaseEvent`
- Added to `SmartoutEvent` union
- EVENT_ROUTING: destinations `["logger", "activity_trail"]`, category `"security"`
- Per ADR-0193: `resolved_workspace_id` may be null (mid-onboarding), never ""

## Tests Added (7 total)

### Web: `apps/web/src/app/api/wizard/start/__tests__/route.test.ts` (4 cases)

1. forge-403: body.workspace_id ≠ profile.workspace_id → 403, fetch not called
2. match-200: body.workspace_id = profile.workspace_id → 200, workspace_id passed through
3. omit-200: no body.workspace_id → 200, server-derives from profile
4. onboarding-200: no authenticated user + onboarding-interview → 200, no profile lookup

### Stage-engine: `services/stage-engine/src/routes/adapters/__tests__/ultravox.test.ts` (3 cases)

1. forge-403: body.workspace_id ≠ auth.workspaceId → 403, createSession not called
2. match-200: body.workspace_id = auth.workspaceId → 200, effectiveWorkspaceId correct
3. onboarding-fallback-200: auth has no workspaceId → 200, body.workspace_id used

## Decisions

ADR-0151 is already `accepted`. This sortie is enforcement, not a new decision.
No new ADR created — see `0000-decision-log.md` for existing ADR-0151 registration.

**Plan-label disambiguation (council R3):** This "B1" refers to workspace_id forgery
fix (ADR-0151 closure). It is NOT the `BOTSSON-SYSTEM-MAP.md` Section 4 "Phase B1
dual-gate reconciliation" (gate_action vs cascade_gate_write divergence). That Phase
B1 remains 🟡, separate work.

## Known Issues / Debt

None introduced by this sortie. Pre-existing:
- `@smartout/ai` and `@smartout/journey-ir` have no dist — `pnpm --filter web typecheck`
  shows ~17 pre-existing TS2307 errors from those unbuilt packages. Not introduced here.
- `@smartout/ai` mock in ultravox.test.ts (`SEASON_LIFECYCLE_MISSION_ID`) must be kept
  in sync if that constant is renamed.

## Open Gaps This Sortie Relies On

- **ADR-0151 Phase A2** (full profile_id server-derivation in BFF): `ctx.profileId` in
  capability tools still comes from request body. This sortie closes workspace_id only.
  The system map comment "Treat ctx.profileId as trusted only after Phase A2 merges"
  still applies.

## Commit SHAs

1. `ab5ee4a04` — feat(telemetry): register security.workspace_id_forgery_rejected
2. `966b1b72e` — test(wizard/start): failing case for body workspace_id forgery
3. `0135991a9` — fix(wizard/start): reject forged workspace_id (ADR-0151)
4. `7afba4779` — test(stage-engine/ultravox): failing case for body workspace_id forgery
5. `0902541b3` — fix(stage-engine/ultravox): prefer auth.workspaceId over body
6. `6f63db826` — fix(wizard/start): satisfy NonEmptyString brand in emit call

## Next Steps

- Operator merges PR into development
- Phase A2: full profile_id server-derivation (BOTSSON-SYSTEM-MAP L2 + L3 profile_id row)
- Consider adding a pre-push test that verifies all BFF routes reject body-supplied IDs
