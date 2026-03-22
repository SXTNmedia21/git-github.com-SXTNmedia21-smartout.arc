---
title: Decision Log
status: in_progress
updated: 2026-03-22
created: 2026-03-22
module: cross-cutting
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
