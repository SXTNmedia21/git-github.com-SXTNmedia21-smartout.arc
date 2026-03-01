---
title: "User Journey: Admin Workspace Setup"
status: approved
created: 2026-03-01
updated: 2026-03-01
module: onboarding
tags: [user-journey, admin, wizard, workspace-setup]
---

# User Journey: Admin Workspace Setup

## Overview

The Admin Workspace Setup Wizard guides a new admin through creating and activating their Smartout workspace. The wizard collects company information, organizational structure, and branding before activating the workspace and optionally inviting team members.

**Total steps:** 15
**Estimated completion time:** 5-15 minutes (depending on skip usage and org complexity)
**Entry point:** `/onboarding` or `/onboarding?url=example.com`

### Flow Diagram

```
┌──────┐    ┌──────────┐    ┌──────┐    ┌──────────────────┐    ┌──────────┐
│ init │───>│ crawling  │───>│ auth │───>│ org_verification │───>│ branding │
│  (1) │    │    (2)    │    │  (3) │    │       (4)        │    │   (5)    │
└──────┘    └──────────┘    └──────┘    └──────────────────┘    └──────────┘
                                                                      │
     ┌────────────────────────────────────────────────────────────────┘
     v
┌──────────────────┐    ┌─────────────────┐    ┌─────────────┐
│ season_education │───>│ season_identity │───>│ departments │
│       (6)        │    │       (7)       │    │     (8)     │
└──────────────────┘    └─────────────────┘    └─────────────┘
                                                      │
     ┌────────────────────────────────────────────────┘
     v
┌───────┐    ┌───────────┐    ┌────────────┐    ┌────────────────────┐
│ teams │───>│ locations │───>│ procedures │───>│ battlefield_review │
│  (9)  │    │   (10)    │    │    (11)    │    │        (12)        │
└───────┘    └───────────┘    └────────────┘    └────────────────────┘
                                                         │
     ┌───────────────────────────────────────────────────┘
     v
┌────────────┐    ┌────────┐    ┌──────┐
│ finalizing │───>│ invite │───>│ done │
│    (13)    │    │  (14)  │    │ (15) │
└────────────┘    └────────┘    └──────┘
```

### Step Index

| #   | Step               | Category       | Skippable | DB Write |
| --- | ------------------ | -------------- | --------- | -------- |
| 1   | init               | Data Gathering | No        | No       |
| 2   | crawling           | Data Gathering | No        | No       |
| 3   | auth               | Authentication | Yes       | Yes      |
| 4   | org_verification   | Company Info   | Yes       | Yes      |
| 5   | branding           | Company Info   | No        | No\*     |
| 6   | season_education   | Season Setup   | No        | No       |
| 7   | season_identity    | Season Setup   | No        | No\*     |
| 8   | departments        | Org Structure  | No        | No\*     |
| 9   | teams              | Org Structure  | No        | No\*     |
| 10  | locations          | Org Structure  | No        | No\*     |
| 11  | procedures         | Governance     | No        | No\*     |
| 12  | battlefield_review | Review         | No        | No       |
| 13  | finalizing         | Activation     | No        | Yes      |
| 14  | invite             | Post-Setup     | Yes       | Yes      |
| 15  | done               | Post-Setup     | No        | No       |

\*Steps 5-11 store data in client-side wizard state (`workspaceData`). All DB writes happen during step 13 (finalizing).

---

## Step Details

---

### Step 1: Init

| Field     | Value                             |
| --------- | --------------------------------- |
| Step ID   | `init`                            |
| Trigger   | User navigates to `/onboarding`   |
| Category  | Data Gathering                    |
| Skippable | No (but URL input can be skipped) |

**UI**

- Heading: welcome text introducing the workspace setup
- URL input field with placeholder `your-webpage.com`
- "Scan & Generate" primary button
- "Skip" secondary button (proceeds without website data)

**Actions**

| Action                              | Result                                                   |
| ----------------------------------- | -------------------------------------------------------- |
| Enter URL + click "Scan & Generate" | Validates URL format, transitions to `crawling` with URL |
| Click "Skip"                        | Transitions to `auth` with empty `workspaceData`         |
| Page load with `?url=` query param  | Auto-populates URL field and auto-starts crawling        |

**Validation**

- URL must be a valid domain format (with or without protocol prefix)
- Empty URL on "Scan & Generate" shows validation error

**Edge Cases**

- `?url=` query param with invalid URL: shows input field pre-filled, validation error on auto-submit
- `?url=` query param with valid URL: auto-starts crawling immediately (no user interaction needed)

**DB Effects**

None. URL is held in client state only.

**Next Step**

- "Scan & Generate" with valid URL --> `crawling`
- "Skip" --> `auth`

---

### Step 2: Crawling

| Field     | Value                          |
| --------- | ------------------------------ |
| Step ID   | `crawling`                     |
| Trigger   | URL submitted from `init` step |
| Category  | Data Gathering                 |
| Skippable | No (auto-progresses)           |

**UI**

- Loading spinner animation
- Status text: "Analyzing {url}..."
- No user-interactive elements during crawl

**Actions**

| Action      | Result                                                               |
| ----------- | -------------------------------------------------------------------- |
| (automatic) | `gather-workspace-intelligence` Edge Function is called with the URL |

**Validation**

N/A. This is an automated step.

**Edge Cases**

| Scenario                           | Behavior                                                                    |
| ---------------------------------- | --------------------------------------------------------------------------- |
| Edge Function returns successfully | `workspaceData` populated with scraped company info, departments, locations |
| Edge Function fails / times out    | After 3 second delay, falls back to mock data (Grand Hotel Oslo)            |
| Network error                      | Same fallback behavior as Edge Function failure                             |

**Fallback Mock Data (Grand Hotel Oslo)**

When the crawl fails, the wizard populates `workspaceData` with a realistic hospitality dataset:

- Company: Grand Hotel Oslo
- Departments: Kitchen, Front of House, Housekeeping, Bar, Management
- Locations: Main building address
- Industry-appropriate procedures and team suggestions

This ensures the user always has a populated starting point to edit.

**DB Effects**

None. All data stored in client-side wizard state.

**Next Step**

Always --> `auth` (on success or fallback)

---

### Step 3: Auth

| Field     | Value                                    |
| --------- | ---------------------------------------- |
| Step ID   | `auth`                                   |
| Trigger   | Crawling completes (success or fallback) |
| Category  | Authentication                           |
| Skippable | Yes                                      |

**UI**

- Heading: "Save your progress"
- Tab toggle: **Create Account** | **Sign In**
- Create Account tab:
  - Email input
  - Password input
  - Confirm password input
  - "Create Account" button
- Sign In tab:
  - Email input
  - Password input
  - "Sign In" button
- "Skip" link with text: "you can create an account later"

**Actions**

| Action                | Result                                                              |
| --------------------- | ------------------------------------------------------------------- |
| Submit Create Account | Calls Supabase Auth signup, creates `onboarding_session` on success |
| Submit Sign In        | Calls Supabase Auth signin, creates `onboarding_session` on success |
| Click "Skip"          | Proceeds without authentication                                     |

**Validation**

| Field            | Rules                             |
| ---------------- | --------------------------------- |
| Email            | Valid email format, required      |
| Password         | Minimum 8 characters, required    |
| Confirm password | Must match password (signup only) |

**Edge Cases**

| Scenario                          | Behavior                                                |
| --------------------------------- | ------------------------------------------------------- |
| User already authenticated        | Step is skipped entirely, proceed to `org_verification` |
| Email already registered (signup) | Show error, suggest switching to Sign In tab            |
| Invalid credentials (signin)      | Show error message                                      |
| Network error                     | Show retry prompt                                       |

**DB Effects**

| Operation        | Table / Service      | Details                                     |
| ---------------- | -------------------- | ------------------------------------------- |
| Signup           | `auth.users`         | New user created via Supabase Auth          |
| Signup (trigger) | `user_identity`      | Auto-created by `handle_new_user()` trigger |
| Session creation | `onboarding_session` | Links auth user to wizard state             |

**Next Step**

Always --> `org_verification`

---

### Step 4: Org Verification

| Field     | Value                          |
| --------- | ------------------------------ |
| Step ID   | `org_verification`             |
| Trigger   | Auth step completed or skipped |
| Category  | Company Info                   |
| Skippable | Yes                            |

**UI**

- Heading: Organisasjonsnummer verification
- Input field: "Organisasjonsnummer" (9-digit Norwegian org number)
- "Look Up" / "Verify" button
- On successful lookup:
  - Company name
  - Address
  - CEO / Daglig leder
  - Industry (Naeringskode)
  - "Looks correct" confirmation button
  - "Try Again" reset button
- "Skip this step" link

**Actions**

| Action                    | Result                                 |
| ------------------------- | -------------------------------------- |
| Enter org number + verify | Calls Bronnysundregistrene (Brreg) API |
| "Looks correct"           | Saves org data, proceeds to next step  |
| "Try Again"               | Clears lookup result, resets input     |
| "Skip this step"          | Proceeds without org verification      |

**Validation**

| Field               | Rules                          |
| ------------------- | ------------------------------ |
| Organisasjonsnummer | Exactly 9 digits, numeric only |

**Edge Cases**

| Scenario                                | Behavior                                     |
| --------------------------------------- | -------------------------------------------- |
| Invalid org number format               | Client-side validation error                 |
| Org number not found in Brreg           | "Not found" message, option to retry or skip |
| Brreg API unavailable                   | Error message with retry and skip options    |
| Org number belongs to dissolved company | Show status warning, allow confirmation      |

**DB Effects**

| Operation        | Table     | Details                                                 |
| ---------------- | --------- | ------------------------------------------------------- |
| Confirm org data | `company` | Saves `org_number` to company record (if authenticated) |

If unauthenticated, org data is held in client state until activation (step 13).

**Next Step**

Always --> `branding`

---

### Step 5: Branding

| Field     | Value                                 |
| --------- | ------------------------------------- |
| Step ID   | `branding`                            |
| Trigger   | Org verification completed or skipped |
| Category  | Company Info                          |
| Skippable | No                                    |

**UI**

- Logo upload area (placeholder/dropzone)
- Slogan input field (text)
- Brand color picker (default: `#3B82F6`)
- Communication tone dropdown:
  - Professional & Formal
  - Friendly & Casual
  - Energetic & Upbeat
- "Continue" primary button
- "Back" button --> `org_verification`

**Actions**

| Action           | Result                           |
| ---------------- | -------------------------------- |
| Upload logo      | Preview displayed in upload area |
| Set slogan       | Stored in wizard state           |
| Pick color       | Live preview of brand color      |
| Select tone      | Stored in wizard state           |
| Click "Continue" | Proceeds to next step            |
| Click "Back"     | Returns to `org_verification`    |

**Validation**

| Field       | Rules                                                   |
| ----------- | ------------------------------------------------------- |
| Logo        | Optional. Accepted formats: PNG, JPG, SVG. Max size TBD |
| Slogan      | Optional. Max 200 characters                            |
| Brand color | Must be valid hex color. Default provided               |
| Tone        | Required. Default selection provided                    |

**Edge Cases**

| Scenario          | Behavior                              |
| ----------------- | ------------------------------------- |
| Logo upload fails | Show error, allow retry. Not blocking |
| No logo uploaded  | Proceed with placeholder/default      |
| Invalid color hex | Reset to default `#3B82F6`            |

**DB Effects**

None. All branding data stored in client-side wizard state until activation.

**Next Step**

"Continue" --> `season_education`

---

### Step 6: Season Education

| Field     | Value                   |
| --------- | ----------------------- |
| Step ID   | `season_education`      |
| Trigger   | Branding step completed |
| Category  | Season Setup            |
| Skippable | No                      |

**UI**

- Static explainer content about the Seasons concept in Smartout
- Explanation of how Seasons wrap operations, contain leaderboards, and define time-bound or permanent operational periods
- "I understand, let's build one" primary button

**Actions**

| Action                                | Result                        |
| ------------------------------------- | ----------------------------- |
| Click "I understand, let's build one" | Proceeds to `season_identity` |

**Validation**

None. Read-only step.

**Edge Cases**

None. This is a static informational step.

**DB Effects**

None.

**Next Step**

Always --> `season_identity`

---

### Step 7: Season Identity

| Field     | Value                         |
| --------- | ----------------------------- |
| Step ID   | `season_identity`             |
| Trigger   | Season education acknowledged |
| Category  | Season Setup                  |
| Skippable | No                            |

**UI**

- Season name input (default: "Core Operations")
- Start date picker (optional)
- End date picker (optional)
- Season type toggle: **Permanent** | **Temporal**
- "Continue" primary button
- "Back" button --> `season_education`

**Actions**

| Action             | Result                                  |
| ------------------ | --------------------------------------- |
| Edit season name   | Updates wizard state                    |
| Set start/end date | Updates wizard state                    |
| Toggle season type | Switches between Permanent and Temporal |
| Click "Continue"   | Proceeds to next step                   |
| Click "Back"       | Returns to `season_education`           |

**Validation**

| Field       | Rules                                               |
| ----------- | --------------------------------------------------- |
| Season name | Required. Non-empty string                          |
| Start date  | Optional. Must be valid date if provided            |
| End date    | Optional. Must be after start date if both provided |
| Season type | Required. Default: Permanent                        |

**Edge Cases**

| Scenario                        | Behavior                            |
| ------------------------------- | ----------------------------------- |
| End date before start date      | Validation error on submit          |
| Temporal selected with no dates | Allowed (dates are optional)        |
| Empty season name               | Validation error, field highlighted |

**DB Effects**

None. Season data stored in client-side wizard state until activation.

**Next Step**

"Continue" --> `departments`

---

### Step 8: Departments

| Field     | Value                     |
| --------- | ------------------------- |
| Step ID   | `departments`             |
| Trigger   | Season identity completed |
| Category  | Org Structure             |
| Skippable | No                        |

**UI**

- List of active departments (pre-populated from crawl data or defaults)
- Each department row: name, toggle (active/inactive), remove button
- "Recommended for your industry" suggestion chips:
  - Kitchen
  - Front of House
  - Management
  - Bar
  - Housekeeping
  - Events
- "Add Department" button
- Department drawer (slide-out panel) for editing:
  - Name input
  - Description textarea
- "Continue" primary button
- "Back" button --> `season_identity`

**Actions**

| Action                | Result                                     |
| --------------------- | ------------------------------------------ |
| Toggle department     | Activates/deactivates department           |
| Remove department     | Removes from list                          |
| Click suggestion chip | Adds recommended department to list        |
| "Add Department"      | Opens department drawer with empty fields  |
| Edit department       | Opens department drawer with existing data |
| Save in drawer        | Updates department in list                 |
| Click "Continue"      | Proceeds to next step                      |
| Click "Back"          | Returns to `season_identity`               |

**Validation**

| Field               | Rules                                   |
| ------------------- | --------------------------------------- |
| Department name     | Required. Non-empty. Unique within list |
| Description         | Optional                                |
| Minimum departments | At least 1 active department required   |

**Edge Cases**

| Scenario                            | Behavior                              |
| ----------------------------------- | ------------------------------------- |
| All departments removed/deactivated | Validation error on "Continue"        |
| Duplicate department name           | Validation error in drawer            |
| Crawl data had no departments       | Show recommendation chips prominently |

**DB Effects**

None. Department list stored in client-side wizard state until activation.

**Next Step**

"Continue" --> `teams`

---

### Step 9: Teams

| Field     | Value                      |
| --------- | -------------------------- |
| Step ID   | `teams`                    |
| Trigger   | Departments step completed |
| Category  | Org Structure              |
| Skippable | No                         |

**UI**

- Per-department sections, each showing:
  - Department name as section header
  - List of teams within that department
  - "Add Team" button per department
- Cross-department teams section (teams not tied to a single department)
- Team drawer (slide-out panel) for editing:
  - Team name input
  - Department assignment
  - Description
- Smart default suggestions based on department (e.g., Kitchen --> "Chefs")
- "Continue" primary button
- "Back" button --> `departments`

**Actions**

| Action           | Result                               |
| ---------------- | ------------------------------------ |
| Add team         | Opens team drawer for new team       |
| Edit team        | Opens team drawer with existing data |
| Remove team      | Removes from department              |
| Save in drawer   | Creates/updates team in list         |
| Click "Continue" | Proceeds to next step                |
| Click "Back"     | Returns to `departments`             |

**Validation**

| Field      | Rules                                    |
| ---------- | ---------------------------------------- |
| Team name  | Required. Non-empty                      |
| Department | Required (or marked as cross-department) |

**Edge Cases**

| Scenario                            | Behavior                                         |
| ----------------------------------- | ------------------------------------------------ |
| Department with no teams            | Allowed. Teams are optional per department       |
| No teams at all                     | Allowed. Proceed without teams                   |
| Department removed after team added | Orphaned teams shown in cross-department section |

**DB Effects**

None. Team data stored in client-side wizard state until activation.

**Next Step**

"Continue" --> `locations`

---

### Step 10: Locations

| Field     | Value                |
| --------- | -------------------- |
| Step ID   | `locations`          |
| Trigger   | Teams step completed |
| Category  | Org Structure        |
| Skippable | No                   |

**UI**

- Main Office / Headquarters card:
  - Pre-populated address from workspace data (crawl or org verification)
  - Editable
- List of additional locations (if any)
- Location drawer (slide-out panel) for editing:
  - Location name
  - Address fields
  - Description
- "Add another Location" button
- "Continue" primary button
- "Back" button --> `teams`

**Actions**

| Action                   | Result                                   |
| ------------------------ | ---------------------------------------- |
| Edit main location       | Opens location drawer                    |
| Add another location     | Opens location drawer with empty fields  |
| Edit additional location | Opens location drawer with existing data |
| Remove location          | Removes from list (not main office)      |
| Click "Continue"         | Proceeds to next step                    |
| Click "Back"             | Returns to `teams`                       |

**Validation**

| Field         | Rules                                      |
| ------------- | ------------------------------------------ |
| Location name | Required for each location                 |
| Address       | Optional but recommended                   |
| Minimum count | At least 1 location required (main office) |

**Edge Cases**

| Scenario                      | Behavior                                   |
| ----------------------------- | ------------------------------------------ |
| No address from crawl data    | Main office card shown with empty fields   |
| Attempt to remove main office | Not allowed. Main office cannot be removed |
| Duplicate location names      | Allowed (different addresses)              |

**DB Effects**

None. Location data stored in client-side wizard state until activation.

**Next Step**

"Continue" --> `procedures`

---

### Step 11: Procedures

| Field     | Value                    |
| --------- | ------------------------ |
| Step ID   | `procedures`             |
| Trigger   | Locations step completed |
| Category  | Governance               |
| Skippable | No                       |

**UI**

- Procedure list with urgency badges:
  - **High** (red badge)
  - **Medium** (yellow badge)
  - **Low** (green badge)
- Each procedure row shows:
  - Title
  - Urgency badge
  - Assigned department
- Procedure drawer (slide-out panel) for editing:
  - Title input
  - Urgency selector (High / Medium / Low)
  - Department assignment dropdown
  - Instructions textarea
- "Add Procedure" button
- "Continue" primary button
- "Back" button --> `locations`

**Actions**

| Action           | Result                                    |
| ---------------- | ----------------------------------------- |
| Add procedure    | Opens procedure drawer                    |
| Edit procedure   | Opens procedure drawer with existing data |
| Remove procedure | Removes from list                         |
| Save in drawer   | Creates/updates procedure in list         |
| Click "Continue" | Proceeds to next step                     |
| Click "Back"     | Returns to `locations`                    |

**Validation**

| Field        | Rules                               |
| ------------ | ----------------------------------- |
| Title        | Required. Non-empty                 |
| Urgency      | Required. One of: High, Medium, Low |
| Department   | Optional (can be unassigned)        |
| Instructions | Optional                            |

**Edge Cases**

| Scenario                            | Behavior                         |
| ----------------------------------- | -------------------------------- |
| No procedures added                 | Allowed. Proceed with empty list |
| Department in procedure was removed | Show warning, allow reassignment |
| Crawl data provided procedures      | Pre-populated in list, editable  |

**DB Effects**

None. Procedure data stored in client-side wizard state until activation.

**Next Step**

"Continue" --> `battlefield_review`

---

### Step 12: Battlefield Review

| Field     | Value                     |
| --------- | ------------------------- |
| Step ID   | `battlefield_review`      |
| Trigger   | Procedures step completed |
| Category  | Review                    |
| Skippable | No                        |

**UI**

Summary cards displaying all configured data:

| Card             | Content                                               |
| ---------------- | ----------------------------------------------------- |
| Identity & Brand | Company name, logo preview, slogan, brand color, tone |
| Initial Season   | Season name, type, date range (if set)                |
| Locations        | Count + list of location names                        |
| Departments      | Count + team counts per department                    |
| Procedures       | Count + urgency breakdown (X high, Y medium, Z low)   |

- Each card has an "Edit" link that navigates back to the corresponding step
- Error banner (shown if returning from a failed activation attempt)
- "Activate Workspace" primary CTA button

**Actions**

| Action                     | Result                                |
| -------------------------- | ------------------------------------- |
| Click "Edit" on card       | Navigates to the relevant wizard step |
| Click "Activate Workspace" | Transitions to `finalizing`           |

**Edit Link Mapping**

| Card             | Navigates to               |
| ---------------- | -------------------------- |
| Identity & Brand | `branding` (step 5)        |
| Initial Season   | `season_identity` (step 7) |
| Locations        | `locations` (step 10)      |
| Departments      | `departments` (step 8)     |
| Procedures       | `procedures` (step 11)     |

**Validation**

None at this step. All validation happened in prior steps.

**Edge Cases**

| Scenario                         | Behavior                                 |
| -------------------------------- | ---------------------------------------- |
| Returning from failed activation | Error message displayed at top of review |
| User edited data after returning | Cards reflect updated wizard state       |
| No procedures configured         | Procedures card shows "0 procedures"     |
| No teams configured              | Department cards show "0 teams"          |

**DB Effects**

None.

**Next Step**

"Activate Workspace" --> `finalizing`

---

### Step 13: Finalizing

| Field     | Value                                              |
| --------- | -------------------------------------------------- |
| Step ID   | `finalizing`                                       |
| Trigger   | "Activate Workspace" clicked in battlefield review |
| Category  | Activation                                         |
| Skippable | No                                                 |

**UI**

- Loading spinner animation
- Progress status text (e.g., "Creating your workspace...")
- No user-interactive elements during activation

**Actions**

| Action      | Result                                                                              |
| ----------- | ----------------------------------------------------------------------------------- |
| (automatic) | Calls `activate-workspace` Edge Function which executes `activate_workspace_v3` RPC |

**Activation Sequence**

The `activate_workspace_v3` RPC creates all entities in a single database transaction:

| Order | Entity Created | Table            | Details                                   |
| ----- | -------------- | ---------------- | ----------------------------------------- |
| 1     | Company        | `company`        | Name, org_number, branding                |
| 2     | Workspace      | `workspace`      | Linked to company, slug generated         |
| 3     | Company Member | `company_member` | Links user to company as owner            |
| 4     | Profile        | `profile`        | Admin profile in workspace                |
| 5     | Season         | `season`         | Initial season with configured type/dates |
| 6     | Locations      | `location`       | All configured locations                  |
| 7     | Departments    | `department`     | All active departments                    |
| 8     | Teams          | `team`           | All configured teams per department       |
| 9     | Policy         | `policy`         | Default workspace policy                  |
| 10    | Protocol       | `protocol`       | Default protocols                         |
| 11    | Procedures     | `procedure`      | All configured procedures                 |

**Validation**

Server-side validation in the Edge Function and RPC. Client sends full wizard state payload.

**Edge Cases**

| Scenario                                | Behavior                                                            |
| --------------------------------------- | ------------------------------------------------------------------- |
| RPC succeeds                            | Transitions to `invite`                                             |
| RPC fails (validation error)            | Falls back to `battlefield_review` with error message               |
| RPC fails (server error)                | Falls back to `battlefield_review` with error message               |
| Network timeout                         | Falls back to `battlefield_review` with retry prompt                |
| User not authenticated                  | Edge Function creates anonymous workspace (limited) or prompts auth |
| Partial creation (transaction rollback) | All-or-nothing. Transaction ensures no partial state                |

**DB Effects**

See activation sequence table above. All entities created in a single transaction.

**Next Step**

- On success --> `invite`
- On failure --> `battlefield_review` (with error state)

---

### Step 14: Invite

| Field     | Value                          |
| --------- | ------------------------------ |
| Step ID   | `invite`                       |
| Trigger   | Workspace activation succeeded |
| Category  | Post-Setup                     |
| Skippable | Yes                            |

**UI**

Three invitation channels:

| Channel        | UI Elements                                          |
| -------------- | ---------------------------------------------------- |
| Email          | Email input field + "Send Invite" button             |
| Phone (SMS)    | Phone input with `+47` prefix + "Send Invite" button |
| Shareable Link | Auto-generated link + "Copy Link" button             |

- Per-channel success states (checkmark + confirmation text after send)
- "Enter Dashboard" primary button
- "Skip for now" link

**Actions**

| Action                  | Result                                             |
| ----------------------- | -------------------------------------------------- |
| Send email invite       | Calls `create-invitation` Edge Function with email |
| Send SMS invite         | Calls `create-invitation` Edge Function with phone |
| Copy shareable link     | Copies invitation URL to clipboard                 |
| Click "Enter Dashboard" | Navigates to `done`                                |
| Click "Skip for now"    | Navigates to `done`                                |

**Validation**

| Field | Rules                                             |
| ----- | ------------------------------------------------- |
| Email | Valid email format                                |
| Phone | Valid Norwegian phone number (8 digits after +47) |

**Edge Cases**

| Scenario                        | Behavior                               |
| ------------------------------- | -------------------------------------- |
| Email send fails                | Error message per channel, allow retry |
| SMS send fails                  | Error message per channel, allow retry |
| Invalid email format            | Client-side validation error           |
| Invalid phone format            | Client-side validation error           |
| Multiple invites sent           | Each shows independent success state   |
| Shareable link generation fails | Show error, allow retry                |

**DB Effects**

| Operation       | Table / Service              | Details                                       |
| --------------- | ---------------------------- | --------------------------------------------- |
| Send invitation | `invitation` (or equivalent) | Created via `create-invitation` Edge Function |
| Email delivery  | SendGrid                     | Invitation email sent                         |
| SMS delivery    | Twilio                       | Invitation SMS sent                           |

**Next Step**

Always --> `done`

---

### Step 15: Done

| Field     | Value                            |
| --------- | -------------------------------- |
| Step ID   | `done`                           |
| Trigger   | Invite step completed or skipped |
| Category  | Post-Setup                       |
| Skippable | No (terminal step)               |

**UI**

- Confetti animation effect
- "You're All Set!" heading
- Success message summarizing what was created
- "Enter Dashboard" primary link/button

**Actions**

| Action                  | Result                           |
| ----------------------- | -------------------------------- |
| Click "Enter Dashboard" | Redirects to workspace dashboard |

**Navigation Target**

| Environment | Redirect URL                           |
| ----------- | -------------------------------------- |
| Production  | `https://{workspace-slug}.smartout.ai` |
| Development | `/dashboard` (same origin)             |

**Validation**

None.

**Edge Cases**

| Scenario                     | Behavior                          |
| ---------------------------- | --------------------------------- |
| Workspace slug not available | Fallback to generic dashboard URL |
| User not authenticated       | Redirect to login with return URL |

**DB Effects**

None.

**Next Step**

Terminal. Wizard complete.

---

## State Management

### Wizard State (`workspaceData`)

All wizard steps contribute to a shared client-side state object. This state is the single source of truth until activation (step 13), at which point it is serialized and sent to the backend.

```
workspaceData: {
  url:            string | null
  companyName:    string
  orgNumber:      string | null
  branding: {
    logo:         File | null
    slogan:       string
    brandColor:   string
    tone:         string
  }
  season: {
    name:         string
    startDate:    Date | null
    endDate:      Date | null
    type:         'permanent' | 'temporal'
  }
  departments:    Department[]
  teams:          Team[]
  locations:      Location[]
  procedures:     Procedure[]
}
```

### Session Persistence

If the user is authenticated (step 3), wizard state is periodically saved to `onboarding_session` for resume capability. On page refresh, the wizard checks for an existing session and resumes from the last completed step.

---

## E2E Test Scenarios

### 1. Happy Path (Full Flow with Mock Data)

| Step | Action                                          | Expected Result                               |
| ---- | ----------------------------------------------- | --------------------------------------------- |
| 1    | Enter `example.com` and click "Scan & Generate" | Transitions to crawling                       |
| 2    | Wait for crawl completion                       | workspaceData populated, proceeds to auth     |
| 3    | Fill signup form and submit                     | Account created, proceeds to org verification |
| 4    | Enter valid org number, confirm                 | Org data saved, proceeds to branding          |
| 5    | Set slogan, pick color, select tone             | Proceeds to season education                  |
| 6    | Click "I understand, let's build one"           | Proceeds to season identity                   |
| 7    | Set season name and type                        | Proceeds to departments                       |
| 8    | Verify pre-populated departments, add one       | Proceeds to teams                             |
| 9    | Add teams to departments                        | Proceeds to locations                         |
| 10   | Verify main location, add secondary             | Proceeds to procedures                        |
| 11   | Edit a procedure urgency, add a new one         | Proceeds to battlefield review                |
| 12   | Verify all summary cards, click "Activate"      | Proceeds to finalizing                        |
| 13   | Wait for activation                             | Workspace created, proceeds to invite         |
| 14   | Send email invite, copy link                    | Invitations sent, proceed to done             |
| 15   | Verify confetti, click "Enter Dashboard"        | Redirected to workspace dashboard             |

### 2. Skip Auth Flow

| Step | Action                                         | Expected Result                           |
| ---- | ---------------------------------------------- | ----------------------------------------- |
| 1    | Click "Skip"                                   | Proceeds to auth (no crawl data)          |
| 3    | Click "Skip" (you can create an account later) | Proceeds to org verification without auth |
| 4-12 | Complete all steps normally                    | Wizard state stored client-side only      |
| 13   | Click "Activate Workspace"                     | Activation handles unauthenticated state  |

### 3. Org Verification with Brreg Lookup (Mock)

| Step | Action                                    | Expected Result                         |
| ---- | ----------------------------------------- | --------------------------------------- |
| 4    | Enter `123456789` (mock valid org number) | Brreg API returns company data          |
| 4    | Verify displayed company name and address | Data matches mock Brreg response        |
| 4    | Click "Looks correct"                     | Org number saved, proceeds to branding  |
| 4    | (alt) Click "Try Again"                   | Input cleared, ready for new org number |
| 4    | (alt) Enter invalid format `12345`        | Validation error shown                  |
| 4    | (alt) Click "Skip this step"              | Proceeds without org data               |

### 4. Department Management

| Step | Action                                   | Expected Result                       |
| ---- | ---------------------------------------- | ------------------------------------- |
| 8    | Remove a pre-populated department        | Department removed from list          |
| 8    | Toggle a department inactive             | Department visually deactivated       |
| 8    | Click recommendation chip "Events"       | Events department added to list       |
| 8    | Add custom department via drawer         | Department appears in list            |
| 8    | Edit department name in drawer           | Name updated in list                  |
| 8    | Remove all departments, click "Continue" | Validation error: at least 1 required |

### 5. Finalization Error and Retry

| Step | Action                             | Expected Result                       |
| ---- | ---------------------------------- | ------------------------------------- |
| 12   | Click "Activate Workspace"         | Proceeds to finalizing                |
| 13   | (mock) Edge Function returns error | Falls back to battlefield review      |
| 12   | Verify error message is displayed  | Error banner visible at top of review |
| 12   | Click "Activate Workspace" again   | Retries activation                    |
| 13   | (mock) Edge Function succeeds      | Workspace created, proceeds to invite |

### 6. Invite Email and Copy Link

| Step | Action                                      | Expected Result                       |
| ---- | ------------------------------------------- | ------------------------------------- |
| 14   | Enter valid email and click "Send Invite"   | Success state shown for email channel |
| 14   | Enter invalid email and click "Send Invite" | Validation error shown                |
| 14   | Click "Copy Link"                           | Link copied to clipboard, UI confirms |
| 14   | Enter phone number and click "Send Invite"  | Success state shown for SMS channel   |
| 14   | Click "Enter Dashboard"                     | Proceeds to done step                 |

### 7. Session Resume After Page Refresh

| Step | Action                                 | Expected Result                                  |
| ---- | -------------------------------------- | ------------------------------------------------ |
| 1-7  | Complete steps through season identity | Wizard state saved to onboarding_session         |
| --   | Refresh page                           | Wizard detects existing session                  |
| --   | Wizard resumes                         | Returns to last completed step (season_identity) |
| 8    | Continue from departments              | All previously entered data preserved            |

---

## Acceptance Criteria

### Functional Requirements

- [ ] All 15 wizard steps render and transition correctly in sequence
- [ ] URL input with `?url=` query parameter auto-starts the crawl
- [ ] `gather-workspace-intelligence` Edge Function populates workspace data from URL
- [ ] Crawl failure falls back to Grand Hotel Oslo mock data within 3 seconds
- [ ] Auth step supports both signup and signin with proper Supabase Auth integration
- [ ] Auth step is skipped when user is already authenticated
- [ ] Auth skip option allows proceeding without an account
- [ ] Org verification calls Bronnysundregistrene API with 9-digit org number
- [ ] Org verification displays company name, address, CEO, and industry
- [ ] Branding step captures logo, slogan, brand color, and communication tone
- [ ] Season education is a read-only informational step
- [ ] Season identity supports Permanent and Temporal types with optional date range
- [ ] Department management supports add, remove, toggle, and edit via drawer
- [ ] Industry-recommended departments are offered as suggestion chips
- [ ] Team management is organized per-department with cross-department support
- [ ] Smart team defaults populate based on department type
- [ ] Location management shows main office with address from crawl/org data
- [ ] Procedure management includes urgency badges and department assignment
- [ ] Battlefield review displays summary cards for all configured entities
- [ ] Each review card has an "Edit" link navigating to the correct wizard step
- [ ] "Activate Workspace" calls `activate-workspace` Edge Function
- [ ] `activate_workspace_v3` RPC creates all entities in a single transaction
- [ ] Activation failure returns to battlefield review with error message
- [ ] Invite step supports email, SMS (+47), and shareable link channels
- [ ] Done step shows confetti and redirects to correct dashboard URL per environment

### Non-Functional Requirements

- [ ] Wizard state persists across page refreshes for authenticated users
- [ ] All form inputs have proper client-side validation
- [ ] Loading states are shown during async operations (crawl, auth, activation)
- [ ] Back navigation preserves previously entered data
- [ ] Wizard is responsive and usable on mobile viewports
- [ ] All user-facing text uses i18n keys (no hardcoded Norwegian or English strings)
- [ ] Error states provide actionable recovery options (retry, skip, go back)
- [ ] Keyboard navigation works through all form elements
- [ ] Wizard progress is visually indicated (step indicator / progress bar)
