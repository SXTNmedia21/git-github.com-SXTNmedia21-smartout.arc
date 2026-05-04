---
title: "Plan — recon-wizard-mobile"
status: in_progress
updated: 2026-04-22
created: 2026-04-22
module: operations
tags: [plan, m2, clockout-wizard, daily-operation]
---

# Plan — recon-wizard-mobile

> Branch: `feat/daily-operation-recon-wizard-mobile` · Worktree: `/home/sxtnl/dev/smartout.ai-daily-operation-wt-3` · Base: `campaign/daily-operation` · Module: operations · Started: 2026-04-22

## Goal

Build the M2 mobile clockout wizard — a 6-step reconciliation flow that lets the on-duty leader close the day in 4–6 minutes on mobile, with resumability, offline tolerance, and audit-tight handover to the admin.

## Scope (in)

- Mobile wizard route `apps/mobile/app/(app)/(home)/clockout.tsx` gated by `EXPO_PUBLIC_RECON_WIZARD_V2`.
- 6 step components + success screen (`Step00..Step06`).
- 8 shared UI primitives under `apps/mobile/src/components/reconciliation/_shared/`.
- `daily_reconciliation.wizard_state` JSONB column + shift-leader JWT write policy.
- 3 Server Actions for web parity: `saveWizardStepAction`, `submitReconciliationAction`, `overrideWizardBlockerAction`.
- Mobile direct-to-DB write path via JWT (new RLS policy).
- 3 new design tokens (`--warn-soft`, `--data-estimate`, `--destructive-muted`).
- Push-dispatch trigger for `active → pending_signoff` with clockout deep-link.
- Deep-link map entry `reconciliation_pending_signoff`.

## Scope (out — deferred or cross-campaign)

- Q7 hospitality flags (cash/tips/HACCP enablement). Stubbed with `TODO-Q7-ADR` markers; pilot renders all steps on until cross-campaign ADR lands.
- POS receipt OCR for Step 02 revenue prefill — follow-up sortie.
- Full offline queue integration (`save_wizard_step` as WriteAction in sync/queue.ts). Current approach writes synchronously via JWT; offline falls back to staleness prompt + queue pill.
- Admin override execution wire — Phase F stub logs intent; live wiring to an Edge Function wrapping `overrideWizardBlockerAction` is a follow-up.

## Tasks (completed)

- [x] Phase A — design tokens (warn-soft, data-estimate, destructive-muted) added to `tokens.css` + `tokens.ts` + `native.ts` (light + dark).
- [x] Phase B — migration `20260516140000_daily_reconciliation_wizard_state.sql` (JSONB column, shift-leader JWT policy, btree index on `last_touched_at`).
- [x] Phase C — 3 Server Actions (save / submit / override) using `resolveCurrentProfile + gateAction` pattern; registers `reconciliation step_completed` + `reconciliation pending_signoff` in telemetry registry.
- [x] Phase D — 8 shared UI primitives (StalenessBanner, OfflineQueuePill, StepSyncIndicator, WizardHeader, UnsavedChangesSheet, AdminOverrideSheet, CashPadInput, LeaderOnlyEmptyState) + barrel index.
- [x] Phase E — 7 step components + wizard route + `use-recon-wizard` hook + role-gated mount + soft resumability (12h threshold).
- [x] Phase F — push-dispatch trigger `trg_push_session_pending_signoff` + `reconciliation_pending_signoff` deep-link map entry.
- [x] Phase G — plan / journey / handoff documentation.

## Acceptance Criteria

- [x] Phase A–F committed with conventional commits.
- [x] Decision log references inline in migrations + Server Actions (ADR-0114, ADR-0133, ADR-0134, ADR-0156, ADR-0187, ADR-0188, ADR-0189).
- [x] User journeys written — 5 journeys in `docs/journeys/JOURNEY-recon-wizard-mobile.md`.
- [ ] `pnpm turbo typecheck --filter=web --filter=@smartout/mobile` passes with 0 errors (run at closure).
- [ ] Authority-seed-parity CI gate passes (all 4 recon capabilities seeded in `20260516100000`).
- [x] Handoff written — `docs/HANDOFF-recon-wizard-mobile.md`.

## Risks

| Risk | Mitigation |
|---|---|
| Q7 hospitality flags missing → pilot sees UI for every step | Tagged with `TODO-Q7-ADR`; greppable pre-pilot review. Pilot ships all steps on (hospitality-first). |
| Admin override not wired end-to-end on mobile (Phase F stub) | Blocker surfacing works; override request is a follow-up (likely via workspace-api endpoint). Web flow remains full. |
| Offline writes not queued (direct JWT path) | Synchronous save visible via StepSyncIndicator error state. Follow-up: wire `save_wizard_step` into `apps/mobile/src/lib/sync/queue.ts`. |
| Two triggers on same UPDATE (engine_event + push) | Intentional — ADR-0187 preserved. `trg_push_session_pending_signoff` is fire-and-forget notification, not state. |

## Decision references

- **ADR-0114** Server Actions canonical mutation primitive — all 3 web recon actions conform.
- **ADR-0133** Mobile executes, web composes — wizard is execution; authoring (period edits, tariff overrides) stays web.
- **ADR-0134** Mobile telemetry contract — `getProfileContext()` before every emit; non-null workspace_id + actor_id.
- **ADR-0156** Day-Control Panel canonical admin surface — recon events feed Day Control.
- **ADR-0187** Single-emitter invariant — preserved; new push trigger is a separate UI-surface concern.
- **ADR-0188** `handoff_notes` column deprecation — wizard does not write to it.
- **ADR-0189** Authority seed parity CI — all 4 recon capabilities seeded in `20260516100000`.
