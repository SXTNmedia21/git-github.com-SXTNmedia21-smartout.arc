---
title: "Journeys — recon-wizard-mobile"
status: done
updated: 2026-04-22
created: 2026-04-22
module: operations
tags: [journey, m2, clockout-wizard, daily-operation]
---

# Journeys — M2 Clockout Wizard (Mobile)

Five flows covering the shift leader's happy path, resumability, non-leader guardrails, admin-override escalation, and offline tolerance. Written in the format the Journey Guardian expects — precondition, numbered steps, postcondition, error paths.

---

## Journey 1: Shift-leader closes the day end-to-end (happy path)

**Precondition:** Kari Nordmann is the duty leader on `department_session#abc` at Café Skuta. The session has transitioned `active → pending_signoff` (trigger-driven on last punch-out). Push-dispatch has fired. Her phone receives a notification titled "Avstem dagen · Café Skuta venter på avstemming."

1. Kari taps the push notification.
   - System: `expo-notifications.addNotificationResponseReceivedListener` fires. `resolveDeepLink("reconciliation_pending_signoff", { session_id, deep_link })` returns `/(app)/(home)/clockout?sessionId=abc&source=push`. Router pushes.
   - Kari sees: wizard mounts in < 1s. WizardHeader shows "Dagens avstemming · 1 / 7". Ambient warm background.
2. Kari confirms Step 00 (Stemplet ut).
   - System: `saveWizardStepAction` (mobile direct JWT path) merges `wizard_state.step_data["00_stempletut"] = { confirmed: true, punch_out_time }`, bumps `last_completed_step` to 0, emits `reconciliation step_completed`.
   - Kari sees: StepSyncIndicator fades in a Check icon over 400ms. Wizard advances to Step 01.
3. Kari reviews KPI tiles on Step 01 (Oversikt).
   - System: renders omsetning, dekningsgrad, timer, lønn. Lønn row shows a warm amber "Estimat" pill because no Riksavtalen-derived number is available for today (Invariant #12).
   - Kari taps "Fortsett" → step save → advance.
4. Kari confirms Step 02 (Omsetning).
   - System: Step02 form is prefilled from OCR (or empty in the pilot stub). Kari corrects card vs. cash. Keyboard lifts the form via `KeyboardAvoidingView`. Step save → advance.
5. Kari counts cash on Step 03 (Kontanttelling).
   - System: `CashPadInput` renders 500/200/100/50/20/10/5/1 with 56px touch targets. "Forventet kontant" reads from Step 02's `revenue_cash`. Variance updates in real-time.
   - Kari sees: totalled NOK figure + variance pill. Step save → advance.
6. Kari reviews Step 04 (Avvik) — 1 resolved deviation today, none open. Adds optional note. Advances.
7. Kari reviews Step 05 (Se gjennom) summary.
   - System: summary rows show revenue, cash variance, deviations. `blockers = []` (no missing cash count, no open deviations). CTA "Send inn avstemming" is enabled.
8. Kari taps "Send inn avstemming".
   - System: `submitReconciliationAction` (web) OR `submitWizard` mutation (mobile JWT path): `daily_reconciliation.status` → `submitted`, `settled_by` + `settled_at` populated, `session_note(note_type='closing')` row inserted with generated summary, `reconciliation submitted` event emitted.
   - Kari sees: Step 06 success orb — warm-to-success halo, CheckCircle2 48px, headline "Sendt inn", body "Dagen er avstemt og sendt til godkjenning", CTA "Tilbake til i dag".
9. Kari taps "Tilbake til i dag" → back to home.

**Postcondition:**
- `daily_reconciliation.status = 'submitted'`, `settled_by = Kari.profile_id`, `wizard_state.last_completed_step = 5` (Step 05 Se-gjennom was the last recorded step).
- `session_note` row with `note_type='closing'` carrying the generated summary.
- `engine_event` rows for `reconciliation step_completed` (×6) + `reconciliation submitted` (×1).
- Kari's wizard is closed; the admin now sees the reconciliation pending approval in Day Control.

**Error paths:**
- Network drops between Step 02 and Step 03 → `StepSyncIndicator` flips to "queued" (offline) or "error" (save fails). See Journey 5.
- Kari closes the app mid-wizard → see Journey 2 (resumability).
- Cash count not entered → see Journey 4 (admin override).

---

## Journey 2: Leader re-enters the wizard 3 hours later (resumability)

**Precondition:** Kari started the wizard at 23:05, completed Steps 00–03, then got pulled into a guest conversation. The app was backgrounded. At 02:15 she reopens it. `wizard_state.last_completed_step = 3`, `last_touched_at = 2026-04-22T23:15:00Z`.

1. Kari opens the app from her home-screen icon.
2. She navigates to the home tab → sees "Avstem dagen" card on `BeforeShiftView` (M3 surfaces last-closed session).
3. Kari taps "Fortsett avstemming" (or taps the persistent push banner, if still visible).
   - System: router pushes `/(app)/(home)/clockout?sessionId=abc` (no `source=push` this time).
   - Mount: `useReconWizardState` loads `wizard_state`. `wizardStaleMinutes = ~190 min` > `STALE_MINUTE_THRESHOLD (720)` is FALSE — the 12h threshold is for stale-prompt; `staleMinutes >= 60` triggers the inline StalenessBanner on the active step.
4. Kari sees: the StalenessBanner: "Sist redigert 3t 10min siden — sjekk at tallene fortsatt stemmer." Wizard starts at Step 04 (next after last-completed 3).
5. Kari re-checks the numbers (they're fine), advances through Steps 04–05 → submits in Step 05 → success Step 06.

**Postcondition:** Same as Journey 1 — submission is durable regardless of wizard pause duration.

**Error paths:**
- `last_touched_at > NOW - 12h` (e.g., reopened next morning) → `StalenessPrompt` card renders instead of the inline banner. "Fortsett" keeps `currentIdx` at last-completed + 1. "Start på nytt" resets `currentIdx = 0` BUT **never deletes** `wizard_state` (Invariant #13 — soft prompt). Audit reconstruction still sees all prior step_data.
- Kari is no longer duty leader (e.g., manager reassigned someone else during the pause) → `useIsDutyLeaderForSession` returns `isLeader: false` → `LeaderOnlyEmptyState` renders instead.

---

## Journey 3: Non-leader deep-links into wizard (guardrail)

**Precondition:** Ola Hansen is an employee (not a leader) at Café Skuta. The duty leader copies the wizard URL to chat: `smartout://clockout?sessionId=abc`. Ola taps it out of curiosity.

1. Ola taps the link from chat.
   - System: Expo Linking resolves `smartout://clockout` → router pushes `/(app)/(home)/clockout?sessionId=abc`.
2. Wizard mounts.
   - System: `useIsDutyLeaderForSession` runs. `duty_leader_id = Kari.profile_id`; Ola's `profileId !== Kari.profile_id`. Returns `{ isLeader: false, sessionOpen: true }`.
3. The wizard does not render the step flow. Instead:
   - `<LeaderOnlyEmptyState sessionOpen={true} onBack={router.back} />` renders.
   - Ola sees: ambient orb (decorative, `accessibilityElementsHidden`), Lock icon, Instrument Serif title "Kun vaktleder kan avstemme dagen", body "Økten er fortsatt åpen — vaktleder må fullføre avstemmingen. Du kan fortsette dagen din som vanlig.", primary CTA "Tilbake til i dag", secondary CTA "Be om lederrettighet" (stub — disabled, logs intent).
4. Ola taps "Tilbake til i dag" → `router.back()`.

**Postcondition:**
- No mutation occurred. No telemetry event emitted (role check happens before any save).
- Ola's JWT was never used against `daily_reconciliation` (the RLS policy would have rejected him too — defence in depth).

**Error paths:**
- If `sessionOpen=false` (session already closed), the body text differentiates: "Økten er stengt for denne dagen. Vaktleder har avsluttet eller venter på å avslutte avstemmingen." Same CTAs.
- If `sessionId` is malformed → query errors → `useIsDutyLeaderForSession` returns null → wizard renders `DisabledView` with "Ingen økt valgt" copy.

---

## Journey 4: Admin overrides a blocker (escalation)

**Precondition:** Kari is the duty leader. She has completed Steps 00–02 and Step 04, but skipped Step 03 (cash-count). On Step 05 (Se gjennom), the preflight surfaces one blocker: `missing_cash_count`. CTA "Send inn avstemming" is disabled.

1. Kari sees the blocker card on Step 05: warm-soft surface, AlertCircle icon, "Blokkeringer · Kontanttelling mangler".
2. She calls Nora (admin). Nora walks over, takes over her phone.
3. Nora taps the secondary CTA "Be om overstyring (admin)".
   - System: `overrideSheetRef.current?.snapToIndex(0)` — AdminOverrideSheet animates in from the bottom.
4. Nora reads the blocker chip list ("missing_cash_count") and types a reason:
   - "Kassetelling kan ikke gjøres i kveld — hovedkasse låst av teknikker. Teller i morgen kl 08:00."
   - System: every 10th character, VO announces "N tegn skrevet" (polite live region, not interrupt-spammy). The counter text transitions from warnSoftForeground (< 20 chars) to success (≥ 20 chars). Primary CTA "Bekreft overstyring" enables at 20 chars.
5. Nora taps "Bekreft overstyring".
   - System (**current M2 implementation — Phase F stub**): logs intent `{ sessionId, source, reason }`. Sheet closes. **TODO-M2-F**: full wiring to `overrideWizardBlockerAction` via Edge Function pending.
   - System (**full target**): `overrideWizardBlockerAction({ sessionId, reason, blockerCodes: ["missing_cash_count"] })` passes gateAction (seeded `reconciliation.wizard_submit_with_blocker` confirm/admin). Sets `status='submitted'`, `approval_notes = "[OVERRIDE BLOCKER: missing_cash_count] Kassetelling kan ikke ..."`. Emits `reconciliation admin_action` tagged with override.
6. Success orb renders (Step 06) with summary.

**Postcondition (when fully wired):**
- `daily_reconciliation.status = 'submitted'`, `approval_notes` prefixed `[OVERRIDE BLOCKER: ...]`.
- Revisjonslogg (activity_trail) surfaces the override distinctly from clean approvals.
- Admin-override-rate telemetry increments.

**Error paths:**
- Reason < 20 chars → CTA disabled, accessibilityLabel reads "Begrunnelse må være minst 20 tegn."
- Nora's profile doesn't have admin role → gateAction denies → sheet shows toast (follow-up wiring).
- Session is already `submitted` / `approved` → action returns `ok: false` → toast "Avstemming er allerede godkjent."

---

## Journey 5: Leader saves Step 02 while offline (offline tolerance)

**Precondition:** Kari is in the kitchen of Café Skuta. The wifi routers are in the cellar. She loses connectivity mid-wizard.

1. Kari advances from Step 01 to Step 02.
   - System: `OfflineQueuePill` renders (WifiOff icon + "Gjemmes lokalt · synkes når online"). `useIsOnline` emits `false`.
2. Kari fills in card/cash/transactions. Taps "Fortsett".
   - System: `saveStep` mutation fires. Supabase client queues the request (react-native no-op until connectivity). `StepSyncIndicator` flips to "queued".
3. Kari advances to Step 03 optimistically (UI moves forward; her numbers are in memory).
4. Two minutes later, Kari walks back to the dining room — wifi returns.
   - System: `useIsOnline` emits `true`. The pending mutation retries (TanStack default retry). Supabase responds 200. `StepSyncIndicator` flips to "saved" (Check icon fade-in).
   - `reconciliation step_completed` is emitted now, with the correct workspace_id + actor_id resolved at save-time.
5. Kari completes Steps 03–05 online and submits.

**Postcondition:**
- `wizard_state.step_data["02_omsetning"]` persists Kari's values.
- `last_touched_at` reflects the actual save moment (post-reconnect), not the offline "save intent" moment.

**Error paths:**
- Reconnect saves fail (e.g., backend maintenance) → `StepSyncIndicator` flips to "error". Kari's inputs remain in local state until she taps "Fortsett" again.
- User force-kills the app while offline → current M2 loses the in-memory step_data (no SQLite queue). Follow-up: wire `save_wizard_step` as a `WriteAction` in `apps/mobile/src/lib/sync/queue.ts` to make the local buffer durable across kills.

---

## Invariants referenced

- **#7** Role-gated mount (Journey 3) — `duty_leader_id ?? opened_by`.
- **#8** Resumability (Journey 2) — soft prompt at 12h threshold, inline banner at 1h, never auto-reset.
- **#9** Admin override (Journey 4) — 20-char reason, audit-tagged with `[OVERRIDE BLOCKER]` prefix.
- **#11** Split-shift handover read (Journey 2 precondition) — BeforeShiftView surface from M3.
- **#12** Riksavtalen lønn (Journey 1, Step 01) — `Estimat` pill when tariff-derivation missing.
- **#13** No auto-reset (Journey 2 "Start på nytt") — only `currentIdx` resets; `wizard_state` persists.
