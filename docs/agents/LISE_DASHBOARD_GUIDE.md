---
title: "Lise AI — Dashboard Guide"
status: draft
updated: 2026-03-04
created: 2026-03-04
module: ai
tags: [lise, dashboard, guide, ai-assistant]
---

# Lise AI — Dashboard Guide

> Use this guide to explain the SmartOut dashboard to users. Adapt your language to the user's role (admin/manager vs. employee).

---

## Dashboard Overview

SmartOut has **two modes** — toggled with the button at the bottom of the sidebar:

| Mode              | Who                      | What they see                                          |
| ----------------- | ------------------------ | ------------------------------------------------------ |
| **Admin Mode**    | Owners, admins, managers | Full management dashboard with 4 views + all sub-pages |
| **Employee Mode** | All users                | Personal dashboard: my shifts, my training, my profile |

---

## Top Bar

The top bar shows:

- **Workspace name** (e.g. "Baardshaug Herregaard")
- **Active season** (e.g. "Vinter 2026") with status indicator
- **Dark/light mode toggle** (sun/moon icon)
- **Voice assistant** (microphone icon) — opens Mr. Botsson voice chat
- **User menu** — profile, logout

---

## Admin Mode — Sidebar Navigation

### Management

| Page          | Route                 | What it does                                                         |
| ------------- | --------------------- | -------------------------------------------------------------------- |
| **Dashboard** | `/dashboard`          | Main view with 4 tabs: Tactical, Strategic, Reconciliation, Activity |
| **People**    | `/dashboard/people`   | Employee list, hiring pipeline, profiles, contracts                  |
| **Schedule**  | `/dashboard/schedule` | Shift planner with daily/weekly/monthly views                        |

### Operations

| Page                | Route                   | What it does                                              |
| ------------------- | ----------------------- | --------------------------------------------------------- |
| **Live Operations** | `/dashboard/operations` | Real-time department sessions, active shifts, live events |
| **Reports**         | `/dashboard/reports`    | AI-powered report builder + saved reports grid            |

### Administration

| Page             | Route                     | What it does                                          |
| ---------------- | ------------------------- | ----------------------------------------------------- |
| **Governance**   | `/dashboard/governance`   | Policies, protocols, compliance tracking (HACCP etc.) |
| **Season**       | `/dashboard/year-wheel`   | Year wheel & season management: timeline, budget, day factors, hour factors |
| **Organization** | `/dashboard/organization` | Departments, locations, teams, positions              |

### Communication (both modes)

| Page                   | Route                             | What it does                                       |
| ---------------------- | --------------------------------- | -------------------------------------------------- |
| **Chat**               | `/dashboard/chat`                 | Team messaging: group chats, DMs, AI conversations |
| **Mr. Botsson**        | `/dashboard/ai`                   | AI assistant — text interface                      |
| **Onboarding Copilot** | `/dashboard/onboarding-assistant` | AI-guided onboarding interviews                    |

### System

| Page         | Route                 | What it does                               |
| ------------ | --------------------- | ------------------------------------------ |
| **Settings** | `/dashboard/settings` | Workspace settings, API keys, integrations |
| **Help**     | `/dashboard/help`     | Documentation, guides, support             |

---

## Employee Mode — Sidebar Navigation

### My Workspace

| Page                | Route                    | What it does                                                 |
| ------------------- | ------------------------ | ------------------------------------------------------------ |
| **Dashboard**       | `/dashboard`             | Today's shift, upcoming shifts, readiness score, open shifts |
| **My Schedule**     | `/dashboard/my-schedule` | Personal shift calendar                                      |
| **My Training**     | `/dashboard/my-training` | Assigned protocols, completion progress, readiness           |
| **My CV & Profile** | `/dashboard/my-cv`       | Personal profile, skills, certifications                     |
| **My Salary**       | `/dashboard/my-salary`   | Salary information, hours worked                             |

Plus the same **Communication** and **System** sections as admin mode.

---

## The 4 Admin Dashboard Views

When an admin is on `/dashboard`, they see tabs at the top to switch between views:

### 1. Tactical View (default)

**Purpose:** Today's operational overview.

Shows:

- **Signal Cards** — KPI tiles with status colors:
  - Green (good): metric on target
  - Orange (warning): needs attention
  - Red (critical): immediate action needed
- **Staffing Coverage** — 7-day bar chart showing fill percentage per day. Click a day to open the Day Control Sheet.
- **Training Readiness** — Progress bar showing % of protocol assignments completed. Alert strip when pending > 0.
- **Week Navigation** — Previous/next week buttons, "I dag" (Today) button to reset.

### 2. Strategic View

**Purpose:** Long-term KPIs and trends.

Shows:

- **KPI Cards** with targets you can edit:
  - Payroll % (labor cost / revenue)
  - Turnover rate
  - Absence rate
  - Onboarding days
  - Compliance score
  - Task completion
- **Workforce Pipeline** — Active staff count, new hires (30d), departures (30d), currently onboarding
- **Training Readiness** — Same data, strategic perspective
- **Location Selector** — Filter KPIs by location
- **Budget Settings** — Edit KPI targets per location

### 3. Reconciliation View

**Purpose:** End-of-day financial sign-off.

Shows:

- Daily revenue reconciliation
- Deviation approvals (actual vs planned)
- Department session sign-offs
- Shift hour summaries

### 4. Activity View

**Purpose:** Timeline of everything that happened.

Shows:

- Chronological event feed
- Guardian signals (automated alerts)
- Agent actions (what Mr. Botsson did)
- System events

---

## Employee Dashboard

When in **Employee Mode**, the main dashboard (`/dashboard`) shows:

### Today's Shift Card

- Current shift details: time, role, department
- "You're off today" if no shift scheduled

### Upcoming Shifts

- Next 5-7 scheduled shifts with date, time, role
- Color-coded by department

### Readiness Score

- Circular progress indicator showing % of assigned protocols completed
- "Trainee" or "Ready" status
- Quick links to incomplete protocols

### Open Shifts

- Available shifts the employee can pick up
- Shows date, time, and role
- "Grab shift" action

---

## Key Concepts to Explain

### Readiness

"Ready" means all assigned Protocols have been completed. The readiness score shows progress toward that goal. A new employee starts as a "trainee" and becomes "ready" when they hit 100%.

### Seasons

A time period (e.g. "Vinter 2026") that wraps all operations. Each season has its own budget, targets, day/hour factors, and leaderboard. Think of it as a planning container.

### Department Sessions

A daily container per department. Lifecycle: upcoming -> active -> pending signoff -> closed. Contains all shifts and operational events for that day.

### Policies vs Protocols

- **Policy** = The rule (e.g. "Food Safety Policy")
- **Protocol** = The training/procedure employees must complete (e.g. "Temperature Control Protocol")

### Schedule

Shifts are assigned per day. The planner supports daily, weekly, and monthly views, with three perspectives: by employee ("ansatt"), by role ("jobb"), or by team.

---

## Action Strip

Below the top bar, an **Action Strip** shows urgent items that need attention:

- **Shift gaps** — Unassigned shifts coming up (critical if within 48h)
- **Pending contracts** — Contracts awaiting signatures
- **Stuck onboarding** — Employees stuck in onboarding > 48h
- **Pending protocols** — Overdue training assignments
- **Stale invitations** — Unaccepted invitations > 7 days

Each item has a priority (critical/warning/info) and clicking it navigates to the relevant page.

---

## Voice Assistant (Mr. Botsson)

Available via:

1. **Microphone icon** in the top bar (voice mode)
2. **Mr. Botsson** page in the sidebar (text mode)

The assistant context-switches automatically based on which page the user is on:

- On `/dashboard/schedule` → becomes "Shift Assistant"
- On `/dashboard/governance` → becomes "HACCP Inspector"
- On `/dashboard/onboarding-assistant` → becomes "Onboarding Interview"
- Everywhere else → "Mr. Botsson" (general assistant)

---

## How to Guide Users

### New admin logging in for the first time:

"Welcome! You're in the admin dashboard. The **Tactical View** is your daily command center — it shows today's shift coverage and any urgent actions at the top. The sidebar lets you navigate to People, Schedule, and other sections."

### Employee checking their shifts:

"Your dashboard shows today's shift at the top, and your upcoming shifts below. If you want to pick up extra shifts, check the 'Open Shifts' section."

### Manager asking about performance:

"Switch to the **Strategic View** tab — it shows all your KPIs like turnover, absence rates, and compliance scores. You can filter by location and edit targets."

### Anyone asking about training:

"Check your **Readiness Score** — it shows how many protocols you've completed. Click on any incomplete one to start it. Once you're at 100%, you're officially 'ready'."
