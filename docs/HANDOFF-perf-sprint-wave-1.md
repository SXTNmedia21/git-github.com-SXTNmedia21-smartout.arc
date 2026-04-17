---
title: HANDOFF — perf-sprint-wave-1
status: ready-for-merge
updated: 2026-04-17
created: 2026-04-17
module: performance
tags: [performance, adr-0091, adr-0113, adr-0114, adr-0115, rsc, dashboard-context]
---

# HANDOFF — perf-sprint-wave-1

## Summary

Wave 1 of the web performance sprint shipped the governance write-gate
(ADR-0091 WP3), decomposed `DashboardContext` into four focused contexts
(ADR-0113), migrated ten dashboard routes to the RSC + streaming skeleton
pattern (ADR-0115), and promoted ADR-0114 (Server Actions as canonical
mutation primitive) to `accepted`. Six parallel agents executed the work
across 15 commits on top of `development@c33396ff`; no file-boundary
contamination surfaced during integration review. Monorepo typecheck and
lint both pass with zero errors; the new `smartout/no-direct-supabase-write`
ESLint rule is active at `warn` and flags 424 call sites for follow-up
migration to `gatedInsert/Update/Delete`.

## Commits

| Hash | Subject |
|------|---------|
| `b90dc1f5` | feat(gate-client): add gatedInsert/Update/Delete + ESLint rule |
| `42781ce1` | docs(telemetry): add registry audit 2026-04-17 per ADR-0114 |
| `92c71128` | refactor(dashboard): split DashboardContext into 4 focused contexts |
| `bd7b19d0` | refactor(billing): migrate to RSC pattern per ADR-0115 |
| `ef939820` | refactor(cost): migrate to RSC pattern per ADR-0115 |
| `d82ff2db` | refactor(year-wheel): migrate to RSC pattern per ADR-0115 |
| `dca3fd9b` | refactor(my-salary): migrate to RSC pattern per ADR-0115 |
| `5d26de88` | refactor(reconciliation): migrate to RSC pattern per ADR-0115 |
| `c612c7ae` | refactor(my-cv): migrate to RSC pattern per ADR-0115 |
| `0fa6daa5` | refactor(komm): migrate to RSC pattern per ADR-0115 |
| `69773c10` | refactor(website): migrate to RSC pattern per ADR-0115 |
| `d91bb1c7` | refactor(close): migrate to RSC pattern per ADR-0115 |
| `f8e6832e` | refactor(onboarding-assistant): migrate to RSC pattern per ADR-0115 |
| `91f9144c` | refactor(ai): migrate to RSC pattern per ADR-0115 |
| `57e52d63` | docs(adr): promote ADR-0114 to accepted |

(15 commits total — the mission brief listed 14; the A1 gate commit
`b90dc1f5` is the foundational prerequisite that every other commit
builds on.)

## Decisions made

- **ADR-0091 WP3 shipped** — `gatedInsert` / `gatedUpdate` / `gatedDelete`
  landed in `packages/supabase/src/gate-client.ts` with the companion
  ESLint plugin at `packages/eslint-config/plugins/smartout/rules/no-direct-supabase-write.mjs`.
  The rule is wired into `packages/eslint-config/next.mjs` at `warn`
  severity; it flags every direct `.from(...).insert/update/delete()`
  call that does not route through the `cascade_gate_write` RPC.
- **ADR-0114 promoted to `accepted`** — Server Actions are now the
  canonical user-initiated mutation primitive. Capability authority
  relation codified: `ctx.supabaseAdmin` writes inside capabilities go
  through the same gate RPC. The decision log (`docs/decisions/0000-decision-log.md`)
  and ADR file both updated in commit `57e52d63`.
- **ADR-0113 split done, consumer migration deferred** — `DashboardContext`
  has been decomposed into four focused contexts
  (`WorkspaceContext`, `AdminContext`, `ScheduleCoordinationContext`,
  `ThemeContext`) plus a `useDashboard` facade hook that preserves the
  legacy API surface. The 155 existing `useDashboard` consumers are
  untouched this sprint — they continue to work through the facade.
  Sprint 2 will migrate call sites to the specific slice hooks.
- **RSC migration pattern (ADR-0115) applied to 10 routes** —
  `billing`, `cost`, `year-wheel`, `my-salary`, `reconciliation`,
  `my-cv`, `komm`, `website`, `close`, `onboarding-assistant`, and `ai`.
  Each route now has a Server Component `page.tsx`, a streaming
  `loading.tsx` Nordic Split skeleton, and a `*-page-client.tsx` that
  hydrates the interactive surface. `/dashboard/schedule` remains
  explicitly excluded per ADR-0032.

## Learnings discovered

- **L-A** Concurrent agent commits need tight file-scoped staging.
  Six agents worked in parallel on `feat/perf-sprint-wave-1` without
  a worktree per agent. The file boundaries held because each agent
  owned a single route or package, but `git add -A` would have been
  catastrophic — we enforced per-file staging in the dispatch brief,
  which is the pattern to repeat for future parallel-agent sprints.
- **L-B** The `governance` route is a redirect-only one-liner.
  It was included in the ADR-0115 target list but did not need RSC
  work — the page re-exports a redirect component and has no data
  fetching. The plan should mark "inspect before migrating" routes
  as a separate category from the default RSC migration pattern.
- **L-C** Telemetry registry has 213 phantom entries (54% of registry).
  The A2 audit report at `docs/reports/telemetry-registry-audit-2026-04-17.md`
  catalogues 213 registered events that no `emit()` call site actually
  fires, plus 4 `useMutation` sites that fire without an entry in the
  registry at all. The phantom entries are low-risk (they do no harm
  at runtime) but they inflate the surface area auditors must review,
  so cleanup is queued as follow-up.

## Known issues / debt

1. **Four `useMutation` sites missing `emit()`** — `ReconciliationView`,
   `DailyNoteSheet`, `ReservationSheet`, and `use-notifications` all
   perform writes without a telemetry emit in `onSuccess`. Captured in
   the A2 audit report. These predate this sprint but are re-flagged
   here because ADR-0114 raises the bar ("every mutation must emit").
2. **12 client-only dashboard routes still un-migrated** — schedule is
   excluded permanently (ADR-0032). The remaining 11 will migrate in
   Sprint 3 following the same RSC + Nordic-skeleton pattern. List:
   `dashboard/admin-daily`, `dashboard/employees`, `dashboard/handbook`,
   `dashboard/policies`, `dashboard/protocols`, `dashboard/readiness`,
   `dashboard/settings`, `dashboard/team`, `dashboard/teams`,
   `dashboard/training`, `dashboard/workspace`.
   (Cross-check this list before Sprint 3 begins — routes may have
   been added/removed during parallel work.)
3. **155 `DashboardContext` consumers still on the facade.** The
   `useDashboard()` hook continues to work but now funnels through
   the split contexts. Migration to `useWorkspace()`, `useAdmin()`,
   `useScheduleCoordination()`, and `useTheme()` is queued for Sprint 2
   so each call site only re-renders on the slice it actually reads.
4. **`smartout/no-direct-supabase-write` is at `warn`, not `error`.**
   It reports 424 warnings across `apps/web/`. Escalation to `error`
   must wait until Sprint 2+ migrates the call sites — flipping it
   today would break the build.

## Next steps

1. **Sprint 2 — consumer-site migration.** Migrate 155 `useDashboard()`
   call sites to slice-specific hooks (`useWorkspace`, `useAdmin`,
   `useScheduleCoordination`, `useTheme`). Unlocks the perf win from
   ADR-0113.
2. **Escalate `smartout/no-direct-supabase-write` from `warn` to `error`**
   once call-site migration is done. Gate merges on zero direct writes
   outside `gate-client.ts` itself.
3. **Phantom event cleanup per A2 audit.** Remove the 213 unused
   registry entries and add the 4 missing emits flagged above. One
   commit, one clean-up PR; no functional change.
4. **Sprint 3 — remaining RSC routes.** Apply ADR-0115 pattern to the
   11 remaining client-only dashboard routes. Re-verify the route
   list first — several may be scheduled for deletion per the mobile
   strategy freeze (ADR-0133).

## Verification record

- `git log development..HEAD` → 15 commits, no contamination across
  file boundaries.
- `pnpm turbo typecheck` on `feat/perf-sprint-wave-1` →
  33/33 successful, exit 0, log at `/tmp/perf-wave-1-typecheck.log`.
- `pnpm turbo typecheck` on `development@c33396ff` baseline →
  33/33 successful, exit 0, log at `/tmp/baseline-typecheck.log`.
  No new type errors introduced.
- `pnpm turbo lint` on `feat/perf-sprint-wave-1` → 19/19 successful,
  exit 0. 906 warnings total (0 errors). 424 of those are the expected
  `smartout/no-direct-supabase-write` warnings introduced by the new
  rule. Log at `/tmp/perf-wave-1-lint.log`.
