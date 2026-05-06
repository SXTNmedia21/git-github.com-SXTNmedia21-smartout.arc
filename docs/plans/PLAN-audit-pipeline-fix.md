---
title: "Plan — audit-pipeline-fix"
status: in_progress
updated: 2026-05-02
created: 2026-05-02
module: telemetry
tags: [plan, telemetry, billing, settlement, audit, avstemming]
---

# Plan — audit-pipeline-fix

> Branch: `feat/order-system-audit-pipeline-fix` | Worktree: /home/sxtnl/dev/smartout.ai-order-system-wt-9 | Base: `campaign/order-system` | Module: telemetry | Started: 2026-05-02

## Goal

Restore the ADR-0262 audit guarantee: every settlement run/download/artifact event must land a row in `billing_activity_log`. M7c merged with this guarantee vacuously satisfied — events were silently dropped at destination providers.

## Root Causes

1. `activity-trail.ts` treated `workspace_id: null` as an anomaly (warn + drop). Settlement events pass `null` deliberately (they span multiple workspaces).
2. `billing-activity-log.ts` read only FLAT entity shape. Settlement events use NESTED `props.entity.entity_type` per registry interface definitions.
3. `actions.ts` emitted `run_initiated` with `entity_id: "pending"` — non-UUID, R1 corruption class.
4. Artifact route emitted `artifact_downloaded` with entity `settlement_run` instead of `settlement_artifact`.
5. Order download routes used `await emit()`, blocking the Response in violation of ADR-0262 fire-and-forget mandate.

## Tasks

- [x] T1 — `activity-trail.ts`: explicit early-return for `workspace_id === null` (routing boundary, not error)
- [x] T2 — `billing-activity-log.ts`: accept both flat + nested entity shapes via shared `resolveEntityRef`
- [x] T3 — `actions.ts`: move `run_initiated` emit to after `executeSettlementRun` with real `run_id`
- [x] T4 — artifact route: fix entity to `settlement_artifact` + `artifactRow.artifact_id`
- [x] T5 — order download routes: `await emit` → `void emit(...).catch(console.error)`
- [x] T6 — ADR-0262: add Amendment 1 — platform-scoped events routing
- [x] T7 — vitest: assert settlement events reach billing_activity_log with nested entity shape

## Acceptance Criteria

- [x] Typecheck passes: `pnpm turbo typecheck`
- [x] `pnpm --filter @smartout/telemetry test` passes
- [x] Decision log updated (ADR-0262 amended)
- [x] User journeys written
