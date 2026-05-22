---
title: ADR-DRAFT-0387 — Role-Mandatory Compliance Tasks + Starter Routines in Hospitality Intelligence
status: draft
updated: 2026-05-22
created: 2026-05-20
module: procedure-engine
tags: [adr-draft, procedure-engine, hospitality-intelligence, i1, policy-scope, role-compliance, readiness-gate, council-class]
---

# ADR-DRAFT-0387 — Role-Mandatory Compliance Tasks + Starter Routines in Hospitality Intelligence

> ✅ **PROMOTED → [docs/decisions/0387-role-mandatory-compliance-hospitality-intelligence.md](../../decisions/0387-role-mandatory-compliance-hospitality-intelligence.md) is CANONICAL** (accepted 2026-05-21; renumbered from "0379" — collision). This file is the module-level detailed record (full council reasoning + original superseded D1–D6); the docs/decisions ADR is the authority. **0387a shipped** (campaign/daily-operation @ 0dd9528d6); **0387b proposed** (council-gated).

## Status
Draft → **council REJECTED in current form (2026-05-20)** → SPLIT into 0387a (additive) + 0387b (load-bearing) → revised decision set below (§Council Outcome) supersedes the original D1–D6.

> ⚠️ The original D1–D6 (below) are PRESERVED for traceability but SUPERSEDED. Build the **Council Outcome** decision set, not the original.

## Context

The Task Manager module ([MODULE_TASK_MANAGER.md](./MODULE_TASK_MANAGER.md)) has a **Setup/Authoring track** with three gaps the manager promise depends on (verified — GAPS G19–G25):

1. The onboarding wizard lets the admin pick **procedure names only** → bare `procedure` rows (no steps/routines/hooks). Industry routine templates (24 routines, 18 control_lists, 337 assignments in `supabase/templates/restaurant/*`) **exist but run only in the dev showcase seed** — `finalize-workspace → bootstrap-cascade` (10 steps) never applies them.
2. **No role/position compliance scope.** `policy_scope` enum = `workspace|department|team|location` — no `position`/`role`. `assignment_source` already has a `'position'` value but it is a **dead letter** (no code path). `auto_assign_protocols_to_new_employee` trigger CASE has no position branch. So a Bartender cannot be auto-assigned the bartender-mandatory protocols.
3. **Readiness has no per-role / mandatory gate.** `governance.check_readiness` returns `ready=false` if ANY protocol is incomplete; the C4 shift gate (`evaluateReadinessGate`, WS-A4, `shift-lifecycle/tools.ts:54`) blocks publish/approve on any gap — undifferentiated, and hardcoded (not an `engine_authority_config` row).

These are fundamentally **Industry Intelligence (I1)** concerns: *which* protocols a role must complete, *which* routines an industry ships with, are knowledge that belongs in the hospitality package — not hand-authored per workspace. Today I1 (`IndustryPackage`, `packages/types/src/industry.ts:97`) carries tariffs/shifts/seasons/domains but **no role-capability or routine catalogue**. The role-capability baseline (`docs/engines/.../08-role-capability-profiles/restaurant-role-capability-baseline.md`) is prose-only, DB-disconnected.

## Decision

Make role→mandatory-protocol mapping and starter-routine catalogues **first-class I1 knowledge**, and wire them through bootstrap → auto-assign → readiness → C4.

### D1 — I1 contract carries the knowledge (generic, hospitality-concrete)
Extend `IndustryPackage` (`packages/types/src/industry.ts`) with two **optional** fields (default/retail omit them):
```ts
roleCapabilityProfiles?: RoleCapabilityProfile[]
starterRoutines?: StarterRoutineCatalogue[]

type RoleCapabilityProfile = {
  roleSlug: string                 // "bartender" | "kokk" | "servitor" | "skiftleder" | "renhold"
  positionSlugs: string[]          // matches POSITION_REGISTRY names
  mandatoryProtocolSlugs: string[] // protocol names in governance template — compliance level
  starterRoutineSlugs: string[]
  readySignal: string              // from baseline doc
}
type StarterRoutineCatalogue = {
  routineSlug: string
  protocolSlug: string
  triggerType: "scheduled" | "event"
  assignedToTeamSlug: string
}
```
Populate in `hospitalityPackage` only. Upgrade `08-role-capability-profiles/restaurant-role-capability-baseline.md` from prose to a structured slug matrix that is the authoring source for these arrays.

### D2 — Schema: add `position` + `role` to `policy_scope`
```sql
ALTER TYPE policy_scope ADD VALUE IF NOT EXISTS 'position';
ALTER TYPE policy_scope ADD VALUE IF NOT EXISTS 'role';
```
(`assignment_source` already has `'position'`; add `'role'` if needed.) This lets a `policy` be scoped to a position (e.g. Bartender) or a system role.

### D3 — Schema: mandatory flag at compliance level
Add `is_mandatory boolean NOT NULL DEFAULT false` to `protocol` (and denormalize onto `protocol_assignment` for gate-query speed). "Mandatory" = blocks readiness/shift; non-mandatory = recommended. Closes G25.

### D4 — Extend the auto-assign trigger
Add a position branch to `auto_assign_protocols_to_new_employee` (`20260429000000_fix_auto_assign_regression_v2.sql:51`):
```sql
OR (pol.policy_scope = 'position' AND pol.scope_ref_id IN (
      SELECT position_id FROM public.profile_position WHERE profile_id = NEW.profile_id))
OR (pol.policy_scope = 'role' AND pol.scope_ref_id::text = NEW.role::text)
```
Map `policy_scope='position'|'role'` → `assigned_via='position'|'role'` in the CASE (activates the dead enum). `profile_position` confirmed to exist (`20260421100300`).

### D5 — Bootstrap seeds governance per industry
Add a `governance_seed` step to `bootstrap-cascade/index.ts` (after step 10 `authority_config`): when `workspace.industry_type='hospitality'`, apply the selected subset of the governance templates (`template_restaurant_governance` + role-aware variant that sets `policy_scope='position'` + `is_mandatory` from the I1 `roleCapabilityProfiles`). Idempotent via `workspace_bootstrap_run`. This is what makes the wizard selection (S2) real.

### D6 — Readiness becomes mandatory-aware + C4-configurable
- `governance.check_readiness` + `get-readiness.ts`: compute readiness over **mandatory** protocols for the profile's role/position (not all protocols). Expose `ready_for_role`.
- Refine `evaluateReadinessGate` (WS-A4) to gate on **mandatory-incomplete only**, and seed an `engine_authority_config` row (`governance.readiness_gate`) so the shift-block is governed/overridable per workspace ("Confident ≠ Authorized" — C4 owns the permission).

## Consequences

**Positive:** role-mandatory compliance becomes automatic + industry-driven; wizard starter-routine selection becomes real; readiness reflects role-fit, not workspace-average; the gate is governed, not hardcoded. Compliance becomes a by-product of competence (the moat).

**Costs / risks:**
- `policy_scope` enum change is **load-bearing** — touches the live auto-assign trigger that fires on every hire. Regression risk (the v2 migration name itself signals prior regressions). → council + golden-case test on hire.
- Readiness gate change can **block scheduling** if mandatory-set is mis-seeded. → ship behind the configurable `engine_authority_config` row at `suggest` first.
- `ALTER TYPE … ADD VALUE` is not transactional with use in the same migration — split enum-add and consumer migrations (Postgres trap).

## Alternatives considered
1. **Per-workspace manual authoring** (status quo) — admin builds role-protocol maps by hand. Rejected: defeats I1; every workspace re-invents compliance.
2. **Position-scope via existing `team`** — model roles as teams. Rejected: conflates org structure (team) with capability (role); team is operational, role is identity.
3. **Hardcode role→protocol in trigger** — Rejected: not industry-extensible, not visible to I1/agent.

## Open questions for council
- `policy_scope='role'` (system role employee/manager/admin) vs `'position'` (job position) — do we need both, or is position sufficient?
- Should mandatory-incomplete **hard-block** first shift, or **warn + require override**? (C4 authority level: `enforce` vs `suggest`.)
- Does the role-capability matrix belong on `IndustryPackage` (code) as source, or in K1a DB (`workspace_doc_chunk`/platform table) loaded by `loadIndustryPackage`? Recommendation: code is authoring source → seeded to K1a at bootstrap.

## Council Outcome (2026-05-20) — REVISED DECISION SET (supersedes D1–D6)

Council: system-steward (chair), supervisor, system-agent-coordinator, botsson-harness-builder, frontend-designer. Verdict: **REJECT in current form → SPLIT + remediate.** Agent Trust Gate **FAILED on all 3 promises** (auto-assign trigger, readiness gate, template install — all inert/broken as drafted).

### Decisive finding — the spine already exists
`supabase/migrations/20260421100300_add_profession_system.sql:69–80` already ships `profession`, `profession_industry` (NACE/I1 binding), and **`profession_training(profession_id, protocol_id, is_required, weight, workspace_id)`** — the exact role→mandatory-protocol map. It is an **orphan** (zero non-generated consumers). Building D2/D3/D4 as drafted creates a parallel source of truth → violates cascade invariant #1. **Revive the spine; do not duplicate it.**

### Chair self-reversal
- "profession_training orphan duplicated by D2/D3/D4" → **HELD (TRUE)** — `20260421100300:69–80` + zero consumers.
- "fix is primarily schema reconciliation" → **REVERSED** — dominant risk is the feature is **inert as drafted** (`evaluateReadinessGate` hardcoded, never calls `gate_action`; `governance` in the never-seeded list `20260518000000`), not the duplicate table.

### Semantic conflicts resolved
- (a) "revive spine" + "trigger on `profile_position` INSERT" = **SAME goal, composes** — revive `profession_training`, wire first consumer via the m2m-INSERT trigger.
- (b) `profession_training.is_required` (role-conditional) **eliminates D4 parallel map + `policy_scope='role'`**; `protocol.is_mandatory` (D3) **DROPPED** — `DEFAULT false` silently un-gates existing workspaces; derive gate-counting from `is_required` via position join.
- (c) D6-as-seed-only **FALSIFIED** — seeding `engine_authority_config` without rewiring `evaluateReadinessGate` to `callGateAction` is inert.

### ADR-0387a — additive, ship first, ZERO behavior change
- **A1** Revive `profession_training` as the canonical role→protocol spine.
- **A2** I1 (`hospitalityPackage`, code) seeds `profession`/`profession_training` at bootstrap (authoring source); upgrade `08-role-capability-profiles/restaurant-role-capability-baseline.md` to a slug matrix. Bootstrap-only — no `loadIndustryPackage` K1a runtime read (agent-coord: tariff-only loader, runtime read unneeded).
- **A3** Add governance read tool `list_mandatory_protocols_for_role(roleSlug)` — names the runtime reader so I1 data is not phantom knowledge (harness R5).
- **DROP D2** (`policy_scope='role'` — category error) and **DROP D3** (`protocol.is_mandatory` — use `profession_training.is_required`).

### ADR-0387b — load-bearing, after 0387a + conditions met
- **B1** Auto-assign trigger: fire on **`AFTER INSERT ON profile_position`** (not `profile` — m2m empty at profile-insert; supervisor C1 killer), with explicit **ELSE** guard (closes silent-NULL-drop class). Read `profession_training` for mandatory set.
- **B2** Install `supabase/templates/restaurant/governance.sql` as a **SECURITY DEFINER RPC** before any EF calls it (it is a showcase file today, not an installed function — supervisor O4). D5 `governance_seed` calls the RPC (ADR-0240-clean), not inline SQL.
- **B3** **Rewire** `evaluateReadinessGate` (`shift-lifecycle/tools.ts:54`) to `callGateAction('governance.readiness_gate')` + respect level; redefine `ready = missing_mandatory === 0` (drop the `rows.length>0` zero-mandatory trap — agent-coord C3). THEN seed `governance.readiness_gate` at `suggest`.
- **B4** Backfill migration: seed `governance.readiness_gate` for **existing** workspaces (governance is never-seeded → default-allow trap, harness C2).
- **B5** C1/C4 split: `check_readiness` = belief; `gate_action` = permission. Leave `season.get_readiness` **unchanged** (separate % metric, out of scope). Do **NOT** touch engine-dispatch `case "check_readiness"` (name collision, not a consumer — agent-coord C5).

### Frontend (P6 wizard) — accepted
Structured 2-row ghost card + metadata strip; mandatory-locked = 3-layer non-color (Lock icon + "Obligatorisk" word + `bg-muted` surface); mandatory cards NOT buttons (WCAG 2.1.1); `aria-pressed` + `focus-visible` ring; new tokens as aliases (no OKLCH literals).

### MOCKUP-SOURCE HARD RULE (Pontus directive 2026-05-20)
All task-manager UI (wizard routine-picker P6, and the S4 admin surface — Min dag, Task-drawer, Bibliotek, Maler, manual-builder, quizmaster) MUST be **ported from the existing mockups in `docs/modules/procedure-engine/taskmanager-DESIGNE/`** (Task Manager.html + `components/{min-dag,task-drawer,library,manual-builder,quiz-master,sidebar}.jsx`). **Do NOT redesign.** Pull components, tokens, and interaction logic from the prototype `source/`; adapt to Nordic Split tokens + a11y per frontend review. The prototype is the canonical visual + interaction spec.

### Knowledge captured
- Learning: **schema-orphan-rebuild** — grep for an existing spine before proposing a new one (`profession_training` orphan).
- Learning: **authority-seed-inert** (sibling L-0083) — seeding `engine_authority_config` without rewiring the consumer gate is a no-op.

## References
- Mappers: GAPS G17–G25 ([GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md)); BLUEPRINT Track S ([BLUEPRINT.md](./BLUEPRINT.md))
- `IndustryPackage` `packages/types/src/industry.ts:97`; `hospitalityPackage` `packages/ai/src/industry/packages/hospitality.ts:382`
- Trigger `20260429000000_fix_auto_assign_regression_v2.sql:27–81`; `policy_scope` `00003_governance_tables.sql:3`; `assignment_source` `20260414014856:11`
- `bootstrap-cascade/index.ts:258–747`; `finalize-workspace/index.ts:74–106`
- Readiness `packages/ai/src/tools/season/get-readiness.ts:44`; `governance/tools.ts:30`; gate `shift-lifecycle/tools.ts:54,129`
- Templates `supabase/templates/restaurant/{governance,alcohol-labor,mattilsynet,assignments,_apply}.sql`
- Baseline `docs/engines/industri-inteligence/hospitalety/08-role-capability-profiles/restaurant-role-capability-baseline.md`
