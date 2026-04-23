---
title: "Handoff — recon-wizard-mobile (M2)"
status: done
updated: 2026-04-22
created: 2026-04-22
module: operations
tags: [handoff, m2, clockout-wizard, daily-operation]
---

# Handoff — recon-wizard-mobile (M2)

> Sub-sortie of `campaign/daily-operation` · Branch: `feat/daily-operation-recon-wizard-mobile` · Base: `eba1eddd` · 7 commits delivered.

## Summary

M2 is the mobile-first clockout wizard — a 6-step reconciliation flow the on-duty leader drives at end-of-day. It reads the current session's state, walks the leader through confirming revenue / cash / deviations, writes a durable `wizard_state` snapshot at each step, and submits a reconciliation row with `session_note(closing)` for audit. Push-dispatch nudges the leader on `active → pending_signoff` via a `smartout://clockout?sessionId=…&source=push` deep-link. Non-leaders hitting the URL see a deliberate LeaderOnlyEmptyState; admin-override is blocker-gated with a 20-char reason.

## What shipped (7 commits)

| Phase | Commit | Purpose |
|---|---|---|
| A | `6c90ecac` | design-tokens: warn-soft, data-estimate, destructive-muted (light + dark, tokens.ts + tokens.css + native.ts) |
| B | `4cdaa731` | db: `daily_reconciliation.wizard_state jsonb` + shift-leader JWT write policy + `last_touched_at` index |
| C | `03850657` | web: 3 Server Actions (saveWizardStepAction, submitReconciliationAction, overrideWizardBlockerAction) + 2 new registry events |
| D | `63480a32` | mobile-ui: 8 shared primitives — Staleness banner, OfflineQueuePill, StepSyncIndicator, WizardHeader, UnsavedChangesSheet, AdminOverrideSheet, CashPadInput, LeaderOnlyEmptyState |
| E | `55d0fdfd` | mobile-wizard: 7 step components + `clockout.tsx` route + `use-recon-wizard` hook + resumability + role gate |
| F | `ae4af54b` | push-wiring: trg_push_session_pending_signoff migration + `reconciliation_pending_signoff` deep-link map entry |
| G | (this commit) | docs: plan + journey + handoff |

## Decisions

All decisions inherit from committed ADRs — no new ADRs this sub-sortie.

- **ADR-0114** Server Actions canonical mutation primitive → 3 new actions conform. No reinvented mutation paths.
- **ADR-0133** Mobile executes, web composes → wizard **is** execution. Authoring (period edits, authority-config, tariff overrides) remains web.
- **ADR-0134** Mobile telemetry contract → `getProfileContext()` resolves `{profileId, workspaceId}` before every `emit()`. Non-null IDs enforced on every path.
- **ADR-0156** Day-Control Panel canonical admin surface → recon events feed Day Control; no separate recon feed.
- **ADR-0187** Single-emitter invariant → **preserved**. `trg_session_pending_signoff` remains sole emitter for state-change engine_event. New `trg_push_session_pending_signoff` is a separate UI-surface concern (fire-and-forget push), not a state emitter.
- **ADR-0188** `handoff_notes` column deprecation → wizard does not write to it. All wizard state lives in `wizard_state` JSONB.
- **ADR-0189** Authority seed parity CI → all 4 recon capabilities (`override`, `submit`, `wizard_submit_with_blocker`, `wizard_save`) already seeded in `20260516100000`. No new literals introduced.

## Learnings

1. **Mobile Server Action path not yet modelled** — the current codebase has web Server Actions + mobile offline-queue, but no clean mobile → Server Action invocation wrapper. M2 opts for direct Supabase JWT writes on mobile (with a dedicated shift-leader RLS policy) to keep the ship moving; follow-up should standardize via workspace-api Edge Function façade so mobile and web go through the same authorization path.
2. **Two triggers on the same UPDATE is fine, if roles are distinct** — ADR-0187 says one emitter per state. It does NOT say one trigger per UPDATE. Separating the push side-effect into `trg_push_session_pending_signoff` kept `trg_session_pending_signoff` untouched (ADR-0187 respected) while still enabling the push deep-link.
3. **Staleness vs. resumability are two thresholds, not one** — inline `StalenessBanner` at > 60min (nudge), full `StalenessPrompt` at > 12h (decision). Treating them as one cliff creates modal fatigue; treating them as two steps preserves the soft-prompt Invariant #13.
4. **Q7 flags need a greppable anchor** — `TODO-Q7-ADR` is intentionally searchable. A pre-pilot grep validates nothing leaked past the hospitality-first default.
5. **Role gate must run before render**, not after — `useIsDutyLeaderForSession` is a query, not a side-effect. Without a mount-time guard, non-leaders see a flash of wizard content before the role check completes. Rendering `LeaderOnlyEmptyState` directly in the suspense/loading branch avoids the flash.

## Known issues / debt

1. **Admin override is a stub on mobile (Phase F TODO-M2-F)** — `handleOverrideConfirm` currently logs `{ sessionId, source, reason }` and closes the sheet. Full wiring requires either an Edge Function façade around `overrideWizardBlockerAction` or a direct Supabase RPC. Web side is fully wired.
2. ~~**Offline queue not wired for wizard steps**~~ — **shipped 2026-04-22 (commit `5b3d310c`).** `save_wizard_step` added as the 21st `WriteAction`. Zod-validated at enqueue (ADR-0134 gate 2). Handler replays the same load → merge → upsert as the online JWT path, so the persisted JSONB is identical regardless of sync path. `StepSyncIndicator` now surfaces post-save "queued" via `saveStepState.lastQueued`. 4 new schema tests cover payload contract.
3. **OCR prefill for Step 02 revenue is stubbed** — `ocrRevenueTotal=null` default; fields start empty. Follow-up sortie wires `settlement_image` OCR → Step 02 initial values.
4. **Hospitality flags (Q7) stubbed** — `showCashStep`, `showTipsStep`, `showHaccpSection` hardcoded to `true`. Greppable marker `TODO-Q7-ADR`. Resolved by cross-campaign ADR.
5. **Step 06 motion is fully static** — `useReducedMotion()` guard present but no Animated loop to gate. If we later add breathing orb animation, respect `reducedMotion` AND add a battery probe via `expo-battery`.
6. ~~**WizardHeader department name is hardcoded placeholder**~~ — **shipped 2026-04-22 (commit `2e165927`).** `useIsDutyLeaderForSession` now returns `departmentName` via a PostgREST JOIN on `department:department_id(name)`; WizardHeader renders `{department.name} — Dagens avstemming`. Falls back to the generic label when the JOIN returns null.
7. ~~**Step00 `punchOutTime` is `null`**~~ — **shipped 2026-04-22 (commit `c04d1e9c`).** Same hook now also returns `leaderPunchOutTime` — the effective leader's most recent completed `timesheet.time_entry.punch_out` for the session date. Null-safe: pre-punch-out still renders "—". Piggybacks on the existing role-gate query (no new round-trip).

## Next steps

Ordered by risk-reduction / value:

1. **Wire admin-override end-to-end on mobile** (Phase F TODO-M2-F resolution). Either Edge Function wrap around `overrideWizardBlockerAction` or direct workspace-api endpoint. 1 dev-day.
2. **Wire Step 00 punch-out time + department name** — small polish making the wizard feel honest. < 1 dev-day.
3. **Offline queue wizard steps** — `save_wizard_step` WriteAction. Makes offline tolerance durable across force-kills. 1 dev-day.
4. **OCR prefill for Step 02 revenue** — connect `settlement_image` pipeline. 2 dev-days (depends on OCR sortie landing).
5. **Q7 hospitality flags ADR** — cross-campaign. Unblocks the cash/tips/HACCP toggles. Hospitality pilot runs fine with default-on.

## Telemetry additions

- `reconciliation step_completed` — posthog + logger only (per-step is too chatty for activity_trail).
- `reconciliation pending_signoff` — all 4 destinations. Trigger-emitted only (ADR-0187 sole emitter).
- `reconciliation_pending_signoff` — deep-link routing via push-dispatch payload `event` field (consumed by `resolveDeepLink` in `packages/notifications/src/deep-links.ts`).

## Files of interest

- Migration: `supabase/migrations/20260516140000_daily_reconciliation_wizard_state.sql`
- Migration: `supabase/migrations/20260516150000_push_dispatch_clockout_link.sql`
- Server Actions: `apps/web/src/app/dashboard/reconciliation/_actions/{save-wizard-step,submit-reconciliation,override-wizard-blocker}-action.ts`
- Mobile route: `apps/mobile/app/(app)/(home)/clockout.tsx`
- Mobile hook: `apps/mobile/src/hooks/mutations/use-recon-wizard.ts`
- Shared UI: `apps/mobile/src/components/reconciliation/_shared/*`
- Steps: `apps/mobile/src/components/reconciliation/steps/Step{00..06}*.tsx`
- Deep-link map: `packages/notifications/src/deep-links.ts`
- Tokens: `packages/design-tokens/src/{tokens.ts,tokens.css,native.ts}`
- Telemetry: `packages/telemetry/src/registry.ts` (reconciliation events)
