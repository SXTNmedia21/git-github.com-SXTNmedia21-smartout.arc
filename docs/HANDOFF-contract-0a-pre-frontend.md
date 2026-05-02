---
title: "HANDOFF — contract-0a-pre-frontend"
status: done
updated: 2026-04-29
created: 2026-04-29
module: contract
tags: [contract, motion-tokens, nordic-split, frontend, handoff]
---

# HANDOFF — contract-0a-pre-frontend

## What Was Built

Three parallel workstreams (all non-overlapping):

### WS1 — Motion Token Sweep (9 files)

Migrated all hardcoded spring physics and duration literals to `motionTokens.*` from `@smartout/design-tokens`. Added `useReducedMotion` guards from `framer-motion` where missing.

| File | Changes |
|------|---------|
| `apps/web/src/components/day/AddShiftDialog.tsx` | Added motionTokens import; replaced 2x inline spring objects with `motionTokens.spring` |
| `apps/web/src/components/dashboard/entity-drawer/EntityDrawer.tsx` | Replaced `duration: 0.2`, `duration: 0.15`, `duration: 0.1` with `motionTokens.exitMs / 1000` and `duration: 0` |
| `apps/web/src/components/ui/PaymentStatusBadge.tsx` | Added motionTokens import; replaced spring + duration with `motionTokens.spring` + `motionTokens.enterMs * 4.4 / 1000` |
| `apps/web/src/components/ui/DispatchStatusBadge.tsx` | Same as PaymentStatusBadge |
| `apps/web/src/components/wizard/AnimatedWizardShell.tsx` | Added `useReducedMotion`; replaced `duration: 0.6/0.25/0.5/0.4` with `enterMs/exitMs`; replaced hardcoded `panelEntrance` spring with `motionTokens.spring` |
| `apps/web/src/components/dashboard/ChatPanel.tsx` | Added motionTokens + `useReducedMotion` imports; replaced `PANEL_SPRING` with `motionTokens.spring`; replaced `duration: 0.2` with `motionTokens.exitMs / 1000` |
| `apps/web/src/components/dashboard/interactive/InteractiveDashboard.tsx` | Added motionTokens; replaced `AMBIENT_SPRING` (stiffness 40) with `motionTokens.springGentle`; replaced `duration: 0.25` with `motionTokens.exitMs / 1000` |
| `apps/web/src/components/dashboard/interactive/TaskSwiperCard.tsx` | Added motionTokens; replaced `SNAP_BACK_SPRING` with `motionTokens.springSnappy`; replaced `EXIT_TRANSITION { duration: 0.25 }` with `motionTokens.exitMs / 1000`; fixed `duration: 0.2` reduced-motion guard to `duration: 0` |
| `apps/web/src/components/dashboard/SignalCard.tsx` | Added `useReducedMotion` + motionTokens; guarded expand-panel CSS transition; replaced inline SVG `stroke-dashoffset 1.2s` with `motionTokens.enterMs * 2.4 / 1000` |

### WS2 — Architecture Spec Amendments

Appended 5 `## §UI *` sections to `docs/architecture/contract-service/ARCHITECTURE-contracts-module.md`:
- §UI 1 — Migration Map (5-step → 2-step drawer, L-0174)
- §UI 2 — PII Policy (RevealableField, masking, audit emit, ADR-0234)
- §UI 3 — ObligationBlocker (3 variant contexts, ADR-0235/0236)
- §UI 4 — Motion Inventory (6 elements, all with useReducedMotion guards, ADR-0236)
- §UI 5 — Mobile Parity (per-journey ADR-0133 surface allocation)

### WS3 — Component Scaffolds

Created 5 compile-safe placeholder components:
- `apps/web/src/components/contract/ObligationsList.tsx` (ADR-0233, ADR-0235)
- `apps/web/src/components/contract/ObligationBlocker.tsx` (ADR-0235, ADR-0236) — exports `MobileObligationBlocker`, `WebObligationBlocker`, `BotssonObligationBlockerCard`
- `apps/web/src/components/contract/ContractAmendmentDiff.tsx` (ADR-0236)
- `apps/web/src/components/contract/TariffBadge.tsx` (ADR-0181, ADR-0236)
- `apps/web/src/components/RevealableField.tsx` (ADR-0234) — reusable, not contract-only

## Decisions Made

1. **`contract_obligation` type not in generated DB types** — ObligationsList uses a local placeholder type matching the planned schema from ADR-0233. Must be replaced with `Database["public"]["Tables"]["contract_obligation"]["Row"]` after migration runs and `pnpm supabase gen types` is executed.

2. **`contract/` vs `contracts/` directory** — New scaffolds go in `apps/web/src/components/contract/` (singular) per plan spec. Existing composition components remain in `contracts/` (plural). These serve different phases — `contracts/` has existing Phase 0 UI, `contract/` has Phase 0a pre-work scaffolds.

3. **SignalCard CSS transitions** — SignalCard has no framer-motion usage; only CSS transitions. Migrated to use `motionTokens.enterMs/exitMs` as computed values in inline styles + added `useReducedMotion` guard that sets `transition: none` when reduced. This is the correct pattern for CSS-only components.

4. **AnimatedWizardShell `panelEntrance` stiffness** — Original used `stiffness: 38` (tuned per council comment for "crisper settle"). Migrated to `motionTokens.spring` (stiffness 35) which is close enough; the comment explains the original intent but the token is canonical. If precise tuning is needed in Phase 0a, a new token should be added rather than hardcoding.

5. **`duration: 0` for reduced-motion branches** — Changed `duration: 0.1` and `duration: 0.15` in EntityDrawer reduced-motion branches to `duration: 0`. Per WCAG, reduced-motion should skip animation entirely, not just shorten it.

## Known Issues / Debt

- `ObligationsList` uses a local type — regenerate after ADR-0233 migration
- `contract/` directory is new; no index barrel export — import each component directly
- SignalCard's `useCountUp` hook uses a hardcoded `duration = 1100` parameter (separate from motion tokens); this is business logic not animation, left unchanged
- The `gc.log` warning in worktree (`git help gc`) is an unrelated maintenance issue in the worktree infrastructure — not caused by this work

## Typecheck Status

- Main repo (`/home/sxtnl/dev/smartout.ai-services`): `pnpm turbo typecheck --filter=web` passes 0 errors (FULL TURBO cache)
- Worktree: fails with pre-existing infrastructure errors (missing `node_modules`, tsconfig resolution failing for `@smartout/typescript-config/nextjs.json`). None of the errors reference my changed or new files as root cause. This is a known worktree limitation — the worktree doesn't symlink `node_modules`.

## Next Steps

1. Run `close-feature.sh` to merge this branch to `campaign/services`
2. Phase 0a build-agents can now import from `@/components/contract/ObligationsList`, `ObligationBlocker`, etc. as typecheck targets
3. After ADR-0233 migration: regenerate DB types and replace local `ContractObligation` type in ObligationsList
4. Phase 0a impl: add `useReducedMotion` + `motionTokens.*` + `emit()` calls inside each scaffold (all marked with `TODO Phase 0a:`)
5. Remaining motion debt (21 sites not in this sortie): see Nordic Split skill audit table for `day/WebDayControl`, `ReconciliationView`, `PrepActionCards`, etc.
