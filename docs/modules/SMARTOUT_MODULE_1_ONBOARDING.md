---
title: "Module 1: Onboarding & Brukerregistrering"
id: MODULE_01
version: "2.0"
status: canonical
layer: module
created: 2026-02-24
updated: 2026-02-28
author: pontus
supersedes:
  - SMARTOUT_ONBOARDING_FRAMEWORK.md
  - SMARTOUT_ONBOARDING_FRAMEWORK_v2.md
superseded_by: null
depends_on:
  - CORE_ARCH_V2
tags:
  - onboarding
  - trainee-mode
  - module-journeys
  - sandbox
  - ai-guided
tables:
  - trainee_journey
  - module_journey
  - module_journey_checkpoint
  - profile_checkpoint_progress
changelog:
  - date: 2026-02-28
    change: "Added YAML frontmatter"
---

# Module 1: Onboarding & Brukerregistrering

> **Smartout.io** — Functional documentation for migration
> Version 2.0 | February 2026
> **Supersedes:** SMARTOUT_ONBOARDING_FRAMEWORK.md (v1), SMARTOUT_ONBOARDING_FRAMEWORK_v2.md

---

## 1. Module Overview

Onboarding in Smartout is split into **THREE distinct systems:**

| System                | Purpose                     | Scope                                        | Timeline                                                   |
| --------------------- | --------------------------- | -------------------------------------------- | ---------------------------------------------------------- |
| **Trainee Mode**      | Learn Smartout the software | Navigation, functionality, installed modules | Must complete before first real shift                      |
| **Module Journeys**   | Per-module quick onboarding | One journey per installed module             | Part of trainee mode + triggered when new modules activate |
| **Protocol Training** | Learn the actual job        | HACCP, kitchen procedures, safety, etc.      | Longer timeline, managed by governance model               |

**Trainee Mode** and **Module Journeys** are what this document covers. Protocol Training lives in the Training module (Module 6) and the governance model (Policy → Protocol → Procedure/KnowledgeTest/Confirmation) — it runs alongside and after the trainee period on its own schedule.

### Module Boundary

| System                | Owned by                                | Data tables                                                                  |
| --------------------- | --------------------------------------- | ---------------------------------------------------------------------------- |
| **Trainee Mode**      | This module (Module 1)                  | `trainee_journey`                                                            |
| **Module Journeys**   | This module (Module 1)                  | `module_journey`, `module_journey_checkpoint`, `profile_checkpoint_progress` |
| **Protocol Training** | Module 6 (Training) + Core (Governance) | `procedure`, `knowledge_test`, `confirmation` + training progress tables     |

---

## 2. Workspace Creation (First Run)

Before any employee can be onboarded, an admin must create a workspace. This is the **admin's own onboarding** — the first-time setup flow that creates the operational environment.

### 2.1 Signup Flow

```
Admin visits smartout.io
  → "Start gratis prøveperiode" / "Get started"
  → Create account
      Email + password (Supabase Auth)
      OR Google / Microsoft SSO
  → Create Company
      Company name (required)
      Org number (Norwegian: required for compliance)
      Industry: restaurant | hotel | cafe | bar | catering | other
  → Create first Workspace
      Workspace name (e.g., "Bårdshaug Vegkro")
      Address (optional, can add later)
      Timezone (auto-detected, defaults to Europe/Oslo)
      Language (defaults to Norsk)
  → System creates:
      Company record
      CompanyMember (role: owner)
      Workspace (with default Season auto-created)
      Profile (role: owner, status: active)
      Stripe subscription (trial period starts)
```

### 2.2 Workspace Setup Wizard

After workspace creation, the admin runs through a guided setup:

```
WORKSPACE SETUP
│
├── Step 1: Departments
│     "Hvilke avdelinger har dere?"
│     → Suggest defaults based on industry (Restaurant: Kjøkken, Sal, Bar)
│     → Admin confirms, adjusts, or adds custom
│
├── Step 2: Locations
│     "Har dere flere serveringsområder?"
│     → Main location auto-created from workspace address
│     → Add additional: Uteterrasse, Bankett, etc.
│
├── Step 3: Positions
│     "Hvilke stillinger finnes?"
│     → Suggest defaults per department (Kjøkken: Kokk, Sous Chef, Oppvask)
│     → Admin confirms, adjusts, or adds custom
│
├── Step 4: Modules
│     "Hvilke moduler vil du aktivere?"
│     → Show available modules with descriptions
│     → Recommend based on industry + plan
│     → Toggle on/off (can change later)
│
└── Step 5: Invite First Employee
      "Klar til å invitere ditt første teammedlem?"
      → Leads directly into invitation flow (Section 3)
```

**AI assistance:** Mr. Botsson can guide the admin through workspace setup conversationally, offering industry-specific suggestions. "Jeg ser dere er en restaurant. De fleste restauranter starter med Kjøkken, Sal og Bar som avdelinger. Stemmer det for dere?"

**Note:** Detailed workspace settings and configuration are covered in Module 11 (Settings & Administration). This section covers only the first-time flow.

---

## 3. Invitation & Account Creation

The invitation flow is how employees enter the Smartout ecosystem. It creates the User (if new) and Profile, and triggers Trainee Mode.

### 3.1 Invitation Methods

| Method              | How                                                                 | Best for                                |
| ------------------- | ------------------------------------------------------------------- | --------------------------------------- |
| **Email invite**    | Admin enters employee's email. System sends invite link via Resend. | Standard — most employees               |
| **SMS invite**      | Admin enters employee's phone. System sends invite link via Twilio. | Employees without regular email access  |
| **Shareable link**  | Admin generates a workspace invite link with optional expiry.       | Job fairs, group hiring, walk-ins       |
| **Bulk CSV import** | Admin uploads CSV with name, email, phone, department, position.    | Seasonal hiring (10+ employees at once) |

### 3.2 Invitation Data

When creating an invite, admin provides:

| Field              | Required  | Description                                          |
| ------------------ | --------- | ---------------------------------------------------- |
| **Name**           | Yes       | First name + last name                               |
| **Email or Phone** | Yes (one) | Login identifier and invite delivery                 |
| **Department**     | Yes       | Primary department assignment                        |
| **Position**       | No        | Default position (can be set later)                  |
| **Role**           | No        | Defaults to `employee`. Admin can set `manager`.     |
| **Team(s)**        | No        | Team memberships (can be assigned later)             |
| **Start date**     | No        | Expected first day — used for first shift scheduling |
| **Language**       | No        | Defaults to workspace language. Can override.        |

### 3.3 Acceptance Flow

```
Employee receives invite (email / SMS / clicks link)
  │
  ├── New to Smartout (no existing User)
  │     → Create account page
  │     → Email + password / magic link / SMS OTP (Supabase Auth)
  │     → User record created
  │     → Profile created (status: trainee, linked to workspace)
  │     → CompanyMember created (role: member)
  │     → Redirect to Smartout app → Trainee Mode begins
  │
  └── Existing User (has account from another workspace)
        → "Du har allerede en Smartout-konto. Logg inn for å koble til [Workspace]."
        → Login
        → New Profile created (status: trainee, linked to new workspace)
        → User now has multiple Profiles, selects workspace on login
        → Trainee Mode begins for new workspace
```

### 3.4 What Gets Created

When an invite is accepted, the system automatically creates:

| Entity                          | Details                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| **User**                        | If new. Auth credentials, personal info.                                             |
| **CompanyMember**               | Links User to Company (role: member).                                                |
| **Profile**                     | Status: `trainee`. Role as specified by admin. Department, position, teams assigned. |
| **trainee_journey**             | Auto-created with `status: not_started`. First shift date populated if known.        |
| **profile_checkpoint_progress** | Records created for all required module journey checkpoints.                         |

### 3.5 Invite Management

Admin can manage outstanding invites:

| Action           | Description                                                 |
| ---------------- | ----------------------------------------------------------- |
| **Resend**       | Re-send invite via original channel or alternate            |
| **Cancel**       | Revoke invite before acceptance                             |
| **Expire**       | Invites expire after configurable period (default: 14 days) |
| **Track**        | See which invites are pending, accepted, expired            |
| **Bulk actions** | Resend all pending, cancel all expired                      |

### 3.6 Bulk Import

For seasonal hiring, admin can upload a CSV:

```
name,email,phone,department,position,start_date,language
Anna Olsen,anna@email.com,+4741234567,Kjøkken,Kokk,2026-06-01,no
Erik Berg,,+4798765432,Sal,Servitør,2026-06-01,sv
Lise Hansen,lise@email.com,,Bar,Bartender,2026-06-01,no
```

System validates, deduplicates (checks existing Users by email/phone), creates invites, and sends all at once. Admin reviews a preview before confirming.

---

## 4. Trainee Mode

### What It Is

The period between accepting a Smartout invite and your first real shift. You're learning the SYSTEM, not the job. `Profile.status = 'trainee'`.

### What It Contains

```
TRAINEE MODE
│
├── Core Journey (learn Smartout basics)
│     ├── Profile setup (including emergency contact)
│     ├── Navigation & layout orientation
│     └── Core concepts (what are shifts, tasks, chat, etc.)
│
├── Module Journeys (per installed module, AI-ordered)
│     ├── Scheduling: view shifts, test punch-in, register availability
│     ├── Chat: find team chat, send a message
│     ├── Tasks: complete a test task
│     ├── HACCP: log a test temperature reading
│     └── ... one per active module in workspace
│
└── Admin/Leader Approval Gate
      └── All journeys complete → AI notifies → admin/leader confirms → active
```

### Hard Deadline

Trainee mode must be completed before the trainee's **first real shift**. The AI uses this as a natural urgency driver.

**48-hour escalation:** If the trainee isn't ready 48 hours before their first scheduled real shift, the AI escalates to admin. Admin decides: extend, override, or reschedule the shift.

### Transition: Trainee → Active

Requires BOTH:

1. All required module journeys completed (core + installed modules)
2. Admin or leader explicitly approves readiness

Admin/leader sees the trainee's progress dashboard, reviews completion, and confirms. This is a human checkpoint — the system doesn't auto-transition.

### Sandbox Rules

During trainee mode, activities are a **mix of sandbox and real:**

| Activity                      | Mode    | Reason                                                            |
| ----------------------------- | ------- | ----------------------------------------------------------------- |
| **Punch clock**               | Sandbox | Simulated — doesn't create real payroll data                      |
| **Task completion**           | Sandbox | Test tasks — don't affect session sign-off                        |
| **Temperature logging**       | Sandbox | Practice entries — don't count for HACCP compliance               |
| **Availability registration** | Sandbox | Practice — doesn't affect real scheduling                         |
| **Chat / messages**           | Real    | Social integration matters from day one                           |
| **Profile setup**             | Real    | Actual profile data — name, photo, emergency contact, preferences |
| **Reading procedures**        | Real    | Actual content, progress tracked                                  |

### Trainee Visibility in Scheduling

**Trainees ARE visible in the Module 3 scheduling grid** with a visual trainee badge/tag. Managers can assign trainees to shifts, which establishes their "first shift" deadline for trainee mode completion.

Key rules:

- Trainees appear in the employee list with a `TRAINEE` badge
- Managers can assign them to shifts like any other employee
- The first assigned shift automatically becomes the trainee deadline
- Published shifts for trainees include a warning: "Employee is still in trainee mode"
- Trainees cannot participate in real Department Sessions (Module 4) until `status = active`
- If trainee isn't ready when their shift arrives, the 48h escalation flow handles it

### Payroll During Trainee Mode

**Paid only if trainee mode happens during scheduled hours.** Trainee can explore Smartout on their own time (unpaid), but employer-mandated training sessions during scheduled time are compensable per Norwegian labor law.

### Remote Onboarding

**Admin configurable per workspace.** Some restaurants want trainees to explore Smartout from home before day one. Others want it on-site only. Admin sets this in workspace settings.

---

## 5. Module Journeys

### Definition: Hybrid Checkpoints + AI Guidance

Each module ships with **hardcoded checkpoints** — measurable completion criteria. The AI provides **dynamic guidance** around those checkpoints, adapting to the person.

```
MODULE JOURNEY: Scheduling
│
├── Checkpoint: Viewed schedule page          (screen visit)
├── Checkpoint: Found own shift               (screen visit)
├── Checkpoint: Test punch-in completed       (action — sandbox)
├── Checkpoint: Registered availability       (action — sandbox)
└── Checkpoint: Understood shift swap concept  (screen visit + AI confirms understanding)

AI GUIDANCE (dynamic, per person):
  → Experienced user: "Here's your schedule. Try punching in. Done? Great."
  → New to tech: "See this calendar? Each colored block is a shift.
                   Let me show you YOUR shifts... tap on this one..."
```

### Checkpoint Types

Checkpoints are **mixed** — some are actions, some are screen visits:

| Type                          | Example                          | How tracked                                      |
| ----------------------------- | -------------------------------- | ------------------------------------------------ |
| **Screen visit**              | "User visited the schedule page" | Navigation event                                 |
| **Action**                    | "User completed a test punch-in" | System event from the action                     |
| **AI-verified understanding** | "User understood shift swap"     | AI asks a quick question, confirms comprehension |

### Ordering

**AI decides the order based on first shift needs.** If the trainee's first shift is a kitchen closing shift, the AI prioritizes:

1. Scheduling (find your shift, understand the time)
2. Tasks (you'll have closing procedures)
3. HACCP (temperature logging is part of closing)
4. Chat (handoff notes at end of shift)

If no first shift is scheduled yet, AI uses a sensible default order based on the trainee's department and position.

### Module Journeys for Active Employees

**When a new module is activated in a workspace, ALL users get the module journey** — not just trainees. The AI adapts the depth based on the user's history:

| User type                             | AI behavior                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------------- |
| **Trainee**                           | Full guided journey with all checkpoints                                              |
| **Active employee, tech-comfortable** | Quick overview: "New module: HACCP. Here's where it is, here's what it does. Try it." |
| **Active employee, less comfortable** | Deeper guidance, similar to trainee but skipping basics they already know             |
| **Admin/manager**                     | Focus on management features: "Here's how to configure HACCP for your team"           |

This makes the module journey system a **feature adoption engine**, not just an onboarding tool.

---

## 6. AI Copilot — Mr. Botsson as Guide

### Interaction Mode

**Chat-first, voice as upgrade option.**

Default is text-based chat guidance. Trainee can switch to voice anytime. AI remembers preference and adapts over time.

Chat-first because:

- Works in noisy restaurant environments
- Lower barrier (no need to find a quiet spot)
- Trainee can do it on public transport, at home, etc.
- Voice available as upgrade for those who prefer it

### AI Language

**Matches `preferred_language` on the employee's profile.** If a Swedish-speaking employee joins a Norwegian restaurant, Mr. Botsson speaks Swedish during onboarding. The AI adapts to whatever language the user has set.

### AI Capabilities (Tool Calling)

The AI has six UI guidance capabilities plus operational tools:

**UI Guidance Tools:**

| Tool                | What it does                             | Implementation                                  |
| ------------------- | ---------------------------------------- | ----------------------------------------------- |
| `navigate_to`       | Opens a specific screen/page             | Next.js router programmatic navigation          |
| `highlight_element` | Pulse/glow animation on a UI element     | CSS animation on `data-onboard` tagged elements |
| `show_tooltip`      | Contextual tooltip overlay on an element | Portal-rendered tooltip component               |
| `spotlight_element` | Dims background, spotlights one element  | Overlay with cutout mask                        |
| `autofill_demo`     | Fills a form with demo data for practice | Dispatches values to form state                 |
| `celebrate`         | Confetti/celebration animation           | Triggered on checkpoint completion              |

**Operational Tools:**

| Tool                        | What it does                                                    |
| --------------------------- | --------------------------------------------------------------- |
| `get_trainee_progress`      | Returns current completion status across all journeys           |
| `mark_checkpoint`           | Records a checkpoint as completed                               |
| `suggest_next`              | AI recommends next step based on progress + first shift context |
| `start_sandbox_activity`    | Initiates a sandbox activity (test shift, test task, etc.)      |
| `complete_sandbox_activity` | Marks sandbox activity as done, records result                  |
| `escalate_to_admin`         | Alerts admin about trainee progress concerns                    |

### Profile-Specific Adaptation

The AI adapts based on:

| Signal                  | Adaptation                                                                     |
| ----------------------- | ------------------------------------------------------------------------------ |
| **Position**            | Kokk gets kitchen-relevant modules first. Servitør gets service modules first. |
| **Experience**          | "Have you used scheduling software before?" → Yes: compress. No: expand.       |
| **Learning speed**      | Fast checkpoint completion → skip detailed guidance. Slow → more support.      |
| **Language**            | Matches `preferred_language` from profile                                      |
| **Time available**      | "You have 15 minutes? Let's do one quick module."                              |
| **First shift context** | Orders modules by relevance to upcoming shift                                  |
| **Engagement**          | Low engagement detected → switch approach, offer help, check if stuck          |

### First Launch Experience

```
[Trainee opens Smartout for the first time]

Mr. Botsson: "Hei, velkommen til [Restaurant Name]! 👋

             Jeg er Mr. Botsson, din guide i Smartout.
             Før din første vakt skal jeg vise deg hvordan
             alt fungerer her.

             Du har [X] ting å gå gjennom. Vi tar det i
             ditt tempo.

             Skal vi starte?"

[AI navigates to first checkpoint based on first shift context]
[Spotlight on key element]
[Guidance begins]
```

---

## 7. Trainee Progress UI

### Trainee View: Checklist + Progress Bar

The trainee sees **both** a progress bar (overview) and a checklist (detail):

```
┌─────────────────────────────────────┐
│  Din fremgang          ████████░░ 75%  │
│                                         │
│  ✅ Smartout Grunnleggende    4/4       │
│  ✅ Vaktplanlegging           5/5       │
│  🔄 Oppgaver                  2/4       │
│  ○  Chat                      0/3       │
│  ○  HACCP                     0/4       │
│                                         │
│  Første vakt: Fredag 28. feb            │
│  3 dager igjen                          │
│                                         │
│  [Fortsett der du slapp →]             │
└─────────────────────────────────────┘
```

Tapping a module expands to show individual checkpoints with check/uncheck status.

### Admin/Leader View: Dashboard + AI Alerts

**Dashboard shows:**

| Column        | Data                                            |
| ------------- | ----------------------------------------------- |
| Employee      | Name, position, department                      |
| Progress      | Overall % + per-module breakdown                |
| Status        | On track / At risk / Blocked / Ready            |
| First shift   | Date + days remaining                           |
| Last activity | When they last interacted                       |
| Action        | Approve readiness / Send reminder / View detail |

**AI proactive alerts:**

- "Anna har ikke logget inn på 3 dager. Første vakt er om 4 dager."
- "Erik sliter med HACCP-modulen — har forsøkt temperaturloggen 3 ganger uten å fullføre."
- "3 av 5 nye ansatte stopper opp på oppgave-modulen, steg 3. Kanskje vi bør forenkle?"
- "Lise er ferdig med alt. Klar for godkjenning."

---

## 8. Cross-Training & Ongoing Readiness

### Cross-Training (Department Move)

When an active employee moves to a new department: **no trainee mode**. Status stays `active`. New department protocols are assigned, and the AI guides them through new procedures conversationally.

The employee already knows Smartout — they just need to learn new job-specific content. The governance model handles this: new team → new policies → new protocols → AI guides completion.

### Season Changes

New season with new protocols → AI detects unfinished protocols for existing employees and proactively reaches out:

"Hei! Sommersesong er i gang. Du har 3 nye rutiner å lære for uteterrassen. Skal vi ta dem nå?"

### Policy Updates

When a procedure is updated → employees who completed the old version get notified and guided through changes. Not a full re-onboarding — just the delta.

---

## 9. Gamification During Onboarding

### Points Carry Over

**Trainee points count toward the first active season.** Points earned during trainee mode (completing checkpoints, finishing module journeys) carry over when the trainee transitions to `active` status and become part of their score in the current season's competition.

This means:

- Trainees who complete onboarding quickly start their active career with a point advantage
- Points act as motivation during trainee mode (real stakes, not throwaway)
- The leaderboard shows trainee points alongside active employee points once they transition
- If trainee mode spans a season boundary, points land in whichever season is active at transition

### Point-Earning Actions During Trainee Mode

| Action                                                          | Points | Notes                             |
| --------------------------------------------------------------- | ------ | --------------------------------- |
| Complete a module journey checkpoint                            | 5      | Per checkpoint                    |
| Complete an entire module journey                               | 15     | Bonus for finishing a full module |
| Complete all journeys (100%)                                    | 50     | Readiness bonus                   |
| Complete onboarding early (>48h before first shift)             | 25     | Early completion bonus            |
| Complete profile setup (all fields including emergency contact) | 10     | Encourages complete profiles      |

Point values are configurable per workspace via the gamification config (see Module 4, Section 22.3).

---

## 10. Data Model

### New Tables

```
-- Trainee journey tracking
trainee_journey
  id                   uuid (PK)
  profile_id           fk → profile
  workspace_id         fk → workspace

  -- Status
  status               not_started | in_progress | completed | expired
  started_at           timestamp | null
  completed_at         timestamp | null

  -- Deadline
  first_shift_date     date | null
  escalated_at         timestamp | null (when 48h alert fired)
  escalation_response  extend | override | reschedule | null

  -- Approval
  approved_by          fk → profile | null
  approved_at          timestamp | null

  -- AI metadata
  preferred_mode       chat | voice
  ai_difficulty_level  integer (1-5, adapted by AI)
  language             string (from profile.preferred_language)

  created_at           timestamp
  updated_at           timestamp


-- Invitation tracking
workspace_invite
  invite_id            uuid (PK)
  workspace_id         fk → workspace

  -- Invite details
  email                string | null
  phone                string | null
  invite_method        email | sms | link | bulk
  invite_token         string (unique, used in invite URL)

  -- Pre-populated profile data
  first_name           string
  last_name            string
  role                 employee | manager (default: employee)
  department_id        fk → department | null
  position_id          fk → position | null
  team_ids             uuid[] | null
  language             string | null (override workspace default)
  start_date           date | null

  -- Status
  status               pending | accepted | expired | cancelled
  expires_at           timestamp
  accepted_at          timestamp | null
  accepted_by_user_id  fk → user | null (the User who accepted)

  -- Created by
  created_by           fk → profile
  created_at           timestamp
  updated_at           timestamp


-- Module journey definition (shipped with each module)
module_journey
  id                   uuid (PK)
  module_slug          string (scheduling, chat, haccp, tasks, etc.)
  is_core              boolean (true = Smartout core journey, not a module)
  version              string (1.0, 1.1 — updated when module UI changes)

  created_at           timestamp
  updated_at           timestamp


-- Checkpoints per module journey (hardcoded, shipped with module)
module_journey_checkpoint
  id                   uuid (PK)
  journey_id           fk → module_journey

  -- Identity
  name                 string ("Test punch-in", "View schedule")
  description          string | null
  checkpoint_type      screen_visit | action | ai_verified
  sort_order           integer

  -- Tracking config
  event_name           string | null (system event that marks completion)
  target_screen        string | null (route path for screen_visit type)
  is_sandbox           boolean (sandbox or real activity)
  is_required          boolean (must complete for journey completion)

  -- AI guidance hints (AI uses these to generate dynamic guidance)
  ai_context           text | null (what the AI should explain about this step)
  ai_success_hint      text | null (what success looks like)

  created_at           timestamp
  updated_at           timestamp


-- Per-profile progress on each checkpoint
profile_checkpoint_progress
  id                   uuid (PK)
  profile_id           fk → profile
  checkpoint_id        fk → module_journey_checkpoint
  trainee_journey_id   fk → trainee_journey | null (null for active employee module journeys)
  workspace_id         fk → workspace

  -- Status
  status               not_started | in_progress | completed | skipped
  completed_at         timestamp | null

  -- AI interaction log
  attempts             integer (how many times they tried)
  ai_guided            boolean (did AI walk them through it)

  created_at           timestamp
  updated_at           timestamp
```

### Profile Schema Additions

The following fields are added to the Profile table (Core Architecture):

```
profile (additions for Module 1)
  -- Emergency contact (Norwegian labor law / workplace safety)
  emergency_contact_name       string | null
  emergency_contact_phone      string | null
  emergency_contact_relation   string | null (e.g., "Ektefelle", "Forelder", "Partner")
```

### Tables NOT Created

- ❌ No journey builder / journey template system
- ❌ No phase / milestone / week structure
- ❌ No separate onboarding task table
- ❌ No branching logic engine

### UI Guidance Infrastructure

```
-- No table needed. In-code only:

1. OnboardingOverlay component (React)
   - Listens to command bus
   - Renders: highlights, tooltips, spotlights, confetti
   - Portal-based (renders above all other UI)

2. data-onboard attributes on ~30-50 key UI elements
   - data-onboard="punch-in-button"
   - data-onboard="schedule-grid"
   - data-onboard="task-list"
   - etc.

3. Command bus (event emitter)
   - AI sends: { type: 'spotlight', elementId: 'punch-in-button' }
   - Overlay receives and renders

4. AI tool definitions for Mr. Botsson (~12 tools)
   - 6 UI tools (navigate, highlight, tooltip, spotlight, autofill, celebrate)
   - 6 operational tools (progress, checkpoint, suggest, sandbox, complete, escalate)
```

---

## 11. Integration Points

| Module                          | Integration                                                                                         |
| ------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Core Architecture**           | Profile.status (trainee/active), emergency_contact fields, preferred_language                       |
| **Module 2: Org Structure**     | Department, Team, Position → determines which protocols to assign                                   |
| **Module 3: Scheduling**        | Trainee visible in grid with badge. First shift = trainee deadline. Sandbox punch-in.               |
| **Module 4: Operations**        | Trainees excluded from real Department Sessions. Sandbox task completion. Module journey for tasks. |
| **Module 5: HACCP**             | Sandbox temperature logging. Module journey for HACCP.                                              |
| **Module 9: Communication**     | Real chat during trainee mode. Module journey for chat. Invite delivery via Resend/Twilio.          |
| **Module 12: AI (Mr. Botsson)** | All AI guidance, tool calling, voice integration                                                    |
| **Module 13: Billing**          | Workspace creation triggers Stripe subscription. Trainees count toward plan limits.                 |
| **Governance Model**            | Protocol training (separate from trainee mode, longer timeline)                                     |
| **Gamification**                | Trainee points carry over to first active season                                                    |

---

## 12. Implementation Sequence

| Phase                    | Scope                                                                                                 | Duration   |
| ------------------------ | ----------------------------------------------------------------------------------------------------- | ---------- |
| **1. Invitation system** | `workspace_invite` table. Email/SMS invite sending. Acceptance flow. Supabase Auth integration.       | Week 1-2   |
| **2. Data layer**        | `trainee_journey`, `module_journey`, checkpoint tables. Auto-assign on invite acceptance.             | Week 3-4   |
| **3. Core journey**      | Smartout basics: navigation, profile (incl. emergency contact), core concepts. Hardcoded checkpoints. | Week 5-6   |
| **4. AI chat guidance**  | Mr. Botsson tool definitions. Chat-based walkthrough. Progress tracking.                              | Week 7-8   |
| **5. UI overlay**        | `OnboardingOverlay` component. Element tagging. Navigate/highlight/spotlight/tooltip.                 | Week 9-10  |
| **6. Module journeys**   | Per-module checkpoints for Scheduling, Tasks, HACCP, Chat. Sandbox activities.                        | Week 11-12 |
| **7. Admin dashboard**   | Trainee progress view. Approval flow. AI alerts for at-risk trainees. Invite management.              | Week 13-14 |
| **8. Voice upgrade**     | Ultravox integration for voice-guided onboarding.                                                     | Week 15-16 |
| **9. Intelligence**      | Adaptive depth, difficulty, pacing. Profile-specific ordering. Auto-fill demo. Confetti.              | Week 17-18 |

---

## 13. Decisions Log

All decisions made during the design process:

| #   | Decision                      | Choice                                                               | Rationale                                                                                 |
| --- | ----------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1   | Architecture split            | Three systems: Trainee Mode + Module Journeys + Protocol Training    | Trainee mode = learn the tool. Protocols = learn the job. Different timelines.            |
| 2   | Trainee payroll               | Paid only during scheduled hours                                     | Norwegian labor law: employer-mandated training compensable. Self-exploration unpaid.     |
| 3   | Trainee → active transition   | Admin/leader approval required                                       | Human checkpoint ensures readiness beyond just checkbox completion.                       |
| 4   | Unready trainee at shift time | AI escalates 48h before, admin decides                               | Admin can extend, override, or reschedule. System doesn't block automatically.            |
| 5   | Sandbox scope                 | Mixed: punch clock/tasks sandbox, chat/profile real                  | Real chat for social integration. Sandbox for data-affecting activities.                  |
| 6   | Module journey definition     | Hybrid: hardcoded checkpoints + AI dynamic guidance                  | Measurable completion + adaptive experience. Best of both worlds.                         |
| 7   | Journey ordering              | AI decides based on first shift needs                                | Position + department + first shift context determines priority.                          |
| 8   | New module for active users   | Yes, all users get module journey                                    | Feature adoption engine, not just onboarding. AI adapts depth.                            |
| 9   | Default AI mode               | Chat-first, voice as upgrade                                         | Works in noisy environments, lower barrier, voice available on demand.                    |
| 10  | Remote onboarding             | Admin configurable per workspace                                     | Some want pre-day-one prep, others want on-site only.                                     |
| 11  | UI guidance capabilities      | All six: navigate, highlight, tooltip, spotlight, autofill, confetti | Full toolkit for rich guided experience.                                                  |
| 12  | Checkpoint types              | Mixed: actions + screen visits                                       | Actions for meaningful steps, screen visits for awareness.                                |
| 13  | Trainee progress display      | Checklist + progress bar                                             | Detail (what's left) + overview (how far along).                                          |
| 14  | Admin progress view           | Dashboard + AI proactive alerts                                      | See status at a glance + get warned about at-risk trainees.                               |
| 15  | Active employee new modules   | AI decides depth based on user history                               | Tech-comfortable → quick tour. Less comfortable → fuller guidance.                        |
| 16  | Cross-training                | No trainee mode, just new protocols + AI guidance                    | Employee already knows the system. Just needs new job content.                            |
| 17  | Language                      | Match profile's preferred_language                                   | Multilingual workforce reality in Norwegian service industry.                             |
| 18  | Trainee scheduling visibility | Visible with trainee badge, can be assigned shifts                   | First assigned shift becomes trainee deadline. Managers need to see trainees in planning. |
| 19  | Trainee gamification          | Points carry over to first active season                             | Real stakes motivate faster completion. Early completers get a head start.                |

---

## 14. Selling Points

🎯 **"Day-one ready."** New hires arrive knowing the system. AI walked them through everything before their first shift.

🎯 **"Every module teaches itself."** Ship a new feature, every user learns it automatically. No training sessions, no manuals.

🎯 **"The onboarding that adapts."** Experienced server? 15 minutes. First restaurant job? Full guided tour. Same system, different experience.

🎯 **"Never miss a deadline."** AI tracks the first shift date and ensures the trainee is ready. Escalates automatically if they're falling behind.

🎯 **"Onboarding in your language."** Swedish-speaking staff in a Norwegian restaurant? Mr. Botsson speaks Swedish.

🎯 **"Hire 20 for summer in one click."** Bulk CSV import, automatic invites, AI-guided onboarding for each — all parallel.

🚀 **Differentiator:** No restaurant management system has AI-guided, voice-capable, profile-adaptive software onboarding. Most have zero onboarding. This closes deals.

---

## 15. Migration Notes

Specific considerations for migration from Bubble to Next.js/Supabase:

- Invitation system uses Supabase Auth for account creation (email+password, magic link, SMS OTP via Twilio)
- `workspace_invite` table needs RLS: only admins/managers can create invites; public access for acceptance via token
- Invite token validation as a Supabase Edge Function (verify token, check expiry, create User+Profile+CompanyMember)
- Bulk CSV import processed server-side via Edge Function (validate, deduplicate, batch-create invites)
- Sandbox mode enforced at the API layer: check `Profile.status === 'trainee'` before writing to operational tables
- Module journey checkpoints are seed data — inserted via migration scripts, versioned with module releases
- `OnboardingOverlay` component is client-side only — no server rendering needed
- AI tool calling for UI guidance uses the existing Mr. Botsson chat infrastructure with additional tool definitions
- Trainee badge in scheduling grid is a UI concern — query `Profile.status` when rendering the employee list in Module 3
- Gamification points from trainee mode need the same `points_event` table that Module 4 proposes (Core-level, not module-level)

---

_This document covers the full onboarding lifecycle from workspace creation through invite acceptance, trainee mode, module journeys, and transition to active employee. Protocol Training (the third onboarding system) is documented in Module 6 (Training) and the Core Governance model._
