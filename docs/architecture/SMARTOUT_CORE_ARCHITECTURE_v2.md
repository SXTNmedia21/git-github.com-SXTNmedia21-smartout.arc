---
title: "Core Architecture v2"
id: CORE_ARCH_V2
version: "2.0"
status: canonical
layer: architecture
created: 2026-02-24
updated: 2026-02-28
author: pontus
supersedes: []
superseded_by: null
depends_on: []
tags:
  - core
  - data-model
  - identity
  - governance
  - structure
tables:
  - user_identity
  - company
  - company_member
  - workspace
  - profile
  - department
  - location
  - team
  - policy
  - protocol
  - season
changelog:
  - date: 2026-02-28
    change: "Added YAML frontmatter"
---

# SMARTOUT — Core Architecture v2

> **Status:** Directional (v2.0)  
> **Updated:** February 24, 2026  
> **Rule:** If multiple modules need it → Core. If only one module → Module.

---

## 1. Product Identity

### What is Smartout

**Employee Readiness System.** A holistic system that makes employees _ready_ for their shifts: trained, compliant, equipped, and informed. "Ready" has a concrete meaning: all assigned Policies have been learned, all Protocols have been completed — knowledge tested, procedures trained, confirmation signed.

### Core Problem

~75% annual turnover in the Norwegian service industry. New hires are expensive, undertrained, and often leave before becoming productive.

### Target Market

| Segment                     | Description                                         | Priority |
| --------------------------- | --------------------------------------------------- | -------- |
| Restaurants (1–3 locations) | Owner/manager runs operations daily                 | Primary  |
| Hotels                      | Operations manager coordinates multiple departments | Primary  |
| Chains / Franchises         | Operations director oversees multiple locations     | Primary  |
| HR in HoReCa                | HR manager focused on compliance and retention      | Primary  |
| Retail                      | Shift-based retail operations                       | Roadmap  |

### Pricing

Per employee / per month. Plan tiers to be defined.

---

## 2. Technical Architecture

### Stack

| Layer             | Technology                                                          | Purpose                             |
| ----------------- | ------------------------------------------------------------------- | ----------------------------------- |
| **Web Dashboard** | Next.js (TypeScript)                                                | Admin + employee desktop experience |
| **Mobile App**    | React Native + Expo (TypeScript)                                    | Runtime restaurant operations       |
| **Backend**       | Supabase (PostgreSQL, Auth, Storage, Realtime, Edge Functions)      | All backend services                |
| **Automation**    | n8n (complex workflows) + Supabase Edge Functions (simple triggers) | Business logic orchestration        |
| **Hosting**       | Vercel (web), Supabase Cloud (backend), DigitalOcean (n8n)          | Infrastructure                      |
| **Language**      | TypeScript                                                          | Everywhere — no exceptions          |

### Authentication

- Email + password
- Magic link
- SMS OTP (via Twilio)
- All managed through Supabase Auth

### Multi-Tenant Model

- All data scoped via `workspace_id`
- Enforced through Supabase Row Level Security (RLS)
- Users can have Profiles in multiple Workspaces (even across Companies)

### ID Strategy

- **Primary keys:** UUIDs (Supabase default)
- **Display codes:** Human-readable identifiers (EMP-001, SHF-4521) generated per workspace

### Environments

Production, Staging, Development — Supabase project branching for isolation.

---

## 3. Platform Strategy

### Desktop (Web Dashboard)

Two-mode platform accessible to ALL users:

**Employee Mode — Personal Workspace:**

- Contracts and employment details
- Shift calendar and available shifts
- Training, education, and certificates
- Skill path development and professional CV builder
- Onboarding journey
- Policy & protocol completion tracking

**Admin/Manager Mode — Operational Control:**

- Everything in employee mode, PLUS:
- Scheduling and shift management
- Payroll and salary oversight
- Policy and protocol management (Governance)
- Season setup and gamification control
- Compliance and HACCP
- Team management and reporting

### Mobile App (React Native)

Runtime operations — where the restaurant actually runs.

**Phase 1:** Shift planning, shift swapping, notifications, punch in/out, payroll/salary calculation.

**Full scope:** All operational tasks during a shift, HACCP checklists, team chat, handoffs, training on-the-go.

---

## 4. Core Data Model

### Design Principles

- **11 Core types** — identity, structure, access, rules, time, and governance
- **Everything else is modules** — plugged in via extender pattern
- **Core has no business logic** — only identity, relationships, access control, and governance

### System Map

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CORE LAYER                                 │
│              (identity, structure, access, governance)               │
│                                                                     │
│  ┌──────────┐    ┌──────────────┐    ┌─────────────┐               │
│  │   User   │───▶│   Company    │───▶│  Workspace   │              │
│  │ (person) │    │ (legal       │    │ (physical    │              │
│  │          │    │  entity)     │    │  workplace)  │              │
│  └────┬─────┘    └──────────────┘    └──────┬───────┘              │
│       │                                      │                      │
│       │    ┌─────────────────────────────────┼──────────┐          │
│       │    │              │                  │          │          │
│       ▼    ▼              ▼                  ▼          ▼          │
│  ┌────────┐ ┌──────────┐ ┌────────┐ ┌────────┐ ┌────────┐        │
│  │Profile │ │Department│ │Location│ │ Team   │ │ Season │        │
│  │(role & │ │(what)    │ │(where) │ │(access)│ │(when)  │        │
│  │ access)│ └────┬─────┘ └────────┘ └────────┘ └────────┘        │
│  └────────┘      │                                                 │
│                   │       ┌──────────────────────────┐             │
│                   │       │     GOVERNANCE           │             │
│                   │       │                          │             │
│                   │       │  Policy ──1:1──▶ Protocol│             │
│                   │       │  (rule)         (enforce)│             │
│                   │       │                    │     │             │
│                   │       │  ┌─────────────────┤     │             │
│                   │       │  │  │  │  │  │    │     │             │
│                   │       │  P  R  Rb CL KT  Cf     │             │
│                   │       └──────────────────────────┘             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
        │
        │  Modules plug in via extenders
        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        MODULE LAYER                                 │
│  Payroll · Scheduling · Onboarding · Training · Tasks · Chat       │
│  Inventory · Operations · QA/Audit · News · HeatMap · Contracts    │
└─────────────────────────────────────────────────────────────────────┘

P=Procedure  R=Routine  Rb=Runbook  CL=ControlList  KT=KnowledgeTest  Cf=Confirmation
```

### Entity Relationships

```
User ──── CompanyMember ──── Company
  │                            │
  │                            │
  └──── Profile ──────── Workspace
           │                   │
           │    ┌──────────────┼──────────────┐
           │    │              │              │
           ├── Department    Location       Season
           │    │                              │
           ├── Team ───────────────────────────┤
           │                                   │
           └── Policy ──── Protocol ───────────┘
                              │
                    ┌─────────┼─────────┐
                    │    │    │    │    │
                 Procedure Routine Runbook
                    │         │      │
                 ProcStep  ControlList
                           KnowledgeTest
                           Confirmation
```

---

## 5. Core Types — Detailed Schemas

### 5.1 User

Person. Login. One per human regardless of how many jobs they have.

```
user
  user_id              uuid (PK)
  email                string (unique, login identifier)
  phone                string | null (SMS notifications, voice AI)
  password_hash        string
  auth_provider        supabase | google | microsoft
  auth_provider_id     string | null
  first_name           string
  last_name            string
  preferred_language   no | sv | en | da | fi
  date_of_birth        date | null (Norwegian labor law: young workers, pension)
  personal_email       string | null (GDPR: private contact separate from work)
  avatar_url           string | null (global profile picture)
  timezone             string (fallback if workspace doesn't set it)
  is_active            boolean
  last_login_at        timestamp | null
  created_at           timestamp
  updated_at           timestamp
```

**Design decisions:**

- User has NO direct connection to Company or Workspace — always via CompanyMember/Profile
- `personal_email` separate from login email — GDPR: private contact not tied to workplace
- `date_of_birth` needed for Norwegian labor law (young workers, pension)
- `avatar_url` is global — Profile has its own that overrides in workspace context

### 5.2 Company

Legal entity. Can have multiple Workspaces. Static — no Season connection.

```
company
  company_id           uuid (PK)
  name                 string (trade name)
  legal_name           string | null (may differ from trade name)
  org_number           string (required for A-melding, Brønnøysund, Skatteetaten)
  country              NO | SE | DK | FI
  address_line_1       string | null
  address_line_2       string | null
  postal_code          string | null
  city                 string | null
  phone                string | null
  email                string | null
  website              string | null
  logo_url             string | null
  industry             restaurant | hotel | cafe | bar | catering | other
  default_language     no | sv | en | da | fi
  default_currency     NOK | SEK | DKK | EUR
  billing_email        string | null (separate from contact email)
  subscription_plan    string | null
  subscription_status  trial | active | paused | cancelled
  trial_ends_at        timestamp | null
  is_active            boolean
  created_at           timestamp
  updated_at           timestamp
```

**Design decisions:**

- Company NEVER has season. Static legal entity.
- `default_language` and `default_currency` inherited to Workspace at creation but can be overridden.
- `industry` drives which modules are suggested during onboarding. Restaurant ≠ Hotel.

### 5.3 CompanyMember

Thin bridge between User and Company. "Do you belong to this company?"

```
company_member
  company_member_id    uuid (PK)
  user_id              fk → user
  company_id           fk → company
  role                 owner | admin | member
  title                string | null (freetext: 'CEO', 'Regional Manager' — display only)
  is_active            boolean
  joined_at            timestamp
  created_at           timestamp
  updated_at           timestamp
```

**Design decisions:**

- Thin by design. All rich work data lives in Profile.
- A User can be member in multiple Companies (chains, franchises, consultants).
- `owner` role: only one per Company. `admin` can be multiple.

### 5.4 Workspace

Physical workplace. The operational unit. All daily work happens here.

```
workspace
  workspace_id         uuid (PK)
  company_id           fk → company
  name                 string
  slug                 string (URL-friendly, unique per company: 'downtown-oslo')
  description          string | null
  timezone             string (overrides User.timezone in work context)
  currency             NOK | SEK | DKK | EUR
  language             no | sv | en | da | fi
  country              NO | SE | DK | FI
  address_line_1       string | null
  address_line_2       string | null
  postal_code          string | null
  city                 string | null
  phone                string | null
  email                string | null
  logo_url             string | null
  active_modules       string[] (payroll, scheduling, onboarding, training, etc.)
  max_profiles         integer | null (license limit, null = unlimited)
  is_active            boolean
  created_at           timestamp
  updated_at           timestamp
```

**Design decisions:**

- Workspace always has EXACTLY ONE default Season (created automatically at setup).
- `active_modules` is an array, not booleans — easier to extend with new modules.
- Workspace owns: Departments, Locations, Teams, Policies, Seasons.

### 5.5 Profile

Rich bridge User ↔ Workspace. Work identity. All daily work flows from here.

```
profile
  profile_id           uuid (PK)
  profile_code         string (human-readable: EMP-001)
  user_id              fk → user
  workspace_id         fk → workspace
  company_id           fk → company (denormalized for quick access)

  -- Identity & Access
  role                 owner | admin | manager | employee
  status               trainee | active | inactive | offboarding
  is_active            boolean

  -- Organizational Placement
  department_id        fk → department | null (primary)
  departments          fk[] → department (additional departments)
  location_id          fk → location | null (primary)
  locations            fk[] → location (additional locations)
  teams                fk[] → team (team memberships)

  -- Work Identity
  display_name         string (can differ from User name)
  job_title            string | null
  employee_number      string | null (freetext — format varies per company)
  avatar_url           string | null (workspace-specific, overrides User.avatar_url)

  -- Lifecycle
  trainee_started      timestamp | null
  trainee_completed    timestamp | null

  -- Emergency Contact (workplace safety, Norwegian labor law)
  emergency_contact_name       string | null
  emergency_contact_phone      string | null
  emergency_contact_relation   string | null (e.g., 'Ektefelle', 'Forelder', 'Partner')

  -- Preferences
  notification_pref    jsonb {push: bool, sms: bool, email: bool}
  language_override    string | null (if different from workspace default)

  joined_at            timestamp
  created_at           timestamp
  updated_at           timestamp
```

**Status lifecycle:**

- `trainee` → sandbox mode. All actions sandboxed. Learning the system (see Module 1). NOT a role — it's a status.
- `active` → full employee. Live data. Real impact.
- `inactive` → paused / on leave.
- `offboarding` → leaving the organization.

**Design decisions:**

- Profile has NO direct season connection. Season filters DATA, not the person.
- A User can have Profiles in multiple Workspaces, even across Companies.
- Operational state (on the clock, working today) is DERIVED from shift/punch data, not stored here.

### 5.6 Department

Fixed organizational division. Rarely changes.

```
department
  department_id        uuid (PK)
  workspace_id         fk → workspace
  name                 string (Kitchen, Service, Bar, Administration)
  slug                 string
  description          string | null
  color                string | null (UI marking — same color in schedule, reports)
  icon                 string | null
  sort_order           integer (display ordering)
  is_active            boolean
  created_at           timestamp
  updated_at           timestamp
```

**Design decisions:**

- Department NEVER has season. Permanent structure.
- Department can have Teams under it (`team.department_id`).
- A Profile has ONE primary department but can list additional in `departments[]`.

### 5.7 Location

Physical place within a Workspace.

```
location
  location_id          uuid (PK)
  workspace_id         fk → workspace
  name                 string (Main Restaurant, Outdoor Terrace, Catering Kitchen)
  slug                 string
  description          string | null
  address              string | null
  latitude             float | null (geofencing, check-in)
  longitude            float | null
  floor                string | null
  capacity             integer | null (max guests/seats)
  location_type        main | outdoor | kitchen | event | storage | other
  sort_order           integer
  is_active            boolean (controls dropdown visibility, not existence)
  created_at           timestamp
  updated_at           timestamp
```

**Design decisions:**

- Location NEVER has season. The place always exists — even if not used.
- Tasks/shifts CAN have both location AND season: "Prepare outdoor terrace" = season:summer + location:terrace.

### 5.8 Team

Dynamic access group. Controls what you see and can do.

```
team
  team_id              uuid (PK)
  workspace_id         fk → workspace
  department_id        fk → department | null (null = cross-departmental)
  season_id            fk → season | null (null = evergreen/permanent)
  name                 string
  slug                 string
  description          string | null
  color                string | null
  icon                 string | null
  leader_profile_id    fk → profile | null (team leader)
  team_type            operational | access | cross_department | seasonal | custom
  is_active            boolean
  created_at           timestamp
  updated_at           timestamp
```

**Design decisions:**

- Team IS the core type that CAN have season. Winter crew, summer team, event group.
- `team_type: seasonal` + `season_id` = clearly seasonal team.
- `team_type: operational` without `season_id` = always active.
- Cross-departmental teams: `department_id = null`. E.g. "HSE Responsible" from all departments.
- A Profile can be in seasonal AND permanent teams simultaneously.

### 5.9 Policy

Universal rule. One statement. One standard. Can be aspirational or enforced.

```
policy
  policy_id            uuid (PK)
  workspace_id         fk → workspace
  season_id            fk → season | null (null = default/permanent)
  policy_type          payroll | scheduling | operations | training | tasks | qa | safety | general
  policy_scope         workspace | department | team | location
  scope_ref_id         uuid | null (null if scope = workspace)
  name                 string
  description          string | null
  statement            text (the actual rule — clear and unambiguous)
  enforcement_status   aspirational | enforced
  rules_json           jsonb (module-specific structured data)
  valid_from           date | null
  valid_to             date | null
  priority             integer (higher wins when overlapping)
  is_active            boolean
  created_by           fk → profile
  created_at           timestamp
  updated_at           timestamp
```

**Design decisions:**

- Policy CAN have season. "Winter supplement" = season:winter + policy_type:payroll.
- Policy WITHOUT season = always applies (default).
- `valid_from`/`valid_to` and `season_id` are independent: season = coarse filter, dates = fine filter.
- `rules_json` is intentionally free — each module defines its own schema.
- `enforcement_status`: aspirational = no protocol attached. enforced = has a protocol with procedures, routines, etc.
- 1:1 relationship with Protocol.

### 5.10 Season

Operational time context. Filters all module data.

```
season
  season_id            uuid (PK)
  workspace_id         fk → workspace
  parent_season_id     fk → season | null (default has null, others can have default as parent)
  name                 string
  slug                 string
  description          string | null
  season_type          default | calendar | focus | cycle | custom
  start_date           date | null (null for default — always active)
  end_date             date | null (null for default and ongoing)
  status               draft | active | archived
  is_default           boolean (exactly ONE per workspace, created automatically)
  color                string | null
  icon                 string | null
  created_by           fk → profile | null
  created_at           timestamp
  updated_at           timestamp
```

**Design decisions:**

- Season lives on WORKSPACE level. Never Company.
- Every Workspace has exactly ONE default Season (`is_default=true`). Created at workspace setup.
- Default Season: `start_date=null`, `end_date=null`, `status=active`, `parent_season_id=null`.
- Data without explicit `season_id` belongs to Default Season.
- Seasons CAN overlap — but a specific data entity belongs to EXACTLY ONE season.
- Duplicate data rather than multi-season linking. Simpler logic, no many-to-many.
- `parent_season_id` enables inheritance: "Week 7" under "Winter 2025/26". Flat in v1 — one level only.
- Archiving (`status=archived`) hides data in UI but never deletes.

**Season types:**
| Type | Examples |
|------|---------|
| `default` | Automatically created base season |
| `calendar` | Winter season, summer season, Christmas, Easter |
| `focus` | Training focus, hygiene campaign, new menu onboarding |
| `cycle` | Weekly plan, monthly period, quarterly plan |
| `custom` | Event weekend, festival period, renovation |

**Inheritance model:** Data in a season inherits from parent (Default) if not explicitly defined. E.g. Season "Winter" has no own procedures → shows Default procedures. Has own team → shows winter team + Default teams.

**The admin experience:** Setting up a season feels like preparing a battlefield. You configure teams, define rules, set focus areas — then click PLAY. The season is live. The goal: gather maximum score and points.

### 5.11 Protocol

Enforcement container for a Policy. The "how we comply" umbrella. Contains all actionable elements needed to implement a policy.

```
protocol
  protocol_id          uuid (PK)
  policy_id            fk → policy (1:1 relationship)
  workspace_id         fk → workspace
  name                 string
  description          string | null
  version              string (1.0, 1.1, 2.0)
  status               draft | active | deprecated
  owner_profile_id     fk → profile (who maintains this)
  created_by           fk → profile
  created_at           timestamp
  updated_at           timestamp
```

**A Protocol contains:**

```
Protocol
  ├── Procedures      (step-by-step instructions with tasks)
  ├── Routines        (scheduled execution of procedures)
  ├── Runbooks        (event-triggered escalation workflows)
  ├── Control Lists   (follow-up verification on routines/runbooks)
  ├── Knowledge Tests (verify employee understanding)
  └── Confirmations   (employee sign-off / anti-ghosting)
```

**Design decisions:**

- 1:1 with Policy. One policy, one protocol. No protocol = aspirational policy.
- Protocol is a Core type because multiple modules need it (scheduling, operations, QA, training, onboarding).
- When you join a team → receive policies → complete protocols → you're READY.

---

## 6. Governance Model

### The Chain

```
Policy      →  "What must happen"     (the rule)
Protocol    →  "How we comply"        (the umbrella)
  ├── Procedure  →  "Step by step"    (instructions with tasks)
  ├── Routine    →  "When to run"     (scheduled procedure execution)
  ├── Runbook    →  "When things fail" (escalation workflow)
  ├── Control List → "Did we do it?"  (verification)
  ├── Knowledge Test → "Do you understand?" (quiz/test)
  └── Confirmation → "I confirm"      (employee sign-off)
```

### Procedure

Static instructions. Contains ordered tasks. Can have onboarding requirements, skill requirements, team-specific training.

```
procedure
  procedure_id         uuid (PK)
  protocol_id          fk → protocol
  name                 string
  description          string | null
  procedure_type       standard | onboarding | safety | maintenance | custom
  skill_requirements   jsonb | null (skills needed to perform this)
  sort_order           integer
  is_active            boolean
  created_at           timestamp
  updated_at           timestamp

procedure_step
  step_id              uuid (PK)
  procedure_id         fk → procedure
  title                string
  description          text
  step_order           integer
  is_required          boolean
  estimated_minutes    integer | null
  created_at           timestamp
  updated_at           timestamp
```

### Routine

Scheduled execution of a Procedure. The thing that makes procedures actually run.

```
routine
  routine_id           uuid (PK)
  protocol_id          fk → protocol
  procedure_id         fk → procedure (which procedure to execute)
  name                 string
  trigger_type         scheduled | event
  trigger_config       jsonb (cron expression, or event name + conditions)
  assigned_to_type     team | role | profile
  assigned_to_ref      uuid (ID of team, role config, or profile)
  control_list_id      fk → control_list | null
  control_frequency    every_time | every_nth | never
  control_nth          integer | null (if every_nth: run control every N times)
  is_active            boolean
  created_at           timestamp
  updated_at           timestamp
```

### Runbook

Event-triggered escalation workflow. IS a procedure, but specifically for when things go wrong. Always triggers a Control List when completed.

```
runbook
  runbook_id           uuid (PK)
  protocol_id          fk → protocol
  name                 string
  description          text
  trigger_event        string (what breach/failure triggers this)
  trigger_conditions   jsonb (thresholds, timing)
  escalation_chain     jsonb [
    { level: 1, role: "team_leader", delay_minutes: 0 },
    { level: 2, role: "department_manager", delay_minutes: 20 },
    { level: 3, role: "admin", delay_minutes: 60 }
  ]
  control_list_id      fk → control_list (ALWAYS triggers control list)
  is_active            boolean
  created_at           timestamp
  updated_at           timestamp
```

### Control List

Follow-up verification. NEVER standalone — only exists as follow-up to Routines and Runbooks.

```
control_list
  control_list_id      uuid (PK)
  protocol_id          fk → protocol
  name                 string
  description          string | null
  assigned_to_type     team_leader | manager | admin | custom
  assigned_to_ref      uuid | null
  items                jsonb [
    { question: "Was the procedure completed on time?", type: "yes_no" },
    { question: "Were there any deviations?", type: "yes_no" },
    { question: "Notes", type: "text" }
  ]
  is_active            boolean
  created_at           timestamp
  updated_at           timestamp
```

**Trigger rules:**

- From Routine: configurable frequency (every time, every Nth time, never)
- From Runbook: ALWAYS, automatically assigned when runbook completes
- No routines/runbooks run = no control lists to complete

### Knowledge Test

Verify that the employee actually understands the policy and its procedures.

```
knowledge_test
  knowledge_test_id    uuid (PK)
  protocol_id          fk → protocol
  name                 string
  description          string | null
  questions            jsonb (quiz questions, formats, correct answers)
  pass_threshold       integer (percentage needed to pass)
  max_attempts         integer | null
  is_active            boolean
  created_at           timestamp
  updated_at           timestamp
```

### Confirmation

Employee sign-off. Anti-ghosting. Manual acknowledgment that they've read and understand.

```
confirmation
  confirmation_id      uuid (PK)
  protocol_id          fk → protocol
  name                 string
  confirmation_text    text (what the employee is confirming)
  requires_signature   boolean
  is_active            boolean
  created_at           timestamp
  updated_at           timestamp
```

### Employee Readiness Flow

```
Employee joins Team
  → Receives Policies for that Team/Department
    → Each enforced Policy has a Protocol
      → Complete Procedures (learn the tasks)
      → Pass Knowledge Tests (prove understanding)
      → Sign Confirmations (acknowledge responsibility)
        → ALL COMPLETE = READY ✓
```

**Readiness is the core product metric.** An employee's readiness score = percentage of assigned protocols completed.

---

## 7. Access Model

### How Access Works

```
User logs in
  → selects Workspace (if multiple Profiles)
    → Profile loads
      → Role (what you CAN do)
      → Teams (what you SEE)
      → Department (where you BELONG)
      → Location (where you ARE)
      → Status (trainee = sandbox, active = live)
      → Season (which time context)
      → active_modules (which features exist)
```

**Total access = Role × Team × Season × Module × Status**

### Access Dimensions

| Dimension      | Controls            | Example                                         |
| -------------- | ------------------- | ----------------------------------------------- |
| **Role**       | What you CAN do     | Admin can edit, Employee can view               |
| **Team**       | What you SEE        | Kitchen team sees kitchen procedures, not bar's |
| **Department** | Where you BELONG    | Payroll calculation, reporting                  |
| **Location**   | Where you ARE       | Punch-in verification, resource allocation      |
| **Module**     | Which functionality | Payroll enabled? Training enabled?              |
| **Season**     | Which time context  | Filter data by active season                    |
| **Status**     | Data scope          | Trainee = sandbox, Active = live                |

### Role Definitions

| Role         | Scope                      | Capabilities                                                                       |
| ------------ | -------------------------- | ---------------------------------------------------------------------------------- |
| **Employee** | Own data + team visibility | View own shifts, complete tasks, access training                                   |
| **Manager**  | One or more departments    | Manage schedules, approve requests, view reports                                   |
| **Admin**    | Full workspace             | All manager capabilities + settings, payroll, policies, custom permission handling |
| **Owner**    | Full workspace + billing   | All admin capabilities + subscription, billing, data export                        |

**Leader** is not a role level — defined on Team (`team.leader_profile_id`). A leader has elevated access within their team's scope.

**Custom permissions** handled via Policy (`policy_type: "access"`) — admins create workspace-specific permission sets that grant or restrict capabilities. E.g. "Manager X can see salary for Department A but not Department B."

### Smartout Super-Admin

Cross-workspace access for Smartout's internal team. Separate from workspace roles.

---

## 8. The Season Concept

### Overview

A Season is a defined operational period that wraps specialized configurations. It's the gamification and operational planning unit of Smartout.

### How It Works

**Default mode:** Set up Smartout and just work. No season required. Everything is "default."

**Creating a season:** Admin is prompted — _"When is your next season change?"_ → Create a named season with start/end dates.

### What Lives Inside a Season

- Specialized routines and procedures
- Specialized teams (seasonal crews)
- Specialized jobs
- Specialized focus areas
- Specialized trainings and onboarding flows
- Specialized policies and protocols

### Key Rules

1. **One active named season at a time** (plus the always-running default)
2. When a season is active, every new item created gets a dropdown: **Default** or **Season-based**
3. Everything filters by season context automatically
4. Data without explicit `season_id` belongs to Default Season
5. Season-specific data inherits from Default when not explicitly defined

### Season Lifecycle

```
Default (always running)
  → Season created (draft — "setting up the battlefield")
    → Season activated ("click PLAY")
      → Season runs (season items active alongside defaults)
        → Season ends (archived)
          → Back to default only
```

---

## 9. Gamification Layer

### Points System

Staff earn points through actions during a season. Every completed task, shift, training module, protocol completion, and compliance check contributes.

### Competition Levels

| Level          | Scope                                             |
| -------------- | ------------------------------------------------- |
| **Individual** | Personal score and achievements                   |
| **Team**       | Team competition within workspace                 |
| **Department** | Department-level competition                      |
| **Workspace**  | Global leaderboard across ALL Smartout workspaces |

### Boosters & Penalties

Managers can activate score multipliers and modifiers:

- **Boosters:** Temporary point multipliers (e.g. 2x for HACCP tasks this week)
- **Penalties:** Point deductions for compliance failures

---

## 10. Module Layer

Modules plug into Core via extender tables. Each module creates its own Ws* config and Emp* data.

| Module           | Ws Config    | Profile Data  | Core Dependencies            |
| ---------------- | ------------ | ------------- | ---------------------------- |
| **Payroll**      | WsPayroll    | EmpPayroll    | Department, Policy           |
| **Scheduling**   | WsScheduling | EmpSchedule   | Department, Location, Team   |
| **Onboarding**   | WsOnboarding | EmpOnboarding | Department, Team             |
| **Training**     | WsTraining   | EmpTraining   | Department, Team, Policy     |
| **Tasks**        | WsTask       | EmpTask       | Department, Team, Location   |
| **Chat**         | —            | EmpChat       | Team                         |
| **Inventory**    | WsInventory  | —             | Location                     |
| **Operations**   | WsOperations | —             | Department, Location, Policy |
| **QA/Audit**     | WsAudit      | —             | Department, Location, Policy |
| **News/Comms**   | WsNews       | —             | Team, Department             |
| **HeatMap**      | WsHeatMap    | —             | Location                     |
| **Contracts/HR** | —            | EmpContract   | Department                   |

---

## 11. Department vs. Team

### Department

- **Fixed**, rarely changes
- Organizational home, tied to payroll and reporting
- A Profile has ONE primary department (can work in additional ones)
- Examples: Kitchen, Service, Bar, Administration, Cleaning

### Team

- **Dynamic**, can change per season/week
- Access group — controls what you see
- A Profile can belong to MULTIPLE teams
- Can be within a department or cross-departmental
- Examples: "Lunch Crew", "Event Team", "HSE Responsible"

### Relationship

```
Department: Kitchen
  ├── Team: Breakfast Kitchen
  ├── Team: Lunch Kitchen
  └── Team: À la Carte

Cross-departmental:
  ├── Team: Event Crew (kitchen + service + bar)
  └── Team: Onboarding Mentors (all departments)
```

---

## 12. Design System

| Decision              | Choice                                    |
| --------------------- | ----------------------------------------- |
| **Direction**         | Fresh design, same clean/professional DNA |
| **CSS Framework**     | Tailwind CSS                              |
| **Component Library** | shadcn/ui                                 |
| **Responsive**        | Desktop and mobile equally prioritized    |

---

## 13. AI Layer — Mr. Botsson

8 specialized engines:

1. **Context Engine** — User profile, sentiment, mode detection
2. **Knowledge Engine** — RAG with embeddings, semantic search
3. **Journey Engine** — Onboarding checkpoint tracking, AI dynamic guidance, progress monitoring, escalation. No phases/milestones/branching — see Module 1.
4. **Payroll Engine** — Salary calculation, Norwegian labor law
5. **Communication Engine** — Message formatting, channel selection
6. **Operation Engine** — Daily ops, checklists, proactive alerts
7. **Learning Engine** — Training content, quiz generation, skill mapping
8. **Business Engine** — KPIs, financials, strategic planning

AI assists in governance: when admin writes a Policy, AI helps configure the Protocol — suggesting procedures, routines, runbooks, and control lists based on the policy statement and industry best practices.

---

## Summary

### 11 Core Types

| #   | Type              | Purpose                          |
| --- | ----------------- | -------------------------------- |
| 1   | **User**          | Who you are (person, auth)       |
| 2   | **CompanyMember** | Which organization you belong to |
| 3   | **Company**       | The legal entity                 |
| 4   | **Workspace**     | The physical workplace           |
| 5   | **Profile**       | Your role and identity here      |
| 6   | **Department**    | Fixed organizational division    |
| 7   | **Location**      | Physical place                   |
| 8   | **Team**          | Dynamic access group             |
| 9   | **Policy**        | Rules — what must happen         |
| 10  | **Season**        | Operational time period          |
| 11  | **Protocol**      | Enforcement — how we comply      |

### The Formula

**Access:** Role × Team × Season × Module × Status

**Readiness:** Policies assigned → Protocols completed → READY ✓

**Season:** Setup battlefield → Click PLAY → Compete for points

---

_This document is directional (v2.0). Implementation details refined during module development._
