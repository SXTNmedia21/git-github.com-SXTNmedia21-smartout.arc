---
title: Landing Sessions & Leads Design
status: done
updated: 2026-03-03
created: 2026-03-02
module: platform-admin
tags: [landing, sessions, leads, analytics]
---

# Landing Sessions & Leads Design

## Goal

Redesign `/platform-admin/landing` to surface **Leads** alongside existing Sessions, with a unified KPI dashboard.

## Current State

- **Sessions tab** — KPI cards + DataTable + slide-over detail with event timeline (fully functional)
- **Events tab** — flat event list with KPI cards (fully functional)
- **Database** — `landing_event`, `landing_session`, `landing_visitor` tables with proper indexes
- **Visitor system** — cookie-based visitor ID, identity linking via `user_identity_id`, manual tagging via `manual_label`

## Design

### No new database tables

`landing_visitor` already contains everything needed for leads:

- `user_identity_id` + joined `user_identity(full_name, email)` = identified leads
- `manual_label` + `manual_notes` = tagged/manual leads
- `visit_count`, `first_seen`, `last_seen` = engagement signals

### UI Structure

```
┌─────────────────────────────────────────────┐
│ KPI Bar (above tabs)                         │
│ [Sessions Today] [Visitors] [Leads] [Conv%]  │
├─────────────────────────────────────────────┤
│ [Sessions] [Leads] [Events]                  │
├─────────────────────────────────────────────┤
│ Tab content                                  │
└─────────────────────────────────────────────┘
```

### Top-level KPI Bar (4 cards, above all tabs)

| Metric                | Source                                                                               |
| --------------------- | ------------------------------------------------------------------------------------ |
| Sessions today        | count of `landing_session` where `started_at >= today`                               |
| Unique visitors today | distinct `visitor_id` from today's sessions                                          |
| Lead count            | `landing_visitor` where `user_identity_id IS NOT NULL` OR `manual_label IS NOT NULL` |
| Conversion rate       | lead count / total unique visitors                                                   |

### Tab 1: Sessions (existing — unchanged)

Keep current session KPIs, DataTable, and slide-over detail panel.

### Tab 2: Leads (new)

**Definition of a Lead:** A `landing_visitor` with either:

- `user_identity_id` set (they signed up / were linked), OR
- `manual_label` set (admin tagged them)

**Lead table columns:**

- Name/Label — `user_identity.full_name` or `manual_label`
- Email — `user_identity.email` or "—"
- Type — badge: "identified" (green) or "tagged" (amber)
- Visits — `visit_count`
- First seen — `first_seen` relative time
- Last seen — `last_seen` relative time
- Engagement — computed score (0-100)

**Engagement score formula:**

```
score = min(100, (
  visit_count * 10 +
  total_cta_clicks * 15 +
  avg_scroll_depth * 0.3 +
  min(total_duration_seconds / 10, 30)
))
```

**Lead detail sheet (on row click):**

- Lead info card (name, email, label, notes, first/last seen, visit count)
- Tag/edit button (reuse VisitorTagDialog)
- Session history list — all sessions for this visitor, each clickable to expand event timeline

### Tab 3: Events (existing — demoted to 3rd position)

### Data Queries (page.tsx)

New queries added to `Promise.all`:

1. Leads: `landing_visitor` where `user_identity_id IS NOT NULL` OR `manual_label IS NOT NULL`, join `user_identity`, limit 200
2. Lead sessions: aggregate session data per visitor (for engagement score)
3. Total unique visitors (all time, for conversion rate)

### New API Route

`/api/admin/visitor-sessions` — GET with `visitor_id` param, returns all sessions for a visitor (for lead detail sheet).

### New Files

| File               | Purpose                                       |
| ------------------ | --------------------------------------------- |
| `leads-tab.tsx`    | Leads tab content — table + lead detail sheet |
| `lead-columns.tsx` | TanStack Table column definitions for leads   |
| `lead-detail.tsx`  | Sheet showing lead info + session history     |

### Modified Files

| File               | Change                                                                  |
| ------------------ | ----------------------------------------------------------------------- |
| `page.tsx`         | Add lead queries, top-level KPI computation, pass new props             |
| `landing-tabs.tsx` | Add KPI bar above tabs, add Leads tab trigger/content, accept new props |

## Implementation Order

1. Add lead + KPI queries to `page.tsx`
2. Update `landing-tabs.tsx` with KPI bar + Leads tab
3. Create `lead-columns.tsx`
4. Create `leads-tab.tsx`
5. Create `/api/admin/visitor-sessions` route
6. Create `lead-detail.tsx`
7. Typecheck + verify
