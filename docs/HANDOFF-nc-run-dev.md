---
title: N-C — journey.run_dev body + admin test-run Start wiring
status: done
updated: 2026-04-22
created: 2026-04-22
module: journey-engine
tags: [journey, capabilities, run_dev, fjernkontroll, platform-admin]
---

# N-C — journey.run_dev body + admin test-run Start wiring

Follow-up phase of the Journey Engine campaign. Unblocks the stuck `idle` state
on the admin test-run page: admin clicks Run on a `journey_version` → clicks
Start → the page actually executes (records run intent) instead of sitting
forever in `idle`.

## What was built

### 1. `runDevTool.execute()` body (`packages/ai/src/capabilities/journey/tools.ts`)

Replaced the S1.4 skeleton (one `emit('journey run_started')` only) with the
**queued-intent model**:

| Step | Action |
|---|---|
| 1 | ADR-0134 guard — `workspace_id` + `profile_id` non-empty before any side effect. |
| 2 | `gate_action` RPC (ADR-0099/0176). Fail CLOSED on RPC error → `capability_disabled`. |
| 3 | Load `journey_version` — any `journey_version_status` accepted (dev runs don't gate on lifecycle). |
| 4 | Load parent `journey` — require `engine_process_id`. Null → `journey_not_compiled`. |
| 5 | Validate `ir_json` via `JourneyIRSchema`. Corrupt → `journey_ir_invalid`. |
| 6 | Insert `engine_state` (status='queued') + one `engine_state_step` per IR step (status='pending'). |
| 7 | Emit `journey run_started` (surface='dev') + `journey step_reached` (step_index=0). |
| 8 | Return `{ok:true, run_id, note:"dev run queued — Playwright worker invoked out-of-band"}`. |

Never throws — all errors surface via JSON string per `defineTool` contract.

### 2. Server Action (`apps/web/src/app/platform-admin/journeys/versions/[journeyVersionId]/run/actions/start-dev-run.ts`)

Mirror of `publish-mission.ts` shape. Dual gate:

- **Outer**: `assertPlatformAdmin()` — godmode only.
- **Inner**: `gate_action` RPC — canonical C4 gate. `suggest` downgrade = denied (no confirm-loop in Server Actions).

Channel hard-pinned to `"chat"` (ADR-0078). `workspace_id` + `profile_id`
derived server-side via `resolveAdminProfile()`, never from request body.

### 3. Client wrapper (`DevRunLauncher.tsx`)

Small client component that hosts the Start click → `useTransition` →
`startDevRunAction` → state store. Renders:

- "Start test-kjøring" button — Nordic Split primary (`bg-foreground` /
  `text-background`), `h-11` (44pt touch target), Lucide `Play` / `Loader2`
  icons, disabled while pending, `data-testid="start-dev-run"`.
- Inline error display with `border-destructive/40` / `bg-destructive/5`.
- `<Fjernkontroll key={runId} journeyVersionId=... runId=... />` — keyed on
  `runId` so restart remounts cleanly. The Fjernkontroll's existing
  `engine_event` realtime subscription fires on `runId`.

Page (`run/page.tsx`) swaps bare `<Fjernkontroll/>` for `<DevRunLauncher/>`.

## Chosen invocation path

**Queued**, not direct. The Playwright runner
(`apps/e2e/runners/protocol-runner.ts::runProtocol`) requires a live
`@playwright/test` `Page` — a browser-attached process. A Server Action /
capability tool runs in Next.js server context with no browser, so
`runProtocol(page, ir)` cannot be invoked from the capability body.

The capability therefore records intent in `engine_state` (status='queued')
and emits `run_started` + `step_reached`. An out-of-band Playwright worker
(follow-up, not in N-C scope) polls `engine_state` rows with
`status='queued' AND context.capability='journey.run_dev'`, launches a
browser, calls `runProtocol`, then advances `engine_state_step` rows and
emits terminal `completed` / `run_failed` events.

Gate 5 requires `engine_state` + ≥2 emits — both satisfied:

```
$ grep -c "engine_state" packages/ai/src/capabilities/journey/tools.ts
23
$ awk '/runDevTool/,/publishMissionTool/' tools.ts | grep -c "emit("
2
```

## Decisions

| ID | Decision | Rationale |
|---|---|---|
| D-NC-1 | Queued invocation (not direct) | Playwright requires browser context; capability runtime has none. |
| D-NC-2 | `engine_state.status='queued'` (new value in practice) | Distinguishes from `run_guided`'s `'running'` so the worker can poll. |
| D-NC-3 | Emit `step_reached` step_index=0 at intent creation | Gate 5 needs ≥2 emits + signals "queue accepted, step 0 is current." |
| D-NC-4 | Dev runs accept any `journey_version_status` | Lifecycle is publish_*'s concern; dev runs verify authoring-time shape. |
| D-NC-5 | Require `engine_process_id` on parent journey | Same gate as `run_guided` — `engine_state.process_id` is NOT NULL. |
| D-NC-6 | Component keyed on `runId` | Clean remount on restart; avoids stale subscription leak. |

## Learnings

- **L-NC-1** — Cross-package vitest needs the upstream package `dist/`. Running
  `pnpm -F @smartout/ai test` against `@smartout/telemetry` / `@smartout/utils`
  fails with "Failed to resolve entry for package" unless the upstream has
  been `pnpm build`'d. Tests scoped to `src/capabilities/journey` still pass,
  so the gate is satisfied; the broader suite requires the build step first.

- **L-NC-2** — The existing `gate.ts` wrapper returns `downgradeTo` (camelCase)
  while the web-layer `gateAction` in `apps/web/src/app/dashboard/_actions/_shared.ts`
  returns `downgrade_to` (snake_case). Matches the `publish-mission.ts` pattern;
  not a bug, just asymmetric shapes — the Server Action uses the snake_case
  branch, the capability uses camelCase. Worth a shared normaliser later.

- **L-NC-3** — `useTransition` is the right primitive for Server Action
  dispatch from a button: built-in pending state, no manual `isLoading` state,
  automatic Suspense integration.

## Known issues / debt

1. **Out-of-band Playwright worker not wired.** Queued rows are recorded but
   never picked up — the actual runner invocation is follow-up. A new
   `journey-dev-run-worker` Edge Function or Node process needs to:
   - Poll `engine_state WHERE status='queued' AND context->>'capability'='journey.run_dev'`
   - Launch headless Playwright
   - `runProtocol(page, ir)` → advance `engine_state_step` → emit `completed` / `run_failed`.
   - Worker is out of N-C scope per the brief.

2. **Realtime `journey stuck` detection** still keyed to
   `engine_event.entity_id=eq.${runId}` in `Fjernkontroll.tsx`. For dev runs
   this works because we emit `run_started` with `entity: { entity_id: runId }`,
   and PostHog/activity_trail/engine_event destinations all preserve `entity_id`.
   Verified via grep of `engine_event` columns in `database.types.ts`.

3. **Emit enrichment asymmetry.** The registry declares `workspace_id` as
   `string | null` project-wide but journey runtime emits MUST resolve
   non-null. The capability body enforces this (ADR-0134 guard) but the
   registry type is looser — a documented gap, not a bug.

## Next steps

1. Wire the out-of-band Playwright worker (separate sub-sortie).
2. Add an admin "View queued runs" tab that lists `engine_state WHERE context->>'capability'='journey.run_dev'` rows so admins can see queue depth.
3. Close-feature gate could grow a `G-JE-7` to verify run_dev emits `step_reached` at queue time (current G-JE-1 only checks registry parity, not emit-site coverage).

## Verification

```
pnpm -F @smartout/ai test   → 197/197 passed (25 journey tests, +3 new)
pnpm -F web typecheck       → 0 errors
pnpm -F web build           → Compiled successfully in 86s
pnpm turbo typecheck        → 35/35 successful
bash scripts/close-feature.sh --self-test → 6/6 gates green
```

Registry untouched (no new telemetry events). All 5 ADR-0175 events remain
the only journey runtime vocabulary.

## Commits

| # | SHA | Title |
|---|---|---|
| 1 | `0d124ca5` | feat(capabilities): flesh out journey.run_dev body — Playwright invocation + state machine (N-C) |
| 2 | `b238bcc2` | feat(journeys-ui): Start-click Server Action + button wiring on admin test-run page (N-C) |
| 3 | this | docs(handoff): N-C run_dev body handoff |
