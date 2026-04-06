# Interactive Dashboard Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the passive tactical+strategic dashboard with an action-oriented bento grid that auto-switches between Operative and Preparatory modes.

**Architecture:** Feature-flagged replacement of `HospitalityOperationsCockpit` + `StrategicView` with a unified `InteractiveDashboard`. Reuses all 9 existing data hooks. Adds 3 new query hooks, 3 mutation hooks. All new components in `apps/web/src/components/dashboard/interactive/`. Bento CSS Grid layout with mode-dependent grid areas.

**Tech Stack:** React 19, Next.js 16, Framer Motion, TanStack Query v5, Supabase client, shadcn/ui, Tailwind v4, `@smartout/i18n`, `@smartout/telemetry`

**Spec:** `docs/superpowers/specs/2026-03-29-interactive-dashboard-redesign.md`

**Council verdict:** APPROVE WITH CHANGES (all incorporated in spec)

---

## File Map

### New files (all under `apps/web/src/components/dashboard/interactive/`)

| File                       | Responsibility                                                     |
| -------------------------- | ------------------------------------------------------------------ |
| `index.ts`                 | Barrel export                                                      |
| `InteractiveDashboard.tsx` | Main orchestrator — mode state, bento grid, data fetching          |
| `DashboardModeToggle.tsx`  | Drift / Forberedelse / Auto segmented control                      |
| `DashboardMetricStrip.tsx` | 56px top bar with mode toggle + metric pills + timestamp           |
| `MetricPill.tsx`           | Single pill badge with glow behavior                               |
| `TaskSwiper.tsx`           | Horizontal swipeable card stack with keyboard nav                  |
| `TaskSwiperCard.tsx`       | Individual action card with severity strip + inline buttons        |
| `OnDutyStrip.tsx`          | Compact avatar row with expand toggle                              |
| `QuickBroadcast.tsx`       | Recipient group buttons + message input + send                     |
| `PrepActionCards.tsx`      | Preparatory mode scrollable action stack                           |
| `InlineTaskCreator.tsx`    | Mini-form: title + assignee + date → session_task                  |
| `KpiPillGrid.tsx`          | 2×2 compact KPI cards with expand                                  |
| `StaffingCoverageBar.tsx`  | 7-day fill rate bar chart with day popover                         |
| `ActivityFeed.tsx`         | Scrollable realtime timeline (refactored from CockpitActivityFeed) |
| `AssignPopover.tsx`        | Shared profile-selector popover for task/shift assignment          |

### New hooks (under `apps/web/src/app/dashboard/_hooks/`)

| File                          | Responsibility                                   |
| ----------------------------- | ------------------------------------------------ |
| `use-dashboard-mode.ts`       | Auto-detection + manual override + persist       |
| `use-pending-approvals.ts`    | Query pending session signoffs                   |
| `use-broadcast-recipients.ts` | Count + profile IDs for 3 recipient groups       |
| `use-create-quick-task.ts`    | Mutation: insert session_task + emit             |
| `use-assign-task.ts`          | Mutation: update session_task.assigned_to + emit |
| `use-send-broadcast.ts`       | Mutation: insert channel_message + emit          |

### Modified files

| File                                                   | Change                                                                   |
| ------------------------------------------------------ | ------------------------------------------------------------------------ |
| `apps/web/src/components/dashboard/AdminDashboard.tsx` | Feature flag: render InteractiveDashboard when `tactical` or `strategic` |
| `packages/telemetry/src/registry.ts`                   | Add 3 new event types                                                    |
| `packages/i18n/locales/nb/dashboard.json`              | Add `interactive.*` keys                                                 |
| `packages/i18n/locales/en/dashboard.json`              | Add `interactive.*` keys                                                 |

---

## Task 1: i18n Keys + Telemetry Events

**Files:**

- Modify: `packages/i18n/locales/nb/dashboard.json`
- Modify: `packages/i18n/locales/en/dashboard.json`
- Modify: `packages/telemetry/src/registry.ts`

- [ ] **Step 1: Add Norwegian i18n keys**

Add under `"interactive"` namespace in `packages/i18n/locales/nb/dashboard.json`:

```json
"interactive": {
  "mode_drift": "Drift",
  "mode_prep": "Forberedelse",
  "mode_auto": "Auto",
  "no_updates": "Ingen oppdateringer",
  "updated_at": "Oppdatert {time}",
  "pill_on_duty": "På jobb",
  "pill_late": "Sen",
  "pill_deviations": "Avvik",
  "pill_tasks_due": "Oppgaver",
  "pill_gaps": "Hull neste 7d",
  "pill_contracts": "Usignerte kontrakter",
  "pill_training": "Utløpende opplæring",
  "pill_budget": "Budsjettavvik",
  "swiper_counter": "{current} av {total}",
  "swiper_empty": "Ingen ventende oppgaver",
  "swiper_shift_gap": "Finn vikar",
  "swiper_dismiss": "Avvis",
  "swiper_assign": "Tildel",
  "swiper_details": "Se detaljer",
  "swiper_complete": "Fullfør",
  "swiper_approve": "Godkjenn",
  "swiper_remind": "Send påminnelse",
  "swiper_defer": "Utsett",
  "swiper_late_subtitle": "{minutes} min sen",
  "swiper_pending_signoff": "Venter signering",
  "on_duty_title": "På jobb",
  "on_duty_break": "pause",
  "on_duty_late": "sen",
  "on_duty_expand": "Vis alle",
  "on_duty_collapse": "Skjul",
  "no_one_on_duty": "Ingen på jobb nå",
  "feed_title": "Aktivitet",
  "feed_filter_all": "Alle",
  "feed_filter_today": "I dag",
  "feed_filter_week": "7 dager",
  "no_activity_yet": "Ingen aktivitet ennå",
  "feed_reconnect": "Koble til på nytt",
  "broadcast_to": "Til:",
  "broadcast_on_duty": "På jobb",
  "broadcast_incoming": "Kommer i dag",
  "broadcast_yesterday": "Var her i går",
  "broadcast_placeholder": "Skriv melding...",
  "broadcast_send": "Send",
  "broadcast_sent": "Sendt til {count} personer",
  "broadcast_expand": "Vis mottakere",
  "prep_new_task": "Ny oppgave",
  "prep_task_title": "Tittel",
  "prep_task_assign": "Tildel til",
  "prep_task_due": "Frist",
  "prep_task_submit": "Opprett",
  "prep_no_session": "Ingen kommende økt — opprett en økt først",
  "prep_contract_waiting": "kontrakt venter",
  "prep_training_expires": "utløper {date}",
  "prep_remind": "Send påminnelse",
  "prep_view": "Se detaljer",
  "all_clear": "Alt i orden",
  "all_clear_prep": "Ingen forberedelser nødvendig",
  "no_shift_data": "Ingen vaktdata",
  "no_pending_tasks": "Ingen ventende oppgaver",
  "kpi_task_completion": "Oppgaver",
  "kpi_deviations": "Avvik",
  "kpi_staff_present": "Bemanning",
  "kpi_session_status": "Øktstatus",
  "kpi_training": "Opplæring",
  "kpi_absence": "Fravær",
  "kpi_turnover": "Personaloms.",
  "kpi_fill_rate": "Dekning 7d",
  "coverage_title": "Bemanning neste 7 dager"
}
```

- [ ] **Step 2: Add English i18n keys**

Same structure in `packages/i18n/locales/en/dashboard.json` with English translations:

```json
"interactive": {
  "mode_drift": "Operations",
  "mode_prep": "Preparation",
  "mode_auto": "Auto",
  "no_updates": "No updates",
  "updated_at": "Updated {time}",
  "pill_on_duty": "On duty",
  "pill_late": "Late",
  "pill_deviations": "Deviations",
  "pill_tasks_due": "Tasks",
  "pill_gaps": "Gaps next 7d",
  "pill_contracts": "Unsigned contracts",
  "pill_training": "Expiring training",
  "pill_budget": "Budget variance",
  "swiper_counter": "{current} of {total}",
  "swiper_empty": "No pending tasks",
  "swiper_shift_gap": "Find cover",
  "swiper_dismiss": "Dismiss",
  "swiper_assign": "Assign",
  "swiper_details": "Details",
  "swiper_complete": "Complete",
  "swiper_approve": "Approve",
  "swiper_remind": "Send reminder",
  "swiper_defer": "Defer",
  "swiper_late_subtitle": "{minutes} min late",
  "swiper_pending_signoff": "Awaiting sign-off",
  "on_duty_title": "On duty",
  "on_duty_break": "break",
  "on_duty_late": "late",
  "on_duty_expand": "Show all",
  "on_duty_collapse": "Hide",
  "no_one_on_duty": "No one on duty right now",
  "feed_title": "Activity",
  "feed_filter_all": "All",
  "feed_filter_today": "Today",
  "feed_filter_week": "7 days",
  "no_activity_yet": "No activity yet",
  "feed_reconnect": "Reconnect",
  "broadcast_to": "To:",
  "broadcast_on_duty": "On duty",
  "broadcast_incoming": "Coming today",
  "broadcast_yesterday": "Were here yesterday",
  "broadcast_placeholder": "Write message...",
  "broadcast_send": "Send",
  "broadcast_sent": "Sent to {count} people",
  "broadcast_expand": "Show recipients",
  "prep_new_task": "New task",
  "prep_task_title": "Title",
  "prep_task_assign": "Assign to",
  "prep_task_due": "Due date",
  "prep_task_submit": "Create",
  "prep_no_session": "No upcoming session — create one first",
  "prep_contract_waiting": "contract pending",
  "prep_training_expires": "expires {date}",
  "prep_remind": "Send reminder",
  "prep_view": "Details",
  "all_clear": "All clear",
  "all_clear_prep": "No preparation needed",
  "no_shift_data": "No shift data",
  "no_pending_tasks": "No pending tasks",
  "kpi_task_completion": "Tasks",
  "kpi_deviations": "Deviations",
  "kpi_staff_present": "Staffing",
  "kpi_session_status": "Session status",
  "kpi_training": "Training",
  "kpi_absence": "Absence",
  "kpi_turnover": "Turnover",
  "kpi_fill_rate": "Coverage 7d",
  "coverage_title": "Staffing next 7 days"
}
```

- [ ] **Step 3: Register telemetry events**

In `packages/telemetry/src/registry.ts`, add to the `EVENTS` map:

```typescript
"session_task.created": {
  destinations: ["activity_trail", "engine_event", "posthog"],
  category: "operations",
},
"session_task.assigned": {
  destinations: ["activity_trail", "engine_event", "posthog"],
  category: "operations",
},
"communication.broadcast_sent": {
  destinations: ["activity_trail", "posthog"],
  category: "communication",
},
```

- [ ] **Step 4: Commit**

```bash
git add packages/i18n/locales/nb/dashboard.json packages/i18n/locales/en/dashboard.json packages/telemetry/src/registry.ts
git commit -m "feat(dashboard): add i18n keys and telemetry events for interactive dashboard"
```

---

## Task 2: Data Hooks (3 queries + 3 mutations)

**Files:**

- Create: `apps/web/src/app/dashboard/_hooks/use-dashboard-mode.ts`
- Create: `apps/web/src/app/dashboard/_hooks/use-pending-approvals.ts`
- Create: `apps/web/src/app/dashboard/_hooks/use-broadcast-recipients.ts`
- Create: `apps/web/src/app/dashboard/_hooks/use-create-quick-task.ts`
- Create: `apps/web/src/app/dashboard/_hooks/use-assign-task.ts`
- Create: `apps/web/src/app/dashboard/_hooks/use-send-broadcast.ts`
- Modify: `apps/web/src/app/dashboard/_hooks/index.ts`

- [ ] **Step 1: Create `use-dashboard-mode.ts`**

```typescript
"use client";

import { useState, useMemo } from "react";
import { useLiveShifts } from "./use-live-shifts";

export type DashboardMode = "operative" | "preparatory";
type ModeOverride = DashboardMode | "auto";

export function useDashboardMode() {
  const [override, setOverride] = useState<ModeOverride>("auto");
  const { data: liveShifts } = useLiveShifts();

  const autoMode: DashboardMode = useMemo(() => {
    const hasActiveShifts = (liveShifts?.entries ?? []).length > 0;
    return hasActiveShifts ? "operative" : "preparatory";
  }, [liveShifts]);

  const activeMode: DashboardMode = override === "auto" ? autoMode : override;

  return {
    mode: activeMode,
    autoMode,
    override,
    setOverride,
    isAuto: override === "auto",
  };
}
```

- [ ] **Step 2: Create `use-pending-approvals.ts`**

```typescript
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";

export type PendingApproval = {
  session_id: string;
  department_name: string;
  session_date: string;
  status: string;
};

export function usePendingApprovals() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: ["dashboard", "pending-approvals", workspace.workspace_id],
    staleTime: 30_000,
    queryFn: async (): Promise<PendingApproval[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("department_session")
        .select("department_session_id, session_date, status, department:department!inner(name)")
        .eq("workspace_id", workspace.workspace_id)
        .eq("status", "pending_signoff")
        .order("session_date", { ascending: true })
        .limit(10);
      if (error) throw error;
      return (data ?? []).map((row: Record<string, unknown>) => ({
        session_id: row.department_session_id as string,
        department_name: (row.department as { name: string })?.name ?? "",
        session_date: row.session_date as string,
        status: row.status as string,
      }));
    },
  });
}
```

- [ ] **Step 3: Create `use-broadcast-recipients.ts`**

```typescript
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";

type RecipientGroup = "on_duty" | "incoming" | "yesterday";

type Recipient = {
  profile_id: string;
  display_name: string | null;
};

export function useBroadcastRecipients(group: RecipientGroup) {
  const { workspace } = useWorkspace();
  const wsId = workspace.workspace_id;
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().split("T")[0];

  return useQuery({
    queryKey: ["dashboard", "broadcast-recipients", wsId, group],
    staleTime: 30_000,
    queryFn: async (): Promise<Recipient[]> => {
      const supabase = createClient();

      if (group === "on_duty") {
        // People with active time_entry (no clock_out)
        const { data, error } = await supabase
          .from("time_entry")
          .select("profile_id, profile:profile!inner(display_name)")
          .is("clock_out", null)
          .limit(50);
        if (error) throw error;
        return (data ?? []).map((r: Record<string, unknown>) => ({
          profile_id: r.profile_id as string,
          display_name: (r.profile as { display_name: string | null })?.display_name ?? null,
        }));
      }

      if (group === "incoming") {
        // People with shifts today who haven't clocked in
        const { data, error } = await supabase
          .from("schedule_shift")
          .select("employee_id, profile:profile!inner(display_name)")
          .eq("shift_date", today)
          .eq("status", "published")
          .limit(50);
        if (error) throw error;
        // Filter out those who already clocked in
        const { data: clockedIn } = await supabase
          .from("time_entry")
          .select("profile_id")
          .is("clock_out", null);
        const clockedSet = new Set(
          (clockedIn ?? []).map((r: { profile_id: string }) => r.profile_id),
        );
        return (data ?? [])
          .filter((r: Record<string, unknown>) => !clockedSet.has(r.employee_id as string))
          .map((r: Record<string, unknown>) => ({
            profile_id: r.employee_id as string,
            display_name: (r.profile as { display_name: string | null })?.display_name ?? null,
          }));
      }

      // yesterday
      const { data, error } = await supabase
        .from("time_entry")
        .select("profile_id, profile:profile!inner(display_name)")
        .gte("clock_out", `${yesterday}T00:00:00`)
        .lt("clock_out", `${today}T00:00:00`)
        .limit(50);
      if (error) throw error;
      return (data ?? []).map((r: Record<string, unknown>) => ({
        profile_id: r.profile_id as string,
        display_name: (r.profile as { display_name: string | null })?.display_name ?? null,
      }));
    },
  });
}
```

- [ ] **Step 4: Create `use-create-quick-task.ts`**

```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { emit } from "@smartout/telemetry";
import { toast } from "sonner";

type CreateTaskInput = {
  title: string;
  department_session_id: string;
  assigned_to?: string;
  due_date?: string;
  profileId: string;
};

export function useCreateQuickTask() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("session_task")
        .insert({
          department_session_id: input.department_session_id,
          workspace_id: workspace.workspace_id,
          title: input.title,
          assigned_to: input.assigned_to ?? null,
          due_at: input.due_date ?? null,
          task_status: "pending",
        })
        .select("session_task_id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data, input) => {
      void emit({
        event: "session_task.created",
        workspace_id: workspace.workspace_id,
        actor_id: input.profileId,
        entity: {
          entity_type: "session_task",
          entity_id: data.session_task_id,
          entity_label: input.title,
        },
        metadata: { source: "dashboard_inline" },
      });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(input.title);
    },
  });
}
```

- [ ] **Step 5: Create `use-assign-task.ts`**

```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { emit } from "@smartout/telemetry";
import { toast } from "sonner";

type AssignTaskInput = {
  taskId: string;
  assignedTo: string;
  assigneeName: string;
  profileId: string;
};

export function useAssignTask() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AssignTaskInput) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("session_task")
        .update({ assigned_to: input.assignedTo })
        .eq("session_task_id", input.taskId);
      if (error) throw error;
    },
    onSuccess: (_data, input) => {
      void emit({
        event: "session_task.assigned",
        workspace_id: workspace.workspace_id,
        actor_id: input.profileId,
        entity: {
          entity_type: "session_task",
          entity_id: input.taskId,
        },
        metadata: { source: "dashboard_inline", assigned_to: input.assignedTo },
      });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(input.assigneeName);
    },
  });
}
```

- [ ] **Step 6: Create `use-send-broadcast.ts`**

```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { emit } from "@smartout/telemetry";
import { toast } from "sonner";

type BroadcastInput = {
  content: string;
  recipientIds: string[];
  profileId: string;
};

export function useSendBroadcast() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  const wsId = workspace.workspace_id;

  return useMutation({
    mutationFn: async (input: BroadcastInput) => {
      const supabase = createClient();

      // Resolve or create broadcast channel (news type)
      let channelId: string;
      const { data: existing } = await supabase
        .from("channel")
        .select("id")
        .eq("workspace_id", wsId)
        .eq("channel_type", "news")
        .limit(1)
        .single();

      if (existing) {
        channelId = existing.id;
      } else {
        const { data: created, error: createErr } = await supabase
          .from("channel")
          .insert({
            workspace_id: wsId,
            channel_type: "news",
            name: "Driftsmeldinger",
            created_by: input.profileId,
          })
          .select("id")
          .single();
        if (createErr) throw createErr;
        channelId = created!.id;
      }

      // Insert broadcast message
      const { error } = await supabase.from("channel_message").insert({
        channel_id: channelId,
        workspace_id: wsId,
        sender_id: input.profileId,
        content: input.content,
        message_type: "announcement",
        delivery_mode: "notification_only",
        target_profile_ids: input.recipientIds,
      });
      if (error) throw error;
      return { channelId, recipientCount: input.recipientIds.length };
    },
    onSuccess: (result, input) => {
      void emit({
        event: "communication.broadcast_sent",
        workspace_id: wsId,
        actor_id: input.profileId,
        metadata: {
          source: "dashboard_broadcast",
          recipient_count: result.recipientCount,
          channel_id: result.channelId,
        },
      });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
```

- [ ] **Step 7: Export all new hooks from index.ts**

Add to `apps/web/src/app/dashboard/_hooks/index.ts`:

```typescript
export { useDashboardMode } from "./use-dashboard-mode";
export { usePendingApprovals } from "./use-pending-approvals";
export type { PendingApproval } from "./use-pending-approvals";
export { useBroadcastRecipients } from "./use-broadcast-recipients";
export { useCreateQuickTask } from "./use-create-quick-task";
export { useAssignTask } from "./use-assign-task";
export { useSendBroadcast } from "./use-send-broadcast";
```

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/dashboard/_hooks/
git commit -m "feat(dashboard): add data hooks for interactive dashboard (mode, approvals, broadcast, mutations)"
```

---

## Task 3: Shared Building Blocks (MetricPill, AssignPopover, ModeToggle)

**Files:**

- Create: `apps/web/src/components/dashboard/interactive/MetricPill.tsx`
- Create: `apps/web/src/components/dashboard/interactive/AssignPopover.tsx`
- Create: `apps/web/src/components/dashboard/interactive/DashboardModeToggle.tsx`

- [ ] **Step 1: Create `MetricPill.tsx`**

Single pill badge with icon + number + label + optional glow. Uses `getSeverityToneStyles` for colors.

```typescript
"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { getSeverityToneStyles, type CockpitSeverityTone } from "../cockpit/severity-styles";

type MetricPillProps = {
  icon: LucideIcon;
  value: number | string;
  label: string;
  tone: CockpitSeverityTone;
  isLoading?: boolean;
};

const GLOW_KEYFRAMES = {
  boxShadow: [
    "0 0 0 0 var(--glow-brand, rgba(255,107,53,0))",
    "0 0 10px 3px var(--glow-brand, rgba(255,107,53,0.3))",
    "0 0 0 0 var(--glow-brand, rgba(255,107,53,0))",
  ],
};

export function MetricPill({ icon: Icon, value, label, tone, isLoading }: MetricPillProps) {
  const styles = getSeverityToneStyles(tone);
  const shouldGlow = tone === "critical" && value !== 0 && value !== "0%";

  return (
    <motion.div
      animate={shouldGlow ? GLOW_KEYFRAMES : undefined}
      transition={shouldGlow ? { duration: 2, repeat: Infinity, ease: "easeInOut" } : undefined}
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
        value === 0 || value === "0%"
          ? "border-border text-muted-foreground"
          : `${styles.badge}`
      }`}
    >
      <Icon className="h-3 w-3" />
      <span className="tabular-nums font-semibold">
        {isLoading ? "—" : value}
      </span>
      <span className="hidden sm:inline">{label}</span>
    </motion.div>
  );
}
```

- [ ] **Step 2: Create `DashboardModeToggle.tsx`**

```typescript
"use client";

import { useTranslation } from "@smartout/i18n";

type DashboardModeToggleProps = {
  override: "operative" | "preparatory" | "auto";
  autoMode: "operative" | "preparatory";
  onOverrideChange: (mode: "operative" | "preparatory" | "auto") => void;
};

const SEGMENTS = ["operative", "preparatory", "auto"] as const;

export function DashboardModeToggle({ override, autoMode, onOverrideChange }: DashboardModeToggleProps) {
  const { t } = useTranslation("dashboard");

  const labels: Record<string, string> = {
    operative: t("interactive.mode_drift"),
    preparatory: t("interactive.mode_prep"),
    auto: t("interactive.mode_auto"),
  };

  return (
    <div className="bg-muted/50 border-border flex items-center gap-0.5 rounded-lg border p-0.5" role="radiogroup" aria-label="Dashboard mode">
      {SEGMENTS.map((seg) => {
        const isActive = override === seg || (override === "auto" && seg === "auto");
        return (
          <button
            key={seg}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onOverrideChange(seg)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {labels[seg]}
            {seg === "auto" && (
              <span className="text-muted-foreground ml-1 text-[10px]">
                ({labels[autoMode]?.charAt(0)})
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Create `AssignPopover.tsx`**

Shared profile selector popover used by TaskSwiper and PrepActionCards.

```typescript
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@smartout/i18n";

type AssignPopoverProps = {
  trigger: React.ReactNode;
  onAssign: (profileId: string, displayName: string) => void;
};

export function AssignPopover({ trigger, onAssign }: AssignPopoverProps) {
  const { t } = useTranslation("dashboard");
  const { workspace } = useWorkspace();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const { data: profiles } = useQuery({
    queryKey: ["dashboard", "assignable-profiles", workspace.workspace_id],
    enabled: open,
    staleTime: 60_000,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profile")
        .select("profile_id, display_name")
        .eq("workspace_id", workspace.workspace_id)
        .eq("is_active", true)
        .order("display_name")
        .limit(50);
      if (error) throw error;
      return data as { profile_id: string; display_name: string | null }[];
    },
  });

  const filtered = (profiles ?? []).filter((p) =>
    (p.display_name ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-2">
        <Input
          placeholder={t("interactive.swiper_assign")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-2 h-8 text-xs"
          autoFocus
        />
        <div className="max-h-48 overflow-y-auto">
          {filtered.map((p) => (
            <button
              key={p.profile_id}
              type="button"
              onClick={() => {
                onAssign(p.profile_id, p.display_name ?? "");
                setOpen(false);
              }}
              className="hover:bg-muted flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs"
            >
              <div className="bg-primary/10 text-primary flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold">
                {(p.display_name ?? "?").slice(0, 2).toUpperCase()}
              </div>
              <span>{p.display_name ?? "—"}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/dashboard/interactive/
git commit -m "feat(dashboard): add MetricPill, ModeToggle, AssignPopover building blocks"
```

---

## Task 4: DashboardMetricStrip + TaskSwiper + TaskSwiperCard

This is the hero task — the main interaction surface. Due to length, the full component code should be written following the spec sections 2, 4 precisely. Key implementation notes:

**Files:**

- Create: `apps/web/src/components/dashboard/interactive/DashboardMetricStrip.tsx`
- Create: `apps/web/src/components/dashboard/interactive/TaskSwiper.tsx`
- Create: `apps/web/src/components/dashboard/interactive/TaskSwiperCard.tsx`

- [ ] **Step 1: Create `DashboardMetricStrip.tsx`**

56px bar containing: `DashboardModeToggle` (left) → `MetricPill` array (center) → last-updated timestamp (right). Per spec section 2. Mode-specific pills swap with crossfade on mode change.

Uses: `useCockpitFirstScreen`, `useActionItems`, `useStaffingCoverage`, `useTranslation("dashboard")`.

Operative pills: On duty (Users icon), Late (AlertTriangle), Deviations (ShieldAlert), Tasks due (CheckSquare).
Preparatory pills: Gaps 7d (Calendar), Unsigned contracts (FileText), Expiring training (GraduationCap), Budget variance (TrendingUp).

- [ ] **Step 2: Create `TaskSwiperCard.tsx`**

Individual card per spec section 4.2. Props: `type`, `title`, `subtitle`, `severity`, `primaryAction`, `secondaryAction`, `onDismiss`. Severity strip left (4px), type badge top, title+subtitle center, 2 action buttons bottom.

Uses: `getSeverityToneStyles`, `motion.div` for drag, `useTranslation("dashboard")`.

Critical glow uses `var(--glow-brand)`. Icon per severity: AlertTriangle (critical), AlertCircle (warning), Info (default).

- [ ] **Step 3: Create `TaskSwiper.tsx`**

Container that shows one `TaskSwiperCard` at a time with horizontal swipe. Per spec section 4.

Aggregates cards from `useCockpitFirstScreen` (staffingQueue, operationalQueue, late entries) + `usePendingApprovals`. Sorts by severity → timestamp. Dismiss via `useState<Set<string>>`. Keyboard: ← → navigate, Enter primary, Backspace dismiss. Counter "3 av 12".

Empty state: checkmark icon + `t("interactive.swiper_empty")`, green tint.

Drag physics: interactive spring (stiffness 100, damping 16). Dismiss threshold: 50% of card width → animate x: ±300, opacity 0, 250ms.

`prefers-reduced-motion`: scroll-snap instead of drag.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/dashboard/interactive/
git commit -m "feat(dashboard): add MetricStrip + TaskSwiper with inline actions"
```

---

## Task 5: OnDutyStrip + ActivityFeed + KpiPillGrid

**Files:**

- Create: `apps/web/src/components/dashboard/interactive/OnDutyStrip.tsx`
- Create: `apps/web/src/components/dashboard/interactive/ActivityFeed.tsx`
- Create: `apps/web/src/components/dashboard/interactive/KpiPillGrid.tsx`

- [ ] **Step 1: Create `OnDutyStrip.tsx`**

Per spec section 5. Avatar row (36px visual, 44px click area) with status dots. Max 8 visible + "+N" pill. Totals badge ("8 på jobb · 1 pause · 1 sen"). Click totals → expand full list (AnimatePresence, reuse CockpitOnDutyProgress card markup). Click avatar → `openDrawer("profile", profileId)`.

Uses: `useLiveShifts`, `useEntityDrawer`, `useTranslation("dashboard")`.

- [ ] **Step 2: Create `ActivityFeed.tsx`**

Per spec section 6. Refactored from CockpitActivityFeed with new styling. Scrollable column, filter pills (All/Today/7d), severity dots + text + actor + timestamp. Click → entity drawer. Auto-scroll with pin toggle. New entries slide in (y: 12→0, opacity 0→1, 150ms).

Uses: `useActivityFeed`, `useEntityDrawer`, `useTranslation("dashboard")`.

Empty state: dashed border + `t("interactive.no_activity_yet")`.

- [ ] **Step 3: Create `KpiPillGrid.tsx`**

Per spec section 9. 2×2 grid of compact KPI cards. Each ~120px wide, ~80px tall. Click → expand inline with AnimatePresence (snappy spring: stiffness 250, damping 22).

Operative: task completion (ring), deviations (number), staff present (fraction), session status (badge).
Preparatory: training %, absence %, turnover %, fill rate 7d.

Uses: `useTaskCompletion`, `useAbsenceRate`, `useStaffTurnover`, `useTrainingReadiness`, `useStaffingCoverage`, `useKpiTargets`, `useTranslation("dashboard")`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/dashboard/interactive/
git commit -m "feat(dashboard): add OnDutyStrip, ActivityFeed, KpiPillGrid"
```

---

## Task 6: QuickBroadcast + PrepActionCards + InlineTaskCreator + StaffingCoverageBar

**Files:**

- Create: `apps/web/src/components/dashboard/interactive/QuickBroadcast.tsx`
- Create: `apps/web/src/components/dashboard/interactive/PrepActionCards.tsx`
- Create: `apps/web/src/components/dashboard/interactive/InlineTaskCreator.tsx`
- Create: `apps/web/src/components/dashboard/interactive/StaffingCoverageBar.tsx`

- [ ] **Step 1: Create `QuickBroadcast.tsx`**

Per spec section 7. Three toggle buttons (on_duty/incoming/yesterday) with count badges. Text input + send button. Uses `useBroadcastRecipients` for all 3 groups, `useSendBroadcast` for send mutation. Collapsed by default (one line). Expand shows recipient avatars.

Toast: `t("interactive.broadcast_sent", { count })` on success.

- [ ] **Step 2: Create `InlineTaskCreator.tsx`**

Per spec section 8.2 + 13.5. Mini-form with title input, profile selector (AssignPopover), date picker. Resolves department_session_id: operative → active session, preparatory → next upcoming. Disabled with `t("interactive.prep_no_session")` if no session found.

Uses: `useCreateQuickTask`, Supabase query for active/upcoming session.

- [ ] **Step 3: Create `PrepActionCards.tsx`**

Per spec section 8. Scrollable stack. Card types: staffing gap, create task (InlineTaskCreator), unsigned contract, training expiring, budget drift. Each card has severity strip + title + inline action button. Sorted by severity.

Uses: `useStaffingCoverage`, `useActionItems`, `useTrainingReadiness`, `useKpiTargets`, `useTranslation("dashboard")`.

- [ ] **Step 4: Create `StaffingCoverageBar.tsx`**

Per spec section 10. 7-day bar chart. Each day: vertical bar colored by fill rate (green ≥80%, orange ≥60%, red <60%). Day label below. Percentage label. Click day → Popover with gap details.

Uses: `useStaffingCoverage`, `Popover` (shadcn), `useTranslation("dashboard")`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/dashboard/interactive/
git commit -m "feat(dashboard): add QuickBroadcast, PrepActionCards, InlineTaskCreator, StaffingCoverageBar"
```

---

## Task 7: InteractiveDashboard Orchestrator + Feature Flag Integration

**Files:**

- Create: `apps/web/src/components/dashboard/interactive/InteractiveDashboard.tsx`
- Create: `apps/web/src/components/dashboard/interactive/index.ts`
- Modify: `apps/web/src/components/dashboard/AdminDashboard.tsx`

- [ ] **Step 1: Create `InteractiveDashboard.tsx`**

Main orchestrator per spec section 3. CSS Grid bento layout with named areas. Switches grid-template-areas based on mode.

Desktop grid:

```css
/* Operative */
grid-template-areas:
  "swiper  onduty  feed"
  "bcast   kpi     feed";
grid-template-columns: 6fr 3fr 3fr;

/* Preparatory */
grid-template-areas:
  "prep    coverage feed"
  "bcast   kpi      feed";
grid-template-columns: 6fr 3fr 3fr;
```

Mode transition: `AnimatePresence` with crossfade (exit 250ms, enter 500ms stagger 50ms).

Composes: `DashboardMetricStrip`, `TaskSwiper` (operative) / `PrepActionCards` (preparatory), `OnDutyStrip` (operative) / `StaffingCoverageBar` (preparatory), `QuickBroadcast`, `KpiPillGrid`, `ActivityFeed`.

Idle state: when all zeros → dim cards (opacity 0.7) + "Alt i orden" center badge.

- [ ] **Step 2: Create barrel `index.ts`**

```typescript
export { InteractiveDashboard } from "./InteractiveDashboard";
```

- [ ] **Step 3: Modify `AdminDashboard.tsx` with feature flag**

Replace tactical + strategic cases with InteractiveDashboard when flag is on:

```typescript
const InteractiveDashboard = dynamic(() =>
  import("./interactive").then((m) => ({
    default: m.InteractiveDashboard,
  })),
);

// Feature flag — falls back to existing views
const useInteractiveDashboard = process.env.NEXT_PUBLIC_INTERACTIVE_DASHBOARD === "true";

// In the render:
{adminView === "tactical" || adminView === "strategic" ? (
  useInteractiveDashboard ? (
    <InteractiveDashboard />
  ) : adminView === "tactical" ? (
    <HospitalityOperationsCockpit />
  ) : (
    <StrategicView />
  )
) : adminView === "reconciliation" ? (
  // ... unchanged
```

- [ ] **Step 4: Add feature flag to `.env.template`**

```
NEXT_PUBLIC_INTERACTIVE_DASHBOARD=true
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/dashboard/interactive/ apps/web/src/components/dashboard/AdminDashboard.tsx .env.template
git commit -m "feat(dashboard): wire InteractiveDashboard with feature flag + bento grid layout"
```

---

## Task 8: Polish Pass — Responsive, Reduced Motion, Empty States

- [ ] **Step 1: Add responsive breakpoints to InteractiveDashboard grid**

Tablet (768-1279): 6-col, swiper full-width, feed collapsible.
Mobile (<768): single column stack per spec section 12.

- [ ] **Step 2: Add `prefers-reduced-motion` media query handling**

In each animated component, check `useReducedMotion()` from Framer Motion. Disable springs, use instant transitions, swap drag for scroll-snap per spec section 11.3.

- [ ] **Step 3: Verify empty/error/loading states per spec section 19**

Each cell renders skeleton (loading), retry/message (error), illustration (empty) per the table.

- [ ] **Step 4: Typecheck**

Run: `pnpm turbo typecheck --filter=web`

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(dashboard): responsive breakpoints, reduced motion, empty states"
```

---

Plan complete and saved to `docs/superpowers/plans/2026-03-29-interactive-dashboard-redesign.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
