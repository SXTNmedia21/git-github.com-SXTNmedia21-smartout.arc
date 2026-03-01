# Schedule Page — Polish & Overhaul Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all non-functional buttons, rewire header controls, overhaul the shift modal with dropdowns/presets, add template editing, make filters cross-view, and polish layout/sizing across daily/weekly/monthly views.

**Architecture:** All changes are local-state only (schedule-context.tsx reducer + DashboardShell context). No database changes. Header controls wire into DashboardContext state. Shift modal replaces text inputs with Select dropdowns sourced from schedule-data.ts dummy data.

**Tech Stack:** React 19, shadcn/ui (Select, Dialog, Popover, Switch), @dnd-kit/core, Tailwind v4, DashboardContext + ScheduleContext

---

## Task 1: Wire Date Navigation Buttons

**Files:**

- Modify: `apps/web/src/components/dashboard/DashboardShell.tsx:691-714`
- Modify: `apps/web/src/components/dashboard/DashboardShell.tsx:41-75` (context)

**Why:** Left/right chevrons and the date label in the header have NO onClick handlers. The label is hardcoded text ("Uke 52, 2026", "Aktiv syklus", "Desember 2026"). We need to track a "current date offset" so navigation actually changes the label.

**Step 1: Add scheduleDateOffset to DashboardContext**

In `DashboardShell.tsx`, add to the context default + provider state:

```tsx
// In createContext default (line ~41):
scheduleDateOffset: 0,
setScheduleDateOffset: (_val: number) => { void _val; },

// In DashboardShell component (where the useState calls are):
const [scheduleDateOffset, setScheduleDateOffset] = useState(0);
```

Pass both into the `DashboardContext.Provider` value object.

**Step 2: Wire chevron buttons (lines 695-713)**

Replace the two placeholder `<button>` elements:

```tsx
<button
  onClick={() => setScheduleDateOffset((prev) => prev - 1)}
  className={`rounded-md p-1.5 transition-colors ${isDark ? "text-zinc-400 hover:bg-zinc-800 hover:text-white" : "text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900"}`}
>
  <ChevronLeft className="h-3.5 w-3.5" />
</button>
```

Same for right button with `prev + 1`.

**Step 3: Compute dynamic label from offset**

Replace the hardcoded `<span>` (lines 700-708):

```tsx
<span className={`text-[13px] font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>
  {(() => {
    const baseWeek = 52;
    if (scheduleLayout === "daily") {
      const w = baseWeek + scheduleDateOffset;
      return `Uke ${w}, 2026`;
    }
    if (scheduleLayout === "weekly") {
      return scheduleDateOffset === 0
        ? "Aktiv syklus"
        : `Syklus ${scheduleDateOffset > 0 ? "+" : ""}${scheduleDateOffset}`;
    }
    const months = [
      "Januar",
      "Februar",
      "Mars",
      "April",
      "Mai",
      "Juni",
      "Juli",
      "August",
      "September",
      "Oktober",
      "November",
      "Desember",
    ];
    const monthIdx = (11 + scheduleDateOffset) % 12;
    return `${months[monthIdx < 0 ? monthIdx + 12 : monthIdx]} 2026`;
  })()}
</span>
```

**Step 4: Add "I dag" reset button between chevrons**

After the date label, add a small "I dag" button that resets offset to 0 — only shown when offset !== 0:

```tsx
{
  scheduleDateOffset !== 0 && (
    <button
      onClick={() => setScheduleDateOffset(0)}
      className="rounded-md px-2 py-0.5 text-[10px] font-bold text-orange-400 transition-colors hover:bg-orange-500/10"
    >
      I dag
    </button>
  );
}
```

**Verification:** Click left/right arrows → label changes. Click "I dag" → resets. Works in daily/weekly/monthly.

---

## Task 2: Wire Publish Button

**Files:**

- Modify: `apps/web/src/components/dashboard/DashboardShell.tsx:716-718`
- Modify: `apps/web/src/app/dashboard/schedule/page.tsx:75-90` (SchedulePageInner)
- Modify: `apps/web/src/app/dashboard/schedule/_components/schedule-context.tsx` (new action: PUBLISH_ALL_DRAFTS)

**Why:** "Publiser (4)" button at line 716 has no onClick and hardcoded count. Needs to dispatch PUBLISH_ALL_DRAFTS to the schedule reducer and show the real draft count.

**Step 1: Add PUBLISH_ALL_DRAFTS action to schedule-context.tsx**

In the `ScheduleAction` union (line ~84):

```tsx
| { type: "PUBLISH_ALL_DRAFTS" }
```

In the reducer switch:

```tsx
case "PUBLISH_ALL_DRAFTS": {
  const now = new Date().toISOString();
  const updatedShifts = state.shifts.map((s) =>
    s.status === "created" || s.status === "assigned"
      ? { ...s, status: "published" as const, isPublished: true, updatedAt: now }
      : s
  );
  const historyEntries = state.shifts
    .filter((s) => s.status === "created" || s.status === "assigned")
    .map((s) => ({
      id: generateId("hist"),
      shiftId: s.id,
      eventType: "status_changed" as const,
      field: "status",
      oldValue: s.status,
      newValue: "published",
      timestamp: now,
      actor: "System",
    }));
  return {
    ...state,
    shifts: updatedShifts,
    shiftHistory: [...state.shiftHistory, ...historyEntries],
  };
}
```

**Step 2: Expose draftCount + publishAll from SchedulePageInner up to DashboardShell**

This requires bridging the schedule context to the header. Since DashboardShell wraps the page, we can use a callback pattern:

Add to DashboardContext:

```tsx
onPublishAll: (() => void) | null,
setOnPublishAll: (_val: (() => void) | null) => { void _val; },
scheduleDraftCount: 0,
setScheduleDraftCount: (_val: number) => { void _val; },
```

In `SchedulePageInner`, useEffect to register:

```tsx
const { setOnPublishAll, setScheduleDraftCount } = useContext(DashboardContext);
const draftCount = state.shifts.filter(
  (s) => s.status === "created" || s.status === "assigned",
).length;

useEffect(() => {
  setScheduleDraftCount(draftCount);
  setOnPublishAll(() => () => dispatch({ type: "PUBLISH_ALL_DRAFTS" }));
  return () => {
    setOnPublishAll(null);
    setScheduleDraftCount(0);
  };
}, [draftCount, dispatch, setOnPublishAll, setScheduleDraftCount]);
```

**Step 3: Wire the button in DashboardShell**

Replace line 716-718:

```tsx
<button
  onClick={() => onPublishAll?.()}
  disabled={scheduleDraftCount === 0}
  className={`mr-2 hidden rounded-lg px-4 py-1.5 text-[13px] font-bold text-white shadow-sm transition-all sm:block ${
    scheduleDraftCount > 0
      ? "bg-gradient-to-r from-orange-600 to-rose-600 hover:from-orange-500 hover:to-rose-500"
      : "cursor-not-allowed bg-zinc-700 opacity-50"
  }`}
>
  Publiser ({scheduleDraftCount})
</button>
```

**Verification:** Button shows real count. Click → all drafts become published. Count goes to 0. Button grays out.

---

## Task 3: Shift Modal — Dropdowns for Role, Team, Zone

**Files:**

- Modify: `apps/web/src/app/dashboard/schedule/_components/shift-modal.tsx:519-538,599-607`
- Modify: `apps/web/src/app/dashboard/schedule/_components/schedule-data.ts` (export unique roles/teams/zones)

**Why:** Role (line 523), Team (line 532), and Zone (line 601) are plain `<Input>` text fields. User wants `<Select>` dropdowns populated from the employee data + a "custom" option.

**Step 1: Export unique lists from schedule-data.ts**

```tsx
export const AVAILABLE_ROLES = [...new Set(dummyEmployees.map((e) => e.role))];
export const AVAILABLE_TEAMS = [...new Set(dummyEmployees.map((e) => e.team))];
export const AVAILABLE_ZONES = [
  "Hovedkjøkken",
  "Kaldt kjøkken",
  "Bar",
  "Sal 1",
  "Sal 2",
  "Uteservering",
  "Resepsjon",
];
```

**Step 2: Replace Role input (line 522-528) with Select**

```tsx
<div className="space-y-2">
  <Label htmlFor="role">Rolle</Label>
  <Select value={form.role} onValueChange={(v) => updateField("role", v)}>
    <SelectTrigger id="role">
      <SelectValue placeholder="Velg rolle" />
    </SelectTrigger>
    <SelectContent>
      {AVAILABLE_ROLES.map((r) => (
        <SelectItem key={r} value={r}>
          {r}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

**Step 3: Replace Team input (line 530-538) with Select**

Same pattern with `AVAILABLE_TEAMS`.

**Step 4: Replace Zone input (line 599-607) with Select**

Same pattern with `AVAILABLE_ZONES`.

**Step 5: Import the new constants**

Add to shift-modal.tsx imports:

```tsx
import { dummyEmployees, AVAILABLE_ROLES, AVAILABLE_TEAMS, AVAILABLE_ZONES } from "./schedule-data";
```

**Verification:** Open shift modal → Role, Team, Zone are all dropdowns with pre-populated options. Selecting auto-fills the field.

---

## Task 4: Shift Modal — Tighter Layout & Presets

**Files:**

- Modify: `apps/web/src/app/dashboard/schedule/_components/shift-modal.tsx:460-470,501-577`

**Why:** Modal is too spacious. Needs compact layout with quick-fill presets for common shift patterns.

**Step 1: Add shift presets constant**

```tsx
const SHIFT_PRESETS: {
  label: string;
  startTime: string;
  endTime: string;
  dayCategory: DayCategory;
}[] = [
  { label: "Morgenvakt", startTime: "06:00", endTime: "14:00", dayCategory: "morning" },
  { label: "Dagvakt", startTime: "08:00", endTime: "16:00", dayCategory: "morning" },
  { label: "Kveldsvakt", startTime: "15:00", endTime: "23:00", dayCategory: "evening" },
  { label: "Nattvakt", startTime: "22:00", endTime: "06:00", dayCategory: "night" },
  { label: "Delt vakt", startTime: "10:00", endTime: "14:00", dayCategory: "midday" },
];
```

**Step 2: Add preset buttons above the time fields**

Inside TabsContent "detaljer", before the time row (line ~552):

```tsx
<div className="space-y-1.5">
  <Label className="text-muted-foreground text-xs">Hurtigvalg</Label>
  <div className="flex flex-wrap gap-1.5">
    {SHIFT_PRESETS.map((preset) => (
      <Button
        key={preset.label}
        type="button"
        variant="outline"
        size="sm"
        className="h-7 text-[11px]"
        onClick={() => {
          setForm((prev) => ({
            ...prev,
            startTime: preset.startTime,
            endTime: preset.endTime,
            dayCategory: preset.dayCategory,
          }));
        }}
      >
        {preset.label}
      </Button>
    ))}
  </div>
</div>
```

**Step 3: Tighten spacing**

- Change `DialogContent` max-width from `max-w-2xl` to `max-w-xl` (line 462)
- Change `space-y-4` to `space-y-3` in TabsContent "detaljer" (line 501)
- Change Label font size to `text-xs` where currently unset
- Move work hours display inline next to time fields instead of a separate row

**Verification:** Modal is noticeably more compact. Preset buttons fill in times instantly. Layout doesn't feel cramped.

---

## Task 5: Template Editing

**Files:**

- Create: `apps/web/src/app/dashboard/schedule/_components/edit-template-dialog.tsx`
- Modify: `apps/web/src/app/dashboard/schedule/_components/schedule-context.tsx` (add UPDATE_TEMPLATE + DELETE_TEMPLATE actions)
- Modify: `apps/web/src/app/dashboard/schedule/page.tsx:308-330` (ScheduleSidebar template section)

**Why:** Currently templates can only be created and dragged. No way to edit name, department, or shift rows after creation. No way to delete from the sidebar.

**Step 1: Add actions to schedule-context.tsx**

In `ScheduleAction` union:

```tsx
| { type: "UPDATE_TEMPLATE"; payload: { id: string; changes: Partial<ShiftTemplate> } }
| { type: "DELETE_TEMPLATE"; payload: { id: string } }
```

In the reducer:

```tsx
case "UPDATE_TEMPLATE": {
  return {
    ...state,
    templates: state.templates.map((t) =>
      t.id === action.payload.id ? { ...t, ...action.payload.changes } : t
    ),
  };
}
case "DELETE_TEMPLATE": {
  return {
    ...state,
    templates: state.templates.filter((t) => t.id !== action.payload.id),
  };
}
```

**Step 2: Create edit-template-dialog.tsx**

Follow `create-template-dialog.tsx` pattern exactly, but:

- Accept `template: ShiftTemplate` prop
- Pre-fill form from existing template
- Submit dispatches `UPDATE_TEMPLATE` instead of `ADD_TEMPLATE`
- Add delete button that dispatches `DELETE_TEMPLATE`

```tsx
type EditTemplateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: ShiftTemplate;
};

export function EditTemplateDialog({ open, onOpenChange, template }: EditTemplateDialogProps) {
  // Same form state as create, but initialized from template prop
  // ...
}
```

**Step 3: Wire in ScheduleSidebar**

Add `editingTemplate` state and render `EditTemplateDialog`:

```tsx
const [editingTemplate, setEditingTemplate] = React.useState<ShiftTemplate | null>(null);

// In the template map, make each TemplateCard clickable:
<div onClick={() => setEditingTemplate(t)} className="cursor-pointer">
  <TemplateCard ... />
</div>

// Render the dialog:
{editingTemplate && (
  <EditTemplateDialog
    open={!!editingTemplate}
    onOpenChange={(o) => !o && setEditingTemplate(null)}
    template={editingTemplate}
  />
)}
```

**Verification:** Click template in sidebar → edit dialog opens pre-filled. Change name/shifts → save → sidebar updates. Delete → template removed.

---

## Task 6: Sticky Header in Rolling/Monthly Views

**Files:**

- Modify: `apps/web/src/app/dashboard/schedule/page.tsx:363-395` (WeeklyGridContent left panel)
- Modify: `apps/web/src/app/dashboard/schedule/page.tsx:668-707` (MonthlyGridContent header)

**Why:** When scrolling in rolling or monthly view, the top header area (column headers + stats) scrolls away. It should remain sticky.

**Step 1: WeeklyGridContent — make column headers sticky**

The column header div (line ~446) already has `sticky top-0` but the parent container needs `overflow-y-auto` and the header needs a proper `z-30` to not get covered.

Verify the parent `<div className="flex w-full">` (line 364) allows vertical scrolling. If the content overflows, add `overflow-y-auto` to the scrollable parent.

**Step 2: MonthlyGridContent — fix the stats header**

The stats header (lines 672-707) already has `sticky top-0 z-30`. Verify it stays pinned when content below scrolls. The issue may be that the parent `flex-1` div doesn't have `overflow-y-auto`. Add it to `<div className="flex min-h-0 flex-1">` (line 709):

```tsx
<div className="flex min-h-0 flex-1 overflow-y-auto">
```

**Step 3: Verify the column date headers also stay sticky**

Column date headers at line 765 have `sticky top-0 z-10`. They should stack below the stats header. Test that scrolling keeps both pinned.

**Verification:** Scroll down in monthly view → stats bar stays pinned. Scroll down in rolling view → period headers stay pinned.

---

## Task 7: Rolling View Period Selector Rethink

**Files:**

- Modify: `apps/web/src/components/dashboard/DashboardShell.tsx:674-689`

**Why:** Period selector shows [3,4,5,6,8] — arbitrary numbers. Should be labeled "1 uke", "2 uker", "3 uker", "4 uker" and map to actual week counts (7,14,21,28 days → simplified to column counts).

**Step 1: Replace number buttons with labeled options**

```tsx
{
  scheduleLayout === "weekly" && (
    <div
      className={`hidden items-center gap-0.5 rounded-xl border p-1 shadow-sm md:flex ${isDark ? "border-zinc-800 bg-[#0a0a0c]" : "border-zinc-200 bg-zinc-100"} mr-2`}
    >
      {[
        { label: "1 uke", count: 7 },
        { label: "2 uker", count: 14 },
        { label: "3 uker", count: 7 },
        { label: "4 uker", count: 7 },
      ].map(({ label, count }) => (
        <button
          key={label}
          onClick={() => setWeeklyPeriodCount(count)}
          className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all ${weeklyPeriodCount === count ? (isDark ? "bg-zinc-800 text-white shadow-sm" : "bg-white text-zinc-900 shadow-sm") : isDark ? "text-zinc-500 hover:text-white" : "text-zinc-500 hover:text-zinc-900"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
```

**NOTE:** The rolling view currently uses `weeklyPeriodCount` as the column count. Since the view shows "periods" (not strictly weeks), we need to decide: use literal week counts (7/14/21/28 columns → too many) or keep it as grouping sizes. The most practical approach is to map [1 uke, 2 uker, 3 uker, 4 uker] → [7, 14, 7, 7] columns where "2 uker" means 14 columns but "1 uke" means 7. However, that's still too many columns for the compact view.

**Better approach:** Keep column counts reasonable. Map labels to:

- "1u" → 7 columns
- "2u" → 10 columns
- "3u" → 14 columns
- "Mnd" → 20 columns

Or simply relabel the existing [3,4,5,6,8] as:

```tsx
{[
  { label: "3d", count: 3 },
  { label: "1u", count: 7 },
  { label: "2u", count: 10 },
  { label: "3u", count: 14 },
].map(...)
```

This gives meaningful labels while keeping the rolling view practical. Discuss with user which approach.

**Verification:** Rolling view shows labeled period options instead of bare numbers.

---

## Task 8: Cross-View Filters (Jobb, Team, Situation)

**Files:**

- Modify: `apps/web/src/app/dashboard/schedule/page.tsx:75-80` (lift filter state)
- Modify: `apps/web/src/app/dashboard/schedule/page.tsx:350-498` (WeeklyGridContent)
- Modify: `apps/web/src/app/dashboard/schedule/page.tsx:629-807` (MonthlyGridContent)
- Modify: `apps/web/src/app/dashboard/schedule/_components/planner-command-bar.tsx:33-48` (situation filter)

**Why:** View toggles (ansatt/jobb/team) and situation filter (Alle/Selskap/Krise/Normal) only affect daily view. They should filter data in weekly and monthly views too.

**Step 1: Pass scheduleView to WeeklyGridContent + MonthlyGridContent**

Both components already read `scheduleView` from DashboardContext (WeeklyGridContent line 359). The issue is that the data isn't filtered by view mode.

**Step 2: Apply scheduleView grouping to WeeklyGridContent**

Currently shows hardcoded TeamGroup blocks. When `scheduleView === "jobb"`:

- Group by role (Sous Chef, Kokk, Manager, Housekeeping) instead of team
- When `scheduleView === "team"`: current behavior (grouped by team)
- When `scheduleView === "ansatt"`: flat list, no grouping

```tsx
const groupedEmployees = React.useMemo(() => {
  if (scheduleView === "team") {
    // Group by team
    const map = new Map<string, typeof dummyEmployees>();
    for (const emp of dummyEmployees) {
      const list = map.get(emp.team) ?? [];
      list.push(emp);
      map.set(emp.team, list);
    }
    return Array.from(map.entries());
  }
  if (scheduleView === "jobb") {
    // Group by role
    const map = new Map<string, typeof dummyEmployees>();
    for (const emp of dummyEmployees) {
      const list = map.get(emp.role) ?? [];
      list.push(emp);
      map.set(emp.role, list);
    }
    return Array.from(map.entries());
  }
  // "ansatt" — flat list
  return [["Alle ansatte", dummyEmployees] as const];
}, [scheduleView]);
```

Replace hardcoded TeamGroup blocks with dynamic rendering from `groupedEmployees`.

**Step 3: Apply filterSituation to all views**

Pass `filterSituation` down to WeeklyGridContent and MonthlyGridContent. Filter which data to show based on it. For the local-state prototype, "Selskap" shows only days with bookings, "Krise" shows days with coverage risks, "Normal" shows days without risks.

```tsx
{
  scheduleLayout === "weekly" && (
    <WeeklyGridContent
      isSidebarOpen={isSidebarOpen}
      setIsSidebarOpen={setIsSidebarOpen}
      onDateClick={setSelectedDate}
      filterSituation={filterSituation}
    />
  );
}
```

In WeeklyGridContent, visually highlight columns that match the situation filter (orange tint for Selskap, red tint for Krise).

**Verification:** Switch to weekly → toggle ansatt/jobb/team → left panel grouping changes. Set situation filter → column highlighting changes.

---

## Task 9: Status Strip — Clickable Badges

**Files:**

- Modify: `apps/web/src/app/dashboard/schedule/_components/status-strip.tsx`
- Modify: `apps/web/src/app/dashboard/schedule/page.tsx:168` (StatusStrip props)

**Why:** Status badges (Draft, Published, Active, Completed, Fravær, Dekningsrisiko, etc.) are purely informational. Clicking should filter the view to show only matching shifts.

**Step 1: Add onFilterClick prop to StatusStrip**

```tsx
type StatusStripProps = {
  isDark: boolean;
  statusSummary: StatusSummary;
  activeFilter: string | null;
  onFilterClick: (filter: string | null) => void;
};
```

**Step 2: Make each badge a button**

Replace `<span>` wrappers with `<button>` and add onClick:

```tsx
<button
  onClick={() => onFilterClick(activeFilter === "draft" ? null : "draft")}
  className={`rounded-md border px-2 py-0.5 text-[11px] font-medium transition-all ${
    activeFilter === "draft"
      ? "border-orange-500/40 bg-orange-500/20 text-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.2)]"
      : "border-zinc-500/8 bg-zinc-500/[0.03] text-zinc-500 hover:bg-zinc-500/10"
  }`}
>
  Draft {statusSummary.draftCount}
</button>
```

Same pattern for Published, Active, Completed, Fravær.

**Step 3: Add activeStatusFilter state in SchedulePageInner**

```tsx
const [activeStatusFilter, setActiveStatusFilter] = useState<string | null>(null);
```

Pass to StatusStrip and forward to GridContent. In the daily view, apply the filter to which shifts are highlighted (dim non-matching shifts with `opacity-30` instead of hiding them).

**Verification:** Click "Draft" badge → it highlights, draft shifts glow, others dim. Click again → filter clears.

---

## Task 10: Sidebar Full Height

**Files:**

- Modify: `apps/web/src/app/dashboard/schedule/page.tsx:261-263` (ScheduleSidebar)
- Modify: `apps/web/src/app/dashboard/schedule/_components/grid-surface.tsx` (if layout structure prevents it)

**Why:** The sidebar currently starts below the PlannerCommandBar and StatusStrip. User wants it to extend the full height from the header down.

**Step 1: Check grid-surface.tsx layout**

Read the file to understand the current layout structure. The sidebar is rendered inside `<GridSurface leftSidebar={...}>` which is below the PlannerCommandBar and StatusStrip (lines 160-168 in page.tsx).

**Step 2: Move sidebar outside GridSurface**

Restructure SchedulePageInner so the sidebar wraps the entire content area including command bar and status strip:

```tsx
<div className="flex flex-1 overflow-hidden">
  {/* Sidebar — full height from top */}
  <ScheduleSidebar ... />

  {/* Main content column */}
  <div className="flex min-w-0 flex-1 flex-col">
    <PlannerCommandBar ... />
    <StatusStrip ... />
    <DndContext ...>
      <GridSurface centerContent={...} dayInspector={...} />
    </DndContext>
  </div>
</div>
```

This makes the sidebar span from the top of the schedule container (below the DashboardShell header) to the bottom.

**Verification:** Sidebar stretches full height. Command bar and status strip only span the content area. No visual jump when toggling sidebar.

---

## Task 11: Increase Text Sizes

**Files:**

- Modify: `apps/web/src/app/dashboard/schedule/_components/daily-grid.tsx` (employee names, shift details)
- Modify: `apps/web/src/app/dashboard/schedule/page.tsx` (sidebar labels, weekly/monthly text)
- Modify: `apps/web/src/app/dashboard/schedule/_components/status-strip.tsx` (badge text)

**Why:** Many text elements use `text-[10px]`, `text-[9px]`, `text-[8px]` — too small on most screens.

**Step 1: Audit and bump sizes**

Apply these minimum size rules:

- Body text: `text-xs` minimum (was `text-[10px]` or smaller)
- Labels/headers: `text-sm` minimum (was `text-xs`)
- Micro labels (tracking-widest uppercase): `text-[11px]` minimum (was `text-[9px]`, `text-[8px]`)
- Sidebar section headers: `text-xs` minimum (was `text-[10px]`)

Target files and approximate locations:

- `daily-grid.tsx`: Employee name cells, day column headers, cost indicators
- `page.tsx` line 286: "Åpen Vakt" header `text-[10px]` → `text-xs`
- `page.tsx` line 309: "Maler per avdeling" header → `text-xs`
- `page.tsx` line 458: Weekly period labels `text-[9px]` → `text-[11px]`
- `page.tsx` line 578: EntityRow shift/hour text `text-[8px]` → `text-[10px]`
- `status-strip.tsx` lines 58-78: Right-side badges `text-[11px]` → `text-xs`

**Step 2: Verify readability at 1920x1080**

Check that text is legible on a standard monitor without straining.

**Verification:** All text readable at normal viewing distance. No `text-[8px]` or `text-[9px]` remaining in schedule components.

---

## Task 12: Monthly Heatmap Cell Info

**Files:**

- Modify: `apps/web/src/app/dashboard/schedule/page.tsx:848-865` (HeatmapCell)
- Modify: `apps/web/src/app/dashboard/schedule/page.tsx:781-799` (where HeatmapCell is rendered)

**Why:** Monthly heatmap cells are blank colored squares. User wants time/info content visible inside them.

**Step 1: Add content props to HeatmapCell**

```tsx
function HeatmapCell({
  colorClass,
  onClick,
  shiftCount,
  timeRange,
}: {
  colorClass: string;
  onClick?: () => void;
  shiftCount?: number;
  timeRange?: string;
}) {
```

**Step 2: Render mini-info inside the cell**

```tsx
<div
  onClick={onClick}
  className={`h-full w-full rounded-sm border ${colorClass} flex cursor-pointer flex-col items-center justify-center opacity-80 transition-opacity hover:opacity-100`}
  title="Klikk for detaljer"
>
  {shiftCount !== undefined && shiftCount > 0 && (
    <>
      <span className="text-[8px] leading-none font-black">{shiftCount}</span>
      {timeRange && (
        <span className="mt-0.5 text-[6px] leading-none text-zinc-500">{timeRange}</span>
      )}
    </>
  )}
</div>
```

**Step 3: Compute per-cell data when rendering**

In the map where HeatmapCell is rendered (line ~782):

```tsx
const teamShifts = dateId
  ? state.shifts.filter(s => s.dateId === dateId && /* team match */)
  : [];
const shiftCount = teamShifts.length;
const timeRange = teamShifts.length > 0
  ? `${teamShifts[0].startTime}-${teamShifts[teamShifts.length-1].endTime}`
  : undefined;

<HeatmapCell
  colorClass={getHeatmapColor(rowIdx)}
  onClick={() => dateId && onDateClick?.(dummyDays[col-1]?.label ?? `Dag ${col}`)}
  shiftCount={shiftCount}
  timeRange={timeRange}
/>
```

**Verification:** Monthly cells show shift count and time range. Empty days show nothing.

---

## Task 13: Empty Date Click → Create Shift

**Files:**

- Modify: `apps/web/src/app/dashboard/schedule/page.tsx:763-780` (MonthlyGridContent column headers)
- Modify: `apps/web/src/app/dashboard/schedule/_components/daily-grid.tsx` (if applicable)

**Why:** Clicking on a date that has no shifts should still let the user fill in information (open shift modal or day inspector).

**Step 1: Monthly view — column header click opens day inspector**

Already works via `onDateClick` (line 764). But if the date has no data, the DayInspector may show empty. The user wants it to also trigger shift creation.

Add a fallback: if no shifts exist for that day, also open the create shift context:

```tsx
onClick={() => {
  if (dateId) {
    onDateClick?.(dummyDays[col - 1]?.label ?? `Dag ${col}`);
    // Also open shift creation if no shifts exist
    const dayShifts = state.shifts.filter(s => s.dateId === dateId);
    if (dayShifts.length === 0) {
      dispatch({ type: "SET_CREATE_SHIFT_CONTEXT", payload: { dateId } });
    }
  }
}}
```

**Step 2: Daily view — clicking empty cell already dispatches SET_CREATE_SHIFT_CONTEXT**

This is already wired. Verify it works.

**Verification:** Monthly view → click empty date → shift modal opens. Daily view → click empty cell → shift modal opens.

---

## Task 14: Location Selector in Header

**Files:**

- Modify: `apps/web/src/components/dashboard/DashboardShell.tsx:596-609` (location selector)

**Why:** Location selector shows "Alle Lokasjoner" with a chevron but has no dropdown. Needs a clickable dropdown to change location.

**Step 1: Add location options and toggle state**

```tsx
const LOCATIONS = ["Alle Lokasjoner", "Hovedrestaurant", "Bar & Lounge", "Uteservering", "Kjøkken"];
const [locationMenuOpen, setLocationMenuOpen] = useState(false);
```

**Step 2: Replace button with Popover**

Wrap the location button in a shadcn Popover:

```tsx
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

<Popover open={locationMenuOpen} onOpenChange={setLocationMenuOpen}>
  <PopoverTrigger asChild>
    <button className="group flex items-center gap-1.5 text-xs font-bold text-white transition-colors hover:text-orange-400">
      {activeLocation}
      <ChevronDown className="h-3.5 w-3.5 text-zinc-500 transition-colors group-hover:text-orange-400" />
    </button>
  </PopoverTrigger>
  <PopoverContent align="start" className="w-48 p-1">
    {LOCATIONS.map((loc) => (
      <button
        key={loc}
        onClick={() => {
          setActiveLocation(loc);
          setLocationMenuOpen(false);
        }}
        className={`w-full rounded-md px-3 py-1.5 text-left text-xs font-medium transition-colors ${
          activeLocation === loc
            ? "bg-orange-500/20 text-orange-400"
            : "text-foreground hover:bg-muted"
        }`}
      >
        {loc}
      </button>
    ))}
  </PopoverContent>
</Popover>;
```

**Verification:** Click location → dropdown shows options. Select one → label updates. State persists across view changes.

---

## Execution Order

```
Round 1 (independent — different files):
  Task 1   DashboardShell.tsx — date nav
  Task 3   shift-modal.tsx — dropdowns
  Task 5   edit-template-dialog.tsx (new) + schedule-context.tsx
  Task 9   status-strip.tsx — clickable badges

Round 2 (depends on Round 1):
  Task 2   DashboardShell.tsx + page.tsx — publish button (needs context from Task 1)
  Task 4   shift-modal.tsx — presets + compact (after Task 3 dropdowns)
  Task 7   DashboardShell.tsx — period selector relabel
  Task 14  DashboardShell.tsx — location dropdown

Round 3 (layout + styling):
  Task 6   page.tsx — sticky headers
  Task 10  page.tsx — sidebar full height
  Task 11  All schedule files — text size bump

Round 4 (data-dependent):
  Task 8   page.tsx + planner-command-bar.tsx — cross-view filters
  Task 12  page.tsx — monthly cell info
  Task 13  page.tsx — empty date click
```

---

## Verification

1. `pnpm typecheck` — no new errors
2. Daily view: All buttons functional, dropdowns in shift modal, presets work
3. Weekly view: Period labels readable, filters active, headers sticky
4. Monthly view: Cell info visible, clickable empty dates, heatmap colors work
5. Sidebar: Full height, template edit works, create template works
6. Header: Date nav changes label, publish button shows real count, location dropdown works
7. Status strip: Badges clickable, filter toggles on/off
