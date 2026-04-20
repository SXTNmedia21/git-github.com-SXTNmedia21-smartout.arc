---
title: "Plan — training-schema-foundation"
status: done
updated: 2026-04-14
created: 2026-04-14
module: training
tags: [plan, training, module-6, schema, foundation]
---

# Plan — training-schema-foundation

> Branch: `feat/training-schema-foundation` | Worktree: wt-2 | Module: training | Started: 2026-04-14

## Goal

Establish the complete database foundation and shared data layer for Module 6 Training, unblocking all subsequent sub-projects (A: Admin CRUD, B: Mobile UI, C: Readiness Dashboard).

## Tasks

- [x] Task 1: Database migration — extend protocol_assignment with workspace_id, assigned_via, progress counts, waiver fields, AI columns
- [x] Task 2: Create `@smartout/training` package with shared types and query keys
- [x] Task 3: Move shared hooks (use-assigned-protocols, use-step-completion, use-readiness-score) to packages/training
- [x] Task 4: Wire web app to shared hooks via thin wrappers
- [x] Task 6: Create training AI capability (3 read-only tools)
- [x] Task 7: Full monorepo typecheck — 30/30 packages pass

## Acceptance Criteria

- [x] Typecheck passes: `pnpm turbo typecheck`
- [x] Decision log updated (no new ADRs needed — council-approved plan)
- [x] User journeys written

## Full plan

See `docs/superpowers/plans/2026-04-14-training-module6-subproject0-schema-foundation.md` for the council-reviewed implementation plan.
