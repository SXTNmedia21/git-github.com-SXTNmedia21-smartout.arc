---
title: HANDOFF — e2e-nyheter-stabilize
feature: e2e-nyheter-stabilize
status: done
created: 2026-05-11
updated: 2026-05-11
module: MODULE_COMMUNICATION
tags: [handoff, e2e, playwright, test-infra, wave-a-followup]
---

# HANDOFF — e2e-nyheter-stabilize

> Branch: `feat/e2e-nyheter-stabilize` | Worktree: `/home/sxtnl/wsl/smartout.ai-wt-4`

## Summary

This sortie stabilized as many of the 5 failing Wave A Playwright specs as possible without touching Wave A app code. Started at 1/5 pass. Ended at 2/5 pass. 3 remaining failures require prerequisites outside this sortie scope.

## What was built

### Cherry-picks from `feat/nyheter-engagement-wave-a`

Two commits were cherry-picked to bring the spec files and helper additions to this branch:

1. `fix(nyheter): bridge e2e specs to admin's actual session workspace` (`bcbfa3115` origin, `2167a5b21` on this branch) — Added `resolveAdminWorkspaceId()` + `resolveAdminProfileId()` to `apps/e2e/helpers/auth.ts`. Created the 3 spec files in `apps/e2e/komm-nyheter/`. Added tsconfig include.

2. `fix(test): seedProfile creates auth.users + fix Wave A spec selectors` (`5fbbe3cbf` origin, `d115c5989` on this branch) — Added `cleanupSeededAuthUsers()` + `getSeededAuthUserIds()` to `apps/e2e/helpers/seed.ts`. Modified `seedProfile()` to create a backing `auth.users` row via admin API when `user_id` is not supplied. Fixed spec selectors (getByPlaceholder instead of getByLabel; dual-path for audience picker).

### T1 fix: playwright timeout bump

`fix(playwright): bump per-test timeout 30s to 60s for Turbopack cold-compile` (`5d62f3ba3`) — Raised `timeout` in `apps/e2e/playwright.config.ts` from 30s to 60s. Closed the Turbopack cold-compile timeout for Journey 2 test 2 (Alle audience). Journey 2 test 1 still fails for a different reason (see below).

### T2 fix: spec selector stabilization

`fix(komm-nyheter): stabilize Journey 1+2+3 selector issues` (`0dfcc0d9d`):

- **Journey 1**: Changed `getByText("Testkunngjøring")` to `.first()` to handle strict mode violation when prior test runs leave matching announcements in DB.
- **Journey 2 test 1**: Increased AudiencePicker tab visibility timeout from 2000ms to 8000ms. (Does not fully resolve — see server prerequisite blocker.)
- **Journey 3 test 1**: Added explicit `toBeVisible({ timeout: 10000 })` wait on the "Mer" button before clicking, since the button renders only after `useProfileRole` resolves. (Does not fully resolve — see server prerequisite blocker.)

## Final test result: 2/5 pass

| Test | Before | After | Root Cause |
|------|--------|-------|------------|
| Journey 1: priority bump | FAIL | PASS | Fixed: `.first()` strict mode |
| Journey 2 test 1: targeted audience | FAIL | FAIL | Blocker: Wave A not on dev server |
| Journey 2 test 2: Alle audience | FAIL | PASS | Fixed: timeout bump |
| Journey 3 test 1: pin | FAIL | FAIL | Blocker: Wave A not on dev server |
| Journey 3 test 2: unpin | FAIL | FAIL | Blocker + code bug (see escalation) |

## Escalation: 3 remaining failures

### Failure 1+2: Wave A code not on development (Journey 2 test 1, Journey 3 test 1)

**Root cause**: The running web server (port 3060) is launched from `/home/sxtnl/wsl/smartout.ai` (main repo, `development` branch). Wave A code (`AudiencePicker`, `NewsCardMenu`, `PinnedStrip`, `use-pin-message`, `pin-message-action`) lives on `feat/nyheter-engagement-wave-a` which is NOT merged to development. The specs test UI interactions that require Wave A components to be present on the server.

Journey 2 test 1 expects `AudiencePicker` tabs (`role=tab`, label "Avdeling") — not present on development server. Journey 3 test 1 expects `NewsCardMenu` button ("Mer") — not present on development server.

**Fix**: Merge `feat/nyheter-engagement-wave-a` → development. Pontus's call.

**Not a test-infra issue.** Specs are correct; server lacks Wave A code.

### Failure 3: Wave A code bug — activity_trail routing (Journey 3 test 2)

**Root cause**: `packages/telemetry/src/registry.ts` entry for `"channel.message.unpinned"` lists destinations `["posthog", "logger"]` only. It is missing `"activity_trail"`. The Wave A branch (`feat/nyheter-engagement-wave-a`) has `["posthog", "logger", "activity_trail"]` — but this change was never merged to development.

Journey 3 test 2 asserts `activity_trail` row after unpin — this assertion will always fail until the registry is patched.

**File**: `packages/telemetry/src/registry.ts` line ~9720 (current development):
```ts
"channel.message.unpinned": {
  destinations: ["posthog", "logger"],  // missing "activity_trail"
  category: "channels",
},
```

**Fix needed** (separate sortie, untouchable in this sortie per scope):
```ts
"channel.message.unpinned": {
  destinations: ["posthog", "logger", "activity_trail"],
  category: "channels",
},
```

Journey 3 test 2 also has the server prerequisite gap (PinnedStrip missing from dev server), so both blockers must be fixed before test 2 can pass.

## Decisions made

1. **Cherry-pick over re-write**: The correct spec files and helper functions existed on `feat/nyheter-engagement-wave-a` from earlier work. Cherry-picking was the right approach to avoid drift — no re-authoring.

2. **Do not adapt specs to legacy UI**: When the server didn't have Wave A components, the option of rewriting specs against the legacy Select/NyheterClient was rejected. The specs test Wave A behaviors — adapting them to test legacy behavior would defeat the purpose.

3. **Escalate registry bug, not smuggle fix**: `channel.message.unpinned` missing `activity_trail` is a Wave A code bug in `registry.ts`. This file is explicitly untouchable in this sortie. Reported here; separate sortie required.

## Known issues / debt

- Journey 2 test 1 and Journey 3 test 1+2 remain red pending Wave A merge to development.
- `channel.message.unpinned` registry fix needs a follow-up sortie targeting `packages/telemetry/src/registry.ts`.

## Next steps

1. **Merge `feat/nyheter-engagement-wave-a` to development** (Pontus decides timing). Once merged, restart dev server from the main repo so it picks up Wave A code.
2. **Open new sortie: `feat/nyheter-telemetry-registry-fix`** — single-line fix to add `"activity_trail"` to `"channel.message.unpinned"` destinations in `registry.ts`.
3. **Re-run `pnpm exec playwright test komm-nyheter`** after both fixes to validate all 5 pass.

## Commits

| SHA | Description |
|-----|-------------|
| `2167a5b21` | fix(nyheter): bridge e2e specs to admin's actual session workspace (cherry-pick) |
| `d115c5989` | fix(test): seedProfile creates auth.users + fix Wave A spec selectors (cherry-pick) |
| `5d62f3ba3` | fix(playwright): bump per-test timeout 30s to 60s for Turbopack cold-compile |
| `0dfcc0d9d` | fix(komm-nyheter): stabilize Journey 1+2+3 selector issues |

## Wave A app code changes: zero

```
git diff 36e5c243e HEAD --name-only
apps/e2e/helpers/auth.ts
apps/e2e/helpers/seed.ts
apps/e2e/komm-nyheter/journey-1-priority-bump.spec.ts
apps/e2e/komm-nyheter/journey-2-audience-targeting.spec.ts
apps/e2e/komm-nyheter/journey-3-pin-unpin-realtime.spec.ts
apps/e2e/playwright.config.ts
apps/e2e/tsconfig.json
```

All diffs in `apps/e2e/` only. No Wave A app code touched.
