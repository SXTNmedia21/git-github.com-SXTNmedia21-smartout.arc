# WalkAi Bridge Builder — Agent Memory

- [Telemetry pre-existing errors in worktrees](telemetry-build-errors.md) — `@smartout/telemetry` TS2307 is normal in un-built worktrees; pre-exists in all files
- [Missing shared dashboard components](missing-shared-components.md) — PageTabNav and KpiAccentTile are imported widely but were not yet implemented. Created PageTabNav at `apps/web/src/components/dashboard/PageTabNav.tsx` and KpiAccentTile at `packages/ui/src/components/kpi-accent-tile.tsx` (exported via packages/ui/src/index.ts) during F7 (policies page build).
