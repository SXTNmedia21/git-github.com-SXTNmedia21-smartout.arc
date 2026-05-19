---
title: "Plan — hms-cluster-polish-fixup"
status: in_progress
updated: 2026-05-17
created: 2026-05-17
module: hms
tags: [plan, council-followup, r1-fixup]
---

# Plan — hms-cluster-polish-fixup

> Branch: `feat/ui-shell-hms-cluster-polish-fixup` | Worktree: /home/sxtnl/dev/smartout.ai-ui-shell-wt-2 | Base: `campaign/ui-shell` | Module: hms | Started: 2026-05-17

## Goal

Close 5 gates surfaced by Council R1 on `hms-cluster-polish-read` sub-sortie (2026-05-17, verdict APPROVE WITH CHANGES). Forward-fix on `campaign/ui-shell` — previous sortie already merged at `430563d27`.

## Gates

- [ ] **G1 (BLOCKER)** — Wire `emit()` for 4 HMS view events
  - `apps/web/src/app/dashboard/hms/page.tsx` → `hms.overview.viewed` (or `hms.umbrella.viewed` per registry)
  - `apps/web/src/app/dashboard/hms/training/page.tsx` → `hms.training.viewed`
  - `apps/web/src/app/dashboard/hms/drift/page.tsx` → `hms.drift.viewed`
  - `apps/web/src/app/dashboard/hms/documents/page.tsx` → `hms.documents.opened`
  - Pattern: `useEffect(() => { emit({ event, workspace_id, actor_id, ... }) }, [])` with L-0177 fail-fast guards
  - Route per registry: `["posthog", "logger", "activity_trail"]` (no engine_event)

- [ ] **G2 (CRITICAL)** — Fix HmsSubNav ARIA (Path A — remove tab roles)
  - `apps/web/src/app/dashboard/hms/_components/HmsSubNav.tsx`
  - Remove `role="tablist"` (L34), `role="tab"` (L45)
  - Keep `<nav aria-label>`, `<Link>`, `aria-current="page"` (correct for URL-routed nav)
  - Add `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none` to Link className (closes D2)

- [ ] **G3 (MEDIUM)** — Replace `dangerouslySetInnerHTML` with sanitized markdown
  - `apps/web/src/app/dashboard/hms/_components/LearnFlow.tsx:210-211`
  - `apps/web/src/app/dashboard/hms/_components/ProcedureDetailTabs.tsx:148-154`
  - Migration column comment (`20260422300800_hms_procedure_step_training.sql:9`) says "Markdown supported" — current renderer interprets as HTML (intent + XSS bug)
  - Install `react-markdown` + `rehype-sanitize` OR `remark` + sanitizer
  - Wrap both render sites

- [ ] **G4 (LOW)** — Add `/dashboard/hms/training` to `apps/web/.botsson/site-map.json`
  - 5 HMS routes present (lines 685-855); training missing
  - Tools array: `[]` (delegating thin-shell per HANDOFF Decision #3 / L-0287)
  - Purpose: "Training mode for protocols + competence matrix"
  - Audience: trainee + manager + admin

- [ ] **G5 (META)** — Amend `~/.claude/skills/run-council/SKILL.md` Phase 0 carve-out
  - Paragraph: "Phase 0 prerequisites MANDATORY unless HANDOFF documents intentional skip with cascade rationale (L-0287 phantom-contract avoidance on thin-shell delegating pages). Site-map entry NEVER skippable (Botsson route registry is universal)."

## Council references

- Verdict source: Council R1 2026-05-17 (Phase 5 Steward synthesis)
- Chair Self-Reversal: L-0147 6th precedent (a11y axis REVERSED — Code-Reviewer found WCAG 4.1.2 fail Steward marked PARTIAL)
- 2nd same-day occurrence of design+a11y coverage gap (1st: Tidslinjen R1 2026-05-17 AM)

## Knowledge artifacts (Phase 7+8 after closure)

- L-NEW-1 telemetry-contract-shipped-without-emit-wiring (sibling L-0176/L-0177)
- L-NEW-2 Phase-2.5 fact-check methodology — grep wrong-scope-key (2nd occurrence)
- L-NEW-3 Phase 3 coverage gap — design+a11y axis (2nd occurrence, ADR-grade)
- ADR-NEW-1 Page-Polish 8-Phase Rule — Documented Intentional Skips (proposed)
- COUNCIL-LOG entry — 2026-05-17 hms-cluster-polish-read R1

## Acceptance Criteria

- [ ] All 5 gates closed with file:line evidence in HANDOFF
- [ ] `pnpm turbo typecheck` passes
- [ ] axe-core / keyboard nav smoke on HmsSubNav (G2 verification)
- [ ] Playwright telemetry assertion: each route fires expected view event (G1 verification)
- [ ] DOMPurify/react-markdown snapshot test against `<img onerror>` payload (G3 verification)
- [ ] HANDOFF written with per-gate evidence + Phase 8 artifacts referenced
- [ ] Decision-log updated with ADR-NEW-1
- [ ] User journey written
