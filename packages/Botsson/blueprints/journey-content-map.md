---
title: "Journey & Content Map — Botsson Reference"
status: draft
updated: 2026-03-10
created: 2026-03-10
module: Botsson
tags: [blueprint, journey, content, missions, roadmap]
---

# Journey & Content Map — Botsson Reference

This document maps every content layer that Botsson must understand, ingest, and operationalize. It covers skills, journey packages, mission definitions, engine architecture, voice tooling, and knowledge systems as they exist in the Smartout codebase.

---

## Layer 1: Skills & Methodologies

Source: `.claude/skills/`

These skills define the structured workflows for creating, training, and scoring AI-driven journeys. Botsson inherits their patterns.

### 1.1 roadmap.md — Journey Package Foundation

- **Purpose:** Create the Roadmap artifact — the first document in a Journey Package. Defines WHAT, for WHOM, and WHY.
- **Triage pattern:** Assess confidence (HIGH/MEDIUM/LOW) based on 5 signals (similar journey exists, module documented, clear actor+intent, related packages exist). HIGH auto-drafts, MEDIUM asks targeted questions, LOW runs a wizard.
- **9 knowledge gates** (all must pass before generating):

| #   | Gate             | Question                                           |
| --- | ---------------- | -------------------------------------------------- |
| 1   | Journey ID       | Which J-NNN or new?                                |
| 2   | Module           | onboarding, scheduling, operations, training, etc. |
| 3   | Actor            | employee, manager, admin, owner, agent             |
| 4   | Platform         | web, mobile, both                                  |
| 5   | Business intent  | 1-2 sentences: what + why                          |
| 6   | Scope            | In scope / out of scope                            |
| 7   | Success criteria | Measurable completion                              |
| 8   | Related journeys | Requires, leads to, opposite                       |
| 9   | Priority         | P0/P1/P2/P3                                        |

- **Output:** `docs/Roadmaps/{slug}/Roadmap.md` with YAML frontmatter, Package Identity (R-NNN, J-NNN, M-NNN, L-NNN), Business Intent, Scope, Success Criteria, Related Journeys, Event Motor Pattern (start-hook, events, stop-hook).

### 1.2 journey.md — Deep Spec Builder

- **Purpose:** Create the Journey artifact — the executable specification. Every button, event, notification, DB write, screen state.
- **10 per-step dimensions** (P0 Full):

| #   | Dimension       | Key fields                                                                                        |
| --- | --------------- | ------------------------------------------------------------------------------------------------- |
| 1   | Action          | description, type (tap/swipe/form_submit/navigate/drag/long_press/scan/voice/system_auto), target |
| 2   | UI Elements     | testId, type, label (Norwegian), variant, visible/disabled conditions                             |
| 3   | Screen States   | name, condition, display, illustration, CTA                                                       |
| 4   | Data Operations | table, operation, fields, condition, RLS policy, index                                            |
| 5   | Events          | emitted (name, payload, consumers), listened to, side effects                                     |
| 6   | Notifications   | template, channels, recipient, title/body (NO), deep link, priority                               |
| 7   | Gamification    | base points, season multiplier, conditional bonuses, achievements, streaks                        |
| 8   | Compliance      | audit entries, legal checks                                                                       |
| 9   | Errors          | trigger, code, user message (NO), recovery, severity, notify admin                                |
| 10  | Expects         | description, assertions (type, selector, expected, timeout)                                       |

- **3 priority tiers:**

| Tier        | Dimensions required                          |
| ----------- | -------------------------------------------- |
| P0 Full     | All 10                                       |
| P1 Medium   | 6: action, ui, data, events, errors, expects |
| P2 Skeleton | 3: action, data, expects                     |

- **AI Council validation:** Every journey checked against 7 restaurant personas.
- **Playwright recording integration:** Parses recorded actions into steps with selectors and routes.
- **Niche focus multipliers:** Industry-specific weights (0.7-1.5) per dimension.

### 1.3 mission.md — Agent Execution Builder

- **Purpose:** Create the Mission artifact — the agent execution contract. What the agent does, decides, and tracks at every stage.
- **Triage gate:** Not every journey needs a mission. Only when agent asks questions, makes decisions, or calls tools.
- **Stage chain:** `stage1 -> stage2 -> ... -> stageN -> NULL` (unbroken, no orphans).
- **Two-tool advance pattern:**
  1. `advanceToNextSection` — client tool, scrolls UI
  2. `advance` — engine HTTP tool, transitions session + rebuilds prompt
  - Terminal stage: calls `advanceToNextSection` but NOT `advance`.
- **Three pillars:**

| Pillar         | What it defines                                                                                                                                    |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Results        | session_success, stage_success, quality_score                                                                                                      |
| Trackability   | timing thresholds, failure signals (abandon, rage_quit, stuck, loop, timeout), guardian watches (data_writes, required_confirmation, auto_advance) |
| Triggerability | trigger condition, test invocation, mission_training_link                                                                                          |

- **Guardian integration:** Automatic through event bus. Guardian evaluates stages via `journey_step_id` FK. Checks data completeness, timing, auto-advance. Intervenes via whispers to `collected_data._whispers[]`.
- **System prompt 3-layer structure:**
  1. Mission base prompt (identity, personality, tools overview, global rules, language rule)
  2. Per-stage instructions (goal, tool calls, transition pattern)
  3. Context (identity, workspace, custom, journey progress, collected data)
- **Seed SQL:** Idempotent migration with `ON CONFLICT ... DO UPDATE`.

### 1.4 mission-training.md — Training Workflow

- **5-phase workflow:**

| Phase        | Activities                                                                                                                  |
| ------------ | --------------------------------------------------------------------------------------------------------------------------- |
| 1. Design    | Mission goal, stage breakdown, chain, tool identification, user manuscript                                                  |
| 2. Implement | Seed SQL, client tool wiring, frontend sections, registry update, cross-layer registries                                    |
| 3. Verify    | Type safety, stale references, cross-layer consistency, chain integrity, two-tool advance, phantom tool check, data flow    |
| 4. Test      | Dry run (read aloud), tool audit, chain walk, live test, agent scoring                                                      |
| 5. Iterate   | Fix symptoms: stuck agent, skipped data, monologues, wrong tools, UI not scrolling, prompt not updating, repeated questions |

- **Phantom tool detection:** Legacy names that do NOT exist and must never appear in instructions:

| Phantom       | Real replacement                 |
| ------------- | -------------------------------- |
| `navigate_to` | `advanceToNextSection`           |
| `fill_field`  | `updateBusiness` / specific tool |
| `show_panel`  | `addKeyFact`                     |
| `show_toast`  | (sonner toast)                   |

- **Prompt builder context:** 13-part assembly in `buildStagePrompt()` — mission personality, personality override, emotion hint, creative freedom, goal+instructions, success criteria, escalation, context, journey enrichment, progress, collected data, after-action, tuning notes.

### 1.5 agent-scoring-SKILL.md — Agent Self-Evaluation

- **5 posture dimensions** (scale 0-10, scored against target posture per agent):

| Dimension  | Measures                                       |
| ---------- | ---------------------------------------------- |
| Warmth     | Tone, empathy, approachability                 |
| Directness | Clarity, conciseness, action-orientation       |
| Formality  | Register, professionalism, structure           |
| Patience   | Pacing, tolerance, willingness to re-explain   |
| Authority  | Confidence, decisiveness, expertise projection |

- **4 extension dimensions:**

| Dimension       | Measures                                |
| --------------- | --------------------------------------- |
| Tool Accuracy   | Right tool, correct parameters          |
| Context Usage   | Leveraged AgentContext data             |
| Goal Completion | Achieved encounter objective            |
| Error Recovery  | Handled failures, confusion, edge cases |

- **Agent-specific extensions:** Lise adds Data Quality + Stage Flow. HACCP Inspector adds Compliance Accuracy. Shift Assistant adds Schedule Correctness.
- **Encounter logging:** Required after every session. Includes posture scores, extension scores, tool calls, findings, self-assessment.
- **Composite score:** `(Posture Avg + Extension Avg) / 2`
- **Engine-architect audit:** Checks score consistency, trend direction, recurring issues, tool failure rate, completion rate, observer delta.

---

## Layer 2: Active Journey Packages

Source: `docs/Roadmaps/`

### 2.1 Admin Onboarding (R-001, J-001, M-001)

- **Package:** `JP-R001-ADMIN-ONBOARDING`
- **Actor:** Owner (admin) | **Platform:** Web (desktop) | **Priority:** P0
- **Business intent:** New owner goes from zero to operational workspace in ~5 minutes via Botsson voice conversation.
- **Scope:** Account creation, Brreg search, Google Places + Scrapling enrichment, AI-assisted or manual mode, season/department/location/zone/procedure setup, contract template, workspace finalization.
- **Onboarding wizard:** 15 step components + 4 drawers + `useOnboardingWizard` hook (ADR-0041). Steps extracted from 1,882-line monolith into independent components.
- **Mission stages (8):** Opening -> Business Info -> Season -> Departments -> Locations -> Procedures -> Contract -> Finalization.
- **Agent:** Botsson. Voice: Mark. Temperature: 0.6. Language: Norwegian. Max 1800s. First speaker: user.
- **Key personality rule:** DESCRIBE, SUGGEST, CONFIRM. Never ask open questions without first giving information.
- **11 client tools:** `updateBusiness`, `addDepartments`, `addLocations`, `addZones`, `addProcedures`, `updateSeason`, `triggerScrape`, `addKeyFact`, `saveMemory`, `advanceToNextSection`, `getOnboardingState` (+ `finalizeOnboarding`).
- **Event motor:** Start: user clicks "Kom i gang" -> auth -> no workspace -> `/onboarding`. Stop: `workspace.finalized` -> redirect to `/dashboard`.

### 2.2 Check My Schedule (R-011, J-011)

- **Package:** `JP-R011-CHECK-MY-SCHEDULE`
- **Actor:** Employee | **Platform:** Mobile | **Priority:** P1
- **Business intent:** Employee views upcoming published shifts — most-used action in the app.
- **Scope:** Calendar/list view of own published shifts, tap for details (time, location, role, colleagues), week navigation.
- **Out of scope:** Editing, swapping, creating shifts, viewing others' schedules.
- **Success criteria:** Shifts visible within 2 seconds of navigation. Correct time, location, role, colleagues per shift.
- **Mission needed:** TBD (likely No — read-only UI journey).

### 2.3 Punch Into Shift (R-019, J-019 GOLD STANDARD)

- **Package:** `JP-R019-PUNCH-INTO-SHIFT`
- **Actor:** Employee | **Platform:** Mobile | **Priority:** P0 | **Depth:** P0 Full (all 10 dimensions)
- **Trigger:** Employee arrives at workplace, opens app. Punch In button visible when shift starts within +/- 30 min.
- **Preconditions (6):** Authenticated, profile active/trainee, shift exists within window, shift assigned to profile, no active punch, Operations module active.
- **Tags:** `write`, `gps`, `gamification`, `real-time`, `audit-trail`, `sandbox`
- **AI Council validation:** All 7 personas applicable. Each validated with specific notes (multi-site manager needs cross-location visibility, fast-food worker needs big button + clear confirmation, low-literacy worker needs visual confirmation + minimal text).
- **Gold standard reference:** This journey serves as the format template for all P0 deep specs.

---

## Layer 3: Mission Registry

Source: `packages/ai/src/missions/registry.ts`

### 3.1 Registered Missions

| Mission ID             | Agent             | Voice       | Temp | Max Duration | First Speaker | Channel |
| ---------------------- | ----------------- | ----------- | :--: | :----------: | :-----------: | ------- |
| `onboarding-interview` | Botsson           | Mark        | 0.6  |    1800s     |     user      | voice   |
| `landing-demo`         | Lise              | custom UUID | 0.5  |     600s     |     agent     | voice   |
| `mr-botsson`           | Mr. Botsson       | mark        | 0.3  |    1800s     |     user      | voice   |
| `haccp-inspector`      | HACCP-inspektoren | sarah       | 0.2  |     900s     |     agent     | voice   |
| `shift-assistant`      | Vaktassistenten   | tina        | 0.3  |     900s     |     user      | voice   |

### 3.2 Mission Type System

Source: `packages/ai/src/missions/types.ts`

- **MissionId:** Zod enum of 5 values (validated at runtime).
- **AgentMission:** Full config type — id, name, description, systemPrompt, voice, language (no/en/sv), temperature, maxDurationSeconds, firstSpeaker, initialOutputMedium, templateContext, agentDisplayName, greeting, uiDescription, stages, clientTools.
- **MissionStageOverride:** Per-stage voice, temperature, and posture overrides (formality, assertiveness, warmth, humor, verbosity).
- **VoiceProvider:** Ultravox built-in voices (terrence, mark, jessica, sarah, tina) or custom UUID.
- **clientTools format:** Array of `temporaryTool` objects with `modelToolName`, description, `dynamicParameters` (name, location, schema, required), and `client: {}` marker.

### 3.3 System Prompt Structure (Per Mission)

Each mission's `systemPrompt` follows a 3-layer structure:

1. **Mission layer** — Agent identity, personality traits, global rules
2. **Context layer** — Available tools with descriptions, workflow rules
3. **Stage layer** — Per-stage instructions injected by `buildStagePrompt()` at runtime (13 parts)

---

## Layer 4: Systems & Engines

### 4.1 System Intelligence

Source: `docs/engines/system-inteligence/`

| Document                              | Content                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `00-core-state-engine.md`             | Canonical state model. 6 state domains: session, journey, task/procedure, notification, agent interaction, readiness. Transition rules, guard conditions, audit contract.                                                                                                                                                                                                                            |
| `01-system-architecture-contracts.md` | Runtime contracts for APIs, events, schema versioning, integrations.                                                                                                                                                                                                                                                                                                                                 |
| `02-agent-framework-runtime.md`       | Agent roles (orchestrator, specialist, guardian, QA/test), capability registry, authority model (read/write/escalate per workspace), memory model (session + persistent), conflict model (user override handling). Decision flow: `intent -> policy check -> authority check -> tool execution -> state transition -> verification`.                                                                 |
| `04-state-machine-governance.md`      | Design rules, guardrails, rollback, migration guidance.                                                                                                                                                                                                                                                                                                                                              |
| `07-journey-package-compiler.md`      | 9-artifact package contract: Roadmap, Journey, Mission, License, User Test, Knowledge Test, Function Test, E2E Test Script, API Contract Extract. Runtime binding: `start-hook -> mission + journey execution -> test gates -> stop-hook -> certification/reporting`.                                                                                                                                |
| `08-event-envelope-spec.md`           | Canonical envelope for all runtime events. Fields: event_id, event_name, event_version, occurred_at, workspace_id, correlation_id, causation_id, source (domain/service/component), actor (type/id/role), subject (kind/id), state (from/to), severity, payload, tags, provenance (channel/request_id/trace_id). Source domains: journey, process, guardian, notification, agent, integration, test. |
| `09-gold-package-admin-onboarding.md` | Fully linked example package for R-001 with mission/license/test bindings.                                                                                                                                                                                                                                                                                                                           |

### 4.2 Industry Intelligence

Source: `docs/engines/industri-inteligence/hospitalety/`

Current scope: **Restaurant** (Industry-0).

| Folder                         | Content                                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `00-engine-core.md`            | Core architecture contract. Boundary between system layer and industry layer.                                            |
| `01-ai-council/`               | 7-persona council for journey validation.                                                                                |
| `02-default-policies/`         | Policy baselines mapped to template assets. Required before journeys and tests.                                          |
| `03-templates/`                | 3 template families: business structure, task pipeline, journey. Each has a contract doc + restaurant-specific instance. |
| `04-research/`                 | Consolidated research pack: workflows, summaries, proven knowledge, tactics, KPIs.                                       |
| `05-testing/`                  | Persona-aware test profiles (automated, manual, A/B, security).                                                          |
| `06-relevance-map/`            | Map of where each artifact is used in system delivery.                                                                   |
| `07-company-handbook/`         | Restaurant company handbook template.                                                                                    |
| `08-role-capability-profiles/` | Role knowledge/skills/training readiness per restaurant role.                                                            |
| `09-environment-profile/`      | Operating environment baseline (physical context for templates and testing).                                             |
| `10-niche-profiles/`           | Business-specific specialization. Taxonomy, profile template, skeleton. First concrete niche: Italian Premium Service.   |

### 4.3 AI Council — 7 Personas

Source: `docs/engines/industri-inteligence/hospitalety/01-ai-council/restaurant-council.md`

| #   | Persona                               | Focus                                             | High risk if...                             |
| --- | ------------------------------------- | ------------------------------------------------- | ------------------------------------------- |
| 1   | Multi-site Restaurant Manager         | Operational control, speed, compliance            | Workflows too slow, hide staffing gaps      |
| 2   | Back-office Admin                     | Auditability, exports, policy enforcement         | Exports, audit traces, policy status weak   |
| 3   | External Hospitality Consultant       | Scalability, adoption risk, ROI                   | Setup can't scale or measure ROI            |
| 4   | Career Hospitality Professional       | Practical workflow fit during live service        | Flow breaks under service pressure          |
| 5   | Fast-food Entry Worker                | Language access, onboarding clarity, confidence   | Onboarding language-heavy, confidence drops |
| 6   | Low-literacy Worker                   | Dignity-preserving UX, visual-first, minimal text | Dignity-preserving interaction absent       |
| 7   | Sommelier / High-education Specialist | Depth, quality, advanced workflow fidelity        | Advanced quality workflows over-simplified  |

Composition: `System intelligence (global) + Industry intelligence (specialization) -> User-facing execution`

---

## Layer 5: Architectural Decisions

Key ADRs that define Botsson's operational context.

| ADR      | Title                                | Decision                                                                                                                                                                                                                                                                                             |
| -------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ADR-0042 | Agent Architecture                   | Extend Stage Engine with Agent Mode. Composable capability layers replace rigid engine model. Intent classifier with confidence escape hatch. Persistent memory (`engine_memory` + pgvector). Per-workspace authority (`engine_authority_config`). Vercel AI SDK over Anthropic Agent SDK.           |
| ADR-0049 | Agent SDK Package                    | Extract `@smartout/agent-sdk` from duplicated `useBotsson`. Single `useAgent(config)` hook. VoiceProvider interface (Ultravox + LiveKit). ClientTool registry with definition+implementation bundled. `buildToolKit()` converts to provider format.                                                  |
| ADR-0052 | Guardian WebSocket Architecture      | Direct WebSocket from stage engine at `/guardian/ws`. Zero-latency event delivery. Bidirectional: subscribe, change_stage, whisper. Events both broadcast AND persisted to `guardian_log`. All emission through `emitGuardianEvent()` in `guardian-bus.ts`. (Renumbered from ADR-0049 on 2026-04-07) |
| ADR-0051 | Unified AI Runtime System Definition | Single canonical runtime spec: `AI_RUNTIME_SYSTEM_DEFINITION_V1.md`. Mission mode, agent mode, guardian, guard-rails share one coherent model. All runtime contracts (contract envelope, context envelope, event envelope) centralized.                                                              |
| ADR-0041 | Onboarding Wizard Step Architecture  | Step components with context hook. 15 step components + 4 drawers. `useOnboardingWizard` centralizes progressive save, auth tracking, finalization. `STEP_COMPONENTS` map in page.tsx.                                                                                                               |
| ADR-0038 | Journey Agent & Output Generators    | AI-assisted journey definition wizard. 4 output generators (E2E Test, Doc, Linear, Botsson). 3 agent tools (lookup_journeys, check_duplicates, save_draft). 6 wizard phases: discovery -> classification -> steps -> testing -> documentation -> review.                                             |

---

## Layer 6: Voice & Client Tooling

### 6.1 Agent SDK Types

Source: `packages/ai/src/missions/types.ts`

| Type                   | Purpose                                                           |
| ---------------------- | ----------------------------------------------------------------- |
| `AgentMission`         | Full mission config (id, prompt, voice, tools, stages)            |
| `MissionId`            | Zod-validated enum of registered missions                         |
| `MissionStageOverride` | Per-stage voice, temperature, posture overrides                   |
| `UltravoxVoice`        | Built-in voices or custom UUID                                    |
| `MissionManifestEntry` | Lightweight mission info for UI lists                             |
| `ClientTool`           | Tool definition (name, description, params) + `client: {}` marker |

### 6.2 VoiceProvider Architecture

Source: ADR-0049 (`@smartout/agent-sdk`)

- **Interface:** `VoiceSession` wrapping provider-specific clients
- **Providers:** Ultravox (primary), LiveKit (fallback/alternative)
- **Hook:** `useAgent(config: AgentConfig): AgentSession` — single hook replacing all voice implementations
- **Registry:** `createToolRegistry()` for mutable, dynamic tool sets

### 6.3 Onboarding Client Tools (11)

Registered in `useBotsson.ts` as Ultravox `temporaryTool` with `client: {}`:

| Tool                   | Purpose                                |
| ---------------------- | -------------------------------------- |
| `getOnboardingState`   | Read current wizard form state         |
| `updateBusiness`       | Fill/correct business form fields      |
| `addDepartments`       | Create department entries              |
| `addLocations`         | Add physical locations                 |
| `addZones`             | Add zones within a location            |
| `addProcedures`        | Toggle/add procedure entries           |
| `updateSeason`         | Set season name and dates              |
| `triggerScrape`        | Start web scraping (Scrapling service) |
| `addKeyFact`           | Show key fact in UI panel              |
| `saveMemory`           | Persist to `engine_memory`             |
| `advanceToNextSection` | Scroll UI to next wizard section       |

### 6.4 Engine HTTP Tools (4)

Built by `buildUltravoxTools()` in `services/stage-engine/src/lib/ultravox.ts`. Available to ALL missions:

| Tool                | Purpose                                |
| ------------------- | -------------------------------------- |
| `store`             | Save collected data to `engine_inbox`  |
| `fetch`             | Retrieve context, inbox, stage history |
| `advance`           | Move to next stage + rebuild prompt    |
| `getJourneyContext` | Check journey progress and timing      |

### 6.5 Schedule Tools (Shift Assistant)

Defined in `packages/ai/src/tools/schedule.ts`, shipped via `clientTools` on the `shift-assistant` mission:

| Category   | Tools                                                                       |
| ---------- | --------------------------------------------------------------------------- |
| Read       | `getScheduleState`, `getShiftsForDay`, `getEmployeeSchedule`, `getCoverage` |
| Write      | `createShift`, `updateShift`, `deleteShift`, `publishShifts`                |
| Navigation | `focusDay`, `openDayPlanner`, `closeDayPlanner`                             |

---

## Layer 7: Knowledge Systems

### 7.1 Journey Registry

Source: `docs/modules/journey/SMARTOUT_JOURNEY_REGISTRY.md`

- **68+ journeys** across 18 modules.
- **12-status lifecycle:** Idea -> Wizard -> Defined -> Ready for Implementation -> Under Construction -> In Review -> Ready for Testing -> Testing -> Ready for Validation -> Implemented -> Active/Inactive/Broken.
- **5 outputs per journey:** User Journey, E2E Test, Onboarding Doc, Linear Issue, Mr. Botsson Script.
- **6 actors:** Employee, Trainee, Manager, Admin, Owner, All.
- **4 priority levels:** P0 (critical path), P1 (important), P2 (nice to have), P3 (future).

### 7.2 Module Distribution

| Module                | Journey Count |
| --------------------- | :-----------: |
| Core                  |       3       |
| Onboarding            |       5       |
| Org Structure         |       2       |
| Scheduling            |       8       |
| Operations            |       7       |
| HACCP                 |       4       |
| Training              |       5       |
| Absence               |       3       |
| Payroll               |       3       |
| Communication         |       4       |
| Reports               |       4       |
| Settings              |       3       |
| AI (Mr. Botsson)      |       3       |
| Season                |       3       |
| Governance            |       2       |
| Contracts             |       3       |
| Certifications        |       2       |
| Journey Portal (meta) |       4       |
| **Total**             |    **68**     |

### 7.3 Mission Registry

Source: `packages/ai/src/missions/registry.ts`

5 registered missions with full system prompts, voice configs, and tool sets. Exported via `getMission(id)`, `listMissions()`, `getMissionIds()`.

### 7.4 Capability Layers (Agent Mode — ADR-0042)

10 composable capabilities replacing the rigid 8-engine model:

| Capability    | Domain                                          |
| ------------- | ----------------------------------------------- |
| Profile       | Employee identity, status, readiness            |
| Schedule      | Shift viewing, planning, coverage               |
| Training      | Protocol assignments, progress, completion      |
| Operations    | Department sessions, daily tasks, deviations    |
| HACCP         | Temperature logging, control points, deviations |
| Communication | Announcements, messages, notifications          |
| Governance    | Policies, procedures, routines                  |
| Season        | Season management, budget, leaderboard          |
| Reports       | KPIs, reconciliation, analytics                 |
| Memory        | Long-term recall, semantic search (pgvector)    |

Each capability is a self-contained module with its own tools, prompts, and authority requirements. Per-workspace authority control via `engine_authority_config`: autonomous, notify_suggest, notify, escalate, or never.

---

## Layer 8: Stage Engine Architecture

### 8.1 Session Lifecycle

```
createSession() -> "session.started" event
  -> stage active (stage_started_at tracked)
  -> agent conversation (user.message, agent.response events)
  -> data collection (data.collected -> Guardian evaluation)
  -> advanceStage() -> "stage.changed" event -> prompt rebuild
  -> ... repeat per stage ...
  -> terminal stage (next_stage = NULL)
  -> "session.completed" event
```

### 8.2 Guardian System

- **Evaluation cycle:** Every 30 seconds + on data.collected events.
- **Scope:** Only stages with `journey_step_id` set (non-NULL).
- **Checks per stage:** `data_writes` completeness, `min_duration_seconds`, `max_duration_seconds`, `required_confirmation`.
- **Intervention mechanism:** Writes to `collected_data._whispers[]` — invisible system instructions to agent.

| Intervention    | Trigger                                                             | Action                                            |
| --------------- | ------------------------------------------------------------------- | ------------------------------------------------- |
| Auto-advance    | All data collected + min_duration passed + no required_confirmation | Calls `advanceStage()` directly                   |
| Nudge confirm   | All data + required_confirmation + 30s elapsed                      | Whispers: "Spor bruker om bekreftelse"            |
| Missing field   | 60s elapsed + fields missing                                        | Whispers: "Spor om: {missing fields}"             |
| Timeout warning | 80% of max_duration                                                 | Whispers: "{N} sekunder igjen, mangler: {fields}" |
| Hard timeout    | 100% of max_duration                                                | Whispers: "Timeout — avslutt steget"              |

### 8.3 Event Types

| Event                      | Actor    | When                        |
| -------------------------- | -------- | --------------------------- |
| `session.started`          | system   | Session created             |
| `stage.changed`            | system   | Stage advanced              |
| `data.collected`           | agent    | Data stored via `/store`    |
| `user.message`             | user     | User sends message          |
| `agent.response`           | agent    | Agent replies               |
| `session.completed`        | system   | All stages done             |
| `session.abandoned`        | system   | Session abandoned           |
| `guardian.auto_advance`    | guardian | Auto-advanced a stage       |
| `guardian.nudge`           | guardian | Nudged for missing data     |
| `guardian.nudge_confirm`   | guardian | Asked for user confirmation |
| `guardian.timeout`         | guardian | Stage timed out             |
| `guardian.timeout_warning` | guardian | 80% of max duration reached |
| `admin.stage_change`       | admin    | Admin forced stage change   |
| `admin.whisper`            | admin    | Admin sent whisper to agent |

### 8.4 Admin Dashboard (Guardian Monitor)

WebSocket at `/guardian/ws` (ADR-0052). Capabilities:

- **Watch** — all events in real-time
- **Subscribe** — filter to specific session
- **Whisper** — inject invisible instructions mid-conversation
- **Change stage** — force agent to different stage

---

## Layer 9: Botsson Content Sources & Capabilities

### 9.1 What Botsson Ingests

| Source               | Path                                                   | Content Type                                                            |
| -------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------- |
| Skills               | `.claude/skills/*.md`                                  | Structured methodologies (roadmap, journey, mission, training, scoring) |
| Roadmaps             | `docs/Roadmaps/*/Roadmap.md`                           | Business intent, scope, success criteria per journey                    |
| Journeys             | `docs/Roadmaps/*/Journey.md`                           | Deep specs with 10-dimension step definitions                           |
| Missions             | `docs/Roadmaps/*/Mission.md`                           | Agent execution contracts with stage chains                             |
| Mission registry     | `packages/ai/src/missions/registry.ts`                 | Runtime mission configs with system prompts                             |
| Mission types        | `packages/ai/src/missions/types.ts`                    | TypeScript type definitions for agent configs                           |
| System engine docs   | `docs/engines/system-inteligence/`                     | State engine, agent framework, event envelopes, journey compiler        |
| Industry engine docs | `docs/engines/industri-inteligence/`                   | AI council, policies, templates, role capabilities, niche profiles      |
| Journey registry     | `docs/modules/journey/SMARTOUT_JOURNEY_REGISTRY.md`    | 68+ journey definitions with lifecycle tracking                         |
| ADRs                 | `docs/decisions/*.md`                                  | Architectural decisions constraining implementation                     |
| DB schema            | `packages/supabase/src/database.types.ts`              | Auto-generated types — tables, enums, RLS                               |
| Tool definitions     | `packages/ai/src/tools/`                               | Client-side tool definitions (schedule, etc.)                           |
| Stage engine         | `services/stage-engine/`                               | Session management, prompt builder, Guardian, WebSocket                 |
| Runtime definition   | `docs/architecture/AI_RUNTIME_SYSTEM_DEFINITION_V1.md` | Canonical AI runtime spec (ADR-0051)                                    |

### 9.2 What Botsson Enables

| Capability                | Description                                                                       |
| ------------------------- | --------------------------------------------------------------------------------- |
| Journey authoring         | Create new journey packages (roadmap -> journey -> mission) using skill workflows |
| Mission training          | Design, implement, verify, test, and iterate on agent missions                    |
| Agent scoring             | Self-evaluate and log agent performance with posture + extension dimensions       |
| Stage chain validation    | Verify unbroken chains, no orphans, correct advance patterns                      |
| Phantom tool detection    | Catch legacy tool references that would cause agent hallucination                 |
| Guardian wiring           | Ensure journey_step_id, data_writes, timing thresholds are correctly set          |
| AI Council validation     | Check every journey against 7 industry personas for risk                          |
| Niche specialization      | Apply business-specific focus multipliers to journey definitions                  |
| Event envelope compliance | Verify all events follow canonical envelope schema                                |
| Cross-layer consistency   | Validate sections = components = labels = colors = CSS vars                       |

### 9.3 Content Relationships

```
Journey Registry (68 journeys)
  -> Roadmap (business intent, scope)
    -> Journey (deep spec, 10 dimensions)
      -> Mission (agent execution, stages)
        -> Seed SQL (engine_missions + engine_stages)
          -> Stage Engine (runtime execution)
            -> Guardian (monitoring + intervention)
              -> Admin Dashboard (real-time visibility)

Industry Engine (restaurant)
  -> AI Council (7 personas) -> Journey validation
  -> Default Policies -> Policy gates per step
  -> Templates -> Journey building blocks
  -> Role Capabilities -> Preconditions
  -> Niche Profiles -> Focus multipliers
```

---

## Appendix: Quick Reference

### Journey Package Artifacts (9)

1. Roadmap — "What should happen?"
2. Journey — "What does the user do and see?"
3. Mission — "What does the agent do and decide?"
4. License — "What is allowed, required, and blocked?"
5. User Test — human experience validation
6. Knowledge Test — understanding and retention validation
7. Function Test — system behavior and integration validation
8. E2E Test Script — automation
9. API Contract Extract — endpoints, schema, side effects

### Creative Freedom Scale

| Stage type              |  Value  | Rationale                        |
| ----------------------- | :-----: | -------------------------------- |
| Greeting/rapport        | 0.7-0.8 | Warm, natural, room to improvise |
| Data collection         | 0.5-0.7 | Structured but conversational    |
| Validation/confirmation | 0.3-0.5 | More scripted, accuracy matters  |
| Finalization            | 0.2-0.4 | Strict, no room for error        |
| Wrapup/summary          | 0.7-0.8 | Warm, celebratory, personal      |

### Key Database Tables (AI Runtime)

| Table                     | Purpose                                                 |
| ------------------------- | ------------------------------------------------------- |
| `engine_missions`         | Mission templates (id, system_prompt, mode, journey_id) |
| `engine_stages`           | Ordered stages per mission (instructions, tools, chain) |
| `engine_sessions`         | Live session instances (mode: mission or agent)         |
| `engine_state`            | State instances for engine processes                    |
| `engine_state_step`       | Per-step tracking on state instances                    |
| `engine_memory`           | Persistent agent memories with pgvector embeddings      |
| `engine_authority_config` | Per-workspace capability authority levels               |
| `engine_inbox`            | Collected data storage                                  |
| `guardian_log`            | Persisted Guardian events                               |
