---
title: "S1 — lønnsslipp→lønnsgrunnlag label sweep"
status: in_progress
updated: 2026-05-16
created: 2026-05-16
module: payroll
tags: [payroll, ux, label-sweep, adr-0346]
---

# PLAN — S1: lønnsslipp→lønnsgrunnlag label sweep

> Branch: `feat/payroll-lonnsslipp-label-sweep` | Worktree: /home/sxtnl/dev/smartout.ai-payroll-wt-2 | Base: `campaign/payroll` | Started: 2026-05-16

## Purpose

Apply ADR-0346 (Lønnsgrunnlag positioning canonical) to all live user-facing UI strings
that still read "lønnsslipp" when referring to Smartout's own output document. Pure text
edit — no logic, no schema, no capability changes.

## Scope

8 string occurrences across 6 files. Defined by council blast-radius analysis 2026-05-16.

| # | File | Line(s) | Change |
|---|------|---------|--------|
| 1 | `apps/web/src/app/dashboard/my-salary/_components/PeriodList.tsx` | 53 | "Ingen lønnsslipp ennå" → "Ingen lønnsgrunnlag ennå" |
| 2 | `apps/web/src/app/dashboard/help/_components/QuickPathCards.tsx` | 40 | "lønnsslipp" → "lønnsgrunnlag" in description |
| 3 | `apps/web/src/app/dashboard/my-profile/complete/_tools/use-my-profile-complete-tools.ts` | 164 | "lønnsslipp/dokumenter" → "lønnsgrunnlag/dokumenter" |
| 4 | `apps/mobile/src/constants/strings.ts` | 230, 236 | 2 hits: noPayslips + loadErrorPayslip strings |
| 5 | `apps/mobile/app/(app)/(me)/index.tsx` | 171 | "Siste lønnsslipper" → "Siste lønnsgrunnlag" |
| 6 | `apps/mobile/app/(app)/(me)/payroll/payslip.tsx` | 79, 82, 105 | 3 hits: header + empty state titles |
| 7 | `apps/mobile/app/(app)/(me)/payroll/payslip-detail.tsx` | 130 | "Lønnsslipp" → "Lønnsgrunnlag" |
| 8 | `apps/mobile/app/(app)/(me)/payroll/index.tsx` | 194, 206 | comment + bento card title |

## Explicit SKIP list

- `apps/web/src/app/dashboard/my-salary/[lonnsgrunnlagId]/_components/LonnsgrunnlagViewer.tsx:101`
  — pedagogy contrast line (ADR-0346 §4)
- `apps/mobile/app/(app)/(me)/payroll/lonnsgrunnlag-detail.tsx:318`
  — pedagogy contrast line (ADR-0346 §4)
- `packages/ai/src/industry/packages/hospitality.ts:185-189`
  — AI alt-spellings for fuzzy matching (ADR-0346 §5)
- All `docs/` files — frozen artifacts (ADR-0346 §6)
- All filenames — route files not renamed (ADR-0346 council decision)
- All capability names + telemetry events (ADR-0346 §3)

## Guards

- **GUARD 1** (`QuickPathCards.tsx:40`): "lønnsgrunnlag" is 30% wider than "lønnsslipp".
  Card uses `text-xs leading-relaxed` in a 2→4 column responsive grid. Full word fits;
  no truncation needed. Verified by render-context analysis.
- **GUARD 2** (pedagogy lines): SKIP — explicitly preserved.
- **GUARD 3** (i18n): `grep -rn "lønnsslipp\|lonnsslipp" packages/i18n/` must return zero.

## Tasks

- [x] T0 — Write PLAN + JOURNEY docs. Commit `docs(payroll):`.
- [ ] T1 — Apply 8-hit sweep. Commit `refactor(payroll-ux):`.
- [ ] T2 — `pnpm turbo typecheck` 52/52.
- [ ] T3 — Verify GUARD 1 render context.
- [ ] T4 — GUARD 3 i18n grep returns zero.
- [ ] T5 — Mark journeys verified. Commit.
- [ ] T6 — Write HANDOFF. Commit.

## Acceptance Criteria

- [ ] Typecheck passes: `pnpm turbo typecheck` (52/52)
- [ ] GUARD 1 verdict: "lønnsgrunnlag" fits in QuickPathCards description without wrapping issues
- [ ] GUARD 3 grep: zero hits in packages/i18n/
- [ ] 2 journeys status: verified
- [ ] HANDOFF written
