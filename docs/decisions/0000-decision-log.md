---
title: Decision Log
status: in_progress
updated: 2026-03-22
created: 2026-03-22
module: hms
tags: [decisions]
---

# Decision Log — hms-phase-1

| #   | Date       | Decision                                                                            | Status   |
| --- | ---------- | ----------------------------------------------------------------------------------- | -------- |
| 1   | 2026-03-22 | HMS hooks in apps/web, not packages/hms — depend on DashboardContext and @/ aliases | accepted |
| 2   | 2026-03-22 | packages/hms as skeleton for future mobile parity                                   | accepted |
| 3   | 2026-03-22 | Governance page redirects to /dashboard/hms (old components preserved)              | accepted |
| 4   | 2026-03-22 | Web direct insert for deviations, mobile keeps offline queue                        | accepted |
| 5   | 2026-03-22 | Shared deviation contract (Zod schema) in packages/hms                              | accepted |
| 6   | 2026-03-22 | 3 employee Drift layouts by context (timeline, list, card stack)                    | accepted |
| 7   | 2026-03-22 | Admin Drift = table, Admin Avvik = kanban + list toggle                             | accepted |
| 8   | 2026-03-22 | Soft sign-off with warnings, not hard gates (Phase 3)                               | accepted |
| 9   | 2026-03-22 | CLAUDE.md: mandatory DB schema brainstorm for every feature                         | accepted |

module: cross-cutting
module: unspecified
tags: [decisions]

---

# Decision Log — cascade-foundation

| #   | Date       | Decision                                                                                                                  | Status   |
| --- | ---------- | ------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | 2026-03-22 | Dual-layer architecture: client pure functions for instant feedback + server engine actions for authoritative computation | accepted |
| 2   | 2026-03-22 | Skip server-side RPC for shift validation in this phase — no API consumers yet                                            | accepted |
| 3   | 2026-03-22 | Cost snapshots on both publish (planned) and completion (actual) — append-only                                            | accepted |
| 4   | 2026-03-22 | Push + invalidate for demand propagation (workspace_budget rows)                                                          | accepted |
| 5   | 2026-03-22 | Admin cascade visibility in settings tabs, not a top-level governance page                                                | accepted |
| 6   | 2026-03-22 | Contract-payroll sync via DB trigger (not Edge Function)                                                                  | accepted |
| 7   | 2026-03-22 | Department classification via name matching with confidence levels                                                        | accepted |
| 8   | 2026-03-22 | activate-workspace bootstrap hook deferred due to prompt hook constraint                                                  | deferred |

# Decision Log — fix-invitation-flow

| #   | Date | Decision | Status |
| --- | ---- | -------- | ------ |

# Decision Log — sjohuset-simulator

| #   | Date       | Decision                                                                                         | Status   |
| --- | ---------- | ------------------------------------------------------------------------------------------------ | -------- |
| 1   | 2026-03-23 | ADR-0058: Dedicated simulation schema + services/simulator Hono microservice for cascade testing | proposed |
