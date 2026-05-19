---
title: "Plan — p0-e2e-followup"
status: in_progress
updated: 2026-05-19
created: 2026-05-19
module: Mobile
tags: [plan, e2e, mobile, p0]
---

# Plan — p0-e2e-followup

> Branch: `feat/mobile-p0-e2e-followup` | Worktree: /home/sxtnl/dev/smartout.ai-mobile-wt-3 | Base: `campaign/mobile` | Module: Mobile | Started: 2026-05-19

## Goal

Add Playwright E2E specs covering the 4 P0 fixes from `feat/mobile-p0-fix-sweep` so that they
fail on `campaign/mobile` (pre-fix) and pass once that branch merges.

## Context

The P0 fixes are on `feat/mobile-p0-fix-sweep` (not yet merged to `campaign/mobile`). Tests
intentionally assert post-fix behavior — reviewers must run them after merge.

## P0 Areas

| ID | Fix | BFF/file | Spec |
|----|-----|----------|------|
| P0-A | `complete_task` POST + `source` discriminator | `/api/mobile/tasks/[id]/complete` POST route | `sortie-p0-fix-sweep-task-complete-source.spec.ts` |
| P0-B | `useCreateTask` emits canonical `"task created"` | `use-create-task.ts` + `addTaskAction` pipeline | `sortie-p0-fix-sweep-task-created-canonical.spec.ts` |
| P0-C | shift-chat replaced by unavailability banner | `ShiftChatUnavailableBanner.tsx` (RN component) | `sortie-p0-fix-sweep-shift-chat-banner.spec.ts` (SKIPPED — no mobile UI infra) |
| P0-D | `lønnsslipp` → `lønnsgrunnlag` in 5 files | `strings.ts` + payroll screens | `sortie-p0-fix-sweep-payroll-lonnsgrunnlag.spec.ts` (SKIPPED — no mobile UI infra) |

## Tasks

- [x] Read existing specs + helpers (sortie-1, personal-harness)
- [x] Write `sortie-p0-fix-sweep-task-complete-source.spec.ts` (P0-A — 6 tests)
- [x] Write `sortie-p0-fix-sweep-task-created-canonical.spec.ts` (P0-B — 4 tests)
- [x] Write `sortie-p0-fix-sweep-shift-chat-banner.spec.ts` (P0-C — SKIPPED with TODO)
- [x] Write `sortie-p0-fix-sweep-payroll-lonnsgrunnlag.spec.ts` (P0-D — SKIPPED with TODO)
- [x] Typecheck: `pnpm --filter e2e typecheck`
- [x] Write HANDOFF + JOURNEY docs

## Acceptance Criteria

- [x] `pnpm --filter e2e typecheck` passes with 0 errors
- [x] P0-A + P0-B specs have executable tests (no `.skip`)
- [x] P0-C + P0-D specs document missing infra via `test.skip` with TODO citation
- [x] Each spec self-contained; cleanup in `afterAll`
- [x] No new tables, no schema changes, no ADR files touched
