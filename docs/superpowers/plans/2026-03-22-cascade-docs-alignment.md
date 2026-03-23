---
title: "Cascade Documentation Alignment — Implementation Plan"
status: ready
updated: 2026-03-22
created: 2026-03-22
module: cascade
tags: [cascade, documentation, plan, alignment]
---

# Cascade Documentation Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Cascade Core Foundation (I1+6D+4C+K1a/K1b) the organizing principle across all Smartout docs, CLAUDE.md, and agent enforcement layers.

**Architecture:** Docs-only refactor. No code changes. CLAUDE.md rewrite first (blocks all else), then parallel fan-out across reference docs, module docs, and agent memory. Consistency verification pass at end.

**Tech Stack:** Markdown, YAML frontmatter, git

**Spec:** `docs/superpowers/specs/2026-03-22-cascade-docs-alignment-design.md`

**Cascade spec (read-only reference):** `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`

**Cascade memory (read-only reference):** `/home/sxtnl/.claude/projects/-home-sxtnl-dev-smartout-ai/memory/project_cascade_five_dimensions.md`

---

## Terminology Table (canonical — use verbatim in all docs)

| Code | Full Name                       | Core Question                                     |
| ---- | ------------------------------- | ------------------------------------------------- |
| I1   | Industry Intelligence Bootstrap | What vertical defaults apply?                     |
| D1   | Operational Envelope            | When/where/with what capacity?                    |
| D2   | Resource Availability           | Who is available now and within planning horizon? |
| D3   | Rules & Constraints             | What is allowed/required/forbidden?               |
| D4   | Demand Signal                   | How much activity to prepare for?                 |
| D5   | Service Concept                 | What kind of operation are we?                    |
| D6   | Production & Product            | What to produce, what is the state?               |
| C1   | Observability & Calibration     | What happened vs plan? How to correct?            |
| C2   | Context & Interaction           | What is relevant now? How to explain it?          |
| C3   | Commercial & Outcome            | What value was created? What does it cost?        |
| C4   | Policy & Governance             | What is the system ALLOWED to do?                 |
| K1a  | Industry Knowledge Base         | Platform-owned shared knowledge per vertical      |
| K1b  | Workspace Knowledge Base        | Tenant-isolated continuously learned knowledge    |

**Critical principle:** "Confident != Authorized" — C1 determines belief, C4 determines permission.

---

## Task 0: Commit Existing Changes (prerequisite)

**Files:** All 69 uncommitted changes in wt-2

This must be done by the user before any plan work begins.

- [ ] **Step 1: Stage all docs changes**

```bash
cd /home/sxtnl/dev/wt-2
git add docs/ .claude/skills/ui-ux-pro-max/
```

- [ ] **Step 2: Review staged changes**

```bash
git diff --cached --stat
```

Expected: ~69 files (moves to archive, module updates, spec updates, INDEX.md, etc.)

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
docs(cascade): audit + reorganize docs for cascade alignment

- Archive 33 redundant/superseded docs to docs/archive/
- Create docs/needs-rewrite/ with 12 merge candidates
- Remove hardcoded Riksavtalen rates from MODULE_3 and MODULE_8
- Add cascade cross-references to MODULE_3, 4, 4.5, 8, 15
- Fix MODULE_15 broken YAML frontmatter
- Merge roadmaps/ into single lowercase directory
- Update INDEX.md, DATABASE.md, SECURITY.md refs
- Lock cascade spec after 5 review rounds

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: Verify clean state**

```bash
git status
```

Expected: clean working tree (only untracked files for new plan/spec)

---

## Task 1: CLAUDE.md Rewrite (SOLO — blocks Tasks 2-6)

**Files:**

- Modify: `CLAUDE.md:15-27` (Source of Truth)
- Modify: `CLAUDE.md:63-100` (Database Critical Traps)
- Modify: `CLAUDE.md:173-187` (Data Model)
- Modify: `CLAUDE.md:190-219` (Domain Concepts + Industry Engine Layer)
- Modify: `CLAUDE.md:349-367` (What NOT To Do)

**Required reading before starting:**

- Cascade spec sections 2.1-2.4 (model overview): `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`
- Current CLAUDE.md in full
- Cascade memory: `/home/sxtnl/.claude/projects/-home-sxtnl-dev-smartout-ai/memory/project_cascade_five_dimensions.md`

### Step-by-step:

- [ ] **Step 1: Read current CLAUDE.md in full**

Read the entire file. Note every fact in Domain Concepts, Data Model, Database Traps, and What NOT To Do. These facts MUST survive the rewrite.

- [ ] **Step 2: Update Source of Truth hierarchy**

Replace the current Source of Truth section (lines 15-27) to insert cascade spec at 2.5:

```markdown
## Source of Truth

1. **Code + database schema** → always wins
2. **This file** → conventions, rules, critical traps
   2.5. **Cascade Core Foundation spec** → canonical cascade architecture (`docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`)
   2.5. **docs/STATE.md** → current system state, gaps, weekly plan (updated weekly)
3. **docs/reference/** → DATABASE, ROUTES, PACKAGES, ENV_VARS
4. **docs/engines/** → Event Motor domain packaging (industry, niche, role capability, environment, handbook)
5. **docs/modules/** → business logic (23 module docs)
6. **docs/architecture/** → system design decisions
7. **docs/cross-cutting/** → GDPR, billing, security, i18n

> Master map: `docs/INDEX.md` | All docs have YAML frontmatter.
```

- [ ] **Step 3: Add cascade traps to Database Critical Traps**

Add these items to the existing Database Critical Traps section (after the existing traps, before `## Database Migrations`):

```markdown
- Triple operating hours tables: `company_opening_hours` (wizard intake, keep), `operating_hours` (legacy — MUST migrate away), `department_operating_hours` (cascade runtime truth). Never read/write `operating_hours` in new code.
- `hospitality.ts` rates are WRONG (kveldstillegg: 56 should be 15.65, helgetillegg: 56 should be 29.74, helligdagstillegg: 133% should be 100%). `tariff_rate_table` is cascade source of truth.
- Cascade framework tables: `regulatory_framework`, `framework_rule`, `framework_trigger`, `tariff_rate_table`, `public_holiday`. Check seed status before assuming data exists.
- `change_proposal_status` enum — do NOT confuse with `contract_status`.
- Cascade tables use `btree_gist` extension for exclusion constraints.
- `tariff_rate_table.workspace_id` is nullable — platform-level rates have NULL workspace_id.
- Cascade provenance: every cascade record carries `source_type` + `source_id`.
```

- [ ] **Step 4: Rewrite Data Model section**

Replace lines 173-187 with cascade-organized data model:

```markdown
## Data Model

> Full details: `docs/reference/DATABASE.md`

**Identity (pre-workspace):** user_identity → company → company_member → workspace → profile

**Cascade Dimensions (workspace-scoped):**

- **D1 Envelope:** department (permanent), location, department_operating_hours, department_hours_override, planning_cycle
- **D2 Resource:** profile, employment_contract, employee_payroll_profile, schedule_absence, team (can be seasonal)
- **D3 Rules:** regulatory_framework, framework_rule, framework_trigger, tariff_rate_table, public_holiday
- **D4 Demand:** season_budget, day_factor, hour_factor, workspace_budget, planning_event
- **D5 Concept:** workspace config, niche parameters (parameterizes coefficients in D1-D4, D6)
- **D6 Production:** department_session, session_hook, session_task, schedule_shift, deviation
- **C1 Calibration:** daily_reconciliation, workspace_kpi_target, planning_factors, adjustment_factors
- **C3 Commercial:** shift_cost_snapshot
- **C4 Governance:** engine_authority_config, change_proposal
- **K1a Industry:** regulatory_framework (platform-level), tariff_rate_table (NULL workspace_id), public_holiday
- **K1b Workspace:** workspace_doc_chunk, engine_memory

**Governance (content layer):** policy → protocol → {procedure, routine, runbook, control_list, knowledge_test, confirmation}

**Key rules:** All tables have `workspace_id` (except identity layer + platform-admin + K1a platform-level). Profile has no season connection. Position is per-shift, not per-person.

**Roles:** employee → manager → admin → owner
**Statuses:** trainee → active → inactive → offboarding
**Leader:** Team attribute (`team.leader_profile_id`), NOT a role.
```

- [ ] **Step 5: Rewrite Domain Concepts + Industry Engine Layer**

Replace lines 190-219 (Domain Concepts + Industry Engine Layer) with cascade-organized section:

```markdown
## Cascade Core Model

> Canonical model: **I1 + 6D + 4C + K1a/K1b**. Full spec: `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`

**Implementation status:**

- Phase A (schema): done — 7 migrations, 17 tables, 16 enums
- Phase B (pure functions): partial — 4/6 done in `apps/web/src/lib/cascade/`
- Phase C (bootstrap): in progress — framework seed + bootstrap service
- Phase D (adapters): not started — Tripletex, external integrations

### Execution Dimensions

| #   | Name                  | Core Question                                     | Type                                |
| --- | --------------------- | ------------------------------------------------- | ----------------------------------- |
| D1  | Operational Envelope  | When/where/with what capacity?                    | Structural                          |
| D2  | Resource Availability | Who is available now and within planning horizon? | Volatile                            |
| D3  | Rules & Constraints   | What is allowed/required/forbidden?               | Stable                              |
| D4  | Demand Signal         | How much activity to prepare for?                 | Predictive                          |
| D5  | Service Concept       | What kind of operation are we?                    | Strategic (parameterizes D1-D4, D6) |
| D6  | Production & Product  | What to produce, what is the state?               | Live (temporal debt)                |

### Control Planes

| #   | Name                        | Core Question                    | Loop                            |
| --- | --------------------------- | -------------------------------- | ------------------------------- |
| C1  | Observability & Calibration | What happened vs plan?           | Plan → actual → correction      |
| C2  | Context & Interaction       | What's relevant, how to explain? | State → inference → response    |
| C3  | Commercial & Outcome        | What value, what cost?           | Value → attribution → pricing   |
| C4  | Policy & Governance         | What is system ALLOWED to do?    | Capability → permission → audit |

**"Confident != Authorized"** — C1 determines belief, C4 determines permission. Always separate.

### Knowledge Substrate

| Tier          | Owner                       | Contents                                                                      |
| ------------- | --------------------------- | ----------------------------------------------------------------------------- |
| K1a Industry  | Platform (per vertical)     | Tariff baselines, policy templates, role capabilities, hospitality primitives |
| K1b Workspace | Workspace (tenant-isolated) | Semantic memory (pgvector), learned factors, local overrides                  |

### I1 Industry Intelligence Bootstrap

Pre-runtime layer. Loads vertical defaults, applies SQL templates, seeds all dimensions.

- Canonical path: `docs/engines/industri-inteligence/hospitalety/`
- Central documentation for: event-layer specialization, AI council and personas, default policy baselines, template families (structure/pipeline/journey), testing profiles, relevance mapping, company handbook template, role capability profiles, environment baseline, niche specialization
- Code: `apps/web/src/lib/industry/` (hospitality.ts, types.ts)
- Templates: `supabase/templates/restaurant/` (13 SQL + \_apply.sql)
- Admin portal NEVER creates empty workspaces — always from I1 bootstrap.

### Domain Concepts (mapped to dimensions)

- **Department Session** (D6) — Daily container per dept. Lifecycle: upcoming → active → pending_signoff → closed | missed
- **Session Hooks** (D6) — Time triggers firing procedures/routines at pre_open, open, scheduled, pre_close, close
- **Readiness** (D2/D6) — Employee "ready" when all assigned Protocols completed. Score = % completed.
- **Trainee Mode** (D2) — Status flag on profile (`profile_status = 'trainee'`). Timestamps: `trainee_started`, `trainee_completed`. Sandbox write restrictions and 48h escalation are planned but NOT yet implemented.
- **Season** (D4/D5) — Time period wrapping operations, gamification, and revenue planning. Own leaderboard and point rules.
- **Season Budget** (D4) — Strategic revenue target per season. 1:1 with season. Contains total target, labor %, avg hourly wage, base price per guest. Day/hour factors distribute targets across weekdays and hours. Calculation engine: `apps/web/src/lib/season-calculations.ts` (pure functions, no DB deps). UI: `/dashboard/season` with 4 tabs (overview, budget, day-factors, hour-factors).
- **Event Engine** — Universal workflow runtime. `engine_process` (blueprint) → `engine_state` (live instance) → `engine_state_step` (per-step tracking). Cascade pipeline is a PRODUCER of events; Event Engine is the CONSUMER. New workflow = new engine_process + action_type handlers. Never create separate workflow state tables. Note: `journey` / `journey_step` / `journey_event` tables are a **metadata registry** (ADR-0031, 68 journey definitions from Bubble migration) — not workflow state tracking. Action types: `wait_for_event`, `assign_task`, `send_notification` (stub), `update_entity`, `create_deviation`, `validate_settlement`, `lock_checkout`, `schedule_control` (reserved), `start_process`, `upsert_session`. Dispatch: `supabase/functions/engine-dispatch/index.ts`.
- **Veikart → Reise → Protokoll** — Conceptual mapping. Veikart = engine_process. Reise = engine_state (employee). Protokoll = engine_state (leader). Norwegian terms are design vocabulary, not code constructs.
- **Telemetry Registry** — Orthogonal to cascade. All events defined in `packages/telemetry/src/registry.ts`.
```

- [ ] **Step 6: Add cascade rules to What NOT To Do**

Add these lines to the existing "What NOT To Do" section (after the existing rules):

```markdown
- Never hardcode regulatory rates — use `framework_rule` / `tariff_rate_table`
- Never reference `operating_hours` table — use `department_operating_hours`
- Never create schedule constraints outside D3 framework resolution
- Never implement control plane behavior without C4 permission gate
- Never create workspace without I1 bootstrap (no empty workspaces)
- Never mix dimension concerns across tables (D2 data in D4 table = wrong)
- Never treat cascade pipeline and Event Engine as the same thing — cascade produces, event engine consumes
```

- [ ] **Step 7: Verify no information loss**

Run a manual check: every fact from the OLD Domain Concepts, Data Model, Database Traps, and Industry Engine Layer sections must exist somewhere in the new CLAUDE.md. Key facts to verify:

- `journey` / `journey_step` / `journey_event` metadata registry note (ADR-0031)
- Season budget calculation engine path
- Engine dispatch path
- Trainee mode timestamps
- Session lifecycle states
- All action type handlers listed
- Industry engine canonical path
- All industry engine documentation areas (AI council, niche specialization, etc.)

- [ ] **Step 8: Verify line count**

```bash
wc -l CLAUDE.md
```

Expected: ~450 lines or less. If over 470, trim verbose content.

- [ ] **Step 9: Stage CLAUDE.md (do NOT commit yet — single commit in Task 8)**

```bash
git add CLAUDE.md
```

---

## Task 2: DATABASE.md — Cascade Dimension Tags (parallel with Tasks 3-6)

**Files:**

- Modify: `docs/reference/DATABASE.md`

**Required reading:** Current DATABASE.md, cascade spec section 2.2-2.4, CLAUDE.md (after Task 1)

- [ ] **Step 1: Read current DATABASE.md**

Read the full file to understand current table organization.

- [ ] **Step 2: Add cascade dimension tags**

For each table section in DATABASE.md, add a dimension tag in the format `[D1]`, `[D2]`, etc. after the table name or in a new column. Example:

```markdown
### department_operating_hours [D1 Operational Envelope]
```

Use the dimension-to-table mapping from the Terminology Table at the top of this plan.

- [ ] **Step 3: Add cascade tables section**

If cascade-specific tables (framework, operating hours, cost model, proposals) are not already documented, add a "Cascade Foundation Tables" section grouping them by dimension.

- [ ] **Step 4: Add triple operating hours warning**

Add a prominent warning near the operating hours tables:

```markdown
> **Triple Operating Hours Warning:** Three tables store operating hours data:
>
> - `company_opening_hours` — wizard intake (keep, reclassify)
> - `operating_hours` — LEGACY (migrate away, do not use in new code)
> - `department_operating_hours` — CASCADE runtime truth (use this)
```

- [ ] **Step 5: Mark legacy tables**

Mark `operating_hours` as `[LEGACY — migrate to department_operating_hours]`.

- [ ] **Step 6: Update YAML frontmatter**

Add `cascade` to tags array, update `updated:` date.

- [ ] **Step 7: Verify and stage**

```bash
grep -c "\[D[1-6]\]\|[C[1-4]\]\|\[K1[ab]\]\|\[I1\]" docs/reference/DATABASE.md
git add docs/reference/DATABASE.md
```

Expected: dimension tags present on cascade-relevant tables.

---

## Task 3: INDEX.md — Cascade Cross-References (parallel with Tasks 2, 4-6)

**Files:**

- Modify: `docs/INDEX.md`

- [ ] **Step 1: Read current INDEX.md**

- [ ] **Step 2: Verify Cascade Architecture section**

Check that the Cascade Architecture section contains:

- CASCADE_SPEC pointing to the locked spec
- Correct status (canonical)

- [ ] **Step 3: Update Source of Truth hierarchy**

Add cascade spec at position 2.5 (matching CLAUDE.md):

```markdown
## Source of Truth Hierarchy

1. **Code + database schema** -- implementation always wins
2. **CLAUDE.md** -- conventions, rules, verified facts
   2.5. **Cascade Core Foundation spec** -- canonical cascade architecture
   2.5. **docs/STATE.md** -- current system state, gaps, weekly plan
3. **docs/reference/** -- detailed lookup during coding
   ...
```

- [ ] **Step 4: Update module statuses**

For the 5 deep-rewrite modules (3, 4, 4.5, 8, 15), update their status to reflect cascade alignment.

- [ ] **Step 5: Update ADR count**

Check actual ADR count on disk and update if INDEX.md says 51 but there are more:

```bash
ls docs/decisions/0*.md | wc -l
```

- [ ] **Step 6: Update YAML frontmatter**

Update `updated:` date.

- [ ] **Step 7: Stage**

```bash
git add docs/INDEX.md
```

---

## Task 4: Deep Module Rewrites — 5 Core Modules (parallel with Tasks 2, 3, 5, 6)

**Files:**

- Modify: `docs/modules/SMARTOUT_MODULE_3_SCHEDULING.md`
- Modify: `docs/modules/SMARTOUT_MODULE_4_OPERATIONS.md`
- Modify: `docs/modules/SMARTOUT_MODULE_4.5_DAILY_SATTLED.md`
- Modify: `docs/modules/SMARTOUT_MODULE_8_PAYROLL.md`
- Modify: `docs/modules/SMARTOUT_MODULE_15_SEASON_PLANNING.md`

**Required reading:** Each module doc in full, cascade spec sections 2.2-2.4, CLAUDE.md (after Task 1)

**Rules:**

- Replace any existing cascade references (don't append a second cascade section)
- Use terminology from the Terminology Table verbatim
- Remove any hardcoded regulatory rates — reference framework tables instead
- Add cascade spec cross-reference
- All existing business logic content MUST survive — reorganize under dimensions, don't delete

### Module 3 — Scheduling

- [ ] **Step 1: Read MODULE_3 in full**

- [ ] **Step 2: Add cascade mapping header**

Add after YAML frontmatter, before existing content:

```markdown
## Cascade Mapping

> This module's relationship to the Cascade Core Foundation
> (spec: `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`)

| Dimension                | Role                                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| D1 Operational Envelope  | Primary — operating hours define when shifts can exist                                   |
| D2 Resource Availability | Primary — who is available for assignment                                                |
| D3 Rules & Constraints   | Primary — framework rules constrain shift parameters (max hours, rest periods, overtime) |
| D4 Demand Signal         | Consumes — demand drives staffing targets                                                |
| D5 Service Concept       | Parameterizes — service type affects shift weights and thresholds                        |
| D6 Production & Product  | Produces — shifts become D6 production state when day arrives                            |
| C1 Calibration           | Observes — plan vs actual staffing                                                       |
| C4 Governance            | Enforces — permission gates on auto-scheduling                                           |
```

- [ ] **Step 3: Restructure content around dimensions**

Reorganize existing scheduling content under dimension headings. Shifts are cascade outputs (intersection of D1 envelope + D2 resources + D3 rules). Framework tables replace any hardcoded constraint references.

- [ ] **Step 4: Remove hardcoded rates**

Search for any remaining hardcoded Riksavtalen rates or AML references. Replace with: "See `tariff_rate_table` (D3) and `framework_rule` for regulatory constraints."

- [ ] **Step 5: Update frontmatter**

Add `cascade` to tags, update `updated:` date.

### Module 4 — Operations

- [ ] **Step 6: Read MODULE_4 in full**

- [ ] **Step 7: Add cascade mapping header**

```markdown
## Cascade Mapping

> Spec: `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`

| Dimension               | Role                                                    |
| ----------------------- | ------------------------------------------------------- |
| D6 Production & Product | Primary — department sessions are live production state |
| D1 Operational Envelope | Consumes — operating hours determine session lifecycle  |
| C1 Calibration          | Produces — session outcomes feed plan-vs-actual         |
| C4 Governance           | Enforces — session sign-off requires authorization      |
```

- [ ] **Step 8: Restructure around D6 production runtime**

Department sessions = D6 production state. Session hooks = cascade triggers. Temporal debt concept: if today's session is incomplete, tomorrow inherits the deficit.

- [ ] **Step 9: Update frontmatter**

### Module 4.5 — Daily Settlement

- [ ] **Step 10: Read MODULE_4.5 in full**

- [ ] **Step 11: Add cascade mapping header**

```markdown
## Cascade Mapping

> Spec: `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`

| Dimension               | Role                                                        |
| ----------------------- | ----------------------------------------------------------- |
| D6 Production & Product | Primary — settlement closes the day's production state      |
| C1 Calibration          | Primary — plan vs actual comparison drives corrections      |
| C3 Commercial & Outcome | Produces — cost attribution for the settled day             |
| D4 Demand Signal        | Consumes — settled actuals refine future demand predictions |
```

- [ ] **Step 12: Restructure around D6 temporal debt + C1 calibration**

Settlement = closing D6 temporal debt. C1 uses settled data to adjust future predictions. C3 attributes costs.

- [ ] **Step 13: Update frontmatter**

### Module 8 — Payroll

- [ ] **Step 14: Read MODULE_8 in full**

- [ ] **Step 15: Add cascade mapping header**

```markdown
## Cascade Mapping

> Spec: `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`

| Dimension                | Role                                                  |
| ------------------------ | ----------------------------------------------------- |
| D3 Rules & Constraints   | Primary — Riksavtalen/AML rates from framework tables |
| C3 Commercial & Outcome  | Primary — cost model, labor cost attribution          |
| D2 Resource Availability | Consumes — employee contracts, payroll profiles       |
| D6 Production & Product  | Consumes — actual hours worked from shifts            |
| C4 Governance            | Enforces — payroll approval authorization             |
```

- [ ] **Step 16: Remove all hardcoded rates**

Replace any remaining Riksavtalen rate references with: "All rates resolved from `tariff_rate_table` via `framework_rule` (D3). See cascade spec section 5 for framework seed examples. Note: `hospitality.ts` rates are WRONG — do not use as source."

- [ ] **Step 17: Add Tripletex adapter reference**

Note Phase D adapter spine for payroll export. Not implemented yet.

- [ ] **Step 18: Update frontmatter**

### Module 15 — Season Planning

- [ ] **Step 19: Read MODULE_15 in full**

- [ ] **Step 20: Add cascade mapping header**

```markdown
## Cascade Mapping

> Spec: `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`

| Dimension               | Role                                                     |
| ----------------------- | -------------------------------------------------------- |
| D4 Demand Signal        | Primary — season budget generates demand targets         |
| D5 Service Concept      | Primary — service type parameterizes budget coefficients |
| C1 Calibration          | Produces — season actuals feed calibration loop          |
| C3 Commercial & Outcome | Produces — season P&L attribution                        |
```

- [ ] **Step 21: Restructure around D4 demand + D5 parameterization**

Season budget = D4 demand signal generator. Day/hour factors = D4 distribution. D5 changes weights/thresholds (rare — business model pivot).

- [ ] **Step 22: Update frontmatter**

- [ ] **Step 23: Stage all 5 modules**

```bash
git add docs/modules/SMARTOUT_MODULE_3_SCHEDULING.md \
        docs/modules/SMARTOUT_MODULE_4_OPERATIONS.md \
        docs/modules/SMARTOUT_MODULE_4.5_DAILY_SATTLED.md \
        docs/modules/SMARTOUT_MODULE_8_PAYROLL.md \
        docs/modules/SMARTOUT_MODULE_15_SEASON_PLANNING.md
```

---

## Task 5: Cascade Mapping Headers — 18 Remaining Modules (parallel with Tasks 2-4, 6)

**Files:**

- Modify: `docs/modules/MODULE_0_ROADMAP.md`
- Modify: `docs/modules/SMARTOUT_MODULE_1_ONBOARDING.md`
- Modify: `docs/modules/SMARTOUT_MODULE_2_ORG_STRUCTURE.md`
- Modify: `docs/modules/SMARTOUT_MODULE_5_HACCP.md`
- Modify: `docs/modules/SMARTOUT_MODULE_6_TRAINING.md`
- Modify: `docs/modules/SMARTOUT_MODULE_7_ABSENCE.md`
- Modify: `docs/modules/SMARTOUT_MODULE_9_COMMUNICATION.md`
- Modify: `docs/modules/SMARTOUT_MODULE_10_REPORTS.md`
- Modify: `docs/modules/SMARTOUT_MODULE_11_SETTINGS.md`
- Modify: `docs/modules/SMARTOUT_MODULE_12_AI.md`
- Modify: `docs/modules/SMARTOUT_MODULE_13_MULTITENANT.md`
- Modify: `docs/modules/SMARTOUT_MODULE_14_PRODUCTION.md`
- Modify: `docs/modules/SMARTOUT_MODULE_17_PLATFORM_ADMIN.md`
- Modify: `docs/modules/SMARTOUT_MODULE_18_WEBRTC.md`
- Modify: `docs/modules/SMARTOUT_MODULE_19_MENU_PRODUCTION.md`
- Modify: `docs/modules/SMARTOUT_MODULE_20_INVENTORY.md`
- Modify: `docs/modules/MODULE_AGENT_SDK.md`
- Modify: `docs/modules/MODULE_BOTSSON.md`

**Rules:**

- Add standardized cascade mapping header ONLY — no body changes
- **Module 6 special case:** Replace any existing cascade references with the standardized header
- Use the module-to-dimension mapping from the spec (section 4.2)
- Update YAML frontmatter: add `cascade` to tags, update date

### Header template (customize per module):

```markdown
## Cascade Mapping

> This module's relationship to the Cascade Core Foundation
> (spec: `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`)

| Dimension | Role                                    |
| --------- | --------------------------------------- |
| Dx Name   | Primary/Consumes/Produces — description |
```

### Per-module mappings:

- [ ] **Step 1: MODULE_0_ROADMAP** — All dimensions | Planning artifact spanning full cascade model

- [ ] **Step 2: MODULE_1_ONBOARDING** — I1 Bootstrap (primary) | D2 Resource (creates profiles)

- [ ] **Step 3: MODULE_2_ORG_STRUCTURE** — D1 Envelope (primary) | D5 Concept (department config)

- [ ] **Step 4: MODULE_5_HACCP** — D6 Production (primary) | D3 Rules (regulatory), C4 Governance (compliance)

- [ ] **Step 5: MODULE_6_TRAINING** — D3 Rules (primary) | D2 Resource (readiness), K1a Industry (templates). **Replace existing cascade refs.**

- [ ] **Step 6: MODULE_7_ABSENCE** — D2 Resource (primary) | D3 Rules (constraints), D1 Envelope (capacity impact)

- [ ] **Step 7: MODULE_9_COMMUNICATION** — C2 Interaction (primary) | All dimensions (notification routing)

- [ ] **Step 8: MODULE_10_REPORTS** — C1 Calibration (primary) | C3 Commercial, all dimensions

- [ ] **Step 9: MODULE_11_SETTINGS** — D1 Envelope (primary) | D5 Concept (workspace config)

- [ ] **Step 10: MODULE_12_AI** — C2 Interaction (primary) | C1 Calibration (beliefs), C4 Governance (permissions)

- [ ] **Step 11: MODULE_13_MULTITENANT** — I1 Bootstrap (primary) | K1a/K1b (isolation)

- [ ] **Step 12: MODULE_14_PRODUCTION** — D6 Production (primary) | D4 Demand, D5 Concept

- [ ] **Step 13: MODULE_17_PLATFORM_ADMIN** — C4 Governance (primary) | All dimensions (platform-level oversight)

- [ ] **Step 14: MODULE_18_WEBRTC** — C2 Interaction (primary) | D6 Production (live state)

- [ ] **Step 15: MODULE_19_MENU_PRODUCTION** — D6 Production (primary) | D4 Demand, D5 Concept

- [ ] **Step 16: MODULE_20_INVENTORY** — D6 Production (primary) | D3 Rules, C3 Commercial (cost)

- [ ] **Step 17: MODULE_AGENT_SDK** — C2 Interaction (primary) | C4 Governance (authority), K1b Workspace (memory)

- [ ] **Step 18: MODULE_BOTSSON** — C2 Interaction (primary) | C1 Calibration (beliefs), C4 Governance (permissions)

- [ ] **Step 19: Update all frontmatter**

For each of the 18 files: add `cascade` to tags array, set `updated: 2026-03-22`.

- [ ] **Step 20: Stage all 18 modules**

```bash
git add docs/modules/MODULE_0_ROADMAP.md \
        docs/modules/SMARTOUT_MODULE_1_ONBOARDING.md \
        docs/modules/SMARTOUT_MODULE_2_ORG_STRUCTURE.md \
        docs/modules/SMARTOUT_MODULE_5_HACCP.md \
        docs/modules/SMARTOUT_MODULE_6_TRAINING.md \
        docs/modules/SMARTOUT_MODULE_7_ABSENCE.md \
        docs/modules/SMARTOUT_MODULE_9_COMMUNICATION.md \
        docs/modules/SMARTOUT_MODULE_10_REPORTS.md \
        docs/modules/SMARTOUT_MODULE_11_SETTINGS.md \
        docs/modules/SMARTOUT_MODULE_12_AI.md \
        docs/modules/SMARTOUT_MODULE_13_MULTITENANT.md \
        docs/modules/SMARTOUT_MODULE_14_PRODUCTION.md \
        docs/modules/SMARTOUT_MODULE_17_PLATFORM_ADMIN.md \
        docs/modules/SMARTOUT_MODULE_18_WEBRTC.md \
        docs/modules/SMARTOUT_MODULE_19_MENU_PRODUCTION.md \
        docs/modules/SMARTOUT_MODULE_20_INVENTORY.md \
        docs/modules/MODULE_AGENT_SDK.md \
        docs/modules/MODULE_BOTSSON.md
```

---

## Task 6: SYSTEM_OVERVIEW.md Rewrite (parallel with Tasks 2-5)

**Files:**

- Modify: `docs/SMARTOUT_SYSTEM_OVERVIEW.md`

**Rules:**

- This is a Swedish reader-facing document — keep the accessible, explanatory tone
- Rewrite "Systemets byggstenar" through cascade lens
- Dimensions become the organizing structure instead of flat feature list
- Keep it understandable for non-technical readers (restaurant managers, board members)

- [ ] **Step 1: Read current SYSTEM_OVERVIEW.md in full**

- [ ] **Step 2: Rewrite Systemets byggstenar intro**

Frame the system around the cascade model: Smartout understands a business through 6 dimensions and 4 control planes. Each section maps to a dimension.

- [ ] **Step 3: Rewrite individual sections**

Map current sections to dimensions:

- Organisationsstruktur → D1 Operational Envelope (Driftsrammer)
- Sasong → D4 Demand Signal + D5 Service Concept
- Schemalagnning → D1+D2+D3 cascade output
- Keep existing sections that don't map cleanly (just add dimension context)

- [ ] **Step 4: Add cascade model overview**

Add a brief, accessible explanation of the I1+6D+4C model early in the document. Use Swedish. Something like:

"Smartout forstår en verksamhet genom sex dimensioner: nar/var (D1), vem (D2), regler (D3), efterfragan (D4), koncept (D5), och vad som hander just nu (D6). Fyra kontrollplan overvakar, forklarar, mater och styr."

- [ ] **Step 5: Update frontmatter**

Add `cascade` to tags, update date.

- [ ] **Step 6: Stage**

```bash
git add docs/SMARTOUT_SYSTEM_OVERVIEW.md
```

---

## Task 7: Agent Memory — Enforcement Checklists (parallel with Tasks 2-6)

**Files:**

- Create: `.claude/agent-memory/system-steward/cascade-enforcement-checklist.md`
- Modify: `.claude/agent-memory/system-steward/MEMORY.md`
- Create: `.claude/agent-memory/supervisor/cascade-coordination.md`

- [ ] **Step 1: Create steward enforcement checklist**

Write to `.claude/agent-memory/system-steward/cascade-enforcement-checklist.md`:

```markdown
---
name: cascade-enforcement-checklist
description: Mandatory checklist for verifying any plan or implementation against Cascade Core Foundation (I1+6D+4C+K1a/K1b)
type: project
---

## Cascade Enforcement Checklist

Before approving ANY plan that touches scheduling, operations, payroll, season, or workforce data:

1. **Dimension boundaries** — Does the plan keep data in the correct dimension's tables? (D1 envelope data in D1 tables, not D4 tables, etc.)
2. **Framework-first** — Are regulatory rates/rules coming from `framework_rule` / `tariff_rate_table`, not hardcoded in TypeScript?
3. **Confident != Authorized** — Is C1 belief (what the system thinks should happen) separated from C4 permission (what the system is allowed to do)?
4. **Event Engine boundary** — Is the cascade pipeline PRODUCING events for the Event Engine to CONSUME? (Never mixing cascade proposal logic into engine_process handlers.)
5. **I1 Bootstrap** — Does workspace creation flow through the industry package bootstrap? (No empty workspaces.)
6. **Provenance** — Do new cascade records carry `source_type` + `source_id`?
7. **No legacy references** — Is the plan using `department_operating_hours`, NOT `operating_hours`?
8. **Terminology** — Are D1-D6, C1-C4, I1, K1a/K1b terms used correctly and consistently?
9. **Implementation status honesty** — Does the plan acknowledge what exists (Phase A schema, Phase B partial) vs what is planned (Phase C bootstrap, Phase D adapters)?

### Canonical Terminology

| Code | Full Name                       |
| ---- | ------------------------------- |
| I1   | Industry Intelligence Bootstrap |
| D1   | Operational Envelope            |
| D2   | Resource Availability           |
| D3   | Rules & Constraints             |
| D4   | Demand Signal                   |
| D5   | Service Concept                 |
| D6   | Production & Product            |
| C1   | Observability & Calibration     |
| C2   | Context & Interaction           |
| C3   | Commercial & Outcome            |
| C4   | Policy & Governance             |
| K1a  | Industry Knowledge Base         |
| K1b  | Workspace Knowledge Base        |

### Key References

- Cascade spec: `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`
- CLAUDE.md: `CLAUDE.md` (Cascade Core Model section)
- Cascade pure functions: `apps/web/src/lib/cascade/`
- Cascade migrations: `supabase/migrations/20260421*` and `20260422*`
```

- [ ] **Step 2: Update steward MEMORY.md index**

Add the new checklist to the memory index:

```markdown
## System Steward Memory Index

- [cascade-review-findings.md](cascade-review-findings.md) — Cascade Core Foundation review status, gaps, conflicts, risks. Verified 2026-03-22.
- [cascade-enforcement-checklist.md](cascade-enforcement-checklist.md) — Mandatory verification checklist for cascade compliance. Use before approving any plan touching scheduling, operations, payroll, or season.
```

- [ ] **Step 3: Create supervisor cascade coordination memory**

Write to `.claude/agent-memory/supervisor/cascade-coordination.md`:

```markdown
---
name: cascade-coordination
description: Cascade coordination rules for supervising multi-agent work on cascade-related features
type: project
---

## Cascade Coordination Rules

### Canonical Terminology (use verbatim)

| Code | Full Name                       |
| ---- | ------------------------------- |
| I1   | Industry Intelligence Bootstrap |
| D1   | Operational Envelope            |
| D2   | Resource Availability           |
| D3   | Rules & Constraints             |
| D4   | Demand Signal                   |
| D5   | Service Concept                 |
| D6   | Production & Product            |
| C1   | Observability & Calibration     |
| C2   | Context & Interaction           |
| C3   | Commercial & Outcome            |
| C4   | Policy & Governance             |
| K1a  | Industry Knowledge Base         |
| K1b  | Workspace Knowledge Base        |

### File Ownership by Dimension

When assigning work to build agents, respect dimension boundaries:

- D1 work: `department_operating_hours`, `planning_cycle`, operating hours UI, department config
- D2 work: profiles, contracts, availability, team management, absence
- D3 work: framework tables, regulatory rules, tariff rates, constraint resolution
- D4 work: season budget, demand forecasting, day/hour factors
- D5 work: workspace config, niche parameters (rare changes)
- D6 work: department sessions, session hooks, shift execution, deviations
- C1 work: reconciliation, KPI targets, calibration loops
- C3 work: cost snapshots, revenue attribution
- C4 work: authority config, change proposals, governance policies

### Mandatory Reading

Before writing agent instructions that touch scheduling, operations, payroll, or season:

- Read cascade spec: `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`
- Read CLAUDE.md Cascade Core Model section

### Key Rules

- Module 7 (Absence) is a placeholder — header only, no deep implementation
- Cascade pipeline PRODUCES events, Event Engine CONSUMES — never mix
- "Confident != Authorized" — C1 belief, C4 permission. Always separate.
- No empty workspaces — always I1 bootstrap
```

- [ ] **Step 4: Create supervisor MEMORY.md if needed**

```bash
mkdir -p .claude/agent-memory/supervisor
```

If `.claude/agent-memory/supervisor/MEMORY.md` doesn't exist, create it:

```markdown
## Supervisor Memory Index

- [cascade-coordination.md](cascade-coordination.md) — Cascade coordination rules, canonical terminology, file ownership by dimension, mandatory reading for cascade-related agent instructions.
```

If it exists, add the cascade-coordination entry.

- [ ] **Step 5: Stage**

```bash
git add .claude/agent-memory/system-steward/cascade-enforcement-checklist.md \
        .claude/agent-memory/system-steward/MEMORY.md \
        .claude/agent-memory/supervisor/
```

---

## Task 8: Consistency Verification Pass

**This task runs AFTER Tasks 1-7 are all complete.**

- [ ] **Step 1: Terminology consistency grep**

```bash
cd /home/sxtnl/dev/wt-2
grep -rn "Operational Envelope\|Resource Availability\|Rules & Constraints\|Demand Signal\|Service Concept\|Production & Product" docs/modules/ | head -30
grep -rn "D1\|D2\|D3\|D4\|D5\|D6\|C1\|C2\|C3\|C4\|K1a\|K1b\|I1" docs/modules/ | grep -i "cascade\|dimension\|control plane" | head -30
```

Verify: dimension codes match full names consistently.

- [ ] **Step 2: Cross-reference check**

```bash
grep -rn "cascade-scheduling-system-design" docs/modules/ | wc -l
```

Expected: 23 (all module docs reference the cascade spec).

- [ ] **Step 3: No orphaned concepts**

Verify in CLAUDE.md that every old Domain Concept term appears somewhere:

- Department Session, Session Hooks, Readiness, Trainee Mode, Season, Season Budget, Event Engine, Veikart/Reise/Protokoll, Telemetry Registry

```bash
grep -c "Department Session\|Session Hooks\|Readiness\|Trainee Mode\|Season Budget\|Event Engine\|Veikart\|Telemetry Registry" CLAUDE.md
```

Expected: all terms present (mapped to dimensions).

- [ ] **Step 4: Frontmatter check**

```bash
for f in docs/modules/*.md; do
  if ! grep -q "cascade" "$f"; then
    echo "MISSING cascade tag: $f"
  fi
done
```

Expected: no output (all modules have cascade tag).

- [ ] **Step 5: No hardcoded rates**

```bash
grep -rn "56 kr\|133%\|kveldstillegg.*[0-9]\|helgetillegg.*[0-9]\|helligdagstillegg.*[0-9]" docs/modules/ docs/SMARTOUT_SYSTEM_OVERVIEW.md CLAUDE.md
```

Expected: no output (all hardcoded rates removed).

- [ ] **Step 6: CLAUDE.md line count**

```bash
wc -l CLAUDE.md
```

Expected: ~450 or less.

- [ ] **Step 7: Triple operating hours warning**

```bash
grep -l "department_operating_hours" CLAUDE.md docs/reference/DATABASE.md
```

Expected: both files listed.

- [ ] **Step 8: Single commit — all cascade alignment changes**

```bash
git add CLAUDE.md docs/ .claude/agent-memory/
git commit -m "$(cat <<'EOF'
docs(cascade): full cascade alignment across all docs

- CLAUDE.md: rewrite Domain Concepts, Data Model, DB Traps through
  cascade lens (I1+6D+4C+K1a/K1b)
- DATABASE.md: dimension tags on cascade-relevant tables
- INDEX.md: cascade in source of truth hierarchy, updated counts
- SYSTEM_OVERVIEW.md: rewritten through cascade lens (Swedish)
- 5 core modules deep-rewritten (3, 4, 4.5, 8, 15)
- 18 modules get cascade mapping headers
- Steward + supervisor enforcement checklists created
- All frontmatter updated with cascade tags
- Verified: no orphaned concepts, consistent terminology,
  no hardcoded rates

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Execution Summary

| Task                       | Depends On | Files               | Parallelizable       |
| -------------------------- | ---------- | ------------------- | -------------------- |
| 0 — Commit existing        | None       | 69 files            | No (prerequisite)    |
| 1 — CLAUDE.md              | Task 0     | 1 file              | No (blocks 2-7)      |
| 2 — DATABASE.md            | Task 1     | 1 file              | Yes (with 3-7)       |
| 3 — INDEX.md               | Task 1     | 1 file              | Yes (with 2, 4-7)    |
| 4 — 5 deep module rewrites | Task 1     | 5 files             | Yes (with 2, 3, 5-7) |
| 5 — 18 module headers      | Task 1     | 18 files            | Yes (with 2-4, 6, 7) |
| 6 — SYSTEM_OVERVIEW.md     | Task 1     | 1 file              | Yes (with 2-5, 7)    |
| 7 — Agent memory           | Task 1     | 3 files             | Yes (with 2-6)       |
| 8 — Verification + commit  | Tasks 1-7  | 0 files (read-only) | No (final gate)      |
