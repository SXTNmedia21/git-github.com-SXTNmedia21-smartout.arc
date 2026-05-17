---
title: "Plan — hms-cluster-polish-r2-fixup"
status: in_progress
updated: 2026-05-17
created: 2026-05-17
module: hms
tags: [plan, council-followup, r2-fixup, a11y, wcag]
---

# Plan — hms-cluster-polish-r2-fixup

> Branch: `feat/ui-shell-hms-cluster-polish-r2-fixup` | Worktree: /home/sxtnl/dev/smartout.ai-ui-shell-wt-2 | Base: `campaign/ui-shell` | Module: hms | Started: 2026-05-17

## Goal

Close R2 council blockers on `hms-cluster-polish-read` + `hms-cluster-polish-fixup`. R2 verdict (2026-05-17 PM2): APPROVE WITH CHANGES — 4 blockers reduced to 3 after B2 retraction (validator works correctly; chair misread head-truncated output).

## Blockers

- [ ] **B1 (mechanical)** — Trim `routes[17].purpose` in `apps/web/.botsson/site-map.json` to ≤140 chars.
  - Current: 165 chars (validator exits 1 with `✗ purpose >140 chars (165) — tighten`).
  - Suggested 130-char: "Training mode for protocols + competence matrix. Admin sees readiness matrix; employee sees assigned protocols (role-conditional)."
  - Verify: `npx tsx apps/web/scripts/validate-site-map.ts` exits 0.

- [ ] **B3 (CRITICAL, WCAG 2.4.11)** — focus-visible ring tokens on ProcedureDetailTabs tab buttons.
  - `apps/web/src/app/dashboard/hms/_components/ProcedureDetailTabs.tsx:103-114` (4 tab buttons)
  - Add: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`

- [ ] **B4 (CRITICAL, WCAG 2.4.11)** — focus-visible ring tokens on LearnFlow stage-progress buttons.
  - `apps/web/src/app/dashboard/hms/_components/LearnFlow.tsx:74-91`
  - Same fix pattern as B3.

- [ ] **B5 (HANDOFF maintenance)** — Update HANDOFF Known Issue #3 animate-spin count.
  - File: `docs/HANDOFF-ui-shell-hms-cluster-polish-fixup.md`
  - Was "6"; actual = **297 occurrences across 180+ files**. Sortie 4 scope is dashboard-wide, not HMS-local.

## Retracted

- **B2 — Fix validator self-bug** — DROPPED. Validator works correctly (exits 1 on drift). R2 chair Phase 5 misread head-truncated reviewer output. Captured as L-NEW-C.

## Deferrals (Sortie 4)

- F-2 animate-spin rm-gate (297 occurrences, 180+ files)
- NEW-3 palette migration (TaskCard, SessionSignoffDrawer, OversiktDashboard, OversiktEmployee — 18+ classes)
- NC-1 ProcedureDetailTabs `<Tabs>` consistency refactor
- NIT i18n hardcoded label

## Knowledge artifacts (Phase 7+8)

- ADR-0357 v2 addendum (proposed) — page-header inheritance carve-out
- L-NEW-A reframed → "validator-bug claim must include exit-code verification, not just stdout grep"
- L-NEW-C — head-truncated stdout false-negative (sibling L-NEW-2)
- COUNCIL-LOG R2 entry + REFINED Self-Reversal classification + B2 retraction

## Acceptance Criteria

- [ ] B1+B3+B4+B5 closed with file:line evidence
- [ ] `pnpm --filter web typecheck` exits 0
- [ ] `npx tsx apps/web/scripts/validate-site-map.ts` exits 0
- [ ] HANDOFF written
- [ ] ADR + 2 learnings + COUNCIL-LOG R2 entry
- [ ] User journey marked verified
