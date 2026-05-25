---
title: "Restaurant Week Sim — Bugs"
status: complete
created: 2026-05-25
updated: 2026-05-25
module: meta
tags: [bugs, sim, restaurant-week, hotel, festival, dedup-2026-05-23]
---

# Restaurant Week Sim — Bug List (code-level defects)

> **Scope:** Bistro week (5 agents) + Hotel wedding (3 agents) + Festival (3 agents) = 11 specialists, ~93 unique findings.
> **Dedup baseline:** `docs/test-runs/2026-05-23-journey-sweep/BUGS.md` (22 baseline bugs).
> **What counts as a bug here:** implementation EXISTS but has a code-level defect — wrong PK column, wrong status code, off-by-one date, missing emit, swallowed Zod error, deprecated table writes, etc. "Implementation does not exist" goes to GAPS.md.
>
> **NEW bugs found:** **28 code-level defects** across SCHEMA / PRODUCT / HARNESS / ENV / OPS.
> **Severity distribution:** 4 CRITICAL, 9 HIGH, 12 MEDIUM, 3 LOW.

---

## SCHEMA bugs (database-level, production landmine)

### BUG-SIM-01 — `employment_form` NOT NULL conflict with volunteer NULL pattern 🔴 CRITICAL

- **Where:** `supabase/migrations/20260519150000_contract_text_to_enum_cast.sql:160` (adds NOT NULL) vs `supabase/migrations/20260515100100_employment_contract_tripletex_columns.sql:38` (NULL = volunteer/exclude-from-Tripletex)
- **Evidence:** A9 / FES-5 — two migrations in direct conflict. The Tripletex column migration documents "NULL = volunteer — excluded from Tripletex sync." The Wave-3 cast migration silently adds `SET NOT NULL` on `employment_form`.
- **Impact:** Any workspace with volunteer contracts predating Wave-3 cannot pass forward migration; new volunteers cannot be onboarded at all. Festival, NGO, and event workspaces silently fail. Latent data-integrity bug, not just a festival gap.
- **Severity:** CRITICAL
- **Fix:** Either add `volunteer` to `employment_form_enum` (preferred, see GAP-SIM-cross-2) and drop NOT NULL OR allow `NULL` with a documented `is_volunteer` derived predicate. Forward-only migration must backfill existing NULL rows before re-applying NOT NULL.

### BUG-SIM-02 — `daily_reconciliation.UNIQUE (workspace_id, department_id, date)` blocks multi-zone aggregation 🟠 HIGH

- **Where:** `supabase/migrations/20260304200100_daily_reconciliation.sql:53`
- **Evidence:** A11 / GAP-A11-01 — three bar zones at festival = three separate reconciliation rows with no aggregate. Same applies to hotel multi-department event close (HOTEL-8).
- **Impact:** No rollup view for "festival total" or "wedding total." Pontus + Henrik must manually sum N rows in spreadsheet. Not corruption — but eliminates Smartout's commercial-layer value for any multi-zone op.
- **Severity:** HIGH
- **Fix:** Either (a) add aggregate view `v_daily_reconciliation_workspace_total` that sums by date, (b) introduce `event_session_id` FK to enable cross-dept rollup, or (c) document workaround until ADR addresses event entity (see GAP-SIM-cross-1).

### BUG-SIM-03 — `tip_distribution` partial index `WHERE payroll_period_id IS NOT NULL` leaves orphans unqueryable 🟡 MEDIUM

- **Where:** `supabase/migrations/20260428220004_tips_distribution_table.sql:34` (partial index excludes NULL); `supabase/migrations/20260527100900_payroll_phase1_tip_payroll_fk.sql:17-22` (`ON DELETE SET NULL`)
- **Evidence:** A8 / BUG-A8-02 — `ON DELETE SET NULL` means paid distributions become orphaned when a payroll period is deleted; the partial index excludes them, making them un-auditable.
- **Impact:** Silent data-quality decay. Audit query "find paid tip distributions never tied to a period" requires full table scan.
- **Severity:** MEDIUM
- **Fix:** Add partial index `WHERE payroll_period_id IS NULL AND status = 'paid'`, or change FK to `ON DELETE RESTRICT`.

### BUG-SIM-04 — `channel.is_active` migration staged but agent `sendMessage` still filters on `is_archived` 🟡 MEDIUM

- **Where:** Staged migration `supabase/migrations/20260625130000_channel_is_active_column.sql` (per `git status`); consumer `packages/ai/src/capabilities/communication/tools.ts:219`
- **Evidence:** A3 / NEW-FIND-K + A4 / BUG-A4-03 — `is_active` is orthogonal to `is_archived` per migration comment, but `sendMessage` draft phase guards only on `is_archived=false`. `helpdesk_query/tools.ts:372` already uses `is_active=true`. Drift between two channel-state semantics.
- **Impact:** Deactivated-but-not-archived channels will pass `sendMessage` guard. Announcement fan-out may silently target dead channels.
- **Severity:** MEDIUM
- **Fix:** Update `tools.ts:219` to additionally filter `.eq("is_active", true)`. Audit all channel selects in capabilities for the same drift before applying the migration.

---

## PRODUCT bugs (real UI / API / capability logic regressions)

### BUG-SIM-05 — `HelpDesk.tsx` + `use-help-requests.ts` write to DEPRECATED `help_request` table 🔴 CRITICAL

- **Where:** `apps/web/src/app/dashboard/komm/_components/HelpDesk.tsx`; `apps/web/src/.../use-help-requests.ts:49-60` (insert) + `:26-39` (read)
- **Evidence:** A4 / BUG-A4-08 — `supabase/migrations/20260519110000_deprecate_help_request_table.sql` explicitly DEPRECATED this table ("DO NOT WRITE"). New tickets must spawn `engine_state(process_id='helpdesk_query_lifecycle')`. UI never migrated.
- **Impact:** Cascade of failures: no engine_state row, no `engine_delayed_trigger`, no SLA breach, `useMinKo` queue returns empty, `QueueSheet` empty, no escalation. This is the deep root cause of baseline **BUG-20** (helpdesk SLA 0/4 pass). Even fixing `engine_authority_config` for `communication` won't help — the UI never reaches the new code path.
- **Severity:** CRITICAL
- **Fix:** Rewire `HelpDesk.tsx` to call `helpdesk_query.open_ticket` capability tool via Server Action OR a new BFF route. Remove writes to `help_request`.

### BUG-SIM-06 — `BatchActionBar.handlePublishAll` bypasses cascade rule validation 🟠 HIGH

- **Where:** `apps/web/src/app/dashboard/schedule/_components/batch-action-bar.tsx:39-50`
- **Evidence:** A2 / BUG-A2-1 — calls `publishShifts.mutate(draftIds)` directly. Skips `PublishOverviewDialog` → `usePublishValidation` → `evaluateFrameworkRules`. The proper dialog path in `page.tsx:750-774` uses `setOnPublishAll`.
- **Impact:** Manager publishes 18 shifts in one click with zero Riksavtalen / Aml. §10-6 framework validation. Tariff and rest-time violations slip through silently. Compounds with baseline **BUG-19** (cascade UI 8/18 fail).
- **Severity:** HIGH
- **Fix:** Route `handlePublishAll` through the gated `PublishOverviewDialog` (same path as `DashboardShell`'s `onPublishAll`).

### BUG-SIM-07 — `absence-popover` writes `new Date().toISOString()` (TIMESTAMPTZ) into `DATE` columns → off-by-one after 22:00 UTC 🟠 HIGH

- **Where:** `apps/web/src/app/dashboard/schedule/_components/absence-popover.tsx:62-70`
- **Evidence:** A2 / BUG-A2-2 — `nowStr` passed to `createAbsence.mutate()` as `startDate`+`endDate`. Mapper writes to `schedule_absence.start_date`/`end_date` (`DATE NOT NULL`, `20260301600003_schedule_persistence_tables.sql:48-49`). Postgres coerces in UTC — sick-call at 00:30 Oslo (22:30 UTC) lands on yesterday.
- **Impact:** Absence date wrong-day for any registration after ~22:00 Oslo. Disappears from the correct week grid; SLA + payroll read wrong date.
- **Severity:** HIGH
- **Fix:** Replace `nowStr` with `absencePopover.dateId` for both start and end.

### BUG-SIM-08 — `getShiftColleagues` uses wrong PK column (`id` not `schedule_shift_id`) — always returns `shift_not_found` 🟠 HIGH

- **Where:** `packages/ai/src/capabilities/schedule/tools.ts:136` (and select at `:146`)
- **Evidence:** A2 / BUG-A2-3 — `.eq("id", params.shift_id)` against table whose PK is `schedule_shift_id`. Compare `getWorkspaceSchedule` (line 312) which uses the correct column.
- **Impact:** Botsson `get_shift_colleagues` tool silently returns `{"error":"shift_not_found"}` for every call. Maria asking "hvem jobber med meg?" never gets a useful answer.
- **Severity:** HIGH
- **Fix:** `.eq("schedule_shift_id", params.shift_id)` + `select("schedule_shift_id, ...")`.

### BUG-SIM-09 — `getShiftDetail` uses wrong PK column — always returns `shift_not_found` 🟠 HIGH

- **Where:** `packages/ai/src/capabilities/schedule/tools.ts:241,243`
- **Evidence:** A2 / BUG-A2-4 — same class as BUG-SIM-08 (`id` vs `schedule_shift_id`).
- **Impact:** Manager Botsson queries for a specific shift always error.
- **Severity:** HIGH
- **Fix:** As BUG-SIM-08.

### BUG-SIM-10 — `useGPSGuard` built but never invoked; telemetry hardcodes `gps_verified: false` 🟠 HIGH

- **Where:** `apps/mobile/src/hooks/shift-clock/useGPSGuard.ts:75` (full implementation); `apps/mobile/src/hooks/mutations/use-punch.ts:44-87` (does NOT call `getPosition`)
- **Evidence:** A3 / NEW-BUG-A — `usePunch.punchIn()` enqueues at `:59` directly; `punch_in_location` set to `null`; emit at `:87` hardcodes `gps_verified: false, gps_distance_meters: null`. `PunchAnimation.tsx:60` shows "Sjekker GPS" UI step — purely cosmetic. Confirmed in `docs/domains/shift-clock/GAPS-AND-DEBT.md:G1-G2`.
- **Impact:** Workers can punch in from anywhere; audit trail falsely claims GPS was not checked. Silent compliance gap — workspaces that "have GPS required" actually do not.
- **Severity:** HIGH (mis-promises compliance to operator)
- **Fix:** Call `useGPSGuard.getPosition()` before `enqueue("punch_in", ...)`; pass the snapshot to the payload; set `gps_verified: true` when within geofence. Requires `shift_clock_config.gps_reference_lat/lng` seed from department location.

### BUG-SIM-11 — `audience-resolver.ts` `on_duty` branch missing `workspace_id` filter (service-role bypasses RLS) 🟠 HIGH

- **Where:** `packages/ai/src/capabilities/communication/audience-resolver.ts:59-73`; `apps/web/src/app/dashboard/komm/_hooks/use-audience-resolver.ts:46-61`
- **Evidence:** A4 / BUG-A4-07 — both queries select `timesheet.time_entry WHERE punch_out IS NULL LIMIT 500` with NO `workspace_id` filter. Service-role bypasses RLS. Comment at audience-resolver.ts:38 explicitly notes "tool layer is responsible" — `callGateAction` does not filter audience.
- **Impact:** Cross-workspace data bleed. An "on_duty" audience may include clocked-in employees from OTHER tenants. Compliance + GDPR risk. Same class as ADR-0151 forgeable-IDs / L-0177 silent fallback.
- **Severity:** HIGH (multi-tenancy)
- **Fix:** Add `.eq("workspace_id", workspaceId)` filter on both call-sites; join through `profile` if needed.

### BUG-SIM-12 — `cancelInvitation` emits with `workspace_id: null` (telemetry contract violation, ADR-0134) 🟡 MEDIUM ✅ FIXED

- **Where:** `apps/web/src/app/dashboard/people/_actions/people-actions.ts:311-319`
- **Evidence:** A1 / BUG-A1-5 — `workspace_id: null` is explicit (line 313). `resendInvitation` in same file correctly resolves from row (`:493`). Violates CLAUDE.md mandate "every mutation emits non-null, non-empty workspace_id."
- **Impact:** `activity_trail` engine_event routing drops the event or routes to wrong workspace. Admin audit trail for cancelled invites is silent.
- **Severity:** MEDIUM
- **Fix:** Fetch `workspace_id` from the invitation row before emitting (mirror `resendInvitation` pattern).
- **Fixed in:** feat/sim-fast-wins-batch-1 (see commit for BUG-SIM-12)

### BUG-SIM-13 — `publish-announcement` emit timestamp set AFTER emit → engine_state poll can miss spawn (race) 🟡 MEDIUM ✅ FIXED

- **Where:** `packages/ai/src/capabilities/helpdesk_query/tools.ts:186-205`
- **Evidence:** A4 / BUG-A4-09 — `emitTimestamp = new Date().toISOString()` set after `emit()`. Polling uses `.gte("started_at", emitTimestamp)` — if dispatcher completed synchronously before the `new Date()` call, the just-spawned row is missed.
- **Impact:** Tool returns `{ ticket_id: null, note: "Ticket is opening" }` even on success. Manager may double-click → second `engine_state` spawned → double-ticket for one sick-call.
- **Severity:** MEDIUM
- **Fix:** Set `emitTimestamp = new Date(Date.now() - 50).toISOString()` BEFORE the emit call.
- **Fixed in:** feat/sim-fast-wins-batch-1 (see commit for BUG-SIM-13)

### BUG-SIM-14 — `run-deviation-checks` never populates `punchOutMissingShiftIds` → W08 never fires 🟠 HIGH

- **Where:** `apps/web/src/app/api/payroll/run-deviation-checks/route.ts:280-285`
- **Evidence:** A5 / BUG-A5-06 — `DeviationChecksInput.punchOutMissingShiftIds` defaults to empty Set; route never derives the set from interpreted shifts where `actual_end` was substituted from scheduled end.
- **Impact:** W08 ("Punch-out missing") never fires. Erik sees clean hours but no visibility into which shifts had punch-out auto-filled. Compounds with Friday POS-down scenario.
- **Severity:** HIGH (compliance silence)
- **Fix:** Build `punchOutMissingShiftIds` from `payroll.calculation` rows where `actual_end IS NULL` before passing to `DeviationChecks`.

### BUG-SIM-15 — `run-deviation-checks` never populates `preApprovedShiftIds` → W09 false-positive blocks every OT shift 🟠 HIGH

- **Where:** `apps/web/src/app/api/payroll/run-deviation-checks/route.ts:280-285`
- **Evidence:** A5 / GAP-A5-02 — `preApprovedShiftIds` is optional, defaults to empty Set; with `overtime_requires_pre_approval=true`, EVERY OT shift fires W09. Erik faces ~72 manual acks/period for a 18-staff bistro.
- **Impact:** W09 becomes noise instead of signal. Forces operator to ack every OT shift as "verbally approved" — defeats the gate's purpose. Practical blocker.
- **Severity:** HIGH (operational dead-end)
- **Fix:** Either (a) build `ot_preapproval` table + UI flow at schedule-publish, OR (b) downgrade W09 to `info` and document as advisory-only until (a) lands.

### BUG-SIM-16 — `useLockPeriod` mutation has no `emit()` in `onSuccess` (ADR-0193 violation) 🟡 MEDIUM

- **Where:** `apps/web/src/app/dashboard/payroll/[periodId]/_hooks/use-lock-period.ts:48-58`
- **Evidence:** A5 / GAP-A5-09 — CLAUDE.md mandates "never create a TanStack Query mutation without an `emit()` call in `onSuccess`." BFF route emits server-side; client mutation hook does not.
- **Impact:** UI-level event missing for analytics + PostHog funnel. ADR-audit will flag this. Server emit covers audit, but the client-side instrumentation invariant is broken.
- **Severity:** MEDIUM (governance debt)
- **Fix:** Add `emit({ event: "payroll period locked client", ... })` in `onSuccess`.

### BUG-SIM-17 — `audience-resolver` `on_duty` semantically equates "clocked in" with "on shift" 🟠 HIGH

- **Where:** Same files as BUG-SIM-11 (resolver + hook)
- **Evidence:** A4 / BUG-A4-01 — at 15:00 before a 16:00 shift, `punch_out IS NULL` returns 0 rows. "Send to people on tonight's shift" is the natural manager intent; resolver targets only those physically punched in. There is no `on_shift` audience kind that consults `schedule_shift`.
- **Impact:** Wrong default behavior for pre-shift announcements (the single most common comms use case in hospitality). Maria + crew never receive the summer-menu announcement until they clock in.
- **Severity:** HIGH (UX semantic mismatch + functional miss)
- **Fix:** Add `on_shift` audience kind that queries `schedule_shift` for a configurable window; keep `on_duty` as currently-clocked-in subset. Update audience picker UI + `AudienceKind` union + tool schema.

### BUG-SIM-18 — `ad-hoc-invoice-drawer` has no `period_from <= period_to` validation 🟡 MEDIUM

- **Where:** `apps/web/src/app/platform-admin/billing/invoices/_components/ad-hoc-invoice-drawer.tsx:120-130`
- **Evidence:** A5 / GAP-A5-08 — `canSubmit` checks description/quantity/unit_price/vat_rate; never compares `periodFrom`/`periodTo`. Pontus can create an invoice with reversed period.
- **Impact:** Regnskapsloven §7-2 — material error on issued invoice. Draft passes immutability trigger; once issued, the swap stays in DB.
- **Severity:** MEDIUM (legal compliance)
- **Fix:** Add `periodFrom <= periodTo` predicate to `canSubmit`; mirror in `CreateAdHocInvoiceInputSchema` (Zod refine).

### BUG-SIM-19 — `AfterShiftView` + `DuringShiftViewV2` hardcode 220 kr/h fallback instead of contract rate 🟡 MEDIUM

- **Where:** `apps/mobile/src/components/home/AfterShiftView.tsx:51,128`; `apps/mobile/src/components/home/DuringShiftView.v2.tsx:62,160`
- **Evidence:** A3 / NEW-GAP-D — `HOURLY_RATE_FALLBACK = 220` used unconditionally. No query to `employee_payroll_profile.hourly_rate` or `tariff_rate_table`.
- **Impact:** Maria's Friday-night estimate misses kveldstillegg (~30-45 kr/h) → ~344 kr gap on 8h shift. Mis-sets expectations before payroll close. Erodes trust at first paycheck.
- **Severity:** MEDIUM (trust + accuracy)
- **Fix:** Fetch `employee_payroll_profile.hourly_rate` (or tariff floor via D3 resolution). Add "Estimat" disclaimer regardless.

### BUG-SIM-20 — `cash_count_variance` from Step03 never auto-creates `deviation` row 🟡 MEDIUM

- **Where:** `Step03Kontanttelling.tsx:58-63` (computes variance) + `Step04Avvik.tsx` (receives pre-fetched list, does not infer)
- **Evidence:** A3 / NEW-GAP-E — wizard transition computes variance but no trigger reads `financial_close_config.tolerance_value` to spawn a deviation. `AdminOverrideSheet.tsx:25` lists `no_cash_count` and `open_deviation` as distinct blocker codes — system distinguishes states but doesn't auto-link.
- **Impact:** Friday 340 kr cash discrepancy passes silently. Manager sign-off step (spec'd) never fires because no deviation exists.
- **Severity:** MEDIUM (compliance silence)
- **Fix:** On Step03→Step04 transition, if `|variance| > tolerance_value`, auto-create `deviation` row (domain=`material`, severity by magnitude) via existing `report_deviation` capability.

### BUG-SIM-21 — `WelcomeWizardGate` mounts employee wizard for ALL roles (manager invite hits personal-info flow) 🟠 HIGH

- **Where:** `apps/web/src/app/dashboard/layout.tsx:177-185` + `_components/WelcomeWizardGate.tsx:21-23`
- **Evidence:** A1 / BUG-A1-2 — `showWelcomeWizard = profile.is_welcome_complete === false` with NO role discriminator. `WelcomeWizard` has no role prop. The 8-step wizard is employee-shaped.
- **Impact:** Erik (manager) invited Monday → completes employee wizard, not the workspace setup wizard at `/dashboard/setup/`. Workspace gates (departments, hours, seasons) remain open. Bella Vista cannot schedule shifts on Tuesday.
- **Severity:** HIGH (blocks every new manager invite)
- **Fix:** Branch by role in `layout.tsx`: `employee`/`trainee` → existing wizard; `manager`/`admin`/`owner` → redirect to `/dashboard/setup` if setup-guide not complete.

### BUG-SIM-22 — `platform_metrics_daily` queried but no migration creates it → MRR chart silently empty 🟡 MEDIUM

- **Where:** `apps/web/src/app/platform-admin/billing/page.tsx:24-28`
- **Evidence:** A5 / GAP-A5-07 — exhaustive grep of `supabase/migrations/` returns no migration creating this table or matview. Query returns null on failure; chart renders flat-zero with no error state.
- **Impact:** Pontus's first billing view is a broken chart. Looks like the product has no revenue.
- **Severity:** MEDIUM
- **Fix:** Either create the matview migration (preferred) or add an error boundary + empty-state with explicit message.

### BUG-SIM-23 — `tip_pool.UNIQUE (department_session_id)` semantically scoped wrong for event ops 🟠 HIGH

- **Where:** `supabase/migrations/20260428220003_tips_pool_table.sql:25`
- **Evidence:** A6 / HOTEL-4, A7 / GAP-3, A8 / GAP-A8-01, A10 / GAP-A10-12, A11 / GAP-A11-05 — five independent agents flag this. UNIQUE on `department_session_id` blocks any cross-department / event-level tip aggregation.
- **Impact:** Wedding 50/30/20 split = three separate pools with manual sum; festival cross-dept tip share = impossible to enforce by collective agreement. NHO Reiseliv tip-distribution norms cannot be system-enforced.
- **Severity:** HIGH (commercial layer + compliance)
- **Fix:** Add `event_tip_pool` parent entity with `department_allocations` (percentage weights per dept), drop the UNIQUE in favor of `(event_pool_id, department_session_id)` UNIQUE. See GAP-SIM-cross-1 for the event-entity counterpart.

### BUG-SIM-24 — `planning_event.end_date` exists but cascade-engine reads only `event_date` for day_factor 🟡 MEDIUM

- **Where:** `supabase/migrations/20260421100200_cascade_a1_domain_tables.sql:145` (`end_date DATE`); cascade engine never expands the range
- **Evidence:** A8 / BUG-A8-03 — exhaustive grep confirms no `end_date` reference outside the migration file. Multi-day events (e.g. Marit+Espen wedding `event_date=2026-06-13, end_date=2026-06-15`) get demand uplift only on day 1.
- **Impact:** D4 demand signal under-counts staffing need for day 2+ of multi-day events. Cascade scheduler under-staffs hotel days 2-3.
- **Severity:** MEDIUM
- **Fix:** Cascade scheduling engine must expand multi-day events to the full date range when computing day_factor.

### BUG-SIM-25 — `approve_tip_pool` raises `workspace_mismatch` for inactive actors (misleading error class) 🟢 LOW

- **Where:** `supabase/migrations/20260429010000_approve_tip_pool_rpc.sql:66-75`
- **Evidence:** A8 / BUG-A8-01 — `NOT FOUND` on the workspace check fires when actor's profile row is `is_active = false`, not on actual workspace mismatch. Error message misleads operator.
- **Impact:** Operator sees "workspace_mismatch" when the real issue is inactive actor. Low frequency, but high diagnostic friction.
- **Severity:** LOW
- **Fix:** Add explicit `actor_is_inactive` guard before workspace check; raise `'inactive_actor'` distinctly.

### BUG-SIM-26 — `department_session.UNIQUE (workspace_id, department_id, session_date)` blocks dual-service days 🟠 HIGH

- **Where:** `supabase/migrations/20260304200000_department_session.sql:50-52`
- **Evidence:** A6 / HOTEL-2, A7 / GAP-2 — at Grand Hotel Sjølyst Saturday, kitchen runs BOTH breakfast service AND wedding dinner — should be two distinct sessions on the same date for the same department. UNIQUE blocks it.
- **Impact:** Hotels / venues with multiple distinct services per day per department cannot model them as separate sessions. Forces shoehorning into one long session, breaking tip pool boundaries + reconciliation correctness.
- **Severity:** HIGH (hotel vertical)
- **Fix:** Drop UNIQUE in favor of `(workspace_id, department_id, session_date, service_window)` where `service_window` is a discriminator (`breakfast` | `dinner` | `event` | etc.) OR introduce `event_session` as a sibling to `department_session`.

### BUG-SIM-27 — Schedule temporal lock function uses `v_local_now::date` → traps 02:00–02:30 post-midnight checkouts 🟠 HIGH

- **Where:** `supabase/migrations/20260428130000_schedule_shift_temporal_lock.sql:43`
- **Evidence:** A7 / GAP-4 — `RETURN p_shift_date < v_local_now::date OR v_shift_start_local <= v_local_now;` — date rolls at midnight Oslo. Any shift with `shift_date = N` that runs past midnight cannot be approved at 02:30 (now date N+1).
- **Impact:** Hotel events routinely run to 02:00-03:00. Banquet captain cannot approve hours for a wedding-dinner shift at 02:20. Also affects bistros with late-night Fridays/Saturdays. The DB trigger fires regardless of C4 authority.
- **Severity:** HIGH (operational dead-end for any late-night op)
- **Fix:** Use shift-end-anchored grace window (`shift_date < (v_local_now - INTERVAL '4 hours')::date`) or add an explicit `lock_after` column on shifts so the DB trigger respects business hours.

### BUG-SIM-28 — `getFirstProfile` workspace embed FK-ambiguity (recurring pattern; covered by L-2026-05-22 patch) 🟢 LOW

- **Where:** Pattern-class — re-flagged here for ongoing watch
- **Evidence:** MEMORY.md L-PGRST201 (2026-05-22) — pinned `workspace!fk_profile_workspace`. Future FK additions between already-related tables will re-trigger.
- **Impact:** Latent until next FK lands between profile/workspace.
- **Severity:** LOW (documented; vigilance required)
- **Fix:** Add eslint/grep guard: any `from('profile').select` with workspace embed must use named-FK syntax.

---

## HARNESS bugs

> No NEW harness bugs surfaced — the sim was code-trace-based, not Playwright-run. Baseline HARNESS-1 / HARNESS-2 / HARNESS-3 stand.

---

## ENV gaps

> No NEW env gaps surfaced — agents traced code paths, not live runs. Baseline ENV-1 through ENV-4 stand.

---

## OPS cliff

> No new systemic OPS findings beyond baseline OPS-1 (WSL2 OOM). Sim agents traced code, did not run dev.

---

## Confirms existing 22-baseline bugs

The sim re-encountered (and provided NEW evidence for the ROOT CAUSE of) the following baseline bugs:

| Baseline | New root-cause evidence |
|---|---|
| **BUG-1** (`engine_authority_config` missing for `communication`) | A1 / BUG-A1-3 confirms missing capability in `bootstrap-cascade/index.ts:1007-1021` seed list. A4 / BUG-A4-02 surfaces the structural reason: `'communication'` is NOT in `capability_default_registry`, so the workspace-create trigger has nothing to seed. Migration `20260601100000` was retro-only; "separate sortie" for the registry never shipped. **The 15-min fix Pontus already has is incomplete — without the registry row, every new workspace re-creates the problem.** |
| **BUG-12** (`employment_contract.employment_form` NOT NULL seed gap) | A1 / BUG-A1-4 + BUG-SIM-01 — Zod validates in `route.ts:53`, but seed helpers + DocuSeal templates + the Tripletex NULL pattern all bypass the validation. Error message at `route.ts:443` is generic ("Kunne ikke opprette kontrakt") — swallows the real constraint error. |
| **BUG-15** (Orb suppression broken — ADR-0238) | A4 / BUG-A4-11 — `/dashboard/komm/desks` does not declare `<DomainChatOwnership>`. `HelpDesk.tsx` Dialog has no ownership declaration. Re-flags the L-0178 pattern outside the surfaces previously caught. |
| **BUG-18** (Day-line 8 skip + 2 fail) | A2 / GAP-A2-5 confirms missing shift deep-link as a related continuation. |
| **BUG-19** (Cascade UI 8/18 fail) | A2 / BUG-A2-1 + A1 / GAP-A1-1 — the publish-validation gate that exists is bypassable, AND the new-workspace form does not surface niche/tariff. Both compound. |
| **BUG-20** (Helpdesk SLA 0/4 PASS) | A4 / BUG-A4-08 + BUG-SIM-05 — deepest root cause is `HelpDesk.tsx` writing to deprecated table. Even fixing BUG-1 won't fix BUG-20 until the UI rewires to `open_ticket` capability. |
| **BUG-22** (Journey-shift 6/16 fail) | A3 / NEW-BUG-A — GPS guard built but not invoked → shift-clock spec breaks. Likely overlap with the 6 failing tests. |
| **OPS-1** (WSL2 OOM cliff) | Re-flagged 3 times via MEMORY.md L-0316 family; documented but not re-listed. |

---

## Fast-wins table (cost × unblocks, top 15)

| # | Bug | Cost | Unblocks |
|---|---|---|---|
| 1 | BUG-SIM-08 + BUG-SIM-09 (schedule tool PK column) | 10 min | All Botsson schedule queries (`get_shift_detail`, `get_shift_colleagues`) |
| 2 | BUG-SIM-13 (emit timestamp before emit) | 5 min | Eliminates helpdesk double-ticket race |
| 3 | BUG-SIM-12 (cancelInvitation workspace_id) | 15 min | Restores audit trail for invite cancellations |
| 4 | BUG-SIM-11 (audience-resolver workspace_id filter) | 30 min | Closes multi-tenant data bleed (GDPR + ADR-0151 class) |
| 5 | BUG-SIM-04 (channel `is_active` consumer drift) | 30 min | Aligns channel guards before migration applies |
| 6 | BUG-SIM-07 (absence-popover date) | 30 min | Fixes off-by-one for any post-22:00 Oslo absence |
| 7 | BUG-SIM-21 (manager onboarding routing) | 1 h | Unblocks every new manager invite path |
| 8 | BUG-SIM-06 (BatchActionBar bypass) | 1 h | Restores cascade validation on batch publish |
| 9 | BUG-SIM-17 (`on_shift` audience kind) | 2 h | Correct pre-shift comms targeting |
| 10 | BUG-SIM-14 + BUG-SIM-15 (deviation-checks set population) | 2 h | W08 fires; W09 stops blocking |
| 11 | BUG-SIM-10 (GPS guard wiring) | 2-3 h | Honest GPS telemetry + real enforcement |
| 12 | BUG-SIM-05 (HelpDesk → open_ticket) | 2-3 h | Entire helpdesk SLA surface (closes baseline BUG-20) |
| 13 | BUG-SIM-20 (cash variance auto-deviation) | 2 h | Manager sign-off flow for cash discrepancies |
| 14 | BUG-SIM-19 (hardcoded 220 kr/h fallback) | 1 h | Accurate post-shift earnings everywhere |
| 15 | BUG-SIM-01 (`employment_form` NOT NULL + volunteer) | 3-4 h | Unblocks volunteer onboarding + festival vertical |

**Total fast-wins time: ~22 hours → closes one baseline CRITICAL (BUG-20), eliminates 2 multi-tenant data risks, restores compliance gates W08/W09, fixes pre-shift comms targeting, unblocks every manager invite.**

---

## Evidence

All finding files: `docs/test-runs/2026-05-25-restaurant-week-sim/findings/agent-{1..11}-*.md`
Plans: `INDEX.md`, `SIMULATION-PLAN.md`, `HOTEL-WEDDING-PLAN.md`, `CONCERT-FESTIVAL-PLAN.md`
Baseline: `docs/test-runs/2026-05-23-journey-sweep/BUGS.md`
