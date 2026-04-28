---
title: "Handoff — c3-1-onboarding-reduced-motion"
feature: c3-1-onboarding-reduced-motion
branch: feat/botsson-arena-c3-1-onboarding-reduced-motion
campaign: botsson-arena
closed: 2026-04-28
module: MODULE_BOTSSON
tags: [onboarding, a11y, reduced-motion, framer-motion, c3, handoff]
---

# Handoff — c3-1-onboarding-reduced-motion

## Summary

A11y conformance pass on the cinematic onboarding track. Applied
ADR-0177's `useReducedMotion()` guard pattern to all seven `framer-motion`
components in `apps/web/src/app/onboarding/components/`. Pure pattern
application — no new ADR, no spring re-tuning, no visual redesign.
Closes the onboarding leg of the ADR-0177 surface sweep; dashboard tour
and year-wheel surfaces remain unaudited (debt).

## Journeys Delivered

| Journey | Status | E2E test |
|---------|--------|----------|
| c3-1-onboarding-reduced-motion (reduced-motion user + default user paths) | verified | none — accepted as debt; manual DevTools `prefers-reduced-motion: reduce` emulation documented in JOURNEY |

## Decisions Made

| Decision | Reason | Impact |
|----------|--------|--------|
| No new ADR | ADR-0177 already accepted; C3.1 = pattern application across onboarding surface | Closes review-cycle risk; `useReducedMotion` becomes house pattern via clean conformance audit |
| Keep existing onboarding springs (e.g. checkmark 500/25) — do not retune to ADR-0177's runner spring (35/22/2.2) | ADR-0177 spring constants govern the journey runner state machine, not all surfaces. Onboarding is content-driven, runner is a 6-state machine. Different motion budgets. | Preserves onboarding feel; clarifies ADR-0177 as *pattern* source, not global spring authority |
| `initial={false}` (not `initial={undefined}`) on every motion node when `prefersReducedMotion` is true | framer-motion v11: only `false` truly skips entrance; `undefined` re-runs variants | Verified canonical skip-entrance signal |

No entries needed in `docs/decisions/0000-decision-log.md` — ADR-0177 already
registered.

## Learnings

| Learning | Context |
|----------|---------|
| Bar visualizers can't fix motion-prefs by zeroing `transition.duration`. They use `animate` keyframe arrays which loop regardless when `repeat: Infinity`. | Had to collapse the keyframe array to a static object gated on `isSpeaking` for `VoiceSessionOverlay`. Same shape will hit any future audio-meter / activity-pulse surface. |
| Two-pass commit pattern needed when scoping by grep. | First commit `46f9d9ba` covered 5 files; BigBoard + VoiceSessionOverlay missed because not in initial grep window. Discovered via dirty tree on `/status`. Second commit `e9553d11` closed gap. Lesson: grep `apps/web/src/app/onboarding/**` exhaustively, not just files known to use motion at scoping time. |
| `database.types.ts` regen has a stderr-leak failure mode. | First 4 lines (`npm warn`, `WARN: env`, `Connecting to db`) bleed into the .ts file when stderr is redirected before stdout in the regen script. Fixed twice now (`46f9d9ba` on c3-1, `39692364` on campaign). The regen wrapper script needs a permanent fix to silence stderr or filter the prefix. |

## Known Issues / Debt

- **No automated a11y test** asserts `prefers-reduced-motion: reduce` zeros all transitions on this surface. Manual verification only (DevTools → Rendering → Emulate CSS media `prefers-reduced-motion`).
- **Other surfaces unaudited:** dashboard tour, year-wheel reveal animations, deviation-bridge modal, and any future surface using `framer-motion` outside `apps/web/src/components/journey/*` remain ADR-0177-non-compliant. Recurring sweep recommended.
- **Pre-existing absence_type runtime mismatch:** `apps/mobile/src/hooks/mutations/use-request-absence.ts` accepts `absenceType: string` (display label) and casts to `schedule_absence_type` enum at the DB-payload boundary. Callers pass display labels like "Sykefravær"; DB column expects `sick_leave|...`. Cast keeps typecheck green but runtime may reject inserts. Tracked in code comment; not in C3.1 scope.

## Next Steps

- **ADR-0177 sweep audit** — recommended one-shot agent in 2 weeks to grep `apps/web/src/app/dashboard/**` + `apps/web/src/app/year-wheel/**` for unguarded `motion.*` usage, open removal/conformance PRs.
- **Regen-script stderr fix** — silence stderr or filter prefix in the `database.types.ts` regen wrapper so future regens don't poison the file.
- **absence_type runtime fix** — separate sub-sortie: change `RequestAbsencePayload.absenceType` consumers to pass enum keys not display labels, OR change DB column to TEXT with separate `useAbsenceTypes()` lookup table.
