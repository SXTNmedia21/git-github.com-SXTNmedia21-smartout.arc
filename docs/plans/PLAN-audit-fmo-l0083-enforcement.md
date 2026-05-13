---
title: "Plan — audit-fmo-l0083-enforcement"
feature: audit-fmo-l0083-enforcement
spec: ../audits/2026-05-13-adr-contract-validation/00-SYNTHESIS.md
status: draft
updated: 2026-05-13
created: 2026-05-13
module: mobile
tags: [plan, audit, l-0083, mobile, eslint, ci, f-mo-01, f-mo-02, f-mo-03]
---

# Plan — audit-fmo-l0083-enforcement

> Branch: `feat/audit-fmo-l0083-enforcement` | Worktree: `~/dev/smartout.ai-wt-6` | Module: mobile

**Spec:** F-MO-01/02/03 from synthesis — L-0083 `?? ""` mobile fallback trap. Open since 2026-05-10 baseline.

## Background

L-0083 trap: empty-string fallback on identifier columns (workspace_id, profile_id, actor_id, user_id) silently corrupts `activity_trail` + `engine_event` routing. ADR-0134 Invariant 2 forbids this pattern. Mobile re-introduces it repeatedly:
- F-MO-01: ShiftClockView.tsx:240-243 (3 sites)
- F-MO-02: use-training-data
- F-MO-03: use-swap-requests

Pattern: rule-without-enforcement = recurring regression. ADR-0303 (RLS sister-sweep) + ADR-0287 (gate_action) both shipped CI lint enforcement today. L-0083 is the 3rd recurring class.

## Journeys

- [JOURNEY-audit-fmo-l0083-enforcement-eslint-rule-blocks-empty-string-fallback](../journeys/JOURNEY-audit-fmo-l0083-enforcement-eslint-rule-blocks-empty-string-fallback.md)
- [JOURNEY-audit-fmo-l0083-enforcement-three-baseline-sites-remediated](../journeys/JOURNEY-audit-fmo-l0083-enforcement-three-baseline-sites-remediated.md)
- [JOURNEY-audit-fmo-l0083-enforcement-mobile-fail-fast-on-missing-identity](../journeys/JOURNEY-audit-fmo-l0083-enforcement-mobile-fail-fast-on-missing-identity.md)

## Goal

Ship ESLint rule `no-empty-string-fallback-on-id` blocking `?? ""` on identifier columns. Remediate F-MO-01/02/03 baseline sites. Stop the bleed.

## Tasks

- [ ] T1 Grep `apps/mobile/src/` for `\?\? ""` near identifier patterns. Enumerate all sites.
- [ ] T2 Ship ESLint rule. Identifier pattern: `(workspace|profile|actor|user|time_entry|shift|department|session|deviation|task|company)_id` OR ends in `Id`. Rule fires on `<identifier-expr> ?? ""`.
- [ ] T3 Wire rule into mobile ESLint config.
- [ ] T4 Workflow `.github/workflows/check-mobile-id-fallbacks.yml` (path filter `apps/mobile/**`).
- [ ] T5 Remediate F-MO-01 (3 sites in ShiftClockView), F-MO-02, F-MO-03. Replace `?? ""` with throw OR `getProfileContext()` fail-fast pattern (per ADR-0134).
- [ ] T6 Self-test: temporary fixture violation → rule fires + exit 1.
- [ ] T7 Vitest on ESLint rule.
- [ ] T8 Update audit synthesis F-MO-01/02/03 → CLOSED.
- [ ] T9 Flip 3 journeys verified.

## Acceptance Criteria (falsifiable)

- [ ] **S1** ESLint rule exists at `packages/eslint-config/src/rules/no-empty-string-fallback-on-id.ts` (or chosen path)
- [ ] **S2** Wired into mobile lint config (rule fires on `pnpm --filter @smartout/mobile lint`)
- [ ] **S3** Workflow ships on PR with path-filter
- [ ] **S4** Self-test fixture → exit 1 with clear message
- [ ] **S5** F-MO-01 (3 sites), F-MO-02, F-MO-03 remediated — `grep -rn '\?\? ""' apps/mobile/src/` near identifier columns returns 0 hits
- [ ] **S6** Vitest covers rule
- [ ] **S7** Audit synthesis F-MO-01/02/03 → CLOSED
- [ ] **S8** `pnpm turbo typecheck` 0 errors
- [ ] **S9** 3 journeys verified

## Council escalation triggers

- Mobile JWT inaccessible in component scope → council on auth-context hoisting (separate sortie or in-scope?)
- ESLint rule false-positive risk on test fixtures → override mechanism design
- ADR-0132 thin-client conflict if fail-fast requires BFF roundtrip

## Out of scope

- F-MO-05 daily_reconciliation direct write (separate sortie)
- F-MO-06 submit_own_pii client workspace_id (parallel sortie W3.2)
- Migrating all mobile mutations to BFF (per ADR-0132 — broader refactor)
