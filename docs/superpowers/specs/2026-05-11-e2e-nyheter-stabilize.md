---
title: E2E Nyheter Stabilize
status: approved
created: 2026-05-11
updated: 2026-05-11
module: MODULE_COMMUNICATION
tags: [e2e, playwright, nyheter, test-infrastructure, wave-a-followup]
---

# E2E Nyheter Stabilize

> Test-infrastructure-only sortie. No app code changes. Closes 4/5 live Playwright failures from Wave A.

## What

Close the 4 outstanding live Playwright failures in `apps/e2e/komm-nyheter/`:

1. **Journey 1 priority-bump**: `notification_outbox` query returns empty for `event_key="announcement.published"`. Likely workspace_id mismatch between admin's session vs spec query. DB-trace via service role to confirm where the trigger writes, then align spec assertion.
2. **Journey 2 targeted + Alle (×2)**: `page.goto("/dashboard/komm/nyheter")` times out at 30s during Turbopack cold-compile. Either bump playwright per-test timeout to 60s, OR add a `beforeAll` warm-up navigation that triggers compile before tests start.
3. **Journey 3 pin test 1**: Seeded announcement card not visible. `channel_member` upsert may not flow through `get_my_channels` RPC for admin. Investigate RLS filter + RPC return shape.
4. **Journey 3 unpin test 2**: `audit?.[0]?.entity_id` undefined after unpin emit. Verify `channel.message.unpinned` activity_trail routing (added in Wave A Pre-task A) actually writes a row at runtime; check `emit()` provider routing.

## Why

Wave A merged with HONEST E2E gap — 4/5 specs fail on test infrastructure, NOT Wave A code bugs. Closing the gap restores full E2E coverage AND validates the integration paths Wave A claimed to ship.

## Sources of truth

- Wave A HANDOFF deferred sortie #8: `docs/HANDOFF-nyheter-engagement-wave-a.md`
- Spec files: `apps/e2e/komm-nyheter/journey-{1,2,3}-*.spec.ts`
- Seed helpers: `apps/e2e/helpers/seed.ts`, `helpers/auth.ts`, `helpers/cleanup.ts`
- Playwright config: `apps/e2e/playwright.config.ts`
- Telemetry routing: `packages/telemetry/src/registry.ts` (channel.message.unpinned line ~9626)

## Constraints

- **Test infrastructure ONLY.** Do NOT modify any Wave A app code, hooks, components, migrations, Server Actions, or telemetry registry routing. If a failure reveals a real bug in Wave A code, STOP and escalate — that's a separate sortie.
- **No mocking of failures.** If a spec asserts a real Wave A behavior and that behavior IS broken, the spec must fail; the fix belongs in a different sortie.
- **Acceptable solutions:** timeout bump, warm-up navigation, service-role query refinement, helper extension (e.g. `seedAuthUserInWorkspace`), spec selector adjustment, RLS-aware query refactor.

## Out of scope

- Wave A app code changes (any)
- New Playwright config infra beyond timeout + maybe warm-up
- Cross-workspace E2E auth (the auth fixture sortie is separate)

## Acceptance

- 4/5 currently-failing specs pass via live `pnpm exec playwright test komm-nyheter`
- Or: if a failure reveals real Wave A code bug, sortie closes early with handoff that documents the bug + cuts new sortie for the fix
- All decisions documented in HANDOFF
