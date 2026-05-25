---
title: "A1 — Monday: Owner Setup + Maria Onboarding (Bella Vista)"
created: 2026-05-25
agent: A1
slice: Mon-owner-setup
status: complete
tags: [simulation, findings, monday, owner-setup, onboarding, bugs, gaps]
---

# A1 — Monday: Owner Setup + Maria Onboarding (Bella Vista)

Simulated journey: platform-admin workspace creation → invite manager Erik → Erik onboards → Erik invites Maria → Maria onboards (contract, payroll profile, first shift) → Maria runs Botsson trainee bootcamp → Maria completes knowledge_test.

All findings are code-traced. File:line cited for every claim. No fabrication.

---

## Summary

The I1 bootstrap-cascade (12-step EF) seeds D1–D3 + K1a/K1b correctly for a hospitality workspace, but leaves three gates permanently "blocked" after creation: `tariff_binding_decided` is never closable because `payroll.workspace_settings` is never seeded by bootstrap-cascade, and the `communication` capability is absent from `engine_authority_config` (BUG-1 confirmed). The new-workspace form in platform-admin lacks niche (Bistro) and explicit tariff selector inputs, forcing the owner to navigate separately into the setup wizard to pick them — a flow that is only partially built (the Botsson-driven coordinator is aspirational, not shipped). Maria's onboarding wizard is solid (8 steps, mobile-parity, cross-device resume), but the `employment_form NOT NULL` constraint on `employment_contract` remains unseeded (BUG-12 confirmed), and the first-shift seed step is fully absent from the wizard — leaving Maria schedule-invisible on Day 1. The `is_tariff_bound` flag that controls whether Maria sees the tariff clause in ConsentStep silently defaults to `false` on all new workspaces because `payroll.workspace_settings` row is never created at bootstrap.

---

## NEW Bugs (code-level defects)

### BUG-A1-1 — `payroll.workspace_settings` never seeded by bootstrap-cascade

**Where:** `supabase/functions/bootstrap-cascade/index.ts` — 12-step list does NOT include payroll schema `workspace_settings` insert.

**Evidence:**
- `bootstrap-cascade/index.ts`: searching for `workspace_settings` returns only line 203 (gate description string) — zero INSERT/UPSERT calls.
- `supabase/migrations/20260422110100_payroll_config_tables.sql:17-30`: `public.payroll_workspace_settings` table exists with 1:1 workspace constraint. No trigger auto-creates rows on workspace INSERT.
- `supabase/migrations/20260618100000_workspace_union_binding_and_tariff_floor.sql:353-387`: `sync_workspace_settings_union_cache()` trigger fires on `workspace_union_binding` INSERT — NOT on workspace creation. A brand-new workspace with no union binding will never have a `payroll.workspace_settings` row until an admin explicitly creates a union binding.
- `apps/web/src/app/dashboard/layout.tsx:193-199`: `tariffBound` reads from `payroll.workspace_settings.is_tariff_bound` — returns `null` → `false` when row is absent. Maria's ConsentStep silently omits the tariff clause.
- Bootstrap gate `tariff_binding_decided` (`bootstrap-cascade/index.ts:1185`) is hardcoded `false` (never auto-closed), and no code path closes it unless the admin explicitly calls `fn_close_bootstrap_gate`.

**Impact:** Every new hospitality workspace starts with `tariffBound=false`, meaning Maria's ConsentStep skips the Riksavtalen tariff-agreement clause (legally required per Riksavtalen bindingsbeslutning). The `tariff_binding_decided` bootstrap gate stays permanently open. Owner has no clear UI path to close it.

**Severity:** HIGH

**Fix sketch:**
1. Add Step 9.5 to bootstrap-cascade: `INSERT INTO payroll.workspace_settings (workspace_id, is_tariff_bound, ...) VALUES ($workspaceId, false, ...) ON CONFLICT (workspace_id) DO NOTHING`
2. Auto-close gate `tariff_binding_decided` only after the admin explicitly calls the payroll settings flow.
3. Alternatively: add trigger `trg_init_payroll_workspace_settings` on `workspace.INSERT` (service-role SECURITY DEFINER).

---

### BUG-A1-2 — Manager (Erik) gets employee 8-step wizard instead of workspace setup wizard

**Where:** `apps/web/src/app/dashboard/layout.tsx:177-185` + `apps/web/src/app/dashboard/_components/WelcomeWizardGate.tsx`

**Evidence:**
- `layout.tsx:184-185`: `showWelcomeWizard` is set to `true` whenever `profile.is_welcome_complete === false`, regardless of `profileRole`.
- `WelcomeWizardGate.tsx:21-23`: passes props to `WelcomeWizard` — no `role` prop.
- `apps/web/src/components/welcome-wizard/WelcomeWizard.tsx`: no role discriminator present (confirmed by grep returning zero hits on "role\|manager\|admin").
- The 8-step wizard (`TOTAL_STEPS=8`, steps: Hero/Contact/Address/PersonalNumber/Availability/Consent/Optional/Done) is designed for a new employee completing personal info — not a manager who should be directed to `apps/web/src/app/dashboard/setup/` (the 9-step workspace setup wizard, `docs/domains/bootstrap/USER-FLOWS.md:42-54`).
- A fresh manager invite (role=`manager`) will hit `is_welcome_complete=false` → employee personal-info wizard launches → manager enters their personal_number, availability, and GDPR consent, but never configures departments, tariff, or season.

**Impact:** Erik (manager) completes the employee onboarding wizard instead of workspace setup. Workspace critical gates (departments, operating hours, seasons) remain unclosed. Bella Vista cannot schedule any shifts.

**Severity:** HIGH

**Fix sketch:** In `layout.tsx`, branch `showWelcomeWizard` by role: `employee/trainee` → existing wizard; `manager/admin/owner` → redirect to `/dashboard/setup` if `workspace.setup_guide_completed === false`. The `WelcomeWizardGate` should only mount for `employee`/`trainee` roles.

---

### BUG-A1-3 — `communication` capability absent from `engine_authority_config` bootstrap seed (confirms BUG-1)

**Where:** `supabase/functions/bootstrap-cascade/index.ts:1007-1021`

**Evidence:**
```
capabilities = [
  "schedule_management", "shift_assignment", "absence_management",
  "employee_onboarding", "compliance_check", "report_generation",
  "notification_dispatch", "deviation_handling", "session_management",
  "list_bootstrap_gates", "close_bootstrap_gate", "skip_bootstrap_gate",
];
```
`"communication"` is not in the list. This is confirmed code evidence for BUG-1 (`engine_authority_config missing for capability=communication`). See BUGS.md BUG-1. Reporting here because the Monday slice exercises the `publish_announcement` capability for the first time (Erik publishes a "welcome to the team" announcement to Maria).

**Impact:** Erik cannot publish any announcements. `publish_announcement` throws `engine_authority_config missing for capability=communication` on the first attempt.

**Severity:** CRITICAL (confirmed same as BUG-1)

**Fix sketch:** Add `"communication"` to the capabilities list at `bootstrap-cascade/index.ts:1008`. Matches the fix described in BUGS.md BUG-1.

---

### BUG-A1-4 — `employment_contract.employment_form` NOT NULL but contract upsert route defaults to `'fast'` for category, not `employment_form`

**Where:** `apps/web/src/app/api/contracts/employment/upsert/route.ts:427-437`

**Evidence:**
- `route.ts:427-437`: On INSERT branch, the payload defaults `employment_category: "fast"` (line 432) but `employment_form` is expected from the request body — it is a required Zod field (`employment_form: z.enum([...])` at line 53).
- `BUGS.md BUG-12`: `employment_contract.employment_form NOT NULL` constraint fails seed helpers in E2E tests. This confirms the DB column exists and is NOT NULL.
- The upsert route itself validates `employment_form` via Zod (line 53) — so the API path is correct IF the form sends the field.
- Gap: the admin setup wizard step `Employment` (`apps/web/src/app/dashboard/setup/_adapters/`) must populate `employment_form` for the owner's first contract. If the wizard step omits it, the DB write fails with NOT NULL violation — but the API returns 500 with `"Kunne ikke opprette kontrakt"` (line 443-446), swallowing the constraint error detail from the client.

**Impact:** If Maria's contract is created without `employment_form` (e.g. via a UI form that doesn't expose the field), she cannot complete her onboarding. The 500 response doesn't tell the admin which field is missing.

**Severity:** MEDIUM (partially mitigated by Zod in the API route; risk is in forms that call the old contract seed path confirmed broken in BUG-12)

**Fix sketch:** (a) See BUG-12 fix in BUGS.md for seed helpers. (b) Improve error message in `route.ts:443` to surface `insertError.message` not just generic string. (c) Audit all UI forms that create `employment_contract` to verify `employment_form` is captured.

---

### BUG-A1-5 — `cancelInvitation` emits telemetry with `workspace_id: null`

**Where:** `apps/web/src/app/dashboard/people/_actions/people-actions.ts:311-319`

**Evidence:**
```typescript
void emit({
  event: "invitation cancelled",
  workspace_id: null,          // ← line 313: explicitly null
  actor_id: nonEmpty(await resolveActorId(supabase), "actor_id"),
  ...
});
```
`workspace_id: null` violates the telemetry contract established in CLAUDE.md ("Every mutation emits … `workspace_id` (non-null, non-empty)") and will corrupt `activity_trail` routing. The `invitation` table has a `workspace_id` column — it should be resolved from the invitation row before emitting. The `resendInvitation` function in the same file correctly resolves `workspace_id` from the invitation row before emitting `invitation resent` (line 493).

**Impact:** All invitation-cancelled events emit with `null` workspace_id → `activity_trail` engine_event routing drops the event or logs it to wrong workspace. Admin audit trail for cancelled invites is silent.

**Severity:** MEDIUM

**Fix sketch:**
```typescript
// In cancelInvitation: fetch workspace_id from invitation row before emit
const { data: inv } = await supabase
  .from("invitation")
  .select("workspace_id")
  .eq("invitation_id", invitationId)
  .maybeSingle();
// then: workspace_id: nonEmpty(inv?.workspace_id ?? "", "workspace_id")
```

---

## NEW Gaps (feature/UX/journey holes)

### GAP-A1-1 — New workspace form has no niche/Bistro selector

**What's missing:** `apps/web/src/app/platform-admin/workspaces/new/page.tsx` (full file reviewed, lines 75-1295) has a `company_industry` selector (restaurant/hotel/cafe/bar/catering/other) but NO `niche` field (Bistro, Fine Dining, Fast Food, etc.). The simulation requires `industry=Restaurant, niche=Bistro`. The `NACE_TO_INDUSTRY` map (line 76-83) maps NACE codes only to top-level industry strings, never to niche sub-types.

**Why a real hospitality op needs it:** In Norway, "Restaurant" covers everything from fast food (Narvesen) to Michelin restaurants (Maaemo). The niche determines default governance protocols (Bistro needs wine-service protocols; Fast Food does not), shift templates, and D5 niche parameters. Without niche, the bootstrap seeds generic hospitality defaults — Bella Vista gets the same shift templates as a burger chain.

**Severity:** MEDIUM

**Suggested fix scope:** Add `niche` dropdown to the new-workspace form (Bistro, Fine Dining, Kafe, Bar, Fast Food, Pub, Catering, Hotel-Restaurant). Pass to `/api/platform-admin/workspaces` POST handler → store on `workspace.intelligence_data.niche` or a dedicated `workspace.niche` column. Bootstrap-cascade Step 7 (`season_budget enrichment`) already reads `workspace.intelligence_data` for revenue hints — niche can be read at Step 2 to offset DEPARTMENT_TYPE_MAP + shift template selection.

---

### GAP-A1-2 — First-shift assignment not part of employee onboarding wizard

**What's missing:** The simulation step 5 expects "First-shift assignment seed (schedule_shift, status=draft)" as part of Maria's onboarding. The wizard has 8 steps (Hero, Contact, Address, PersonalNumber, Availability, Consent, Optional, Done — `docs/domains/onboarding-wizard/USER-FLOWS.md:28-36`). Zero of these steps create a `schedule_shift` row. The `Optional` step (step 7) is user-defined but currently skippable without creating any schedule artifact. A `schedule_shift` seed requires an active `department_session` for the target date — which also doesn't exist yet (BUG-18 confirms `department_session` seed is missing for tests).

**Why a real hospitality op needs it:** On Day 1, every new hire in Norway needs their first scheduled shift to exist before their first workday — it drives the employment contract start date alignment (Aml. §14-6), and it's the first record Botsson uses to generate the pre-shift checklist. In a busy Oslo bistro, Erik should be able to add Maria to that Friday dinner service during her onboarding flow, not as a separate manual scheduling step later.

**Severity:** HIGH (journey continuity gap — Maria cannot clock in without a scheduled shift)

**Suggested fix scope:** Add a "Første vakt" Optional step to the wizard (or make it a post-completion CTA). The step calls `POST /api/schedules/shifts` with `status=draft`, auto-assigns to the first available `department_session`. This is a UI/UX feature, not a backend gap — the schedule capability exists.

---

### GAP-A1-3 — No Botsson trainee bootcamp auto-assignment after wizard completion

**What's missing:** Simulation step 6: "Maria runs Botsson trainee bootcamp — first 3 protocols (welcome, safety, allergens)." The `auto_assign_protocols_to_new_employee` trigger (`supabase/migrations/20260429000000_fix_auto_assign_regression_v2.sql:27`) fires on `profile INSERT` — so protocols are assigned when the profile row is created, not when the wizard completes. However, `profession_training` rows are only seeded at bootstrap (Step 11), and the auto-assign trigger matches on `profession.slug` → `protocol.name`. If Maria's profile is created with role=`employee` but no profession slug, the trigger produces zero assignments.

**Why it matters:** The hospitality package defines `roleCapabilityProfiles` with `positionSlugs` (e.g. "Servitør") — but the new-hire invite form captures `role` (employee/manager/admin) NOT `positionSlug`. Without a position slug on the profile, `fn_seed_profession_training`'s join fails and Maria gets zero protocol auto-assignments. A real bistro expects a new server to start Allergenhandtering and Handhygiene on Day 1 without a manager manually assigning them.

**Severity:** HIGH

**Suggested fix scope:** (a) The invite form / wizard should capture `position_slug` (Servitør, Kokk, Bartender, etc.). (b) Add position assignment step to the onboarding wizard, or re-fire the auto-assign trigger after wizard completion with the resolved profession. (c) Alternatively: after wizard completion, call an RPC `fn_auto_assign_protocols_by_role(profile_id, position_slug)` from the `completeWelcome` Server Action.

---

### GAP-A1-4 — Bootstrap has no day-1 guided UX for tariff binding decision

**What's missing:** `docs/domains/bootstrap/USER-FLOWS.md:60-76` ("Aspirational" flow 3 — "Day-1 Critical Gate Closure — Botsson-Driven"). The `tariff_binding_decided` gate is seeded as `open` (never auto-closed). There is no UI to guide the owner through the binding decision (`docs/domains/bootstrap/GAPS-AND-DEBT.md:G2-G4`). The `workspace_bootstrap_gate` table exists (ADR-0407 Phase 1), 3 RPCs exist (`fn_list_open_bootstrap_gates`, `fn_close_bootstrap_gate`, `fn_skip_bootstrap_gate`), but there is no `/dashboard/bootstrap` page, no gate checklist widget on the dashboard, and no Botsson coordinator that surfaces open gates at session start.

**Why a real hospitality op needs it:** In Norway, the Riksavtalen tariff binding is a legal decision (§ in NHO Reiseliv collective agreement). An owner who doesn't know they need to make this decision won't — meaning every employee hired under an unbound workspace potentially has wrong supplement calculations from day 1. Bella Vista's owner (Pontus) needs a prompt saying "Have you decided whether to be bound by Riksavtalen? This affects how supplements are calculated."

**Severity:** HIGH (legally material for Riksavtalen workspaces)

**Suggested fix scope:** Phase 2 per GAPS-AND-DEBT (bootstrap-coordinator). Minimum viable: add a dashboard widget that queries `fn_list_open_bootstrap_gates` and shows the top 3 required open gates as action cards. No Botsson coordinator needed for the widget — just an RPC call + UI.

---

### GAP-A1-5 — Invitation link leads to dead-end for mobile-only new hires

**What's missing:** The invite flow creates a link `https://app.smartout.ai/invite/[token]`. When Maria (a restaurant worker with no laptop) opens this on her iPhone, the web invite page resolves correctly (`apps/web/src/app/invite/[token]/page.tsx`) and shows a CTA to sign up. There is also a mobile path at `apps/web/src/app/m/invite/[token]/page.tsx`. However, neither invite page offers a "Download the Smartout app" CTA or deep-link to the App Store / Play Store. A first-time invitee on mobile is steered into the web signup flow, and will complete the employee wizard on web — which is functional but not the intended mobile-native experience per ADR-0133.

**Why a real hospitality op needs it:** A new server at Bella Vista doesn't have a Smartout account yet. They tap the link on their phone. The web signup is functional but confusing (no branding, no "get the app" prompt). In reality, hospitality onboarding happens on the floor, on a phone, 5 minutes before service — friction here = high abandonment.

**Severity:** MEDIUM

**Suggested fix scope:** Add an `<AppBadge>` component to the invite page that renders App Store / Play Store links when `navigator.userAgent` matches mobile. This is a 30-minute frontend add.

---

## References to existing BUGS.md

The following existing bugs from BUGS.md were encountered and confirmed during this slice:

- **BUG-1** — `engine_authority_config missing for capability=communication`: confirmed as BUG-A1-3 above. The communication capability is absent from the bootstrap-cascade authority_config seed list at `bootstrap-cascade/index.ts:1007-1021`.
- **BUG-12** — `employment_contract.employment_form NOT NULL but seed helper doesn't set it`: confirmed that `employment_form` IS required by `route.ts:53` Zod schema, and the DB constraint is NOT NULL. The upsert route is safe (Zod validates), but direct seed paths and legacy helpers remain broken.
- **BUG-19** — Cascade UI: 8/18 fail: partially relevant — the new workspace form does not surface tariff/niche parameters in the I1 flow, which could cause the 8 failing cascade UI tests to be related to missing seed data.

---

## Industry-intel commentary

**What Smartout gets RIGHT:** The hospitality domain model is deeply thoughtful. The `HOSPITALITY_TARIFF_RATES` constants (`hospitality.ts:83-109`) correctly capture Riksavtalen 2025-mellomoppgjør with all 8 supplements including the `riks-delt` (delt dagsverk) allowance — something almost all Norwegian SaaS WFM tools ignore. The 5 `roleCapabilityProfiles` (skiftleder, servitør, kokk, bartender, renhold) map exactly to how a real Oslo bistro is structured, and the protocol slug references (`Allergenhandtering-protokoll`, `Temperaturkontroll-protokoll`) align with Mattilsynet's IK-mat standard. That's real hospitality domain knowledge, not a generic HR template.

**What feels off vs real Oslo bistros:** The bootstrapper's default hospitality hours (`11:00-23:00` Mon-Sat) are generic — a trendy Oslo bistro often opens at 16:00 for dinner-only, or does weekend brunch from 10:00. The shift templates (`Morgenvakt 07:00-15:00, Kveldsvakt 15:00-23:00`) reflect a school canteen, not a bistro. In Oslo bistro reality, the kitchen opens at 14:00 for prep and service starts at 17:00-18:00 — a `Kveldsvakt` is 14:00-23:00 with a split-shift allowance for the prep window. An owner creating Bella Vista and seeing 07:00-15:00 "Morgenvakt" will immediately distrust the system. This is a trust-building failure at first login.

**The tariff decision is a bigger deal than the UX suggests:** In Norway, the decision to be bound by Riksavtalen (NHO Reiseliv member) vs. operate under Aml. minimum is NOT a toggle — it's a collective agreement registration process that takes weeks and requires union notification. Smartout's current UX treats it as a `Switch` in a settings panel. A real Norwegian owner who has just signed an NHO Reiseliv membership would expect Smartout to congratulate them and immediately surface "your Riksavtalen supplements are now active" — not leave a `tariff_binding_decided` gate silently open with no explanation. The product needs at minimum a `ConfirmTariffBindingDialog` that explains the legal consequence before setting `is_tariff_bound=true`.
