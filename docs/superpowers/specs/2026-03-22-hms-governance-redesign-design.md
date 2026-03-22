---
title: "HMS Governance Redesign — Intent-Driven Procedure Surfaces"
status: draft
created: 2026-03-22
updated: 2026-03-22
module: hms
tags: [hms, governance, ik-mat, training, compliance, procedures, ux-architecture]
---

# HMS Governance Redesign — Intent-Driven Procedure Surfaces

## 1. Core Principle

**Procedure = atomic operational truth. Everything else is a UX lens.**

The database model says "everything is a procedure." The user experience must say "here is what I need to do now, here is what I need to learn, here is the proof that we are compliant."

Users do not think in policies, protocols, or assignments. They think:

- What do I need to do now?
- How do I do this correctly?
- Am I done?
- Can I prove it?
- What happens if something goes wrong?

The product is organized around **user intent**, not schema entities.

### System Identity per Surface

| Surface    | System Name            | Intent                            | Core Question                  |
| ---------- | ---------------------- | --------------------------------- | ------------------------------ |
| Oversikt   | Attention system       | What requires action now?         | "Hva trenger oppmerksomhet?"   |
| Drift      | Execution system       | Do the task correctly, log result | "Hva skal jeg gjore na?"       |
| Opplaering | Capability system      | Learn, verify, become ready       | "Hva ma jeg laere?"            |
| Dokumenter | Source-of-truth system | Read the canonical text           | "Hva star det egentlig?"       |
| Avvik      | Exception system       | Report, track, resolve            | "Noe gikk galt — hva gjor vi?" |

### The Moat

Smartout turns compliance into trained behavior, not just logged documentation.

- eSmiley: log controls, document compliance, pass inspection
- Smartout: teach the standard, operationalize it, verify behavior, prove execution, catch deviations early, improve readiness continuously

Compliance is a **byproduct** of competence and execution.

---

## 2. Information Architecture

### Routing

```
/dashboard/hms                    -> Oversikt (attention system)
/dashboard/hms/drift              -> Drift (execution system)
/dashboard/hms/training           -> Opplaering (capability system)
/dashboard/hms/documents          -> Dokumenter (source-of-truth system)
/dashboard/hms/deviations         -> Avvik (exception system)
/dashboard/hms/procedure/[id]     -> Procedure Detail (canonical control plane)
```

### Navigation

HMS page gets a horizontal sub-nav (tabs) below the page header. Same pattern as `/dashboard/season`. Sidebar link "HMS" points to `/dashboard/hms`.

### IK-Mat Positioning

IK-Mat is initially implemented as a **scoped compliance lens** across Oversikt, Drift, Dokumenter, and Avvik. It filters procedures by `policy_type: haccp | safety` and shows HACCP-specific metadata (control points, temperature thresholds, critical limits).

IK-Mat does NOT get its own route in v1. However, the architecture preserves the option to elevate it into a dedicated route (`/dashboard/hms/ik-mat`) if product complexity or market positioning later demands it. This means:

- All IK-Mat-relevant data queries accept a `domain` filter parameter
- Components that render HACCP-specific views are isolated and recomposable
- The sub-nav component supports dynamic tab injection

### Migration from Current Pages

| Current                  | Becomes                                                                     |
| ------------------------ | --------------------------------------------------------------------------- |
| `/dashboard/governance`  | Redirect to `/dashboard/hms`                                                |
| `/dashboard/my-training` | Kept as employee shortcut; shares data hooks with `/dashboard/hms/training` |
| Document Mode (handbook) | Integrated into `/dashboard/hms/documents`                                  |

### Data Flow — One Engine, Five Lenses

```
procedure (atomic truth)
    |
    +-- policy_type filter ---------> which surface shows it
    |     haccp, safety              -> Drift (IK-Mat tasks) + Oversikt (compliance)
    |     hr, operational            -> Opplaering + Drift
    |     custom                     -> Dokumenter
    |     *                          -> Dokumenter (all procedures visible)
    |
    +-- protocol_assignment --------> Opplaering (per employee readiness)
    |
    +-- session_task ---------------> Drift (today's execution)
    |     source: hook | ad_hoc | inherited | routine
    |
    +-- deviation ------------------> Avvik (exception tracking)
    |     linked to: task + procedure + protocol
    |
    +-- handbook_chapter -----------> Dokumenter (readable handbook)
    |
    +-- knowledge_test_attempt -----> Opplaering (quiz results)
    +-- confirmation_signature -----> Opplaering (sign-off records)
    +-- procedure_step_completion --> Opplaering + Drift (step tracking)
```

---

## 3. Oversikt — Attention System

### Strict Definition

Oversikt answers ONE question: **"What requires attention now?"**

It is NOT a complete status center, report surface, or general overview. It contains exactly three types of blocks:

### Block A: Status (what is the current state?)

- Readiness % (team/department aggregate)
- Open deviations count
- Overdue items count
- Critical controls status (HACCP control points with last logged value)

### Block B: Attention (what is wrong or at risk?)

- Who is blocked (employees with expired or overdue assignments)
- What is missing (protocols without enough assigned employees)
- What is late (assignments past deadline)
- What is risky (HACCP controls approaching threshold, declining readiness trends)

### Block C: Action (what can I do right now?)

- Assign training (quick-assign protocol to employee/team)
- Review deviation (open deviation requiring manager action)
- Log control (manual HACCP check entry)
- Open inspection pack (Mattilsynet-ready export of all compliance evidence)

**Hard rule: anything that does not fit A, B, or C belongs in its respective surface tab.** Oversikt must never become a dashboard dump.

### Role Views

**Employee:** "Du er 73% klar. 2 ting gjenstar." — readiness ring, next-action card, overdue alerts. Minimal. Calm. Encouraging.

**Admin/Manager:** Three-block layout (Status | Attention | Action). Drill-down on any item navigates to the relevant surface tab.

### Three-Layer Drill-Down

- **L1:** KPI card on Oversikt (e.g., "3 ansatte mangler Allergensikkerhet")
- **L2:** Click -> filtered list on Training tab showing those 3 employees
- **L3:** Click employee -> their protocol assignments with step-by-step progress

Drill-down always navigates to the correct tab, never stays on Oversikt.

---

## 4. Drift — Execution System

### Intent

"Utfor oppgaven korrekt na. Logg resultatet. Ga videre."

### Interaction Contract

Drift is about **doing**, not learning. The UX contract is:

| Property      | Value                                           |
| ------------- | ----------------------------------------------- |
| Pacing        | Fast, task-oriented                             |
| Content depth | Compact description only (not training_content) |
| Input types   | Checkbox, number input, photo, timestamp        |
| Completion    | Binary: done or not done                        |
| Deviation     | One-click flag with quick form                  |
| Tone          | Direct, operational, zero fluff                 |

### What Employee Sees

"Dine oppgaver i dag" — sorted by time, one at a time.

Each task card shows:

- Task title
- Due time
- Priority badge (critical/high/normal/low)
- Source icon (hook/ad-hoc/recurring/inherited)
- Location/zone badge

Tap to expand:

- Description (from procedure step, compact)
- Input fields (if task requires logged value)
- "Fullfor" button
- "Meld avvik" link

**No tabs. No hierarchy. No policy types. Just: what, when, do it.**

### What Admin/Manager Sees

- Session status per department (upcoming/active/pending_signoff/closed)
- Task completion rate (progress bar per session)
- Flagged deviations (inline alerts)
- Overdue tasks (sorted to top)
- Filter: department, date, priority, category

### How Drift Differs from Opplaering (CRITICAL)

Same procedure step can appear in both surfaces. They MUST render differently:

| Aspect            | Drift                        | Opplaering                                        |
| ----------------- | ---------------------------- | ------------------------------------------------- |
| Content shown     | `description` only           | `description` + `training_content` + `media_urls` |
| Interaction       | Checkbox + input fields      | Read/watch + "Neste" progression                  |
| Completion means  | "Task done, result logged"   | "Step understood, knowledge verified"             |
| Tone              | Operational, fast            | Pedagogical, encouraging                          |
| AI role           | "Help me log this correctly" | "Explain this to me"                              |
| Progress language | "X av Y oppgaver fullfort"   | "Du har laert X av Y steg"                        |

**Implementation rule:** Drift and Opplaering MUST use different component trees for rendering procedure steps. Shared data hooks are fine. Shared UI components are NOT — they will inevitably converge into one ambiguous experience.

### Data Sources

```
session_task (source_type: hook | ad_hoc | inherited | routine)
    -> filtered by: current session, assigned to current user or role
    -> sorted by: due_at ascending
    -> grouped by: department session
```

### Telemetry

Every task completion emits via `@smartout/telemetry`:

- `task.completed` -> PostHog (analytics) + activity_trail (audit) + engine_event (workflow)
- `task.deviation_flagged` -> same destinations + triggers deviation workflow
- `task.overdue` -> engine_event (escalation trigger)

---

## 5. Opplaering — Capability System

### Intent

"Forsta. Memorer. Verifiser forstaelse. Bli klar."

### Interaction Contract

| Property      | Value                                                |
| ------------- | ---------------------------------------------------- |
| Pacing        | Progressive, self-directed                           |
| Content depth | Full training_content + media_urls + AI explanations |
| Input types   | Quiz answers, confirmation checkbox, signature       |
| Completion    | Staged: understand -> practice -> verify -> confirm  |
| Tone          | Encouraging, non-bureaucratic, "du laerer dette"     |

### 5-Stage User Journey (per procedure)

This sequence MUST be explicit in the UX, not implicit.

**Stage 1 — Understand**

- "Hva dette handler om" — intro text, why it matters
- Rich content: training_content, video, images
- AI available: "Forklar dette enklere"

**Stage 2 — Practice/Verify**

- Step-by-step walkthrough with media
- AI Q&A: "Hvorfor er dette viktig?"
- No completion tracking yet — this is learning

**Stage 3 — Test**

- Knowledge test inline (quiz UI)
- Pass threshold enforced
- Failed: "Prove igjen" with AI guidance on weak areas
- Passed: unlocks next stage

**Stage 4 — Confirm**

- Confirmation text displayed
- Checkbox: "Jeg bekrefter at jeg har lest og forstatt"
- Digital signature (if required)
- Timestamp + device info logged

**Stage 5 — Done**

- "Du er ferdig med [protocol name]!"
- Readiness score updates
- Points awarded (gamification)
- Next recommended protocol shown

### What Employee Sees

Protocol list sorted by: overdue first, then in-progress, then not-started.

Each protocol card:

- Name + policy type badge
- Progress ring (%)
- Phase indicator: Laer | Test | Signer
- Estimated time remaining
- "Fortsett" button (resumes at current stage)

### What Admin/Manager Sees

**Competence Matrix** (the table from Module 6 spec):

```
              HACCP  Hygiene  Allergen  Brann  Prep
Anna S.        OK     OK       OK       OK     OK    100%
Erik P.        OK     OK      60%       OK     --     60%
Lise M.        OK     OK       OK      80%     --     60%
Ole T.         OK    40%       --       OK     --     20%
```

Plus:

- Department readiness % aggregate
- Risk indicator: employees below 50%
- Quick actions: assign protocol, extend deadline, send reminder
- Filter: department, team, protocol, status

### Telemetry

- `training.step_completed` -> all 4 destinations
- `training.test_passed` / `training.test_failed` -> all 4 destinations
- `training.confirmation_signed` -> all 4 destinations
- `training.protocol_completed` -> all 4 destinations (triggers readiness recalc)

---

## 6. Dokumenter — Source-of-Truth System

### Intent

"Den kanoniska sanningen i lasbar form."

### Two Entry Modes (CRITICAL)

Documents MUST support two distinct entry patterns:

**Mode A: Browse**
For "I'm looking for something."

- Left panel: tree navigation (max 3 levels: Policy -> Protocol -> Procedure)
- Search bar with full-text search
- Filter: tags, category, department, status
- Recent/popular shortcuts

**Mode B: Context**
For "I arrived from a task / alert / deviation / assignment."

- Opens directly on the relevant document
- Highlights the relevant section (if possible via anchor)
- Shows clear breadcrumb: "Du kom hit fra: [source]"
- Back button returns to source context

### Document Rendering

Uses existing ChapterReader pattern:

- Tiptap `generateHTML()` for JSONContent (handbook chapters)
- `prose` / `prose-invert` Tailwind typography classes
- Metadata header: status badge, owner, last updated, related policy/protocol, assignment count

### Action Bar (top-right of every document)

| Button           | Action                                        | Visible to |
| ---------------- | --------------------------------------------- | ---------- |
| Start opplaering | Opens procedure in 5-stage learn flow         | All        |
| Ta quiz          | Jumps to knowledge test                       | All        |
| Signer           | Jumps to confirmation                         | All        |
| Start oppgave    | Creates session_task from this procedure      | Manager+   |
| Meld avvik       | Opens deviation form linked to this procedure | All        |
| Spor AI          | Mr. Botsson explains the procedure            | All        |
| Rediger          | Opens Tiptap editor (Document Mode)           | Admin      |

**Documents are not passive.** Every document is a launchpad for action.

### Content Sources

| Source                           | Rendering                                                       |
| -------------------------------- | --------------------------------------------------------------- |
| `handbook_chapter` (Tiptap JSON) | `generateHTML()` + prose classes                                |
| `procedure` + `procedure_step`   | Programmatic rendering: steps as ordered list with descriptions |
| `policy` statement + description | Simple prose block                                              |
| `protocol` description           | Prose block with linked procedures listed below                 |

### Reused Components

- `ChapterReader` from `/dashboard/handbook/` -> read-only Tiptap rendering
- `DocumentModeCanvas` from `/dashboard/_components/document-mode/` -> edit mode
- `MarkdownRenderer` from landing -> fallback for raw markdown content

---

## 7. Avvik — Exception System

### Intent

"Noe gikk galt. Rapporter det. Spor det. Los det."

### Deviation Data Model

A deviation MUST be linked to THREE levels, not one:

| Relation                         | Purpose                                              | Required? |
| -------------------------------- | ---------------------------------------------------- | --------- |
| `source_task_id` -> session_task | Where the deviation was detected (execution context) | Optional  |
| `procedure_id` -> procedure      | Which procedure was violated                         | Required  |
| `protocol_id` -> protocol        | Which compliance domain it affects                   | Required  |
| `department_session_id`          | When and where it happened                           | Optional  |

Plus:

- `reporter_id` -> profile (who reported)
- `assigned_to` -> profile (who must resolve)
- `severity` -> critical | high | medium | low
- `status` -> open | assigned | in_progress | resolved | closed | reopened
- `evidence` -> jsonb (photos, measurements, notes, timestamps)
- `corrective_action` -> text (what was done to fix it)
- `closure_record` -> jsonb (who closed, when, verification)
- `workspace_id` -> workspace (RLS isolation)

### Why Three Levels Matter

"Fridge was 8C" is simultaneously:

- A **task execution** failure (temperature check task flagged)
- A **procedure** deviation (temperature measurement procedure violated)
- A **protocol/HACCP** control failure (refrigeration control point non-compliant)
- A **session** event (happened during today's kitchen session)
- An **inspection-relevant** evidence object (Mattilsynet needs to see this)

Single-level linking loses this multi-dimensional compliance picture.

### Employee View

"Meld avvik" — minimal form:

1. Category (dropdown: matsikkerhet, hygiene, utstyr, personal, annet)
2. Severity (visual: red/orange/yellow/green)
3. Description (text)
4. Photo (camera button)
5. Related procedure (auto-suggested from context, or searchable)
6. Submit

Anonymous reporting option available.

### Admin/Manager View

- Deviation log with filters: status, severity, department, category, date range, reporter
- Kanban view: Open | Assigned | In Progress | Resolved
- Each deviation card: severity badge, title, reporter, age, assigned owner
- Click to expand: full details, evidence, corrective action log, timeline
- Batch actions: assign, escalate, close
- Statistics: deviations by category trend, resolution time, repeat offenders

### Telemetry

- `deviation.created` -> all 4 destinations
- `deviation.assigned` -> all 4 destinations
- `deviation.resolved` -> all 4 destinations
- `deviation.escalated` -> engine_event (triggers runbook if configured)

---

## 8. Procedure Detail Page — Canonical Control Plane

### Identity

The Procedure Detail Page is the system's **canonical control plane** for a procedure. It is where all information about a procedure converges.

**Admin** sees all tabs and uses this as their primary management surface.
**Employee** rarely lands here directly. They enter via staged flow wrappers (Opplaering 5-stage, Drift checklist, Documents reader). When they do arrive here (e.g., via deep link), they see a simplified view.

### Tabs (Admin View)

| Tab         | Content                                                                                            |
| ----------- | -------------------------------------------------------------------------------------------------- |
| Oversikt    | Metadata, status, assignment count, completion rate, related policy/protocol                       |
| Steg        | Procedure steps with training_content, media, estimated time                                       |
| Quiz        | Knowledge tests: questions, pass rate, attempt history                                             |
| Bekreftelse | Confirmations: who signed, when, pending signatures                                                |
| Logg        | Execution history: session_tasks created from this procedure, completion timestamps, logged values |
| Avvik       | Deviations linked to this procedure: open, resolved, trends                                        |
| Historikk   | Version history, diffs between versions, who changed what                                          |

### Tabs (Employee View)

| Tab         | Content                                                       |
| ----------- | ------------------------------------------------------------- |
| Oversikt    | Simplified: name, description, my progress, "Fortsett" button |
| Steg        | Read-only steps with training_content (same as learn flow)    |
| Quiz        | Take or review quiz                                           |
| Bekreftelse | Sign or view signed confirmation                              |

Logg, Avvik, and Historikk tabs are hidden for employees.

### Two Concepts (CRITICAL DISTINCTION)

- **Procedure Detail** = master page (canonical data, all tabs, admin-oriented)
- **Procedure Experience** = role/context wrapper around same data (staged flow for employees, checklist mode for drift, document mode for reading)

Implementation: Procedure Detail is a page component. Procedure Experience components (LearnFlow, ChecklistMode, DocumentView) are separate components that consume the same data hooks but render completely different UIs.

---

## 9. AI Scope — V1 Jobs (Hard Scoped)

AI is NOT "everywhere" in v1. It performs exactly 4 jobs:

### Job 1: Explain Procedure

- Trigger: Employee taps "Spor AI" on any procedure step or document
- Input: Procedure step content + employee's language preference
- Output: Simplified explanation in plain language
- Where: Opplaering (during learn flow), Dokumenter (action bar)

### Job 2: Answer Questions About a Step

- Trigger: Employee asks a question during learn flow
- Input: Current step context + question
- Output: Contextual answer drawing from procedure content + training_content
- Where: Opplaering (inline chat during learn flow)

### Job 3: Explain Why Something Matters

- Trigger: Employee taps "Hvorfor er dette viktig?" on a procedure
- Input: Procedure + policy context + regulatory background
- Output: Motivational explanation connecting the step to real consequences
- Where: Opplaering (stage 1: Understand)

### Job 4: Help Write/Classify a Deviation

- Trigger: Employee starts writing a deviation report
- Input: Partial description + context (which task, which procedure)
- Output: Suggested category, severity, related procedure, improved description
- Where: Avvik (deviation creation form)

### NOT in V1

- Adaptive quiz difficulty
- Risk nudges / predictive alerts
- Readiness forecasting
- Remediation guidance
- AI-generated training content
- Proactive nudges ("Hei Erik, du har 2 ufullforte...")

These are Phase 4 (Differentiator).

---

## 10. Completion Logic (EXPLICIT)

### What counts as what?

| Status            | Definition                                                                             | Trigger                                                      |
| ----------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **started**       | Employee has opened the first step of a protocol assignment                            | First `procedure_step_completion` created                    |
| **in_progress**   | At least one step completed, not all                                                   | Step count > 0 and < total                                   |
| **completed**     | ALL components done: all steps, all tests passed, all confirmations signed             | protocol_assignment.status = 'completed'                     |
| **overdue**       | Assignment deadline passed without completion                                          | Cron job checks `assigned_at + deadline`                     |
| **verified**      | Manager has reviewed and approved the completion                                       | Future: manual verification step                             |
| **compliant**     | All required protocols for a compliance domain are completed by all assigned employees | Aggregate: all assignments for policy_type = X are completed |
| **non-compliant** | Any required protocol in a domain has incomplete/expired assignments                   | Inverse of compliant                                         |

### Readiness Score Calculation

```
Employee readiness = (completed_assignments / total_assignments) * 100
Team readiness = average(employee_readiness for all team members)
Department readiness = average(employee_readiness for all department members)
Protocol compliance = (completed_assignments / total_assignments) * 100 for that protocol
```

Readiness is **not** a subjective assessment. It is a deterministic function of assignment completion state.

---

## 11. Evidence Model

### What counts as evidence?

| Evidence Type     | Data Source                                                     | Stored In                             |
| ----------------- | --------------------------------------------------------------- | ------------------------------------- |
| Quiz pass         | knowledge_test_attempt (score, passed, answers)                 | knowledge_test_attempt                |
| Digital signature | confirmation_signature (signed_at, device_info, signature_data) | confirmation_signature                |
| Task completion   | session_task (completed_at, completed_by, completion_data)      | session_task                          |
| Measured value    | session_task.completion_data (temperature, weight, count)       | session_task.completion_data jsonb    |
| Photo             | session_task.completion_data or deviation.evidence (image URL)  | Supabase Storage + reference in jsonb |
| Comment/note      | session_task.completion_notes or deviation.corrective_action    | Text fields                           |
| Timestamp         | All records have created_at, updated_at                         | Automatic                             |
| Version history   | Protocol versioning (protocol_version on assignment)            | protocol_assignment.protocol_version  |
| Audit trail       | activity_trail (from telemetry emit)                            | activity_trail table                  |

### Inspection Pack

The "Open inspection pack" action in Oversikt generates a filtered view of all evidence for a compliance domain:

- All HACCP procedures with completion rates
- All temperature logs with timestamps and values
- All deviations with resolution status
- All employee certifications (quiz passes + confirmations)
- All version history (proves procedures are maintained)

This is Smartout's "Mattilsynet-knapp" — equivalent to eSmiley's "Smilefjesgaranti."

---

## 12. Role Gates

### Permission Matrix

| Action                    | Employee | Team Lead | Manager | Admin |
| ------------------------- | -------- | --------- | ------- | ----- |
| View own assignments      | Yes      | Yes       | Yes     | Yes   |
| Complete training steps   | Yes      | Yes       | Yes     | Yes   |
| Take quiz                 | Yes      | Yes       | Yes     | Yes   |
| Sign confirmation         | Yes      | Yes       | Yes     | Yes   |
| Complete session tasks    | Yes      | Yes       | Yes     | Yes   |
| Report deviation          | Yes      | Yes       | Yes     | Yes   |
| View team readiness       | No       | Yes       | Yes     | Yes   |
| View department readiness | No       | No        | Yes     | Yes   |
| View competence matrix    | No       | Yes       | Yes     | Yes   |
| Assign training           | No       | No        | Yes     | Yes   |
| Create/edit procedures    | No       | No        | No      | Yes   |
| Create/edit policies      | No       | No        | No      | Yes   |
| Review deviations         | No       | Yes       | Yes     | Yes   |
| Close deviations          | No       | No        | Yes     | Yes   |
| Edit handbook documents   | No       | No        | No      | Yes   |
| View inspection pack      | No       | No        | Yes     | Yes   |
| Manage templates          | No       | No        | No      | Yes   |
| Waive assignment          | No       | No        | Yes     | Yes   |

### Role Rendering

Same URL, different component rendering based on `role` from DashboardContext:

- Employee: sees guided flow components, minimal navigation, no admin tabs
- Manager+: sees oversight components, full navigation, management actions

---

## 13. Entry Points Map

### How users arrive at each surface

| Entry Point           | -> Surface                | Context Passed                 |
| --------------------- | ------------------------- | ------------------------------ |
| Sidebar "HMS" click   | Oversikt                  | None                           |
| Sub-nav tab click     | Any tab                   | None                           |
| KPI card drill-down   | Training/Drift/Avvik      | Filter preset                  |
| Alert card click      | Relevant tab              | Specific item ID               |
| Session task tap      | Drift -> task detail      | task_id                        |
| "Fortsett opplaering" | Training -> learn flow    | assignment_id, resume at stage |
| Document tree click   | Dokumenter -> document    | document_id                    |
| Task -> "Meld avvik"  | Avvik -> create form      | source_task_id, procedure_id   |
| Deviation alert       | Avvik -> deviation detail | deviation_id                   |
| AI suggestion         | Relevant surface          | procedure_id + context         |
| Push notification     | Relevant surface          | Deep link with item_id         |
| My Training shortcut  | Training (employee view)  | profile_id filter              |

---

## 14. Cascade Integration

### Dimension Mapping

| Cascade Dimension        | HMS Surface     | Role                                              |
| ------------------------ | --------------- | ------------------------------------------------- |
| D3 Rules & Constraints   | Opplaering      | Training requirements constrain who can work what |
| D6 Production & Product  | Drift           | Session tasks are live production state           |
| D2 Resource Availability | Opplaering      | Readiness scores determine schedulable capacity   |
| C1 Calibration           | Oversikt        | Plan vs actual (readiness target vs current)      |
| C4 Governance            | All surfaces    | Permission gates on every action                  |
| K1a Industry Knowledge   | Dokumenter      | Industry-standard procedure templates             |
| K1b Workspace Knowledge  | Dokumenter + AI | Workspace-specific learned content                |

### Telemetry Integration

Every mutation across all HMS surfaces emits via `@smartout/telemetry` `emit()`:

```typescript
emit("hms.task.completed", { taskId, procedureId, sessionId, profileId, completionData });
emit("hms.training.step_completed", { assignmentId, stepId, profileId });
emit("hms.training.test_passed", { testId, assignmentId, score, profileId });
emit("hms.training.confirmation_signed", { confirmationId, assignmentId, profileId });
emit("hms.deviation.created", { deviationId, procedureId, protocolId, severity });
emit("hms.deviation.resolved", { deviationId, resolvedBy, correctiveAction });
emit("hms.readiness.updated", { profileId, readinessPercent, departmentId });
```

All events route to 4 destinations:

- PostHog (analytics)
- Logger (stdout)
- activity_trail (audit)
- engine_event (workflow automation — triggers runbooks, escalations, notifications)

### Data Flow Compliance

Readiness score changes (`hms.readiness.updated`) feed into:

- D2 Resource Availability: profile with readiness < 100% has constrained schedulability
- C1 Calibration: readiness target vs actual drives management alerts
- C3 Commercial: shift cost includes training debt (untrained employee = supervision cost)

---

## 15. Phasing

### Phase 1: Legibility (make the system coherent)

**Ship:**

- HMS Oversikt (attention system: status + attention + action blocks)
- Documents (action-linked, browse + context modes, Tiptap rendering)
- Improved Training (5-stage flow, competence matrix for admins)
- Unified Procedure Detail Page (canonical control plane)
- Route restructuring: /dashboard/hms/\* with sub-nav

**Why first:** The biggest issue is not lack of features. It is lack of coherent presentation. Users cannot find what they need.

### Phase 2: Execution (operationalize daily work)

**Ship:**

- Drift tab (task UI, session task rendering, checklist completion)
- Routine logging (completion_data input: temperature, measurements)
- Triggered session tasks (hooks fire procedures at scheduled times)
- Deviation reporting (employee form + admin management view)

**Why second:** Without execution UI, compliance is just documentation. This phase connects training to daily operations.

### Phase 3: Compliance (complete the HMS story)

**Ship:**

- IK-Mat controls (HACCP control points dashboard, threshold monitoring)
- Evidence/history views (all evidence for a procedure/protocol over time)
- Audit pack / Inspection readiness mode (Mattilsynet-knapp)
- Manager remediation workflows (assign corrective actions, track resolution)

**Why third:** Requires Phase 1 (legibility) and Phase 2 (execution data) to exist. Cannot prove compliance without operational data flowing.

### Phase 4: Differentiator (turn on AI)

**Ship:**

- AI coaching inside procedure flow (4 V1 jobs first, then expand)
- Adaptive quizzes (difficulty based on performance)
- AI-generated explanations (per employee language/level)
- Risk nudges (declining readiness, repeated deviations)
- Readiness forecasting (will team be ready for next week's schedule?)

**Why last:** AI is the moat, but it needs data to be useful. Phases 1-3 generate the data. Phase 4 makes it intelligent.

---

## 16. What This Design Does NOT Include

- No new database tables in Phase 1 (uses existing governance + session_task + deviation schema)
- No mobile app changes (mobile parity comes after web surfaces are proven)
- No sensor integrations (temperature hardware is Phase 3+)
- No Stripe/billing changes
- No multi-workspace federation
- No PDF export (inspection pack is web-view first)

---

## 17. Open Questions

1. **Deviation table:** Does `deviation` table exist with sufficient fields, or do we need a migration? (Current schema has `deviation_flagged` on session_task but may not have a standalone deviation table)
2. **Handbook chapter storage:** Are handbook chapters stored in `handbook_chapter` table or elsewhere? Need to verify before Documents surface.
3. **IK-Mat seed data:** Do HACCP control points exist in the database, or do we need to seed them from I1 bootstrap?
4. **Readiness recalculation:** Should readiness be recalculated on every step completion (real-time) or on a schedule (batched)?
5. **Anonymous deviation reporting:** How to handle RLS when reporter is anonymous?

---

## Appendix A: Component Boundary Rules

### MUST be separate component trees (no sharing)

| Component Family                                       | Why                                                    |
| ------------------------------------------------------ | ------------------------------------------------------ |
| Drift step renderer vs Opplaering step renderer        | Different interaction contracts: checklist vs learning |
| Employee Oversikt vs Admin Oversikt                    | Fundamentally different information needs              |
| Procedure Detail tabs vs Procedure Experience wrappers | Master page vs context flow                            |

### CAN share data hooks

| Shared Hook                         | Used By                                         |
| ----------------------------------- | ----------------------------------------------- |
| `useProtocolAssignments(profileId)` | Training + Oversikt + My Training               |
| `useProcedureSteps(procedureId)`    | Drift + Training + Documents + Procedure Detail |
| `useSessionTasks(sessionId)`        | Drift + Oversikt                                |
| `useDeviations(filters)`            | Avvik + Procedure Detail + Oversikt             |
| `useGovernanceOverview()`           | Oversikt (refactored to support filters)        |

---

## Appendix B: Competitor Reference

| Capability           | eSmiley            | Runwell                      | Smartout (this design)                           |
| -------------------- | ------------------ | ---------------------------- | ------------------------------------------------ |
| IK-Mat compliance    | Flagship product   | Feature under Internkontroll | Lens across HMS surfaces                         |
| Training integration | External courses   | Integrated but basic         | Core differentiator (5-stage flow + AI)          |
| Deviation handling   | Per-product        | Centralized                  | Three-level linked (task + procedure + protocol) |
| Document view        | Documentation hub  | Basic document management    | Action-linked canonical source                   |
| AI assistance        | None               | None                         | 4 specific V1 jobs                               |
| Employee experience  | App + checklists   | App + checklists             | Guided flow (next best action)                   |
| Readiness tracking   | None               | Basic completion             | Deterministic score driving schedulability       |
| Inspection readiness | "Smilefjesgaranti" | "Kontrollknapp"              | Inspection pack (evidence aggregation)           |

Smartout's category-defining position: **compliance as a byproduct of competence**, not logged documentation.
