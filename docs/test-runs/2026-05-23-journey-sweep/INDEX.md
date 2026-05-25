---
title: Journey Verification Sweep — 2026-05-23/24
status: complete
updated: 2026-05-24
created: 2026-05-23
module: meta
tags: [test-run, journey-verification, playwright]
---

# Journey Verification Sweep — 2026-05-23/24

See **[REPORT.md](REPORT.md)** for findings, bugs, and recommended actions.

## What this directory contains

| File / Folder | Purpose |
|---|---|
| `REPORT.md` | Final synthesis — bugs, recommended actions, aggregate counts |
| `INDEX.md` | This file — directory map |
| `journeys/J-NN-*.md` | Per-journey result write-ups (selected) |
| `evidence/run-NN-*.log` | Raw Playwright output per suite |

## Aggregate (23 suites, ~258 test cases)

- ✅ **~71 PASS** — auth, signup, onboarding wizard, engine-world bulk, contract-walt, contract DB enforcement, bulk-import
- ❌ **~45 FAIL** — see REPORT.md §Bugs Found (8 product + schema bugs, 3 harness bugs, 1 OPS issue)
- ⚠️ **~105 SKIP** — preconditions / env gaps
- ⏭️ **~37 DID NOT RUN** — early teardown failure cascades (BUG-8)

## Environment used

- Branch: `development` @ `b2b6770e`
- Supabase Local: 54321 (running pre-sweep)
- apps/web: 3060 (started during sweep, killed once mid-run, restarted)
- apps/admin: 3070 (started mid-sweep for admin/ specs)
- apps/landing: 3056 (not started — skipped via SKIP_WEB_SERVER=1)

## Sweep cadence

- Start: 2026-05-23 23:43 CEST (Saturday late evening)
- End: 2026-05-24 08:15 CEST (Sunday morning)
- 23 spec suites run sequentially + parallel-batched where RAM allowed
- ~3 batch generations, multiple OOM recoveries, 1 web restart

## NOT in scope

- Mobile (Maestro / device required)
- All 526 JOURNEY-*.md (filtered to ~28 user-traversable per goal Q1)
- Writing new specs (existing 249 specs already cover most journeys)
- Code changes / commits / migrations / deploys (read-only verification only)
