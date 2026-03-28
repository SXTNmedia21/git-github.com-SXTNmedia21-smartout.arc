---
title: Dashboard Polish Implementation Plan
status: done
updated: 2026-03-03
created: 2026-03-03
module: dashboard
tags: [plan, dashboard, heatmap, day-drawer, strategic, events]
---

# Dashboard Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix heatmap UX, wire day-click to DayControlSheet everywhere, fix strategic overflow, enable event creation from dashboard.

**Architecture:** DayControlSheet (already on development from sma-19 merge) becomes the shared "day drawer" used from TacticalView and ReconciliationView. Heatmap gets cell click → activity detail panel. StrategicView overflow fixed by removing hard min-height constraint.

**Tech Stack:** React 19, TypeScript, Tailwind v4, Framer Motion, DayControlSheet, TanStack Query

---

### Task 1: Fix StrategicView Overflow

The Turnover chart has `min-h-[320px]` that forces content past viewport. ActionStrip (h-14) + KPI grid (~320px) + chart (320px forced) = overflow.

**Files:**

- Modify: `apps/web/src/components/dashboard/StrategicView.tsx:326-360`

**Step 1: Remove hard min-height, add responsive constraints**

Change the Main Insights Row from CSS Grid to flex:

```tsx
// Line 326: change from grid to flex
<div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row">
```

Change the Turnover card (line 329):

```tsx
// Remove: min-h-[320px]
// Add: min-h-0 lg:min-h-[240px]
<div className={`relative flex min-h-0 flex-col overflow-hidden rounded-3xl border p-6 shadow-sm lg:min-h-[240px] lg:flex-[2] ${isDark ? "border-zinc-800 bg-[#0c0c0e]" : "border-zinc-200 bg-white"}`}>
```

Change the Pipeline card (line 364):

```tsx
<div className={`relative flex min-h-0 flex-col overflow-hidden rounded-3xl border p-6 shadow-sm lg:flex-1 ${isDark ? ...}`}>
```

**Step 2: Commit**

```bash
git add apps/web/src/components/dashboard/StrategicView.tsx
git commit -m "fix(dashboard): strategic view overflow — remove hard min-h, use flex layout"
```

---

### Task 2: Wire Day Click → DayControlSheet on TacticalView

Instead of `router.push("/dashboard/schedule")`, clicking a coverage day bar opens the DayControlSheet bottom drawer.

**Files:**

- Modify: `apps/web/src/components/dashboard/TacticalView.tsx`
- Modify: `apps/web/src/components/dashboard/AdminDashboard.tsx`

**Step 1: Add selectedDate state + DayControlSheet to AdminDashboard**

AdminDashboard wraps all views and is the right place for the shared drawer. DayControlSheet needs `useScheduleUI` context, so we also need to wrap with ScheduleUIProvider.

```tsx
// AdminDashboard.tsx
import { useState } from "react";
import { ScheduleUIProvider } from "@/app/dashboard/schedule/_components/schedule-ui-context";
import { DayControlSheet, DayControlPanel } from "@/app/dashboard/schedule/_components/day-control";

export default function AdminDashboard({ isDark }: AdminDashboardProps) {
  const { adminView } = useContext(DashboardContext);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  return (
    <ScheduleUIProvider>
      <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
        {adminView === "tactical" ? (
          <TacticalView isDark={isDark} onDateClick={setSelectedDate} />
        ) : adminView === "strategic" ? (
          <StrategicView isDark={isDark} />
        ) : adminView === "reconciliation" ? (
          <ReconciliationView isDark={isDark} />
        ) : (
          <ActivityView isDark={isDark} />
        )}

        <DayControlSheet selectedDate={selectedDate} onClose={() => setSelectedDate(null)}>
          <DayControlPanel date={selectedDate} onClose={() => setSelectedDate(null)} />
        </DayControlSheet>
      </div>
    </ScheduleUIProvider>
  );
}
```

**Step 2: Add onDateClick prop to TacticalView**

```tsx
// TacticalView.tsx
interface TacticalViewProps {
  isDark: boolean;
  onDateClick?: (date: string) => void;
}
```

Replace `router.push("/dashboard/schedule")` with `onDateClick?.(d.date)` in the coverage bar button's onClick.

Remove `useRouter` import if no longer needed.

**Step 3: Commit**

```bash
git add apps/web/src/components/dashboard/AdminDashboard.tsx apps/web/src/components/dashboard/TacticalView.tsx
git commit -m "feat(dashboard): day click opens DayControlSheet drawer instead of navigating"
```

---

### Task 3: Add Event Creation from Upcoming Events Widget

The Plus button in TacticalView's "Upcoming Events" needs an onClick handler that opens a dialog.

**Files:**

- Modify: `apps/web/src/components/dashboard/TacticalView.tsx`
- Reuse: `apps/web/src/app/dashboard/schedule/_components/day-info-dialog.tsx` (already exists)

**Step 1: Add event creation state + dialog**

```tsx
// TacticalView.tsx — add state
const [showEventDialog, setShowEventDialog] = useState(false);
```

Wire Plus button onClick:

```tsx
<button
  onClick={() => setShowEventDialog(true)}
  className={`rounded-lg p-1 transition-colors ${isDark ? "hover:bg-white/5" : "hover:bg-zinc-100"}`}
  title="Add event"
>
  <Plus className={`h-3.5 w-3.5 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
</button>
```

Import and render DayInfoDialog:

```tsx
import { DayInfoDialog } from "@/app/dashboard/schedule/_components/day-info-dialog";

// In JSX, after the main container:
<DayInfoDialog open={showEventDialog} onOpenChange={setShowEventDialog} date={weekStart} />;
```

**Step 2: Commit**

```bash
git add apps/web/src/components/dashboard/TacticalView.tsx
git commit -m "feat(dashboard): add event creation from upcoming events widget"
```

---

### Task 4: Heatmap Overhaul — Fill Area + Cell Click → Activity Detail

The heatmap needs to: (a) always fill available space, (b) show activity detail when clicking a cell, (c) show task/event split for single-day view.

**Files:**

- Modify: `apps/web/src/components/dashboard/ActivityView.tsx`

**Step 1: Make heatmap fill available area always**

The cells currently use fixed `w-3.5 h-3.5`. Change to flex-based sizing that fills the container:

```tsx
// Change cell grid: fixed-size gap-based → flex fill
<div className="flex flex-1 gap-px">
  {row.data.map((val, cellIdx) => (
    <div
      key={cellIdx}
      onClick={() => handleCellClick(row.label, cellIdx)}
      title={`${row.label} - Day ${cellIdx + 1}: Score ${val}`}
      className={`flex-1 cursor-pointer rounded-sm transition-all duration-300 hover:z-10 hover:brightness-125 ${getIntensityClass(val, isDark)}`}
      style={{ minHeight: "14px" }}
    />
  ))}
</div>
```

Remove the fixed `width: ${days * 16}px` from the grid wrapper — let flex handle it:

```tsx
// Replace the outer min-w-fit + fixed width approach with flex fill
<div className="flex-1 overflow-x-auto p-4">
  <div className="flex h-full flex-col gap-0.5">
    {/* Day labels row */}
    <div className="mb-1 flex items-end">
      <div className="w-24 flex-shrink-0" />
      <div className="flex flex-1 gap-px">
        {dayLabels.map((d) => (
          <div key={d.index} className="flex-1 text-center">
            <span className="text-muted-foreground text-[10px] font-medium">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
    {/* Data rows — flex fill */}
    ...
  </div>
</div>
```

**Step 2: Add cell click → activity detail panel**

Add state for selected cell:

```tsx
const [selectedCell, setSelectedCell] = useState<{ row: string; dayIndex: number } | null>(null);
```

Add handleCellClick:

```tsx
function handleCellClick(rowLabel: string, dayIndex: number) {
  setSelectedCell((prev) =>
    prev?.row === rowLabel && prev?.dayIndex === dayIndex ? null : { row: rowLabel, dayIndex },
  );
}
```

Add a detail panel below the heatmap (inside the same card):

```tsx
{
  selectedCell && (
    <div className="border-border border-t p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-foreground text-sm font-bold">
          {selectedCell.row} — Day {selectedCell.dayIndex + 1}
        </h4>
        <button
          onClick={() => setSelectedCell(null)}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <ActivityDetailPanel
        label={selectedCell.row}
        dayIndex={selectedCell.dayIndex}
        days={days}
        isDark={isDark}
      />
    </div>
  );
}
```

**Step 3: ActivityDetailPanel component**

When timeRange is "today" (1 day), show hourly breakdown with tasks/events. Otherwise show daily activity log.

```tsx
function ActivityDetailPanel({
  label,
  dayIndex,
  days,
  isDark,
}: {
  label: string;
  dayIndex: number;
  days: number;
  isDark: boolean;
}) {
  if (days === 1) {
    // Single day: show hourly timeline with mock events/tasks
    const hours = Array.from({ length: 17 }, (_, i) => i + 6); // 06:00-22:00
    return (
      <div className="space-y-1">
        <p className="text-muted-foreground mb-2 text-xs">Hourly breakdown</p>
        {hours.map((h) => {
          const activity = Math.floor(Math.random() * 100);
          return (
            <div key={h} className="flex items-center gap-3">
              <span className="text-muted-foreground w-12 font-mono text-xs">
                {String(h).padStart(2, "0")}:00
              </span>
              <div className="bg-muted/30 h-4 flex-1 overflow-hidden rounded-sm">
                <div
                  className="h-full bg-indigo-500/60 transition-all"
                  style={{ width: `${activity}%` }}
                />
              </div>
              <span className="text-muted-foreground w-8 text-right text-xs">{activity}</span>
            </div>
          );
        })}
      </div>
    );
  }

  // Multi-day: show activity log entries
  const entries = Array.from({ length: 5 }, (_, i) => ({
    time: `${8 + i * 2}:${i % 2 === 0 ? "00" : "30"}`,
    event: ["Shift start", "Training session", "Break period", "Inspection", "Shift end"][i],
    score: Math.floor(Math.random() * 100),
  }));

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground mb-2 text-xs">Activity log for day {dayIndex + 1}</p>
      {entries.map((e, i) => (
        <div key={i} className="border-border flex items-center gap-3 rounded-lg border p-2">
          <span className="text-muted-foreground w-12 font-mono text-xs">{e.time}</span>
          <span className="text-foreground flex-1 text-sm">{e.event}</span>
          <div
            className={`rounded px-2 py-0.5 text-xs font-bold ${
              e.score >= 80
                ? "bg-emerald-500/10 text-emerald-500"
                : e.score >= 50
                  ? "bg-amber-500/10 text-amber-500"
                  : "bg-red-500/10 text-red-500"
            }`}
          >
            {e.score}
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Step 4: Make row labels wider and rows taller to fill space**

```tsx
// Row container: use flex-1 to fill available height
<motion.div className="group hover:bg-muted/50 flex flex-1 cursor-crosshair items-center rounded-md p-1 transition-colors">
  <div className="text-muted-foreground group-hover:text-foreground w-24 flex-shrink-0 truncate pr-3 text-xs font-semibold">
    {row.label}
  </div>
  <div className="flex flex-1 gap-px">{/* cells with flex-1 */}</div>
</motion.div>
```

**Step 5: Commit**

```bash
git add apps/web/src/components/dashboard/ActivityView.tsx
git commit -m "feat(dashboard): heatmap fills area, cell click shows activity detail"
```

---

### Task 5: Day Drawer Perspective Tabs (Budget, Operations, Staffing, Information)

Extend the DayControlPanel with additional perspective tabs beyond the current 4 (Oversikt, Dagsinfo, Bookings, Oppgaver).

**Files:**

- Modify: `apps/web/src/app/dashboard/schedule/_components/day-control/DayControlPanel.tsx`
- Create: `apps/web/src/app/dashboard/schedule/_components/day-control/BudgetTab.tsx`
- Create: `apps/web/src/app/dashboard/schedule/_components/day-control/StaffingTab.tsx`

**Step 1: Add new tab types and buttons**

Extend TabId type:

```tsx
type TabId = "oversikt" | "meldinger" | "bookings" | "oppgaver" | "budget" | "bemanning";
```

Add tab buttons (using icons from lucide):

- "Budsjett" (DollarSign icon) — shows budget vs actual for the day
- "Bemanning" (Users icon) — staffing coverage, hours breakdown

**Step 2: Create BudgetTab**

Shows the day's budget data: revenue target, labor target, food cost, actual vs planned (mock data for now since we don't have actuals).

```tsx
function BudgetTab({ dateId }: { dateId: string | null }) {
  // Use the existing useBudget hook
  // Show: Revenue Target, Labor Target, Food Cost for the day
  // Display as simple KPI cards
}
```

**Step 3: Create StaffingTab**

Shows staffing breakdown: total hours, cost, department split, open shifts.

```tsx
function StaffingTab({ dateId }: { dateId: string | null }) {
  // Use shifts data filtered to the day
  // Show: total staff, total hours, by department, by role
}
```

**Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_components/day-control/
git commit -m "feat(day-control): add budget and staffing perspective tabs"
```

---

## Execution Order

1. **Task 1** (StrategicView overflow) — independent, quick fix
2. **Task 2** (Day click → drawer) — needs ScheduleUIProvider in AdminDashboard
3. **Task 3** (Event creation) — independent, extends TacticalView
4. **Task 4** (Heatmap overhaul) — independent, largest task
5. **Task 5** (Day drawer perspectives) — depends on Task 2 being done

Tasks 1, 3, 4 are independent. Task 2 should come before Task 5.
