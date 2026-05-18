---
title: "Handoff — ui-shell staff-prefetch + mobile-shift end-to-end"
feature: ui-shell-staff-prefetch
branch: feat/ui-shell-staff-prefetch
closed: 2026-05-18
module: mobile-schedule
tags: [handoff, mobile, schedule, calendar, ui-shell]
---

# Handoff — ui-shell staff-prefetch + mobile-shift end-to-end

## Summary

Originally scoped as a single hook (`useTeamStaff`) to prefetch the workspace
staff list independent of ShiftListScreen scope so the Ansatt-dropdown stays
populated across scope changes. Closes the ADR-0266 backlog point at
`apps/mobile/app/(app)/(shifts)/index.tsx:412-416`.

Scope expanded after PWA testing surfaced five additional bugs in the
shift-confirm + calendar-tap + drawer-close path. All six fixes are bundled
into commit `63c3b5786` (mobile) + commit `18b0f5cec` (web CORS) — the
mobile-shift loop now works end-to-end PWA → BFF → DB with telemetry landing
in `activity_trail`.

## Journeys Delivered

| Journey | Status | Verification |
|---|---|---|
| Ansatt-dropdown viser hele teamet uavhengig av scope | verified | manual PWA |
| Manager filtrerer per person fra hele-teamet-view | verified | manual PWA |
| Vaktliste rendrer team-vakter for uka | verified | curl + DB row count (2 shifts) |
| Tap shift → dedicated detail-screen | verified | manual PWA — vaktliste + kalender |
| Bekreft vakt end-to-end | verified | activity_trail row 09:46:34 + 200-response |
| Lukk DetailSheet drawer | verified | manual PWA |

## Decisions Made

No new ADRs. All six fixes are bug-class corrections aligned with existing
ADRs:

- ADR-0151 + L-0177 — `confirmed_at` / `confirmed_by` resolved server-side
  from JWT + now(), never accepted from request body. Sync queue payload
  dropped those fields.
- ADR-0132 + ADR-0134 — mobile BFF endpoints under `/api/mobile/*`; CORS
  required for PWA cross-origin (Metro :8083 → web :3060 in dev).
- ADR-0266 — vaktliste join column corrected from non-existent `id` to
  canonical `department_id` (PostgREST select was failing silently).
- ADR-0298 — `confirmShiftAction` already emits `"shift confirmed"` via
  `@smartout/telemetry`; verified end-to-end into `activity_trail`.

## Learnings

| Learning | Context |
|---|---|
| @gorhom/bottom-sheet requires `sheetRef.current?.close()` for animated close — state-only cleanup (`setItem(null)`) re-renders into the `index=-1` mount but never plays the slide-down animation. | DetailSheet X / Lukk handlers ran only `setItem(null)`; UI never closed. Split into `requestClose` (drives animation) + `handleClose` (state cleanup wired to `onClose` callback after animation settles). |
| `useTranslation("dashboard")` already scopes to `dashboard.json`; keys must be `sidebar.xxx`, not `dashboard.sidebar.xxx` — the resolver max-depth is 3 parts and tries `dashboard.json["dashboard"][...]` which does not exist, then returns the key as the rendered string. | Same bug class shipped twice in the same session: sidebar labels rendered raw, then `schedule.absence_approval` modal rendered raw. Future audit: grep `t\("[a-z]+\.[a-z]+\.` against `useTranslation\("[a-z]+"\)` namespace usages. |
| Mobile dev server runs from the sub-sortie worktree path; edits to the parent campaign worktree do NOT propagate via HMR — Metro bundles only the file tree it was launched from. | Spent one cycle debugging "the fix isn't loading" — the fix was on the wrong worktree. Lookup: `ps aux \| grep expo` shows the worktree path; edit there. |
| Next.js dev `headers()` config requires a full server restart to reload — but if the previous `next dev` process is still bound to :3060, the restart fails with `EADDRINUSE`. Kill via PID, not via `lsof -ti | xargs kill` (race with re-spawn). | CORS edit landed via existing process picking up `next.config.ts` change on its own. Tracked but no further fix needed. |
| Commitlint `scope-case: kebab-case` rejects `i18n` (digit). Use `dashboard` or `mobile` as scope for translation-only commits. | Caught on retry; mechanical. |

## Known Issues / Debt

- `apps/mobile/src/hooks/queries/use-team-shifts.ts` PositionRow type and
  the corresponding edit in the main ui-shell worktree were the same fix
  applied independently — main worktree's uncommitted edit was discarded
  via `git restore` before the wt-1 merge to avoid identical-but-conflict
  noise. No action needed; merge brings the canonical version.
- `PLAN-staff-prefetch.md` was the original sub-sortie plan; the bundled
  scope is documented here in the handoff + the updated JOURNEY file.
- Bottombar 2-row layout is a static rule; if a third secondary action is
  added later, may need a wrap or overflow strategy.

## Next Steps

1. Operator: verify mobile + web staying up locally for E2E re-test on a
   fresh boot.
2. Follow-up sortie if telemetry coverage expands to also emit on
   `enqueue` failure (currently only on successful BFF round-trip).
3. Consider unifying the kalender shift-card + ItemCard tap handler into
   a single helper since both now route through `openShiftDetail`.
