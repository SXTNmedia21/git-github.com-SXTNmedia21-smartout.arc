---
title: "Handoff — Procedure Engine Phase 1"
feature: procedure-engine-phase1
branch: development
closed: 2026-05-22
module: procedure-engine
---

# Handoff — Procedure Engine Phase 1

## Summary

First operative slice of the procedure-engine (renamed from task-manager). Delivers the
template → materialization → instance → execution pipe: admin creates a **routine** bound to a
procedure, scopes it to a **location** (+ optional teams), cron expands it into per-step
**session_tasks** (provenance-stamped, day_line-anchored), the employee **clocks in** on mobile
and sees those tasks in **Min dag**, and overdue/newly-assigned tasks fire **notifications**.
Built parallel-team across 3 dependency waves, committed direct to `development`
(`b04c8e4e1`..`893a139cf`, 6 commits). Critical path proven via SQL acceptance smoke.

## Journeys Delivered

| Journey | Status | Verification | E2E test |
|---------|--------|--------------|----------|
| J1 Employee clock-in + Min dag | verified | data-chain + unit; live HTTP not fired | none — debt |
| J2 Admin creates routine | verified | SQL pipe-walk + 31 unit tests | none — debt |
| J3 Routine→location→cron per-step tasks (G6 fix) | verified | SQL pipe-walk 3/3/3 + 12 cron tests | none — debt |
| J4 Manager sets shift location | verified | SQL pipe-walk (propagation + day_line link) | none — debt |
| J5 Notify overdue + assigned | verified | 18 cron source tests; live tick not fired | none — debt |

Full journeys: `docs/journeys/JOURNEY-procedure-engine-phase1.md`.

## Decisions Made

| Decision | Reason | Impact |
|----------|--------|--------|
| Routine scope: location_id + workspace_id (trigger-backfill) + executor_type + routine_team(0..N) | Bind routine to physical location + team set; zero teams = location-wide | ADR-0391; new RLS table routine_team |
| Provenance triple on session_task (origin/generated_by/source_reference) | No task undebuggable; cheap nullable now vs brutal retrofit later | ADR-0391; every producer must stamp |
| Cron expands routine into N per-step tasks (not 1 stub) + day_line anchor | Close G6; ADR-0367 single-area resolution | ADR-0391; session-hook-executor both branches stamp provenance |
| 4→2 task-table consolidation NOT done here | Council: ship C2 now, defer D6 to own ADR | Reserved — future ADR |

Registered: ADR-0391 in `docs/decisions/0000-decision-log.md`.

## Learnings

| Learning | Context |
|----------|---------|
| Local DB drifted behind migrations | History gap 20260621200004→210000; `fn_resolve_single_day_line` (200103) + 2026062120010x batch unapplied. Smoke needed manual apply; resolved via `supabase db reset`. Check local↔migration parity before integration smoke. |
| `web` package already RED on development | Pre-existing payroll/contract `personal_number` / `SelectQueryError` debt — blocks full `web typecheck`. Not this work (none of those files touched). Needs separate fixup before promote. |
| Stale telemetry dist masks registry errors | Sub-agents typecheck against old `dist` and report green; orchestrator must `pnpm --filter @smartout/telemetry build` before the real gate (recurring L-stale-telemetry-dist). |
| Sub-agent commit-collision avoidance held | Plan rule "sub-agents do NOT commit; orchestrator commits per agent" prevented the batch-collision; clean per-wave commits. |
| `trg_ensure_shift_session` gates on employee_id | Bare unassigned shift → no shift_session (early return). J4 only fires for assigned shifts with a matching department_session. |

## Known Issues / Debt

- **E2E tests:** none for any journey — all verification was SQL pipe-walk + unit. J1 (mobile clock-in HTTP) and J5 (pg_cron overdue tick) never fired against running surfaces.
- **`web` typecheck RED** (pre-existing payroll debt) — full `pnpm turbo typecheck` will not be clean until that's fixed; procedure-engine files themselves are clean.
- **Routine create UI** uses plain `useState` (no react-hook-form) per existing ProcedureBuilder pattern — fine, but no client-side zod validation beyond the action's schema.
- **`source_reference` FK-less** — dangling refs not DB-enforced; consumers tolerate.

## Next Steps

- Write E2E (Playwright) for J2 (create routine) + J4 (shift location); mobile detox/manual for J1.
- Fix pre-existing payroll `personal_number` typecheck debt (separate sortie) to unblock full-repo typecheck gate before promote.
- Phase 2: manual table, Sesjonsplanlegger canvas, prep-next-shift projection, version-history + per-version confirm, M:N procedure↔protocol, Botsson image→routine, token-sweep.
- Wire `session-task-overdue-cron` health into smoke-probe (mirrors ADR-0388 pg_cron observability gap).
- Consider the 4→2 task consolidation ADR when D6 work resumes.
