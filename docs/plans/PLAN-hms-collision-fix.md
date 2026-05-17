---
title: "Plan — hms-collision-fix"
status: draft
updated: 2026-05-17
created: 2026-05-17
module: MODULE_01
tags: [plan, ui-shell, collision-fix, ADR-0360, L-0258, council-verified, campaign-ui-shell, M5-prereq]
---

# Plan — hms-collision-fix

> Branch: `feat/ui-shell-hms-collision-fix` | Worktree: /home/sxtnl/dev/smartout.ai-ui-shell-wt-1 | Base: `campaign/ui-shell` | Module: MODULE_01 | Started: 2026-05-17

## Goal

Resolve 3 LIVE L-0258 tool-name collisions in HMS cluster bridges + ship ADR-0360 CI detector. Closes ADR-0325 Phase 2 dedupe trigger for HMS surface. M5 Sortie 2 of 4 — **BLOCKER for Sortie 3 (`hms-cluster-polish-read`)**.

## Council Decision (2026-05-17 — verdict ref COUNCIL-LOG.md row "M5 HMS cluster scoping")

Verdict: APPROVE WITH CHANGES Option C+ (4 sorties). Sortie 1 closed (commit `9ef0fbb60`). This sortie ships ADR-0360 detector + dedupe to ensure Sortie 3 polish can refine bridge tool descriptions safely.

## Three LIVE collisions (file:line traced by Agent-Coord 2026-05-17 Phase 3)

| Tool name | Sources | Severity | Resolution |
|---|---|---|---|
| `listOpenDeviations` | `apps/web/src/app/dashboard/hms/_tools/use-hms-tools.ts:120` + `apps/web/src/app/dashboard/hms/deviations/_tools/use-hms-deviations-tools.ts:64` + `apps/web/src/app/dashboard/governance/_tools/use-governance-tools.ts:223` | 3-way | Single owner: `hms/deviations` — remove from `hms` umbrella + `governance` |
| `getDriftStatus` | `apps/web/src/app/dashboard/hms/_tools/use-hms-tools.ts:148` + `apps/web/src/app/dashboard/hms/drift/_tools/use-hms-drift-tools.ts:49` | 2-way | Single owner: `hms/drift` — remove from `hms` umbrella |
| `getProtocolDetail` | `apps/web/src/app/dashboard/hms/governance/_tools/use-hms-governance-tools.ts:74` + `apps/web/src/app/dashboard/governance/_tools/use-governance-tools.ts:185` | 2-way | Single owner: `governance` (top-level) — remove from `hms/governance` sub-tab |

Routing today: ADR-0325 Phase 1 grace = `console.error` only; Object.assign last-wins routes by mount order. User navigates `/dashboard/hms` then `/dashboard/hms/deviations` → both bridges mounted → impl overwrites silently.

## Scope

**In scope:**
- Remove duplicate tool definitions per ownership table above. Each removed tool: drop from definitions array + drop from implementations record.
- ADR-0360 CI detector script: `scripts/check-tool-name-collisions.ts` greps all `useRegisterTools(scope, kit)` call sites in `apps/web/src/app/dashboard/**/_tools/`, extracts every `modelToolName` string, fails if duplicates found across bridges.
- Wire detector into pre-push or pre-commit hook (or new `pnpm turbo lint` task).
- Document semantic change per removed tool in HANDOFF.

**Out of scope:**
- The other 6-8 collisions reported in L-0258 + L-0267 (briefing collision counts are spot-checks). This sortie closes ONLY the 3 confirmed HMS-cluster collisions. Follow-up sortie addresses cross-domain collisions.
- ADR-0325 Phase 3 targeted rename. Defer.
- Bridge tool description refinement (Sortie 3+4).
- Capability creation (L-0287 defer).

## Council Conditions (5 — MANDATORY)

1. **All 3 collisions resolved in one commit.** No partial close.
2. **Single owner per tool name across HMS cluster** post-fix. Verified by detector.
3. **CI detector script ships in same PR.** Cannot land collision fix without preventing recurrence.
4. **Detector wired into a check that runs on every PR** (pre-push hook, lint task, or CI workflow — pick the lightest one that blocks).
5. **HANDOFF documents semantic change per removed tool** (e.g., "`listOpenDeviations` now only available on `/dashboard/hms/deviations` — HMS umbrella users must navigate first").

## Tasks

- [ ] **T1** — Recon: read all 5 `_tools/use-*-tools.ts` files in HMS cluster (hms, hms-deviations, hms-drift, hms-governance, hms-documents) + governance + policies + handbook
- [ ] **T2** — Recon: read existing CI scripts pattern (`scripts/check-intent-coverage.ts`, `scripts/gate-action-coverage.ts`) for shape
- [ ] **T3** — Recon: read tool-registry source to confirm Object.assign last-wins behavior
- [ ] **T4** — Remove `listOpenDeviations` from `use-hms-tools.ts` + `use-governance-tools.ts` (keep in `use-hms-deviations-tools.ts`)
- [ ] **T5** — Remove `getDriftStatus` from `use-hms-tools.ts` (keep in `use-hms-drift-tools.ts`)
- [ ] **T6** — Remove `getProtocolDetail` from `use-hms-governance-tools.ts` (keep in `use-governance-tools.ts` top-level)
- [ ] **T7** — For each removed tool: drop from definitions array + drop from implementations + shrink props/input types if no longer needed by remaining tools
- [ ] **T8** — Write `scripts/check-tool-name-collisions.ts`: grep+extract+detect duplicates. Format: `Error: tool 'listOpenDeviations' registered in 3 files: [path1, path2, path3]`. Exit 1 on duplicates.
- [ ] **T9** — Wire detector: prefer adding to `pnpm turbo lint` pipeline (catches developers before push, also runs in CI). Alternative: `.husky/pre-push` addition.
- [ ] **T10** — Verify: run detector locally → exit 0. Manually grep each removed tool name → single source.
- [ ] **T11** — Typecheck + site-map:validate.
- [ ] **T12** — G4 supervisor code-reviewer pass.
- [ ] **T13** — HANDOFF + close-feature.

## Acceptance Criteria

- [ ] `pnpm turbo typecheck` 0 errors
- [ ] `pnpm --filter web site-map:validate` exit 0
- [ ] `scripts/check-tool-name-collisions.ts` exits 0 (no collisions)
- [ ] Detector script runs as part of `pnpm turbo lint` OR pre-push hook
- [ ] `grep -rn 'modelToolName: "listOpenDeviations"' apps/web/src/app/dashboard/` → exactly 1 hit
- [ ] `grep -rn 'modelToolName: "getDriftStatus"' apps/web/src/app/dashboard/` → exactly 1 hit
- [ ] `grep -rn 'modelToolName: "getProtocolDetail"' apps/web/src/app/dashboard/` → exactly 1 hit
- [ ] Primary journey verified (feature: hms-collision-fix)
- [ ] HANDOFF written
- [ ] G4 APPROVE

## Risks

- **Hms umbrella loses 2 tools.** Documented UX change. Mitigation: `switchHmsTab` + `focusDeviation` umbrella tools remain for navigation.
- **`useHmsTools` input props shrink** — `HmsToolInput.openDeviations` + `driftInsights` may no longer be needed. Verify other tools (`focusDeviation`, `switchHmsTab`) don't depend; if unused, remove from input type + caller (hms-tools-bridge.tsx).
- **`useGovernanceTools` loses `listOpenDeviations`** — verify caller doesn't depend.
- **CI detector wire-point:** lint task = catches developers before push, also runs in CI. Recommend that over pre-push hook (which can be bypassed with `--no-verify`).
- **Detector script complexity:** handle multi-line `modelToolName:` literals, comment-style false positives. Use careful regex with comment-stripping OR AST-light parsing.
- **L-0042 migration timestamp:** N/A — no new migration this sortie.

## Next

Single sonnet build agent dispatched with 5 council conditions. Solo + sequential. After T13 close-feature, Sortie 3 (`hms-cluster-polish-read`) clears.
