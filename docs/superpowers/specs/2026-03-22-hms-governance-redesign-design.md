---
title: "HMS — Cascade-Native Regulated-Work Operating Fabric"
status: draft
created: 2026-03-22
updated: 2026-03-22
module: hms
tags: [hms, cascade, governance, ik-mat, compliance, regulated-work, architecture]
---

# HMS — Cascade-Native Regulated-Work Operating Fabric

## 1. System Role

HMS is not a module. It is Cascade's **regulated-work operating fabric** — the cross-branch capability that ensures work is known, taught, executed correctly, proven, and corrected when it deviates.

HMS operates through Cascade. It does not sit beside it, connect to it, or integrate with it. Every HMS artifact lives inside a Cascade branch. Every HMS action follows a Cascade propagation path. Every HMS surface is a view into branch state.

### The Governing Loop

HMS implements one continuous loop across Cascade branches:

```
Knowledge (K1a/K1b)
  -> Rule (D3)
    -> Trigger (D3/D6)
      -> Execution (D6)
        -> Evidence (D6/C1)
          -> Calibration (C1)
            -> Authority (C4)
              -> Learning (K1b)
                -> Knowledge (updated)
```

Each HMS artifact participates in one or more stages of this loop. Each user surface renders one or more stages of this loop. No artifact exists outside it.

### Procedure in Context

Procedure is the executable unit — the atomic instruction that can be learned, performed, tested, and proven. But procedure is one object inside the governing loop, not the system center. The loop is the system. Procedure is the workhorse within it.

### Competitive Position

Smartout turns compliance into trained behavior, not logged documentation.

- Competitors (eSmiley, Runwell): log controls, document compliance, pass inspection
- Smartout: teach the standard through knowledge, operationalize it through rules and triggers, verify behavior through evidence, prove execution through calibration, catch deviations through exception paths, improve continuously through learned knowledge

Compliance is a **byproduct** of the governing loop running well.

---

## 2. Cascade Placement

HMS participates directly in six Cascade branches and two knowledge tiers. This section defines each placement. This is architecture, not integration.

### K1a — Industry Knowledge Base (platform-owned)

HMS role: **Source of regulatory truth.**

- `regulatory_framework` entries define compliance domains: IK-mat, HMS (occupational), fire safety
- `framework_rule` entries define individual control requirements: temperature gates, hygiene constraints, training requirements
- Procedure templates provide executable standards
- Policy/protocol templates provide governance structure
- All seeded by I1 hospitality bootstrap from `docs/engines/industri-inteligence/hospitalety/`
- Platform-level (workspace_id IS NULL): shared across all hospitality workspaces

K1a is the **regulatory baseline**. It defines what "correct" means before any workspace customizes it.

### K1b — Workspace Knowledge Base (tenant-isolated)

HMS role: **Learned operational context.**

- `workspace_doc_chunk` (pgvector): procedure content indexed for semantic search
- `engine_memory`: learned patterns — "this workspace checks fridge at 06:00, not standard 10:00"
- Local overrides to platform rules (e.g., stricter temperature threshold)
- K1b grows through daily operation: every completed task, every deviation, every quiz result enriches it
- Queried by AI (C2) via `match_workspace_docs()` RPC

K1b is the **local intelligence**. It makes HMS context-aware over time.

### D3 — Rules & Constraints

HMS role: **Regulatory rule definition and enforcement.**

- `framework_rule` entries are the individual compliance requirements
  - `rule_type: "gate"` — must pass, no override (e.g., temperature limits)
  - `rule_type: "constraint"` — soft limit, overridable with authority (e.g., staffing minimums)
  - `rule_type: "advisory"` — informational, no enforcement (e.g., best practice recommendations)
- `framework_trigger` entries define when rules are evaluated
  - Reactive: fires when a condition is met (overdue check, threshold breach)
  - Scheduled: fires on a time schedule (every 4 hours, daily at close)
  - Linked to `framework_rule` via `linked_rule_ids[]`
- Rules link to procedures via `evaluation_config.linked_procedure_id` (soft FK in jsonb)
- Training requirements are D3 gate rules with `check_type: "protocol_completion"` that block D2 scheduling

D3 defines what is **required, forbidden, or constrained** in regulated work. Without D3 rules, HMS has no teeth.

### D6 — Production & Product

HMS role: **Live execution of regulated work.**

- `department_session` is the daily production container — HMS tasks live here
- `session_hook` fires procedures at scheduled times within a session
- `session_task` is the atomic execution unit — created from hooks, ad-hoc, or triggers
  - `is_compliance_required: true` marks tasks that must complete for clean session sign-off
  - `evidence` (jsonb) captures measured values, photos, logged readings
- Deviations originate in D6 — a failing task, an out-of-range measurement, a missed check
- Session sign-off gates: all compliance-required tasks completed, all critical rule evaluations passing, all deviations at minimum acknowledged

D6 is where regulated work **actually happens**. It produces the evidence that C1 calibrates against.

### D2 — Resource Availability

HMS role: **Readiness as a schedulable capacity constraint.**

- Readiness = protocol_assignment completion aggregate per employee
- Readiness is NOT authorization. An employee at 100% readiness is not automatically permitted — C4 authority gates separately
- Readiness is NOT a UX metric only. It is a D2 constraint consumed by the scheduling engine:
  - Position requires protocols [HACCP-Temp, Hygiene, Allergen]
  - Employee has completed [HACCP-Temp, Hygiene] = 66% ready for this position
  - Employee is **not eligible** for this position until Allergen is completed
  - This eligibility check is a D3 gate rule (`check_type: "protocol_completion"`, `blocks_scheduling: true`)
- Readiness formation happens through the learning journey (engine_process), not through the scheduling system

Readiness, eligibility, and authorization are three separate concepts:

| Concept       | Branch | Meaning                              | Example                                        |
| ------------- | ------ | ------------------------------------ | ---------------------------------------------- |
| Readiness     | D2     | Has completed required training      | 80% of protocols done                          |
| Eligibility   | D3     | Meets gate rules for a position/task | All required protocols completed = eligible    |
| Authorization | C4     | Permitted to perform action          | engine_authority_config allows this capability |

Do not conflate these. A readiness percentage does not imply eligibility. Eligibility does not imply authorization.

### C1 — Observability & Calibration

HMS role: **Plan-vs-actual measurement and correction signaling.**

Three calibration loops:

1. **Readiness calibration:** `workspace_kpi_target` (metric: "team_readiness_percent", target: 90) vs actual readiness computed from `protocol_assignment`. Delta generates calibration signal.

2. **Rule compliance calibration:** `framework_rule.evaluation_config.frequency_minutes` (plan) vs last `session_task` completion timestamp for that rule's linked procedure (actual). Overdue = calibration signal.

3. **Deviation calibration:** `daily_reconciliation` links to session deviations. Unresolved deviations at sign-off = temporal debt carried forward to next session (D6 carry-forward). Deviation resolution rate = calibration metric.

C1 does not decide what to do. It measures what happened against what was expected and produces signals. Those signals surface in the calibration view (Oversikt).

### C4 — Policy & Governance

HMS role: **Authority gates on every regulated action.**

- `engine_authority_config` defines per-workspace, per-capability permission levels
- Every HMS mutation checks C4 before executing
- "Confident != Authorized" — C1 may believe an action is appropriate, but C4 must permit it

HMS capabilities in C4:

| capability                 | default level | meaning                                         |
| -------------------------- | ------------- | ----------------------------------------------- |
| `hms.assign_training`      | manager       | Who can assign protocols to employees           |
| `hms.close_deviation`      | manager       | Who can close a deviation                       |
| `hms.edit_procedure`       | admin         | Who can modify compliance-critical procedures   |
| `hms.waive_assignment`     | admin         | Who can waive a training requirement            |
| `hms.view_inspection_pack` | manager       | Who can see full compliance evidence collection |

Per-workspace configurable: a workspace can tighten or loosen any capability.

Compliance-critical procedure edits (linked to `framework_rule`) go through `change_proposal` (existing table): proposed -> approved -> applied. Non-critical procedures can be edited freely. This is C4 enforcement on K1b knowledge mutations.

---

## 3. Object Participation

Every major HMS entity has a defined position in the Cascade loop. This section specifies source of truth, primary branch, cross-branch effects, and evidence generation for each.

### procedure

| Property             | Value                                                                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Source of truth      | `procedure` table                                                                                                                         |
| Primary branch       | K1a (template) or K1b (workspace-specific)                                                                                                |
| Created by           | Admin (K1b) or I1 bootstrap (K1a)                                                                                                         |
| Cross-branch effects | D3: linked from `framework_rule.evaluation_config`; D6: materialized as `session_task` via hooks; D2: completion contributes to readiness |
| Evidence generated   | `procedure_step_completion` records                                                                                                       |
| Authority gate       | `hms.edit_procedure` (C4) for modifications                                                                                               |

### procedure_step

| Property           | Value                                                                                        |
| ------------------ | -------------------------------------------------------------------------------------------- |
| Source of truth    | `procedure_step` table                                                                       |
| Primary branch     | K (knowledge content)                                                                        |
| Dual rendering     | `description` for D6 execution; `training_content` + `media_urls` for D2 readiness formation |
| Evidence generated | `procedure_step_completion` with evidence jsonb                                              |

### protocol + protocol_assignment

| Property             | Value                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| Source of truth      | `protocol` (definition), `protocol_assignment` (per-employee state)                                  |
| Primary branch       | D3 (protocol as rule container), D2 (assignment as readiness state)                                  |
| Cross-branch effects | Assignment completion -> D2 readiness recalc -> C1 calibration signal; Expiry -> C1 attention signal |
| Workflow state       | `engine_state` tracks learning journey per assignment                                                |
| Evidence generated   | Aggregate of step completions + test attempts + confirmation signatures                              |

### session_task

| Property             | Value                                                                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Source of truth      | `session_task` table                                                                                                                           |
| Primary branch       | D6 (production execution)                                                                                                                      |
| Created by           | `session_hook` firing (rule-triggered), manager (ad-hoc), inheritance (absent shift)                                                           |
| Cross-branch effects | Completion -> evidence (D6); Failure -> deviation (D6/C1); Compliance flag -> session sign-off gate (D6); Telemetry -> engine_event (workflow) |
| Evidence generated   | `evidence` jsonb (measured values, photos, timestamps, notes)                                                                                  |

### deviation

| Property             | Value                                                                                                                                                                |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source of truth      | `public.deviation` table                                                                                                                                             |
| Primary branches     | D6 (origin — something went wrong during execution), C1 (calibration — deviation is a plan-vs-actual signal), C4 (resolution requires authority)                     |
| Three-level linkage  | `source_task_id` -> session_task (execution context); `procedure_id` -> procedure (which standard was violated); `protocol_id` -> protocol (which compliance domain) |
| Cross-branch effects | Blocks session sign-off if unresolved (D6); Feeds `daily_reconciliation` (C1); Resolution requires authority gate (C4); Pattern feeds K1b learning                   |
| Evidence generated   | `attachments` jsonb, `resolution_notes`, `closure_record`                                                                                                            |

### framework_rule

| Property             | Value                                                                                                                                                                            |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source of truth      | `framework_rule` table                                                                                                                                                           |
| Primary branch       | D3 (rules and constraints)                                                                                                                                                       |
| Created by           | I1 bootstrap (K1a platform rules) or admin (K1b workspace rules)                                                                                                                 |
| Cross-branch effects | Links to procedure via `evaluation_config.linked_procedure_id`; Drives `framework_trigger` activation; Gate rules block D2 scheduling; Failed evaluations create deviations (D6) |
| Evidence generated   | `framework_rule evaluated` telemetry event                                                                                                                                       |

### framework_trigger

| Property             | Value                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Source of truth      | `framework_trigger` table                                                                                                            |
| Primary branch       | D3 (rule enforcement mechanism)                                                                                                      |
| Cross-branch effects | Creates `session_task` in D6 (execution); Creates `deviation` when escalation condition met; Linked to rules via `linked_rule_ids[]` |

### engine_process / engine_state / engine_state_step

| Property             | Value                                                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source of truth      | `engine_process` (blueprint), `engine_state` (instance), `engine_state_step` (progress)                                                                 |
| Primary branch       | Workflow orchestration (cross-branch)                                                                                                                   |
| HMS usage            | Learning journey blueprint: 5-step process (understand -> practice -> test -> confirm -> done)                                                          |
| Cross-branch effects | Step completion -> D2 readiness update; Step state -> C1 calibration (training velocity); Authority for waiver -> C4 gate; Completion -> K1b enrichment |

### knowledge_test_attempt

| Property             | Value                                                                                                                                    |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Source of truth      | `knowledge_test_attempt` table                                                                                                           |
| Primary branch       | Evidence (proof of knowledge verification)                                                                                               |
| Cross-branch effects | Pass -> advances engine_state_step; Fail -> C1 signal (knowledge gap); Score pattern -> K1b learning (difficulty calibration in Phase 4) |

### confirmation_signature

| Property             | Value                                                                                                                         |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Source of truth      | `confirmation_signature` table                                                                                                |
| Primary branch       | Evidence (proof of acknowledgment)                                                                                            |
| Cross-branch effects | Signature -> advances engine_state_step; Device/IP logged for audit; Cannot be retracted by employee (compliance requirement) |

---

## 4. Branch Propagation Invariants

These are architectural rules, not implementation details. They define how state moves through the Cascade loop for regulated work.

### Knowledge -> Executable

1. A procedure becomes executable only when it is versioned, linked to an active protocol, and that protocol is linked to an active policy.
2. A `framework_rule` becomes evaluable only when its `regulatory_framework` is active and its `evaluation_config` is complete.
3. K1a knowledge (platform templates) becomes K1b knowledge (workspace-specific) only through I1 bootstrap or explicit admin action. No implicit promotion.

### Rule -> Execution

4. A `framework_rule` generates execution (session_task) only when linked to a `framework_trigger` with defined conditions and a linked procedure.
5. A gate rule (`rule_type: "gate"`) that fails evaluation MUST produce a deviation. No silent failures.
6. A constraint rule (`rule_type: "constraint"`) that fails evaluation produces a warning. Escalation to deviation is configurable per trigger.

### Execution -> Evidence

7. Execution only counts as evidence when minimum evidence requirements are met:
   - Task completion requires at least: `completed_by`, `completed_at`, status = `"completed"`
   - Compliance-required tasks additionally require: `evidence` jsonb with measured value OR photo OR explicit acknowledgment
   - A task marked `"skipped"` with `is_compliance_required: true` MUST have a skip reason (enforced in UI, stored in evidence)

### Evidence -> Readiness

8. Evidence affects readiness only when it satisfies validity requirements:
   - `procedure_step_completion` must be linked to a valid `protocol_assignment`
   - `knowledge_test_attempt` must have `passed: true` with score >= protocol's `pass_threshold`
   - `confirmation_signature` must have `signed_at` timestamp and valid `confirmation_id`
   - Expired evidence (e.g., confirmation older than `max_age_days`) does NOT contribute to readiness

### Deviation -> Calibration

9. A deviation with `severity: "critical"` or `severity: "high"` automatically produces a C1 calibration signal (attention item in Oversikt).
10. A deviation linked to a `framework_rule` with `rule_type: "gate"` automatically blocks session sign-off (`blocks_day_approval: true`).
11. Unresolved deviations at session close produce temporal debt — they carry forward and surface in the next session's calibration state.

### Authority -> Activation

12. Compliance-critical knowledge edits (procedures linked to framework_rules) must pass C4 authority control via `change_proposal` before activation.
13. No HMS mutation that affects compliance state may bypass `engine_authority_config` checks. This includes: assigning training, closing deviations, waiving requirements, editing procedures.
14. Authority is workspace-configurable. A workspace can tighten any default but cannot loosen gate rules.

---

## 5. User Surfaces

Surfaces are intent-driven views into Cascade branch state. They are not the architecture. They are how users access the operating fabric through questions natural to their role and moment.

### Surface-to-Branch Mapping

| Surface    | Primary Branch | Cascade Role                | User Intent                        |
| ---------- | -------------- | --------------------------- | ---------------------------------- |
| Oversikt   | C1             | Calibration surface         | "What requires attention now?"     |
| Drift      | D6             | Execution surface           | "What must I do now?"              |
| Opplaering | D2 + K         | Readiness formation surface | "What must I learn?"               |
| Dokumenter | K1a + K1b      | Knowledge surface           | "What does the standard say?"      |
| Avvik      | D6 / C1 / C4   | Exception path surface      | "Something went wrong — what now?" |

### Routing

```
/dashboard/hms                    -> Oversikt (C1 calibration surface)
/dashboard/hms/drift              -> Drift (D6 execution surface)
/dashboard/hms/training           -> Opplaering (D2 readiness formation surface)
/dashboard/hms/documents          -> Dokumenter (K knowledge surface)
/dashboard/hms/deviations         -> Avvik (exception path surface)
/dashboard/hms/procedure/[id]     -> Procedure Detail (cross-branch control plane)
```

Sidebar link "HMS" points to `/dashboard/hms`. Sub-nav follows season page tab pattern.

### IK-Mat Positioning

IK-Mat is a regulatory domain defined in D3 (`regulatory_framework.code = 'ik-mat-no-2025'`). It is not a separate surface or route. It is a **D3 scope filter** applied across all surfaces:

- Oversikt: framework_rule evaluations filtered by IK-mat framework
- Drift: session_tasks generated from IK-mat-linked procedures
- Dokumenter: procedures linked to IK-mat framework_rules
- Avvik: deviations where domain = "safety" or linked to IK-mat rules

Architecture preserves extraction to a dedicated route (`/dashboard/hms/ik-mat`) if market positioning demands it. All queries accept a `frameworkCode` filter parameter. IK-mat-specific components are isolated and recomposable.

### Migration from Current Pages

| Current                  | Becomes                                                       |
| ------------------------ | ------------------------------------------------------------- |
| `/dashboard/governance`  | Redirect to `/dashboard/hms`                                  |
| `/dashboard/my-training` | Kept as employee shortcut; shares hooks with training surface |
| Document Mode (handbook) | Integrated into knowledge surface                             |

---

## 6. Oversikt — C1 Calibration Surface

Oversikt answers ONE question: **"What requires attention now?"**

It renders C1 calibration signals as actionable items. It is not a status center, report surface, or general dashboard. It contains exactly three block types:

### Block A: Status (calibration state)

- Readiness % vs `workspace_kpi_target` (plan vs actual)
- Open deviations count (unresolved exception state)
- Overdue items count (D3 rule evaluations past frequency)
- Critical controls status (gate rules with last evaluation outcome)

### Block B: Attention (calibration signals requiring intervention)

- Who is blocked (employees with expired or overdue assignments — D2 constraint active)
- What is missing (protocols without enough assigned employees — D3 gap)
- What is late (assignments past deadline — C1 overdue signal)
- What is risky (HACCP controls approaching threshold, declining readiness trend — C1 trend signal)

### Block C: Action (branch-appropriate responses)

- Assign training (D2 readiness formation action)
- Review deviation (D6/C1 exception path action)
- Log control (D6 manual execution action)
- Open inspection pack (evidence aggregation across all branches)

**Hard rule: anything that does not fit Status, Attention, or Action belongs in its respective surface.** Oversikt must never become a dump.

### Role Views

**Employee:** Readiness ring, next-action card, overdue alerts. Minimal. Calm. Shows only the employee's own C1 state.

**Admin/Manager:** Three-block layout. Drill-down on any item navigates to the correct branch surface:

- L1: KPI card on Oversikt ("3 employees missing Allergen protocol")
- L2: Click -> filtered list on readiness formation surface (those 3 employees)
- L3: Click employee -> their engine_state progress per assignment

Drill-down always leaves Oversikt. It navigates to where the work happens.

---

## 7. Drift — D6 Execution Surface

Drift renders D6 production state: session tasks, active execution, live evidence collection.

### Interaction Contract

| Property      | Value                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------- |
| Pacing        | Fast, task-oriented                                                                       |
| Content depth | `description` only (compact D6 instruction, not K training content)                       |
| Input types   | Checkbox, number input, photo, timestamp                                                  |
| Completion    | Binary: done or not done. Evidence captured in `session_task.evidence`                    |
| Deviation     | One-click flag with quick form. Creates `deviation` linked to task + procedure + protocol |
| Tone          | Direct, operational, zero fluff                                                           |

### What Employee Sees

Sorted by time, one task at a time. Each card: title, due time, priority badge, source icon, location badge. Tap to expand: compact description, input fields for evidence, complete button, deviation link.

**No tabs. No hierarchy. No policy types.** Just: what, when, do it, log it.

### What Admin/Manager Sees

- Session status per department (D6 lifecycle: upcoming -> active -> pending_signoff -> closed)
- Task completion rate per session
- Flagged deviations (inline C1 signals)
- Overdue tasks (D3 trigger evaluations past threshold)
- Filter: department, date, priority, category

### How Drift Differs from Opplaering (NON-NEGOTIABLE)

Same procedure step appears in both surfaces. They render completely differently because they serve different branches:

| Aspect           | Drift (D6 execution)                  | Opplaering (D2 readiness formation)               |
| ---------------- | ------------------------------------- | ------------------------------------------------- |
| Content shown    | `description` only                    | `description` + `training_content` + `media_urls` |
| Interaction      | Checkbox + input fields               | Read/watch + progressive steps                    |
| Completion means | "Task done, result logged" (evidence) | "Step understood, knowledge verified" (readiness) |
| Tone             | Operational, fast                     | Pedagogical, encouraging                          |
| AI role          | "Help me log this correctly"          | "Explain this to me"                              |
| Branch purpose   | Produce evidence                      | Form readiness                                    |

**Implementation rule:** Drift and Opplaering MUST use different component trees. Shared data hooks acceptable. Shared UI components not acceptable — they converge into ambiguity.

### D6 Data Sources

```
session_task
  -> filtered by: current session, assigned to current user or role
  -> sorted by: due_at ascending
  -> grouped by: department_session
  -> evidence captured in: session_task.evidence (jsonb)
```

### D6 Session Sign-off Gate

Session sign-off evaluates three conditions:

1. All `is_compliance_required` tasks completed
2. All critical `framework_rule` gate evaluations passing
3. All deviations at minimum acknowledged

If all pass: `signoff_type: "clean"`. If exceptions: `signoff_type: "with_exceptions"` with mandatory notes. If critical gate failing: sign-off BLOCKED until resolved.

---

## 8. Opplaering — D2 Readiness Formation Surface

Opplaering renders D2 readiness state: what the employee knows, what they need to learn, how far they've progressed.

### Interaction Contract

| Property      | Value                                                                        |
| ------------- | ---------------------------------------------------------------------------- |
| Pacing        | Progressive, self-directed                                                   |
| Content depth | Full `training_content` + `media_urls` + AI explanations (K layer content)   |
| Input types   | Quiz answers, confirmation checkbox, digital signature                       |
| Completion    | Staged via engine_process: understand -> practice -> test -> confirm -> done |
| Tone          | Encouraging, non-bureaucratic                                                |

### 5-Stage Learning Journey (engine_process: "learning-journey-v1")

This sequence is orchestrated by `engine_state` / `engine_state_step`, not client-side state. Each stage maps to an `engine_state_step` with a specific `action_type` and `action_payload`.

**Stage 1 — Understand** (K layer: absorb knowledge)

- Rich content: `training_content`, video, images from `procedure_step`
- AI available: "Explain this simpler" (C2 context query against K1b)

**Stage 2 — Practice** (K layer: walk through steps)

- Step-by-step walkthrough with media
- No evidence generated yet — this is knowledge formation

**Stage 3 — Test** (Evidence: prove knowledge)

- Knowledge test inline (quiz UI)
- Pass threshold enforced
- `knowledge_test_attempt` record created with score, answers, AI grading
- Failed: retry with AI guidance. Passed: unlocks next stage.

**Stage 4 — Confirm** (Evidence: acknowledge understanding)

- Confirmation text displayed
- Digital signature with checkbox, timestamp, device info
- `confirmation_signature` record created
- Cannot be retracted by employee (compliance requirement)

**Stage 5 — Done** (D2 readiness update)

- `protocol_assignment.status` -> "completed"
- Readiness score recalculated
- C1 calibration signal emitted if readiness crosses threshold
- Gamification points awarded

### What Employee Sees

Protocol list sorted by: overdue first, then in-progress, then not-started. Each card: name, progress ring, phase indicator (Learn | Test | Sign), estimated time, continue button.

### What Admin/Manager Sees

**Competence Matrix** — D2 readiness state visualized as person x protocol:

```
              HACCP  Hygiene  Allergen  Fire   Prep
Anna S.        OK     OK       OK       OK     OK    100%
Erik P.        OK     OK      60%       OK     --     60%
Lise M.        OK     OK       OK      80%     --     60%
Ole T.         OK    40%       --       OK     --     20%
```

Plus: department readiness aggregate, risk indicators (employees below eligibility threshold), quick actions (assign protocol, extend deadline, send reminder).

---

## 9. Dokumenter — K Knowledge Surface

Dokumenter renders K1a and K1b knowledge: the canonical text of every standard, procedure, policy, and handbook chapter.

### Two Entry Modes

**Browse mode** — "I'm looking for something."

- Left panel: tree navigation (max 3 levels: Policy -> Protocol -> Procedure)
- Search bar with full-text search (queries `workspace_doc_chunk` embeddings in K1b)
- Filter: tags, category, department, status

**Context mode** — "I arrived from a task / alert / deviation / assignment."

- Opens directly on the relevant document
- Breadcrumb: "Du kom hit fra: [source]"
- Back button returns to source context

### Document Rendering

Uses existing ChapterReader pattern (Tiptap `generateHTML()` + `prose` typography classes). Metadata header: status badge, owner, last updated, related policy/protocol, linked `framework_rule` with regulatory source reference.

### Action Bar — Documents Are Not Passive

Every document is a launchpad into other branches:

| Button           | Branch Action                                             | Visible to |
| ---------------- | --------------------------------------------------------- | ---------- |
| Start opplaering | Enter D2 readiness formation (5-stage flow)               | All        |
| Ta quiz          | Jump to evidence generation (knowledge test)              | All        |
| Signer           | Jump to evidence generation (confirmation)                | All        |
| Start oppgave    | Create D6 execution (session_task from procedure)         | Manager+   |
| Meld avvik       | Enter exception path (deviation linked to this procedure) | All        |
| Spor AI          | C2 context query (AI explains the procedure)              | All        |
| Rediger          | K1b knowledge mutation (Tiptap editor, C4 gated)          | Admin      |

### Content Sources

| Source                           | Branch  | Rendering                                 |
| -------------------------------- | ------- | ----------------------------------------- |
| `handbook_chapter` (Tiptap JSON) | K1b     | `generateHTML()` + prose classes          |
| `procedure` + `procedure_step`   | K1a/K1b | Steps as ordered list with descriptions   |
| `policy` statement + description | K1a/K1b | Prose block                               |
| `protocol` description           | K1a/K1b | Prose block with linked procedures listed |

---

## 10. Avvik — Exception Path Surface

Avvik renders the exception path: deviations originating in D6, measured by C1, resolved under C4 authority.

### Three-Level Deviation Linkage

A deviation participates in three branches simultaneously:

| Relation                                    | Branch | Purpose                                              |
| ------------------------------------------- | ------ | ---------------------------------------------------- |
| `source_task_id` -> session_task            | D6     | Where the deviation was detected (execution context) |
| `procedure_id` -> procedure                 | K      | Which standard was violated                          |
| `protocol_id` -> protocol                   | D3     | Which compliance domain it affects                   |
| `department_session_id`                     | D6     | When and where it happened (temporal context)        |
| `reconciliation_id` -> daily_reconciliation | C1     | How it was calibrated                                |

Single-level linking loses the multi-branch picture. "Fridge was 8C" is simultaneously a D6 task execution failure, a K procedure deviation, a D3 HACCP control failure, a D6 session event, a C1 calibration signal, and a C4-gated resolution item.

### Employee View

Minimal form: category, severity, description, photo, related procedure (auto-suggested from context). Anonymous reporting option available.

### Admin/Manager View

Deviation log with filters. Kanban view: Open | Assigned | In Progress | Resolved. Statistics: deviations by category trend, resolution time, repeat patterns. Batch actions: assign, escalate, close (all C4-gated).

---

## 11. Procedure Detail — Cross-Branch Control Plane

The Procedure Detail Page is where all branch state for a procedure converges. It is the canonical control plane — the single place to see knowledge content, rule linkages, execution history, evidence, and deviations for one procedure.

**Admin** sees all tabs and uses this as their management surface.
**Employee** rarely lands here directly. They enter via branch-specific wrappers: readiness formation (LearnFlow), execution (Drift checklist), knowledge (Documents reader).

### Tabs (Admin View)

| Tab         | Branch       | Content                                                                |
| ----------- | ------------ | ---------------------------------------------------------------------- |
| Oversikt    | Cross-branch | Metadata, status, assignment count, completion rate, linked rules      |
| Steg        | K            | Procedure steps with training_content, media, estimated time           |
| Quiz        | Evidence     | Knowledge tests: questions, pass rate, attempt history                 |
| Bekreftelse | Evidence     | Confirmations: who signed, when, pending signatures                    |
| Logg        | D6           | Execution history: session_tasks, completion timestamps, logged values |
| Avvik       | D6/C1        | Deviations linked to this procedure: open, resolved, trends            |
| Historikk   | K            | Version history, diffs between versions, change_proposal records       |

### Tabs (Employee View)

Oversikt (simplified), Steg, Quiz, Bekreftelse. Logg, Avvik, and Historikk hidden.

### Two Concepts (Non-Negotiable)

- **Procedure Detail** = cross-branch control plane (canonical data, all tabs, admin-oriented)
- **Procedure Experience** = branch-specific wrapper (LearnFlow for D2 readiness, Checklist for D6 execution, Reader for K knowledge)

Separate page components consuming same data hooks with completely different UIs.

---

## 12. AI Scope — V1 Jobs (Hard Scoped)

AI participates as C2 (Context & Interaction) with exactly 4 jobs in v1. Not "everywhere." Not "ambient." Four specific functions.

### Job 1: Explain Procedure (C2 -> K query)

Trigger: "Explain this simpler." Input: procedure step + employee language. Output: plain-language explanation from K1b context.

### Job 2: Answer Step Questions (C2 -> K query)

Trigger: Question during learning journey. Input: step context + question. Output: contextual answer from K1a/K1b.

### Job 3: Explain Why It Matters (C2 -> K1a regulatory context)

Trigger: "Why is this important?" Input: procedure + policy + framework_rule. Output: motivational explanation connecting the step to real consequences and regulatory requirements.

### Job 4: Help Write Deviation (C2 -> D6/D3 context)

Trigger: Employee starts deviation report. Input: partial description + task context. Output: suggested category, severity, related procedure, improved description.

### NOT in V1

Adaptive quiz, risk nudges, forecasting, remediation guidance, proactive nudges. These are Phase 4 (C2 intelligence amplification).

---

## 13. Completion Logic

### Status Definitions

| Status            | Definition                                                                         | Trigger                                                                     |
| ----------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **started**       | First engine_state_step activated                                                  | engine_state.current_step > 0                                               |
| **in_progress**   | At least one step completed, not all                                               | engine_state.current_step between 1 and max_steps                           |
| **completed**     | ALL components done: all steps, tests passed, confirmations signed                 | protocol_assignment.status = 'completed', engine_state.status = 'completed' |
| **overdue**       | Deadline passed without completion                                                 | Cron evaluates assigned_at + configured deadline                            |
| **eligible**      | All D3 gate rules for a position/task are satisfied                                | All required protocol_assignments completed for the gate rule's scope       |
| **compliant**     | All required protocols for a compliance domain completed by all assigned employees | Aggregate across framework scope                                            |
| **non-compliant** | Any required protocol in a domain has incomplete/expired assignments               | Inverse of compliant                                                        |

### Readiness Score

```
Employee readiness = (completed_assignments / total_assignments) * 100
Team readiness = average(employee_readiness for all team members)
Department readiness = average(employee_readiness for all department members)
```

Readiness is a deterministic function of `protocol_assignment` completion state. It is NOT a subjective assessment, NOT an authorization, and NOT an eligibility check on its own. It is a D2 signal that feeds C1 calibration and informs D3 eligibility evaluation.

---

## 14. Evidence Model

Evidence is distinct from telemetry, audit trail, and analytics. These are four separate concerns:

| Concern         | Purpose                                                         | Storage                                                                               | Example                                                     |
| --------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **Evidence**    | Compliance proof that a specific action was performed correctly | Domain tables (knowledge_test_attempt, confirmation_signature, session_task.evidence) | "Temperature was 3.2C at 10:14"                             |
| **Audit trail** | Who did what, when, with what authorization                     | activity_trail (from telemetry emit)                                                  | "User X completed task Y at Z"                              |
| **Telemetry**   | Workflow triggers and event routing                             | engine_event (from telemetry emit)                                                    | "session_task completed -> evaluate next engine_state_step" |
| **Analytics**   | Business intelligence and pattern detection                     | PostHog (from telemetry emit)                                                         | "Average training completion time: 12 days"                 |

Do not blur these. A `session_task.evidence` jsonb entry is evidence. An `activity_trail` row is audit. An `engine_event` row is a workflow trigger. A PostHog event is analytics. They may originate from the same `emit()` call but serve fundamentally different purposes.

### Evidence Types

| Type              | Data Source                                     | Stored In                            |
| ----------------- | ----------------------------------------------- | ------------------------------------ |
| Quiz pass         | knowledge_test_attempt (score, passed, answers) | knowledge_test_attempt               |
| Digital signature | confirmation_signature (signed_at, device_info) | confirmation_signature               |
| Task completion   | session_task (completed_at, completed_by)       | session_task                         |
| Measured value    | session_task.evidence (temperature, weight)     | session_task.evidence jsonb          |
| Photo             | session_task.evidence or deviation.attachments  | Supabase Storage + jsonb reference   |
| Version history   | Protocol versioning                             | protocol_assignment.protocol_version |

### Inspection Pack

Aggregates all evidence for a compliance domain (filtered by `regulatory_framework`):

- All framework_rule evaluations with outcomes
- All session_task completions with evidence
- All deviations with resolution status
- All employee certifications (test passes + signatures)
- All version history (proves procedures are maintained)

This is the "Mattilsynet-knapp" — the compliance proof surface.

---

## 15. Role Gates

### Permission Matrix

Roles: `employee | manager | admin | owner` (from `profile_role` enum). Team leadership is a team attribute (`team.leader_profile_id`), not a role. Team leaders get elevated view for own team via `isTeamLeader()` check.

All HMS mutations are C4-gated via `engine_authority_config`.

| Action                    | Employee | Team Leader\* | Manager | Admin/Owner |
| ------------------------- | -------- | ------------- | ------- | ----------- |
| View own assignments      | Yes      | Yes           | Yes     | Yes         |
| Complete training steps   | Yes      | Yes           | Yes     | Yes         |
| Take quiz                 | Yes      | Yes           | Yes     | Yes         |
| Sign confirmation         | Yes      | Yes           | Yes     | Yes         |
| Complete session tasks    | Yes      | Yes           | Yes     | Yes         |
| Report deviation          | Yes      | Yes           | Yes     | Yes         |
| View team readiness       | No       | Own team      | Yes     | Yes         |
| View department readiness | No       | No            | Yes     | Yes         |
| View competence matrix    | No       | Own team      | Yes     | Yes         |
| Assign training           | No       | No            | Yes     | Yes         |
| Create/edit procedures    | No       | No            | No      | Yes         |
| Create/edit policies      | No       | No            | No      | Yes         |
| Review deviations         | No       | Own team      | Yes     | Yes         |
| Close deviations          | No       | No            | Yes     | Yes         |
| Edit handbook documents   | No       | No            | No      | Yes         |
| View inspection pack      | No       | No            | Yes     | Yes         |
| Manage templates          | No       | No            | No      | Yes         |
| Waive assignment          | No       | No            | Yes     | Yes         |

### Role Rendering

Same URL, different component rendering based on `isAdminMode` from DashboardContext plus role from workspace context. Employee sees guided branch-specific flows. Manager+ sees cross-branch oversight.

---

## 16. Entry Points

| Entry Point                | Target Surface         | Context Passed                             |
| -------------------------- | ---------------------- | ------------------------------------------ |
| Sidebar "HMS"              | Oversikt (C1)          | None                                       |
| Sub-nav tab                | Any surface            | None                                       |
| KPI card drill-down        | Training/Drift/Avvik   | Filter preset                              |
| Alert card                 | Relevant surface       | Item ID                                    |
| Session task tap           | Drift (D6)             | task_id                                    |
| "Continue training"        | Opplaering (D2)        | assignment_id, resume at engine_state step |
| Document tree click        | Dokumenter (K)         | document_id                                |
| Task -> "Report deviation" | Avvik (exception path) | source_task_id, procedure_id               |
| Deviation alert            | Avvik                  | deviation_id                               |
| AI suggestion              | Relevant surface       | procedure_id + context                     |
| Push notification          | Relevant surface       | Deep link with item_id                     |

---

## 17. Schema & Data Architecture

### 17.1 Entity Relationship Map

```
GOVERNANCE LAYER (content authoring)
==============================================================
policy ─────────────────┐
  policy_id (PK)        │
  workspace_id (FK)     │  1:N
  policy_type (enum)    │
  name, statement       │
                        ▼
              protocol ─────────────────┐
                protocol_id (PK)       │
                policy_id (FK)         │  1:N
                workspace_id (FK)      │
                status (enum)          │
                version                │
                                       ▼
                    ┌─── procedure ◄──────── session_hook
                    │      procedure_id (PK)    linked_procedure_id (FK)
                    │      protocol_id (FK)     department_id (FK)
                    │      procedure_type        hook_type (enum)
                    │                            trigger_offset_min
                    │
                    ├─── knowledge_test
                    │      knowledge_test_id (PK)
                    │      protocol_id (FK)
                    │      questions (jsonb)
                    │      pass_threshold
                    │
                    └─── confirmation
                           confirmation_id (PK)
                           protocol_id (FK)
                           confirmation_text


ASSIGNMENT LAYER (per-employee tracking)
==============================================================
protocol_assignment ──────────────────────────────────┐
  assignment_id (PK)                                  │
  profile_id (FK) ◄──── profile                       │
  protocol_id (FK) ◄──── protocol                     │
  status: pending | completed | expired               │
  assigned_at, completed_at                           │
                                                      │  1:N
  ┌───────────────────────────────────────────────────┘
  │
  ├── procedure_step_completion
  │     procedure_step_id (FK) ◄── procedure_step
  │     profile_id (FK)
  │     protocol_assignment_id (FK)
  │     completed_at, evidence (json)
  │
  ├── knowledge_test_attempt
  │     knowledge_test_id (FK)
  │     profile_id (FK)
  │     protocol_assignment_id (FK)
  │     score, passed, answers (jsonb)
  │
  └── confirmation_signature
        confirmation_id (FK)
        profile_id (FK)
        protocol_assignment_id (FK)
        signed_at, device_info, signature_data


CASCADE D3 LAYER (regulatory rules)
==============================================================
regulatory_framework ──────────┐
  framework_id (PK)            │
  code: "ik-mat-no-2025"       │  1:N
  industry: "hospitality"      │
  jurisdiction: "NO"           │
  workspace_id: NULL (K1a)     │
                               ▼
          framework_rule ──────────────────────────┐
            rule_id (PK)                           │
            framework_id (FK)                      │  N:1
            rule_type: gate|constraint|advisory    │
            category: "food_safety"                │
            evaluation_config (jsonb):             │
              linked_procedure_id ─────────────────┼──► procedure
              check_type, min, max, unit           │
              frequency_minutes                    │
            severity, source_reference             │
                                                   │
          framework_trigger ───────────────────────┘
            trigger_id (PK)                 links via
            framework_id (FK)               linked_rule_ids[]
            trigger_mode: reactive|scheduled
            evaluation_config (jsonb):
              condition, threshold
              action: create_session_task
              escalation: create_deviation


CASCADE D6 LAYER (production execution)
==============================================================
department_session ────────────────┐
  session_id (PK)                  │
  department_id (FK)               │  1:N
  date, status (enum)              │
  signed_off_by, signoff_type      │
                                   ▼
          session_task ────────────────────────────┐
            id (PK)                                │
            department_session_id (FK)             │
            session_hook_id (FK, nullable)         │
            assigned_to (FK -> profile, nullable)  │
            status: pending|available|in_progress  │
                    |completed|skipped|overdue     │
            title, description                     │
            evidence (json)                        │
            is_compliance_required (bool)           │
            completed_by (FK), completed_at        │
            workspace_id (FK)                      │
                                                   │
            ┌──── PHASE 2 ADDITIONS ──────────────┤
            │  due_at (timestamptz)                │
            │  priority: critical|high|normal|low  │
            │  source_type: hook|ad_hoc|inherited  │
            │       |routine                       │
            └──────────────────────────────────────┘


CASCADE C1 LAYER (calibration)
==============================================================
daily_reconciliation
  reconciliation_id (PK)
  department_id (FK)
  session_id (FK) ◄──── department_session
  reconciliation_date

workspace_kpi_target
  id (PK)
  workspace_id (FK)
  metric: "team_readiness_percent"
  target_value: 90
  benchmark_value (nullable)


CASCADE C4 LAYER (governance/authority)
==============================================================
engine_authority_config
  id (PK)
  workspace_id (FK)
  capability: "hms.assign_training" | "hms.close_deviation" | ...
  level: "employee" | "manager" | "admin" | "owner"
  UNIQUE(workspace_id, capability)

change_proposal (for procedure edits, Phase 2+)
  change_proposal_id (PK)
  workspace_id (FK)
  trigger_entity_type: "procedure"
  trigger_entity_id (FK) ◄──── procedure
  changes (jsonb)
  status: proposed|approved|applied|rejected
  framework_trigger_id (FK, nullable)
  approval_required (bool)


DEVIATION (exception path)
==============================================================
public.deviation (existing table)
  deviation_id (PK)
  workspace_id (FK)
  department_id (FK, nullable)
  session_id (FK) ◄──── department_session
  domain: safety|customer|procedure|system|material
  severity: low|medium|high|critical
  status: open|acknowledged|resolved|escalated
  title, description
  reported_by (FK -> profile)
  resolved_by (FK -> profile), resolved_at
  resolution_notes
  attachments (json)
  blocks_day_approval (bool)
  reconciliation_id (FK) ◄──── daily_reconciliation
  ──── PHASE 2 ADDITIONS:
  procedure_id (FK) ◄──── procedure
  protocol_id (FK) ◄──── protocol
  source_task_id (FK) ◄──── session_task
  assigned_to (FK -> profile)
  closure_record (jsonb)

NOTE: payroll.deviation is a SEPARATE table for payroll-specific deviations.


ENGINE LAYER (workflow orchestration)
==============================================================
engine_process (blueprint, platform-level)
  id (PK)
  name: "learning-journey-v1"
  max_steps: 5
  workspace_id: NULL (platform blueprint)

engine_state (one per protocol_assignment)
  id (PK)
  process_id (FK) ◄──── engine_process
  workspace_id (FK)
  assignee_id (FK) ◄──── profile
  entity_type: "protocol_assignment"
  entity_id (FK) ◄──── protocol_assignment.assignment_id
  status: "active" | "completed" | "failed"
  current_step: integer
  context (jsonb)
  started_at, completed_at

engine_state_step (5 per learning journey state)
  id (PK)
  state_id (FK) ◄──── engine_state
  step_order: 1-5
  action_type: "wait_for_event" | "assign_task" | "validate_settlement"
  action_payload (jsonb)
  status: "pending" | "active" | "completed" | "skipped"
  completed_at, completed_by


KNOWLEDGE LAYER
==============================================================
workspace_doc_chunk (K1b, pgvector)
  id (PK), workspace_id (FK)
  content, embedding (vector), metadata (jsonb)

engine_memory (K1b, learned patterns)
  id (PK), workspace_id (FK)
  content, embedding (vector), metadata (jsonb)
```

### 17.2 procedure_step Extended Schema

```sql
procedure_step
  step_id          uuid PK
  procedure_id     uuid FK -> procedure
  title            text NOT NULL
  description      text NOT NULL       -- D6 execution content (compact)
  training_content text                -- D2 readiness formation content (rich, markdown)
  media_urls       jsonb               -- [{type: "image"|"video", url, caption}]
  estimated_minutes integer
  is_required      boolean DEFAULT true
  step_order       integer DEFAULT 0
  created_at       timestamptz
  updated_at       timestamptz
```

### 17.3 framework_rule.evaluation_config JSON Schema

```jsonc
// HACCP temperature control (D3 gate rule)
{
  "check_type": "range",
  "min": 0, "max": 4, "unit": "celsius",
  "frequency_minutes": 240,
  "linked_procedure_id": "<uuid>",
  "control_point_name": "Walk-in cooler",
  "equipment_id": "<uuid>",
  "auto_create_task": true,
  "deviation_on_fail": true
}

// Training requirement gate (D3 -> D2 constraint)
{
  "check_type": "protocol_completion",
  "required_protocol_ids": ["<uuid>"],
  "scope": "position",
  "scope_id": "<uuid>",
  "blocks_scheduling": true
}

// Document acknowledgment (D3 -> evidence requirement)
{
  "check_type": "confirmation_signed",
  "confirmation_id": "<uuid>",
  "max_age_days": 365,
  "scope": "workspace"
}
```

### 17.4 engine_state_step.action_payload — Learning Journey

```jsonc
// Step 1: Understand (K absorption)
{ "stage": "understand", "procedure_id": "<uuid>", "expected_action": "view_training_content", "min_time_seconds": 30 }

// Step 2: Practice (K walkthrough)
{ "stage": "practice", "procedure_id": "<uuid>", "expected_action": "complete_all_steps", "step_ids": ["<uuid>"] }

// Step 3: Test (evidence generation)
{ "stage": "test", "knowledge_test_id": "<uuid>", "expected_action": "pass_test", "pass_threshold": 80 }

// Step 4: Confirm (evidence generation)
{ "stage": "confirm", "confirmation_id": "<uuid>", "expected_action": "sign_confirmation" }

// Step 5: Done (D2 readiness update)
{ "stage": "done", "assignment_id": "<uuid>", "expected_action": "mark_assignment_completed", "emit_event": "protocol completed" }
```

### 17.5 Join Paths

**C1 calibration surface (Oversikt IK-Mat):**

```sql
SELECT fr.rule_id, fr.code, fr.category, fr.evaluation_config, fr.severity
FROM framework_rule fr
JOIN regulatory_framework rf ON fr.framework_id = rf.framework_id
WHERE rf.code = 'ik-mat-no-2025' AND rf.is_active = true;
```

**D2 readiness vs C1 target:**

```sql
SELECT p.profile_id,
  COUNT(*) FILTER (WHERE pa.status = 'completed') AS completed,
  COUNT(*) AS total
FROM protocol_assignment pa
JOIN protocol pr ON pa.protocol_id = pr.protocol_id
WHERE pr.workspace_id = $workspace_id
GROUP BY p.profile_id;
```

**D6 execution surface (Drift tasks):**

```sql
SELECT st.* FROM session_task st
JOIN department_session ds ON st.department_session_id = ds.session_id
WHERE ds.date = CURRENT_DATE
  AND ds.status IN ('active', 'upcoming')
  AND (st.assigned_to = $profile_id OR st.assigned_to IS NULL)
  AND st.status IN ('pending', 'available', 'in_progress')
ORDER BY st.created_at;
```

**K surface (Documents with rule linkage):**

```sql
SELECT p.*, fr.code AS rule_code, fr.severity, fr.source_reference, rf.name AS framework_name
FROM procedure p
LEFT JOIN framework_rule fr ON fr.evaluation_config->>'linked_procedure_id' = p.procedure_id::text
LEFT JOIN regulatory_framework rf ON fr.framework_id = rf.framework_id;
```

### 17.6 I1 Bootstrap Seed Data

| Table                  | Content                                                       | Count  |
| ---------------------- | ------------------------------------------------------------- | ------ |
| `regulatory_framework` | IK-mat NO, HMS NO, Fire Safety NO                             | 3      |
| `framework_rule`       | HACCP gates, hygiene constraints, training gates, fire safety | ~15-25 |
| `framework_trigger`    | Overdue check triggers, escalation triggers                   | ~10-15 |
| `engine_process`       | "learning-journey-v1" blueprint                               | 1      |
| `procedure` templates  | Temperature check, cleaning, allergen, fire drill             | ~10-15 |
| `policy` templates     | HACCP, hygiene, fire safety, HR onboarding                    | ~5-8   |
| `protocol` templates   | One per policy                                                | ~5-8   |

Seed SQL: `supabase/templates/restaurant/` applied via `_apply.sql` during workspace onboarding.

### 17.7 Migration Sequence

| Phase | Migration                                                                               | Tables               |
| ----- | --------------------------------------------------------------------------------------- | -------------------- |
| 1     | Add training_content + media_urls to procedure_step                                     | procedure_step       |
| 1     | Seed engine_process "learning-journey-v1"                                               | engine_process       |
| 1     | Seed workspace_kpi_target readiness default                                             | workspace_kpi_target |
| 2     | Add due_at, priority, source_type to session_task                                       | session_task         |
| 2     | Add procedure_id, protocol_id, source_task_id, assigned_to, closure_record to deviation | deviation            |
| 2     | Extend deviation_status enum                                                            | deviation_status     |
| 3     | Seed regulatory_framework + framework_rule + framework_trigger for IK-mat               | D3 tables            |
| 3     | Add framework_trigger_id FK to session_hook                                             | session_hook         |

---

## 18. Telemetry

Every mutation emits via `@smartout/telemetry` `emit()`. Events route to four destinations with distinct purposes:

| Destination     | Purpose                             | Is NOT    |
| --------------- | ----------------------------------- | --------- |
| PostHog         | Analytics and pattern detection     | Evidence  |
| Logger (stdout) | Operational debugging               | Audit     |
| activity_trail  | Audit trail (who did what when)     | Evidence  |
| engine_event    | Workflow triggers (engine-dispatch) | Analytics |

Existing events (use as-is):

```typescript
emit("session_task completed", { taskId, procedureId, sessionId, profileId });
emit("protocol step_completed", { assignmentId, stepId, profileId });
emit("protocol test_submitted", { testId, assignmentId, score, profileId });
emit("protocol confirmation_signed", { confirmationId, assignmentId, profileId });
emit("protocol completed", { assignmentId, protocolId, profileId });
```

New events (must register in `SmartoutEvent` type + `EVENT_ROUTING`):

```typescript
emit("deviation created", { deviationId, procedureId, protocolId, severity });
emit("deviation resolved", { deviationId, resolvedBy, correctiveAction });
emit("readiness updated", { profileId, readinessPercent, departmentId });
emit("framework_rule evaluated", { ruleId, frameworkId, outcome, procedureId });
```

Event naming: flat `"noun verb"` convention per existing registry.

---

## 19. Phasing by Branch Maturation

### Phase 1: K + D2 + C1 Legibility

**Branch activation:** Knowledge surfaces readable. Readiness formation functional. Calibration surface operational.

**Ship:**

- Route shell: `/dashboard/hms/*` with sub-nav
- C1 calibration surface (Oversikt): status, attention, action blocks
- K knowledge surface (Dokumenter): action-linked, browse + context modes
- D2 readiness formation surface (Opplaering): 5-stage flow + competence matrix
- Cross-branch control plane (Procedure Detail): admin tabs + employee experience wrapper
- Migration: procedure_step training columns
- Seed: engine_process blueprint, workspace_kpi_target default

**Why first:** The operating fabric exists in the database. Users cannot see it. Phase 1 makes it legible.

**Pragmatic compromise:** Learning journey may use client-side state for speed, but MUST shadow-write engine_state records. Phase 2 makes engine_state authoritative.

### Phase 2: D6 Execution Activation

**Branch activation:** Production execution surface live. Evidence collection flowing. Exception path active.

**Ship:**

- D6 execution surface (Drift): task UI, session task rendering, checklist completion, evidence capture
- D6 routine logging: completion_data input (temperature, measurements)
- D6 triggered session tasks: hooks fire procedures at scheduled times
- Exception path surface (Avvik): employee deviation form + admin management view
- Migration: session_task execution metadata, deviation HMS columns + enum extension

**Why second:** Without D6 execution, compliance is documentation without operational proof. This phase produces the evidence that C1 needs.

### Phase 3: D3 Compliance Formalization

**Branch activation:** D3 rules evaluable. Framework-driven compliance operational. Inspection readiness complete.

**Ship:**

- D3 framework seed: regulatory_framework + framework_rule + framework_trigger for IK-mat
- D3 rule evaluation engine: automatic task generation from triggers, automatic deviation from gate failures
- C1 evidence aggregation: all evidence for a compliance domain over time
- Inspection pack surface (Mattilsynet-knapp): compliance proof aggregation
- Manager remediation workflows: corrective action assignment, resolution tracking
- Migration: session_hook -> framework_trigger linkage

**Why third:** D3 rules require D6 execution data (Phase 2) to evaluate against. Cannot formalize compliance without operational data flowing.

### Phase 4: C2 + C4 Intelligence Amplification

**Branch activation:** C2 contextual intelligence active. C4 advanced governance. K1b learning loop closing.

**Ship:**

- C2 AI coaching inside readiness formation flow (4 V1 jobs expanded)
- C2 adaptive quizzes (difficulty from K1b learned patterns)
- C2 AI-generated explanations (per employee language/level)
- C1 risk nudges (declining readiness, repeated deviations)
- C1 readiness forecasting (will team be ready for next week?)
- C4 advanced change proposal workflows

**Why last:** Intelligence requires data. Phases 1-3 generate it. Phase 4 makes the system learn.

---

## 20. Required Migrations

### Phase 1

```sql
ALTER TABLE procedure_step ADD COLUMN training_content text;
ALTER TABLE procedure_step ADD COLUMN media_urls jsonb;
```

### Phase 2

```sql
ALTER TABLE session_task ADD COLUMN due_at timestamptz;
ALTER TABLE session_task ADD COLUMN priority text CHECK (priority IN ('critical','high','normal','low')) DEFAULT 'normal';
ALTER TABLE session_task ADD COLUMN source_type text CHECK (source_type IN ('hook','ad_hoc','inherited','routine'));

ALTER TABLE deviation ADD COLUMN procedure_id uuid REFERENCES procedure(procedure_id);
ALTER TABLE deviation ADD COLUMN protocol_id uuid REFERENCES protocol(protocol_id);
ALTER TABLE deviation ADD COLUMN source_task_id uuid REFERENCES session_task(task_id);
ALTER TABLE deviation ADD COLUMN assigned_to uuid REFERENCES profile(profile_id);
ALTER TABLE deviation ADD COLUMN closure_record jsonb;

ALTER TYPE deviation_status ADD VALUE 'assigned';
ALTER TYPE deviation_status ADD VALUE 'in_progress';
ALTER TYPE deviation_status ADD VALUE 'closed';
ALTER TYPE deviation_status ADD VALUE 'reopened';
```

### Phase 3

```sql
-- Seed regulatory_framework, framework_rule, framework_trigger via I1 bootstrap
-- Add framework_trigger linkage to session_hook
ALTER TABLE session_hook ADD COLUMN framework_trigger_id uuid REFERENCES framework_trigger(trigger_id);
```

Deviation table strategy: single table with `domain` enum filter (recommended). payroll.deviation remains separate.

---

## 21. Exclusions

- No mobile app changes in Phase 1 (data hooks in `packages/` for mobile parity)
- No sensor integrations (Phase 3+)
- No Stripe/billing changes
- No multi-workspace federation
- No PDF export (inspection pack is web-view first)

---

## 22. Resolved Questions

1. **Deviation table:** EXISTS but insufficient for three-level linkage. Migration in Phase 2.
2. **Handbook chapters:** EXISTS in `handbook_chapter` table. ChapterReader renders it.
3. **HACCP control points:** `haccp_log` exists for logging. Control point definitions to be seeded as `framework_rule` entries in Phase 3.
4. **Readiness calculation:** Client-computed for Phase 1. Materialized server-side in Phase 3.
5. **Anonymous deviations:** Service-role Edge Function with `reporter_id = null`. RLS policy permits null reporter.

---

## 23. Open Questions

1. **Deviation table strategy:** Single table with `domain` filter (recommended) or separate `hms_deviation`? Needs ADR.
2. **Telemetry naming:** Flat `"noun verb"` convention confirmed. New events must be registered. Needs ADR if namespace change desired.

---

## Appendix A: Component Boundary Rules

### MUST be separate component trees

| Boundary                                        | Why                                                        |
| ----------------------------------------------- | ---------------------------------------------------------- |
| Drift step renderer vs Opplaering step renderer | Different branches: D6 execution vs D2 readiness formation |
| Employee Oversikt vs Admin Oversikt             | Different C1 calibration granularity                       |
| Procedure Detail vs Procedure Experience        | Cross-branch control plane vs branch-specific wrapper      |

### Data hooks (in `packages/hms/` for mobile parity)

| Hook                              | Surfaces                              | Status                                 |
| --------------------------------- | ------------------------------------- | -------------------------------------- |
| `useAssignedProtocols(profileId)` | Opplaering + Oversikt                 | EXISTS (in apps/web, move to packages) |
| `useGovernanceOverview()`         | Oversikt (refactor for domain filter) | EXISTS                                 |
| `useProcedureSteps(procedureId)`  | All surfaces + Procedure Detail       | NEW                                    |
| `useSessionTasks(sessionId)`      | Drift + Oversikt                      | NEW                                    |
| `useDeviations(filters)`          | Avvik + Procedure Detail + Oversikt   | NEW                                    |
| `useReadinessScore(profileId)`    | Oversikt + Opplaering                 | NEW                                    |

---

## Appendix B: Competitor Reference

| Capability       | eSmiley                | Runwell          | Smartout                                                                          |
| ---------------- | ---------------------- | ---------------- | --------------------------------------------------------------------------------- |
| Compliance model | Log controls, document | Checklist-driven | Cascade governing loop: knowledge -> rule -> execution -> evidence -> calibration |
| Training         | External courses       | Basic integrated | D2 readiness formation with engine_process orchestration                          |
| Deviations       | Per-product            | Centralized      | Three-level branch-linked (D6 + K + D3)                                           |
| Documents        | Documentation hub      | Basic            | Action-linked K-layer surface                                                     |
| AI               | None                   | None             | C2 context intelligence (4 scoped jobs)                                           |
| Employee UX      | Checklists             | Checklists       | Branch-specific guided flows                                                      |
| Readiness        | None                   | Basic completion | D2 schedulable capacity constraint                                                |
| Inspection       | "Smilefjesgaranti"     | "Kontrollknapp"  | Evidence aggregation across all branches                                          |

Category-defining position: **compliance as a byproduct of the governing loop running well**, not logged documentation.
