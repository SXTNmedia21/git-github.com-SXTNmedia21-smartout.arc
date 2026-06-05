---
title: "HANDOFF — S1 lønnsslipp→lønnsgrunnlag label sweep"
status: done
updated: 2026-05-16
created: 2026-05-16
module: payroll
tags: [payroll, ux, label-sweep, adr-0346]
---

# HANDOFF — S1: lønnsslipp→lønnsgrunnlag label sweep

## What was built

Pure UI text sweep applying ADR-0346 (Lønnsgrunnlag positioning canonical) to all live
user-facing strings that referred to Smartout's output document as "lønnsslipp". 6 files,
12 string occurrences replaced.

## Why

ADR-0346 (accepted 2026-05-16) graduated the positioning rule from project-memory to
ADR status. Smartout produces a **lønnsgrunnlag** (wage basis) consumed downstream by
Tripletex/Visma/accountants — not a **lønnsslipp** (tax-compliant payslip, which is the
downstream system's artifact). Showing "lønnsslipp" in the UI makes a false promise about
what the product delivers.

## Files changed

| File | Hits | Change summary |
|------|------|----------------|
| `apps/web/src/app/dashboard/my-salary/_components/PeriodList.tsx` | 1 | Empty-state paragraph |
| `apps/web/src/app/dashboard/help/_components/QuickPathCards.tsx` | 1 | Lønn & timer card description |
| `apps/web/src/app/dashboard/my-profile/complete/_tools/use-my-profile-complete-tools.ts` | 1 | Address field purpose text |
| `apps/mobile/src/constants/strings.ts` | 2 | noPayslips + loadErrorPayslip constants |
| `apps/mobile/app/(app)/(me)/index.tsx` | 1 | "Siste lønnsgrunnlag" section header |
| `apps/mobile/app/(app)/(me)/payroll/payslip.tsx` | 3 | 2× header title + empty-state title |
| `apps/mobile/app/(app)/(me)/payroll/payslip-detail.tsx` | 1 | Top bar title |
| `apps/mobile/app/(app)/(me)/payroll/index.tsx` | 2 | JSX comment + bento card title |

## Decisions

All decisions are governed by ADR-0346. No new ADRs were needed for this sortie.

Key decision record: **filenames NOT renamed** per council mandate. `payslip.tsx`,
`payslip-detail.tsx` remain as-is. Route files are stable contracts — renaming them
would require router-reference audit across the entire codebase and was explicitly
out of scope.

## Guards verified

| Guard | Outcome |
|-------|---------|
| GUARD 1 — QuickPathCards.tsx 360px viewport | PASS. `text-xs leading-relaxed` in 2-col grid gives ~143px content width. "lønnsgrunnlag" (~98px at 12px/7px-per-char) fits without truncation; word-wrap acceptable in description text. |
| GUARD 2 — pedagogy lines | PRESERVED. Both `LonnsgrunnlagViewer.tsx:101` and `lonnsgrunnlag-detail.tsx:318` untouched. |
| GUARD 3 — i18n packages/i18n/ grep | ZERO HITS. No i18n JSON files contained "lønnsslipp" or "lonnsslipp". |

## Typecheck result

50/52 tasks pass. 2 fail: `@smartout/mobile#typecheck` — pre-existing infrastructure
failure in this worktree (missing `node_modules` + `expo/tsconfig.base` not found).
This failure exists identically on the base branch before my changes and is unrelated
to the string edits. The web typecheck (50 passing tasks) includes all edited web files.

## Commits

| SHA | Subject |
|-----|---------|
| `b05f20e99` | `docs(payroll): add plan + journeys for lønnsslipp→lønnsgrunnlag label sweep` |
| `ddb47268d` | `refactor(payroll-ux): replace lønnsslipp with lønnsgrunnlag in all live UI strings` |
| `738680a3f` | `docs(payroll): mark lønnsslipp-label-sweep journeys as verified` |

## Known issues / debt

None introduced by this sortie.

Pre-existing: mobile worktree typecheck requires `pnpm install` to resolve
`expo/tsconfig.base` and `react-native` module declarations. This is a worktree setup
issue tracked separately.

## What NOT to touch (preserved by design)

- `packages/ai/src/industry/packages/hospitality.ts:185-189` — AI alt-spellings "lønnslipp"
  for fuzzy NLU matching. ADR-0346 §5.
- Capability names, telemetry event names, internal TypeScript types. ADR-0346 §3.
- All docs/audits/HANDOFF history. ADR-0346 §6.
- File routes: `payslip.tsx`, `payslip-detail.tsx`. Council mandate.

## Next steps

None required from this sortie. Future capability authors should wire UI labels to
"lønnsgrunnlag" by default per ADR-0346 §2. `adr-contract-audit` can now verify
UI label compliance against ADR-0346.
