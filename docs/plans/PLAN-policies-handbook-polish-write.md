---
title: "Plan — policies-handbook-polish-write"
status: draft
updated: 2026-05-17
created: 2026-05-17
module: MODULE_01
tags: [plan, ui-shell, polish, hms, policies, handbook, council-verified, campaign-ui-shell, M5-final]
---

# Plan — policies-handbook-polish-write

> Branch: `feat/ui-shell-policies-handbook-polish-write` | Worktree: /home/sxtnl/dev/smartout.ai-ui-shell-wt-1 | Base: `campaign/ui-shell` | Module: MODULE_01 | Started: 2026-05-17

## Goal

Polish 4 write-heavy / interaction-heavy HMS-cluster routes per `smartout-page-polish`. Final M5 sortie. Closes M5 milestone after merge.

## Council Decision (2026-05-17)

Verdict APPROVE WITH CHANGES Option C+ (4 sorties). Sortie 1+2+3 prereqs CLOSED (`9ef0fbb60` + `379036989` + `430563d27`). This sortie covers write-heavy + interaction-heavy surfaces per frontend-designer Phase 3 axis.

## Routes in scope (4)

| Route | Lines | Loading | Error | Notes |
|---|---|---|---|---|
| `/dashboard/hms/deviations` | 109 | NO | NO | DeviationKanban + DeviationListView + DeviationDetailDrawer + DeviationForm (largest, interaction-heavy) |
| `/dashboard/hms/procedure/[id]` | 18 | NO | NO | ProcedureDetailTabs + ProcedureExperience + LearnFlow (LearnFlow polished Sortie 3) |
| `/dashboard/policies` | 32 | YES | NO | PoliciesPageClient + PolicyCreateDialog + PolicyTypeBadge |
| `/dashboard/handbook` | 49 | YES | NO | ChapterReader + handbook-page-client |

## Components in scope (11)

HMS: DeviationKanban, DeviationDetailDrawer, DeviationForm, DeviationListView, ProcedureDetailTabs, ProcedureExperience (6)
Policies: PoliciesPageClient, PolicyCreateDialog, PolicyTypeBadge (3)
Handbook: ChapterReader, handbook-page-client (2)

T0 recon: `grep -nE 'bg-(green|amber|red|...)-[0-9]'` shows ~38 hardcoded palette hits across these 11 components.

## Scope

**In scope:**
- 4 `error.tsx` (all 4 routes; policies + handbook have loading already)
- 2 `loading.tsx` (hms/deviations + hms/procedure/[id])
- Nordic Split sweep across 11 components — replace ~38 hardcoded palette tokens with semantic
- Telemetry registration for missing write/interaction events
- DeviationKanban **motion budget guard** — NO per-card enter animations on initial load. Only on state change (move/create). SkeletonEntrance at route boundary only.
- Bridge tool descriptions ONLY if existing wording misleading (L-0287)

**Out of scope:**
- HMS umbrella + drift + documents + training + governance (Sortie 3 closed)
- New bridge tools (L-0287)
- New capabilities (defer)
- Mutation closure (Sortie 1 closed)
- Collision fixes (Sortie 2 ratchet active)
- Mobile parity (ADR-0133 — HMS/policies/handbook web-only)

## Council Conditions (7 — MANDATORY)

1. 4 `error.tsx` + 2 `loading.tsx` in one commit.
2. No hardcoded color tokens — Nordic Split semantic only.
3. SkeletonEntrance at route boundary only. NO per-card / per-row enter animations on mount.
4. **DeviationKanban motion budget guard:** no `AnimatePresence` per-card on initial mount. State change = entrance/exit per card OK with `mode="popLayout"`.
5. Bridge tool descriptions — refine ONLY if misleading. No new tools.
6. Norwegian retry button in every error.tsx.
7. Telemetry events for missing write/interaction events.

## Tasks

- [ ] **T1** — Recon: read 11 components + identify token sweep targets + check DeviationKanban motion pattern
- [ ] **T2** — Recon: telemetry registry — find existing `deviation`/`policy`/`handbook`/`procedure` events; identify gaps
- [ ] **T3** — Recon: read Sortie 3 error.tsx/loading.tsx for pattern shape
- [ ] **T4** — Create 4× error.tsx
- [ ] **T5** — Create 2× loading.tsx
- [ ] **T6** — Nordic Split token sweep across 11 components — replace 38 palette hits
- [ ] **T7** — DeviationKanban motion budget audit + guard
- [ ] **T8** — Register missing telemetry events
- [ ] **T9** — Verify: typecheck + site-map:validate + lint:tool-collisions + grep checks
- [ ] **T10** — G4 review (sonnet via general-purpose due to frontend-designer L-0271 hook loop)
- [ ] **T11** — HANDOFF + close-feature

## Acceptance Criteria

- [ ] `pnpm turbo typecheck` 0 errors
- [ ] `pnpm --filter web site-map:validate` exit 0
- [ ] `pnpm lint:tool-collisions` exit 0 (allowlist 8 entries unchanged)
- [ ] 4 routes have `error.tsx`
- [ ] 2 routes have new `loading.tsx`
- [ ] Zero hardcoded palette tokens in 11 scoped components
- [ ] DeviationKanban motion guard (no card-level enter on mount)
- [ ] Norwegian retry button in every error.tsx
- [ ] Primary journey verified
- [ ] HANDOFF written
- [ ] G4 APPROVE

## Risks

- **DeviationKanban size + interactions:** kanban with drag-drop (TBD per recon) + 20+ cards. Motion budget risk. Frontend-designer Phase 3 flagged.
- **DeviationForm + DeviationDetailDrawer focus management:** drawer + form = focus trap. Verify keyboard nav.
- **PolicyCreateDialog focus trap:** shadcn Dialog handles by default.
- **L-0287 phantom-contract:** no new bridge tools.
- **Sortie 1 mutation closure dependency:** any new mutation surface discovery = STOP, surface to council (L-0286).
- **Telemetry naming convention:** Sortie 3 used dot-separator despite codebase space-separator (G4 LOW deferred). New events this sortie should use SPACE-separator to align with codebase convention. Sortie 3 dot-separated events ARE acceptable for now — don't rename in this sortie.

## Next

Single sonnet build agent dispatched with 7 council conditions. Solo + sequential. After T11 close-feature, M5 milestone COMPLETE (4/4 sorties). Then Pontus decides M9 milestone PR.
