---
title: "Handoff — audit-fob10-onboarding-cleanup"
feature: audit-fob10-onboarding-cleanup
status: complete
created: 2026-05-13
updated: 2026-05-13
module: onboarding
tags: [handoff, audit-2026-05-13, f-ob-10-01, onboarding, cleanup]
---

# Handoff — audit-fob10-onboarding-cleanup

> Branch: `feat/audit-fob10-onboarding-cleanup` | Worktree: `~/dev/smartout.ai-wt-9` | Module: onboarding

## Summary

Sortie B closes two audit findings from the 2026-05-13 ADR-contract validation cycle:

- **F-OB-10-01 (CRITICAL)** — `/onboarding` runtime had moved to `AnimatedWizardShell` (Phase E) but the legacy scroll-wizard files were never deleted. Each remained importable dead code. Any revival would throw `useOnboarding must be used within OnboardingProvider`. ADR-0041's `superseded` status was fictional until cleanup completed.
- **F-OB-10-04 (HIGH)** — three latent ADR-0123 violations inside `useOnboardingState.ts` (lines 426, 583, 655) performing client-side `supabase.functions.invoke` calls. Eliminated automatically by deleting the file.

Outcome: 27 legacy files deleted from `apps/web/src/app/onboarding/` (and one paired test file), ADR-0041 amended with a 2026-05-13 closure section, ADR-0304 drafted (proposed) to codify the lesson, audit synthesis F-OB-10-01 + F-OB-10-04 rows marked CLOSED, and three declared journeys verified. Full `pnpm turbo typecheck` 52/52 PASS. Zero live imports of any deleted symbol remain.

## Deliverables

Five commits on `feat/audit-fob10-onboarding-cleanup`, ordered as on the branch:

| SHA | Track | Summary |
|---|---|---|
| `d5777aba1` | T0 | Declare PLAN + 3 journey stubs for `audit-fob10-onboarding-cleanup`. |
| `20a23aeb0` | T1 | T1 deletion map: 27 DELETE_SAFE + 26 KEEP_LIVE + 0 NEEDS_MIGRATION, with inbound-import grep evidence per file. |
| `bd9ff295c` | T3 | T3 docs: amend ADR-0041 (`updated: 2026-05-13` + closure section), draft ADR-0304 (proposed), update audit synthesis (F-OB-10-01 + F-OB-10-04 → CLOSED), decision-log row. |
| `9c8376a12` | T2 | T2 cleanup: delete 27 legacy scroll-wizard files. `pnpm turbo typecheck` 52/52 PASS at this SHA. |
| `39f8a4ede` | T5 | T5 verification report + flip 3 journeys `status: draft` → `status: verified`. |

Commit chronology note: T3 documentation landed before T2 code deletion to keep the audit narrative coherent before the deletion blast — verified and documented in the T5 report.

## Decisions

- **ADR-0041 amended** — `docs/decisions/0041-onboarding-wizard-step-architecture.md` gains a `## 2026-05-13 Legacy code removal — F-OB-10-01 + F-OB-10-04 closure` section. Supersession status now reflects code reality: the new wizard owns `/onboarding` and the old scroll-wizard tree no longer exists on disk.
- **ADR-0304 drafted (`proposed`)** — `docs/decisions/0304-superseded-adrs-delete-code-at-sortie-close.md` codifies the rule: when an ADR enters `status: superseded`, the code it described MUST be deleted by the close of the sortie that supersedes it. Needs council vote before becoming `accepted`.
- **Audit count corrected** — Audit slice 10 estimated "~17 legacy files". T1's actual mapping is 26 files in scope + 1 paired test = **27 deletions**. Audit counts are directional; the load-bearing artefact is the deletion map.

## Learnings

- **L: Audit slice counts are directional, not authoritative.** The slice-10 audit said "~17 files"; T1's evidence-based mapping found 27. T1 (filesystem walk + inbound-import grep per file) is the load-bearing artefact, not the audit headline number. Any future sortie that closes an audit finding should treat the slice count as a hint and build its own map.
- **L: The `AnimatedWizardShell` tree IS the live onboarding surface.** Verified live: 26 KEEP_LIVE files — 7 step files (`steps/Confirm*.tsx`), `wizard-definition.ts`, `page.tsx`, `layout.tsx`, 4 `__tests__/*.test.ts`, 6 `lib/*.ts`, 5 `steps/tools/*-tools.ts`, `types-v2.ts`, `types.ts`. Anything outside this set in `apps/web/src/app/onboarding/` was scroll-wizard dead code.
- **L: ADR-0123 violation surface can be eliminated by deletion, not patching.** F-OB-10-04 named three EF calls at `useOnboardingState.ts:426,583,655`. None needed individual remediation because the host file itself was DELETE_SAFE. Closing F-OB-10-01 closed F-OB-10-04 automatically — single sortie, two findings.
- **L: Fresh worktrees need `pnpm install` + package builds before typecheck.** Per MEMORY L-0227: `pnpm install` then `pnpm turbo build --filter='./packages/*'` BEFORE the first `pnpm turbo typecheck`, otherwise `@smartout/ai/router/*` and similar subpath imports throw TS2307 with no actionable signal. Hit during T2's pre-deletion baseline.
- **L: Commitlint `scope-case` rejects digit-after-letter in scope.** Tried `onboarding-fob10` initially, rejected by `scope-case [kebab-case]`. Worked: scope `onboarding`. Encoded in T1's commit message scheme; reused for all five commits without further friction.

## Known issues / debt

- **F-OB-04 BFF orphan** — Phase E E2 route `/api/emma/session` has zero consumers in the current code. Not in this sortie's scope (out-of-scope per PLAN). Backlog item: wire-or-delete decision in a follow-up sortie.
- **`DomainChatOwnership` primitive missing** — referenced by ADR-0238 but no implementation exists in the repo. Out of scope here; needs an ADR-0238 implementation sortie.
- **ADR-0304 still `proposed`** — codifies the "superseded ADRs delete code at close" rule but has not been council-voted. Should be promoted to `accepted` (or rejected) before the next audit cycle so the rule has authoritative force when the next supersession lands.

## Verification evidence

Full T5 report: [`docs/audits/2026-05-13-sortie-b-verification.md`](audits/2026-05-13-sortie-b-verification.md).

Summary:

| Acceptance criterion | Verdict |
|---|---|
| S1 — onboarding tree clean (only AnimatedWizardShell stack) | PASS |
| S2 — legacy symbol grep returns 0 live imports | PASS |
| S3 — zero `supabase.functions.invoke` inside `app/onboarding/` | PASS |
| S4 — `/onboarding` renders | SKIP (proxied by S5 typecheck per PLAN allowance) |
| S5 — `pnpm turbo typecheck` 0 errors | PASS (52/52, FULL TURBO cached) |
| S6 — ADR-0041 amended with 2026-05-13 closure note | PASS |
| S7 — synthesis F-OB-10-01 row marked CLOSED | PARTIAL — synthesis CLOSED ✓; `delta.md` kept baseline-closed semantics (labelling preference, not a functional gap). Non-blocking. |
| S8 — 3 declared journeys flipped to `status: verified` | PASS |

No council escalation triggers fired. No typecheck regression at any T2 batch. Grep for `useOnboardingState` and `OnboardingProvider` returns 0 hits across `apps/`, `packages/`, `services/`. The 16 remaining hits on `WizardContext` are lexical collisions with `WizardContextPayload` (the NEW typed payload), prose comments, or stale `dist/` artefacts — none are live imports of the deleted React Context.

## Next steps

Pontus runs `~/.claude/scripts/close-feature.sh 9` to merge `feat/audit-fob10-onboarding-cleanup` into `development` and remove the worktree at `~/dev/smartout.ai-wt-9`.

Post-merge follow-ups (separate sorties):

1. Council-vote ADR-0304 → `accepted` (or revise per council feedback).
2. F-OB-04 BFF `/api/emma/session` wire-or-delete decision.
3. ADR-0238 `DomainChatOwnership` primitive implementation.
