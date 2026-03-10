---
title: Session Log
status: in_progress
updated: 2026-03-10
created: 2026-03-02
module: cross-cutting
tags: [session, continuity]
---

## Last Session

| Field    | Value                    |
| -------- | ------------------------ |
| Date     | 2026-03-10               |
| Branch   | `feat/journey-engine`    |
| Feature  | journey-engine + cleanup |
| Worktree | wt-2                     |
| Status   | paused                   |

### What was done

1. **Route rename `/onboarding` → `/setup`** — Workspace setup wizard route renamed. 80+ files moved, 14 docs updated, all landing CTA links updated, E2E tests updated.
2. **Redirect condition changed** — Dashboard no longer checks `onboarding_completed` flag. Now uses `isWorkspaceEmpty()` (0 departments AND ≤1 profile). Workspace with real data never gets redirected.
3. **Env import dialog fixes** — Overflow handling (max-h-90vh flex layout), unmatched keys now imported as new vault entries (not skipped), duplicate env var deduplication (fixes React key warning).
4. **HQ Workspace fixed** — Set `onboarding_completed = true` in local DB.

### Where we stopped

- All changes uncommitted (116 files). Needs commit before merge.
- Typecheck green (web + landing).
- Phase 1-3 journey engine still complete from previous session.

### Known blockers / errors

- WSL2 missing Chromium system deps — E2E tests use fetch instead of browser
- Worktrees don't get .env.local — must symlink from main repo
- `send_notification` handler is still a console.log stub

### Pending decisions

- [ ] Commit the 116 uncommitted files (route rename + dialog fixes)
- [ ] Merge feat/journey-engine to development?
- [ ] Phase 4 scope: error handling, idle detection, A/B — when?
- [ ] Workspace setup wizard trigger logic — should it use same `isWorkspaceEmpty` check instead of 4-module check?
- [ ] accept-invitation EF still doesn't emit invitation_accepted event (Gap 6)
