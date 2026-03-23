---
title: "Cascade Documentation Alignment — Design Specification"
status: approved
updated: 2026-03-22
created: 2026-03-22
module: cascade
tags: [cascade, documentation, refactor, alignment, design-spec]
---

# Cascade Documentation Alignment — Design Specification

## 1. Purpose

Make the Cascade Core Foundation (I1+6D+4C+K1a/K1b) the organizing principle across all Smartout documentation, enforcement layers, and agent instructions. This is not a bolt-on — it is a full rewrite of how the system is described, understood, and enforced.

### 1.1 Scope

| Layer              | Files                                                                                              | Approach                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| CLAUDE.md          | 1 file                                                                                             | Deep rewrite of Domain Concepts, Data Model, Database Traps, What NOT To Do |
| Reference docs     | DATABASE.md, INDEX.md, SYSTEM_OVERVIEW.md                                                          | Restructure through cascade lens                                            |
| Module docs (core) | 5 modules: 3, 4, 4.5, 8, 15                                                                        | Deep rewrite through cascade dimensions                                     |
| Module docs (rest) | 18 modules: 0 (Roadmap), 1, 2, 5, 6, 7, 9, 10, 11, 12, 13, 14, 17, 18, 19, 20 + AGENT_SDK, BOTSSON | Cascade mapping header added                                                |
| Agent memory       | Steward + supervisor                                                                               | Cascade enforcement checklists                                              |

### 1.2 Prerequisites

- Commit the 69 existing uncommitted docs changes (clean baseline)
- Cascade Core Foundation spec locked (done: 2026-03-21, 5 review rounds)

### 1.3 Not In Scope

- Code changes (no migrations, no TypeScript, no UI)
- Cascade spec modifications (spec is locked)
- Architecture docs rewrite (CORE_ARCH_V2 etc. — separate effort)
- needs-rewrite/ backlog processing (separate effort)

---

## 2. CLAUDE.md Rewrite

The most critical deliverable. Every agent reads CLAUDE.md before doing anything.

### 2.1 Sections to Rewrite

**Domain Concepts** — Replace the current flat list with cascade-organized concepts:

Current structure (pre-cascade):

- Department Session, Session Hooks, Readiness, Trainee Mode, Season, Season Budget, Event Engine, Veikart/Reise/Protokoll, Telemetry Registry

New structure (cascade-organized):

- Cascade Core Model (I1+6D+4C+K1a/K1b — 10-line definition + dimension table)
- Each existing concept mapped to its primary dimension:
  - D1 Operational Envelope: operating hours, department structure, capacity
  - D2 Resource Availability: profiles, contracts, availability, trainee mode
  - D3 Rules & Constraints: framework tables, regulatory rules, Riksavtalen, AML
  - D4 Demand Signal: season budget, day/hour factors, demand forecasting
  - D5 Service Concept: niche profiles, service type parameterization
  - D6 Production & Product: department sessions, session hooks, temporal debt, readiness
  - C1 Calibration: EWMA, plan vs actual, correction loops
  - C2 Interaction: agent context, explanations, Mr. Botsson
  - C3 Commercial: cost attribution, revenue tracking, value measurement
  - C4 Governance: policy engine, permissions, "Confident != Authorized", audit
  - K1a Industry Knowledge: hospitality package, tariff baselines, policy templates
  - K1b Workspace Knowledge: semantic memory, learned factors, local overrides
  - I1 Bootstrap: industry intelligence, workspace creation, two-wizard onboarding
- Event Engine relationship: cascade pipeline is producer, event engine is consumer
- Telemetry Registry: unchanged (orthogonal to cascade)

**Data Model** — Rewrite the hierarchy through cascade:

Current: Identity -> company -> company_member -> workspace -> profile (flat)

New: Same identity layer (unchanged), but workspace-scoped tables organized by dimension:

- D1 tables: department_operating_hours, department_hours_override, planning_cycle
- D2 tables: profile, employment_contract, employee_payroll_profile, schedule_absence
- D3 tables: regulatory_framework, framework_rule, framework_trigger, tariff_rate_table, public_holiday
- D4 tables: season_budget, day_factor, hour_factor, workspace_budget, planning_event
- D5 tables: workspace config, niche parameters (parameterizes coefficients in D1-D4, D6)
- D6 tables: department_session, session_hook, session_task, schedule_shift, deviation
- C1 tables: daily_reconciliation, workspace_kpi_target, planning_factors, adjustment_factors
- C3 tables: shift_cost_snapshot
- C4 tables: engine_authority_config, change_proposal
- K1a tables: regulatory_framework (platform-level), tariff_rate_table (NULL workspace_id), public_holiday
- K1b tables: workspace_doc_chunk, engine_memory

Existing rules preserved: workspace_id on all workspace-scoped tables, profile has no season connection, position is per-shift not per-person, roles/statuses unchanged.

**Database Critical Traps** — Add cascade traps inline:

- Triple operating hours: `company_opening_hours` (wizard intake), `operating_hours` (legacy — migrate away), `department_operating_hours` (cascade runtime truth)
- `hospitality.ts` rates are WRONG — correct Riksavtalen 2024 rates in memory file. `tariff_rate_table` is cascade source of truth.
- Framework tables exist but may need seeding — `regulatory_framework`, `framework_rule`, `tariff_rate_table`
- `change_proposal_status` enum — do not confuse with `contract_status`
- Cascade tables use `btree_gist` extension for exclusion constraints
- `tariff_rate_table.workspace_id` is nullable (platform-level rates have NULL workspace)
- Provenance: every cascade record carries `source_type` + `source_id`

**What NOT To Do** — Add cascade enforcement rules:

- Never hardcode regulatory rates — use `framework_rule` / `tariff_rate_table`
- Never reference `operating_hours` table — use `department_operating_hours`
- Never create schedule constraints outside D3 framework resolution
- Never implement control plane behavior without C4 permission gate
- Never create workspace without I1 bootstrap (no empty workspaces)
- Never mix dimension concerns across tables (D2 data in D4 table = wrong)
- Never treat cascade pipeline and Event Engine as the same thing — cascade produces, event engine consumes

**Source of Truth** — Update hierarchy:

```
1. Code + database schema → always wins
2. This file (CLAUDE.md) → conventions, rules, critical traps
   2.5. Cascade Core Foundation spec → canonical cascade architecture
3. docs/reference/ → detailed lookup during coding
...rest unchanged
```

Note: The cascade spec sits at 2.5, not above CLAUDE.md. CLAUDE.md remains the primary conventions/rules authority. The cascade spec is authoritative specifically for cascade architecture decisions. This avoids a governance conflict and does not require a separate ADR — it follows the existing pattern where STATE.md already sits at 2.5.

### 2.2 Implementation Status Markers

Every cascade reference in CLAUDE.md must include honest status:

```
Phase A (schema): done — 7 migrations, 17 tables, 16 enums
Phase B (pure functions): partial — 4/6 done in apps/web/src/lib/cascade/
Phase C (bootstrap): in progress — framework seed + bootstrap service
Phase D (adapters): not started — Tripletex, external integrations
```

Agents must know what exists vs what is planned.

### 2.3 Constraints

- No information loss — every fact from current CLAUDE.md must survive
- Target: CLAUDE.md ~450 lines (currently ~470 with existing content; cascade replaces verbose pre-cascade content rather than adding on top, so net growth is modest)
- Deep cascade explanations stay in the spec — CLAUDE.md has the enforcement essence
- Verbose existing content (e.g. current Domain Concepts flat list) can be trimmed when replaced by the more structured cascade-organized version

---

## 3. Reference Docs Update

### 3.1 DATABASE.md

- Add dimension grouping to table listings: each table tagged with primary dimension (D1-D6, C1-C4, K1a/K1b)
- Add cascade-specific tables section (framework, operating hours, cost model, proposals)
- Triple operating hours warning
- Mark `operating_hours` as legacy migration target
- Preserve all existing content — this is additive restructuring

### 3.2 INDEX.md

- Cascade spec as first entry in Source of Truth hierarchy
- Verify Cascade Architecture section is complete
- Update module statuses to reflect cascade alignment work
- Add cascade spec cross-reference to module entries that get deep rewrites

### 3.3 SYSTEM_OVERVIEW.md (Swedish)

- Rewrite "Systemets byggstenar" through cascade lens
- Dimensions become the organizing structure instead of flat feature list
- Season section rewritten as D4 Demand Signal + D5 Service Concept
- Scheduling section rewritten as cascade output (D1+D2+D3 intersection)
- Keep the accessible, explanatory tone — this is a reader-facing doc, not enforcement

---

## 4. Module Docs

### 4.1 Deep Rewrites (5 modules)

Each deep rewrite:

- Adds cascade mapping table at top
- Restructures content around primary dimension(s)
- Replaces hardcoded rules/rates with framework table references
- Adds cross-reference to cascade spec
- Updates YAML frontmatter: adds `cascade` tag, updates date

| Module                 | Primary Dimensions | Rewrite Focus                                                                                                               |
| ---------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| 3 — Scheduling         | D1, D2, D3         | Shifts as cascade outputs. Framework-driven constraints. Operating hours from D1. Resource matching from D2. Rules from D3. |
| 4 — Operations         | D6, C1             | Department sessions as D6 production runtime. Session hooks as cascade triggers. C1 plan-vs-actual loop.                    |
| 4.5 — Daily Settlement | D6, C1, C3         | Settlement as closing D6 temporal debt. C1 calibration. C3 cost attribution.                                                |
| 8 — Payroll            | D3, C3             | Riksavtalen/AML from framework tables (D3). Cost model from C3. Tripletex adapter spine (Phase D). No hardcoded rates.      |
| 15 — Season Planning   | D4, D5             | Season budget as D4 demand signal generator. Day/hour factors as D4 distribution. D5 parameterizes coefficients.            |

### 4.2 Cascade Mapping Headers (17 modules)

Standardized block added below YAML frontmatter, before existing content:

```markdown
## Cascade Mapping

> This module's relationship to the Cascade Core Foundation
> (spec: `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`)

| Dimension | Role                                             |
| --------- | ------------------------------------------------ |
| Dx Name   | Primary/Consumes/Produces — one-line description |
| Cy Name   | Enforces/Observes — one-line description         |
```

No body changes — existing content preserved. Only the header is added.

**Special case: Module 6 (Training)** already contains cascade-related content ("Scope cascade" at line 100). Agent C must replace any existing cascade references with the standardized header format, not append a second cascade section.

**MODULE_0_ROADMAP.md** gets a cascade mapping header noting it spans all dimensions as a planning artifact.

Module-to-dimension mappings:

| Module               | Primary        | Secondary                                     |
| -------------------- | -------------- | --------------------------------------------- |
| 1 — Onboarding       | I1 Bootstrap   | D2 (creates profiles)                         |
| 2 — Org Structure    | D1 Envelope    | D5 (department config)                        |
| 5 — HACCP            | D6 Production  | D3 (regulatory), C4 (compliance)              |
| 6 — Training         | D3 Rules       | D2 (readiness), K1a (templates)               |
| 7 — Absence          | D2 Resource    | D3 (rules), D1 (capacity impact)              |
| 9 — Communication    | C2 Interaction | All (notification routing)                    |
| 10 — Reports         | C1 Calibration | C3 (commercial), all dimensions               |
| 11 — Settings        | D1 Envelope    | D5 (workspace config)                         |
| 12 — AI              | C2 Interaction | C1 (beliefs), C4 (permissions)                |
| 13 — Multitenant     | I1 Bootstrap   | K1a/K1b (isolation)                           |
| 14 — Production      | D6 Production  | D4 (demand), D5 (concept)                     |
| 17 — Platform Admin  | C4 Governance  | All (platform-level oversight)                |
| 18 — WebRTC          | C2 Interaction | D6 (live state)                               |
| 19 — Menu Production | D6 Production  | D4 (demand), D5 (concept)                     |
| 20 — Inventory       | D6 Production  | D3 (rules), C3 (cost)                         |
| Agent SDK            | C2 Interaction | C4 (authority), K1b (memory)                  |
| Botsson              | C2 Interaction | C1 (beliefs), C4 (permissions)                |
| 0 — Roadmap          | All dimensions | Planning artifact spanning full cascade model |

---

## 5. Agent Memory & Enforcement

### 5.1 System Steward

New memory file: `cascade-enforcement-checklist.md`

Checklist the steward must verify before approving any plan:

1. **Dimension boundaries** — Does the plan keep data in the correct dimension's tables?
2. **Framework-first** — Are regulatory rates/rules coming from framework tables, not hardcoded?
3. **Confident != Authorized** — Is C1 belief separated from C4 permission?
4. **Event Engine boundary** — Is the cascade pipeline producing events for the event engine to consume (not mixing them)?
5. **I1 Bootstrap** — Does workspace creation flow through industry package bootstrap?
6. **Provenance** — Do new records carry source_type + source_id?
7. **No legacy references** — Is the plan using `department_operating_hours`, not `operating_hours`?
8. **Terminology** — Are D1-D6, C1-C4, I1, K1a/K1b terms used correctly?

### 5.2 Supervisor

New memory: cascade coordination rules

- Canonical terminology table (D1=Operational Envelope, D2=Resource Availability, etc.)
- File ownership boundaries per dimension — which files belong to which dimension
- Cascade spec as mandatory reading before writing agent instructions touching scheduling, operations, payroll, or season
- Module 7 is placeholder — header only, no deep rewrite

---

## 6. Execution Plan

### 6.1 Sequence

```
Step 0: Commit 69 existing changes on docs/cascade-five-dimensions
        (clean baseline, separate commit)

Step 1: CLAUDE.md rewrite (SOLO — blocks everything else)
        - Rewrite Domain Concepts, Data Model, Database Traps, What NOT To Do
        - Verify: no information loss, under 400 lines
        - Produces: terminology table for downstream agents

Step 2: Fan out in parallel (zero file overlap):
        Agent A: DATABASE.md + INDEX.md (reference docs)
        Agent B: 5 deep module rewrites (3, 4, 4.5, 8, 15)
        Agent C: 17 module mapping headers
        Agent D: SYSTEM_OVERVIEW.md rewrite
        Agent E: Agent memory (steward + supervisor checklists)

Step 3: Consistency verification pass
        - Terminology grep: D1-D6, C1-C4, I1, K1a, K1b used consistently
        - Cross-references: all point to cascade spec
        - No orphaned concepts: every old term maps to a dimension
        - Frontmatter: cascade tag + updated date on all modified files
        - No hardcoded rates in any doc

Step 4: Single commit with all changes
```

### 6.2 File Boundaries (No Overlap)

| Agent         | Files                                                    | DO NOT TOUCH                              |
| ------------- | -------------------------------------------------------- | ----------------------------------------- |
| Step 1 (solo) | CLAUDE.md                                                | Everything else                           |
| Agent A       | DATABASE.md, INDEX.md                                    | CLAUDE.md, module docs                    |
| Agent B       | MODULE_3, 4, 4.5, 8, 15                                  | CLAUDE.md, DATABASE.md, other modules     |
| Agent C       | MODULE_0, 1, 2, 5, 6, 7, 9-14, 17-20, AGENT_SDK, BOTSSON | CLAUDE.md, DATABASE.md, Agent B's modules |
| Agent D       | SYSTEM_OVERVIEW.md                                       | Everything else                           |
| Agent E       | .claude/agent-memory/                                    | Everything in docs/                       |

### 6.3 Verification Criteria

- [ ] Every old Domain Concept maps to a dimension in new CLAUDE.md
- [ ] D1-D6, C1-C4, I1, K1a/K1b terms used consistently across all 25+ files
- [ ] All module docs have `cascade` in tags + updated date
- [ ] No hardcoded rates remain in any doc
- [ ] Cascade spec referenced as canonical source in every rewritten doc
- [ ] CLAUDE.md ~450 lines or less
- [ ] No information loss from current CLAUDE.md
- [ ] Triple operating hours warning present in CLAUDE.md and DATABASE.md
- [ ] "Confident != Authorized" principle in CLAUDE.md and steward checklist
- [ ] Event Engine boundary (producer/consumer) documented in CLAUDE.md

---

## 7. Risks & Mitigations

| Risk                                        | Impact                                          | Mitigation                                                                                         |
| ------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Terminology drift across docs               | Agents confused by inconsistent dimension names | Terminology table produced in Step 1, enforced by grep in Step 3                                   |
| Existing cascade references in modules      | Double cascade sections                         | Agent B replaces existing cascade refs (not append). Agent C handles Module 6 special case.        |
| CLAUDE.md grows too long                    | Agent context pollution                         | Target ~450 lines; verbose pre-cascade content trimmed when replaced by structured cascade version |
| Module 7 is placeholder                     | Scope creep writing spec in docs alignment      | Downgraded to header only (Agent C)                                                                |
| Information loss in CLAUDE.md               | Agents lose critical traps                      | Diff check: every fact from old version must be in new version                                     |
| Inconsistent frontmatter                    | Docs pipeline breaks                            | Step 3 verifies all modified files                                                                 |
| Wrong table names propagate                 | Agents assume non-existent tables               | All table names verified against cascade spec + migrations before writing                          |
| Existing tables vs cascade tables confusion | Agents unclear which are new                    | Data Model section distinguishes existing tables mapped to dimensions vs cascade-new tables        |

---

## 8. Success Criteria

When this is done:

1. An agent reading CLAUDE.md thinks in cascade terms by default
2. Every module doc tells agents which dimensions it touches
3. The steward blocks plans that violate cascade principles
4. The supervisor assigns work with dimension-aware file boundaries
5. DATABASE.md maps every table to its cascade dimension
6. No doc references hardcoded regulatory rates
7. The cascade spec is the declared #2 source of truth (after code)
