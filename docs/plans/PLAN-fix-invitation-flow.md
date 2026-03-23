---
title: "Plan — fix-invitation-flow"
status: in_progress
updated: 2026-03-22
created: 2026-03-22
module: core
tags: [plan, invitation, auth, company-member]
---

# Plan — fix-invitation-flow

> Branch: `feat/fix-invitation-flow` | Module: core

## Goal

Fix 5 identified gaps in the user invitation and registration flow.

## Full Plan

See: `docs/superpowers/plans/2026-03-22-fix-invitation-flow.md`

## Scope

### In scope

- accept-invitation: create company_member row on acceptance
- accept-invitation: replace listUsers() with filtered email lookup
- company_member: unique constraint + INSERT RLS policy
- Invitation expiry cleanup function
- Resend invite UI (wire existing stub button)

### Out of scope

- Cron job for expiry (function only, hookup later)
- Rate limiting on token acceptance
- Bulk resend

## Tasks

| #   | Task                                           | Status  |
| --- | ---------------------------------------------- | ------- |
| 1   | Replace listUsers() with filtered lookup       | pending |
| 2   | Create company_member row on invite accept     | pending |
| 3   | Handle idempotent path + extract helper        | pending |
| 4   | Migration: constraint + RLS + cleanup function | pending |
| 5   | Implement invitation resend                    | pending |
| 6   | Typecheck and final verification               | pending |

## Acceptance Criteria

- [ ] accept-invitation creates company_member row
- [ ] accept-invitation uses filtered email lookup (not listUsers)
- [ ] company_member has unique constraint on (user_id, company_id)
- [ ] company_member has INSERT RLS policy
- [ ] expire_stale_invitations() function exists
- [ ] "Resend Invite" button works
- [ ] pnpm turbo typecheck passes
- [ ] pnpm lint passes
