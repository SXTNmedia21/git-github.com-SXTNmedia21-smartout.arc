---
title: "User Journeys — Landing Sessions & Leads"
status: done
updated: 2026-03-03
created: 2026-03-03
module: platform-admin
tags: [landing, sessions, leads, analytics, journeys]
---

# User Journeys — Landing Sessions & Leads

This document covers all user journeys for the Leads tab added to the `/platform-admin/landing` page, the top-level KPI bar shared across all tabs, and the lead detail/tagging workflow. All features are godmode-only.

---

## Journey: Godmode Admin Views Landing Overview (KPI Bar + Sessions Tab)

**Precondition:** Admin is logged in with `is_godmode = true` on their `user_identity`. At least one `landing_visitor` and `landing_session` exist in the database. Admin navigates to `/platform-admin/landing`.

### Happy Path

1. Admin opens `/platform-admin/landing` --> System verifies godmode access, loads the landing analytics page --> Admin sees a top-level KPI bar above the tab strip, displaying 4 metrics: Sessions today, Unique visitors, Lead count, and Conversion rate.
2. System computes KPI values server-side from `landing_session` and `landing_visitor` tables --> Sessions today = count of sessions with `created_at` today, Unique visitors = distinct `visitor_id` count today, Lead count = visitors where `user_identity_id IS NOT NULL OR manual_label IS NOT NULL`, Conversion rate = lead count / unique visitors as percentage --> KPI cards render with current values.
3. Admin sees the tab strip below the KPI bar with three tabs: Sessions (default), Events, and Leads --> Sessions tab is active by default.
4. Admin views the Sessions tab --> System renders the sessions DataTable with columns: Visitor (ID + badge), Variant, Duration, Scroll (visual bar), Clicks, Pages, Device icon, Time (relative) --> Sessions ordered by most recent first.
5. Admin scrolls through sessions or uses pagination --> DataTable handles row rendering and page navigation --> Admin can review all recorded sessions.

**Postcondition:** Admin has a high-level overview of today's landing traffic via the KPI bar, and can drill into individual sessions in the Sessions tab. The KPI bar remains visible when switching to other tabs.

**Error paths:**

- No sessions exist today: KPI bar shows 0 for Sessions today and Unique visitors. Lead count and Conversion rate reflect all-time data (not date-scoped). Sessions table shows "No results." empty state.
- Data loading: KPI cards show skeleton placeholders with pulse animation until data resolves.
- Non-godmode user: Covered in Journey 5 below.

---

## Journey: Godmode Admin Views Leads Tab (Table, Filters, Engagement Scores)

**Precondition:** Admin is on `/platform-admin/landing`. At least one `landing_visitor` qualifies as a lead (has `user_identity_id` set OR `manual_label` set).

### Happy Path

1. Admin clicks the "Leads" tab in the tab strip --> System switches active tab to Leads --> System fetches lead data from `landing_visitor` filtered to rows where `user_identity_id IS NOT NULL OR manual_label IS NOT NULL`, joined with `user_identity` for identified leads and aggregated session metrics.
2. Admin sees the Leads DataTable with columns: Name/Label, Email, Type (badge), Visits, First seen, Last seen, Engagement score --> Table is sorted by most recent activity (last seen) by default.
3. Name/Label column shows: the user's name from `user_identity` for identified leads, or the `manual_label` value for tagged leads --> If both exist, the user identity name takes precedence.
4. Type column shows a badge: "identified" (green) for leads with `user_identity_id`, or "tagged" (amber) for leads with only `manual_label` set.
5. Visits column shows the `visit_count` from `landing_visitor` --> Indicates how many times this lead has returned to the landing page.
6. First seen and Last seen columns show `first_seen` and `last_seen` timestamps from `landing_visitor` --> Displayed as relative time (e.g., "2 days ago") or absolute date depending on recency.
7. Engagement score column shows a computed numeric score --> Formula weighs: visit count, CTA click count across sessions, average scroll depth, and total duration --> Higher scores indicate more engaged leads.
8. Admin can sort columns by clicking headers --> DataTable supports sorting on all columns.

**Postcondition:** Admin has a prioritized view of all identified and tagged leads with engagement metrics, enabling them to focus outreach on the most engaged prospects.

**Error paths:**

- No leads exist: Table shows "No results." empty state. A hint message may suggest tagging visitors from the Sessions tab.
- Lead has no sessions (edge case -- visitor record exists but all sessions deleted): Visits shows 0, engagement score shows 0, first/last seen may be null.
- Engagement score is 0: Displayed as "0" -- indicates the lead was tagged manually but has minimal tracked interaction.

---

## Journey: Godmode Admin Opens Lead Detail (Row Click, Session History, Tag Editing)

**Precondition:** Admin is on the Leads tab with at least one lead visible in the table.

### Happy Path

1. Admin clicks a lead row in the Leads DataTable --> System opens a detail sheet (sliding panel from right) --> System fetches full lead data and session history via `GET /api/admin/visitor-sessions` with the lead's `visitor_id`.
2. Admin sees a Lead Info card at the top of the sheet --> For identified leads: name, email from `user_identity`, plus the "identified" badge --> For tagged leads: `manual_label`, `manual_notes`, tagged_by admin name, tagged_at timestamp, plus the "tagged" badge.
3. Admin sees a "Tag / Edit" button below the lead info card --> Allows adding or modifying the manual label and notes (see Journey 4 for details).
4. Admin scrolls down to Session History section --> System renders a chronological list of all `landing_session` rows for this visitor --> Each session entry shows: date/time, duration, scroll depth, click count, device type, and referrer.
5. Admin can review the full interaction history to understand the lead's engagement pattern --> Sessions ordered by most recent first --> Older sessions appear further down the list.
6. Admin closes the detail sheet by clicking outside, pressing Escape, or clicking the X button --> Sheet slides closed, returning to the Leads table.

**Postcondition:** Admin has full visibility into a lead's identity, engagement history, and all past sessions. They can make informed decisions about outreach timing and approach.

**Error paths:**

- Session history API fails: Sheet shows the lead info card but session history section displays an error or empty state with a retry option.
- Lead has many sessions (>50): Session list may be long. Pagination or virtual scrolling handles performance.
- Lead was deleted between table load and row click: API returns 404. Sheet shows error state.

---

## Journey: Godmode Admin Tags a Visitor as Lead (Manual Label/Notes)

**Precondition:** Admin is viewing a lead detail sheet (from Journey 3) or a session detail sheet for an anonymous/returning visitor that has no `user_identity_id` linked. The visitor is not yet tagged, OR the admin wants to edit an existing tag.

### Happy Path -- New Tag

1. Admin sees "Tag Visitor" button in the detail sheet --> Clicks it --> A dialog opens with two fields: Label (text input, required) and Notes (textarea, optional).
2. Admin types a label, e.g., "Maria, Hotell Bjornen" --> Optionally adds notes: "Called about onboarding module, 15 employees" --> Clicks "Save Tag".
3. System POSTs to `/api/admin/tag-visitor` with `visitor_id`, `label`, and `notes` --> Server validates: label is required and max 200 characters --> Server updates `landing_visitor`: sets `manual_label`, `manual_notes`, `tagged_by` (admin's user ID), `tagged_at` (current timestamp) --> Returns success.
4. Dialog closes --> The visitor now qualifies as a lead (`manual_label IS NOT NULL`) --> Detail sheet updates to show the new tag info --> In the Leads tab table, this visitor now appears as a row with the "tagged" (amber) badge.

### Happy Path -- Edit Existing Tag

1. Admin sees "Edit Tag" button (shown instead of "Tag Visitor" when `manual_label` already exists) --> Clicks it --> Dialog opens pre-filled with the current label and notes values.
2. Admin modifies the label or notes --> Clicks "Save Tag" --> Same API call and validation as above --> Server overwrites previous tag values, updates `tagged_by` and `tagged_at` to reflect the latest edit.
3. Dialog closes --> Updated label and notes visible in the detail sheet and Leads table.

**Postcondition:** `landing_visitor` has `manual_label`, `manual_notes`, `tagged_by`, and `tagged_at` set. The visitor appears in the Leads tab across all their sessions. Tag is visible in both session detail and lead detail views.

**Error paths:**

- Empty label submitted: Save button is disabled when label input is empty. Cannot submit without a label.
- Label exceeds 200 characters: Server-side validation rejects the request. Dialog shows validation error. Admin must shorten the label.
- API call fails (network error, server error): Dialog stays open. Error toast shown. Admin can retry.
- Visitor already identified (has `user_identity_id`): Tagging is still allowed -- manual label serves as a supplementary note. The "identified" badge takes visual precedence over "tagged" in the type column.
- Concurrent edit: If two admins tag the same visitor simultaneously, last write wins. No conflict resolution.

---

## Journey: Non-Godmode User Attempts Access (Redirect)

**Precondition:** User is logged in but does NOT have `is_godmode = true` on their `user_identity`. User attempts to access `/platform-admin/landing` directly (via URL bar, bookmark, or shared link).

### Path

1. User navigates to `/platform-admin/landing` --> System checks `user_identity.is_godmode` during page load or middleware check.
2. System determines user lacks godmode access --> User is redirected to `/dashboard` (their normal workspace dashboard).
3. User lands on `/dashboard` --> No error message shown. The platform-admin section is simply inaccessible.

**Postcondition:** Non-godmode user never sees the landing analytics page, leads tab, or any platform-admin data. They are silently redirected to their authorized area.

**Error paths:**

- User is not logged in at all: Redirected to login page (`/login` or auth flow), not to `/dashboard`.
- User has godmode but no active session (expired token): Redirected to login. After re-authentication, godmode access is restored and they can access `/platform-admin/landing`.
- Direct API access without godmode: API routes under `/api/admin/*` return 401/403 for non-godmode users. No data is leaked.

---

## Data Model Summary

| Concept           | Source                                         | Lead Qualifier                              |
| ----------------- | ---------------------------------------------- | ------------------------------------------- |
| Identified lead   | `landing_visitor.user_identity_id IS NOT NULL` | Visitor linked to a Smartout user account   |
| Tagged lead       | `landing_visitor.manual_label IS NOT NULL`     | Visitor manually labeled by a godmode admin |
| Anonymous visitor | Neither qualifier met                          | Not shown in Leads tab                      |

**Engagement Score Formula:**

The engagement score is a weighted composite of:

- Visit count (repeat visits indicate interest)
- CTA click count across all sessions (intent signal)
- Average scroll depth across sessions (content consumption)
- Total duration across sessions (time investment)

Higher scores surface the most engaged leads at the top of the table when sorted by engagement.

**Key API Route:**

- `GET /api/admin/visitor-sessions` -- Returns session history for a specific visitor, used by the lead detail sheet.
