# SMARTOUT — UI Architecture & Screen Inventory

> **Smartout.io** — User Journeys, Screen Architecture, and Component Library
> Version 1.0 | February 2026
> **Status:** Draft — decisions needed before implementation

---

## 1. The Four Personas

Every screen, tab, and component must serve one or more of these users. The mobile/desktop split isn't just about screen size — it's about **when** the user interacts.

| Persona | Primary Platform | When They Use It | Core Need |
|---------|-----------------|------------------|-----------|
| **Owner / Admin** | Desktop (90%) | Before & after operations | Setup, governance, oversight |
| **Manager / Team Lead** | Both (50/50) | Before, during, and after | Plan, run, review |
| **Active Employee** | Mobile (95%) | During shift | Know what to do right now |
| **Trainee** | Mobile (90%) | Before first shift | Learn the system safely |

---

## 2. User Journeys — Lightweight Maps

### 2.1 Owner/Admin Journey

```
FIRST TIME:
Sign up → Create Company → Create Workspace → Setup Wizard (voice-guided)
  → Define Departments → Define Locations/Zones → Define Assets
  → Define Positions → Create Teams → Configure Settings
  → Land on Dashboard (empty state)

DAILY LOOP:
Open Dashboard → Check alerts & KPIs → Review compliance status
  → Handle approvals (shift swaps, time corrections, trainee promotions)
  → Adjust policies/governance as needed

PERIODIC:
Create Season → Configure gamification → Define policies → Build protocols
  → Assign protocols → Activate Season → Monitor leaderboard

PEOPLE:
Invite employee → Track trainee progress → Approve trainee → active
  → Manage roles/departments → Handle offboarding
```

**Key Desktop Screens for Admin:**
1. Workspace Dashboard (home/overview)
2. Setup Wizard (first run only)
3. Season Manager (create, configure, activate)
4. Governance Studio (Policy → Protocol builder)
5. People Directory (all profiles, statuses, readiness)
6. Schedule Builder (drag-and-drop grid)
7. Reports & Analytics
8. Settings (workspace, billing, integrations)

---

### 2.2 Manager / Team Lead Journey

```
WEEKLY PLANNING (Desktop):
Open Schedule Builder → Create/edit shifts → Assign employees
  → Publish schedule → Handle availability conflicts

DAY START (Mobile or Desktop):
Check Day Brief → Review who's on shift → Note any absences
  → Check HACCP status → Review open tasks

DURING SERVICE (Mobile):
Monitor feed → See task completion progress → Handle escalations
  → Create ad-hoc tasks → Approve deviations → Chat with team
  → View session board (department overview)

SHIFT END (Mobile):
Review session completion → Sign off department session
  → Record handoff notes → Check next day preview

REVIEW (Desktop):
Check reports → Review HACCP compliance → Payroll verification
  → Training progress → Gamification standings
```

**Manager sees everything an employee sees, PLUS:**
- Session Board (department-level overview)
- Ad-hoc task creation
- Approval actions (shift swaps, deviations, trainee progress)
- Escalation handling
- Sign-off authority

---

### 2.3 Active Employee Journey

```
BEFORE SHIFT:
Open app → See upcoming shift on home screen → Check Day Brief preview
  → Review any prep notes

SHIFT START:
Punch in (GPS optional) → App context auto-switches to active session
  → Feed loads: tasks sorted by urgency, notes, messages

DURING SHIFT:
Work through feed items:
  → Open task → Follow procedure steps → Complete (photo/data if required)
  → Check temperature (HACCP form) → Log reading → Flag deviation if needed
  → Read notes ("VIP arriving 19:00, table 7, nut allergy")
  → Chat with team → Claim inherited tasks if available
  → Earn points for completions

SHIFT END:
Complete remaining tasks → Record handoff (text/voice/AI-call)
  → Punch out → See shift summary (points earned, tasks completed)

OFF-SHIFT (Desktop):
View schedule → Request shift swap → Register availability
  → Check training progress → View certificates → Update profile
  → Browse professional CV / skill development
```

**Employee Mobile Flow — The Critical Path:**
```
App Open
  │
  ├── NOT on shift → Schedule view (next shifts, upcoming)
  │     └── Tap shift → shift detail → swap / notes
  │
  └── ON SHIFT → Feed (auto-context from active session)
        ├── Task card → Task Detail → Procedure Stepper → Complete
        ├── HACCP card → Temperature Form → Submit / Flag deviation
        ├── Note card → Full note detail
        ├── Message card → Chat thread
        ├── Mr. Botsson → AI chat/voice (always accessible)
        └── Session Board (managers only) → Department overview
```

---

### 2.4 Trainee Journey

```
PRE-START:
Receive invite (email/SMS) → Accept → Create account
  → Land in Trainee Mode (sandbox)

CORE JOURNEY (learn Smartout):
AI greets trainee → Profile setup (photo, emergency contact, language)
  → Navigation tour (AI spotlight/highlight) → Core concepts intro
  → "Here's what shifts are, here's what tasks are, here's chat"

MODULE JOURNEYS (learn each feature):
AI determines order based on first shift needs
  → Scheduling: view schedule → find own shift → test punch-in (sandbox)
  → Tasks: view task list → complete a sandbox task → procedure walkthrough
  → HACCP: sandbox temperature log → understand deviation flow
  → Chat: send a real message → understand channels
  → Each module: checkpoints + AI adaptive guidance

READINESS:
All required checkpoints complete → Admin/leader reviews → Approves
  → Status: trainee → active → First real shift begins
  → Gamification points from trainee carry forward to active season

EDGE CASE — NOT READY:
48h before first shift → AI escalates to admin
  → Admin decides: extend trainee period / override / reschedule
```

**Trainee sees the SAME app** but with:
- Sandbox mode on data-affecting actions (punch, tasks)
- Real mode on social features (chat, profile)
- OnboardingOverlay component (spotlights, tooltips, highlights)
- Progress bar showing completion
- AI guidance chat always prominent

---

## 3. Mobile App — Screen Architecture

### 3.1 Navigation Structure

**Bottom Tab Bar — 4 tabs + AI FAB:**

```
┌─────────────────────────────────────────────────┐
│                                                 │
│              [Active Screen Content]            │
│                                                 │
│                                                 │
│                                                 │
│                        ┌───┐                    │
│                        │ AI│ ← Floating Action  │
│                        └───┘   Button (Mr.      │
│                                Botsson)          │
├─────────┬──────────┬──────────┬─────────────────┤
│  🏠     │  📋      │  💬      │  👤             │
│  Hjem   │  Vakter  │  Chat    │  Meg            │
└─────────┴──────────┴──────────┴─────────────────┘
```

**Tab rationale:**
- **Hjem (Home/Feed)** — THE primary screen. Feed-first. Where the shift happens.
- **Vakter (Shifts/Schedule)** — Calendar, upcoming shifts, availability, swap requests.
- **Chat** — Team messaging, handoff threads, announcements.
- **Meg (Me)** — Profile, training, certificates, points, settings.
- **AI FAB** — Always-accessible Mr. Botsson. Not a tab — floating above content. Tap opens chat overlay, long-press opens voice.

**Why 4 tabs + FAB, not 5 tabs:**
- 5 tabs is the max for mobile UX. AI deserves more prominence than a tab.
- FAB makes AI feel omnipresent, not siloed.
- Feed is the default — employees spend 80% of time here during a shift.

---

### 3.2 Screen Inventory — Mobile

#### Tab 1: Hjem (Home / Feed)

| Screen | Route | Description |
|--------|-------|-------------|
| **Feed** | `/home` | Unified stream. Day Brief pinned top. Tasks by urgency. Notes. Messages. Inherited tasks. Context auto-switches by active shift. |
| **Day Brief** | `/home/brief` | Full day brief — AI-compiled morning summary. Pinned at top of feed, expandable. |
| **Shift Brief** | `/home/shift-brief` | Mid-day start catchup. "Here's what happened before your shift." |
| **Task Detail** | `/home/task/:id` | Full task view — procedure steps, HACCP form fields, photo upload, completion flow, deviation handling. |
| **Procedure Stepper** | `/home/task/:id/procedure` | Step-by-step walkthrough with checkboxes, media, and AI guidance. |
| **Temperature Form** | `/home/task/:id/haccp` | CCP-specific: asset list with input fields, limits displayed, auto-deviation detection. |
| **Deviation Flow** | `/home/task/:id/deviation` | Deviation flagged → Runbook triggered → corrective actions → Control list. |
| **Note Detail** | `/home/note/:id` | Full note with thread, category, timestamp, author. |
| **Session Board** | `/home/session` | Manager-only: department session overview. All tasks, all employees, completion status, sign-off. |
| **Punch Clock** | `/home/punch` | Punch in/out modal or screen. GPS verification. Session context switch. Pause controls. |

#### Tab 2: Vakter (Shifts / Schedule)

| Screen | Route | Description |
|--------|-------|-------------|
| **My Schedule** | `/shifts` | Calendar view — week/month. My upcoming shifts highlighted. Color-coded by department. |
| **Shift Detail** | `/shifts/:id` | Single shift: time, position, department, location, team, procedures attached, notes. |
| **Availability** | `/shifts/availability` | Register available/unavailable times. Request time off. |
| **Shift Swap** | `/shifts/swap` | Request swap → pick colleague → submit for approval. Track status. |
| **Open Shifts** | `/shifts/open` | Available unclaimed shifts. Express interest. See requirements. |
| **Shift History** | `/shifts/history` | Past shifts with punch data, hours worked, overtime, salary preview. |

#### Tab 3: Chat

| Screen | Route | Description |
|--------|-------|-------------|
| **Chat List** | `/chat` | All conversations: team channels, direct messages, system threads. Unread indicators. |
| **Chat Thread** | `/chat/:id` | Message thread. Text input. Quick actions. Image sharing. |
| **Handoff Thread** | `/chat/handoff/:id` | Structured handoff view — extracted events, deviation notes, next-shift context. |
| **Announcements** | `/chat/announcements` | Workspace/department-wide messages. Read receipt tracking. |

#### Tab 4: Meg (Me / Profile)

| Screen | Route | Description |
|--------|-------|-------------|
| **My Profile** | `/me` | Photo, name, role, department, team. Quick stats. Points summary. |
| **Training** | `/me/training` | Protocol completion progress. Readiness score per area. Certificate expiry warnings. |
| **Certificates** | `/me/certificates` | Active certificates, expiry dates, renewal requirements. |
| **Knowledge Tests** | `/me/tests` | Available tests, completed tests, scores. Retake option. |
| **Gamification** | `/me/points` | Points total, history, streaks. Leaderboard (team/department/workspace). Season standings. |
| **Salary / Payslip** | `/me/salary` | Current period salary calculation. Historical payslips. Supplement breakdown. |
| **Documents** | `/me/documents` | Employment contract, policies signed, personal documents. |
| **Settings** | `/me/settings` | Language, notifications, quiet hours, appearance. |

#### AI Overlay (Floating)

| Screen | Route | Description |
|--------|-------|-------------|
| **AI Chat** | overlay | Text chat with Mr. Botsson. Context-aware. Suggested actions. |
| **AI Voice** | overlay | Voice mode — long-press FAB or toggle in chat. Ultravox-powered. Norwegian. |
| **AI Onboarding** | overlay | During trainee mode: spotlight, tooltip, highlight, navigate commands from AI. |

#### Cross-Cutting Screens

| Screen | Route | Description |
|--------|-------|-------------|
| **Notifications** | `/notifications` | All notifications hub. Filterable by type. Mark read/unread. |
| **Quiz / Knowledge Test** | modal | Quiz renderer — multiple choice, true/false, open answer. Timer if configured. Score on completion. |
| **Photo Capture** | modal | Camera integration for evidence capture (HACCP, task completion, deviation). |
| **Workspace Switcher** | modal | For users with multiple profiles/workspaces. |

---

### 3.3 State-Dependent Home Screen

The Feed/Home screen adapts based on the employee's state:

| State | What Home Shows |
|-------|----------------|
| **Trainee, not started** | Welcome screen. AI greeting. "Let's get you set up." Profile setup prompt. |
| **Trainee, in progress** | Training feed. Module journey progress bar. Next checkpoint. AI guidance prominent. |
| **Active, no upcoming shift** | Next shift preview. Schedule summary. Training reminders. Points standing. |
| **Active, shift starting soon** | Day Brief preview. Countdown to shift. "Ready for today?" |
| **Active, on shift** | Full operational feed. Tasks. Notes. Messages. Punch controls visible. |
| **Active, shift ending** | Remaining tasks. Handoff prompt. "Complete your shift." Punch out CTA. |
| **Active, shift just ended** | Shift summary. Points earned. Handoff confirmation. |

---

## 4. Desktop — Screen Architecture

### 4.1 Navigation Structure

**Left Sidebar + Top Context Bar:**

```
┌──────────────────────────────────────────────────────────┐
│  🏢 Bårdshaug Vegkro        Anna Olsen (Admin) ▾        │
│  Season: Vinter 2026 ● Active                           │
├──────────┬───────────────────────────────────────────────┤
│          │                                               │
│ 🏠 Dashboard│          [Main Content Area]               │
│ 👥 People│                                               │
│ 📅 Schedule│                                             │
│ 📋 Operations│                                           │
│ 📊 Reports│                                              │
│ 🛡️ Governance│                                           │
│ 🎮 Season  │                                             │
│ 💬 Chat    │                                             │
│ 🤖 Mr. Botsson│                                          │
│          │                                               │
│ ─────────│                                               │
│ ⚙️ Settings│                                             │
│ ❓ Help   │                                              │
│          │                                               │
├──────────┤                                               │
│ Employee │ ← Mode toggle                                 │
│ / Admin  │                                               │
└──────────┴───────────────────────────────────────────────┘
```

**The sidebar switches based on role + mode:**
- **Employee Mode** — personal workspace (all users see this)
- **Admin/Manager Mode** — operational control (role-gated)

---

### 4.2 Screen Inventory — Desktop

#### Dashboard

| Screen | Route | Description |
|--------|-------|-------------|
| **Admin Dashboard** | `/dashboard` | KPI overview: who's on shift, session status, compliance score, alerts, trainee progress, upcoming shifts coverage. |
| **Employee Dashboard** | `/dashboard` (employee mode) | My next shift, my tasks, training progress, points, messages. |

#### People

| Screen | Route | Description |
|--------|-------|-------------|
| **Employee Directory** | `/people` | All profiles. Filter by department, team, status, role. Search. Readiness indicators. |
| **Profile Detail** | `/people/:id` | Full profile — employment details, contract, shift history, training, certificates, competency matrix, points. |
| **Invite Management** | `/people/invite` | Send invites (single/bulk CSV). Track pending, accepted, expired. Resend/cancel. |
| **Trainee Dashboard** | `/people/trainees` | All trainees: progress bars, checkpoint status, estimated readiness dates, AI risk alerts. |
| **Trainee Detail** | `/people/trainees/:id` | Individual trainee journey. Completion %, checkpoints, AI interaction log. Approve/extend controls. |

#### Schedule

| Screen | Route | Description |
|--------|-------|-------------|
| **Schedule Builder** | `/schedule` | Drag-and-drop shift grid. Week/month views. Three modes: by Employee, by Position, by Team. Publish controls. |
| **Shift Templates** | `/schedule/templates` | Create/edit shift templates. Attach procedures, positions, locations. |
| **Availability Overview** | `/schedule/availability` | All employee availability in grid format. Conflict detection. |
| **Shift Swap Queue** | `/schedule/swaps` | Pending swap requests. Approve/deny with context. |
| **Open Shifts** | `/schedule/open` | Unfilled shifts. Interest tracking. Assignment. |
| **Overtime Monitor** | `/schedule/overtime` | Overtime detection. Approval queue. Cost projections. |
| **Payroll Preview** | `/schedule/payroll` | Current period payroll calculation. Per-employee breakdown. Export. |

#### Operations

| Screen | Route | Description |
|--------|-------|-------------|
| **Operations Overview** | `/operations` | Today's sessions across all departments. Live status. Task completion rates. Active alerts. |
| **Department Session** | `/operations/session/:id` | Single session detail — all tasks, hooks, employees, notes, deviations, completion status. Sign-off controls. |
| **Session History** | `/operations/history` | Past sessions. Filter by date, department, status. Session reports. |
| **Department Schedule** | `/operations/schedule` | Operating hours per department per season. Weekly defaults + date overrides. |
| **Task Library** | `/operations/tasks` | All task types, recurring tasks, templates. |
| **Hooks Manager** | `/operations/hooks` | Session hook configuration. Timing, procedures, routines. |

#### Reports & Analytics

| Screen | Route | Description |
|--------|-------|-------------|
| **Reports Hub** | `/reports` | Report category overview with quick-launch. |
| **HACCP Report** | `/reports/haccp` | Temperature logs, deviation history, compliance score, inspection-ready export. PDF generation. |
| **Operations Report** | `/reports/operations` | Task completion rates, session sign-offs, efficiency metrics. |
| **HR Report** | `/reports/hr` | Turnover analysis, absence stats, competency matrix, onboarding funnel. |
| **Payroll Report** | `/reports/payroll` | Labor costs, overtime costs, budget vs. actual, forecasts. |
| **Gamification Report** | `/reports/gamification` | Leaderboard, point distribution, engagement trends, AI suggestions. |

#### Governance

| Screen | Route | Description |
|--------|-------|-------------|
| **Governance Overview** | `/governance` | All policies and their protocol status. Compliance heatmap. |
| **Policy Editor** | `/governance/policy/:id` | Create/edit policy. AI-assisted: suggests protocol components. |
| **Protocol Builder** | `/governance/protocol/:id` | Configure protocol enforcement — attach procedures, routines, runbooks, control lists, knowledge tests, confirmations. |
| **Procedure Editor** | `/governance/procedure/:id` | Step-by-step procedure builder. Add text, media, checklists per step. Version history. |
| **Routine Manager** | `/governance/routines` | All routines — recurring governance. Link to session hooks. |
| **Runbook Editor** | `/governance/runbook/:id` | Deviation response playbook. Decision trees, escalation paths. |
| **Knowledge Test Builder** | `/governance/test/:id` | Create quizzes — multiple choice, true/false, open. Set pass criteria. |
| **Control List Manager** | `/governance/checklists` | Audit and control checklists. Assign, track completion. |

#### Season

| Screen | Route | Description |
|--------|-------|-------------|
| **Season Manager** | `/season` | All seasons (draft, active, archived). Create new. |
| **Season Setup** | `/season/:id/setup` | Configure: date range, type, gamification settings, point values, visibility rules. |
| **Season Battlefield** | `/season/:id/battlefield` | Pre-launch view: policies assigned, teams set, everything ready? "Click PLAY." |
| **Leaderboard** | `/season/:id/leaderboard` | Live leaderboard — individual, team, department. Boosters/penalties log. |

#### Chat (Desktop)

| Screen | Route | Description |
|--------|-------|-------------|
| **Chat** | `/chat` | Same as mobile but in sidebar panel or full-width. Team channels, DMs, announcements. |

#### Organization

| Screen | Route | Description |
|--------|-------|-------------|
| **Org Structure** | `/org` | Visual org chart — departments, locations, zones, assets, positions, teams. Read-only overview + edit mode. |
| **Departments** | `/org/departments` | Create/edit departments. Color, icon, leader. |
| **Locations** | `/org/locations` | Manage locations. Address, GPS, type, capacity. |
| **Zones** | `/org/zones` | Zones within locations. Season-aware. Capacity. |
| **Assets** | `/org/assets` | Equipment registry. Governance requirements. Training requirements. |
| **Positions** | `/org/positions` | Position types. Skill requirements. Department associations. |
| **Teams** | `/org/teams` | Team management. Members, leaders, type, season-awareness. |

#### Settings

| Screen | Route | Description |
|--------|-------|-------------|
| **Workspace Settings** | `/settings` | Name, logo, timezone, language, defaults. |
| **Modules** | `/settings/modules` | Active modules toggle. Plan limits. |
| **Billing** | `/settings/billing` | Stripe subscription. Plan, usage, invoices. |
| **Payroll Config** | `/settings/payroll` | Supplement rules, day categories, overtime rules, pension, tax. Via Policy. |
| **Notifications** | `/settings/notifications` | Global notification rules, channel priority, rate limits, quiet hours. |
| **Integrations** | `/settings/integrations` | Connected services. API keys. Webhook config. |
| **Data & Privacy** | `/settings/data` | GDPR export, data deletion, audit log. |

---

### 4.3 Employee Mode vs. Admin Mode (Desktop)

The desktop sidebar shows different items based on mode:

| Sidebar Item | Employee Mode | Admin Mode |
|-------------|:---:|:---:|
| Dashboard | ✅ (personal) | ✅ (operational) |
| My Schedule | ✅ | – |
| My Training | ✅ | – |
| My Profile / CV | ✅ | – |
| My Salary | ✅ | – |
| People | – | ✅ |
| Schedule Builder | – | ✅ (manager+) |
| Operations | – | ✅ (manager+) |
| Reports | – | ✅ (manager+) |
| Governance | – | ✅ (admin+) |
| Season | – | ✅ (admin+) |
| Organization | – | ✅ (admin+) |
| Chat | ✅ | ✅ |
| Mr. Botsson | ✅ | ✅ |
| Settings | ✅ (personal) | ✅ (workspace) |

**Every user** starts in Employee Mode when they log in. Managers and admins have a toggle to switch to Admin Mode.

---

## 5. Reusable UI Components — The Shared Library

These components appear across multiple screens and modules. Building them well once is critical.

### 5.1 Core Components (High Priority)

| Component | Used By | Description |
|-----------|---------|-------------|
| **FeedCard** | Home Feed | Polymorphic card that renders tasks, notes, messages, alerts. Type determines icon, color, action. Tappable to detail. |
| **ProcedureStepper** | Tasks, HACCP, Training, Onboarding | Step-by-step instructions with checkboxes. Supports: text, images, video, sub-checklists, input fields, photo capture per step. The single most reused component. |
| **QuizRenderer** | Training, Onboarding, Knowledge Tests | Renders quiz questions: multiple choice, true/false, open answer. Timer support. Score calculation. Pass/fail display. |
| **ChecklistView** | HACCP, Tasks, Control Lists, Routines | Simple check-off list. Can require notes, photos. Completion percentage bar. |
| **TemperatureForm** | HACCP Tasks | CCP-specific: lists assets with input fields, displays limits, auto-flags deviations. Red/green validation. |
| **PunchClock** | Home, Shifts | Punch in/out interface. GPS verification indicator. Timer display. Break controls. |
| **ShiftCard** | Schedule, Feed, Dashboard | Compact shift display: time, department color, position, location. Tappable for detail. |
| **ProfileCard** | People, Teams, Session Board | Compact person display: avatar, name, role, status badge, department color. |
| **PointsBadge** | Feed, Profile, Leaderboard | Compact gamification display: points earned, streak indicator, season rank. |
| **DeviationBanner** | Tasks, HACCP, Session Board | Alert banner when deviation is flagged. Links to runbook. Urgency styling. |
| **OnboardingOverlay** | All screens (trainee mode) | Portal-based overlay: spotlight, tooltip, highlight, navigate, confetti. Listens to AI command bus. |

### 5.2 Layout Components

| Component | Description |
|-----------|-------------|
| **AppShell (Mobile)** | Bottom tab bar + FAB + content area + status bar. Handles tab switching, FAB state, overlay management. |
| **AppShell (Desktop)** | Sidebar + top bar + content area. Mode toggle (employee/admin). Workspace switcher. |
| **PageHeader** | Screen title, back button, contextual actions. |
| **EmptyState** | Friendly empty state for all list screens. Contextual illustration + CTA. |
| **LoadingState** | Skeleton screens per content type (feed, schedule, list). |
| **ErrorState** | Error display with retry. Offline indicator. |

### 5.3 Form Components

| Component | Description |
|-----------|-------------|
| **TextInput** | Standard text field. Norwegian keyboard support. |
| **NumberInput** | Numeric input with unit display (°C, kg, kr). Range validation. |
| **DateTimePicker** | Date/time selection. Locale-aware (Norwegian formats). |
| **PhotoInput** | Camera capture + gallery select. Compression. Upload progress. |
| **SignatureInput** | For session sign-off and confirmations. |
| **MultiSelect** | Tag-style multi-selection for teams, labels, assignments. |
| **SearchInput** | Global search with contextual results (people, tasks, policies, shifts). |

### 5.4 Data Display Components

| Component | Description |
|-----------|-------------|
| **CalendarGrid** | Week/month calendar for schedule views. Color-coded cells. |
| **ProgressBar** | Linear progress. Used in training, onboarding, task completion. |
| **ComplianceScore** | Circular/radial score display. Green/yellow/red zones. |
| **LeaderboardList** | Ranked list with avatars, points, rank change indicators. |
| **TimelineView** | Chronological event display. Used in session history, audit logs. |
| **StatCard** | KPI display: number, label, trend arrow, comparison period. |
| **DataTable** | Sortable, filterable table for reports and lists. Desktop primarily. |

### 5.5 Interaction Components

| Component | Description |
|-----------|-------------|
| **SwipeAction** | Swipe-to-complete, swipe-to-claim on feed cards. Mobile. |
| **DragDrop** | For schedule builder (desktop). Shift assignment. |
| **ConfirmDialog** | Confirmation for destructive/important actions. |
| **ActionSheet** | Bottom sheet with contextual actions. Mobile. |
| **Toast / Snackbar** | Ephemeral feedback messages. Points earned, task completed, etc. |
| **PullToRefresh** | Feed and list refresh. Mobile. |

---

## 6. Screen Count Summary

| Platform | Persona Scope | Screen Count | Notes |
|----------|--------------|:---:|-------|
| **Mobile — Tab 1 (Home/Feed)** | All | ~10 | Feed + task detail + procedure + HACCP + deviation + briefs + session board + punch |
| **Mobile — Tab 2 (Shifts)** | All | ~6 | Schedule + detail + availability + swap + open shifts + history |
| **Mobile — Tab 3 (Chat)** | All | ~4 | List + thread + handoff + announcements |
| **Mobile — Tab 4 (Me)** | All | ~8 | Profile + training + certificates + tests + points + salary + documents + settings |
| **Mobile — AI Overlay** | All | ~3 | Chat + voice + onboarding mode |
| **Mobile — Cross-cutting** | All | ~4 | Notifications + quiz modal + photo modal + workspace switcher |
| **Mobile Total** | | **~35** | |
| | | | |
| **Desktop — Dashboard** | All | ~2 | Admin dashboard + employee dashboard |
| **Desktop — People** | Manager+ | ~5 | Directory + profile detail + invites + trainee dashboard + trainee detail |
| **Desktop — Schedule** | Manager+ | ~7 | Builder + templates + availability + swaps + open + overtime + payroll preview |
| **Desktop — Operations** | Manager+ | ~6 | Overview + session detail + history + dept schedule + task library + hooks |
| **Desktop — Reports** | Manager+ | ~6 | Hub + HACCP + operations + HR + payroll + gamification |
| **Desktop — Governance** | Admin+ | ~7 | Overview + policy editor + protocol builder + procedure editor + routines + runbook + test builder + control lists |
| **Desktop — Season** | Admin+ | ~4 | Manager + setup + battlefield + leaderboard |
| **Desktop — Organization** | Admin+ | ~7 | Org structure + departments + locations + zones + assets + positions + teams |
| **Desktop — Settings** | Admin+ | ~7 | Workspace + modules + billing + payroll + notifications + integrations + data |
| **Desktop — Chat** | All | ~1 | Full-width chat |
| **Desktop — Employee Mode** | All | ~5 | My schedule + my training + my profile/CV + my salary + personal settings |
| **Desktop Total** | | **~57** | |
| | | | |
| **Grand Total** | | **~92** | Some share components extensively |

---

## 7. Implementation Priority — What to Build First

### Phase 1: Foundation (Weeks 1–6)
**Goal:** Core shell + authentication + the screens that make the product usable.

| Priority | Screen/Component | Platform | Rationale |
|:---:|---|---|---|
| 1 | Auth flow (signup, login, workspace create) | Both | Nothing works without this |
| 2 | AppShell (both platforms) | Both | Navigation foundation |
| 3 | Desktop: Setup Wizard | Desktop | Admin must configure before anything |
| 4 | Desktop: Org Structure (departments, locations, positions) | Desktop | Foundation data for everything |
| 5 | Desktop: People + Invite | Desktop | Must be able to add employees |
| 6 | Mobile: Profile setup (trainee start) | Mobile | New employee's first experience |

### Phase 2: Core Operations (Weeks 7–14)
**Goal:** Scheduling + punch clock + basic task flow.

| Priority | Screen/Component | Platform | Rationale |
|:---:|---|---|---|
| 7 | Desktop: Schedule Builder | Desktop | Manager must create shifts |
| 8 | Mobile: My Schedule (Tab 2) | Mobile | Employee must see shifts |
| 9 | Mobile: Punch Clock | Mobile | Can't track hours without this |
| 10 | ProcedureStepper component | Both | Foundation for tasks, HACCP, training |
| 11 | Mobile: Feed/Home (basic) | Mobile | Employee's primary screen |
| 12 | FeedCard component | Mobile | Tasks and notes in the feed |
| 13 | Mobile: Task Detail | Mobile | Must be able to complete tasks |

### Phase 3: Communication + HACCP (Weeks 15–20)
**Goal:** Team chat + HACCP compliance + session management.

| Priority | Screen/Component | Platform | Rationale |
|:---:|---|---|---|
| 14 | Chat (both platforms) | Both | Team communication |
| 15 | TemperatureForm component | Mobile | HACCP compliance |
| 16 | DeviationFlow | Mobile | Deviation handling |
| 17 | Desktop: Operations (session management) | Desktop | Manager needs session oversight |
| 18 | Desktop: HACCP Report | Desktop | Compliance documentation |

### Phase 4: Training + Governance (Weeks 21–28)
**Goal:** Protocol management + training + knowledge tests.

| Priority | Screen/Component | Platform | Rationale |
|:---:|---|---|---|
| 19 | QuizRenderer component | Both | Training and knowledge tests |
| 20 | Desktop: Governance Studio | Desktop | Policy and protocol management |
| 21 | Mobile: Training (Tab 4) | Mobile | Employee training progress |
| 22 | OnboardingOverlay | Mobile | Trainee mode experience |
| 23 | Desktop: Trainee Dashboard | Desktop | Admin trainee oversight |

### Phase 5: Gamification + Intelligence (Weeks 29–36)
**Goal:** Season system + gamification + AI layer + reports.

| Priority | Screen/Component | Platform | Rationale |
|:---:|---|---|---|
| 24 | Desktop: Season Manager | Desktop | Gamification setup |
| 25 | PointsBadge + Leaderboard | Both | Engagement loop |
| 26 | AI Chat + Voice overlay | Mobile | Mr. Botsson integration |
| 27 | Desktop: Reports Hub | Desktop | Analytics and compliance reporting |
| 28 | Desktop: Payroll | Desktop | Salary calculations |
| 29 | Mobile: Salary/Payslip | Mobile | Employee salary view |

---

## 8. Open Design Decisions

These need to be resolved before implementation:

| # | Decision | Options | Impact |
|---|----------|---------|--------|
| 1 | **Mobile tab count** | 4 tabs + FAB (recommended) vs. 5 tabs | Navigation UX foundation |
| 2 | **AI access method** | FAB (recommended) vs. tab vs. persistent sidebar | How prominent is Mr. Botsson? |
| 3 | **Feed vs. Dashboard as home** | Feed-first (recommended, per Module 4 decision) vs. dashboard-first | Employee's default experience |
| 4 | **Off-shift home screen** | Schedule preview vs. personal dashboard vs. empty-ish state | What do employees see when not working? |
| 5 | **Desktop mode toggle** | Sidebar toggle (recommended) vs. separate URLs vs. role-based auto-select | How admins switch context |
| 6 | **Onboarding overlay approach** | Portal-based overlay (recommended, per Module 1) vs. dedicated onboarding screens | Trainee experience architecture |
| 7 | **Design system** | shadcn/ui + Tailwind (decided) — but: color palette, typography, icon set still TBD | Visual identity |
| 8 | **Offline support** | Required for HACCP tasks? Sync when back online? | Technical complexity vs. compliance needs |
| 9 | **Push notification depth** | Simple alerts vs. actionable notifications (complete task from notification) | UX polish vs. build effort |
| 10 | **Handoff method default** | Text-first vs. voice-first vs. AI-call-first | How employees do shift handoffs |

---

## 9. Design System Decisions Needed

Before building any screens, these design foundations must be established:

| Decision | Status | Notes |
|----------|--------|-------|
| Color palette | ❌ Not defined | Need primary, secondary, semantic colors (success/warning/error), department colors |
| Typography | ❌ Not defined | Font family, heading hierarchy, body text sizes |
| Icon set | ❌ Not defined | Lucide? Heroicons? Custom? |
| Spacing system | ⚠️ Implied (Tailwind) | Need to define spacing scale for consistency |
| Border radius | ❌ Not defined | Rounded cards? Sharp? How much? |
| Elevation / shadows | ❌ Not defined | Card depth, modal depth, FAB depth |
| Motion / animations | ❌ Not defined | Page transitions, feed item animations, celebration effects |
| Dark mode | ❌ Not defined | Support? Required for night shift workers? |
| Brand identity | ❌ Not defined | Logo, app icon, splash screen, empty states illustration style |

---

*This document is v1.0 — a foundation for discussion. Each screen will need detailed wireframes and specifications before implementation. The component library should be built as a shared package consumed by both the React Native mobile app and the Next.js web dashboard.*
