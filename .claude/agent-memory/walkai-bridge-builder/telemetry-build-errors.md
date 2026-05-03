---
name: Telemetry build errors in worktrees
description: @smartout/telemetry TS2307 is a pre-existing workspace build issue, not a code error
type: feedback
---

`@smartout/telemetry` (and `@smartout/utils`, `@smartout/ai/agents/*`) show TS2307 "Cannot find module" in all worktrees because these packages are built only on `pnpm build` — not pre-built in the worktree checkout.

**Why:** Workspace packages under `packages/` export from `dist/` or `src/` via `package.json#exports`. In a freshly checked-out worktree without running `pnpm build`, the dist does not exist, so tsc cannot resolve the types.

**How to apply:** When counting "new errors introduced by our code" — filter errors by file path to our new files. Any TS2307 for `@smartout/telemetry` or `@smartout/utils` in our files mirrors the SAME error in existing files (e.g., `people-actions.ts`). Do NOT treat this as a code defect in new files. Report to user as "pre-existing workspace build issue, not introduced by this change."
