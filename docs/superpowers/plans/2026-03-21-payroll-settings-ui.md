# Payroll Settings UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Each task dispatches a `frontend-designer` subagent** for component implementation.

**Goal:** Build all payroll and schedule settings screens so admins can configure employee groups, shift types, salary codes, supplement rules, break rules, holiday calendars, meal rules, working time rules, and general payroll settings through the existing Settings page.

**Architecture:** Extends the existing Settings tab system (`apps/web/src/app/dashboard/settings/`) with 3 new top-level tabs (Payroll, Schedule, Holidays) containing sub-tabs. Each sub-tab is a CRUD screen backed by TanStack Query + react-hook-form + Zod. Follows the established pattern from `OpeningHoursSettings` component.

**Depends on:** `2026-03-21-payroll-data-foundation.md` (all 23 tables must exist and types regenerated).

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind v4, shadcn/ui (new-york), TanStack Query v5, react-hook-form, Zod, Lucide icons

**Design system:**

- Style: Clean & Warm ("Ren och varm") — the established Smartout design language
- Colors: CSS variables only (`bg-background`, `text-foreground`, `border-border`)
- Components: shadcn/ui exclusively. Form + FormField + zodResolver pattern.
- Tables: shadcn Table for simple lists, DataTable (TanStack Table) for sortable/filterable lists
- Dialogs: Sheet for create/edit forms (slide-in from right), Dialog for confirmations
- Toasts: `sonner` for success/error feedback
- Icons: Lucide exclusively, consistent 16px (h-4 w-4) in buttons, 20px (h-5 w-5) standalone
- Loading: Skeleton screens (not spinners) for initial load, Loader2 spinner for mutations

**Existing patterns (verified from codebase):**

- Settings tab nav: `apps/web/src/app/dashboard/settings/_components/settings-tabs.tsx` — left sidebar nav with icon + label
- Data fetching: `useQuery` with workspace context from `useWorkspaceOptional()`
- Supabase client: `createClient()` from `@smartout/supabase/client`
- Mutations: `useMutation` + `emit()` from `@smartout/telemetry` in `onSuccess`
- Form pattern: local state + save button (OpeningHoursSettings), or react-hook-form + zodResolver (GovernanceOverview)
- CRUD dialogs: Sheet for forms (organization EditDepartmentDialog), Dialog for delete confirmation

**Spec:** Payroll feature spec Sections 6.1-6.4, Section 1.1-1.7

---

## File Structure

### Shared Hooks & Types

| File                                                                   | Responsibility                                     |
| ---------------------------------------------------------------------- | -------------------------------------------------- |
| `apps/web/src/app/dashboard/settings/_hooks/use-payroll-settings.ts`   | CRUD hook for `payroll_workspace_settings`         |
| `apps/web/src/app/dashboard/settings/_hooks/use-employee-groups.ts`    | CRUD hook for `payroll_employee_group` + members   |
| `apps/web/src/app/dashboard/settings/_hooks/use-shift-types.ts`        | CRUD hook for `payroll_shift_type`                 |
| `apps/web/src/app/dashboard/settings/_hooks/use-salary-codes.ts`       | CRUD hook for `payroll_salary_code`                |
| `apps/web/src/app/dashboard/settings/_hooks/use-supplement-rules.ts`   | CRUD hook for `payroll_supplement_rule`            |
| `apps/web/src/app/dashboard/settings/_hooks/use-break-rules.ts`        | CRUD hook for `payroll_break_rule`                 |
| `apps/web/src/app/dashboard/settings/_hooks/use-holiday-calendars.ts`  | CRUD hook for `payroll_holiday_calendar` + entries |
| `apps/web/src/app/dashboard/settings/_hooks/use-meal-rules.ts`         | CRUD hook for `payroll_meal_rule`                  |
| `apps/web/src/app/dashboard/settings/_hooks/use-working-time-rules.ts` | CRUD hook for `payroll_working_time_rule`          |

### Settings Tab Components

| File                                                                              | Responsibility                                                      |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `apps/web/src/app/dashboard/settings/_components/settings-tabs.tsx`               | **MODIFY** — add Payroll, Schedule, Holidays tabs                   |
| `apps/web/src/app/dashboard/settings/_components/payroll-general-settings.tsx`    | General payroll config (period type, default codes, employer costs) |
| `apps/web/src/app/dashboard/settings/_components/salary-codes-settings.tsx`       | Salary code CRUD table + create/edit sheet                          |
| `apps/web/src/app/dashboard/settings/_components/employee-groups-settings.tsx`    | Employee group CRUD + member management                             |
| `apps/web/src/app/dashboard/settings/_components/supplement-rules-settings.tsx`   | Supplement rule CRUD for all 6 types                                |
| `apps/web/src/app/dashboard/settings/_components/meal-rules-settings.tsx`         | Meal deduction/contribution CRUD                                    |
| `apps/web/src/app/dashboard/settings/_components/shift-types-settings.tsx`        | Shift type CRUD with color picker and feature flags                 |
| `apps/web/src/app/dashboard/settings/_components/break-rules-settings.tsx`        | Break rule CRUD                                                     |
| `apps/web/src/app/dashboard/settings/_components/working-time-rules-settings.tsx` | Working time rule config with block/warn toggle                     |
| `apps/web/src/app/dashboard/settings/_components/holiday-calendar-settings.tsx`   | Holiday calendar CRUD + import from public_holiday                  |

---

## Task 1: Extend Settings Tab Navigation

**Files:**

- Modify: `apps/web/src/app/dashboard/settings/_components/settings-tabs.tsx`

- [ ] **Step 1: Read the existing settings-tabs component**

Read: `apps/web/src/app/dashboard/settings/_components/settings-tabs.tsx`
Understand the tab structure, icon imports, and content rendering pattern.

- [ ] **Step 2: Add Payroll, Schedule, and Holidays tabs**

Add these tabs to the TABS array after existing tabs:

```typescript
// Add to imports:
import { Banknote, CalendarClock, CalendarDays, Utensils, Timer, ShieldCheck, Receipt } from "lucide-react";

// Add to TABS array:
{ id: "payroll-general", label: "Payroll", icon: Banknote },
{ id: "salary-codes", label: "Salary Codes", icon: Receipt },
{ id: "employee-groups", label: "Employee Groups", icon: Users },
{ id: "supplements", label: "Supplements", icon: CalendarClock },
{ id: "meal-rules", label: "Meal Rules", icon: Utensils },
{ id: "shift-types", label: "Shift Types", icon: Timer },
{ id: "break-rules", label: "Break Rules", icon: Timer },
{ id: "working-time", label: "Working Time", icon: ShieldCheck },
{ id: "holidays", label: "Holidays", icon: CalendarDays },
```

Add section headers in the sidebar nav to group tabs:

- **General** (existing tabs)
- **Payroll** (payroll-general, salary-codes, employee-groups, supplements, meal-rules)
- **Schedule** (shift-types, break-rules, working-time)
- **Organisation** (holidays, plus existing teams)

- [ ] **Step 3: Add TabContent cases for each new tab**

Each case renders the corresponding settings component (placeholder until implemented):

```typescript
case "payroll-general":
  return <PayrollGeneralSettings />;
case "salary-codes":
  return <SalaryCodesSettings />;
// ... etc
```

- [ ] **Step 4: Verify tab navigation works**

Run: `pnpm --filter web dev`
Navigate to `/dashboard/settings` and verify all new tabs appear and are clickable.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/settings/_components/settings-tabs.tsx
git commit -m "$(cat <<'EOF'
feat(settings): add payroll/schedule/holiday tab navigation

9 new tabs organized in 3 sections: Payroll (general, salary
codes, employee groups, supplements, meal rules), Schedule
(shift types, break rules, working time), Organisation (holidays).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Payroll General Settings

**Files:**

- Create: `apps/web/src/app/dashboard/settings/_hooks/use-payroll-settings.ts`
- Create: `apps/web/src/app/dashboard/settings/_components/payroll-general-settings.tsx`

**What this screen does:** Configures workspace-level payroll defaults — period type (monthly/biweekly/weekly), period start day, default salary codes for worked hours and monthly salary, shift grouping, and employer cost percentages (arbeidsgiveravgift, feriepenger, OTP).

**UI pattern:** Single form (not a table). Fields grouped in cards. Save button at bottom. Same pattern as OpeningHoursSettings but with react-hook-form + zodResolver.

- [ ] **Step 1: Create the data hook**

`use-payroll-settings.ts`:

- `usePayrollSettings()` — fetches `payroll_workspace_settings` for current workspace (single row, upsert pattern)
- `useUpdatePayrollSettings()` — mutation to upsert settings
- Uses `useWorkspaceOptional()` for workspace context
- Zod schema for validation:

```typescript
const payrollSettingsSchema = z.object({
  period_type: z.enum(["monthly", "biweekly", "weekly"]),
  period_start_day: z.number().min(1).max(28),
  default_worked_hours_salary_code: z.string().nullable(),
  default_monthly_salary_code: z.string().nullable(),
  shift_grouping: z.enum(["department", "wage", "wage_type"]),
  employer_social_security_pct: z.number().min(0).max(100),
  vacation_pay_pct: z.number().min(0).max(100),
  pension_pct: z.number().min(0).max(100),
});
```

- [ ] **Step 2: Dispatch frontend-designer agent to build the component**

Dispatch `frontend-designer` agent with prompt:

> Build `payroll-general-settings.tsx` — a form component for workspace payroll configuration.
>
> **Data:** Single row from `payroll_workspace_settings` table. Use hook from `_hooks/use-payroll-settings.ts`.
>
> **Layout:** Two cards side-by-side on desktop, stacked on mobile.
>
> - Card 1 "Period Settings": period_type (Select), period_start_day (Input number), shift_grouping (Select), default salary codes (2x Select from payroll_salary_code list)
> - Card 2 "Employer Costs": employer_social_security_pct, vacation_pay_pct, pension_pct (3x Input with % suffix)
>
> **Pattern:** react-hook-form + zodResolver. Save button bottom-right. Success toast via sonner.
> **Style:** Follow OpeningHoursSettings pattern. CSS variables only. shadcn/ui Form + FormField.
> **Norwegian labels:** "Loennsperiode", "Arbeidsgiveravgift", "Feriepenger", "OTP"

- [ ] **Step 3: Verify component renders**

Navigate to Settings > Payroll. Verify form loads, fields are populated, save works.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/settings/_hooks/use-payroll-settings.ts apps/web/src/app/dashboard/settings/_components/payroll-general-settings.tsx
git commit -m "$(cat <<'EOF'
feat(settings): add payroll general settings screen

Period type, start day, default salary codes, shift grouping,
employer cost percentages (arbeidsgiveravgift, feriepenger, OTP).
react-hook-form + zodResolver + sonner toast.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Salary Codes CRUD

**Files:**

- Create: `apps/web/src/app/dashboard/settings/_hooks/use-salary-codes.ts`
- Create: `apps/web/src/app/dashboard/settings/_components/salary-codes-settings.tsx`

**What this screen does:** CRUD table of salary codes (loennsarter). Admin creates codes that map to Tripletex external codes and a-melding reporting codes. Each code has a category (worked_hours, supplement, overtime, absence, deduction, monthly_salary).

**UI pattern:** DataTable with columns: Code, Name, Category (badge), External Code, A-melding, Active (switch). Create button top-right opens Sheet. Row click opens edit Sheet.

- [ ] **Step 1: Create the data hook**

`use-salary-codes.ts`:

- `useSalaryCodes()` — fetches all `payroll_salary_code` for workspace
- `useCreateSalaryCode()` — insert mutation
- `useUpdateSalaryCode()` — update mutation
- `useDeleteSalaryCode()` — delete mutation (with confirmation dialog)
- Zod schema:

```typescript
const salaryCodeSchema = z.object({
  code: z.string().min(1, "Code is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().nullable(),
  external_code: z.string().nullable(),
  category: z.enum([
    "worked_hours",
    "supplement",
    "overtime",
    "absence",
    "deduction",
    "monthly_salary",
  ]),
  a_melding_code: z.string().nullable(),
  is_active: z.boolean(),
});
```

- [ ] **Step 2: Dispatch frontend-designer agent to build the component**

Dispatch `frontend-designer` agent with prompt:

> Build `salary-codes-settings.tsx` — a CRUD table for salary codes (loennsarter).
>
> **Data:** List from `payroll_salary_code`. Hook from `_hooks/use-salary-codes.ts`.
>
> **Layout:** Header with title "Loennsarter" + "Legg til" button. DataTable below.
>
> - Columns: Code (monospace), Name, Category (Badge with color per category), External Code, A-melding, Active (Switch toggle)
> - Row click: opens edit Sheet (right slide-in)
> - Create button: opens same Sheet in create mode
> - Delete: dropdown menu action with confirmation Dialog
>
> **Sheet form:** react-hook-form + zodResolver. Fields: code (Input), name (Input), description (Textarea), category (Select with Norwegian labels), external_code (Input), a_melding_code (Input), is_active (Switch).
>
> **Category labels (Norwegian):** worked_hours = "Ordinaer timeloenn", supplement = "Tillegg", overtime = "Overtid", absence = "Fravaer", deduction = "Trekk", monthly_salary = "Maanedsloenn"
>
> **Style:** Follow Smartout patterns. Existing DataTable pattern from people-data-table.tsx.

- [ ] **Step 3: Verify CRUD works**

Test: create a salary code, edit it, toggle active, delete it. Verify toast feedback.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/settings/_hooks/use-salary-codes.ts apps/web/src/app/dashboard/settings/_components/salary-codes-settings.tsx
git commit -m "$(cat <<'EOF'
feat(settings): add salary codes CRUD (loennsarter)

DataTable with code, name, category badge, external code,
a-melding code, active toggle. Create/edit via Sheet.
Delete with confirmation dialog.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Employee Groups CRUD

**Files:**

- Create: `apps/web/src/app/dashboard/settings/_hooks/use-employee-groups.ts`
- Create: `apps/web/src/app/dashboard/settings/_components/employee-groups-settings.tsx`

**What this screen does:** CRUD for employee groups (e.g., "Kokk", "Servitoer", "Bartender") with default hourly rate. Expandable rows show group members with individual rate overrides.

**UI pattern:** Accordion-style list. Each group is a card. Expand to see members table. Create group via Sheet. Add member via inline form or Sheet.

- [ ] **Step 1: Create the data hook**

`use-employee-groups.ts`:

- `useEmployeeGroups()` — fetches groups with member count
- `useEmployeeGroupMembers(groupId)` — fetches members for a group
- `useCreateEmployeeGroup()`, `useUpdateEmployeeGroup()`, `useDeleteEmployeeGroup()`
- `useAddGroupMember()`, `useUpdateGroupMember()`, `useRemoveGroupMember()`
- Zod schemas for group and member

- [ ] **Step 2: Dispatch frontend-designer agent**

Dispatch `frontend-designer` agent with prompt:

> Build `employee-groups-settings.tsx` — employee group management with member rates.
>
> **Data:** `payroll_employee_group` + `payroll_employee_group_member`. Hooks from `_hooks/use-employee-groups.ts`.
>
> **Layout:** List of group cards, each showing: name, description, default rate, salary code, member count, active badge. Click to expand and show members table.
>
> - Group card expanded: member table with columns: Employee (avatar + name), Rate (individual or "Group default"), Wage Type (badge), Valid From, Valid Until
> - Create group: "Legg til gruppe" button top-right, opens Sheet
> - Edit group: pencil icon on card, opens Sheet
> - Add member: "Legg til ansatt" button inside expanded card, opens Sheet with profile select + rate fields
>
> **Style:** Collapsible component for expand/collapse. Card-based layout. Badge for wage type.

- [ ] **Step 3: Verify CRUD works**

- [ ] **Step 4: Commit**

---

## Task 5: Supplement Rules CRUD

**Files:**

- Create: `apps/web/src/app/dashboard/settings/_hooks/use-supplement-rules.ts`
- Create: `apps/web/src/app/dashboard/settings/_components/supplement-rules-settings.tsx`

**What this screen does:** The most complex settings screen. CRUD for all 6 supplement types. The form adapts based on selected type — showing/hiding fields relevant to that type.

**UI pattern:** DataTable grouped by supplement_type. Create button opens Sheet with type selector at top — selecting a type reveals the relevant fields. Edit opens same Sheet pre-populated.

- [ ] **Step 1: Create the data hook**

`use-supplement-rules.ts`:

- `useSupplementRules()` — fetches all rules grouped by type
- CRUD mutations
- Zod schema with discriminated union on supplement_type:

```typescript
const baseSchema = z.object({
  name: z.string().min(1),
  supplement_type: z.enum([
    "normal",
    "week_based",
    "day_based",
    "manual",
    "holiday",
    "contract_rule",
  ]),
  salary_code: z.string().nullable(),
  rate_type: z.enum(["fixed_per_hour", "percentage", "fixed_per_shift"]),
  rate_value: z.number().min(0),
  employee_group_ids: z.array(z.string()),
  shift_type_ids: z.array(z.string()),
  affected_by_breaks: z.boolean(),
  affects_salaried: z.boolean(),
  enforced_payment: z.boolean(),
  consider_midnight: z.boolean(),
  is_active: z.boolean(),
});
// Type-specific fields added conditionally in the form
```

- [ ] **Step 2: Dispatch frontend-designer agent**

Dispatch `frontend-designer` agent with prompt:

> Build `supplement-rules-settings.tsx` — supplement rule CRUD for all 6 types.
>
> **Data:** `payroll_supplement_rule`. Hook from `_hooks/use-supplement-rules.ts`.
>
> **Layout:** Tabs for each supplement type at the top (Normal, Ukesbasert, Dagbasert, Manuell, Helligdag, Kontrakt). Each tab shows a table of rules for that type.
>
> - Table columns vary by type but always include: Name, Rate, Salary Code, Active
> - Normal: + Time Window, Weekdays
> - Week-based: + Weekly Threshold
> - Day-based: + Daily Threshold
> - Manual: + Default Rate
> - Holiday: + Calendar
> - Contract: + Evaluation Field, Threshold
>
> **Create/Edit Sheet:** Type selector (disabled in edit mode). Base fields always visible. Type-specific fields appear/disappear based on selected type. Multi-select for employee groups and shift types.
>
> **Norwegian labels:** "Normalt tillegg", "Ukesbasert", "Dagbasert", "Manuelt", "Helligdagstillegg", "Kontraktsregel"
>
> **Multi-select pattern:** Checkbox list in a Popover for employee_group_ids and shift_type_ids.

- [ ] **Step 3: Verify all 6 types create/edit correctly**

- [ ] **Step 4: Commit**

---

## Task 6: Shift Types CRUD

**Files:**

- Create: `apps/web/src/app/dashboard/settings/_hooks/use-shift-types.ts`
- Create: `apps/web/src/app/dashboard/settings/_components/shift-types-settings.tsx`

**What this screen does:** CRUD for shift types (Normal, Opplaering, Sykdom, Moete). Each type has a color, rate adjustment settings, and boolean feature flags.

**UI pattern:** Card grid (not table — shift types are visual with color). Create via Sheet. Edit on card click.

- [ ] **Step 1: Create hook + Step 2: Dispatch frontend-designer**

> Build `shift-types-settings.tsx` — shift type CRUD with color and feature flags.
>
> **Layout:** Grid of color-coded cards (3 per row desktop, 1 mobile). Each card: color stripe left edge, name, rate adjustment description, active badge, feature flag icons.
>
> - Create/Edit Sheet: name, color (simple hex input or preset palette), salary_code (Select), rate_adjustment_type (Select: none/replace/add/percentage), rate_adjustment_value (Input, hidden when type=none), then a section of Switch toggles for all boolean flags.
>
> **Feature flag switches (Norwegian labels):**
>
> - count_in_payroll = "Tell med i loenn"
> - allow_supplements = "Tillat tillegg"
> - allow_breaks = "Tillat pauser"
> - allow_meal_deduction = "Tillat matfradrag"
> - affects_salaried = "Gjelder fastloennede"
> - allow_conflicting_shifts = "Tillat overlappende vakter"

- [ ] **Step 3: Verify** + **Step 4: Commit**

---

## Task 7: Break Rules CRUD

**Files:**

- Create: `apps/web/src/app/dashboard/settings/_hooks/use-break-rules.ts`
- Create: `apps/web/src/app/dashboard/settings/_components/break-rules-settings.tsx`

**What this screen does:** CRUD for automatic break rules. Trigger type (after duration or at fixed time) determines which fields show.

- [ ] **Step 1: Create hook + Step 2: Dispatch frontend-designer**

> Build `break-rules-settings.tsx` — break rule CRUD.
>
> **Layout:** Table with columns: Name, Trigger (badge: "Etter X min" or "Kl. HH:MM"), Duration, Min Shift, Paid (checkmark/x), Active.
>
> - Create/Edit Sheet: trigger_type (Radio: "Etter varighet" / "Fast tidspunkt"), trigger_minutes (shown when after_duration), trigger_time (shown when time_of_day), duration_minutes, min_shift_duration_minutes, is_paid (Switch), weekdays (checkbox group Mon-Sun), department_ids (multi-select), employee_group_ids (multi-select).

- [ ] **Step 3: Verify** + **Step 4: Commit**

---

## Task 8: Working Time Rules

**Files:**

- Create: `apps/web/src/app/dashboard/settings/_hooks/use-working-time-rules.ts`
- Create: `apps/web/src/app/dashboard/settings/_components/working-time-rules-settings.tsx`

**What this screen does:** Configure AML working time compliance rules. Pre-seeded with W01-W06 defaults. Admin can enable/disable, change threshold, and set block vs warn severity.

**UI pattern:** NOT a typical CRUD table. This is a configuration panel — each rule is a row with inline edit (toggle, threshold input, severity select). Similar to feature flags UI.

- [ ] **Step 1: Create hook + Step 2: Dispatch frontend-designer**

> Build `working-time-rules-settings.tsx` — working time rule configuration.
>
> **Layout:** List of rule cards, one per rule code (W01-W06). Each card:
>
> - Left: rule name + description (Norwegian)
> - Center: threshold input (e.g., "9 timer", "40 timer", "11 timer")
> - Right: severity toggle (Block/Warn badge, clickable to toggle), active switch
>
> **Pre-seed defaults (shown as placeholder/default values):**
>
> - W01: "Maks timer per dag" — 9h — warn
> - W02: "Maks timer per uke" — 40h — warn
> - W03: "Minimum daglig hvile" — 11h — warn
> - W04: "Minimum ukentlig hvile" — 35h — warn
> - W05: "Maks sammenhengende dager" — 6 — warn
> - W06: "Unges arbeidstid" — 0 (special) — block
>
> **Note:** If no rules exist in DB for this workspace, show defaults greyed out with "Aktiver" button. On first activation, insert the default set.

- [ ] **Step 3: Verify** + **Step 4: Commit**

---

## Task 9: Holiday Calendar Management

**Files:**

- Create: `apps/web/src/app/dashboard/settings/_hooks/use-holiday-calendars.ts`
- Create: `apps/web/src/app/dashboard/settings/_components/holiday-calendar-settings.tsx`

**What this screen does:** Manage workspace holiday calendars. Import Norwegian public holidays from `public_holiday` table, add custom entries. Used by supplement rules for holiday-based pay.

**UI pattern:** Left: calendar list (small cards). Right: selected calendar's entries as a date-sorted table. Import button pulls from `public_holiday`.

- [ ] **Step 1: Create hook + Step 2: Dispatch frontend-designer**

> Build `holiday-calendar-settings.tsx` — holiday calendar management with import.
>
> **Layout:** Split view.
>
> - Left panel (w-64): list of calendars, each a card with name + entry count + default badge. "Ny kalender" button at bottom.
> - Right panel: selected calendar's entries table. Columns: Date, Name (NO), Name (EN), Full Day, Hours. "Legg til" button + "Importer norske helligdager" button.
>
> **Import flow:** "Importer norske helligdager" button opens Dialog showing all `public_holiday` entries for the selected year. Checkboxes to select which to import. "Importer valgte" button bulk-inserts into `payroll_holiday_entry`. Skips dates already in calendar (ON CONFLICT).
>
> **Year selector:** Dropdown to pick year (2026, 2027) for the import dialog.

- [ ] **Step 3: Verify** + **Step 4: Commit**

---

## Task 10: Meal Rules CRUD

**Files:**

- Create: `apps/web/src/app/dashboard/settings/_hooks/use-meal-rules.ts`
- Create: `apps/web/src/app/dashboard/settings/_components/meal-rules-settings.tsx`

**What this screen does:** CRUD for meal deduction/contribution rules.

- [ ] **Step 1: Create hook + Step 2: Dispatch frontend-designer**

> Build `meal-rules-settings.tsx` — meal deduction/contribution CRUD.
>
> **Layout:** Simple table. Columns: Name, Type (badge: "Fradrag" red / "Bidrag" green), Amount (NOK), Salary Code, Min Shift Hours, Active.
>
> - Create/Edit Sheet: name, meal_type (Radio: Fradrag/Bidrag), salary_code (Select), amount (Input NOK), min_shift_hours (Input), department_ids (multi-select), employee_group_ids (multi-select), shift_type_ids (multi-select).

- [ ] **Step 3: Verify** + **Step 4: Commit**

---

## Verification Checklist

After all tasks complete:

- [ ] **All 9 new tabs render without errors** — navigate to each tab in Settings
- [ ] **Typecheck passes:** `pnpm turbo typecheck` — 0 errors
- [ ] **No hardcoded colors** — grep for `zinc-`, `slate-`, `gray-` in new files
- [ ] **All forms validate** — submit empty form, verify Zod errors show
- [ ] **All CRUD operations work** — create, read, update, delete for each entity
- [ ] **Toasts fire on mutations** — success and error cases
- [ ] **Loading states** — skeleton or spinner on initial load
- [ ] **Responsive** — test at 768px and 1440px
- [ ] **Keyboard accessible** — tab through forms, enter to submit

---

## Summary

| Task      | Screen             | Components                      | Hook                      |
| --------- | ------------------ | ------------------------------- | ------------------------- |
| 1         | Tab Navigation     | settings-tabs.tsx (modify)      | —                         |
| 2         | Payroll General    | payroll-general-settings.tsx    | use-payroll-settings.ts   |
| 3         | Salary Codes       | salary-codes-settings.tsx       | use-salary-codes.ts       |
| 4         | Employee Groups    | employee-groups-settings.tsx    | use-employee-groups.ts    |
| 5         | Supplement Rules   | supplement-rules-settings.tsx   | use-supplement-rules.ts   |
| 6         | Shift Types        | shift-types-settings.tsx        | use-shift-types.ts        |
| 7         | Break Rules        | break-rules-settings.tsx        | use-break-rules.ts        |
| 8         | Working Time Rules | working-time-rules-settings.tsx | use-working-time-rules.ts |
| 9         | Holiday Calendars  | holiday-calendar-settings.tsx   | use-holiday-calendars.ts  |
| 10        | Meal Rules         | meal-rules-settings.tsx         | use-meal-rules.ts         |
| **Total** | **9 screens**      | **10 components + 9 hooks**     |                           |
