---
title: "Journey Registry"
status: in_progress
updated: 2026-03-11
created: 2026-03-01
module: journey
tags: [journey, registry, portal]
---

# SMARTOUT — Journey Registry & Implementation Guide

> **Employee Readiness System — Journey-Driven Development**
> Version 2.0 | March 2026
> **Status:** Complete journey mapping + lifecycle + agent spec + implementation plan
> **Principle:** Define once → Journey + E2E Test + Onboarding Doc + Linear Issue + Mr. Botsson Script

---

# PART I — THE SYSTEM

---

## 1. What Is the Journey System?

The Journey System is Smartout's **single source of truth** for every user-facing workflow. Each journey is defined once and generates five outputs:

| Output                 | Code      | Icon | Audience     | Format                        |
| ---------------------- | --------- | ---- | ------------ | ----------------------------- |
| **User Journey**       | `journey` | 🗺️   | Product team | Structured step flow          |
| **E2E Test**           | `e2e`     | 🧪   | Engineers    | Playwright / Detox skeleton   |
| **Onboarding Doc**     | `doc`     | 📖   | Employees    | Norwegian markdown guide      |
| **Linear Issue**       | `linear`  | 🔲   | Dev team     | Spec with acceptance criteria |
| **Mr. Botsson Script** | `botsson` | 🤖   | AI assistant | Voice/chat walkthrough        |

A journey is **an actor achieving a goal through a sequence of steps**. Not a feature, not a screen, not a task.

---

## 2. Journey Lifecycle (12 Statuses)

The lifecycle tracks a journey from first idea to production — and handles deactivation. Each status has clear entry/exit criteria and a responsible party.

### 2.1 Lifecycle Flow

```
                    ┌─────────────────────────────────────────────────────────────┐
                    │                    DEFINITION PHASE                         │
                    │                                                             │
  Idea ──▶ ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐      │
           │   💡 Idea     │──▶│  🧙 Wizard    │──▶│  📋 Defined          │      │
           │              │    │  Session     │    │                      │      │
           └──────────────┘    └──────────────┘    └──────────┬───────────┘      │
                                                              │                  │
                    ┌─────────────────────────────────────────┼──────────────────┘
                    │            PLANNING PHASE                │
                    │                                         ▼                  │
                    │              ┌──────────────────────────────────┐           │
                    │              │  📝 Ready for Implementation     │           │
                    │              └──────────┬───────────────────────┘           │
                    │                         │                                  │
                    ┌─────────────────────────┼──────────────────────────────────┘
                    │       BUILD PHASE        │
                    │                         ▼                                  │
                    │              ┌──────────────────────┐                      │
                    │              │  🔨 Under Construction │                     │
                    │              └──────────┬───────────┘                      │
                    │                         │                                  │
                    │                         ▼                                  │
                    │              ┌──────────────────────┐                      │
                    │              │  👀 In Review         │                      │
                    │              └──────────┬───────────┘                      │
                    │                         │                                  │
                    ┌─────────────────────────┼──────────────────────────────────┘
                    │      TEST PHASE          │
                    │                         ▼                                  │
                    │              ┌──────────────────────┐                      │
                    │              │  🧪 Ready for Testing │                      │
                    │              └──────────┬───────────┘                      │
                    │                         │                                  │
                    │                         ▼                                  │
                    │              ┌──────────────────────┐                      │
                    │              │  ⚗️ Testing           │                      │
                    │              └──────────┬───────────┘                      │
                    │                         │                                  │
                    │                         ▼                                  │
                    │              ┌──────────────────────┐                      │
                    │              │  ✅ Ready for         │                      │
                    │              │     Validation        │                      │
                    │              └──────────┬───────────┘                      │
                    │                         │                                  │
                    ┌─────────────────────────┼──────────────────────────────────┘
                    │    RELEASE PHASE         │
                    │                         ▼                                  │
                    │              ┌──────────────────────┐                      │
                    │              │  🚀 Implemented       │                      │
                    │              └──────────┬───────────┘                      │
                    │                         │                                  │
                    │                    ┌────┴────┐                             │
                    │                    ▼         ▼                             │
                    │          ┌────────────┐  ┌────────────┐                    │
                    │          │ 🟢 Active   │  │ ⚫ Inactive │                   │
                    │          └─────┬──────┘  └─────┬──────┘                    │
                    │                │               │                           │
                    │                ▼               │                           │
                    │          ┌────────────┐        │                           │
                    │          │ 🔴 Broken   │───────┘                           │
                    │          └────────────┘                                    │
                    └────────────────────────────────────────────────────────────┘
```

### 2.2 Status Definitions

| #   | Status                       | Code               | Icon | Color     | Phase      | Responsible            | Entry Criteria                                    | Exit Criteria                            |
| --- | ---------------------------- | ------------------ | ---- | --------- | ---------- | ---------------------- | ------------------------------------------------- | ---------------------------------------- |
| 1   | **Idea**                     | `idea`             | 💡   | `#e2e8f0` | Definition | Anyone                 | Someone has an idea for a journey                 | Journey Agent wizard started             |
| 2   | **Wizard Session**           | `wizard`           | 🧙   | `#c084fc` | Definition | Journey Agent + Author | Agent wizard started                              | All required fields completed via wizard |
| 3   | **Defined**                  | `defined`          | 📋   | `#6366f1` | Definition | Author                 | Wizard complete, all fields validated             | Reviewed and approved for implementation |
| 4   | **Ready for Implementation** | `ready_impl`       | 📝   | `#2563eb` | Planning   | Product Lead           | Defined + prioritized + assigned developer        | Developer starts building                |
| 5   | **Under Construction**       | `building`         | 🔨   | `#f59e0b` | Build      | Developer              | Developer actively coding                         | Code complete, PR created                |
| 6   | **In Review**                | `review`           | 👀   | `#a855f7` | Build      | Reviewer               | PR submitted                                      | Code review approved                     |
| 7   | **Ready for Testing**        | `ready_test`       | 🧪   | `#7c3aed` | Test       | QA / Developer         | Code merged, deployed to staging                  | Tester picks up                          |
| 8   | **Testing**                  | `testing`          | ⚗️   | `#8b5cf6` | Test       | QA / Developer         | E2E tests being written and run                   | All tests pass                           |
| 9   | **Ready for Validation**     | `ready_validation` | ✅   | `#059669` | Test       | Product Lead           | All tests pass, ready for product sign-off        | Product approves                         |
| 10  | **Implemented**              | `implemented`      | 🚀   | `#0d9488` | Release    | Product Lead           | Validated, deployed to production                 | Activated or held                        |
| 11  | **Active**                   | `active`           | 🟢   | `#10b981` | Live       | System                 | Deployed and accessible to users                  | Deactivated or broken                    |
| 12  | **Inactive**                 | `inactive`         | ⚫   | `#6b7280` | Live       | Admin                  | Intentionally disabled (feature flag, deprecated) | Reactivated or archived                  |
| 13  | **Broken**                   | `broken`           | 🔴   | `#ef4444` | Live       | Developer              | E2E test regression on Active journey             | Fixed → back to Testing                  |

### 2.3 Status Transitions (Allowed)

```
idea         → wizard
wizard       → defined, idea (abandoned)
defined      → ready_impl, idea (rework needed)
ready_impl   → building
building     → review, ready_impl (blocked)
review       → ready_test, building (changes requested)
ready_test   → testing
testing      → ready_validation, building (bugs found)
ready_validation → implemented, testing (issues found)
implemented  → active, inactive (hold)
active       → inactive, broken
inactive     → active (reactivated), idea (major rework)
broken       → testing (fix in progress)
```

### 2.4 Phase Summary

| Phase          | Statuses                                           | Color Band     | What Happens                             |
| -------------- | -------------------------------------------------- | -------------- | ---------------------------------------- |
| **Definition** | Idea → Wizard → Defined                            | Purple         | Journey is conceived and fully specified |
| **Planning**   | Ready for Implementation                           | Blue           | Journey is prioritized and assigned      |
| **Build**      | Under Construction → In Review                     | Amber          | Code is written and reviewed             |
| **Test**       | Ready for Testing → Testing → Ready for Validation | Violet         | Journey is verified end-to-end           |
| **Release**    | Implemented → Active / Inactive / Broken           | Green/Gray/Red | Journey in production                    |

---

## 3. Taxonomy & Definitions

### 3.1 Actor

| Actor       | Code       | Color     | Description                           | Primary Platform |
| ----------- | ---------- | --------- | ------------------------------------- | ---------------- |
| **Ansatt**  | `employee` | `#3b82f6` | Active employee performing daily work | Mobile           |
| **Trainee** | `trainee`  | `#14b8a6` | New employee in sandbox mode          | Mobile           |
| **Leder**   | `manager`  | `#f59e0b` | Department manager or team lead       | Both             |
| **Admin**   | `admin`    | `#f97316` | Workspace administrator               | Desktop          |
| **Eier**    | `owner`    | `#8b5cf6` | Business owner with billing access    | Desktop          |
| **Alle**    | `all`      | `#6b7280` | Applies to all roles                  | Both             |

### 3.2 Module

| Module             | Code             | Icon | Color     | Journey Count |
| ------------------ | ---------------- | ---- | --------- | :-----------: |
| Core               | `core`           | 🔑   | `#6366f1` |       3       |
| Onboarding         | `onboarding`     | 🚀   | `#14b8a6` |       5       |
| Org Structure      | `org`            | 🏢   | `#06b6d4` |       2       |
| Scheduling         | `scheduling`     | 📅   | `#0ea5e9` |       8       |
| Operations         | `operations`     | ⚡   | `#f59e0b` |       7       |
| HACCP              | `haccp`          | 🌡️   | `#ef4444` |       4       |
| Training           | `training`       | 🎓   | `#8b5cf6` |       5       |
| Absence            | `absence`        | 🏖️   | `#a855f7` |       3       |
| Payroll            | `payroll`        | 💰   | `#f97316` |       3       |
| Communication      | `communication`  | 💬   | `#10b981` |       4       |
| Reports            | `reports`        | 📊   | `#6366f1` |       4       |
| Settings           | `settings`       | ⚙️   | `#64748b` |       3       |
| AI (Mr. Botsson)   | `ai`             | 🤖   | `#ec4899` |       3       |
| Season             | `season`         | 🏆   | `#eab308` |       3       |
| Governance         | `governance`     | 📜   | `#78716c` |       2       |
| Contracts          | `contracts`      | 📝   | `#92400e` |       3       |
| Certifications     | `certifications` | 🏅   | `#0d9488` |       2       |
| **Journey Portal** | `meta`           | 🎯   | `#1e293b` |       4       |
|                    |                  |      | **TOTAL** |    **68**     |

### 3.3 Platform

| Platform | Code      | Icon | When Used                      |
| -------- | --------- | ---- | ------------------------------ |
| Mobile   | `mobile`  | 📱   | During shifts, on-the-go       |
| Desktop  | `desktop` | 🖥️   | Setup, admin, planning, review |
| Both     | `both`    | 🖥️📱 | Either platform                |

### 3.4 Priority

| Priority          | Code | Color     | Meaning                                | Build Phase |
| ----------------- | ---- | --------- | -------------------------------------- | ----------- |
| P0 — Critical     | `P0` | `#ef4444` | Platform doesn't work without it       | Phase 1     |
| P1 — Important    | `P1` | `#f59e0b` | Expected by users, delivers core value | Phase 2     |
| P2 — Nice to have | `P2` | `#6b7280` | Enhances experience                    | Phase 3     |
| P3 — Future       | `P3` | `#cbd5e1` | Roadmap, not current scope             | Future      |

### 3.5 Tags

| Tag                 | Meaning                                   |
| ------------------- | ----------------------------------------- |
| `read-only`         | Only reads data                           |
| `write`             | Creates or modifies data                  |
| `real-time`         | Requires live updates (Supabase Realtime) |
| `gps`               | Uses location services                    |
| `offline-capable`   | Should work without network               |
| `ai-assisted`       | Mr. Botsson is involved                   |
| `sandbox`           | Has trainee variant                       |
| `compliance`        | Legal/regulatory                          |
| `norwegian-law`     | Norwegian labor law specific              |
| `docuseal`          | Uses DocuSeal signing                     |
| `push-notification` | Push notifications involved               |
| `gamification`      | Points/achievements                       |
| `multi-department`  | Crosses departments                       |
| `season-aware`      | Changes with active season                |
| `export`            | Generates downloadable files              |
| `stripe`            | Involves billing/payments                 |
| `bulk`              | Handles multiple items at once            |
| `approval-flow`     | Requires manager/admin approval           |
| `audit-trail`       | Creates compliance audit records          |

### 3.6 Test Result

| Result  | Code      | Icon |
| ------- | --------- | ---- |
| Pass    | `pass`    | ✅   |
| Fail    | `fail`    | ❌   |
| Skip    | `skip`    | ⏭️   |
| Running | `running` | ⏳   |
| Not run | `null`    | —    |

---

## 4. The Journey Agent

The Journey Agent is an AI-powered wizard that helps define new journeys through structured conversation. It lives inside the Journey Portal and ensures every journey is complete, consistent, and properly classified.

### 4.1 What the Agent Does

Instead of manually filling out a form, you start a **Wizard Session** with the Journey Agent. It asks questions, suggests classifications, validates completeness, and produces a fully structured journey definition.

### 4.2 Wizard Session Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    JOURNEY AGENT WIZARD                          │
│                                                                 │
│  Phase 1: DISCOVERY (understand the goal)                       │
│  ├── "What should the user be able to do?"                      │
│  ├── "Who is doing this? Employee? Admin?"                      │
│  ├── "What triggers this? When does the user start?"            │
│  └── "What does success look like?"                             │
│                                                                 │
│  Phase 2: CLASSIFICATION (categorize)                           │
│  ├── Agent suggests: module, actor, platform, priority          │
│  ├── Agent suggests: tags based on description                  │
│  ├── User confirms or adjusts                                   │
│  └── Agent checks for duplicates/overlaps with existing         │
│                                                                 │
│  Phase 3: STEPS (define the journey)                            │
│  ├── "Walk me through it step by step"                          │
│  ├── For each step: action, expected result, screen, data       │
│  ├── Agent suggests preconditions                               │
│  └── Agent defines outcomes: success, empty, error              │
│                                                                 │
│  Phase 4: TESTING (define verification)                         │
│  ├── Agent generates test assertion from steps                  │
│  ├── Agent suggests E2E test selectors                          │
│  └── User refines                                               │
│                                                                 │
│  Phase 5: DOCUMENTATION (define teaching)                       │
│  ├── Agent generates Norwegian doc title                        │
│  ├── Agent drafts onboarding doc outline                        │
│  └── Agent drafts Mr. Botsson script                            │
│                                                                 │
│  Phase 6: REVIEW (confirm everything)                           │
│  ├── Agent shows complete journey summary                       │
│  ├── User confirms or requests changes                          │
│  ├── Agent validates: no missing fields, no conflicts           │
│  └── Journey saved with status = "defined"                      │
│                                                                 │
│  ✅ Journey created. All outputs ready for generation.          │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 Agent Capabilities

| Capability                | Description                                                                    |
| ------------------------- | ------------------------------------------------------------------------------ |
| **Duplicate Detection**   | Searches existing journeys for similar titles/triggers before creating         |
| **Module Suggestion**     | Analyzes description and suggests correct module                               |
| **Tag Auto-Assign**       | Detects patterns ("GPS", "sign", "points") and suggests tags                   |
| **Step Generation**       | From a high-level description, generates detailed steps                        |
| **Test Assertion**        | From steps, generates the E2E assertion chain                                  |
| **Norwegian Translation** | Generates Norwegian doc titles and Botsson scripts                             |
| **Cross-Reference**       | Links to related journeys (e.g., "Check Schedule" relates to "Build Schedule") |
| **Completeness Check**    | Validates all required fields before saving                                    |

### 4.4 Agent System Prompt (Core)

```
You are the Smartout Journey Agent. Your job is to help define user
journeys for the Smartout Employee Readiness System.

You guide the user through a structured wizard:
1. DISCOVER the goal (what, who, when, why)
2. CLASSIFY the journey (module, actor, platform, priority, tags)
3. DEFINE the steps (action → expected result per step)
4. GENERATE test assertions
5. CREATE documentation outlines (Norwegian)
6. REVIEW and validate completeness

You have access to all existing journeys and can detect duplicates.
You know every module, actor, platform, and tag in the system.
You write doc titles and Botsson scripts in Norwegian.
You ensure every journey follows the schema exactly.

When suggesting a module, explain WHY that module owns this journey.
When detecting potential overlap, show the existing journey and ask
if this is a new journey or a variant.
```

---

## 5. Journey Schema (TypeScript)

```typescript
// ─── Enums ──────────────────────────────────────────────────────

type JourneyStatus =
  | "idea"
  | "wizard"
  | "defined"
  | "ready_impl"
  | "building"
  | "review"
  | "ready_test"
  | "testing"
  | "ready_validation"
  | "implemented"
  | "active"
  | "inactive"
  | "broken";

type JourneyPhase = "definition" | "planning" | "build" | "test" | "release";

type Actor = "employee" | "trainee" | "manager" | "admin" | "owner" | "all";

type Platform = "mobile" | "desktop" | "both";

type Priority = "P0" | "P1" | "P2" | "P3";

type ModuleCode =
  | "core"
  | "onboarding"
  | "org"
  | "scheduling"
  | "operations"
  | "haccp"
  | "training"
  | "absence"
  | "payroll"
  | "communication"
  | "reports"
  | "settings"
  | "ai"
  | "season"
  | "governance"
  | "contracts"
  | "certifications"
  | "meta";

type TestResult = "pass" | "fail" | "skip" | "running" | null;

type OutputType = "e2e" | "doc" | "linear" | "botsson";

// ─── Core Types ──────────────────────────────────────────────────

interface Journey {
  // Identity
  id: string; // Auto-generated: "j-001"
  title: string; // "Check My Schedule"
  slug: string; // "check-my-schedule"

  // Classification
  module: ModuleCode;
  actor: Actor;
  platform: Platform;
  priority: Priority;
  tags: string[];

  // Content
  trigger: string; // What initiates this journey
  preconditions: string[]; // What must be true first
  steps: JourneyStep[];
  outcomes: JourneyOutcomes;

  // Test
  testAssertion: string; // One-line assertion summary
  testSteps: TestStep[]; // Detailed per-step assertions

  // Documentation
  docTitle: string; // Norwegian title
  docCategory: string; // Help category
  botssonScript: string | null; // Generated voice script

  // Lifecycle
  status: JourneyStatus;
  phase: JourneyPhase; // Computed from status
  outputs: Record<OutputType, boolean>;

  // Tracking
  lastTestRun: string | null;
  lastTestResult: TestResult;
  assignee: string | null;
  linearIssueId: string | null;

  // Relations
  relatedJourneys: string[]; // IDs of related journeys
  blockedBy: string[]; // IDs of journeys this depends on

  // Wizard
  wizardSessionId: string | null; // If created via agent
  wizardCompleted: boolean;

  // Meta
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  version: number;
}

interface JourneyStep {
  id: string; // "step-1"
  order: number;
  action: string; // What the user does
  expects: string; // What system should show/do
  screen: string | null; // Route: "/shifts/:id"
  component: string | null; // "ShiftDetailModal"
  dataReads: string[]; // ["shift", "profile"]
  dataWrites: string[]; // ["punch_record"]
  notes: string | null; // Implementation notes
}

interface JourneyOutcomes {
  success: string;
  empty: string;
  error: string;
}

interface TestStep {
  stepRef: string; // References JourneyStep.id
  selector: string; // "[data-testid='punch-in-btn']"
  assertion: string; // "should be visible and enabled"
  setup: string | null; // Seed data needed
}

interface WizardSession {
  id: string;
  journeyId: string | null; // null until journey created
  status: "active" | "completed" | "abandoned";
  currentPhase: "discovery" | "classification" | "steps" | "testing" | "documentation" | "review";
  messages: WizardMessage[];
  draft: Partial<Journey>; // Building up the journey
  createdAt: string;
  completedAt: string | null;
}

interface WizardMessage {
  role: "agent" | "user";
  content: string;
  timestamp: string;
  phase: string;
}

interface JourneyEvent {
  id: string;
  journeyId: string;
  type: "status_change" | "test_run" | "output_generated" | "edit" | "comment";
  fromStatus: JourneyStatus | null;
  toStatus: JourneyStatus | null;
  actor: string; // User who triggered
  metadata: Record<string, any>;
  timestamp: string;
}
```

---

# PART II — COMPLETE JOURNEY REGISTRY (68 Journeys)

---

## 🔑 Core (3 journeys)

### J-001: Sign Up & Create Workspace

- **Actor:** Owner | **Platform:** Desktop | **Priority:** P0
- **Tags:** `write`, `ai-assisted`, `stripe`
- **Trigger:** Landing page → "Start gratis prøveperiode"
- **Preconditions:** None
- **Steps:**
  1. Enter email/password or SSO → Create account
  2. AI scrapes website + Brønnøysundregistrene → Prepopulate workspace
  3. Confirm/adjust company details (name, org number, industry)
  4. Mr. Botsson guides 7-stage setup wizard
  5. Workspace ready → Invite first employees
- **Outcomes:** Success: Workspace + org structure created, Stripe trial started | Empty: n/a | Error: Registration fails → Retry
- **Test:** `signup → workspace exists → setup wizard completes → can invite`
- **Doc:** "Dine første 10 minutter med Smartout"

### J-002: Employee Accepts Invite

- **Actor:** Employee | **Platform:** Mobile | **Priority:** P0
- **Tags:** `write`, `ai-assisted`, `sandbox`
- **Trigger:** Email/SMS invite link
- **Preconditions:** Active workspace invite exists
- **Steps:**
  1. Click invite → Create account (or link existing)
  2. Land in Trainee Mode (sandbox)
  3. Mr. Botsson greets → Profile setup (photo, language, emergency contact)
  4. Navigation tour → Core concepts intro
  5. Module journeys begin based on first shift
- **Test:** `invite → account created → trainee mode → AI greeting`
- **Doc:** "Velkommen til din nye arbeidsplass"

### J-003: Login & Route to Context

- **Actor:** All | **Platform:** Both | **Priority:** P0
- **Tags:** `read-only`
- **Trigger:** Open app / navigate to site
- **Preconditions:** User has account with active profile
- **Steps:**
  1. Auth check → Session validation
  2. Load profile → Determine role, status, session
  3. Route: Employee on shift → Feed | Off shift → Schedule | Admin → Dashboard | Trainee → Onboarding
  4. Load workspace context (season, modules, permissions)
- **Test:** `login each role → correct screen → context matches`
- **Doc:** n/a (invisible routing)

---

## 🚀 Onboarding (5 journeys)

### J-004: Complete Trainee Core Journey

- **Actor:** Trainee | **Platform:** Mobile | **Priority:** P0
- **Tags:** `write`, `ai-assisted`, `sandbox`, `gamification`
- **Trigger:** First login after invite acceptance
- **Steps:**
  1. Mr. Botsson introduces Smartout and the restaurant
  2. Profile completion: photo, emergency contact, language
  3. Navigation tour: Home, Vakter, Chat, Meg tabs
  4. Core concept intro: shifts, tasks, points
  5. Each checkpoint AI-verified → Progress bar updates
- **Test:** `trainee login → AI greets → profile done → tour → checkpoints marked`
- **Doc:** "Bli kjent med Smartout"

### J-005: Complete Module Journey

- **Actor:** Trainee / All | **Platform:** Mobile | **Priority:** P0
- **Tags:** `sandbox`, `ai-assisted`, `gamification`
- **Trigger:** Core journey complete OR new module activated
- **Steps:**
  1. AI determines module order (based on first shift)
  2. Open module → AI spotlight on key elements
  3. Sandbox activity (test punch-in, test task)
  4. Checkpoint quiz or confirmation
  5. Module marked learned → Next unlocked
- **Test:** `module journey → spotlight → sandbox → checkpoint → complete`
- **Doc:** "Lær [Modulnavn]" (dynamic)

### J-006: Admin Reviews Trainee Progress

- **Actor:** Admin / Manager | **Platform:** Desktop | **Priority:** P0
- **Tags:** `read-only`, `ai-assisted`, `approval-flow`
- **Trigger:** People → Trainees
- **Steps:**
  1. Trainee dashboard → All trainees with progress bars
  2. Click trainee → Detailed checkpoint view
  3. See AI risk alerts (behind schedule, first shift approaching)
  4. Decision: Approve → active | Extend | Reschedule
  5. If approved → Status trainee → active, points carry to season
- **Test:** `trainees → progress → approve → status = active → points transferred`
- **Doc:** "Godkjenn nye ansatte"

### J-007: Bulk Invite Employees (CSV)

- **Actor:** Admin | **Platform:** Desktop | **Priority:** P1
- **Tags:** `write`, `bulk`
- **Trigger:** People → Invite → Bulk
- **Steps:**
  1. Download CSV template
  2. Fill: name, email, phone, department, position
  3. Upload → Validate (duplicates, format, plan limit)
  4. Preview → Confirm
  5. Batch invites sent → Track acceptance
- **Test:** `upload CSV → validate → confirm → invites sent → tracking`
- **Doc:** "Inviter mange ansatte på en gang"

### J-008: Employee Offboarding

- **Actor:** Admin | **Platform:** Desktop | **Priority:** P1
- **Tags:** `write`, `compliance`
- **Trigger:** People → Employee → "Start offboarding"
- **Steps:**
  1. Set status → offboarding
  2. System shows: open shifts, active contracts, pending tasks
  3. Handle each: reassign, terminate, cancel
  4. GDPR export offered
  5. Final deactivation → inactive, data preserved
- **Test:** `offboarding → all items resolved → inactive → data preserved`
- **Doc:** "Avslutte et arbeidsforhold"

---

## 🏢 Org Structure (2 journeys)

### J-009: Configure Organization (Setup Wizard)

- **Actor:** Admin | **Platform:** Desktop | **Priority:** P0
- **Tags:** `write`, `ai-assisted`
- **Trigger:** First login → Mr. Botsson wizard
- **Steps:** 7 stages: Departments → Locations → Zones → Assets → Positions → Teams → Settings
- **Test:** `wizard → each stage creates entities → org structure complete`
- **Doc:** "Sett opp restaurantens struktur"

### J-010: Edit Org Structure

- **Actor:** Admin | **Platform:** Desktop | **Priority:** P1
- **Tags:** `write`, `season-aware`
- **Trigger:** Settings → Org Structure
- **Steps:**
  1. Navigate to section
  2. Add/edit/deactivate entities
  3. Drag-and-drop reorder
  4. Season-aware variants (summer zones, event positions)
  5. Changes reflected across all modules
- **Test:** `edit → saved → scheduling reflects → season items correct`
- **Doc:** "Endre organisasjonsstruktur"

---

## 📅 Scheduling (8 journeys)

### J-011: Check My Schedule

- **Actor:** Employee | **Platform:** Mobile | **Priority:** P0 | **Tags:** `read-only`
- **Trigger:** Vakter tab
- **Steps:** Calendar view → Tap shift → Detail (time, location, role, colleagues)
- **Test:** `schedule → shifts visible → detail correct`
- **Doc:** "Sjekk vaktplanen din"

### J-012: Register Availability / Request Time Off

- **Actor:** Employee | **Platform:** Mobile | **Priority:** P0 | **Tags:** `write`, `approval-flow`
- **Trigger:** Vakter → Min tilgjengelighet
- **Steps:** Open calendar → Mark unavailable → Or request time off → Submit → Track status
- **Test:** `mark unavailable → saved → visible in admin grid → conflicts detected`
- **Doc:** "Si fra når du ikke kan jobbe"

### J-013: Claim Open Shift

- **Actor:** Employee | **Platform:** Mobile | **Priority:** P1 | **Tags:** `write`, `push-notification`
- **Trigger:** Push or Vakter → Ledige vakter
- **Steps:** See open shifts → Filter → Tap "Ta vakten" → Manager approves → Shift assigned
- **Test:** `open shift → claim → approve → assigned`
- **Doc:** "Ta en ekstra vakt"

### J-014: Request Shift Swap

- **Actor:** Employee | **Platform:** Mobile | **Priority:** P1 | **Tags:** `write`, `approval-flow`, `push-notification`
- **Trigger:** Shift detail → Foreslå bytte
- **Steps:** Select shift → See eligible colleagues → Send request → Colleague accepts → Manager approves
- **Test:** `request → colleague accepts → manager approves → schedules updated`
- **Doc:** "Bytt vakt med en kollega"

### J-015: Build Weekly Schedule

- **Actor:** Admin | **Platform:** Desktop | **Priority:** P0 | **Tags:** `write`, `ai-assisted`, `norwegian-law`
- **Trigger:** Schedule Builder
- **Steps:** Drag-and-drop grid → Create/assign shifts → Compliance check → Cost overlay → Publish
- **Test:** `create → assign → validate → publish → employees notified`
- **Doc:** "Planlegg neste ukes vakter"

### J-016: Handle Sick Call

- **Actor:** Admin | **Platform:** Both | **Priority:** P0 | **Tags:** `write`, `ai-assisted`, `push-notification`
- **Trigger:** Notification: syk
- **Steps:** See affected shift → AI suggests replacement → Send request → Confirmed → Or post open shift
- **Test:** `sick call → replacement → confirmed → schedule updated`
- **Doc:** "Dekk et sykefravær på 2 minutter"

### J-017: Copy / Template Schedule

- **Actor:** Admin | **Platform:** Desktop | **Priority:** P1 | **Tags:** `write`
- **Trigger:** Schedule Builder → Kopier forrige uke
- **Steps:** Select source → Preview → Auto-adjust dates → Handle conflicts → Confirm
- **Test:** `copy → preview → conflicts shown → confirm → shifts created`
- **Doc:** "Gjenbruk en vaktplan"

### J-018: View Shift History & Hours

- **Actor:** Employee | **Platform:** Both | **Priority:** P1 | **Tags:** `read-only`, `export`
- **Trigger:** Vakter → Historikk
- **Steps:** Past shifts with punch data → Hours breakdown → Overtime highlighted → Export
- **Test:** `history → hours calculated → overtime marked → export works`
- **Doc:** "Se arbeidstimene dine"

---

## ⚡ Operations (7 journeys)

### J-019: Punch Into Shift

- **Actor:** Employee | **Platform:** Mobile | **Priority:** P0 | **Tags:** `write`, `gps`, `gamification`, `real-time`
- **Trigger:** Home → Stemple inn
- **Steps:** Tap punch → GPS check → Session context switches → Feed loads → Points for on-time
- **Test:** `punch → GPS → session active → feed loads → record created`
- **Doc:** "Stemple inn på jobb"

### J-020: Work Through Feed Tasks

- **Actor:** Employee | **Platform:** Mobile | **Priority:** P0 | **Tags:** `write`, `real-time`, `gamification`
- **Trigger:** On shift → Feed items
- **Steps:** Feed → Tap task → Procedure stepper → Complete (photo/data) → Points → Next task
- **Test:** `feed → task → steps → complete → points`
- **Doc:** "Gjør oppgavene dine"

### J-021: View Day Brief

- **Actor:** Employee / Manager | **Platform:** Mobile | **Priority:** P0 | **Tags:** `read-only`, `ai-assisted`
- **Trigger:** Feed → Pinned Day Brief
- **Steps:** AI-compiled brief → Expand → Action items → Acknowledge
- **Test:** `session start → brief pinned → expand → acknowledge tracked`
- **Doc:** "Dagens oppdatering"

### J-022: Create Ad-Hoc Task

- **Actor:** Manager | **Platform:** Mobile | **Priority:** P1 | **Tags:** `write`, `real-time`, `push-notification`
- **Trigger:** Feed "+" or Session Board
- **Steps:** Quick-create → Assign → Push sent → Track completion
- **Test:** `create → employee sees → push → completion tracked`
- **Doc:** "Lag en oppgave på stedet"

### J-023: Record Handoff

- **Actor:** Employee | **Platform:** Mobile | **Priority:** P1 | **Tags:** `write`, `ai-assisted`
- **Trigger:** Shift ending → Handoff prompt
- **Steps:** Choose method (text/voice/AI) → Record notes → AI extracts → Submit → Next shift sees in brief
- **Test:** `handoff → record → submit → visible in next Day Brief`
- **Doc:** "Overlever til neste skift"

### J-024: Punch Out & See Summary

- **Actor:** Employee | **Platform:** Mobile | **Priority:** P0 | **Tags:** `write`, `gamification`
- **Trigger:** End of shift
- **Steps:** Complete remaining tasks → Punch out → Summary (hours, tasks, points) → Overtime flagged
- **Test:** `punch out → hours calculated → summary → overtime detected`
- **Doc:** "Avslutt skiftet ditt"

### J-025: Sign Off Department Session

- **Actor:** Manager / Admin | **Platform:** Desktop | **Priority:** P1 | **Tags:** `write`, `audit-trail`
- **Trigger:** End of day → Session Board
- **Steps:** Review completion rates → Check HACCP → Review handoffs → Sign off → Day closed
- **Test:** `session board → review → sign off → status = closed`
- **Doc:** "Lukk dagens drift"

---

## 🌡️ HACCP (4 journeys)

### J-026: Log Temperature Reading

- **Actor:** Employee | **Platform:** Mobile | **Priority:** P0 | **Tags:** `write`, `compliance`, `audit-trail`
- **Trigger:** Feed task: Temperaturkontroll
- **Steps:** Open task → See assets with limits → Enter readings → Auto-validate → Submit → Audit trail
- **Test:** `HACCP task → readings → in-range green → out-of-range deviation → audit saved`
- **Doc:** "Daglig temperaturlogging"

### J-027: Handle Deviation

- **Actor:** Employee | **Platform:** Mobile | **Priority:** P0 | **Tags:** `write`, `compliance`, `audit-trail`
- **Trigger:** Temperature out of range / hygiene fail
- **Steps:** Auto-flagged → Runbook triggered → Follow corrective steps → Document (text+photo) → Escalate if needed → Manager reviews
- **Test:** `deviation → runbook → corrective action → documented → resolution`
- **Doc:** "Når noe er utenfor grenseverdiene"

### J-028: Complete Hygiene Checklist

- **Actor:** Employee | **Platform:** Mobile | **Priority:** P0 | **Tags:** `write`, `compliance`, `audit-trail`
- **Trigger:** Session hook at open/close
- **Steps:** Open checklist → Check each item → Photo evidence if required → Flag issues → Submit → Audit trail
- **Test:** `checklist opens → items checked → photo attached → submitted → audit`
- **Doc:** "Hygienekontroll"

### J-029: Export HACCP Compliance Report

- **Actor:** Admin | **Platform:** Desktop | **Priority:** P1 | **Tags:** `read-only`, `export`, `compliance`
- **Trigger:** Reports → HACCP or Mattilsynet inspection
- **Steps:** Select date range → See readings, deviations, corrective actions → Full audit trail → Export PDF
- **Test:** `HACCP report → filter → all records → export PDF valid`
- **Doc:** "Forbered deg til Mattilsynet"

---

## 🎓 Training (5 journeys)

### J-030: Complete Training Protocol

- **Actor:** Employee | **Platform:** Both | **Priority:** P0 | **Tags:** `write`, `gamification`
- **Trigger:** Assigned training or Me → Opplæring
- **Steps:** See protocols → Open → Procedure steps with media → Knowledge test → Pass → Readiness updated → Points
- **Test:** `training → steps → test → pass → readiness increases → certificate`
- **Doc:** "Fullfør opplæringen din"

### J-031: Sign Confirmation / Contract

- **Actor:** Employee | **Platform:** Both | **Priority:** P0 | **Tags:** `write`, `docuseal`, `compliance`
- **Trigger:** Notification: new document
- **Steps:** Open → Read → Digital signature (DocuSeal) → Confirmation recorded → Readiness updated
- **Test:** `assigned → opened → signed → readiness updated`
- **Doc:** "Signer dokumenter digitalt"

### J-032: Take Knowledge Test

- **Actor:** Employee | **Platform:** Both | **Priority:** P0 | **Tags:** `write`, `gamification`
- **Trigger:** End of training procedure or refresher due
- **Steps:** Open test → Multiple choice / true-false → Submit → See score → Pass/fail → Retry if failed
- **Test:** `open test → answer → submit → score shown → pass updates readiness`
- **Doc:** "Kunnskapstest"

### J-033: Check Readiness Dashboard (Admin)

- **Actor:** Admin | **Platform:** Desktop | **Priority:** P0 | **Tags:** `read-only`
- **Trigger:** People → Employee profile or Training Hub
- **Steps:** See readiness score (0-100%) → Breakdown per policy → Overdue deadlines → Assign additional training
- **Test:** `profile → readiness score → breakdown matches → can assign`
- **Doc:** "Sjekk om teamet ditt er klart"

### J-034: Cross-Training Request

- **Actor:** Employee | **Platform:** Desktop | **Priority:** P2 | **Tags:** `write`, `gamification`
- **Trigger:** Me → Utvikling → "Lær noe nytt"
- **Steps:** Browse available cross-training → Select → Request → Manager approves → Training assigned
- **Test:** `browse → select → request → approved → assigned`
- **Doc:** "Utvid kompetansen din"

---

## 🏖️ Absence (3 journeys)

### J-035: Report Sick (Egenmelding)

- **Actor:** Employee | **Platform:** Mobile | **Priority:** P0 | **Tags:** `write`, `push-notification`, `norwegian-law`
- **Trigger:** Wake up sick → Open app
- **Steps:** Tap "Meld fravær" → Select: egenmelding → Select dates → Submit → Manager notified → Shifts flagged
- **Test:** `report sick → saved → manager notified → shifts flagged for replacement`
- **Doc:** "Meld deg syk"

### J-036: Request Vacation

- **Actor:** Employee | **Platform:** Both | **Priority:** P1 | **Tags:** `write`, `approval-flow`, `norwegian-law`
- **Trigger:** Vakter → Be om ferie
- **Steps:** Select dates → See remaining vacation days → Submit request → Manager approves/rejects → Calendar updated
- **Test:** `request → balance checked → submitted → approved → calendar updated`
- **Doc:** "Søk om ferie"

### J-037: View Absence Balance

- **Actor:** Employee | **Platform:** Both | **Priority:** P1 | **Tags:** `read-only`
- **Trigger:** Me → Fravær
- **Steps:** See: vacation days remaining, sick leave used (egenmelding count), other leave → History list
- **Test:** `absence view → balances correct → history listed`
- **Doc:** "Se fraværsoversikten din"

---

## 💰 Payroll (3 journeys)

### J-038: View My Salary

- **Actor:** Employee | **Platform:** Both | **Priority:** P1 | **Tags:** `read-only`
- **Trigger:** Me → Lønn
- **Steps:** Current period hours → Breakdown (regular, overtime, supplements) → Tips → Historical payslips
- **Test:** `salary → hours match punches → supplements calculated → history`
- **Doc:** "Se lønnen din"

### J-039: Run Payroll Period

- **Actor:** Admin | **Platform:** Desktop | **Priority:** P1 | **Tags:** `write`, `norwegian-law`, `export`
- **Trigger:** Payroll → Kjør lønnsperiode
- **Steps:** Select period → Auto-calculate → Review (hours, overtime 40%/50%, supplements) → Flag anomalies → Approve → Export
- **Test:** `run → calculations correct → anomalies flagged → export valid`
- **Doc:** "Kjør lønnsberegning"

### J-040: Review Wage Cost Report

- **Actor:** Admin | **Platform:** Desktop | **Priority:** P2 | **Tags:** `read-only`, `export`
- **Trigger:** Reports → Lønnskostnad
- **Steps:** See wage cost per department → Per day/week/month → Budget vs actual → Overtime analysis → Export
- **Test:** `report → per department → budget comparison → export`
- **Doc:** "Lønnskostnadsrapport"

---

## 💬 Communication (4 journeys)

### J-041: Receive & Act on Push Notification

- **Actor:** Employee | **Platform:** Mobile | **Priority:** P0 | **Tags:** `push-notification`
- **Trigger:** Push notification arrives
- **Steps:** See notification → Tap → Deep link to correct screen → Act on content → Mark as read
- **Test:** `trigger → push → tap → correct screen → action possible`
- **Doc:** "Forstå varslene dine"

### J-042: Team Chat During Shift

- **Actor:** Employee | **Platform:** Mobile | **Priority:** P1 | **Tags:** `write`, `real-time`
- **Trigger:** Chat tab → Team channel
- **Steps:** Open channel → Send message (text/photo) → Real-time delivery → Read receipts
- **Test:** `send → received real-time → read receipt`
- **Doc:** "Chat med teamet"

### J-043: Send Workspace Announcement

- **Actor:** Admin | **Platform:** Desktop | **Priority:** P1 | **Tags:** `write`, `push-notification`
- **Trigger:** Communication → Ny kunngjøring
- **Steps:** Write content → Target (all/dept/team) → Choose channels → Schedule or send → Track read receipts
- **Test:** `create → target → send → received → read tracking`
- **Doc:** "Send en kunngjøring"

### J-044: Configure Notification Preferences

- **Actor:** Employee | **Platform:** Both | **Priority:** P2 | **Tags:** `write`
- **Trigger:** Me → Innstillinger → Varsler
- **Steps:** See channel preferences per notification type → Toggle push/SMS/email → Set quiet hours → Save
- **Test:** `open prefs → change → save → next notification uses new preference`
- **Doc:** "Tilpass varslene dine"

---

## 📊 Reports (4 journeys)

### J-045: View Admin Dashboard

- **Actor:** Admin / Manager | **Platform:** Desktop | **Priority:** P0 | **Tags:** `read-only`
- **Trigger:** Login → Dashboard
- **Steps:** See KPIs → Staff on shift → Task progress → Deviations → Alerts → Drill down
- **Test:** `dashboard → KPIs correct → drill down works`
- **Doc:** "Dashboardet ditt"

### J-046: View Employee Dashboard

- **Actor:** Employee | **Platform:** Desktop | **Priority:** P1 | **Tags:** `read-only`
- **Trigger:** Desktop login (employee mode)
- **Steps:** My shifts → My tasks → Training progress → Readiness score → Points → Messages
- **Test:** `employee dashboard → all personal data correct`
- **Doc:** "Din personlige oversikt"

### J-047: Generate Operations Report

- **Actor:** Admin | **Platform:** Desktop | **Priority:** P1 | **Tags:** `read-only`, `export`
- **Trigger:** Reports → Drift
- **Steps:** Select period → Task completion rates → Session sign-offs → Deviation history → Export
- **Test:** `report → filter → data correct → export`
- **Doc:** "Driftsrapport"

### J-048: Generate HR Report

- **Actor:** Admin | **Platform:** Desktop | **Priority:** P2 | **Tags:** `read-only`, `export`
- **Trigger:** Reports → HR
- **Steps:** Turnover analysis → Absence stats → Competence matrix → Onboarding progress → Export
- **Test:** `HR report → turnover correct → absence stats → export`
- **Doc:** "HR-rapport"

---

## ⚙️ Settings (3 journeys)

### J-049: Configure Workspace Settings

- **Actor:** Admin / Owner | **Platform:** Desktop | **Priority:** P0 | **Tags:** `write`
- **Trigger:** Settings → Arbeidsområde
- **Steps:** Branding (name, logo) → Timezone/locale → Module activation → Default policies → Save
- **Test:** `settings → change → save → reflected across workspace`
- **Doc:** "Konfigurer arbeidsområdet"

### J-050: Manage Billing & Subscription

- **Actor:** Owner | **Platform:** Desktop | **Priority:** P0 | **Tags:** `write`, `stripe`
- **Trigger:** Settings → Fakturering
- **Steps:** See current plan → Employee count vs limit → Upgrade/downgrade → Payment method → Invoices
- **Test:** `billing → plan correct → upgrade → Stripe reflects`
- **Doc:** "Administrer abonnementet"

### J-051: GDPR Data Export

- **Actor:** Admin / Employee | **Platform:** Desktop | **Priority:** P1 | **Tags:** `read-only`, `compliance`, `export`
- **Trigger:** Settings → Data → GDPR Export or employee self-service
- **Steps:** Select user → Generate export → Download all personal data → Format: JSON + PDF
- **Test:** `export → all PII included → download works`
- **Doc:** "Eksporter persondata (GDPR)"

---

## 🤖 AI / Mr. Botsson (3 journeys)

### J-052: Chat with Mr. Botsson

- **Actor:** All | **Platform:** Both | **Priority:** P0 | **Tags:** `ai-assisted`, `real-time`
- **Trigger:** Tap AI FAB (mobile) or sidebar (desktop)
- **Steps:** Open chat overlay → Ask question → AI responds with context → Suggested actions → Tool calling if needed
- **Test:** `open chat → send message → contextual response → suggestions shown`
- **Doc:** "Snakk med Mr. Botsson"

### J-053: Voice Conversation with Mr. Botsson

- **Actor:** All | **Platform:** Mobile | **Priority:** P1 | **Tags:** `ai-assisted`, `real-time`
- **Trigger:** Long-press AI FAB
- **Steps:** Voice activated → Speak naturally → AI responds in Norwegian → Conversation continues → End by tap
- **Test:** `long press → voice active → speech recognized → response → end`
- **Doc:** "Snakk med stemmen"

### J-054: AI-Assisted Procedure Help

- **Actor:** Employee | **Platform:** Mobile | **Priority:** P1 | **Tags:** `ai-assisted`
- **Trigger:** During task → "Trenger hjelp" button
- **Steps:** Open AI in task context → AI knows which procedure/step → Explains in simple terms → Can demonstrate → Back to task
- **Test:** `help → AI knows context → explains → return to task`
- **Doc:** "Få hjelp med en oppgave"

---

## 🏆 Season & Gamification (3 journeys)

### J-055: Set Up Season

- **Actor:** Admin | **Platform:** Desktop | **Priority:** P1 | **Tags:** `write`, `season-aware`, `gamification`
- **Trigger:** Season Manager → Opprett
- **Steps:** Name → Configure (departments, zones, teams) → Season-specific policies → Gamification settings (points, boosters) → Review → Activate
- **Test:** `create → configure → activate → season-aware entities reflect`
- **Doc:** "Sett opp en sesong"

### J-056: Check Leaderboard & Points

- **Actor:** Employee | **Platform:** Both | **Priority:** P2 | **Tags:** `read-only`, `gamification`
- **Trigger:** Me → Poeng
- **Steps:** Personal total → Breakdown (tasks, training, HACCP, on-time) → Team ranking → Department → Achievements
- **Test:** `leaderboard → points match → rankings calculated`
- **Doc:** "Dine poeng og prestasjoner"

### J-057: Configure Gamification Settings

- **Actor:** Admin | **Platform:** Desktop | **Priority:** P2 | **Tags:** `write`, `gamification`, `season-aware`
- **Trigger:** Season Manager → Gamification
- **Steps:** Set point rates per action → Configure boosters/penalties → Leaderboard scope → Visibility mode → Save
- **Test:** `configure → save → point awards match settings`
- **Doc:** "Tilpass gamification"

---

## 📜 Governance (2 journeys)

### J-058: Create Policy & Protocol

- **Actor:** Admin | **Platform:** Desktop | **Priority:** P0 | **Tags:** `write`, `ai-assisted`
- **Trigger:** Governance Studio
- **Steps:** Create Policy (name, scope, category) → Attach Protocol → Build Procedure (steps+media) → Add Knowledge Test → Add Confirmation (DocuSeal) → Assign → Publish
- **Test:** `policy → protocol → procedure + test → assign → visible in training`
- **Doc:** "Lag regler teamet ditt kan følge"

### J-059: AI-Assisted Governance

- **Actor:** Admin | **Platform:** Desktop | **Priority:** P1 | **Tags:** `write`, `ai-assisted`
- **Trigger:** Governance Studio → "La AI hjelpe"
- **Steps:** Describe the rule in plain Norwegian → AI suggests policy structure → AI generates procedure steps → AI creates test questions → Admin reviews → Publish
- **Test:** `describe rule → AI generates → review → publish → complete chain`
- **Doc:** "La AI bygge reglene for deg"

---

## 📝 Contracts (3 journeys)

### J-060: Create Employment Contract

- **Actor:** Admin | **Platform:** Desktop | **Priority:** P1 | **Tags:** `write`, `docuseal`, `compliance`, `norwegian-law`
- **Trigger:** People → Employee → Ny kontrakt
- **Steps:** Select template → Fill details (position, salary, hours, start date) → Merge fields auto-populated → Preview → Send for signing via DocuSeal
- **Test:** `template → fill → preview → send → DocuSeal initiated`
- **Doc:** "Opprett en arbeidsavtale"

### J-061: Sign Employment Contract

- **Actor:** Employee | **Platform:** Both | **Priority:** P1 | **Tags:** `write`, `docuseal`, `compliance`
- **Trigger:** Notification: "Ny kontrakt å signere"
- **Steps:** Open → Read contract → Digital signature via DocuSeal → Both parties signed → Contract active → Profile synced
- **Test:** `open → read → sign → status = active → profile updated`
- **Doc:** "Signer arbeidsavtalen din"

### J-062: Amend Contract

- **Actor:** Admin | **Platform:** Desktop | **Priority:** P2 | **Tags:** `write`, `docuseal`, `compliance`
- **Trigger:** People → Employee → Kontrakt → Endre
- **Steps:** Select amendment type (salary, role, hours) → Enter changes → Create amendment document → Send for signing → Profile auto-updates
- **Test:** `amend → new doc → sign → profile reflects changes`
- **Doc:** "Endre en arbeidsavtale"

---

## 🏅 Certifications (2 journeys)

### J-063: Upload / Register Certification

- **Actor:** Employee / Admin | **Platform:** Both | **Priority:** P1 | **Tags:** `write`, `compliance`
- **Trigger:** Me → Sertifikater → Legg til or Admin uploads
- **Steps:** Select type (food safety, first aid, alcohol, etc.) → Upload document → Enter details (issuer, date, expiry) → Submit → Verified by manager
- **Test:** `upload → details → submit → visible → expiry tracking active`
- **Doc:** "Registrer sertifikatene dine"

### J-064: Certification Expiry Alert & Renewal

- **Actor:** Employee / Admin | **Platform:** Both | **Priority:** P1 | **Tags:** `push-notification`, `compliance`
- **Trigger:** Auto: 90/30/7 days before expiry
- **Steps:** Notification: "Sertifikat utløper snart" → View details → Upload renewal → Or: schedule re-certification → Manager notified
- **Test:** `expiry approaching → notification → renewal uploaded → status updated`
- **Doc:** "Forny sertifikatene dine"

---

## 🎯 Journey Portal — Meta (4 journeys)

These are journeys about using the Journey Portal itself.

### J-065: Browse & Filter Journeys

- **Actor:** Admin | **Platform:** Desktop | **Priority:** P0 | **Tags:** `read-only`
- **Trigger:** Admin → /admin/journeys
- **Steps:**
  1. See pipeline overview (status counts with progress bars)
  2. Filter by: module, status, actor, priority, search
  3. Sort by: created, updated, priority, status
  4. Click journey → Detail view with all tabs
  5. See outputs: which are generated, which are pending
- **Test:** `open portal → pipeline visible → filter works → detail loads → outputs shown`
- **Doc:** "Bruk Journey-portalen"

### J-066: Create Journey via Agent Wizard

- **Actor:** Admin | **Platform:** Desktop | **Priority:** P0 | **Tags:** `write`, `ai-assisted`
- **Trigger:** Journey Portal → "✨ Ny Journey" → "Start Wizard"
- **Steps:**
  1. Journey Agent opens wizard chat
  2. Phase 1 — Discovery: Agent asks what, who, when, why
  3. Phase 2 — Classification: Agent suggests module, actor, platform, tags
  4. Phase 3 — Steps: Agent helps define step-by-step flow
  5. Phase 4 — Testing: Agent generates test assertion
  6. Phase 5 — Documentation: Agent generates Norwegian doc + Botsson script
  7. Phase 6 — Review: Full summary → Confirm → Journey saved as "Defined"
- **Test:** `start wizard → complete all phases → journey created → status = defined`
- **Doc:** "Definer en ny journey med AI-hjelp"

### J-067: Run E2E Tests from Portal

- **Actor:** Admin | **Platform:** Desktop | **Priority:** P1 | **Tags:** `read-only`
- **Trigger:** Journey Portal → Journey detail → "Kjør test" or "Kjør alle tester"
- **Steps:**
  1. Click "Kjør test" on single journey OR "Kjør alle" for Live/Testing journeys
  2. See running indicator
  3. Results: pass/fail per journey with timestamp
  4. Failed tests link to error details
  5. History of test runs over time
- **Test:** `run test → indicator → result → history updated`
- **Doc:** "Kjør automatiske tester"

### J-068: Move Journey Through Lifecycle

- **Actor:** Admin | **Platform:** Desktop | **Priority:** P0 | **Tags:** `write`
- **Trigger:** Journey detail → Status dropdown
- **Steps:**
  1. See current status and allowed transitions
  2. Select new status → System validates transition rules
  3. If moving to "Ready for Implementation" → Offer to create Linear issue
  4. If moving to "Active" → All outputs auto-generated
  5. Status change logged in journey event history
- **Test:** `change status → valid transition → Linear offered → outputs generated → event logged`
- **Doc:** "Flytt en journey gjennom livssyklusen"

---

# PART III — IMPLEMENTATION PLAN

---

## 6. Database Schema

### 6.1 Tables

```sql
-- ─── Journey ─────────────────────────────────────────────────────
CREATE TABLE journey (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES workspace(workspace_id),

  -- Identity
  title           text NOT NULL,
  slug            text NOT NULL,

  -- Classification
  module          text NOT NULL,    -- ModuleCode enum
  actor           text NOT NULL,    -- Actor enum
  platform        text NOT NULL,    -- Platform enum
  priority        text NOT NULL,    -- Priority enum
  tags            text[] DEFAULT '{}',

  -- Content
  trigger_desc    text NOT NULL,
  preconditions   text[] DEFAULT '{}',
  outcomes_json   jsonb NOT NULL DEFAULT '{}',
  -- outcomes_json: { success: string, empty: string, error: string }

  -- Test
  test_assertion  text,

  -- Documentation
  doc_title       text,
  doc_category    text,
  botsson_script  text,

  -- Lifecycle
  status          text NOT NULL DEFAULT 'idea',

  -- Outputs
  output_e2e      boolean DEFAULT false,
  output_doc      boolean DEFAULT false,
  output_linear   boolean DEFAULT false,
  output_botsson  boolean DEFAULT false,

  -- Test tracking
  last_test_run   timestamptz,
  last_test_result text,          -- pass | fail | skip | null

  -- Relations
  assignee_id     uuid REFERENCES profile(profile_id),
  linear_issue_id text,
  related_journeys uuid[] DEFAULT '{}',
  blocked_by      uuid[] DEFAULT '{}',

  -- Wizard
  wizard_session_id uuid,
  wizard_completed  boolean DEFAULT false,

  -- Meta
  created_by      uuid REFERENCES profile(profile_id),
  version         integer DEFAULT 1,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE journey ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_isolation" ON journey
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM profile
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE INDEX idx_journey_workspace ON journey(workspace_id);
CREATE INDEX idx_journey_module ON journey(module);
CREATE INDEX idx_journey_status ON journey(status);
CREATE UNIQUE INDEX idx_journey_slug ON journey(workspace_id, slug);


-- ─── Journey Step ────────────────────────────────────────────────
CREATE TABLE journey_step (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id      uuid NOT NULL REFERENCES journey(id) ON DELETE CASCADE,

  sort_order      integer NOT NULL,
  action          text NOT NULL,
  expects         text,
  screen          text,
  component       text,
  data_reads      text[] DEFAULT '{}',
  data_writes     text[] DEFAULT '{}',
  notes           text,

  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_journey_step_journey ON journey_step(journey_id);


-- ─── Journey Test Step ───────────────────────────────────────────
CREATE TABLE journey_test_step (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id      uuid NOT NULL REFERENCES journey(id) ON DELETE CASCADE,
  step_ref        uuid REFERENCES journey_step(id),

  selector        text,
  assertion       text NOT NULL,
  setup_data      text,

  created_at      timestamptz DEFAULT now()
);


-- ─── Journey Event (audit log) ──────────────────────────────────
CREATE TABLE journey_event (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id      uuid NOT NULL REFERENCES journey(id) ON DELETE CASCADE,

  event_type      text NOT NULL,
  -- 'status_change' | 'test_run' | 'output_generated' | 'edit' | 'comment'

  from_status     text,
  to_status       text,
  actor_id        uuid REFERENCES profile(profile_id),
  metadata        jsonb DEFAULT '{}',

  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_journey_event_journey ON journey_event(journey_id);
CREATE INDEX idx_journey_event_type ON journey_event(event_type);


-- ─── Wizard Session ─────────────────────────────────────────────
CREATE TABLE wizard_session (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES workspace(workspace_id),
  journey_id      uuid REFERENCES journey(id),

  status          text NOT NULL DEFAULT 'active',
  -- 'active' | 'completed' | 'abandoned'

  current_phase   text NOT NULL DEFAULT 'discovery',
  -- 'discovery' | 'classification' | 'steps' | 'testing' | 'documentation' | 'review'

  messages        jsonb DEFAULT '[]',
  draft_journey   jsonb DEFAULT '{}',

  created_by      uuid REFERENCES profile(profile_id),
  created_at      timestamptz DEFAULT now(),
  completed_at    timestamptz
);


-- ─── Test Run (history) ─────────────────────────────────────────
CREATE TABLE journey_test_run (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id      uuid NOT NULL REFERENCES journey(id),

  result          text NOT NULL,   -- pass | fail | skip
  duration_ms     integer,
  error_details   text,
  environment     text,            -- staging | production

  triggered_by    uuid REFERENCES profile(profile_id),
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_test_run_journey ON journey_test_run(journey_id);
```

### 6.2 Seed Data

The 68 journeys defined in this document should be loaded as seed data via a migration script. Each journey gets seeded with status = `active` for already-built features or `idea` / `defined` for planned ones.

---

## 7. API Routes (Supabase Edge Functions)

```
/api/journeys
  GET    /                        → List journeys (filters: module, status, actor, priority, search)
  POST   /                        → Create journey
  GET    /:id                     → Get journey detail (includes steps, test steps, events)
  PATCH  /:id                     → Update journey
  DELETE /:id                     → Soft delete (archive)

  POST   /:id/status              → Change status (validates transition rules)
  POST   /:id/test                → Trigger E2E test run
  GET    /:id/test-history        → List test runs for journey

  POST   /:id/generate/:output    → Generate output (e2e | doc | linear | botsson)
  GET    /:id/outputs/:output     → Get generated output content

/api/journeys/bulk
  POST   /test                    → Run all tests for status = active | testing
  GET    /stats                   → Pipeline stats (counts per status, per module)

/api/wizard
  POST   /                        → Start wizard session
  POST   /:id/message             → Send message to agent (returns agent response)
  POST   /:id/complete            → Finalize wizard → create journey
  POST   /:id/abandon             → Abandon wizard session
  GET    /:id                     → Get wizard session with messages

/api/journeys/search
  GET    ?q=                      → Full-text search across title, trigger, steps
```

---

## 8. Component Tree

```
apps/web/app/admin/journeys/
├── page.tsx                      → Main portal page (pipeline + table)
├── [id]/
│   └── page.tsx                  → Journey detail page
├── create/
│   └── page.tsx                  → Manual create form
├── wizard/
│   ├── page.tsx                  → Start new wizard session
│   └── [sessionId]/
│       └── page.tsx              → Active wizard chat interface
│
├── components/
│   ├── JourneyPipeline.tsx       → Status cards with counts + progress bars
│   ├── JourneyTable.tsx          → Filterable, sortable table
│   ├── JourneyFilters.tsx        → Module, status, actor, priority, search
│   ├── JourneyRow.tsx            → Single table row
│   ├── JourneyDetail.tsx         → Full detail view with tabs
│   ├── JourneySteps.tsx          → Step flow visualization
│   ├── JourneyStatusBadge.tsx    → Status badge with icon + color
│   ├── JourneyStatusChanger.tsx  → Dropdown with transition validation
│   ├── JourneyOutputTabs.tsx     → E2E / Doc / Linear / Botsson tabs
│   ├── JourneyOutputViewer.tsx   → Code/markdown viewer per output type
│   ├── JourneyEventLog.tsx       → Audit trail / activity feed
│   ├── JourneyTestRunner.tsx     → Test trigger + result display
│   ├── JourneyTestHistory.tsx    → Historical test results
│   ├── JourneyCreateForm.tsx     → Manual creation form
│   ├── JourneyRelations.tsx      → Related/blocked-by links
│   │
│   ├── WizardChat.tsx            → Agent chat interface
│   ├── WizardPhaseIndicator.tsx  → Discovery → Classification → Steps → ...
│   ├── WizardMessageBubble.tsx   → Agent/user message rendering
│   ├── WizardDraftPreview.tsx    → Live preview of journey being built
│   │
│   ├── OutputGenerator.tsx       → Generate E2E / Doc / Linear / Botsson
│   ├── E2ECodeViewer.tsx         → Syntax-highlighted test code
│   ├── DocPreview.tsx            → Rendered markdown preview
│   ├── LinearIssuePreview.tsx    → Linear-formatted spec preview
│   ├── BotssonScriptViewer.tsx   → Voice script viewer
│   │
│   └── shared/
│       ├── ModuleBadge.tsx       → Module icon + name + color
│       ├── ActorBadge.tsx        → Actor badge
│       ├── PriorityBadge.tsx     → Priority indicator
│       ├── PlatformIcon.tsx      → 📱 🖥️ 🖥️📱
│       └── TestResultBadge.tsx   → ✅ ❌ ⏳ — display

├── hooks/
│   ├── useJourneys.ts            → Fetch + filter journeys
│   ├── useJourney.ts             → Single journey with steps
│   ├── useJourneyStats.ts        → Pipeline statistics
│   ├── useJourneyStatus.ts       → Status change with validation
│   ├── useTestRunner.ts          → Test execution + results
│   ├── useWizardSession.ts       → Wizard state management
│   └── useOutputGenerator.ts     → Output generation

├── lib/
│   ├── journey-schema.ts         → Zod schemas
│   ├── status-transitions.ts     → Valid status transitions map
│   ├── output-generators/
│   │   ├── e2e-generator.ts      → Generate Playwright/Detox code
│   │   ├── doc-generator.ts      → Generate Norwegian onboarding doc
│   │   ├── linear-generator.ts   → Generate Linear issue spec
│   │   └── botsson-generator.ts  → Generate voice script
│   └── journey-seed.ts           → Seed data for 68 journeys

└── types/
    └── journey.ts                → TypeScript types (from schema above)
```

---

## 9. Summary

| Metric                 |          Count          |
| ---------------------- | :---------------------: |
| Total Journeys         |         **68**          |
| Modules Covered        | **18** (including meta) |
| P0 Critical            |         **28**          |
| P1 Important           |         **28**          |
| P2 Nice to have        |         **10**          |
| P3 Future              |          **2**          |
| Employee journeys      |         **30**          |
| Admin/Manager journeys |         **32**          |
| All-role journeys      |          **6**          |
| Mobile-primary         |         **28**          |
| Desktop-primary        |         **24**          |
| Both platforms         |         **16**          |
| Lifecycle statuses     |         **13**          |
| Output types           |          **4**          |
| Tags defined           |         **20**          |
| Database tables        |          **6**          |
| API endpoints          |         **~15**         |
| UI components          |         **~30**         |

---

_This document is the complete specification for Smartout's Journey-Driven Development system. Every user flow is mapped, classified, and ready to generate implementation artifacts. The Journey Portal at `/admin/journeys` is both the control center for building Smartout and a living product feature map._
