---
title: "Shift Card Status Indicators & History"
status: draft
updated: 2026-03-24
created: 2026-03-24
module: schedule
tags: [shift, status, confirmation, history, audit-log, ui]
---

# Shift Card Status Indicators & History

## Problem

1. Shift cards show no confirmation status — managers can't see at a glance whether employees have acknowledged their shifts.
2. Error messages for permission denials are generic ("Kunne ikke opprette vakt") instead of telling the user they lack authority. **(Fixed in this session.)**
3. The shift modal's "Historikk" tab is a placeholder — no actual audit trail is visible.
4. The shift modal shows a status badge but no lifecycle timeline — managers can't see when each status transition happened.

## Solution

Three additions, no new DB tables or migrations required:

### 1. Confirmation Indicator on Shift Cards

The DB already has `confirmed_at` and `confirmed_by` columns on `schedule_shift`. These are unmapped to the frontend.

**Card behavior (non-compact view):**

| Shift state                | Icon                                    | Style                                     |
| -------------------------- | --------------------------------------- | ----------------------------------------- |
| Draft / created / assigned | No confirmation icon                    | —                                         |
| Published, unconfirmed     | `Clock`                                 | `text-muted-foreground` (subtle, waiting) |
| Published, confirmed       | `ThumbsUp`                              | `text-emerald-400`                        |
| Active / completed         | `ThumbsUp` if confirmed, nothing if not | Same emerald                              |

**Card behavior (compact view):**

- Confirmed: small emerald dot (2px) next to the time
- Unconfirmed published: small amber dot

The confirmation icon replaces the current `ShiftStatusIcon` position (top-right). The existing status is communicated through card border/background styling (which already works well).

**Compact layout change:** The indicator dot sits right-aligned before the time text.

### 2. Status Timeline in Shift Modal

In edit mode, below the header, render a horizontal step indicator:

```
Opprettet  >  Tildelt  >  Publisert  >  Bekreftet  >  Aktiv  >  Fullført
```

- Steps map to: `created`, `assigned`, `published`, confirmed (`confirmed_at`), `active`, `completed`
- "Bekreftet" is special — it's not a `shift_status` enum value but derived from `confirmed_at` being non-null
- Each completed step shows date below in `text-[10px] text-muted-foreground`
- Current step is highlighted with the status color
- Future steps are muted/dashed

**Data sources for timestamps:**

- `created` = `created_at`
- `assigned` / `published` / `active` / `completed` = derived from audit log entries (status changes)
- `confirmed` = `confirmed_at`

If audit log entries are not available for a past step, show the step as completed but without a date.

### 3. History Tab — Audit Log Timeline

Replace the placeholder "Historikk" tab with a real timeline powered by `schedule_audit_log`.

**Query:** Fetch audit log entries where `table_name = 'schedule_shift'` and `row_id = shiftId`, ordered by `created_at DESC`.

**Display format — vertical timeline:**

```
14:32  Publisert
       Pontus Lindroth
       13. mars 2026

14:30  Tildelt til Ola Nordmann
       Pontus Lindroth
       13. mars 2026

09:15  Opprettet
       Pontus Lindroth
       12. mars 2026
```

Each entry:

- **Time** left-aligned
- **Event description** — human-readable, derived from `operation` + `changed_fields` + `old_data`/`new_data`
- **Actor** — resolve `user_id` to profile name (can use existing employee list from schedule context)
- **Date** — only shown when date changes from previous entry

**Event description mapping:**

| Operation | Changed field        | Description                                |
| --------- | -------------------- | ------------------------------------------ |
| INSERT    | —                    | "Opprettet"                                |
| UPDATE    | status → published   | "Publisert"                                |
| UPDATE    | status → assigned    | "Tildelt"                                  |
| UPDATE    | status → active      | "Aktivert"                                 |
| UPDATE    | status → completed   | "Fullfort"                                 |
| UPDATE    | status → unpublished | "Avpublisert"                              |
| UPDATE    | employee_id          | "Tildelt til {name}" / "Fjernet tildeling" |
| UPDATE    | confirmed_at         | "Bekreftet av {name}"                      |
| UPDATE    | start_time/end_time  | "Tid endret: {old} -> {new}"               |
| UPDATE    | role                 | "Rolle endret: {old} -> {new}"             |
| UPDATE    | notes                | "Notat oppdatert"                          |
| DELETE    | —                    | "Slettet"                                  |

For multi-field updates, show the most significant change (status > employee > time > other).

**Empty state:** If no audit log entries exist (legacy data), show: "Ingen historikk tilgjengelig for denne vakten."

## Files to Change

### Types & Mappers

| File                  | Change                                                             |
| --------------------- | ------------------------------------------------------------------ |
| `schedule-types.ts`   | Add `confirmedAt?: string`, `confirmedBy?: string` to `Shift` type |
| `schedule-mappers.ts` | Map `confirmed_at`, `confirmed_by` in `fromDbShift`                |

### Hooks

| File               | Change                                                                              |
| ------------------ | ----------------------------------------------------------------------------------- |
| `use-shifts.ts`    | No changes needed (already fetches `*`)                                             |
| `use-audit-log.ts` | Already exists with `useAuditLog(tableName, rowId)` — use as-is, no new hook needed |

### Components

| File                       | Change                                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `draggable-card-views.tsx` | Add `confirmedAt` prop to `ShiftCardView`, render confirmation indicator                                                 |
| `grid-cards.tsx`           | Pass `confirmedAt` through `ShiftCard` to `ShiftCardView`                                                                |
| `shift-modal.tsx`          | (1) Add `ShiftStatusTimeline` component in header area, (2) Replace "Historikk" placeholder with real audit log timeline |
| `daily-grid.tsx`           | Pass `confirmedAt` when rendering `ShiftCard` (already passes shift data)                                                |

### No changes needed

- No DB migration — `confirmed_at`, `confirmed_by` already exist
- No new RLS policies — audit log uses existing policies
- No mapper changes for insert/update — confirmation is set by the employee, not by admin form

## Data Flow

```
schedule_shift.confirmed_at (DB)
  -> fromDbShift mapper (add confirmedAt field)
    -> useShifts hook (already fetches *)
      -> GridContent -> ShiftCard -> ShiftCardView (confirmation icon)
      -> ShiftModal (status timeline + historikk tab)

schedule_audit_log (DB)
  -> useShiftAuditLog hook (new)
    -> ShiftModal historikk tab (timeline)
```

## Design Tokens

Uses existing design system tokens:

- Emerald for confirmed: `text-emerald-400`, `bg-emerald-500/10`
- Amber for waiting: `text-amber-400`, `bg-amber-500/10`
- Muted for inactive steps: `text-muted-foreground`
- Timeline connector: `border-border`

## Out of Scope

- Employee-side confirmation UI (mobile app — separate feature)
- Push notifications for unconfirmed shifts
- Bulk confirmation status filtering (can be added later to the existing status filter bar)
- Approval workflow (`approved_at`/`approved_by`) — different from confirmation
