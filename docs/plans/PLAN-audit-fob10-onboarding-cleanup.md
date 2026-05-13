---
title: "Plan — audit-fob10-onboarding-cleanup"
feature: audit-fob10-onboarding-cleanup
spec: ../audits/2026-05-13-adr-contract-validation/10-onboarding-wizard.md
status: draft
updated: 2026-05-13
created: 2026-05-13
module: schedule
tags: [plan, audit, onboarding, cleanup, f-ob-10-01]
---

# Plan — audit-fob10-onboarding-cleanup

> Branch: `feat/audit-fob10-onboarding-cleanup` | Worktree: `~/dev/smartout.ai-wt-9` | Module: onboarding

**Spec:** [Slice 10 — onboarding-wizard audit](../audits/2026-05-13-adr-contract-validation/10-onboarding-wizard.md) + [synthesis F-OB-10-01](../audits/2026-05-13-adr-contract-validation/00-SYNTHESIS.md)

## Background

Audit 2026-05-13 F-OB-10-01 (CRITICAL): `/onboarding` runtime moved to `AnimatedWizardShell` but ~17 legacy scroll-wizard files remain as importable dead code. Each would throw `useOnboarding must be used within OnboardingProvider` if rendered. Three of them (`useOnboardingState.ts:433,585,657`) perform ADR-0123-violating EF calls that activate on any revival. ADR-0041 "superseded" status is fictional until cleanup completes.

## Journeys (the contract)

- [JOURNEY-audit-fob10-onboarding-cleanup-onboarding-renders-clean-post-cleanup](../journeys/JOURNEY-audit-fob10-onboarding-cleanup-onboarding-renders-clean-post-cleanup.md)
- [JOURNEY-audit-fob10-onboarding-cleanup-legacy-import-grep-returns-zero](../journeys/JOURNEY-audit-fob10-onboarding-cleanup-legacy-import-grep-returns-zero.md)
- [JOURNEY-audit-fob10-onboarding-cleanup-adr-0041-status-reality-matches-doc](../journeys/JOURNEY-audit-fob10-onboarding-cleanup-adr-0041-status-reality-matches-doc.md)

## Goal

Delete 17 legacy scroll-wizard files in `apps/web/src/app/onboarding/` left behind by Phase E AnimatedWizardShell migration. Close F-OB-10-01. Make ADR-0041 superseded status real.

## Tasks

- [ ] T1 Read audit slice 10 + synthesis F-OB-10-01 section. Enumerate 17 legacy files exactly. Build deletion map with inbound-import grep evidence per file.
- [ ] T2 Execute deletions per T1's map. Batch typecheck after every 5 files. Commit.
- [ ] T3 Amend ADR-0041 with closure note + update audit synthesis (F-OB-10-01 → CLOSED). Optionally draft ADR-0304 (superseded ADRs delete code at sortie close).
- [ ] T5 Run S1-S8 verification + flip journey statuses + write verification report.

## Acceptance Criteria (falsifiable)

- [ ] **S1** All 17 audit-claimed legacy files removed from disk (`find apps/web/src/app/onboarding -name "*.tsx" -o -name "*.ts"` shows only AnimatedWizardShell tree)
- [ ] **S2** Zero imports of deleted symbols (`grep -r "useOnboardingState\|OnboardingProvider\|WizardContext" apps/ packages/` returns 0)
- [ ] **S3** Zero `supabase.functions.invoke` inside `apps/web/src/app/onboarding/`
- [ ] **S4** `/onboarding` page renders clean (typecheck + dev curl 200)
- [ ] **S5** `pnpm turbo typecheck` 0 errors
- [ ] **S6** ADR-0041 amended with 2026-05-13 closure note
- [ ] **S7** Audit synthesis F-OB-10-01 row marked CLOSED with branch ref
- [ ] **S8** All 3 declared journeys `status: verified`

## Council escalation triggers

- T1 finds any of 17 files with LIVE inbound import from non-legacy code → council on file-by-file scope
- T1 finds `useOnboardingState` consumer outside onboarding/ (e.g. dashboard recovery flow) → council
- F-OB-04 BFF `/api/emma/session` orphan: wire-or-delete decision → optionally bundle in this sortie or split

## Out of scope

- F-OB-04 BFF wiring (separate decision per council escalation)
- `DomainChatOwnership` primitive build (ADR-0238 implementation sortie)
- AnimatedWizardShell refactor
- /join wizard path
