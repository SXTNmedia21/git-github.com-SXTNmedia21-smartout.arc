---
title: "Admin Shift Visibility Implementation Plan"
status: draft
created: 2026-03-26
updated: 2026-03-26
module: shift-clock
tags: [shift-clock, notifications, activity-trail, reconciliation, implementation]
---

# Admin Shift Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give admin/managers real-time visibility into employee shift operations — lateness alerts, punch notifications, live activity feed, dashboard widget, and reconciliation persistence.

**Architecture:** 5 independent modules. Module 5 (reconciliation) is a quick wire-up of existing hooks. Module 2 (notifications) adds event configs + audience type. Module 1 (lateness) is a cron Edge Function. Modules 3-4 are UI components with data hooks.

**Tech Stack:** Supabase Edge Functions (Deno), TanStack Query v5, Supabase Realtime, `@smartout/notifications`, `@smartout/telemetry`, shadcn/ui

**Spec:** `docs/superpowers/specs/2026-03-26-admin-shift-visibility-design.md`

---

## File Map

### New files

| File                                                        | Responsibility                                                     |
| ----------------------------------------------------------- | ------------------------------------------------------------------ |
| `supabase/migrations/20260326120000_add_late_threshold.sql` | Add `late_threshold_minutes` to `shift_clock_config`               |
| `supabase/functions/shift-lateness-check/index.ts`          | Cron: detect late employees, fire guardian signals + notifications |
| `packages/notifications/src/audiences-department.ts`        | Department-scoped audience resolver                                |
| `apps/web/src/app/dashboard/_hooks/use-activity-feed.ts`    | Activity trail data hook                                           |
| `apps/web/src/app/dashboard/_hooks/use-live-shifts.ts`      | Live shift status data hook (clocked in/break/waiting/late)        |
| `apps/web/src/components/dashboard/ShiftStatusWidget.tsx`   | Compact live shift card for tactical dashboard                     |

### Modified files

| File                                                       | Change                                                |
| ---------------------------------------------------------- | ----------------------------------------------------- |
| `packages/notifications/src/event-config.ts`               | Add 5 shift clock notification events                 |
| `packages/notifications/src/audiences.ts`                  | Add `department` case to `AudienceFilter` + switch    |
| `packages/notifications/src/types.ts`                      | Extend `AudienceFilter` type with department variant  |
| `packages/telemetry/src/registry.ts`                       | Add 2 lateness events + extend ActionVerb             |
| `packages/i18n/locales/nb/notifications.json`              | Add 10 i18n keys for shift notifications              |
| `apps/web/src/hooks/shift-clock/useShiftClock.ts`          | Add `insertOutboxNotification()` calls on punch/adhoc |
| `apps/web/src/components/dashboard/ReconciliationView.tsx` | Wire DB mutations, remove local state                 |
| `apps/web/src/components/dashboard/ActivityView.tsx`       | Replace mock data with real activity_trail feed       |
| `apps/web/src/components/dashboard/TacticalView.tsx`       | Add ShiftStatusWidget                                 |
| `supabase/functions/config.toml`                           | Add `shift-lateness-check` with `verify_jwt = false`  |
| `packages/supabase/src/database.types.ts`                  | Regenerate after migration                            |

---

## Task 1: Reconciliation DB Persistence (Module 5)

**Files:**

- Modify: `apps/web/src/components/dashboard/ReconciliationView.tsx`

- [ ] **Step 1: Read the current ReconciliationView**

Read `apps/web/src/components/dashboard/ReconciliationView.tsx` fully. Identify all `useState` calls for approval state (`ShiftDecisions`, `HandoffDraft`), all "Godkjenn" and "Disputer" button handlers, and the `useDepartmentShifts` data source.

- [ ] **Step 2: Add imports for reconciliation hooks**

Add at top of file:

```typescript
import {
  useApproveShiftHours,
  useRejectReconciliation,
  useReconciliationDetail,
} from "@/app/dashboard/reconciliation/_hooks/useReconciliation";
import { createClient } from "@smartout/supabase/client";
```

- [ ] **Step 3: Add ensureReconciliation helper**

Inside the component, add a mutation that upserts today's `daily_reconciliation`:

```typescript
const ensureReconciliation = useMutation({
  mutationFn: async (departmentId: string) => {
    const supabase = createClient();
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("daily_reconciliation")
      .upsert(
        {
          workspace_id: workspace.workspace_id,
          department_id: departmentId,
          reconciliation_date: today,
          status: "pending",
        },
        { onConflict: "workspace_id,department_id,reconciliation_date" },
      )
      .select("reconciliation_id")
      .single();
    if (error) throw error;
    return data.reconciliation_id;
  },
});
```

- [ ] **Step 4: Wire "Godkjenn dag" to real mutation**

Replace the local state update in the "Godkjenn" handler with:

```typescript
const handleApproveDay = async (departmentId: string, shifts: DepartmentShiftDetail[]) => {
  const reconciliationId = await ensureReconciliation.mutateAsync(departmentId);
  for (const shift of shifts) {
    await approveShiftHours.mutateAsync({
      approvalId: shift.approvalId, // or create if needed
      approvedHours: shift.calculatedHours,
      profileId: profileId!,
    });
  }
  toast.success("Dag godkjent");
};
```

- [ ] **Step 5: Wire "Disputer" to real mutation**

Replace the local state update with:

```typescript
const handleDispute = async (departmentId: string, reason: string) => {
  const reconciliationId = await ensureReconciliation.mutateAsync(departmentId);
  await rejectReconciliation.mutateAsync({ reconciliationId, reason });
  toast.success("Disputert");
};
```

- [ ] **Step 6: Remove dead local state**

Remove the `useState<Record<string, ShiftStatus>>` and `useState<HandoffDraft>` that are no longer used. Keep any UI state that's still needed (drawer open/close, etc).

- [ ] **Step 7: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: 0 errors

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/dashboard/ReconciliationView.tsx
git commit -m "feat(reconciliation): wire dashboard approval to shift_approval DB mutations

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Notification Event Config (Module 2a)

**Files:**

- Modify: `packages/notifications/src/event-config.ts`
- Modify: `packages/notifications/src/types.ts`
- Create or modify: `packages/i18n/locales/nb/notifications.json`

- [ ] **Step 1: Add 5 events to event-config.ts**

Add after the existing `"shift.updated"` entry in `NOTIFICATION_EVENTS`:

```typescript
"shift.punched_in": {
  event_key: "shift.punched_in",
  mode: "work",
  default_priority: 0,
  group_key_template: "punch:{department_id}:{date}",
  title_key: "notifications.shift.punched_in.title",
  body_key: "notifications.shift.punched_in.body",
  action_url_template: "/dashboard/shift-clock",
  icon_type: "shift",
  allowed_channels: ["in_app"],
  grouping_window_sec: 300,
  admin_overridable: true,
},
"shift.punched_out": {
  event_key: "shift.punched_out",
  mode: "work",
  default_priority: 0,
  group_key_template: "punch:{department_id}:{date}",
  title_key: "notifications.shift.punched_out.title",
  body_key: "notifications.shift.punched_out.body",
  action_url_template: "/dashboard/shift-clock",
  icon_type: "shift",
  allowed_channels: ["in_app"],
  grouping_window_sec: 300,
  admin_overridable: true,
},
"shift.late": {
  event_key: "shift.late",
  mode: "work",
  default_priority: 2,
  group_key_template: null,
  title_key: "notifications.shift.late.title",
  body_key: "notifications.shift.late.body",
  action_url_template: "/dashboard/shift-clock",
  icon_type: "deviation",
  allowed_channels: ["push", "in_app", "email"],
  grouping_window_sec: 0,
  admin_overridable: false,
},
"shift.no_show": {
  event_key: "shift.no_show",
  mode: "work",
  default_priority: 2,
  group_key_template: null,
  title_key: "notifications.shift.no_show.title",
  body_key: "notifications.shift.no_show.body",
  action_url_template: "/dashboard/shift-clock",
  icon_type: "deviation",
  allowed_channels: ["push", "in_app", "email"],
  grouping_window_sec: 0,
  admin_overridable: false,
},
"shift.adhoc_pending": {
  event_key: "shift.adhoc_pending",
  mode: "work",
  default_priority: 1,
  group_key_template: null,
  title_key: "notifications.shift.adhoc_pending.title",
  body_key: "notifications.shift.adhoc_pending.body",
  action_url_template: "/dashboard/shift-clock",
  icon_type: "approval",
  allowed_channels: ["push", "in_app"],
  grouping_window_sec: 0,
  admin_overridable: false,
},
```

- [ ] **Step 2: Add i18n keys**

Add to `packages/i18n/locales/nb/notifications.json` (create file if it doesn't exist):

```json
{
  "shift.punched_in.title": "Stemplet inn",
  "shift.punched_in.body": "{name} har stemplet inn — {role}, {department}",
  "shift.punched_out.title": "Stemplet ut",
  "shift.punched_out.body": "{name} har stemplet ut — {hours}t arbeidet",
  "shift.late.title": "Sen ankomst",
  "shift.late.body": "{name} har ikke stemplet inn — {minutes} min forsinket",
  "shift.no_show.title": "Ikke møtt opp",
  "shift.no_show.body": "{name} har ikke møtt til {role}-vakt ({start_time})",
  "shift.adhoc_pending.title": "Ad-hoc vakt krever godkjenning",
  "shift.adhoc_pending.body": "{name} har startet en ad-hoc vakt"
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @smartout/notifications typecheck`

- [ ] **Step 4: Commit**

```bash
git add packages/notifications/src/event-config.ts packages/i18n/locales/nb/notifications.json
git commit -m "feat(notifications): add 5 shift clock notification events with i18n

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Department Audience Resolver (Module 2b)

**Files:**

- Modify: `packages/notifications/src/types.ts`
- Modify: `packages/notifications/src/audiences.ts`

- [ ] **Step 1: Extend AudienceFilter type**

In `packages/notifications/src/types.ts`, add to the `AudienceFilter` union:

```typescript
| { type: "department"; workspaceId: string; departmentId: string }
```

- [ ] **Step 2: Add department case to resolveAudience**

In `packages/notifications/src/audiences.ts`, add in the switch:

```typescript
case "department": {
  const { data } = await adminClient
    .from("profile")
    .select("profile_id, display_name, user_id")
    .eq("workspace_id", filter.workspaceId)
    .eq("department_id", filter.departmentId)
    .in("role", ["manager", "admin", "owner"])
    .eq("is_active", true);
  return (data ?? []).map((p) => ({
    profileId: p.profile_id,
    displayName: p.display_name,
    userId: p.user_id,
  }));
}
```

- [ ] **Step 3: Add department case to countAudience**

Same pattern but using `select("*", { count: "exact", head: true })`.

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @smartout/notifications typecheck`

- [ ] **Step 5: Commit**

```bash
git add packages/notifications/src/types.ts packages/notifications/src/audiences.ts
git commit -m "feat(notifications): add department-scoped audience resolver

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Wire Punch Notifications (Module 2c)

**Files:**

- Modify: `apps/web/src/hooks/shift-clock/useShiftClock.ts`

- [ ] **Step 1: Add notification import**

Add at top:

```typescript
import { insertOutboxNotification } from "@smartout/notifications/client";
```

- [ ] **Step 2: Add notification after punch-in**

In the `punchInMutation` `onSuccess` handler (after the existing `emit()` call), add:

```typescript
// Notify department managers
if (departmentId) {
  void insertOutboxNotification(supabase, {
    event_key: "shift.punched_in",
    workspace_id: workspaceId,
    data: { name: displayName, role: shiftRole, department: departmentName },
    audience: { type: "department", workspaceId, departmentId },
  });
}
```

Note: `insertOutboxNotification` is fire-and-forget (`void`) — don't await it in the mutation critical path.

- [ ] **Step 3: Add notification after punch-out**

Same pattern in `punchOutMutation` with event_key `"shift.punched_out"`.

- [ ] **Step 4: Add notification for adhoc pending**

In `createAdhocShiftMutation` `onSuccess`, if `adhocRequiresApproval`:

```typescript
if (adhocRequiresApproval && departmentId) {
  void insertOutboxNotification(supabase, {
    event_key: "shift.adhoc_pending",
    workspace_id: workspaceId,
    data: { name: displayName },
    audience: { type: "department", workspaceId, departmentId },
  });
}
```

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter web typecheck`

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/hooks/shift-clock/useShiftClock.ts
git commit -m "feat(shift-clock): send notifications to managers on punch in/out and adhoc

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Lateness Detection Edge Function (Module 1)

**Files:**

- Create: `supabase/migrations/20260326120000_add_late_threshold.sql`
- Create: `supabase/functions/shift-lateness-check/index.ts`
- Modify: `supabase/functions/config.toml`
- Modify: `packages/telemetry/src/registry.ts`
- Modify: `packages/supabase/src/database.types.ts` (regenerate)

- [ ] **Step 1: Create migration**

```sql
-- supabase/migrations/20260326120000_add_late_threshold.sql
ALTER TABLE shift_clock_config
ADD COLUMN late_threshold_minutes integer NOT NULL DEFAULT 10;

COMMENT ON COLUMN shift_clock_config.late_threshold_minutes
IS 'Minutes after shift start before lateness alert fires. Default 10.';
```

- [ ] **Step 2: Run migration**

```bash
docker exec -i supabase_db_smartout.ai psql -U postgres < /home/sxtnl/dev/smartout.ai/supabase/migrations/20260326120000_add_late_threshold.sql
```

- [ ] **Step 3: Regenerate types**

```bash
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
```

- [ ] **Step 4: Add telemetry events to registry.ts**

Add `"late_detected"` and `"no_show_escalated"` to `ActionVerb` union. Add event interfaces:

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

Add registry metadata entries with destinations: `["posthog", "logger", "activity_trail", "engine_event"]`, category: `"operations"`.

- [ ] **Step 5: Add config.toml entry**

Add to `supabase/functions/config.toml`:

```toml
[functions.shift-lateness-check]
verify_jwt = false
```

- [ ] **Step 6: Create Edge Function**

Create `supabase/functions/shift-lateness-check/index.ts`:

Key logic:

1. Auth: check `Authorization: Bearer {WATCHDOG_CRON_SECRET}`
2. Create service role client
3. For each workspace with `shift_clock_config`:
   - Get `late_threshold_minutes` (default 10)
   - Query published shifts for today where `start_time < now() - threshold` AND no matching `time_entry`
   - For each late shift, check idempotency: `guardian_signal WHERE entity_type = 'schedule_shift' AND entity_id = shift_id AND signal_type = 'shift_late' AND created_at >= today`
   - If no existing signal: insert `guardian_signal` + insert notification outbox (`shift.late` or `shift.no_show` if `>= 3× threshold`)
4. Return `{ checked: N, late: N, no_show: N }`

Follow the exact pattern from `supabase/functions/watchdog-integrity/index.ts` for auth and client setup.

- [ ] **Step 7: Typecheck telemetry**

Run: `pnpm --filter @smartout/telemetry typecheck`

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260326120000_add_late_threshold.sql supabase/functions/shift-lateness-check/ supabase/functions/config.toml packages/telemetry/src/registry.ts packages/supabase/src/database.types.ts
git commit -m "feat(shift-clock): add lateness detection Edge Function with guardian signals

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Live Activity Feed (Module 3)

**Files:**

- Create: `apps/web/src/app/dashboard/_hooks/use-activity-feed.ts`
- Modify: `apps/web/src/components/dashboard/ActivityView.tsx`

- [ ] **Step 1: Create use-activity-feed.ts**

```typescript
type ActivityFeedFilters = {
  category?: "scheduling" | "operations" | "training" | "all";
  timeRange?: "today" | "7d" | "30d";
  actorProfileId?: string;
};

type ActivityEntry = {
  id: string;
  event: string;
  actorName: string;
  actorProfileId: string;
  description: string;
  createdAt: string;
  category: string;
  severity?: "info" | "warning" | "critical";
};

export function useActivityFeed(
  workspaceId: string,
  options: { limit: number; filters: ActivityFeedFilters },
);
```

Query `activity_trail` ordered by `created_at DESC`, filtered by workspace. Join `profile` on `actor_id` for display name. Support optional category/time filters.

Add realtime subscription: `supabase.channel('activity-feed').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_trail', filter: 'workspace_id=eq.{workspaceId}' }, () => refetch())`.

- [ ] **Step 2: Replace mock data in ActivityView.tsx**

Remove `generateHeatmapData()` and `LOCATION_LABELS`. Replace with:

```typescript
const { data: feed, isLoading } = useActivityFeed(workspace.workspace_id, {
  limit: 50,
  filters: { timeRange: "today" },
});
```

Render as a chronological list:

- Each entry: `[HH:MM] Avatar Name — event description`
- Warning entries (lateness) highlighted with orange indicator
- Loading skeleton while fetching

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter web typecheck`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/_hooks/use-activity-feed.ts apps/web/src/components/dashboard/ActivityView.tsx
git commit -m "feat(dashboard): replace mock activity view with live activity_trail feed

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Dashboard Shift Widget (Module 4)

**Files:**

- Create: `apps/web/src/app/dashboard/_hooks/use-live-shifts.ts`
- Create: `apps/web/src/components/dashboard/ShiftStatusWidget.tsx`
- Modify: `apps/web/src/components/dashboard/TacticalView.tsx`

- [ ] **Step 1: Create use-live-shifts.ts**

Query:

1. `schedule_shift WHERE shift_date = today AND status IN ('published', 'active') AND workspace_id = X`
2. LEFT JOIN `timesheet.time_entry` on `shift_id` WHERE `status = 'clocked_in'`
3. Join `profile` on `employee_id` for name/avatar

Returns:

```typescript
type LiveShiftEntry = {
  shiftId: string;
  employeeName: string;
  initials: string;
  role: string;
  status: "clocked_in" | "on_break" | "waiting" | "late";
  duration?: string; // "2t 07m" for active, null for waiting
  startTime?: string; // "17:00" for waiting
  minutesLate?: number; // for late
};

type LiveShiftSummary = {
  clockedIn: number;
  onBreak: number;
  waiting: number;
  late: number;
  entries: LiveShiftEntry[];
};
```

Realtime subscription on `timesheet.time_entry` (same pattern as LeaderOverview lines 210-233).

- [ ] **Step 2: Create ShiftStatusWidget.tsx**

Compact card following `DashboardCard` pattern from TacticalView. Shows:

- Header: "Aktive vakter" with green dot
- Summary line: "{N} pa vakt · {N} pa pause · {N} venter"
- List: max 8 entries, each with status indicator + name + role + duration
- Late entries with orange warning indicator
- "Se alle" link → `/dashboard/shift-clock`

Follow design system: CSS variables, spring transitions (250ms+), 14px border-radius cards.

- [ ] **Step 3: Add widget to TacticalView**

In `TacticalView.tsx`, after the `WorkforcePulse` section (~line 665), add:

```tsx
<ShiftStatusWidget />
```

Import at top of file.

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter web typecheck`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/_hooks/use-live-shifts.ts apps/web/src/components/dashboard/ShiftStatusWidget.tsx apps/web/src/components/dashboard/TacticalView.tsx
git commit -m "feat(dashboard): add live shift status widget to tactical view

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Final Typecheck + Lint

- [ ] **Step 1: Full typecheck**

Run: `pnpm typecheck`
Expected: 0 errors

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: 0 errors

- [ ] **Step 3: Commit if fixes needed**

```bash
git add -A
git commit -m "fix: lint and typecheck fixes for admin shift visibility

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```
