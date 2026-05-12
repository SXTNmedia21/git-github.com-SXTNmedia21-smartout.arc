---
title: "Plan — e2e-nyheter-stabilize"
feature: e2e-nyheter-stabilize
spec: ../superpowers/specs/2026-05-11-e2e-nyheter-stabilize.md
status: draft
updated: 2026-05-11
created: 2026-05-11
module: MODULE_COMMUNICATION
tags: [plan, e2e, playwright, test-infra]
---

# Plan — e2e-nyheter-stabilize

> Branch: `feat/e2e-nyheter-stabilize` | Worktree: `/home/sxtnl/dev/smartout.ai-wt-4` | Module: MODULE_COMMUNICATION

**Spec:** [E2E Nyheter Stabilize](../superpowers/specs/2026-05-11-e2e-nyheter-stabilize.md)
**Wave A HANDOFF reference:** deferred sortie #8

## Journeys (the contract)

- [JOURNEY-e2e-nyheter-stabilize-all-specs-green](../journeys/JOURNEY-e2e-nyheter-stabilize-all-specs-green.md) — live `pnpm exec playwright test komm-nyheter` returns 5/5 pass

## Goal

Close 4/5 failing live Playwright specs from Wave A. Test infrastructure only. No Wave A app code changes.

## Investigation order (cheapest first)

- [ ] **T1 — Timeout bump (Journeys 2 ×2)**. Bump per-test timeout 30s → 60s in `playwright.config.ts`. If Turbopack cold-compile was the bottleneck, this closes 2 specs trivially.
- [ ] **T2 — Journey 1 workspace_id trace**. Service-role query: dump `notification_outbox` rows from last 60s. Verify (a) which workspace_id they carry, (b) whether `resolveAdminWorkspaceId()` returns the same id. If mismatch — fix the spec's filter to match admin's actual session workspace.
- [ ] **T3 — Journey 3 RPC visibility check**. After `seedNewsAnnouncement` + `channel_member` upsert, query `get_my_channels(p_workspace_id)` with admin's JWT via service role. Confirm seeded news channel appears in return. If not — investigate RLS filter or RPC query. Spec needs to wait for the page to render the seeded message.
- [ ] **T4 — Unpin activity_trail routing verify**. After spec triggers unpin, query `activity_trail` for `event_name='channel.message.unpinned'`. If absent, trace `emit()` provider routing for the event. Pre-task A of Wave A added `activity_trail` to the routing — verify it actually wired.
- [ ] **T5 — Run live specs**. `pnpm exec playwright test komm-nyheter` — expect 5/5 pass after T1-T4 fixes.

## Acceptance Criteria

- [ ] Journey `all-specs-green` has `status: verified`
- [ ] `pnpm exec playwright test komm-nyheter` returns 5/5 pass
- [ ] HANDOFF written documenting what each fix did + any unexpected finding (e.g. real Wave A bug surfaced → escalate)
- [ ] Zero changes to Wave A app code (only `apps/e2e/`, `playwright.config.ts`, possibly `apps/e2e/helpers/*.ts`)

## Untouchable

- All Wave A app code: `apps/web/src/app/dashboard/komm/_components/`, `_hooks/`, `_actions/`
- `packages/ai/src/capabilities/communication/`
- `packages/telemetry/src/registry.ts`
- `supabase/migrations/*.sql`
- HANDOFF + plan files of Wave A

## Sequencing

3 commits expected:
1. T1 — playwright timeout bump (single config change)
2. T2-T4 — spec/helper adjustments based on investigation
3. T5 + HANDOFF
