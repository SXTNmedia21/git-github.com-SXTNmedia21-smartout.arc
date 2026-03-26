---
title: "Admin Shift Visibility — Real-time Operations Control"
status: draft
created: 2026-03-26
updated: 2026-03-26
module: shift-clock
tags: [shift-clock, notifications, activity-trail, reconciliation, lateness, admin]
---

# Admin Shift Visibility — Real-time Operations Control

## Summary

Five modules that give admin/managers full real-time visibility into employee shift operations. Closes the gap between "employee punches in" and "admin knows about it."

**What exists:** LeaderOverview (live cards), shift_approval table, telemetry events writing to activity_trail.
**What's missing:** Lateness detection, shift clock notifications, live activity feed, dashboard widget, reconciliation DB persistence.

---

## Module 1: Lateness Detection

### Problem

If Anna's shift starts at 15:00 and she doesn't punch in, nothing happens.

### Design

A cron Edge Function `shift-lateness-check` runs every 5 minutes.

1. Query `schedule_shift WHERE status = 'published' AND shift_date = today AND start_time < now() - interval '{threshold} min'`
2. LEFT JOIN `timesheet.time_entry` on `shift_id`
3. Where `time_entry IS NULL` → employee hasn't punched in
4. For each late shift:
   - Insert `guardian_signal` with `signal_type = 'shift_late'`, `severity = 'warning'`, `entity_type = 'schedule_shift'`, `entity_id = shift_id`, `data = { employee_name, minutes_late, department, shift_start }`
   - Insert notification outbox entry (Module 2) for managers via service role client
5. Escalation: if `3 × threshold` minutes pass → update signal severity to `'critical'`, fire second notification (`shift.no_show`)

**Grace period:** Configurable per workspace via `shift_clock_config.late_threshold_minutes` (default 10).

**Idempotency:** Skip shifts that already have a `guardian_signal` WHERE `entity_type = 'schedule_shift' AND entity_id = shift_id AND signal_type = 'shift_late' AND created_at >= today`.

### Migration

File: `supabase/migrations/20260326120000_add_late_threshold.sql`

```sql
ALTER TABLE shift_clock_config
ADD COLUMN late_threshold_minutes integer NOT NULL DEFAULT 10;

COMMENT ON COLUMN shift_clock_config.late_threshold_minutes
IS 'Minutes after shift start before lateness alert fires. Default 10.';
```

### Edge Function

File: `supabase/functions/shift-lateness-check/index.ts`

- Auth: bearer token = `WATCHDOG_CRON_SECRET`, `verify_jwt = false`
- Client: `SUPABASE_SERVICE_ROLE_KEY` (service role, needed for cross-schema timesheet query + notification outbox insert)
- Add to `supabase/functions/config.toml`: `[functions.shift-lateness-check]` with `verify_jwt = false`

### Telemetry

Events follow existing `"entity verb"` convention:

```typescript
interface ShiftLateDetected extends BaseEvent {
  event: "shift late_detected";
  properties: { entity: EntityRef; data: { minutes_late: number; threshold: number } };
}
interface ShiftNoShowEscalated extends BaseEvent {
  event: "shift no_show_escalated";
  properties: { entity: EntityRef; data: { minutes_late: number } };
}
```

Add `"late_detected"` and `"no_show_escalated"` to `ActionVerb` union in `registry.ts`.

Registry metadata:

```typescript
"shift late_detected": { destinations: ["posthog", "logger", "activity_trail", "engine_event"], category: "operations" },
"shift no_show_escalated": { destinations: ["posthog", "logger", "activity_trail", "engine_event"], category: "operations" },
```

### No hardcoded Norwegian text

The Edge Function does NOT write Norwegian text to `schedule_shift.notes`. Instead, the lateness is expressed only through structured data in `guardian_signal.data` and the notification system (which uses i18n keys).

---

## Module 2: Shift Clock Notifications

### Problem

No notification reaches the manager when employees punch in/out, are late, or request ad-hoc shifts.

### Design

Add 5 events to `packages/notifications/src/event-config.ts`:

| Event key             | Recipient                    | Priority | Channels            | Action URL               |
| --------------------- | ---------------------------- | -------- | ------------------- | ------------------------ |
| `shift.punched_in`    | department managers          | 0        | in_app              | `/dashboard/shift-clock` |
| `shift.punched_out`   | department managers          | 0        | in_app              | `/dashboard/shift-clock` |
| `shift.late`          | department managers + admins | 2        | push, in_app, email | `/dashboard/shift-clock` |
| `shift.no_show`       | department managers + admins | 2        | push, in_app, email | `/dashboard/shift-clock` |
| `shift.adhoc_pending` | department managers          | 1        | push, in_app        | `/dashboard/shift-clock` |

### i18n keys

Add to `packages/i18n/locales/nb/notifications.json` (create if needed):

| Key                                       | Norwegian text                                           |
| ----------------------------------------- | -------------------------------------------------------- |
| `notifications.shift.punched_in.title`    | `Stemplet inn`                                           |
| `notifications.shift.punched_in.body`     | `{name} har stemplet inn — {role}, {department}`         |
| `notifications.shift.punched_out.title`   | `Stemplet ut`                                            |
| `notifications.shift.punched_out.body`    | `{name} har stemplet ut — {hours}t arbeidet`             |
| `notifications.shift.late.title`          | `Sen ankomst`                                            |
| `notifications.shift.late.body`           | `{name} har ikke stemplet inn — {minutes} min forsinket` |
| `notifications.shift.no_show.title`       | `Ikke mott opp`                                          |
| `notifications.shift.no_show.body`        | `{name} har ikke mott til {role}-vakt ({start_time})`    |
| `notifications.shift.adhoc_pending.title` | `Ad-hoc vakt krever godkjenning`                         |
| `notifications.shift.adhoc_pending.body`  | `{name} har startet en ad-hoc vakt`                      |

### Audience resolution — new `department` audience type

Add to `packages/notifications/src/audiences.ts`:

```typescript
case "department": {
  const { data } = await supabase
    .from("profile")
    .select("profile_id")
    .eq("workspace_id", filter.workspace_id)
    .eq("department_id", filter.department_id)
    .in("role", ["manager", "admin", "owner"])
    .eq("is_active", true);
  return (data ?? []).map(p => p.profile_id);
}
```

Extend `AudienceFilter` type with `{ type: "department"; workspace_id: string; department_id: string }`.

### Trigger points

| Event                 | Triggered from                                  | Client type   |
| --------------------- | ----------------------------------------------- | ------------- |
| `shift.punched_in`    | `useShiftClock.ts` punchIn `onSuccess`          | JWT (browser) |
| `shift.punched_out`   | `useShiftClock.ts` punchOut `onSuccess`         | JWT (browser) |
| `shift.late`          | `shift-lateness-check` Edge Function            | Service role  |
| `shift.no_show`       | `shift-lateness-check` Edge Function            | Service role  |
| `shift.adhoc_pending` | `useShiftClock.ts` createAdhocShift `onSuccess` | JWT (browser) |

### Grouping

`shift.punched_in` and `shift.punched_out` use `grouping_window_sec: 300` (5 min batch) to avoid spamming managers when multiple employees punch in at shift start.

---

## Module 3: Live Activity Feed

### Problem

`ActivityView.tsx` uses `Math.random()` mock data.

### Design

**Data hook:** Create `apps/web/src/app/dashboard/_hooks/use-activity-feed.ts`

```typescript
type ActivityFeedFilters = {
  category?: "scheduling" | "operations" | "training" | "all";
  timeRange?: "today" | "7d" | "30d";
  actorProfileId?: string;
};

export function useActivityFeed(
  workspaceId: string,
  options: { limit: number; offset: number; filters: ActivityFeedFilters },
);
```

Query: `activity_trail` ordered by `created_at DESC`, filtered by workspace + optional category/time/actor.

**Realtime:** Subscribe to `postgres_changes` on `activity_trail` WHERE `workspace_id = X`. Verify RLS permits authenticated users to subscribe (existing JWT read policy on `activity_trail` should suffice — confirm before implementing).

**UI:** Replace mock heatmap in `ActivityView.tsx` with chronological event feed. Each entry: timestamp, avatar, name, event description, department, optional warning indicator for lateness.

### Mobile parity note

`use-activity-feed.ts` lives in `apps/web/` for now. If mobile needs the same feed, extract to `packages/`. The query is standard Supabase — no web-specific dependencies.

---

## Module 4: Dashboard Shift Widget

### Problem

Main dashboard shows no live shift status.

### Design

**Component:** `ShiftStatusWidget` — compact card showing:

- Summary: "5 pa vakt · 1 pa pause · 3 venter"
- List: max 8 entries (name, role, duration or "starter HH:MM" or "X min sen")
- "Se alle" link → `/dashboard/shift-clock`

**Data hook:** Create `packages/shift-clock/src/use-live-shifts.ts` (new package, or add to existing `packages/schedule/`).

The hook queries:

1. `schedule_shift WHERE shift_date = today AND status IN ('published', 'active') AND workspace_id = X`
2. LEFT JOIN `timesheet.time_entry` on `shift_id` WHERE `status = 'clocked_in'`
3. Returns categorized: `{ clockedIn: [], onBreak: [], waiting: [], late: [] }`

**Realtime:** Subscribe to `timesheet.time_entry` changes. Note: `time_entry` is in `timesheet` schema — verify that Supabase realtime supports non-`public` schema subscriptions (LeaderOverview already does this successfully at lines 210-233, so the pattern is confirmed working).

**Placement:** New card in `TacticalView.tsx` alongside existing KPI cards.

**Mobile parity:** Data hook in `packages/` enables mobile consumption. UI component is web-only (mobile has its own shift clock screens).

---

## Module 5: Reconciliation DB Persistence

### Problem

`ReconciliationView.tsx` "Godkjenn dag" button writes nothing to DB.

### Design

Wire existing mutations from `/dashboard/reconciliation/_hooks/useReconciliation.ts`.

**Available hooks (verified):**

- `useApproveShiftHours(reconciliationId)` — writes to `shift_approval`
- `useRejectReconciliation()` — sets reconciliation status to disputed (NOT `useDisputeShift` — that doesn't exist)

**Data dependency:** `shift_approval` requires `reconciliation_id` (NOT NULL FK). `ReconciliationView.tsx` must first resolve today's `daily_reconciliation` for the active department. If none exists, create one via an `ensureReconciliation` mutation:

```typescript
// Upsert: find or create daily_reconciliation for department + today
const { data } = await supabase
  .from("daily_reconciliation")
  .upsert(
    {
      workspace_id,
      department_id,
      reconciliation_date: today,
      status: "pending",
    },
    { onConflict: "workspace_id,department_id,reconciliation_date" },
  )
  .select("reconciliation_id")
  .single();
```

**Changes to `ReconciliationView.tsx`:**

1. Remove local `useState` for approval tracking
2. Add `ensureReconciliation` query on mount
3. "Godkjenn dag" → for each shift, call `useApproveShiftHours(reconciliationId)` with `approved_hours = calculated_hours`
4. "Disputer" → call `useRejectReconciliation(reconciliationId)` with justification text
5. Emit telemetry: `"reconciliation approved"`, `"reconciliation rejected"` (already exist in registry)

**No schema changes needed.**

---

## Implementation Order

| Phase | Module                                            | Dependencies | Effort |
| ----- | ------------------------------------------------- | ------------ | ------ |
| 1     | Module 5: Reconciliation DB                       | None         | Small  |
| 2     | Module 2: Notifications (event-config + audience) | None         | Medium |
| 3     | Module 1: Lateness Detection                      | Module 2     | Medium |
| 4     | Module 3: Activity Feed                           | None         | Medium |
| 5     | Module 4: Dashboard Widget                        | None         | Small  |

Modules 3-5 can be built in parallel after Module 2 ships.

## Out of Scope

- No-show auto-cancellation
- Payroll calculation engine
- Mobile push delivery infrastructure testing
- Employee-facing lateness excuses
- GPS tracking history visualization
