---
title: Learning Log
status: in_progress
updated: 2026-03-22
created: 2026-03-22
module: hms
tags: [learnings]
---

# Learning Log — hms-phase-1

| #   | Date       | Learning                                                                               | Impact                          |
| --- | ---------- | -------------------------------------------------------------------------------------- | ------------------------------- |
| 1   | 2026-03-22 | Profile table uses display_name, not first_name/last_name                              | Fixed CompetenceMatrix query    |
| 2   | 2026-03-22 | Pre-existing help_request type error in use-help-requests.ts                           | Not from HMS, ignored           |
| 3   | 2026-03-22 | DashboardShell wraps children with p-6 md:p-8 — HMS layout should not add own padding  | Avoided double padding          |
| 4   | 2026-03-22 | deviation push trigger uses `id` not `profile_id` — pre-existing bug                   | Seed data needs trigger disable |
| 5   | 2026-03-22 | `supabase gen types` captures stderr warnings in stdout — use `2>/dev/null`            | Fixed corrupt types file        |
| 6   | 2026-03-22 | `npx turbo typecheck` stricter than `npx tsc --noEmit` — catches null issues           | Must run turbo, not just tsc    |
| 7   | 2026-03-22 | Telemetry emit event name must be literal, not dynamic string — TS discriminated union | Split into if/else branches     |
| 8   | 2026-03-22 | `supabase db reset` fails on 20260422300500 channel seed FK — blocks all E2E           | Pre-existing, needs fix         |
| 9   | 2026-03-22 | public schema has 169 tables — need mandatory schema placement brainstorm              | Added to CLAUDE.md rules        |
