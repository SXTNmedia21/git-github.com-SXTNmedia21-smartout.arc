---
title: "User Journey: Trainee Mode & Core Journey"
status: draft
created: 2026-03-01
updated: 2026-03-29
module: onboarding
tags: [user-journey, trainee, module-journeys, checkpoints, not-implemented]
---

# User Journey: Trainee Mode & Core Journey

> **STATUS: DESIGN SPEC** -- Tabellene `trainee_journey`, `module_journey`, `module_journey_checkpoint` og `profile_checkpoint_progress` er IKKE opprettet i databasen ennaa. Denne journeyen beskriver planlagt funksjonalitet. `profile.status = 'trainee'` finnes i koden, men trainee-systemet med sjekkpunkter og modul-reiser er ikke implementert.

## 1. Overview

Trainee mode is the period between accepting a Smartout invite and the first real shift. The employee learns **the system** -- not the job. During this period, `profile.status = 'trainee'`.

The goal is simple: make the employee confident enough with Smartout as a tool that they can focus entirely on the job when their first real shift begins. Everything in trainee mode is about software literacy, not job competency.

---

## 2. Three Systems

Onboarding in Smartout is split into three distinct systems. Understanding the boundary between them is critical.

| System                | Module                | Purpose                     | Scope                                        | Timeline                                                   |
| --------------------- | --------------------- | --------------------------- | -------------------------------------------- | ---------------------------------------------------------- |
| **Trainee Mode**      | Module 1 (Onboarding) | Learn Smartout the software | Navigation, functionality, installed modules | Must complete before first real shift                      |
| **Module Journeys**   | Module 1 (Onboarding) | Per-module quick onboarding | One journey per installed module             | Part of trainee mode + triggered when new modules activate |
| **Protocol Training** | Module 6 (Training)   | Learn the actual job        | HACCP, kitchen procedures, safety, etc.      | Longer timeline, managed by governance model               |

### Data Ownership

| System            | Tables                                                                       |
| ----------------- | ---------------------------------------------------------------------------- |
| Trainee Mode      | `trainee_journey`                                                            |
| Module Journeys   | `module_journey`, `module_journey_checkpoint`, `profile_checkpoint_progress` |
| Protocol Training | `procedure`, `knowledge_test`, `confirmation` + training progress tables     |

Trainee mode and module journeys are covered in this document. Protocol training runs alongside and after the trainee period on its own schedule -- see Module 6 documentation.

---

## 3. Trainee Mode Flow

```
Invite accepted
  --> Profile created (status: trainee)
  --> trainee_journey created (status: not_started)
  --> First app launch
  --> Mr. Botsson greets the employee
  --> Core Journey begins:
        |-- Profile setup (name, photo, emergency contact)
        |-- Navigation orientation (sidebar, pages)
        |-- Core concepts (shifts, tasks, chat)
  --> Module Journeys (per installed module):
        |-- Scheduling: view shifts, test punch-in, availability
        |-- Tasks: complete a test task
        |-- HACCP: log test temperature
        |-- Chat: find team chat, send message
  --> All checkpoints complete
  --> Admin/leader notification
  --> Admin reviews + approves
  --> Profile.status --> 'active'
  --> Trainee mode ends
```

### State Transitions

```
trainee_journey.status:
  not_started --> in_progress --> completed

profile.status:
  trainee --> active (requires admin approval)
```

---

## 4. Core Journey Checkpoints

The core journey covers Smartout fundamentals that every employee must complete regardless of which modules are installed.

| #   | Checkpoint                     | Type         | Sandbox?  | Required | Event/Target               |
| --- | ------------------------------ | ------------ | --------- | -------- | -------------------------- |
| 1   | Complete profile (name, photo) | action       | No (real) | Yes      | profile_updated            |
| 2   | Add emergency contact          | action       | No (real) | Yes      | emergency_contact_added    |
| 3   | Visit dashboard page           | screen_visit | N/A       | Yes      | /dashboard                 |
| 4   | Visit schedule page            | screen_visit | N/A       | Yes      | /schedule                  |
| 5   | Visit team page                | screen_visit | N/A       | Yes      | /team                      |
| 6   | Understand shift concept       | ai_verified  | N/A       | Yes      | ai_confirmed_understanding |

### Checkpoint Types

- **action** -- The employee performs a real or sandbox action (filling a form, completing a task).
- **screen_visit** -- The employee navigates to a specific page. Tracked automatically.
- **ai_verified** -- Mr. Botsson confirms the employee understands a concept through conversation. The AI sets the checkpoint complete when understanding is confirmed.

### Storage

Each checkpoint maps to a row in `module_journey_checkpoint`. Employee progress per checkpoint is tracked in `profile_checkpoint_progress` with fields: `profile_id`, `checkpoint_id`, `completed_at`, `metadata` (JSON for AI verification data, sandbox results, etc.).

---

## 5. Module Journey Checkpoints

Each installed module gets its own journey. Module journeys are only created for modules that are active in the workspace at the time the employee starts trainee mode. If a new module is activated later, a new module journey is triggered for all employees (not just trainees).

### 5.1 Scheduling Module

| #   | Checkpoint            | Type         | Sandbox? | Required |
| --- | --------------------- | ------------ | -------- | -------- |
| 1   | View schedule page    | screen_visit | N/A      | Yes      |
| 2   | Find own shift        | screen_visit | N/A      | Yes      |
| 3   | Test punch-in         | action       | Yes      | Yes      |
| 4   | Register availability | action       | Yes      | Yes      |
| 5   | Understand shift swap | ai_verified  | N/A      | No       |

### 5.2 Tasks Module

| #   | Checkpoint         | Type         | Sandbox? | Required |
| --- | ------------------ | ------------ | -------- | -------- |
| 1   | View tasks page    | screen_visit | N/A      | Yes      |
| 2   | Complete test task | action       | Yes      | Yes      |
| 3   | View task history  | screen_visit | N/A      | No       |

### 5.3 HACCP Module

| #   | Checkpoint                   | Type         | Sandbox? | Required |
| --- | ---------------------------- | ------------ | -------- | -------- |
| 1   | View HACCP page              | screen_visit | N/A      | Yes      |
| 2   | Log test temperature         | action       | Yes      | Yes      |
| 3   | View HACCP log               | screen_visit | N/A      | No       |
| 4   | Understand deviation process | ai_verified  | N/A      | Yes      |

### 5.4 Chat Module

| #   | Checkpoint         | Type         | Sandbox?  | Required |
| --- | ------------------ | ------------ | --------- | -------- |
| 1   | Find team chat     | screen_visit | N/A       | Yes      |
| 2   | Send a message     | action       | No (real) | Yes      |
| 3   | View announcements | screen_visit | N/A       | No       |

---

## 6. Sandbox Rules

Not all trainee actions happen in a sandbox. The rule is: if the action would create real operational data (payroll, compliance, scheduling), it runs in sandbox mode. If the action is social or identity-related, it is real.

| Activity            | Mode    | Reason                            |
| ------------------- | ------- | --------------------------------- |
| Punch clock         | Sandbox | Does not create real payroll data |
| Task completion     | Sandbox | Test tasks, no session impact     |
| Temperature logging | Sandbox | Practice, not HACCP compliance    |
| Availability        | Sandbox | Does not affect real scheduling   |
| Chat/messages       | Real    | Social integration from day one   |
| Profile setup       | Real    | Actual identity data              |
| Reading procedures  | Real    | Real content, progress is tracked |

### Sandbox Implementation

Sandbox actions are flagged with `is_sandbox: true` in the relevant record or stored only in `profile_checkpoint_progress.metadata`. They never appear in operational reports, compliance logs, or payroll calculations. The sandbox flag is set automatically when `profile.status = 'trainee'` and the checkpoint is marked as sandbox.

---

## 7. Hard Deadline & Escalation

### Deadline

The trainee must complete all required checkpoints before their first real shift. The system uses `schedule_shift` to determine when the first shift is scheduled.

### Escalation Timeline

| Trigger                | Action                                              |
| ---------------------- | --------------------------------------------------- |
| 48h before first shift | AI escalates to admin if trainee is not complete    |
| 24h before first shift | Second escalation with urgency flag                 |
| First shift starts     | Trainee is flagged as incomplete; admin must decide |

### Admin Options on Escalation

- **Extend** -- Reschedule the first shift to give more time
- **Override** -- Mark the trainee as ready despite incomplete checkpoints (logged as override in `trainee_journey.metadata`)
- **Reschedule** -- Move the first shift to a later date

### No Shift Scheduled

If no shift is scheduled for the trainee, there is no hard deadline. The AI uses gentle nudges to encourage progress but does not escalate. The trainee can take their time. Nudge frequency increases gradually: day 1-3 (daily), day 4-7 (every other day), day 8+ (weekly).

---

## 8. Transition: Trainee to Active

### Requirements

Both conditions must be met:

1. **ALL required checkpoints complete** -- Every checkpoint marked `required: true` across the core journey and all module journeys must have a corresponding `profile_checkpoint_progress` record with `completed_at` set.
2. **Admin approval** -- An admin or leader must explicitly approve the trainee.

### Approval Flow

```
All required checkpoints complete
  --> System sends notification to admin/leader
  --> Admin opens trainee progress dashboard
  --> Reviews checkpoint completion
  --> Clicks "Approve Readiness" (Godkjenn klarhet)
  --> System updates:
        profile.status: trainee --> active
        trainee_journey.status: in_progress --> completed
        trainee_journey.completed_at: NOW()
        trainee_journey.approved_by: admin profile_id
  --> Employee receives confirmation notification
  --> Points earned carry over to current season leaderboard
```

### Why Admin Approval?

Automatic transition was considered and rejected. The admin needs a human checkpoint to verify the employee is genuinely ready, not just clicking through screens. This is a deliberate friction point.

---

## 9. Gamification

Points are awarded during trainee mode and carry over to the current season leaderboard once the trainee transitions to active status.

| Action                                     | Points |
| ------------------------------------------ | ------ |
| Complete a checkpoint                      | 5      |
| Complete entire module journey             | 15     |
| Complete all journeys (100%)               | 50     |
| Early completion (>48h before first shift) | 25     |
| Complete profile setup                     | 10     |

### Rules

- Points are tracked per profile in the season points system.
- Points are only awarded once per checkpoint (idempotent).
- The early completion bonus requires a scheduled first shift to calculate.
- If no shift is scheduled, the early completion bonus is not available.
- Optional checkpoints award the same 5 points as required ones.

---

## 10. AI Copilot (Mr. Botsson)

Mr. Botsson is the AI guide throughout trainee mode. It is chat-first with voice as an upgrade path.

### Behavior

- Matches `profile.preferred_language` from profile
- Adapts explanations to experience level, position, and department
- Orders module journeys by first shift relevance (e.g., if first shift is in kitchen, HACCP module journey comes first)
- Proactively suggests next steps based on incomplete checkpoints
- Celebrates milestones (journey completion, all checkpoints done)

### Tools Available to Mr. Botsson

| Tool                | Purpose                                           |
| ------------------- | ------------------------------------------------- |
| `navigate_to`       | Navigate the employee to a specific page          |
| `highlight_element` | Highlight a UI element with a pulsing border      |
| `show_tooltip`      | Display a contextual tooltip on a UI element      |
| `spotlight_element` | Dim everything except the target element          |
| `autofill_demo`     | Fill a form with demo data to show how it works   |
| `celebrate`         | Trigger a celebration animation (confetti, sound) |

### Conversation Flow

Mr. Botsson does not follow a rigid script. It tracks which checkpoints are complete and which are not, then guides the conversation naturally toward the next incomplete checkpoint. If the employee asks unrelated questions, Mr. Botsson answers them but gently steers back to the journey.

For `ai_verified` checkpoints, Mr. Botsson asks open-ended questions to verify understanding. It does not accept yes/no answers. Example:

> "Can you explain in your own words what happens when you need to swap a shift with a colleague?"

The AI evaluates the response and marks the checkpoint complete only when the explanation demonstrates genuine understanding. The evaluation criteria and the employee's response are stored in `profile_checkpoint_progress.metadata`.

---

## 11. Admin/Leader View

### Trainee Progress Dashboard

The admin dashboard shows all trainees in a single view with the following columns:

| Column        | Description                                              |
| ------------- | -------------------------------------------------------- |
| Employee      | Name and avatar                                          |
| Progress %    | Percentage of required checkpoints completed             |
| Status        | on_track / at_risk / blocked / ready                     |
| First Shift   | Date of first scheduled shift (or "Not scheduled")       |
| Last Activity | Timestamp of last checkpoint completion                  |
| Action        | "Approve Readiness" button (enabled when status = ready) |

### Status Definitions

| Status   | Condition                                            |
| -------- | ---------------------------------------------------- |
| on_track | Progress is on pace to complete before first shift   |
| at_risk  | Less than 48h until first shift and not complete     |
| blocked  | No activity for 72h+                                 |
| ready    | All required checkpoints complete, awaiting approval |

### AI Proactive Alerts

The system sends proactive alerts to admins/leaders for:

- Trainee has been blocked for 72h+
- Trainee is at_risk (48h escalation)
- Trainee has completed all checkpoints and is ready for approval
- Trainee's first shift is approaching and completion is unlikely at current pace

---

## 12. E2E Test Scenarios

| #   | Scenario                               | Expected Outcome                                                                             |
| --- | -------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1   | Trainee first launch                   | Sees Mr. Botsson welcome message, core journey starts                                        |
| 2   | Core journey progress tracking         | Each checkpoint completion updates `profile_checkpoint_progress` and recalculates progress % |
| 3   | Checkpoint completion updates progress | `trainee_journey` progress reflects completed / total required checkpoints                   |
| 4   | All checkpoints complete               | Admin receives notification, trainee status shows "ready" in dashboard                       |
| 5   | Admin approves                         | `profile.status` changes to `active`, `trainee_journey.status` changes to `completed`        |
| 6   | 48h escalation trigger                 | When first shift is 48h away and trainee is incomplete, admin receives escalation alert      |
| 7   | Module journey ordering                | Journeys are ordered by first shift context (department-relevant modules first)              |
| 8   | Sandbox action isolation               | Sandbox punch-in does not appear in payroll or operational reports                           |
| 9   | Optional checkpoint skip               | Trainee can reach "ready" status without completing optional checkpoints                     |
| 10  | Points carry over                      | After approval, trainee's accumulated points appear on the season leaderboard                |

---

## 13. Acceptance Criteria

### Trainee Mode Activation

- [ ] When an employee accepts an invite, `profile` is created with `status = 'trainee'`
- [ ] A `trainee_journey` record is created with `status = 'not_started'`
- [ ] `module_journey` records are created for each active module in the workspace
- [ ] `module_journey_checkpoint` records are seeded from the checkpoint definitions in this document (sections 4 and 5)

### Core Journey

- [ ] All 6 core checkpoints (section 4) are tracked in `module_journey_checkpoint` for the core journey
- [ ] `screen_visit` checkpoints are completed automatically when the page is visited
- [ ] `action` checkpoints are completed when the corresponding event fires
- [ ] `ai_verified` checkpoints are completed only when Mr. Botsson confirms understanding
- [ ] Profile setup (checkpoints 1-2) writes real data to `profile` and related tables

### Module Journeys

- [ ] Scheduling module: 5 checkpoints as defined in section 5.1
- [ ] Tasks module: 3 checkpoints as defined in section 5.2
- [ ] HACCP module: 4 checkpoints as defined in section 5.3
- [ ] Chat module: 3 checkpoints as defined in section 5.4
- [ ] Module journeys are only created for modules active in the workspace
- [ ] Sandbox checkpoints do not create operational data

### Progress Tracking

- [ ] `profile_checkpoint_progress` records are created on checkpoint completion with `completed_at` timestamp
- [ ] Progress percentage is calculated as: completed required checkpoints / total required checkpoints
- [ ] `trainee_journey.status` transitions from `not_started` to `in_progress` on first checkpoint completion
- [ ] `trainee_journey.status` transitions to `completed` only after admin approval

### Escalation

- [ ] 48h before first shift: system sends escalation to admin if trainee is incomplete
- [ ] 24h before first shift: second escalation with urgency flag
- [ ] If no shift scheduled: no escalation, only gentle AI nudges

### Transition

- [ ] "Approve Readiness" button is only enabled when all required checkpoints are complete
- [ ] On approval: `profile.status` updates from `trainee` to `active`
- [ ] On approval: `trainee_journey.status` updates to `completed`, `completed_at` is set
- [ ] On approval: `trainee_journey.approved_by` is set to the approving admin's `profile_id`
- [ ] Points earned during trainee mode carry over to the current season leaderboard

### Gamification

- [ ] Points are awarded per the table in section 9
- [ ] Points are idempotent (no double-awarding on repeated completion)
- [ ] Early completion bonus requires a scheduled first shift

### Admin Dashboard

- [ ] Admin sees all trainees with progress %, status, first shift date, last activity
- [ ] Status correctly reflects: on_track, at_risk, blocked, ready
- [ ] AI proactive alerts fire for at_risk and blocked trainees
- [ ] "Approve Readiness" triggers the full transition flow
