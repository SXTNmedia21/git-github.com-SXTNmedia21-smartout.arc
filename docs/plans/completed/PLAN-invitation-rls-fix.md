---
title: "Plan — invitation-rls-fix"
status: done
updated: 2026-04-06
created: 2026-04-06
module: onboarding
tags: [plan]
---

# Plan — invitation-rls-fix

> Branch: `feat/invitation-rls-fix` | Worktree: wt-11 | Module: onboarding | Started: 2026-04-06

## Goal

Make the critical invitation path work end-to-end: Admin invites → Email arrives → User clicks link → User is in the app.

## Tasks

- [x] Task 1: Migration — RPC + RLS policy fix (drop USING(true), create get_invitation_by_token)
- [x] Task 2: Fix profile status to active directly (remove trainee→active two-step)
- [x] Task 3: Batch invite email dispatch (handleBatchInvites sends emails, CSV skips)
- [x] Task 4: Accept page RPC + existing user detection (sign-in vs create-account)
- [x] Task 5: Verification — typecheck 27/27, RLS lockdown confirmed
- [x] Task 6: Council review — APPROVE WITH CHANGES, event_type mismatch fixed

## Acceptance Criteria

- [x] Typecheck passes: `pnpm turbo typecheck` (27/27)
- [x] Decision log updated (3 entries)
- [ ] User journeys written
