---
title: "Schedule Module — UI Redesign Implementation Plan"
status: done
updated: 2026-03-03
created: 2026-03-02
module: schedule
tags: [schedule, ui, redesign, plan, implementation]
---

# Schedule Module — UI Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the schedule module UI to move filters to a bottom-right control panel, enable continuous horizontal scrolling, add shift lead support, enhance push/SMS, and improve month + list views.

**Architecture:** Refactor existing schedule components (25 files in `_components/`, 13 hooks in `_hooks/`) without changing the data layer. All hooks, types, mappers, and realtime subscriptions stay. Changes are purely UI layout + 1 DB migration for shift leads + new notification dialog.

**Tech Stack:** Next.js 16 (App Router), React 19, TanStack Query v5, dnd-kit, shadcn/ui, Tailwind v4, Supabase (PostgreSQL), sonner toasts.

---

## Prerequisite Reading

Before starting any task, read these files to understand the codebase:

| What                  | File                                                                      |
| --------------------- | ------------------------------------------------------------------------- |
| Project conventions   | `/home/sxtnl/dev/smartout.ai/CLAUDE.md`                                   |
| Schedule types        | `apps/web/src/app/dashboard/schedule/_components/schedule-types.ts`       |
| Schedule UI context   | `apps/web/src/app/dashboard/schedule/_components/schedule-ui-context.tsx` |
| Query key factory     | `apps/web/src/app/dashboard/schedule/_hooks/schedule-keys.ts`             |
| DB → frontend mappers | `apps/web/src/app/dashboard/schedule/_hooks/schedule-mappers.ts`          |
| DashboardContext      | `apps/web/src/components/dashboard/DashboardShell.tsx`                    |
| Design spec           | `docs/plans/2026-03-02-schedule-module-v2-design.md`                      |

## Key Architectural Patterns

- **Dark mode:** All components read `isDark` from `DashboardContext`. Use conditional classes: `isDark ? "bg-[#0a0a0c] text-zinc-100" : "bg-white text-zinc-900"`.
- **Queries:** All data via TanStack Query hooks in `_hooks/`. Query keys scoped by `workspaceId + weekStart`.
- **Mutations:** Optimistic updates. `onMutate` → cancel + set cache, `onError` → rollback, `onSettled` → invalidate.
- **UI state:** Ephemeral selection state in `ScheduleUIContext` (not DB-persisted).
- **Grid:** Employee sidebar is 260px, sticky `left-0`. Day columns are 200px fixed width.
- **DnD:** `@dnd-kit/core`. Droppable IDs: `cell::${employeeId}::${dateId}` or `day-header::${dateId}`.
- **Components:** shadcn/ui (Dialog, Sheet, Button, Input, Select, Tabs). Add with: `cd apps/web && npx shadcn@latest add <component>`.
- **Toasts:** `import { toast } from "sonner"`.

---

## Phase 1: Layout Reorganization — Bottom Control Panel

### Task 1: Create ScheduleControlPanel component

Move the Ansatt/Jobb/Team view toggles and Lokasjon filter from the top bar (`PlannerCommandBar`) to a new bottom-right floating panel.

**Files:**

- Create: `apps/web/src/app/dashboard/schedule/_components/schedule-control-panel.tsx`
- Modify: `apps/web/src/app/dashboard/schedule/_components/planner-command-bar.tsx`
- Modify: `apps/web/src/app/dashboard/schedule/page.tsx`

**Step 1: Create the ScheduleControlPanel component**

This is a compact floating panel that sits in the bottom-right corner of the grid area, above the week-span toggle. It contains 4 icon buttons (Ansatt, Jobb, Team, Lokasjon) and the situation filter (Alle/Selskap/Krise/Normal).

```tsx
// apps/web/src/app/dashboard/schedule/_components/schedule-control-panel.tsx
"use client";

import React, { useContext, useRef, useState } from "react";
import { Users, Briefcase, Network, MapPin, Filter, ChevronDown, Check } from "lucide-react";
import { DashboardContext, type ScheduleViewMode } from "@/components/dashboard/DashboardShell";

type ScheduleControlPanelProps = {
  isDark: boolean;
  filterSituation: string;
  setFilterSituation: (value: string) => void;
};

export function ScheduleControlPanel({
  isDark,
  filterSituation,
  setFilterSituation,
}: ScheduleControlPanelProps) {
  const { scheduleView, setScheduleView, activeLocation, setActiveLocation } =
    useContext(DashboardContext);

  return (
    <div
      className={`absolute right-4 bottom-4 z-30 flex items-center gap-2 rounded-xl border px-3 py-2 shadow-xl backdrop-blur-xl ${
        isDark ? "border-white/10 bg-[#0a0a0c]/90" : "border-zinc-200 bg-white/90"
      }`}
    >
      {/* View toggles: Ansatt / Jobb / Team */}
      <div className="flex items-center gap-0.5">
        <ViewToggle
          isDark={isDark}
          icon={<Users className="h-3.5 w-3.5" />}
          label="Ansatt"
          isActive={scheduleView === "ansatt"}
          onClick={() => setScheduleView("ansatt")}
        />
        <ViewToggle
          isDark={isDark}
          icon={<Briefcase className="h-3.5 w-3.5" />}
          label="Jobb"
          isActive={scheduleView === "jobb"}
          onClick={() => setScheduleView("jobb")}
        />
        <ViewToggle
          isDark={isDark}
          icon={<Network className="h-3.5 w-3.5" />}
          label="Team"
          isActive={scheduleView === "team"}
          onClick={() => setScheduleView("team")}
        />
      </div>

      <div className={`h-5 w-px ${isDark ? "bg-white/10" : "bg-zinc-200"}`} />

      {/* Location selector */}
      <LocationDropdown isDark={isDark} value={activeLocation} onChange={setActiveLocation} />

      <div className={`h-5 w-px ${isDark ? "bg-white/10" : "bg-zinc-200"}`} />

      {/* Situation filter */}
      <div className="flex items-center gap-1">
        <Filter className="h-3 w-3 text-zinc-500" />
        {["Alle", "Selskap", "Krise", "Normal"].map((situation) => (
          <button
            key={situation}
            onClick={() => setFilterSituation(situation)}
            className={`rounded-md px-2 py-1 text-[10px] font-bold transition-all ${
              filterSituation === situation
                ? isDark
                  ? "bg-zinc-800/80 text-zinc-200 shadow-sm"
                  : "bg-zinc-100 text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {situation}
          </button>
        ))}
      </div>
    </div>
  );
}

function ViewToggle({
  isDark,
  icon,
  label,
  isActive,
  onClick,
}: {
  isDark: boolean;
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-bold transition-all ${
        isActive
          ? isDark
            ? "bg-zinc-800 text-white shadow-sm"
            : "bg-zinc-100 text-zinc-900 shadow-sm"
          : isDark
            ? "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
            : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
      }`}
    >
      <span className={isActive ? "text-orange-500" : ""}>{icon}</span>
      {label}
    </button>
  );
}

const LOCATIONS = ["Alle Lokasjoner", "Hovedrestaurant", "Bar & Lounge", "Uteservering", "Kjøkken"];

function LocationDropdown({
  isDark,
  value,
  onChange,
}: {
  isDark: boolean;
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-bold transition-all ${
          isDark
            ? "border-white/10 bg-white/5 text-zinc-300 hover:border-white/20"
            : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
        }`}
      >
        <MapPin className="h-3.5 w-3.5 text-orange-500" />
        {value}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className={`absolute bottom-full left-0 z-[9999] mb-1 w-52 rounded-xl border p-1 shadow-xl ${
            isDark
              ? "border-white/10 bg-[#111113]/95 backdrop-blur-xl"
              : "border-zinc-200 bg-white shadow-lg"
          } animate-in fade-in slide-in-from-bottom-1`}
        >
          {LOCATIONS.map((loc) => (
            <button
              key={loc}
              onClick={() => {
                onChange(loc);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                value === loc
                  ? isDark
                    ? "bg-orange-500/10 text-orange-400"
                    : "bg-orange-50 text-orange-600"
                  : isDark
                    ? "text-zinc-400 hover:bg-white/5 hover:text-white"
                    : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
              }`}
            >
              {loc}
              {value === loc && <Check className="h-3.5 w-3.5" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Simplify PlannerCommandBar — remove filter buttons and location**

Remove the ViewFilterButton section, the LocationPopover, and the situation filter from `planner-command-bar.tsx`. Keep only the "Vaktplan" heading. The rest is handled by the new control panel.

In `apps/web/src/app/dashboard/schedule/_components/planner-command-bar.tsx`:

- Remove the `LocationPopover` component entirely
- Remove the `ViewFilterButton` component entirely
- Remove the filter popover section (Ansatt/Jobb/Team buttons)
- Remove the situation filter section (Alle/Selskap/Krise/Normal)
- Keep only the heading "Vaktplan" with the CalendarDays icon
- Remove `filterSituation` / `setFilterSituation` props

The PlannerCommandBar becomes a simple header:

```tsx
export function PlannerCommandBar({ isDark }: { isDark: boolean }) {
  return (
    <div
      className={`z-20 flex shrink-0 items-center border-b border-white/[0.04] px-6 py-2.5 ${
        isDark ? "bg-[#0a0a0c]/80" : "bg-white/80"
      } backdrop-blur-md print:hidden`}
    >
      <h1 className="flex items-center gap-2 text-sm font-black tracking-tight xl:text-base">
        <CalendarDays className="h-5 w-5 text-orange-500" />
        Vaktplan
      </h1>
    </div>
  );
}
```

**Step 3: Wire ScheduleControlPanel into page.tsx**

In `apps/web/src/app/dashboard/schedule/page.tsx`:

- Import `ScheduleControlPanel`
- Place it inside the `GridSurface` content area, positioned absolutely in bottom-right
- Pass `filterSituation` and `setFilterSituation` to the panel
- Update `PlannerCommandBar` to use new simplified props
- The control panel renders on top of the grid in all layout modes (daily, monthly, list)

The GridSurface wrapper needs `position: relative` so the control panel can position absolutely. It already has `relative` class.

**Step 4: Run typecheck**

```bash
pnpm turbo typecheck --filter=web
```

Expected: 0 errors (all removed props accounted for).

**Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_components/schedule-control-panel.tsx \
       apps/web/src/app/dashboard/schedule/_components/planner-command-bar.tsx \
       apps/web/src/app/dashboard/schedule/page.tsx
git commit -m "feat(schedule): move filters to bottom-right control panel"
```

---

## Phase 2: Shift Lead (Vaktansvarlig)

### Task 2: Add shift lead DB column

Add support for multiple shift leads per shift. Uses a JSONB array column on `schedule_shift` rather than a separate table (simpler, sufficient for 1-3 leads per shift).

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_add_shift_leads.sql`
- Modify: `apps/web/src/app/dashboard/schedule/_components/schedule-types.ts`
- Modify: `apps/web/src/app/dashboard/schedule/_hooks/schedule-mappers.ts`

**Step 1: Write the migration**

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_add_shift_leads.sql
-- Add shift lead support: array of profile_ids who are duty managers for this shift

ALTER TABLE schedule_shift
  ADD COLUMN shift_leads UUID[] DEFAULT '{}';

COMMENT ON COLUMN schedule_shift.shift_leads IS 'Array of profile_ids acting as shift leads (vaktansvarlige) for this shift';
```

**Step 2: Apply migration locally**

```bash
npx supabase db reset
```

Or if you want to apply just this migration:

```bash
npx supabase migration up
```

**Step 3: Regenerate types**

```bash
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
```

**Step 4: Update frontend types**

In `apps/web/src/app/dashboard/schedule/_components/schedule-types.ts`, add `shiftLeads` to the `Shift` type:

```typescript
// Add to Shift type:
shiftLeads: string[];  // profile_ids of shift leads (vaktansvarlige)
```

**Step 5: Update mappers**

In `apps/web/src/app/dashboard/schedule/_hooks/schedule-mappers.ts`:

- In `fromDbShift()`: map `row.shift_leads ?? []` → `shiftLeads`
- In `toDbShiftInsert()`: map `shift.shiftLeads` → `shift_leads`
- In `toDbShiftUpdate()`: map `shift.shiftLeads` → `shift_leads` (if present)

**Step 6: Run typecheck**

```bash
pnpm turbo typecheck --filter=web
```

**Step 7: Commit**

```bash
git add supabase/migrations/ packages/supabase/src/database.types.ts \
       apps/web/src/app/dashboard/schedule/_components/schedule-types.ts \
       apps/web/src/app/dashboard/schedule/_hooks/schedule-mappers.ts
git commit -m "feat(schedule): add shift_leads column for vaktansvarlig support"
```

---

### Task 3: Add shift lead UI to ShiftModal

Add a "Vaktansvarlig" multi-select field to the Detaljer tab in the shift modal. Uses a compact chip display with an employee picker popover.

**Files:**

- Modify: `apps/web/src/app/dashboard/schedule/_components/shift-modal.tsx`

**Step 1: Read the existing shift-modal.tsx fully**

Read `apps/web/src/app/dashboard/schedule/_components/shift-modal.tsx` to understand the Detaljer tab layout.

**Step 2: Add the shift lead selector**

In the Detaljer tab content (the first `<TabsContent value="detaljer">`), add after the "Zone" field:

```tsx
{
  /* Vaktansvarlig — multi-select */
}
<div className="space-y-1.5">
  <Label className="text-xs font-bold tracking-wider text-zinc-500 uppercase">Vaktansvarlig</Label>
  <ShiftLeadPicker
    isDark={isDark}
    employees={employees}
    selectedIds={shiftLeads}
    onChange={setShiftLeads}
  />
</div>;
```

Where `ShiftLeadPicker` is a local component defined in the same file:

```tsx
function ShiftLeadPicker({
  isDark,
  employees,
  selectedIds,
  onChange,
}: {
  isDark: boolean;
  employees: ScheduleEmployee[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const toggleEmployee = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((s) => s !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const selectedEmployees = employees.filter((e) => selectedIds.includes(e.id));

  return (
    <div ref={ref} className="relative">
      {/* Selected chips */}
      <div
        onClick={() => setOpen(!open)}
        className={`flex min-h-[36px] cursor-pointer flex-wrap gap-1.5 rounded-lg border px-2 py-1.5 ${
          isDark
            ? "border-white/10 bg-white/5 hover:border-white/20"
            : "border-zinc-200 bg-zinc-50 hover:border-zinc-300"
        }`}
      >
        {selectedEmployees.length === 0 && (
          <span className="text-xs text-zinc-500">Velg vaktansvarlig...</span>
        )}
        {selectedEmployees.map((emp) => (
          <span
            key={emp.id}
            className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${
              isDark ? "bg-orange-500/15 text-orange-400" : "bg-orange-50 text-orange-600"
            }`}
          >
            {emp.name}
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleEmployee(emp.id);
              }}
              className="ml-0.5 text-zinc-500 hover:text-zinc-300"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>

      {/* Dropdown */}
      {open && (
        <div
          className={`absolute top-full left-0 z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border p-1 shadow-xl ${
            isDark
              ? "border-white/10 bg-[#111113]/95 backdrop-blur-xl"
              : "border-zinc-200 bg-white shadow-lg"
          }`}
        >
          {employees.map((emp) => {
            const isSelected = selectedIds.includes(emp.id);
            return (
              <button
                key={emp.id}
                onClick={() => toggleEmployee(emp.id)}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs transition-colors ${
                  isSelected
                    ? isDark
                      ? "bg-orange-500/10 text-orange-400"
                      : "bg-orange-50 text-orange-600"
                    : isDark
                      ? "text-zinc-400 hover:bg-white/5"
                      : "text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                <div
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[8px] font-black ${emp.avatarColor}`}
                >
                  {emp.initials}
                </div>
                <span className="font-medium">{emp.name}</span>
                {isSelected && <Check className="ml-auto h-3.5 w-3.5" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

**Step 3: Wire shiftLeads state into the modal**

- Add `const [shiftLeads, setShiftLeads] = useState<string[]>([])` to modal state
- In edit mode, initialize from `existingShift.shiftLeads`
- In `handleSave()`, include `shiftLeads` in the shift payload
- In `handleCreate()`, include `shiftLeads` in the new shift payload

**Step 4: Run typecheck**

```bash
pnpm turbo typecheck --filter=web
```

**Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_components/shift-modal.tsx
git commit -m "feat(schedule): add shift lead picker to shift detail modal"
```

---

## Phase 3: Push/SMS Dialog with Message

### Task 4: Create PushSmsDialog component

When user clicks "Push vakt" or "SMS" on the Day Control Center, a small dialog opens where they can write a message and optionally include day info.

**Files:**

- Create: `apps/web/src/app/dashboard/schedule/_components/push-sms-dialog.tsx`
- Modify: `apps/web/src/app/dashboard/schedule/_components/daily-briefing.tsx`

**Step 1: Create the dialog component**

```tsx
// apps/web/src/app/dashboard/schedule/_components/push-sms-dialog.tsx
"use client";

import { useState } from "react";
import { Bell, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type PushSmsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "push" | "sms";
  dateLabel: string;
  recipientCount: number;
  isDark: boolean;
  onSend: (message: string, includeDayInfo: boolean) => void;
};

export function PushSmsDialog({
  open,
  onOpenChange,
  mode,
  dateLabel,
  recipientCount,
  isDark,
  onSend,
}: PushSmsDialogProps) {
  const [message, setMessage] = useState("");
  const [includeDayInfo, setIncludeDayInfo] = useState(false);

  const handleSend = () => {
    if (!message.trim()) {
      toast.error("Skriv en melding først");
      return;
    }
    onSend(message.trim(), includeDayInfo);
    setMessage("");
    setIncludeDayInfo(false);
    onOpenChange(false);
    toast.success(
      mode === "push"
        ? `Push-varsel sendt til ${recipientCount} ansatte`
        : `SMS sendt til ${recipientCount} ansatte`,
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            {mode === "push" ? (
              <Bell className="h-4 w-4 text-orange-500" />
            ) : (
              <MessageSquare className="h-4 w-4 text-blue-500" />
            )}
            {mode === "push" ? "Push-varsel" : "SMS"} — {dateLabel}
          </DialogTitle>
          <DialogDescription>
            Sendes til {recipientCount} ansatt{recipientCount !== 1 ? "e" : ""} på vakt.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold tracking-wider text-zinc-500 uppercase">
              Melding
            </Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Skriv en melding som sendes med varselet..."
              rows={3}
              className="resize-none text-sm"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="include-day-info" className="text-xs font-medium">
              Pakk med daginfo
            </Label>
            <Switch
              id="include-day-info"
              checked={includeDayInfo}
              onCheckedChange={setIncludeDayInfo}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button size="sm" onClick={handleSend}>
            <Send className="mr-1.5 h-3.5 w-3.5" />
            Send {mode === "push" ? "push" : "SMS"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Wire into daily-briefing.tsx**

In `daily-briefing.tsx`, find the broadcast/push section (look for the Megaphone icon and the push/SMS buttons in the Oversikt tab). Replace the direct buttons with buttons that open the `PushSmsDialog`:

- Add state: `const [pushDialogMode, setPushDialogMode] = useState<"push" | "sms" | null>(null)`
- Replace the push button `onClick` with `() => setPushDialogMode("push")`
- Replace the SMS button `onClick` with `() => setPushDialogMode("sms")`
- Render the dialog: `<PushSmsDialog open={pushDialogMode !== null} onOpenChange={(v) => !v && setPushDialogMode(null)} mode={pushDialogMode ?? "push"} ... />`
- Pass an `onSend` handler that calls the existing broadcast/notification logic

**Step 3: Run typecheck**

```bash
pnpm turbo typecheck --filter=web
```

**Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_components/push-sms-dialog.tsx \
       apps/web/src/app/dashboard/schedule/_components/daily-briefing.tsx
git commit -m "feat(schedule): add push/sms dialog with message and dayinfo toggle"
```

---

## Phase 4: Shift Detail — Time-Off Toggle

### Task 5: Add availability/time-off field to ShiftModal

Allow setting time-off (avspasering) or availability directly from the shift detail card.

**Files:**

- Modify: `apps/web/src/app/dashboard/schedule/_components/shift-modal.tsx`

**Step 1: Read the shift-modal.tsx Detaljer tab fully**

Understand which fields are present and where the new field fits.

**Step 2: Add the availability toggle to Detaljer tab**

After the "Publisert" switch in the Detaljer tab, add:

```tsx
{
  /* Avspasering / Tilgjengelighet */
}
{
  existingShift?.employeeId && (
    <div className="space-y-1.5">
      <Label className="text-xs font-bold tracking-wider text-zinc-500 uppercase">
        Tilgjengelighet
      </Label>
      <div className="flex items-center gap-3">
        <button
          onClick={() => setAvailabilityStatus("available")}
          className={`flex-1 rounded-lg border px-3 py-2 text-xs font-bold transition-all ${
            availabilityStatus === "available"
              ? isDark
                ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
                : "border-emerald-200 bg-emerald-50 text-emerald-600"
              : isDark
                ? "border-white/10 text-zinc-500 hover:border-white/20"
                : "border-zinc-200 text-zinc-500 hover:border-zinc-300"
          }`}
        >
          Tilgjengelig
        </button>
        <button
          onClick={() => setAvailabilityStatus("time_off")}
          className={`flex-1 rounded-lg border px-3 py-2 text-xs font-bold transition-all ${
            availabilityStatus === "time_off"
              ? isDark
                ? "border-amber-500/30 bg-amber-500/15 text-amber-400"
                : "border-amber-200 bg-amber-50 text-amber-600"
              : isDark
                ? "border-white/10 text-zinc-500 hover:border-white/20"
                : "border-zinc-200 text-zinc-500 hover:border-zinc-300"
          }`}
        >
          Avspasering
        </button>
      </div>
    </div>
  );
}
```

This creates/deletes an absence record via `useCreateAbsence` / `useDeleteAbsence` when toggling. The shift itself stays — the absence is a separate entity overlaid on the same cell.

**Step 3: Wire state and mutations**

- Import `useCreateAbsence`, `useDeleteAbsence` from `../hooks/use-absences`
- Add `const [availabilityStatus, setAvailabilityStatus] = useState<"available" | "time_off">("available")`
- On mount (edit mode): check if there's an absence for this employee+date, set initial state
- On toggle to "time_off": call `createAbsence.mutate({ employeeId, dateId, type: "unpaid_leave", ... })`
- On toggle to "available": call `deleteAbsence.mutate(absenceId)` for the matching absence

**Step 4: Run typecheck**

```bash
pnpm turbo typecheck --filter=web
```

**Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_components/shift-modal.tsx
git commit -m "feat(schedule): add availability toggle to shift detail modal"
```

---

## Phase 5: Month View Enhancements

### Task 6: Add click-to-create and filter integration to MonthlyGridContent

The month view should support clicking cells to create/edit shifts and respect the Jobb/Team filter.

**Files:**

- Modify: `apps/web/src/app/dashboard/schedule/page.tsx` (MonthlyGridContent section)

**Step 1: Read the MonthlyGridContent code**

In `page.tsx`, find the `MonthlyGridContent` component. Understand its current structure.

**Step 2: Add click handler to month cells**

Each cell in the month grid should:

- If empty: open create-shift dialog with the date pre-filled
- If has shifts: show a popover/list of shifts, clicking one opens the shift modal

Use `setCreateShiftContext({ dateId })` for empty cells and `setSelectedShift(shiftId)` for existing shifts. Both already exist in `ScheduleUIContext`.

**Step 3: Add filter integration**

The month view needs to filter shifts by the current `scheduleView` (Ansatt/Jobb/Team). Read `scheduleView` from `DashboardContext`. When "jobb" is selected, group rows by job title. When "team" is selected, group by team. Use the same grouping logic as `GridContent` in `daily-grid.tsx`.

**Step 4: Run typecheck**

```bash
pnpm turbo typecheck --filter=web
```

**Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/page.tsx
git commit -m "feat(schedule): add click-to-create and filter integration to month view"
```

---

## Phase 6: List View Enhancements

### Task 7: Add status filter and clickable cards to ListGridContent

The list view should show a status filter (Draft/Published/Active) and each shift card should open the shift modal on click.

**Files:**

- Modify: `apps/web/src/app/dashboard/schedule/page.tsx` (ListGridContent section)

**Step 1: Read the ListGridContent code**

In `page.tsx`, find the `ListGridContent` component.

**Step 2: Add status filter**

At the top of the list view, add a filter bar:

```tsx
<div className="flex items-center gap-2 px-6 py-3">
  {(["all", "created", "published", "active"] as const).map((status) => (
    <button
      key={status}
      onClick={() => setListStatusFilter(status)}
      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
        listStatusFilter === status
          ? isDark
            ? "border border-orange-500/30 bg-orange-500/20 text-orange-400"
            : "border border-orange-200 bg-orange-50 text-orange-600"
          : isDark
            ? "text-zinc-500 hover:text-zinc-300"
            : "text-zinc-500 hover:text-zinc-700"
      }`}
    >
      {status === "all"
        ? "Alle"
        : status === "created"
          ? "Draft"
          : status === "published"
            ? "Publisert"
            : "Aktive"}
    </button>
  ))}
</div>
```

**Step 3: Filter shifts in list data**

```tsx
const filteredShifts = useMemo(() => {
  if (listStatusFilter === "all") return shiftsData;
  return shiftsData.filter((s) => s.status === listStatusFilter);
}, [shiftsData, listStatusFilter]);
```

**Step 4: Make shift cards clickable**

Each shift card in the list should call `setSelectedShift(shift.id)` on click, which opens the shift modal (already wired in page.tsx).

**Step 5: Run typecheck**

```bash
pnpm turbo typecheck --filter=web
```

**Step 6: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/page.tsx
git commit -m "feat(schedule): add status filter and clickable cards to list view"
```

---

## Phase 7: Day Control Center — Conversations Tab

### Task 8: Enhance Dagsinfo tab with read receipts

The Dagsinfo tab (inside daily-briefing.tsx) already shows messages. Add a "read receipt" indicator showing how many employees have seen the day info.

**Files:**

- Modify: `apps/web/src/app/dashboard/schedule/_components/daily-briefing.tsx`

**Step 1: Read the Dagsinfo tab section in daily-briefing.tsx**

Find the tab that renders messages. Understand the current message card layout.

**Step 2: Add read receipt indicator**

Below the day info header, add:

```tsx
{
  /* Read receipts — placeholder until backend tracking exists */
}
<div className="flex items-center gap-2 px-4 py-2">
  <Eye className="h-3.5 w-3.5 text-zinc-500" />
  <span className="text-xs text-zinc-500">
    {/* TODO: Wire to real read tracking when available */}— av {staffOnDay.length} har sett
    daginfoen
  </span>
</div>;
```

This is a UI placeholder. Full read tracking requires a new DB table (`schedule_day_read_receipt`) and backend logic, which should be a separate feature.

**Step 3: Run typecheck**

```bash
pnpm turbo typecheck --filter=web
```

**Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_components/daily-briefing.tsx
git commit -m "feat(schedule): add read receipt placeholder to day info tab"
```

---

## Phase 8: Oppgaver Tab — Task Library Search

### Task 9: Add task search autocomplete to Oppgaver tab

When adding a task in the Day Control Center's Oppgaver tab, show a search field that autocompletes from existing tasks (task library).

**Files:**

- Modify: `apps/web/src/app/dashboard/schedule/_components/daily-briefing.tsx`

**Step 1: Read the Oppgaver tab section in daily-briefing.tsx**

Find how tasks are currently created and displayed.

**Step 2: Add search autocomplete**

Replace the plain input field for task creation with a searchable input that shows matching existing tasks from the current week's task list:

```tsx
function TaskSearchInput({
  isDark,
  existingTasks,
  onCreateTask,
}: {
  isDark: boolean;
  existingTasks: DayTask[];
  onCreateTask: (title: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Deduplicate task names across all days
  const taskLibrary = useMemo(() => {
    const names = new Set<string>();
    for (const task of existingTasks) {
      names.add(task.title);
    }
    return Array.from(names);
  }, [existingTasks]);

  const filtered = query.trim()
    ? taskLibrary.filter((name) => name.toLowerCase().includes(query.toLowerCase()))
    : [];

  const handleSelect = (title: string) => {
    onCreateTask(title);
    setQuery("");
    setShowSuggestions(false);
  };

  const handleSubmit = () => {
    if (query.trim()) {
      onCreateTask(query.trim());
      setQuery("");
      setShowSuggestions(false);
    }
  };

  return (
    <div className="relative">
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
          }}
          placeholder="Søk eller opprett oppgave..."
          className="text-xs"
        />
        <Button size="sm" variant="ghost" onClick={handleSubmit}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {showSuggestions && filtered.length > 0 && (
        <div
          className={`absolute top-full left-0 z-50 mt-1 max-h-36 w-full overflow-y-auto rounded-xl border p-1 shadow-xl ${
            isDark
              ? "border-white/10 bg-[#111113]/95 backdrop-blur-xl"
              : "border-zinc-200 bg-white shadow-lg"
          }`}
        >
          {filtered.map((name) => (
            <button
              key={name}
              onClick={() => handleSelect(name)}
              className={`flex w-full items-center rounded-lg px-3 py-2 text-xs transition-colors ${
                isDark
                  ? "text-zinc-400 hover:bg-white/5 hover:text-white"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
              }`}
            >
              <ListTodo className="mr-2 h-3.5 w-3.5 text-zinc-500" />
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 3: Replace existing task input with TaskSearchInput**

Find the task creation section in the Oppgaver tab. Replace the direct `<Input>` + button with the `TaskSearchInput` component. Pass the full `allTasks` data (from `useDayTasks` hook) as `existingTasks` for the autocomplete library.

**Step 4: Run typecheck**

```bash
pnpm turbo typecheck --filter=web
```

**Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_components/daily-briefing.tsx
git commit -m "feat(schedule): add task search autocomplete to oppgaver tab"
```

---

## Phase 9: Continuous Horizontal Scroll (Rullerende)

### Task 10: Implement continuous date scrolling

Change the week view from fixed-week navigation to continuous horizontal scrolling. The grid should extend in both directions. Arrow buttons still jump one week, but the user can also scroll freely.

**Files:**

- Modify: `apps/web/src/app/dashboard/schedule/page.tsx` (date range computation)
- Modify: `apps/web/src/app/dashboard/schedule/_components/daily-grid.tsx` (scroll behavior)
- Modify: `apps/web/src/app/dashboard/schedule/_components/grid-surface.tsx` (scroll container)

**Step 1: Extend visible date range**

Instead of computing exactly 7 or 14 days, compute a wider window (e.g., 21 days for 1-week mode, 28 for 2-week mode) centered on the current week offset. This gives "lookahead" days the user can scroll to.

In `page.tsx`, change `getVisibleDays()`:

```tsx
function getVisibleDays(weekOffset: number, weekSpan: 1 | 2): DayColumn[] {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + 1 + weekOffset * 7);

  // Extra days on each side for scroll buffer
  const bufferDays = 7;
  const totalDays = weekSpan * 7 + bufferDays * 2;
  const startDate = new Date(monday);
  startDate.setDate(monday.getDate() - bufferDays);

  const days: DayColumn[] = [];
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    days.push(makeDayColumn(d, today));
  }
  return days;
}
```

**Step 2: Add scroll-to-today behavior**

On mount and on week-offset change, scroll the grid container so the first day of the target week is visible. Use `scrollIntoView` or compute `scrollLeft` based on the buffer offset.

In `daily-grid.tsx`, add a `useEffect` that scrolls the parent container:

```tsx
const gridContainerRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (!gridContainerRef.current) return;
  // Scroll to show the target week start (skip buffer days)
  const bufferDays = 7;
  const scrollTo = bufferDays * DAY_COL_WIDTH;
  gridContainerRef.current.scrollLeft = scrollTo;
}, [weekOffset]);
```

**Step 3: Detect scroll edges for loading more days**

Use an `IntersectionObserver` or `onScroll` handler on the grid container. When the user scrolls near the edge, trigger a week-offset change to load more data. This creates the illusion of infinite scroll while TanStack Query fetches the next batch.

**Step 4: Keep arrow navigation**

Arrow buttons in DashboardShell still change `scheduleDateOffset`. This shifts the "center" of the visible range. The scroll buffer ensures smooth transitions.

**Step 5: Run typecheck**

```bash
pnpm turbo typecheck --filter=web
```

**Step 6: Test scrolling manually**

1. Open schedule page
2. Scroll right — should see days beyond the current week
3. Scroll left — should see past days
4. Click arrow buttons — grid jumps one week
5. Employee sidebar stays sticky

**Step 7: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/page.tsx \
       apps/web/src/app/dashboard/schedule/_components/daily-grid.tsx \
       apps/web/src/app/dashboard/schedule/_components/grid-surface.tsx
git commit -m "feat(schedule): implement continuous horizontal date scrolling"
```

---

## Verification Checklist

After all phases are complete, verify:

- [ ] `pnpm turbo typecheck` passes with 0 errors
- [ ] `pnpm turbo lint --filter=web` passes
- [ ] Filter panel appears bottom-right on all views (daily, monthly, list)
- [ ] Shift leads render in shift modal Detaljer tab
- [ ] Push/SMS dialog opens with message field and dayinfo toggle
- [ ] Availability toggle works in shift modal
- [ ] Month view cells are clickable (create/edit)
- [ ] List view has status filter and clickable cards
- [ ] Task search autocomplete works in Oppgaver tab
- [ ] Horizontal scroll is continuous with sticky employee sidebar
- [ ] Arrow navigation still jumps one week
- [ ] Dark mode works correctly on all new/modified components
- [ ] DnD still works in daily grid after layout changes
- [ ] Realtime updates still trigger (check Supabase subscriptions)

---

## Dependencies Between Tasks

```
Task 1 (control panel) ← independent, do first
Task 2 (shift leads DB) ← independent
Task 3 (shift leads UI) ← depends on Task 2
Task 4 (push/sms dialog) ← independent
Task 5 (availability toggle) ← independent
Task 6 (month view) ← independent
Task 7 (list view) ← independent
Task 8 (read receipts) ← independent
Task 9 (task search) ← independent
Task 10 (continuous scroll) ← independent, most complex, do last
```

Parallel-safe groups:

- **Group A:** Tasks 1, 2, 4, 5, 6, 7, 8, 9 (all independent)
- **Group B:** Task 3 (after Task 2)
- **Group C:** Task 10 (last — most invasive, affects grid layout)
