---
title: "Bootstrap Domain — Architecture"
status: draft
updated: 2026-05-23
created: 2026-05-23
domain: bootstrap
last_verified: 2026-05-23
mirror: mixed
tags: [bootstrap, architecture, I1, cascade, edge-function, industry, wizard]
---

# Bootstrap — Architecture

> **mirror: mixed** — L1 (SQL templates), L2 (workspace_bootstrap_gate table + 3 RPCs — ADR-0407), L3a (bootstrap-cascade EF + Step 12), L4 (industry loader + getBootstrapGates), L3b (voice mission), L3c (setup wizard) are verified. L3d (coordinator), L5 (session hook + week-1 UI) are aspirational.

## L1 — Execution: SQL Template Seed Layer (verified)

Passive, one-shot seed layer. Produces realistic seed data for a restaurant workspace. Called manually or via `SELECT template_restaurant_apply(workspace_id)`.

**Entry point:** `supabase/templates/restaurant/_apply.sql`
**Function:** `template_restaurant_apply(p_workspace_id uuid)`

10-step sequential pipeline (anchor: `PERFORM template_restaurant_`):

| Step | Function | File | INSERTs |
|------|----------|------|---------|
| 1 | `template_restaurant_departments` | `departments.sql` | 14 |
| 2 | `template_restaurant_locations` | `locations.sql` | 4 |
| 3 | `template_restaurant_policies` | `policies.sql` | 2 |
| 4 | `template_restaurant_governance` | `governance.sql` | 54 |
| 5 | `template_restaurant_employees` | `employees.sql` | 100 |
| 6 | `template_restaurant_schedule` | `schedule.sql` | 1 (generator) |
| 7 | `template_restaurant_budget` | `budget.sql` | 4 |
| 8 | `template_restaurant_teams` | `teams.sql` | 4 |
| 9 | `template_restaurant_assignments` | `assignments.sql` | 1 |
| 10 | `template_restaurant_contracts` | `contracts.sql` | 1 |
| +Mattilsynet | `template_restaurant_mattilsynet` | `mattilsynet.sql` | 75 |
| +Alcohol-labor | `template_restaurant_alcohol_labor` | `alcohol-labor.sql` | 36 |

Total: approximately 296 INSERT operations across 12 SQL files. Mattilsynet and alcohol-labor are called as steps 9 and 10 in the master apply function (steps renumbered from original spec — the actual RAISE NOTICE labels in `_apply.sql` show 10 steps, the last two of which are Mattilsynet and alcohol-labor).

## L3a — Execution: Bootstrap-Cascade Edge Function (verified)

Runtime cascade seeder. Idempotent. Resumable. Auditable. Called internally by `finalize-workspace` EF (`supabase/functions/finalize-workspace/index.ts:79`).

**Entry point:** `supabase/functions/bootstrap-cascade/index.ts`
**Auth:** Internal service-role only (`verifyInternalAuth`)
**Audit:** `workspace_bootstrap_run` table (see DATA-MODEL)

11-step sequential pipeline (anchor: `// Step N:` and `completeStep("...")`):

| Step | Key | What it seeds | Cascade dim |
|------|-----|---------------|-------------|
| 1 | `workspace_operating_hours` | 7-day base hours from intake or hospitality defaults | D1 |
| 2 | `department_type` | Classifies each department (operational/administrative) via `DEPARTMENT_TYPE_MAP` | D1 |
| 3 | `department_operating_hours` | Per-dept hours with offsets from workspace base hours | D1 |
| 4 | `framework_binding` | Binds `hospitality.no.default.v1` regulatory framework | D3 |
| 5 | `tariff_rates` | Copies platform-level `tariff_rate_table` rows to workspace scope | D3 |
| 6 | `planning_cycle` | 4-week default planning cycle | D1 |
| 7 | `season_budget` | Enriches existing season with budget coefficients | D4 |
| 8 | `day_hour_factors` | Seeds `day_factor` + `hour_factor` from hospitality defaults | D4 |
| 9 | `payroll_templates` | Seeds `payroll_profile_template` from `PAYROLL_PROFILE_TEMPLATES` | D2 |
| 10 | `authority_config` | Seeds `engine_authority_config` rows for all registered capabilities (ADR-0192) | C4 |
| 11 | `profession_seed` | Seeds `profession` + `profession_training` for hospitality roles (ADR-0387a, hospitality only) | K1b |

Source: `supabase/functions/bootstrap-cascade/index.ts` (11 original steps + Step 12 `seed_bootstrap_gates` at line ~891, ADR-0407)

**Step 12: seed_bootstrap_gates (ADR-0407, Phase 1)**

Inlines gate definitions (Deno boundary, ADR-0084) and seeds `workspace_bootstrap_gate` rows. Idempotent. Auto-closes `departments_exist`, `locations_exist`, `operating_hours_set`, `regulatory_framework_bound` when data already exists. Industry detection: uses same hospitality framework binding check as Step 11.

## L3b — Intake: Voice Onboarding Mission (verified)

Single-session voice intake. Collects business facts, creates departments/locations/zones, finalizes workspace. NOT week-1 progressive.

**Entry point:** `packages/ai/src/missions/registry.ts:14`
**Mission ID:** `onboarding-interview`
**Duration cap:** 1800 seconds (30 minutes) — `maxDurationSeconds: 1800` (registry.ts:27)
**Voice:** `Mark`, language `no`, temperature 0.6
**First speaker:** `user`

Tools available in this mission (from system prompt anchors at lines 57–74):
- `getOnboardingState` — read wizard state
- `triggerScrape` / `search_company` / `identify_company` — BRREG + scrapling lookup
- `updateBusiness` — workspace table write
- `updateSeason` — season + season_budget write
- `addDepartments` — IN-MEMORY wizard state (Option A, ADR-0275)
- `addLocations` — IN-MEMORY wizard state
- `addZones` — IN-MEMORY wizard state
- `addProcedures` — protocol table write (chat-only guard)
- `advanceToNextSection` — UI navigation
- `addKeyFact` — alias to `memory.save_memory`
- `saveMemory` — engine_memory write
- `finalizeOnboarding` — activates workspace (requires explicit confirmation)

Source: `packages/ai/src/missions/registry.ts:14–93` (onboarding-interview entry)

## L3c — Fallback: Admin Setup Wizard (verified)

Post-bootstrap self-service wizard. Admin-driven. 9 steps. Tolerated deviation from agent-driven model until Phase 5 closes it.

**Entry point:** `apps/web/src/app/dashboard/setup/`
**Definition:** `apps/web/src/app/dashboard/setup/wizard-definition.ts`
**Completion flag:** `workspace.setup_guide_completed` (migration `20260327120000`)
**Route gate:** separate from `workspace.onboarding_completed` (per SETUP_WIZARD_ARCHITECTURE.md spec)

9 step adapters (`apps/web/src/app/dashboard/setup/_adapters/`):

| Order | Adapter file | Step purpose |
|-------|-------------|--------------|
| 1 | `WelcomeStepAdapter.tsx` | Welcome + orientation |
| 2 | `DocumentDropStepAdapter.tsx` | Document upload |
| 3 | `GovernanceStepAdapter.tsx` | Governance setup |
| 4 | `PayrollStepAdapter.tsx` | Payroll configuration |
| 5 | `EmploymentStepAdapter.tsx` | Employment terms |
| 6 | `TeamStepAdapter.tsx` | Team structure |
| 7 | `ShiftTemplateStepAdapter.tsx` | Shift templates |
| 8 | `SeasonStepAdapter.tsx` | Season definition |
| 9 | `HandbookStepAdapter.tsx` | Handbook / handbook content |

Source: `apps/web/src/app/dashboard/setup/wizard-definition.ts:19–419` (adapter imports at lines 19–27, step components at lines 359–419)

## L4 — Derivation: Industry Config Loader (verified)

Feeds industry defaults into the cascade seeder. 3-tier fallback: workspace K1b → platform K1a → hardcoded.

**Entry point:** `packages/ai/src/industry/index.ts`
**Loader:** `packages/ai/src/industry/loader.ts` — exports `loadIndustryPackage`, `getStaticIndustryPackage`
**Packages:**
- `packages/ai/src/industry/packages/hospitality.ts` — exports `hospitalityPackage`, `HOSPITALITY_TARIFF_RATES`, `PAYROLL_PROFILE_TEMPLATES`, `ADMINISTRATIVE_DEFAULT_HOURS`, `HOSPITALITY_DEFAULT_HOURS`, `HOSPITALITY_BOOTSTRAP_GATES`, `getBootstrapGates()` (ADR-0407)
- `packages/ai/src/industry/packages/default.ts` — exports `defaultPackage`, `DEFAULT_BOOTSTRAP_GATES`, `getBootstrapGates()` (ADR-0407)
**Classification:** `packages/ai/src/industry/department-classifier.ts` — exports `DEPARTMENT_TYPE_MAP`, `DEPARTMENT_OFFSET_DEFAULTS`, `lookupDepartmentType`
**NACE map:** `packages/ai/src/industry/defaults.ts` — exports `INDUSTRY_NACE_MAP`, `getDepartmentsForIndustry`, `getPositionsForDepartment`, `getProceduresForIndustry`, `resolveNaceCode`

## L2 — Reality: Workspace Bootstrap Gate Table (verified — ADR-0407)

**Migration:** `supabase/migrations/20260625120000_workspace_bootstrap_gate.sql`

Table: `workspace_bootstrap_gate` — workspace-scoped gate registry.
Enum: `bootstrap_gate_status` (open|in_progress|closed|skipped|blocked).

3 SECURITY DEFINER RPCs:
- `fn_list_open_bootstrap_gates(p_workspace_id)` — returns open/in_progress/blocked gates, re-evaluates blocked
- `fn_close_bootstrap_gate(p_workspace_id, p_gate_slug, p_via, p_profile_id)` — admin-only close
- `fn_skip_bootstrap_gate(p_workspace_id, p_gate_slug, p_reason, p_profile_id)` — admin-only skip (required gates forbidden)

Capability: `packages/ai/src/capabilities/bootstrap/` — 3 tools through gatedMutation (ADR-0204).

**NOTE:** "workspace_readiness" terminology is preserved for employee protocol completion (training domain). This table uses "gate" not "readiness" per ADR-0407 terminology section.

## L3d — Interpretation: Bootstrap-Coordinator (aspirational)

Does NOT exist. No code in `packages/ai/src/` or anywhere in the codebase implements a bootstrap-coordinator. The coordinator is the missing link between the verified seed layers (L1/L3a) and the aspirational readiness model (L2). It would:
- Read `workspace_bootstrap_run` + proposed `workspace_readiness` table on every Botsson session
- Determine which gates are still open
- Select today's gate based on day-of-week-1 progression
- Surface the appropriate mission or direct capability call to Botsson

Proposed home: `packages/ai/src/bootstrap/coordinator.ts` or as a module within `packages/ai/src/capabilities/` owned by agent-harness.

## L5 — Decision: Session Hook + Week-1 UI (aspirational)

Does NOT exist. No hook in stage-engine or Botsson session start reads readiness and surfaces open gates. No `/dashboard/` surface shows "day 3 of 7 — finish X today" to admin.

## Data Flow (current, verified)

```
Admin starts /onboarding
      │
      ▼
Voice mission (onboarding-interview)
  triggerScrape → scrapling
  updateBusiness → workspace table
  addDepartments/Locations/Zones → IN-MEMORY (wizard WizardContext)
  finalizeOnboarding → finalize-workspace EF
      │
      ▼
finalize-workspace EF
  → bootstrap-cascade EF (11 steps, L3a)
  → sets workspace.onboarding_completed = true
      │
      ▼
Admin lands on /dashboard
  → if !setup_guide_completed → /dashboard/setup (wizard, L3c)
  → manual 9-step wizard
      │
      ▼
Workspace operational (gates NOT tracked)
```

## Data Flow (target, aspirational)

```
Admin starts /onboarding
      │
      ▼
Voice mission (onboarding-interview) [unchanged]
      │
      ▼
finalize-workspace EF + bootstrap-cascade EF [unchanged]
  + seeds workspace_readiness rows for all critical gates
      │
      ▼
Botsson session start (every session, week 1)
  bootstrap-coordinator reads workspace_readiness
  → open gates exist → surface today's mission-of-the-day
  → all gates closed → normal Botsson session
      │
      ▼
Admin sees "Day N of 7 — Botsson suggests: finish payroll config"
  → clicks → Botsson guides gate closure
  → readiness row updated: status = closed
```
