---
title: "Plan — hms-cluster-polish-read"
status: draft
updated: 2026-05-17
created: 2026-05-17
module: MODULE_01
tags: [plan, ui-shell, polish, hms, council-verified, campaign-ui-shell, M5]
---

# Plan — hms-cluster-polish-read

> Branch: `feat/ui-shell-hms-cluster-polish-read` | Worktree: /home/sxtnl/dev/smartout.ai-ui-shell-wt-1 | Base: `campaign/ui-shell` | Module: MODULE_01 | Started: 2026-05-17

## Goal

Polish 5 read-heavy HMS-cluster routes per `smartout-page-polish` workflow. M5 Sortie 3 of 4. Sortie 1 + 2 prereqs complete. Sortie 4 covers write-heavy (policies/handbook/procedure/DeviationKanban).

## Council Decision (2026-05-17)

Verdict: APPROVE WITH CHANGES Option C+ (4 sorties). Verdict ref `docs/council/COUNCIL-LOG.md` row "M5 HMS cluster scoping". Phase 5 assigns this sortie to read-heavy surfaces (interaction-depth axis per frontend-designer; cascade-role axis per steward — both honored).

## Routes in scope (5)

| Route | Lines | Loading | Error | Notes |
|---|---|---|---|---|
| `/dashboard/hms` (umbrella) | 25 | YES | NO | Shell + HmsSubNav + HmsPageClient |
| `/dashboard/hms/training` | 14 | NO | NO | Smallest, mostly-read |
| `/dashboard/hms/drift` | 39 | NO | NO | DriftFocusCard, DriftInsightStrip, DriftSessionTable, DriftTaskList, DriftTimeline |
| `/dashboard/hms/documents` | 20 | NO | NO | DocumentBrowser + DocumentViewer (two-pane) |
| `/dashboard/hms/governance` | 35 | NO | NO | Read-views (mutation tools owned by top-level governance post-Sortie 2) |

## Scope

**In scope:**
- Add missing `loading.tsx` (4 routes — training/drift/documents/governance)
- Add `error.tsx` to ALL 5 routes (Norwegian retry button, semantic destructive token)
- Nordic Split token sweep across 11 components: DriftInsightStrip, DriftFocusCard, CompetenceMatrix, DepartmentReadiness, DriftSessionTable, DriftTaskList, DriftTimeline, DocumentBrowser, DocumentViewer, LearnFlow, HmsSubNav (frontend-designer flagged hardcoded greens/ambers/reds risk)
- Telemetry registration for missing read-side events (e.g. `drift viewed`, `documents opened`)
- Bridge tool description refinement ONLY for tools surviving Sortie 2 (no NEW tools — L-0287 avoidance)
- Site-map.json registration for any unregistered scoped routes
- SubNav ARIA + keyboard nav audit (inherited across 6 tabs)

**Out of scope:**
- `/dashboard/hms/deviations` (Sortie 4)
- `/dashboard/hms/procedure/[id]` (Sortie 4 — interaction-heavy per frontend rec)
- `/dashboard/policies` + `/dashboard/handbook` (Sortie 4)
- New bridge tools (L-0287 — no capability for hms/policies/handbook/deviations beyond `training`)
- Mutation surface (Sortie 1 closed)
- Collision fixes (Sortie 2 closed)
- Mobile parity (ADR-0133 — HMS web-only)

## Council Conditions (6 — MANDATORY)

1. **All 5 routes get `error.tsx` + 4 routes get `loading.tsx`** in one commit batch.
2. **No hardcoded color tokens** — only `bg-muted`, `text-foreground`, `border-border`, semantic info/success/warning/destructive. ComplianceBadge-class hardcoded greens/ambers/reds FORBIDDEN.
3. **SkeletonEntrance at route boundary only.** No per-row enter animations.
4. **Bridge tool descriptions** — refine ONLY if tool already owned post-Sortie 2 + only if existing wording misleading. NO new tools (L-0287).
5. **Norwegian retry button** in every `error.tsx` ("Prøv igjen", semantic destructive token).
6. **Telemetry events for read-side surfaces** if not registered — add to `packages/telemetry/src/registry.ts` per registry pattern (interface + SmartoutEvent union both sites + EVENT_ROUTING + EntityType).

## Tasks

- [ ] **T1** — Recon: read 11 scoped components (DriftFocusCard, DriftInsightStrip, CompetenceMatrix, DepartmentReadiness, DriftSessionTable, DriftTaskList, DriftTimeline, DocumentBrowser, DocumentViewer, LearnFlow, HmsSubNav) — identify hardcoded tokens
- [ ] **T2** — Recon: read existing error.tsx + loading.tsx patterns from `docs/HANDOFF-ui-shell-{contracts,cost,billing}-polish.md` for shape
- [ ] **T3** — Recon: check `packages/telemetry/src/registry.ts` for existing `drift`/`hms`/`documents`/`training`/`governance` read events — identify gaps
- [ ] **T4** — Create `error.tsx` × 5 (umbrella + 4 sub-tabs)
- [ ] **T5** — Create `loading.tsx` × 4 (training, drift, documents, governance)
- [ ] **T6** — Nordic Split token sweep across 11 components
- [ ] **T7** — Register missing read-side telemetry events
- [ ] **T8** — Refine bridge tool descriptions IF existing wording misleading (skip if already good)
- [ ] **T9** — Verify: typecheck + site-map:validate + `pnpm lint:tool-collisions` exit 0
- [ ] **T10** — G4 frontend-designer code-reviewer pass
- [ ] **T11** — HANDOFF + close-feature

## Acceptance Criteria

- [ ] `pnpm turbo typecheck` 0 errors
- [ ] `pnpm --filter web site-map:validate` exit 0
- [ ] `pnpm lint:tool-collisions` exit 0 (ratchet allowlist unchanged)
- [ ] 5 routes have `error.tsx` (umbrella + 4 sub-tabs)
- [ ] 4 sub-routes have `loading.tsx` (training/drift/documents/governance)
- [ ] Zero hardcoded color classes in 11 scoped components (`grep -E 'bg-(green|amber|red|yellow|orange)-[0-9]'` → 0 hits in scope)
- [ ] Norwegian retry button in every error.tsx
- [ ] Primary journey verified
- [ ] HANDOFF written
- [ ] G4 APPROVE

## Risks

- **22 components total in `_components/` — only 11 in scope.** Avoid scope creep — Deviation*, Procedure*, OversiktDashboard/Employee belong to umbrella OR Sortie 4.
- **Polish wave amplifier (L-0260):** any direct browser mutation in scoped files surfaces BEFORE polish. Sortie 1 closed knowns; verify NO new ones. Audit: `grep -nE 'supabase\.from\(.+\)\.(insert|update|delete)' apps/web/src/app/dashboard/hms/_components/` → 0 expected hits in scope.
- **L-0287 phantom-contract:** NEW bridge tool description = phantom promise. Don't expand surface — refine existing only.
- **App Router streaming inheritance:** sub-routes don't inherit umbrella `loading.tsx`. Frontend-designer flagged Phase 3.
- **Motion budget:** SkeletonEntrance at route boundary only. No per-row card animations (DriftSessionTable tempting; resist).
- **Compliance badge consistency:** if CompetenceMatrix/DepartmentReadiness has badge-class component, match billing-polish G4 fix pattern (commit `e46929654` — semantic tokens only).

## Next

Single sonnet build agent dispatched with 6 council conditions. Solo + sequential. After T11 close-feature, dispatch Sortie 4 (`policies-handbook-polish-write`).
