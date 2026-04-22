---
title: M5.2 Mobile Thin-Client + BFF Routes — Handoff
status: done
updated: 2026-04-22
created: 2026-04-22
module: journey-engine
tags: [m5.2, mobile, bff, journey, run_guided, adr-0132, adr-0134, adr-0176, adr-0078]
---

# M5.2 Mobile Thin-Client + BFF Routes — Handoff

## Summary

M5.2 delivers the mobile surface for `journey.run_guided` per ADR-0132 (Mobile
AI Routing): a thin-client Fjernkontroll screen on mobile calls two new BFF
routes on web, which invoke the `run_guided` capability with server-derived
`workspace_id` + `actor_id`. Mobile never imports capabilities directly.

All six council red lines (R5.2-1 through R5.2-6) are green.

## Commits (base `fa65c197`)

| # | SHA | Message |
|---|-----|---------|
| 1 | `68871fae` | feat(api): BFF /start route for journey.run_guided — server-side derivation |
| 2 | `c945c858` | feat(api): BFF /:runId/status read-only route |
| 3 | `2f68a13a` | feat(mobile): enforce empty-string ban on profile-context |
| 4 | `d3b6cb7b` | feat(mobile): thin-client Fjernkontroll screen calling BFF |
| 5 | `93c74b33` | test(mobile): BFF request omits workspace/actor IDs per ADR-0176 |

## What was built

### BFF routes (apps/web)

- `POST /api/journey/guided/start`
  (`apps/web/src/app/api/journey/guided/start/route.ts`)
  - Zod schema accepts ONLY `journey_version_id` — any client-supplied
    `workspace_id` / `actor_id` / `profile_id` is a CVE-class bug.
  - Dual auth: Supabase SSR cookie (web) OR Bearer token (mobile per ADR-0132).
  - Derives `workspace_id` + `profile_id` from the authenticated user's
    `profile` row (ADR-0176 Invariant 3 — SERVER-side re-derivation).
  - Fail-fast 401 on no user, 422 on empty identity fields.
  - Workspace-scoped journey_version lookup; cross-workspace = 404 (not 403)
    to prevent enumeration (ADR-0176).
  - C4 `gate_action` RPC enforces workspace-level authority on
    `journey.run_guided`; `channel` hard-pinned to `"chat"` (ADR-0078 / R5.2-5).
  - Invokes `runGuidedTool.execute()` with a server-built `AgentToolContext`.
    On throw/refuse emits registered `journey run_failed` (no phantom emits).
  - Same-origin CORS guard before body parse.

- `GET /api/journey/guided/:runId/status`
  (`apps/web/src/app/api/journey/guided/[runId]/status/route.ts`)
  - Same dual-auth path.
  - Workspace-scoped read on `engine_state` + `engine_state_step`.
  - Cross-workspace = 404 (enumeration prevention).
  - Read-only; no emit.

### Mobile (apps/mobile)

- `apps/mobile/src/lib/profile-context.ts` — added `safeGetProfileContext()`
  wrapper + defence-in-depth `.trim() === ""` check to block whitespace
  bypass. Empty-string fallback explicitly banned.

- `apps/mobile/src/lib/web-api.ts` — added `getJourneyGuidedStartUrl()` +
  `getJourneyGuidedStatusUrl(runId)`.

- `apps/mobile/src/lib/journey-bff.ts` — shared BFF client:
  - `buildStartGuidedBody(journeyVersionId)` — exported for tests;
    returns `{ journey_version_id }` and nothing else.
  - `bffStartGuided(journeyVersionId)` — attaches Bearer token, returns
    `{ ok, runId | error }`.
  - `bffFetchStatus(runId)` — attaches Bearer token, returns full status.

- `apps/mobile/app/(app)/journey/[id]/guided.tsx` — thin-client Fjernkontroll:
  - 8-state machine (loading_profile, profile_error, idle, starting, running,
    stuck, completed, failed).
  - Profile guard on mount via `safeGetProfileContext()`.
  - Polls status every 2.5 s while running.
  - Nordic Split design tokens only (foreground/card/primary/destructive/success).
  - 44 pt touch targets; `accessibilityLiveRegion` on state cards.

### Tests (apps/mobile)

- `apps/mobile/src/lib/__tests__/journey-bff.test.ts` — 7 passing tests:
  - Payload shape: only `journey_version_id` — never `workspace_id`,
    `workspaceId`, `actor_id`, `actorId`, `profile_id`, or `profileId`.
  - Wire-format assertion via fetch mock (R5.2-1).
  - Bearer attachment (ADR-0132).
  - Fail-fast on no session (R5.2-3).
  - `journey-bff` module exports contain no `emit`/`track` helpers
    (BFF owns emit; R5.2-6).

## Auth flow (dev / publish / runtime)

- **Dev** (M3) — `packages/ai/src/capabilities/journey/tools.ts:runDevTool`:
  actor resolved from dev user session (existing pattern).
- **Publish** (M4) — Server Action in
  `apps/web/src/app/platform-admin/journeys/versions/actions/publish-*.ts`:
  actor resolved via `resolveAdminProfile()`.
- **Runtime** (M5.2 — this deliverable) — BFF route resolves actor from
  the authenticated user's `profile` row; mobile and web use the same route
  with different auth methods (Bearer vs cookie). The `surface` field on the
  response distinguishes `runtime_mobile` from `runtime_web`.

## Server-side derivation proof

`apps/web/src/app/api/journey/guided/start/route.ts:93-108` — the BFF
constructs `workspace_id` + `actor_id` EXCLUSIVELY from the authenticated
user's profile row, NEVER from the request body:

```ts
const { data: profile, error: profileErr } = await admin
  .from("profile")
  .select("profile_id, workspace_id")
  .eq("user_id", userId)
  .eq("is_active", true)
  .limit(1)
  .maybeSingle();

if (profileErr || !profile) return null;
if (!profile.profile_id || !profile.workspace_id) return null;

return {
  userId,
  profileId: profile.profile_id,
  workspaceId: profile.workspace_id,
  surface,
};
```

## Council red-line gate results

| Gate | Rule | Result |
|------|------|--------|
| R5.2-1 | `grep body.(workspace_id\|actor_id\|profile_id)` in `apps/web/src/app/api/journey` = 0 | PASS |
| R5.2-2 | Every BFF route calls `auth.getUser(` | PASS (2/2 routes) |
| R5.2-3 | No `?? ""` / `\|\| ""` on actor/workspace in M5.2-owned files | PASS |
| R5.2-4 | No `@smartout/ai` imports in `apps/mobile/src` | PASS |
| R5.2-5 | `channel: "chat"` hard-pinned server-side | PASS (3 call-sites) |
| R5.2-6 | Unit test for mutation asserts `workspace_id` + `actor_id` missing | PASS (7 tests) |

## Typecheck

- `pnpm turbo typecheck --filter=web` → 0 errors.
- `pnpm turbo typecheck --filter=@smartout/mobile` → 0 errors.

## Known issues / debt

- Pre-existing `?? ""` fallbacks in **other** mobile files (not M5.2-owned):
  `apps/mobile/src/components/shift-clock/ShiftClockView.tsx`,
  `apps/mobile/src/hooks/queries/use-swap-requests.ts`,
  `apps/mobile/src/hooks/mutations/use-livekit-call.ts`, etc. These are
  shift-clock / livekit / training domain concerns; NOT M5.2 scope.
- The status polling interval is hard-coded to 2.5 s. A future revision
  could switch to Supabase realtime for `engine_state` row updates.
- The mobile screen does not yet use spring physics (ADR-0177 `stiffness=35,
  damping=22, mass=2.2`) on state transitions — the brief explicitly allows
  mobile to render a simplified surface, but a later polish pass can adopt
  `nativeTheme.motion.springAmbient`.

## Next steps

- **M5.1 (parallel)** — flesh out `runGuidedTool.execute()` body with the
  real `engine_state` insert + state-machine wiring. The BFF in this
  deliverable already handles capability-throw and capability-refuse cases
  via `journey run_failed` emit.
- **M6** — journey-engine CI gate: add a grep check for
  `body\.(workspace_id|actor_id|profile_id)` in `apps/web/src/app/api/journey`
  to the close-feature script so R5.2-1 is enforced in CI.

## Binding ADRs touched

- ADR-0078 — voice forbidden for critical data: `channel: "chat"` pinned
  server-side, cannot be reflected from body.
- ADR-0132 — Mobile AI Routing: dual-auth BFF, mobile never imports
  capabilities.
- ADR-0133 — Web composes, mobile executes: no authoring on mobile.
- ADR-0134 — Mobile Telemetry Contract: empty-string ban enforced via
  `trim() === ""` guard + `safeGetProfileContext()`.
- ADR-0176 — Actor ID Resolution Invariant 3: BFF is the server-side
  re-derivation point; Zod schema rejects client identity fields.

## Binding learnings

- L-0094 — phantom emit contracts (5th-occurrence risk): BFF emits
  `journey run_failed` only; event pre-registered in `packages/telemetry/src/registry.ts`.
  No new events introduced in M5.2.
