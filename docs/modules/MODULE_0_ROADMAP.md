---
title: "Module Zero — The Event Motor"
status: draft
updated: 2026-03-30
created: 2026-03-30
module: meta
tags: [roadmap, event-motor, autonomy, implementation, vision]
language: en
---

# Module Zero — The Event Motor

**16 weeks from where we are to a system that runs itself.**

---

## Value Propositions

### 1. From Chaos to Control (Week 1–4)

The workspace exists. Governance is active. The first season has been played. Every policy has a protocol. Every employee knows what they need to learn. The system has structure.

### 2. From Control to Autopilot (Week 5–12)

Shifts publish themselves. Training tracks itself. The day opens, runs, and closes without human orchestration. The financial close happens with a photograph and a signature. Deviations surface before anyone asks. The system operates.

### 3. From Autopilot to Evolution (Week 13–16)

The system reviews its own season. It proposes better factors. It drafts the next season. It identifies training gaps before the manager notices. The operator's role shifts from driving to steering. The system evolves.

---

## Calls to Action

### 1. Define the Event Motor

Everything in Smartout is a Roadmap with a start-hook, events, and a stop-hook. Module Zero defines this motor — the universal pattern that makes every feature, every workflow, every interaction follow the same architecture.

### 2. Implement Week by Week

16 pages. Each page is one week. Clear customer experience, clear hooks activated, clear acceptance criteria, clear implementation work. No ambiguity. No drift.

### 3. Goal: You Only Need to Be Present

Week 16: the system branches, grows, and improves autonomously. The operator's role is quality control. Purpose and direction. Everything else runs.

---

## The Event Motor

Before the weeks begin — the pattern that governs everything.

### The Universal Pattern

Every workflow in Smartout follows one architecture:

```
ROADMAP (the blueprint)
  │
  ├── start-hook fires → session created, context loaded
  │
  ├── event → step completed, data saved, test passed
  ├── event → step completed, data saved, whisper sent
  ├── event → step completed, certification issued
  │
  └── stop-hook fires → session ends, results persisted
```

A shift follows this pattern. An onboarding follows this pattern. A training protocol follows this pattern. A HACCP inspection follows this pattern. A daily close follows this pattern. A season follows this pattern.

**Start-hook:** The moment something begins. An employee clocks in. A new hire opens the onboarding page. A department session transitions to `active`. A season clicks PLAY.

**Events:** Everything that happens between start and stop. Steps completed. Data saved. Tests passed or failed. Whispers sent. Deviations flagged. Points earned.

**Stop-hook:** The moment something ends. The employee clocks out. The onboarding finalizes. The department session moves to `closed`. The season archives.

### Three Perspectives, One System

The same workflow renders differently depending on who's looking:

| Perspective        | Name     | What they see                                                                     |
| ------------------ | -------- | --------------------------------------------------------------------------------- |
| **The definition** | Roadmap  | The blueprint. Steps, hooks, requirements, expected data. Created by admin or AI. |
| **The experience** | Journey  | "I'm doing this." The live instance. Guided by Botsson. Tracked by the system.    |
| **The oversight**  | Protocol | "How's it going?" Insight, observation, control. Same data, leader's view.        |

### Five Deliverables Per Roadmap

Every Roadmap produces exactly five outputs:

| #   | Deliverable           | What it is                                             |
| --- | --------------------- | ------------------------------------------------------ |
| 1   | **Onboarding Manual** | Step-by-step guide the employee reads and follows      |
| 2   | **Playwright Script** | Automated E2E test for agent-driven verification       |
| 3   | **Agent Mission**     | Botsson guides, challenges, and certifies the employee |
| 4   | **Certification**     | Proof that the employee completed the Roadmap          |
| 5   | **API Documentation** | All endpoints, data models, and moving parts involved  |

### Event Types

| Event                  | When                  | Data                               |
| ---------------------- | --------------------- | ---------------------------------- |
| `step_started`         | User enters a step    | step_id, screen, component         |
| `step_completed`       | User finishes a step  | step_id, duration_ms, data_written |
| `data_saved`           | System persists data  | table, fields, values              |
| `test_passed`          | Verification succeeds | assertion, result                  |
| `test_failed`          | Verification fails    | assertion, error                   |
| `whisper_sent`         | Guardian nudges user  | message, reason                    |
| `deviation_flagged`    | Threshold exceeded    | metric, expected, actual           |
| `certification_issued` | All requirements met  | cert_id, score                     |

### The Fingerprint Precision

Hooks fire with temporal precision. Not "sometime today" — at exact moments:

```
trigger_anchor = open, trigger_offset = -120   → 2 hours before opening
trigger_anchor = close, trigger_offset = -60   → 1 hour before closing
repeat_interval = 240                          → every 4 hours
active_weekdays = [0,1,2,3,4]                  → weekdays only
```

Every department runs on its own clock. Every procedure fires at its own moment. Every deviation surfaces at the right time. This is fingertip precision — and it's what makes the system harmonize.

---

## Current State

Before we start the 16 weeks, here's what exists today:

### Production-Ready

- ✅ Onboarding (voice-first, mission-driven, 10 tools, workspace creation)
- ✅ Schedule (DnD grid, templates, publish, monthly view)
- ✅ Season Planning (budget, day/hour factors, calculation engine)
- ✅ Daily Close (OCR, reconciliation, 8-state machine, gatekeeper)
- ✅ Guardian (real-time signals, workspace health, admin dashboard)
- ✅ Invitations (email, SMS, shareable link)

### Foundation Ready (DB exists, UI not started)

- ⚠️ Governance (policy/protocol/procedure tables — no admin UI)
- ⚠️ Training (readiness model designed — no employee UI)
- ⚠️ Operations (department_session + hooks — mock data in UI)
- ⚠️ Process Engine (engine_process tables — no execution dashboard)
- ⚠️ Agent Capabilities (3 of 9 registered — schedule/training/operations missing)
- ⚠️ AI Suggestions (intelligence pipeline — no recommendation UI)

---

## The 16 Weeks

---

### PHASE 1: GRUNDLÄGGNING (Week 1–4)

_"The workspace has structure. Every person knows what they need to learn."_

---

### Week 1: The Workspace Is Born

**Customer experience:** A restaurant owner visits Smartout. Within 20 minutes, their workspace exists — company data scraped from their website, organizational structure suggested by AI, departments and locations created, and Mr. Botsson ready to help.

**Roadmaps activated:**

- `R-001: Sign Up & Create Workspace` — start-hook: user opens /onboarding → stop-hook: workspace activates

**Hooks in play:**

- `start-hook:` Onboarding page loaded → Stage Engine creates session → Ultravox voice call starts
- `events:` Business data scraped, departments added, locations added, branding configured
- `stop-hook:` finalizeOnboarding() → workspace created, default season created, agent profile (Mr. Botsson) created

**What already exists:** ✅ Complete. Onboarding is live with 10 voice tools, intelligence pipeline, workspace creation.

**What we build this week:**

- [ ] Stabilize the onboarding mission — fix any remaining edge cases in voice tool execution
- [ ] Ensure workspace creation seeds: default season, default agent profile, watchdog config
- [ ] Wire `journey` and `journey_step` records for `R-001` — connect mission stages to journey steps via FK
- [ ] Seed the first Roadmap definition: `R-001` with all 5 deliverables marked as targets
- [ ] Write E2E test: onboarding flow from landing to dashboard

**Acceptance criteria:**

- [ ] A new user can go from /onboarding to /dashboard in under 20 minutes
- [ ] Workspace has: company, departments, locations, default season, agent profile
- [ ] Journey `R-001` exists with steps linked to mission stages
- [ ] E2E test passes

---

### Week 2: Governance Activates

**Customer experience:** The admin opens the Governance page. They see their policies — some auto-generated from industry standards (food safety, alcohol service, allergen handling), some suggested by Botsson based on the company's type. Each policy has a protocol container. The admin clicks into a protocol and sees: procedures (step-by-step), knowledge tests, and confirmations. They can edit, reorder, add media, and activate.

**Roadmaps activated:**

- `R-002: Create Policy & Protocol` — start-hook: admin opens governance page → stop-hook: protocol status = active
- `R-003: Build Procedure` — start-hook: admin opens procedure editor → stop-hook: procedure has ≥ 1 step with training_content

**Hooks in play:**

- `start-hook:` Admin navigates to /dashboard/governance
- `events:` Policy created, protocol created, procedure steps added, knowledge test configured, confirmation text written
- `stop-hook:` Protocol activated → system flags all employees who need this protocol

**What already exists:** Database tables (policy, protocol, procedure, procedure_step, knowledge_test, confirmation, control_list, routine, runbook). RLS policies. Seed data.

**What we build this week:**

- [ ] Governance page: `/dashboard/governance` — list all policies with protocol status
- [ ] Policy detail page: show protocol with all 6 sub-components
- [ ] Procedure editor: reorder steps, add training_content, upload media (images/video)
- [ ] Knowledge test builder: question + answer pairs, pass threshold slider
- [ ] Confirmation editor: text + signature requirement toggle
- [ ] Industry template seeder: food safety, allergen, alcohol service pre-built protocols
- [ ] Botsson capability: `governance` tools — suggestPolicy, suggestProcedure based on company type

**Acceptance criteria:**

- [ ] Admin can create a policy → protocol → procedure with 5+ steps → knowledge test → confirmation
- [ ] Procedure steps have both `description` (operational) and `training_content` (learning)
- [ ] At least 3 industry templates available for food service companies
- [ ] Protocol can be activated → system identifies affected employees

---

### Week 3: The Team Is Invited

**Customer experience:** The admin invites their team. Employees receive an SMS or email with a link. They click it, create their account, and land on their personal dashboard. They see their readiness score — 0%. They see what they need to learn. Mr. Botsson greets them and offers to guide them through their first protocol.

**Roadmaps activated:**

- `R-004: Invite & Onboard Employee` — start-hook: admin sends invitation → stop-hook: employee has profile + assignments
- `R-005: Employee First Login` — start-hook: employee clicks invite link → stop-hook: employee sees dashboard with readiness score

**Hooks in play:**

- `start-hook:` Invitation created → SMS/email sent
- `events:` Employee accepts invitation, creates account, profile created, protocol assignments generated
- `stop-hook:` Employee lands on dashboard → readiness score calculated → Botsson greets

**What already exists:** Invitation flow (create + accept Edge Functions), invite dialog, basic people management.

**What we build this week:**

- [ ] Auto-assignment engine: when profile created → scan workspace/department/team policies → create `protocol_assignment` records
- [ ] Employee dashboard: readiness score card (procedures_completed/total, tests_passed/total, confirmations_signed/total)
- [ ] Readiness dashboard for managers: heat map of employees × protocols (green/yellow/red)
- [ ] Botsson greeting flow: detect first-login, offer guided protocol walkthrough
- [ ] Employee notification: "Du har 4 protokoll att slutföra. Börja med Livsmedelssäkerhet?"

**Acceptance criteria:**

- [ ] New employee auto-receives protocol assignments based on department + team
- [ ] Employee sees readiness score on dashboard (e.g., "0% — 4 protokoll kvar")
- [ ] Manager sees competence matrix: employees × protocols with completion status
- [ ] Botsson greets new employees and suggests first protocol

---

### Week 4: The First Season — PLAY

**Customer experience:** The admin opens Season Planning. Creates "Vår 2026." Sets a revenue target. Configures day factors (Friday = 2.5×, Saturday = 3×). Sets hour factors (lunch peak, dinner peak). Reviews the staffing calculation. Assigns team composition. Clicks PLAY. The season goes live. The leaderboard appears. Points start counting.

**Roadmaps activated:**

- `R-006: Configure Season` — start-hook: admin creates season → stop-hook: season status = active
- `R-007: Season PLAY` — start-hook: admin clicks PLAY → stop-hook: gamification active, leaderboard visible

**Hooks in play:**

- `start-hook:` Season created with status `draft`
- `events:` Budget set, day factors configured, hour factors configured, team assigned, gamification rules defined
- `stop-hook:` Season activated → department sessions start creating daily → leaderboard initializes

**What already exists:** Season table, season_budget, day_factor, hour_factor, calculation engine, 4-tab UI.

**What we build this week:**

- [ ] PLAY button: transition season from `draft` → `active` with validation (budget set? factors configured?)
- [ ] Season activation trigger: when season goes active → start creating daily department_sessions
- [ ] Gamification foundation: point rules per action (task completed, protocol finished, on-time arrival)
- [ ] Leaderboard component: season-scoped, sortable by points, filterable by team/department
- [ ] Team composition UI: assign employees to season-specific teams
- [ ] Season overview: "Vår 2026 — Dag 1. Revenue target: 4.2M. Today's target: 28,000 NOK"

**Acceptance criteria:**

- [ ] Admin can create season → configure budget + factors → click PLAY
- [ ] Active season generates daily department_sessions
- [ ] Leaderboard shows employee points within the season scope
- [ ] Dashboard reflects active season context (today's target, today's staffing need)

---

### PHASE 2: OPERATIONELL (Week 5–8)

_"The system runs the day. Every shift, every task, every checklist — tracked, timed, and tied to the season."_

---

### Week 5: The Schedule Lives

**Customer experience:** The manager opens the schedule. Drags employees onto shifts. The system warns: "Sara hasn't completed the allergen protocol — don't assign her to the kitchen station." The manager publishes. Every employee gets a push notification. Sara can see her shifts, request swaps, and mark availability.

**Roadmaps activated:**

- `R-008: Publish Weekly Schedule` — start-hook: manager opens schedule → stop-hook: shifts published, notifications sent
- `R-009: Employee Shift Self-Service` — start-hook: employee opens "My Shifts" → stop-hook: swap/availability request processed

**Hooks in play:**

- `start-hook:` Manager navigates to /dashboard/schedule
- `events:` Shifts created, readiness warnings displayed, shifts published, notifications sent
- `stop-hook:` All employees notified → schedule locked for the period

**What already exists:** Full DnD grid, templates, publish dialog, shift cards, monthly view.

**What we build this week:**

- [ ] Readiness-aware scheduling: warn when assigning employee with incomplete protocols to restricted station
- [ ] Employee self-service: "My Shifts" view with swap requests and availability marking
- [ ] Shift notification integration: push notification on publish via SendGrid/Twilio
- [ ] Schedule ↔ Season integration: staffing need from hour factors displayed alongside actual scheduled hours
- [ ] Botsson `schedule` capability: 3 tools — getMyShifts, requestSwap, setAvailability

**Acceptance criteria:**

- [ ] Readiness warning appears when scheduling under-trained employee
- [ ] Employees see their shifts and can request swaps
- [ ] Published schedule triggers notifications to all affected employees
- [ ] Hour-by-hour staffing need (from season factors) visible on schedule page

---

### Week 6: Training Begins

**Customer experience:** Sara opens her dashboard. Sees "4 protokoll kvar." Clicks "Livsmedelssäkerhet." Botsson starts guiding her through the procedure — step by step, with training_content, images, and videos. At the end, a knowledge test. She passes. Her readiness score jumps to 25%. The manager sees the update in real time on the competence matrix.

**Roadmaps activated:**

- `R-010: Complete Protocol Training` — start-hook: employee opens protocol → stop-hook: all components completed, readiness updated
- `R-011: Knowledge Test` — start-hook: employee starts test → stop-hook: test passed/failed, score recorded

**Hooks in play:**

- `start-hook:` Employee clicks "Start" on protocol assignment
- `events:` Procedure step viewed, training_content read, media watched, knowledge test question answered, confirmation signed
- `stop-hook:` All required components completed → protocol_assignment status = completed → readiness recalculated

**What already exists:** Protocol assignment model, readiness calculation logic, procedure_step with training_content field.

**What we build this week:**

- [ ] Training mode UI: full-screen procedure walkthrough with training_content, media, step progress
- [ ] Knowledge test runner: question display, answer selection, immediate feedback, retry logic
- [ ] Confirmation flow: display confirmation text, collect digital signature (IP + device logged)
- [ ] Readiness recalculation trigger: when protocol_assignment completes → update denormalized counters
- [ ] Botsson `training` capability: guideProtocol, checkReadiness, suggestNextProtocol
- [ ] Training mission: `protocol-trainer` — Botsson walks employee through a procedure conversationally

**Acceptance criteria:**

- [ ] Employee can complete full protocol: procedures → knowledge test → confirmation
- [ ] Readiness score updates in real time after completion
- [ ] Manager sees completion reflected on competence matrix immediately
- [ ] Botsson can guide an employee through a protocol via voice or text

---

### Week 7: The Day Runs Itself

**Customer experience:** 06:00 — the system creates today's department session. 06:30 — the prep checklist fires for the kitchen (2 hours before open). 08:30 — the restaurant opens. Session moves to `active`. Temperature checks fire every 4 hours. At 14:00, the pre-close routine triggers. At 15:00, close. Everything timestamped. Everything tracked. The manager didn't lift a finger.

**Roadmaps activated:**

- `R-012: Daily Department Operation` — start-hook: department_session created (status: upcoming) → stop-hook: session closed or missed

**Hooks in play:**

- `start-hook:` pg_cron or season activation creates department_session with status `upcoming`
- `events:` Session transitions (upcoming → active → pending_signoff → closed), session hooks fire at anchors (pre_open, open, scheduled, pre_close, close), tasks materialized from procedures, employees clock in/out
- `stop-hook:` Session status = closed → daily metrics calculated → reconciliation record created

**What already exists:** department_session table, session_hook system, trigger architecture, operations UI (mock data).

**What we build this week:**

- [ ] Daily session creator: pg_cron job or season-activation trigger → create tomorrow's sessions per department
- [ ] Session hook executor: fire procedures at trigger_anchor + trigger_offset with repeat_interval
- [ ] Task materialization: procedure_step → session_task records for today's active procedures
- [ ] Clock-in/out: employee punch with GPS + timestamp, tied to department_session
- [ ] Operations dashboard: replace mock data with live department_session data
- [ ] Session lifecycle transitions: upcoming → active (at open time) → pending_signoff (at close time)

**Acceptance criteria:**

- [ ] Department sessions auto-create daily based on active season
- [ ] Session hooks fire at correct times (prep 2h before, temp checks every 4h, close routine)
- [ ] Operations dashboard shows real data: active sessions, completed tasks, staff present
- [ ] Session transitions happen automatically based on time anchors

---

### Week 8: The Day Closes

**Customer experience:** 22:00 — the closer opens the close-out interface. Completes the checklist. Photographs the POS screen and terminal report. OCR extracts the numbers. A 200 NOK deviation appears — "Card total doesn't match POS total." The closer adds a comment: "Vipps-betalning bokförd sent." The closer cannot punch out until everything is done. Next morning, the manager reviews, approves. The day is permanently locked.

**Roadmaps activated:**

- `R-013: Daily Financial Close` — start-hook: session moves to pending_signoff → stop-hook: manager approves, day locked
- `R-014: Manager Reconciliation` — start-hook: manager opens reconciliation → stop-hook: all deviations resolved, day approved

**Hooks in play:**

- `start-hook:` Department session → `pending_signoff` OR last employee punches out (5-min delay)
- `events:` Checklist completed, settlement images uploaded, OCR processed, deviations flagged, closer comments, manager reviews
- `stop-hook:` Manager approves → reconciliation status = closed → daily metrics persisted → feeds into season factor learning

**What already exists:** DailyCloseEngine (6 tables), OCR Edge Functions, 8-state machine, reconciliation UI, gatekeeper.

**What we build this week:**

- [ ] Wire daily close to department_session lifecycle: pending_signoff triggers close process
- [ ] Gatekeeper enforcement: employee cannot punch out until close-out complete
- [ ] Process Engine activation: daily close as first live process (engine_process → engine_step → engine_state)
- [ ] Reconciliation → season factor feedback: closed day's revenue feeds into factor accuracy tracking
- [ ] Deviation auto-classification: common patterns (Vipps delay, tip discrepancy) suggested by AI
- [ ] Revenue per worked hour: `total_revenue / total_worked_hours` calculated and displayed

**Acceptance criteria:**

- [ ] Daily close triggers automatically when session reaches pending_signoff
- [ ] Closer cannot punch out until all items complete (checklist, images, deviations commented)
- [ ] Manager can review, approve, or reject the close
- [ ] Approved day: metrics flow into season analytics (revenue, labor %, factor accuracy)

---

### PHASE 3: AUTONOMI (Week 9–12)

_"The system doesn't just record — it reacts. Deviations trigger actions. The AI assistant has answers. The Guardian watches everything."_

---

### Week 9: Botsson Has Answers

**Customer experience:** Sara asks Botsson: "Vilka pass har jag nästa vecka?" Botsson checks the schedule and responds. The manager asks: "Hur ligger vi till mot budget idag?" Botsson checks real-time revenue vs target. An employee asks: "Hur hanterar vi en allergisk reaktion?" Botsson retrieves the allergen protocol and walks through the procedure.

**Roadmaps activated:**

- `R-015: Agent Conversation` — start-hook: user opens chat/voice → stop-hook: question answered, action taken

**Hooks in play:**

- `start-hook:` User activates Botsson (voice button or chat panel)
- `events:` Intent classified, capability selected, tools called, data retrieved, response generated
- `stop-hook:` Conversation ends → memory saved → relationship score updated

**What already exists:** Agent router, intent classifier, tool selector, authority config, 3 capabilities (profile, ui, guardian).

**What we build this week:**

- [ ] `knowledge` capability: searchPolicies, getProcedure, getProtocolStatus — answers governance questions
- [ ] `schedule` capability: getMyShifts, getTeamSchedule, checkAvailability — answers scheduling questions
- [ ] `training` capability: getReadinessScore, getNextProtocol, getProtocolProgress — answers training questions
- [ ] `operations` capability: getTodayStatus, getSessionTasks, getDepartmentMetrics — answers operations questions
- [ ] Memory integration: save conversation topics, retrieve context from past interactions
- [ ] Posture tuning: adjust warmth/formality based on role, situation, and relationship score

**Acceptance criteria:**

- [ ] Botsson can answer questions across all 4 new capabilities (knowledge, schedule, training, operations)
- [ ] Authority config gates what Botsson can do per workspace (read_only → autonomous spectrum)
- [ ] Conversations are saved to engine_memory with embeddings for future retrieval
- [ ] Botsson adapts tone based on who's asking (trainee = warm, manager = concise)

---

### Week 10: The Guardian Sees All

**Customer experience:** The admin opens the Guardian dashboard. Sees all active sessions in real time. An onboarding is stalling — the new hire has been on the same step for 3 minutes. The Guardian sends a whisper: "Behöver du hjälp med det här steget?" The admin sees a training session where an employee failed the knowledge test twice. The Guardian flags it: "Consider pairing this employee with a mentor." The admin can intervene — change a stage, inject a message, or just observe.

**Roadmaps activated:**

- `R-016: Guardian Monitoring` — start-hook: admin opens Guardian dashboard → stop-hook: admin closes dashboard
- `R-017: Guardian Auto-Intervention` — start-hook: evaluation loop detects anomaly → stop-hook: whisper delivered or admin notified

**Hooks in play:**

- `start-hook:` Guardian evaluator loop runs every 30 seconds
- `events:` Session evaluated, data completeness checked, timeout warnings sent, missing field nudges delivered, auto-advance triggered
- `stop-hook:` Session completes or admin intervenes → guardian_log updated

**What already exists:** Guardian evaluator, guardian-bus, WebSocket route, admin dashboard (3 tabs), signal system.

**What we build this week:**

- [ ] Connect Guardian to ALL session types (not just onboarding): training sessions, protocol walkthroughs, daily operations
- [ ] Guardian analytics: aggregate data — avg session duration, completion rates, common stall points
- [ ] Pattern detection: "Employees consistently stall on Step 3 of the allergen protocol — consider revising"
- [ ] Admin intervention tools: force stage change, inject whisper, extend timeout, assign mentor
- [ ] Guardian → notification pipeline: critical signals push to admin's phone, not just dashboard

**Acceptance criteria:**

- [ ] Guardian monitors all active sessions (onboarding + training + operations)
- [ ] Whispers deliver to stalled sessions automatically
- [ ] Analytics show patterns across sessions (which steps cause problems?)
- [ ] Admin can intervene in any session from the Guardian dashboard

---

### Week 11: The Processes Connect

**Customer experience:** Nobody sees this week. But everything starts to feel different. When a new employee joins, a chain reaction fires: invitation accepted → profile created → protocol assignments generated → welcome notification sent → first training session suggested. When a deviation exceeds threshold, a process fires: escalation to manager → if unresolved in 2 hours → escalation to admin → if unresolved in 24 hours → flag for season review. The hooks don't just fire individually — they chain.

**Roadmaps activated:**

- `R-018: Process Engine Orchestration` — start-hook: trigger event fires → stop-hook: process completes all steps

**Hooks in play:**

- `start-hook:` Any system event matching an `engine_trigger`
- `events:` Process steps execute (sequential or parallel), state saved, steps can suspend and wait, delayed triggers fire after timeout
- `stop-hook:` Process reaches final step → outcome recorded → next process may trigger

**What already exists:** engine_process, engine_step, engine_trigger, engine_state, engine_delayed_trigger, engine_event tables. Daily close process defined. engine-dispatch Edge Function.

**What we build this week:**

- [ ] Process definitions for core workflows:
  - `P-001: Employee Onboarding Chain` — invitation → profile → assignments → notification → training suggestion
  - `P-002: Deviation Escalation` — deviation flagged → manager notified → 2h timeout → admin notified → 24h → season review
  - `P-003: Readiness Gate` — protocol completed → recalculate readiness → if 100% → issue readiness certification
  - `P-004: Session Lifecycle` — session created → hooks fire at anchors → close process → reconciliation
- [ ] Process execution engine: step runner with parallel group support and suspend/resume
- [ ] Delayed trigger polling: pg_cron every 60s checks engine_delayed_trigger for due items
- [ ] Process dashboard: admin view of active processes, their state, and completion status
- [ ] Idempotency enforcement: engine_event with idempotency keys prevents duplicate process execution

**Acceptance criteria:**

- [ ] Employee onboarding triggers automatic chain (profile → assignments → notification)
- [ ] Deviations escalate through timed process (manager → admin → review)
- [ ] Processes can suspend and resume on event arrival
- [ ] No duplicate process execution (idempotency verified)

---

### Week 12: The System Reacts

**Customer experience:** Tuesday lunch. Revenue tracking 20% below target at 12:00. The system doesn't wait for someone to notice. Botsson messages the manager: "Omsättning ligger 20% under dagsmål kl 12. Historiskt mönster visar stark 13–14. Föreslår: behåll nuvarande bemanning." At 15:00, the system detects that a closing routine was skipped yesterday. Guardian flags it: "Stängningsrutin missades igår. Eskalerad till dagchef." A training protocol was updated to version 2.0. The system identifies 12 employees who completed v1.0 and auto-generates new assignments.

**Roadmaps activated:**

- `R-019: Proactive Notifications` — start-hook: system detects deviation → stop-hook: notification delivered + acknowledged
- `R-020: Auto-Reassignment` — start-hook: protocol version changes → stop-hook: affected employees re-assigned

**Hooks in play:**

- `start-hook:` Deviation detected by hourly comparison (actual vs target)
- `events:` Notification created, message composed by AI (context-aware), delivered to appropriate role
- `stop-hook:` Recipient acknowledges → deviation tracked in season analytics

**What already exists:** Notification infrastructure (SendGrid, Twilio), Guardian signal system, protocol versioning model.

**What we build this week:**

- [ ] Revenue deviation monitor: hourly check of actual vs season target per department
- [ ] Proactive Botsson messages: context-aware notifications with historical pattern context
- [ ] Missed task detector: scan yesterday's sessions for incomplete mandatory tasks → escalate
- [ ] Protocol version watcher: when protocol version increments → identify affected employees → create new assignments
- [ ] Notification composer: AI generates notification text based on deviation type, severity, and recipient role
- [ ] Acknowledgment tracking: recipient must acknowledge critical notifications → tracked in dashboard

**Acceptance criteria:**

- [ ] Revenue deviations trigger proactive notifications within 1 hour
- [ ] Missed tasks from previous day are detected and escalated before next day's open
- [ ] Protocol version changes auto-generate new assignments for affected employees
- [ ] All critical notifications require acknowledgment

---

### PHASE 4: INTELLIGENCE (Week 13–16)

_"The system learns. It proposes. It drafts. The operator steers — the system drives."_

---

### Week 13: The Season Is Evaluated

**Customer experience:** The season ends. The admin opens Season Review. A comprehensive analysis appears — auto-generated, no manual report building. Revenue: 3.9M of 4.2M target (93%). Labor: 32% (target was 30%). Best day: Saturday March 14 (143% of target). Worst day: Tuesday February 18 (61% of target). Factor accuracy: Fridays were 2.8×, predicted 2.5×. Staffing efficiency: overstaffed Mondays by 1.2 FTE on average. Employee performance: top 5 by points, bottom 5 by readiness velocity. Training: 3 protocols had >30% first-attempt test failure rate.

**Roadmaps activated:**

- `R-021: Season Review` — start-hook: season status → archived → stop-hook: review report generated and stored

**Hooks in play:**

- `start-hook:` Season end date reached → status transitions to `archived`
- `events:` Revenue aggregated, labor calculated, factors compared, staffing analyzed, performance ranked, training gaps identified
- `stop-hook:` Review report persisted → insights extracted → suggestion engine primed

**What already exists:** Season data, reconciliation data, factor system, readiness scores.

**What we build this week:**

- [ ] Season archival trigger: auto-archive when end_date passes → prevent new sessions
- [ ] Review report generator: aggregate season metrics into structured report
- [ ] Factor accuracy calculator: compare predicted factors (day/hour) with actual distribution
- [ ] Staffing efficiency analysis: planned hours vs actual hours vs revenue correlation
- [ ] Training gap report: protocols with high failure rates, slow completion, or low engagement
- [ ] Performance summary: employee rankings by points, readiness velocity, attendance
- [ ] Review dashboard: `/dashboard/season/review` — all metrics in one view

**Acceptance criteria:**

- [ ] Season auto-archives on end_date
- [ ] Review report generates automatically with all metrics
- [ ] Factor accuracy shows predicted vs actual for every day and hour
- [ ] Training gaps and performance rankings are visible to admin

---

### Week 14: The System Proposes

**Customer experience:** The admin opens the Season Planning page. A banner appears: "Baserat på Vår 2026 har vi 7 förslag." Click. "1. Fredagar var 2.8×, inte 2.5×. Justera? 2. Måndag lunch var överbemannad med 1.2 FTE i snitt. Föreslår: minska med 1 person. 3. Temperaturprotokoll hade 35% underkänt första försöket. Föreslår: lägg till instruktionsvideo i steg 3. 4. Lag B presterade 22% bättre på helgkvällar. Föreslår: prioritera Lag B för helgpass nästa säsong." Each suggestion has an "Accept" or "Dismiss" button.

**Roadmaps activated:**

- `R-022: AI Suggestions` — start-hook: season review completed → stop-hook: suggestions generated and presented

**Hooks in play:**

- `start-hook:` Season review report available
- `events:` Pattern analysis runs, factor adjustments calculated, staffing optimizations identified, training improvements suggested
- `stop-hook:` Suggestions presented to admin → admin accepts/dismisses each → accepted suggestions queue for next season

**What already exists:** Season review data (from Week 13), factor system, intelligence pipeline.

**What we build this week:**

- [ ] Suggestion engine: analyze season review → generate typed suggestions (factor_adjustment, staffing_optimization, training_improvement, team_composition)
- [ ] Suggestion UI: list of suggestions with context, impact estimate, and accept/dismiss buttons
- [ ] Accepted suggestion queue: suggestions persist and auto-apply when next season is created
- [ ] Historical comparison: "Last 3 seasons, your Fridays averaged 2.7×" — confidence increases with data
- [ ] Botsson integration: admin can ask "What should I change for next season?" → Botsson summarizes suggestions

**Acceptance criteria:**

- [ ] System generates ≥5 actionable suggestions after each season
- [ ] Each suggestion has type, description, impact estimate, and accept/dismiss
- [ ] Accepted suggestions carry forward to next season creation
- [ ] Confidence level increases with more historical seasons

---

### Week 15: The Next Season Creates Itself

**Customer experience:** The admin opens Season Planning and clicks "Create New Season." Instead of a blank form, a draft appears — pre-filled. "Sommar 2026 (draft) — generated from Vår 2026 review + 3 accepted suggestions." Revenue target adjusted upward (historical growth trend). Day factors updated with accepted adjustments. Team composition suggested based on performance data. Training priorities listed: "3 new hires need allergen protocol. 2 employees need v2.0 re-certification." The admin reviews, tweaks two numbers, and clicks PLAY.

**Roadmaps activated:**

- `R-023: Auto-Generated Season` — start-hook: admin requests new season → stop-hook: draft season created with AI-populated data

**Hooks in play:**

- `start-hook:` Admin clicks "Create New Season" or pg_cron triggers 2 weeks before current season end
- `events:` Historical data analyzed, factors calculated from actuals, team composition suggested, training gaps pre-assigned, budget projected
- `stop-hook:` Draft season saved → admin reviews → PLAY

**What already exists:** Season creation flow, factor system, suggestion queue (from Week 14).

**What we build this week:**

- [ ] Season template generator: create draft season from historical data + accepted suggestions
- [ ] Smart factor initialization: use rolling average of actual factors (weighted toward recent)
- [ ] Team composition suggestion: based on performance data and availability
- [ ] Training gap pre-assignment: identify upcoming protocol needs and pre-create assignments
- [ ] Budget projection: trend-based revenue target with confidence interval
- [ ] Auto-trigger: 2 weeks before season end → suggest creating next season (notification to admin)
- [ ] One-click PLAY: review draft → adjust → activate in minimal steps

**Acceptance criteria:**

- [ ] New season draft is pre-populated from historical data
- [ ] Accepted suggestions from previous season are applied automatically
- [ ] Admin can go from "Create" to "PLAY" by reviewing and tweaking — not building from scratch
- [ ] System proactively suggests creating next season before current one ends

---

### Week 16: Evolution

**Customer experience:** The system runs. The admin opens the dashboard and sees today's status — not because they need to act, but because they want to know. Revenue is tracking 105% of target. All department sessions are active. Two employees are in training sessions — Botsson is guiding them. The daily close from yesterday was approved at 07:15 by the morning manager. Three new employees joined this week — all have their protocol assignments, all are at 12% readiness after their first day. The season is 6 weeks in — gamification is driving engagement, the leaderboard shows healthy competition.

The system proposes a mid-season adjustment: "Revenue is 5% above target. Day factors suggest we're underestimating Thursdays. Adjust?" The admin approves with one tap.

A new regulation comes in — updated allergen labeling requirements. The admin creates a new policy. The system generates a protocol, suggests procedure steps based on the regulation text, and auto-assigns to all affected employees. Botsson will guide them through it next time they log in.

Nothing crashed. Nothing was forgotten. Nothing slipped through. The event motor runs — start-hook, events, stop-hook — for every workflow, every day, every employee. The operator is present. The system drives.

**Roadmaps activated:**

- All 23 Roadmaps are active and self-sustaining
- `R-024: Mid-Season Adjustment` — start-hook: system detects significant variance → stop-hook: admin approves/dismisses adjustment
- `R-025: Regulation Response` — start-hook: admin creates new policy → stop-hook: protocol auto-generated, employees auto-assigned

**What we build this week:**

- [ ] Mid-season factor adjustment: detect variance > threshold → propose adjustment → admin approves
- [ ] Regulation response pipeline: new policy → AI generates protocol draft → admin reviews → activate → auto-assign
- [ ] System health dashboard: all Roadmaps, their status, last execution, error rate
- [ ] Self-healing processes: failed process steps retry with exponential backoff, notify admin after 3 failures
- [ ] Autonomy metrics: % of workflows that complete without human intervention
- [ ] Evolution report: season-over-season improvement in factor accuracy, training completion velocity, revenue target hit rate

**Acceptance criteria:**

- [ ] System detects and proposes mid-season adjustments automatically
- [ ] New policy → protocol → assignments happens with minimal admin input
- [ ] Autonomy metric > 90% (9 of 10 workflows complete without human intervention)
- [ ] Season-over-season metrics show measurable improvement

---

## Summary: The 25 Roadmaps

| #     | Roadmap                      | Phase         | Week |
| ----- | ---------------------------- | ------------- | ---- |
| R-001 | Sign Up & Create Workspace   | Grundläggning | 1    |
| R-002 | Create Policy & Protocol     | Grundläggning | 2    |
| R-003 | Build Procedure              | Grundläggning | 2    |
| R-004 | Invite & Onboard Employee    | Grundläggning | 3    |
| R-005 | Employee First Login         | Grundläggning | 3    |
| R-006 | Configure Season             | Grundläggning | 4    |
| R-007 | Season PLAY                  | Grundläggning | 4    |
| R-008 | Publish Weekly Schedule      | Operationell  | 5    |
| R-009 | Employee Shift Self-Service  | Operationell  | 5    |
| R-010 | Complete Protocol Training   | Operationell  | 6    |
| R-011 | Knowledge Test               | Operationell  | 6    |
| R-012 | Daily Department Operation   | Operationell  | 7    |
| R-013 | Daily Financial Close        | Operationell  | 8    |
| R-014 | Manager Reconciliation       | Operationell  | 8    |
| R-015 | Agent Conversation           | Autonomi      | 9    |
| R-016 | Guardian Monitoring          | Autonomi      | 10   |
| R-017 | Guardian Auto-Intervention   | Autonomi      | 10   |
| R-018 | Process Engine Orchestration | Autonomi      | 11   |
| R-019 | Proactive Notifications      | Autonomi      | 12   |
| R-020 | Auto-Reassignment            | Autonomi      | 12   |
| R-021 | Season Review                | Intelligence  | 13   |
| R-022 | AI Suggestions               | Intelligence  | 14   |
| R-023 | Auto-Generated Season        | Intelligence  | 15   |
| R-024 | Mid-Season Adjustment        | Intelligence  | 16   |
| R-025 | Regulation Response          | Intelligence  | 16   |

---

## The Motor Runs

```
Week  1 ████░░░░░░░░░░░░  Workspace born
Week  2 ████████░░░░░░░░  Governance active
Week  3 ████████████░░░░  Team invited, readiness tracking
Week  4 ████████████████  First season: PLAY

Week  5 ████░░░░░░░░░░░░  Schedule publishing
Week  6 ████████░░░░░░░░  Training running
Week  7 ████████████░░░░  Days run themselves
Week  8 ████████████████  Days close themselves

Week  9 ████░░░░░░░░░░░░  Botsson has answers
Week 10 ████████░░░░░░░░  Guardian sees everything
Week 11 ████████████░░░░  Processes chain together
Week 12 ████████████████  System reacts to deviations

Week 13 ████░░░░░░░░░░░░  Season evaluated
Week 14 ████████░░░░░░░░  System proposes improvements
Week 15 ████████████░░░░  Next season auto-generated
Week 16 ████████████████  Evolution — the system drives itself
```

Every week activates new Roadmaps. Every Roadmap follows the Event Motor. Every event flows through start-hook → events → stop-hook. After 16 weeks, 25 Roadmaps run in harmony. The operator is present. The system drives.

---

_Prepare the motor. Start the hooks. Let it run._

_That's Module Zero._
