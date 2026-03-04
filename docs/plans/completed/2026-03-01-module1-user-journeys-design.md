---
title: "Module 1 User Journeys — Design"
status: done
created: 2026-03-01
updated: 2026-03-03
module: onboarding
tags: [user-journeys, e2e, seed-data, module-1]
---

# Module 1 User Journeys — Design

## Goal

Document the three primary user journeys for Module 1 (Onboarding) as standalone MD files, create SQL seed data for journey checkpoints, and write Playwright E2E tests covering the wizard and invitation flows.

## Deliverables

| Deliverable      | File                                          | Description                                            |
| ---------------- | --------------------------------------------- | ------------------------------------------------------ |
| Admin Journey    | `docs/journeys/admin-workspace-setup.md`      | 15-step wizard flow with edge cases                    |
| Employee Journey | `docs/journeys/employee-invitation-accept.md` | Invite → accept → account → trainee                    |
| Trainee Journey  | `docs/journeys/trainee-mode-core.md`          | Core checkpoints + module journeys → approval → active |
| SQL Seed         | `supabase/seed-journeys.sql`                  | module_journey + checkpoint INSERTs                    |
| E2E Tests        | `apps/e2e/tests/onboarding.spec.ts`           | Updated wizard test + auth step + invite tests         |

## Journey Document Format

Each MD file follows:

- YAML frontmatter (title, status, module, tags)
- Journey overview with ASCII flow diagram
- Step-by-step breakdown: trigger, UI, validation, edge cases, DB effects
- E2E test scenarios
- Acceptance criteria

## SQL Seed Format

- 5 module_journey records (core + scheduling, tasks, haccp, chat)
- ~25 checkpoint records with sort_order, checkpoint_type, event tracking
- Uses UUIDs compatible with future journey engine tables
- Wrapped in transaction, idempotent (IF NOT EXISTS patterns)

## E2E Test Coverage

- Happy path: full wizard with mock crawl + auth skip + finalize
- Auth step: signup during wizard, skip for now
- Invite acceptance: valid token, expired token, invalid token
- Session resume: start wizard, refresh, resume at correct step
