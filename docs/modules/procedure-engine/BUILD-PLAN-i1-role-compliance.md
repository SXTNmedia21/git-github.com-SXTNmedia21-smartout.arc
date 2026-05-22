---
title: Build Plan — Role-Compliance + Starter Routines into Hospitality Intelligence
status: draft
updated: 2026-05-22
created: 2026-05-20
module: procedure-engine
tags: [build-plan, procedure-engine, hospitality-intelligence, i1, sortie, role-compliance, full-wiring]
---

# Build Plan — Role-Compliance + Starter Routines into Hospitality Intelligence

> Executes ADR-DRAFT-0387. **Full wiring.** Gated: ADR-accept → council (load-bearing schema) → `/start-feature` sub-sortie → build in ordered phases. Each phase has falsifiable acceptance + named file targets + dispatch model. Migrations split per the `ALTER TYPE … ADD VALUE` trap.

## ⚠️ Council-revised phasing (2026-05-20 — supersedes P0–P7 below)

Council REJECTED the original plan. The decisive finding: `profession_training` spine already exists (orphan). Revised, split into two ADRs:

**ADR-0387a (additive, zero behavior change) — build first:**
- **RA1** Revive `profession_training` as canonical role→protocol spine (no new map).
- **RA2** I1 seeds `profession`/`profession_training` at bootstrap (code = authoring source); upgrade role-capability baseline doc to slug matrix.
- **RA3** Add governance read tool `list_mandatory_protocols_for_role` (names the runtime reader — no phantom knowledge).
- **DROPPED:** `policy_scope='role'` (D2), `protocol.is_mandatory` (D3) — use `profession_training.is_required`.

**ADR-0387b (load-bearing) — after 0387a + conditions:**
- **RB1** Auto-assign trigger fires on `AFTER INSERT ON profile_position` (NOT `profile` — m2m empty at profile-insert), explicit ELSE guard. Reads `profession_training`. Golden case asserts BOTH directions + existing 4 scopes unbroken.
- **RB2** Install `governance.sql` as SECURITY DEFINER RPC before EF calls it; `governance_seed` calls RPC (ADR-0240-clean), not inline SQL.
- **RB3** Rewire `evaluateReadinessGate` → `callGateAction('governance.readiness_gate')` + level; `ready = missing_mandatory===0` (drop `rows.length>0` trap). THEN seed authority row.
- **RB4** Backfill `governance.readiness_gate` for existing workspaces (default-allow trap).
- **RB5** C1/C4 split; `season.get_readiness` unchanged; do NOT touch engine-dispatch `check_readiness` (name collision).
- **RP6** Wizard routine-picker — **port from `taskmanager-DESIGNE/`** (see Mockup rule), structured ghost card + mandatory-locked non-color affordance.

**MOCKUP-SOURCE HARD RULE:** every task-manager UI surface (RP6 wizard + future S4 admin: Min dag, Task-drawer, Bibliotek, Maler, manual-builder, quizmaster) is **ported from `docs/modules/procedure-engine/taskmanager-DESIGNE/` `source/`** — components, tokens, interaction logic. Adapt to Nordic Split + a11y. **Do NOT redesign.** Prototype is canonical.

The original P0–P7 below are PRESERVED for reference but the RA*/RB* set above is the build order.

---

## Pre-flight gates (before any code)
1. **ADR-0387 accepted** (renumber if collision).
2. **Council** (`run-council`) on D2 (`policy_scope` enum) + D6 (readiness gate) — load-bearing on auto-assign trigger + scheduling.
3. **`/start-feature task-i1-role-compliance`** from this campaign → sub-sortie worktree `~/dev/smartout.ai-daily-operation-wt-N`. Commit ADR + this plan into the worktree first (plan-propagation rule).
4. Supabase Local running; `pnpm --filter @smartout/ai build` (dist for stage-engine subpath imports).

## Phase ordering (dependency-correct)

```
P0 docs (I1 knowledge source)
   └─▶ P1 enum migration (split) ─▶ P2 schema (mandatory flag) ─▶ P3 trigger branch
                                                                      └─▶ P4 I1 package types+data
                                                                            └─▶ P5 bootstrap governance_seed (role-aware)
                                                                                  └─▶ P6 wizard step (pick routines)
                                                                                        └─▶ P7 readiness mandatory-aware + C4 gate
```

---

### P0 — I1 knowledge source (docs) · agent: sonnet (docs)
Upgrade `08-role-capability-profiles/restaurant-role-capability-baseline.md` from prose → structured slug matrix (roleSlug, positionSlugs[], mandatoryProtocolSlugs[], starterRoutineSlugs[], readySignal). Add `08-role-capability-profiles/restaurant-starter-routines.md` (routine catalogue per team/role). Slugs MUST match protocol/routine names in `supabase/templates/restaurant/governance.sql`.
**Acceptance:** every `mandatoryProtocolSlug` resolves to a real protocol name in the template; 5 baseline roles fully specified.

### P1 — `policy_scope` enum (migration, split) · agent: sonnet (db)
Migration A: `ALTER TYPE policy_scope ADD VALUE IF NOT EXISTS 'position'; ... 'role';` + `assignment_source ADD VALUE 'role'`. **No consumer in same migration** (Postgres trap). Regen types WITHOUT `op run` (L: op-run-corrupts-gen-types).
**Acceptance:** `database.types.ts` shows new enum values; migration applies clean on fresh local.

### P2 — mandatory flag (migration) · agent: sonnet (db)
Add `protocol.is_mandatory boolean NOT NULL DEFAULT false`; denormalize `protocol_assignment.is_mandatory`. Backfill existing mandatory protocols from template metadata.
**Acceptance:** column present + indexed for gate query; backfill sets HACCP/alcohol/fire protocols mandatory.

### P3 — auto-assign trigger branch (migration) · agent: sonnet (db) — COUNCIL-WATCHED
Extend `auto_assign_protocols_to_new_employee` v2 with `position` + `role` CASE + scope filter (`profile_position` join). Activate `assigned_via='position'|'role'`.
**Acceptance (golden case):** INSERT profile with position=Bartender → `protocol_assignment` rows for bartender-mandatory protocols, `assigned_via='position'`; kitchen profile gets none of them; existing workspace/dept/team/location assignment unchanged (regression guard).

### P4 — I1 package types + data · agent: sonnet (build)
Add `RoleCapabilityProfile` + `StarterRoutineCatalogue` types to `packages/types/src/industry.ts`; optional fields on `IndustryPackage`. Populate `hospitalityPackage` (`packages/ai/src/industry/packages/hospitality.ts`) from P0 matrix. `defaultPackage` omits.
**Acceptance:** `getMandatoryProtocolsForRole(roleSlug)` + `getStarterRoutinesForIndustry(nace)` return correct sets; typecheck green; default/retail unaffected.

### P5 — bootstrap `governance_seed` step (EF) · agent: sonnet (edge-fn) — COUNCIL-WATCHED
New idempotent step in `bootstrap-cascade/index.ts` after step 10: when `industry_type='hospitality'`, apply role-aware governance seed — call `template_restaurant_governance` (or a new role-aware variant) that sets `policy_scope='position'` + `is_mandatory` from I1 `roleCapabilityProfiles`. Track in `workspace_bootstrap_run`.
**Acceptance:** finalize a fresh hospitality workspace → governance protocols seeded with position-scope + mandatory flags; hiring a Bartender into it auto-assigns mandatory protocols (P3 chain end-to-end). Idempotent re-run = no dupes.

### P6 — wizard: pick starter routines · agent: sonnet (build, web) — ADR-0133 web-only
Extend `ConfirmProcedures` (or new `ConfirmRoutines` step in `apps/web/src/app/onboarding/wizard-definition.ts`) to list I1 `starterRoutines` as selectable; persist in wizard state (`types-v2.ts` add `routines`/`controlLists`); pass to finalize → governance_seed honors selection.
**Acceptance:** admin checks "Alcohol control"+"HACCP" → only those routines/control_lists/protocols seeded; unchecked absent; workspace non-empty (I1 rule).

### P7 — readiness mandatory-aware + C4 gate · agent: sonnet (build) — COUNCIL-WATCHED
`governance.check_readiness` + `get-readiness.ts`: readiness over **mandatory** protocols for role/position; expose `ready_for_role`. Refine `evaluateReadinessGate` (WS-A4) to gate on mandatory-incomplete only. Seed `engine_authority_config` row `governance.readiness_gate` at `suggest` (configurable block).
**Acceptance:** unready Bartender (mandatory incomplete) → gate flags per C4 config; complete → `ready_for_role=true`; non-mandatory gaps do NOT block. Gate level overridable per workspace.

---

## Dispatch model (orchestrator = Opus)
- DB migrations (P1/P2/P3) — sonnet db agent, sequential (enum→consumer dependency).
- I1 package (P4) — sonnet build.
- EF (P5) — sonnet edge-fn (load `smartout-edge-function-guide`).
- Wizard (P6) — sonnet build (web) + `smartout-nordic-split`.
- Readiness/gate (P7) — `system-agent-coordinator` (opus) reviews; build by sonnet.
- Golden-case + regression tests per phase — sonnet, before merge.
- Council on P3/P5/P7 deltas — opus agents via `run-council`.

## Telemetry / invariants
- New `protocol_assignment` writes emit per existing registry; add `protocol.role_assigned` event if not present (register in SmartoutEvent + EVENT_ROUTING — L:telemetry-without-emit / ADR-0377).
- All capability writes gated (`gate_action`); seed authority rows before merge (L-0066 default-allow).
- Cross-namespace: governance_seed writes governance tables via owning path (ADR-0240).

## Closure deliverables (per CLAUDE.md feature gates)
ADR-0387 accepted + registered · journeys (Flow: wizard-pick-routines, hire→auto-assign, unready-bartender-gate) · handoff · `pnpm turbo typecheck` 0 errors · golden-case tests · E2E for P6 wizard.
