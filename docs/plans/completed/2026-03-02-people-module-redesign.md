---
title: People Module — UI Redesign Implementation Plan
status: done
updated: 2026-03-03
created: 2026-03-02
module: people
tags: [people, ui, redesign, export, profile]
---

# People Module — UI Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the People module (`/dashboard/people`) with real data, new columns, improved filters, export/print, better context menus, protocol assignment, and a full-page employee profile route.

**Architecture:** Enhance the existing People page components in-place. Add `last_login_at` and `employment_contract` data to the main query. New columns and filters extend `PeopleDataTable`. Export uses `xlsx` for Excel and browser print-to-PDF. A new `/people/[id]/page.tsx` route provides a full-page employee profile. Protocol assignment uses existing `protocol_assignment` table with a new server action.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, shadcn/ui, Supabase client, `xlsx` (SheetJS) for Excel export, `sonner` for toasts.

---

## Open Questions (Defaults Used)

These defaults are used in the plan. Change before implementation if the user decides differently.

| Question                | Default                                                       | Notes                                            |
| ----------------------- | ------------------------------------------------------------- | ------------------------------------------------ |
| Full-page profile tabs  | Overview, Competence, HR & Logs, Settings, Schedule, Activity | 6 tabs total — same 4 as quick card + 2 new      |
| Configurable quick card | Per workspace (global setting)                                | Simpler to implement, can add per-employee later |
| "Last Active" format    | Relative ("3h ago", "Yesterday")                              | More scannable in table view                     |
| "Contract" column       | Show enum status (signed/pending/draft/—) with icon           | Richer than just boolean                         |
| Department filter color | Green (emerald) for selected                                  | Consistent with "active" color system            |
| Filter button options   | Status, Role, Contract, Readiness range                       | Most useful operational filters                  |

---

## File Map

### Existing files to modify

| File                                                                      | What changes                                                                                                                      |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/app/dashboard/people/_components/types.ts`                  | Add `lastLoginAt`, `contractStatus` fields to `Employee` type                                                                     |
| `apps/web/src/app/dashboard/people/page.tsx`                              | Extend Supabase query: add `last_login_at` from `user_identity`, join `employment_contract`, compute `readinessScore`             |
| `apps/web/src/app/dashboard/people/_components/people-data-table.tsx`     | Add Last Active + Contract columns, restyle dept filter pills, add advanced filter popover, add export button, add column sorting |
| `apps/web/src/app/dashboard/people/_components/employee-profile-card.tsx` | Fix hardcoded phone/hours/activity, add "View Full Profile" link, add "Assign Protocol" button in Competence tab                  |
| `apps/web/src/app/dashboard/people/_components/people-row-actions.tsx`    | Show current role/dept with colored badge                                                                                         |
| `apps/web/src/app/dashboard/people/_components/invite-member-dialog.tsx`  | Replace hardcoded departments with real ones from props                                                                           |
| `apps/web/src/app/dashboard/people/_actions/people-actions.ts`            | Add `assignProtocol` server action                                                                                                |

### New files to create

| File                                                                        | Purpose                                                                           |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `apps/web/src/app/dashboard/people/[id]/page.tsx`                           | Full-page employee profile (server component for data, client component for tabs) |
| `apps/web/src/app/dashboard/people/_components/export-dialog.tsx`           | Export dialog with column selection + format choice (PDF/Excel)                   |
| `apps/web/src/app/dashboard/people/_components/advanced-filter-popover.tsx` | Advanced filter popover (status, role, contract, readiness)                       |
| `apps/web/src/app/dashboard/people/_components/assign-protocol-dialog.tsx`  | Dialog to search/select protocol and assign to employee                           |
| `apps/web/src/app/dashboard/people/_lib/format-relative-time.ts`            | Utility: format `Date` as relative time string                                    |

### Dependencies to install

| Package | Purpose                | Size   |
| ------- | ---------------------- | ------ |
| `xlsx`  | Excel export (SheetJS) | ~800KB |

---

## Task 1: Extend Employee Type and Data Layer

Add `lastLoginAt`, `contractStatus`, and real `readinessScore` to the Employee type and Supabase queries.

**Files:**

- Modify: `apps/web/src/app/dashboard/people/_components/types.ts`
- Modify: `apps/web/src/app/dashboard/people/page.tsx`
- Create: `apps/web/src/app/dashboard/people/_lib/format-relative-time.ts`

**Step 1: Update the Employee type**

In `types.ts`, add:

```typescript
export type ContractStatus =
  | "signed"
  | "pending"
  | "draft"
  | "sent"
  | "viewed"
  | "expired"
  | "terminated"
  | null;

export type Employee = {
  id: string;
  profileId?: string;
  name: string;
  email: string;
  role: string;
  department: string;
  departmentId: string | null;
  status: ProfileStatus | "invited";
  readinessScore?: number;
  avatar?: string;
  phone?: string;
  address?: string;
  personalNumber?: string;
  bankAccount?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  hasContract?: boolean;
  contractStatus?: ContractStatus;
  lastLoginAt?: string | null;
  inviteStatus?: "pending" | "expired";
  inviteToken?: string;
  contactLog?: {
    id: string;
    type: string;
    channel: "email" | "sms";
    status: "sent" | "delivered" | "failed";
    date: string;
  }[];
};
```

**Step 2: Create relative time formatter**

Create `apps/web/src/app/dashboard/people/_lib/format-relative-time.ts`:

```typescript
export function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "Never";

  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString("nb-NO", { day: "numeric", month: "short" });
}
```

**Step 3: Extend the Supabase query in page.tsx**

Update the `ProfileRow` type to include `last_login_at` and add a separate query for `employment_contract` and `protocol_assignment` readiness:

```typescript
type ProfileRow = {
  profile_id: string;
  display_name: string;
  job_title: string | null;
  role: string;
  status: string;
  avatar_url: string | null;
  department_id: string | null;
  address_line_1: string | null;
  postal_code: string | null;
  city: string | null;
  personal_number: string | null;
  bank_account: string | null;
  is_active: boolean;
  department: { name: string } | null;
  user_identity: {
    email: string;
    phone: string | null;
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
    last_login_at: string | null;
  } | null;
};
```

In `fetchData`, add `last_login_at` to the user_identity select:

```typescript
user_identity: user_id(
  email,
  phone,
  emergency_contact_name,
  emergency_contact_phone,
  last_login_at,
);
```

Add two more parallel queries to the `Promise.all`:

```typescript
// employment_contract status per profile
(supabase
  .from("employment_contract")
  .select("profile_id, status")
  .eq("workspace_id", workspaceData.workspace_id)
  .order("created_at", { ascending: false }),
  // protocol_assignment counts for readiness calculation
  supabase
    .from("protocol_assignment")
    .select("profile_id, status")
    .in(
      "profile_id" /* profile IDs from profilesRes — must be done after profiles load, or use a separate query */,
    ));
```

**Important:** The readiness query depends on profile IDs. Either:

- (a) Run profiles first, then contracts + readiness in a second `Promise.all`, OR
- (b) Query all protocol_assignments for the workspace (join through profile) in one go

Use option (b) — query all protocol_assignments via an RPC or by joining through profile:

```typescript
supabase
  .from("protocol_assignment")
  .select("profile_id, status, profile!inner(workspace_id)")
  .eq("profile.workspace_id", workspaceData.workspace_id);
```

**Step 4: Map the new data in the Employee mapping**

After retrieving contracts and assignments, build lookup maps:

```typescript
// Contract status map: profile_id -> latest contract status
const contractMap = new Map<string, string>();
if (contractsRes.data) {
  for (const c of contractsRes.data) {
    // First entry per profile_id wins (ordered by created_at desc)
    if (!contractMap.has(c.profile_id)) {
      contractMap.set(c.profile_id, c.status);
    }
  }
}

// Readiness map: profile_id -> percentage
const readinessMap = new Map<string, number>();
if (assignmentsRes.data) {
  const grouped = new Map<string, { total: number; completed: number }>();
  for (const a of assignmentsRes.data) {
    const g = grouped.get(a.profile_id) ?? { total: 0, completed: 0 };
    g.total++;
    if (a.status === "completed") g.completed++;
    grouped.set(a.profile_id, g);
  }
  for (const [pid, { total, completed }] of grouped) {
    readinessMap.set(pid, total > 0 ? Math.round((completed / total) * 100) : 0);
  }
}
```

Then in the `mapped` Employee array:

```typescript
return {
  // ... existing fields ...
  phone: ui?.phone ?? undefined,
  lastLoginAt: ui?.last_login_at ?? null,
  contractStatus: (contractMap.get(p.profile_id) as Employee["contractStatus"]) ?? null,
  readinessScore: readinessMap.get(p.profile_id) ?? 0,
  hasContract: contractMap.has(p.profile_id) && contractMap.get(p.profile_id) === "signed",
};
```

**Step 5: Verify the data loads correctly**

Run: `pnpm --filter web dev`

Navigate to `/dashboard/people`. Open browser DevTools Network tab and confirm:

- `user_identity` query includes `last_login_at`
- `employment_contract` query returns data (may be empty if no contracts exist)
- `protocol_assignment` query returns data
- No console errors

**Step 6: Commit**

```bash
git add apps/web/src/app/dashboard/people/_components/types.ts \
  apps/web/src/app/dashboard/people/page.tsx \
  apps/web/src/app/dashboard/people/_lib/format-relative-time.ts
git commit -m "feat(people): extend data layer with last_login_at, contract status, real readiness scores"
```

---

## Task 2: Add "Last Active" and "Contract" Columns

Add two new columns to the people table.

**Files:**

- Modify: `apps/web/src/app/dashboard/people/_components/people-data-table.tsx`

**Step 1: Import the relative time formatter**

```typescript
import { formatRelativeTime } from "../_lib/format-relative-time";
```

**Step 2: Add "Last Active" column header after "Readiness"**

In the `<thead>` section, after the Readiness `<th>`, add:

```tsx
<th className="px-6 py-4 text-center text-xs font-bold tracking-widest text-zinc-500 uppercase">
  Last Active
</th>
<th className="px-6 py-4 text-center text-xs font-bold tracking-widest text-zinc-500 uppercase">
  Contract
</th>
```

**Step 3: Add "Last Active" cell in each row**

After the Readiness `<td>` and before the row actions `<td>`, add:

```tsx
<td className="px-6 py-4 text-center">
  <span className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
    {emp.status !== "invited" ? formatRelativeTime(emp.lastLoginAt) : "—"}
  </span>
</td>
```

**Step 4: Add "Contract" cell in each row**

```tsx
<td className="px-6 py-4 text-center">
  {emp.status !== "invited" ? (
    <ContractBadge status={emp.contractStatus} isDark={isDark} />
  ) : (
    <span className={`text-xs ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>—</span>
  )}
</td>
```

**Step 5: Create the ContractBadge component**

Add at the bottom of `people-data-table.tsx`, next to the existing `StatusBadge`:

```tsx
function ContractBadge({
  status,
  isDark,
}: {
  status: Employee["contractStatus"];
  isDark: boolean;
}) {
  if (!status) {
    return (
      <span className={`text-xs font-medium ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
        None
      </span>
    );
  }

  const config: Record<string, { color: string; label: string }> = {
    signed: { color: "emerald", label: "Signed" },
    pending: { color: "orange", label: "Pending" },
    sent: { color: "blue", label: "Sent" },
    viewed: { color: "blue", label: "Viewed" },
    draft: { color: "zinc", label: "Draft" },
    expired: { color: "rose", label: "Expired" },
    terminated: { color: "rose", label: "Terminated" },
  };

  const { color, label } = config[status] ?? { color: "zinc", label: status };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold tracking-wider uppercase border-${color}-500/20 bg-${color}-500/10 text-${color}-${color === "zinc" ? "400" : "500"}`}
    >
      {status === "signed" ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : (
        <FileText className="h-3 w-3" />
      )}
      {label}
    </span>
  );
}
```

**Note:** Dynamic Tailwind classes like `border-${color}-500/20` won't work. Use a lookup object instead:

```tsx
function ContractBadge({
  status,
  isDark,
}: {
  status: Employee["contractStatus"];
  isDark: boolean;
}) {
  if (!status) {
    return (
      <span className={`text-xs font-medium ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
        None
      </span>
    );
  }

  const styles: Record<string, string> = {
    signed: "border-emerald-500/20 bg-emerald-500/10 text-emerald-500",
    pending: "border-orange-500/20 bg-orange-500/10 text-orange-500",
    sent: "border-blue-500/20 bg-blue-500/10 text-blue-500",
    viewed: "border-blue-500/20 bg-blue-500/10 text-blue-500",
    draft: isDark
      ? "border-zinc-700 bg-zinc-800 text-zinc-400"
      : "border-zinc-200 bg-zinc-100 text-zinc-500",
    expired: "border-rose-500/20 bg-rose-500/10 text-rose-500",
    terminated: "border-rose-500/20 bg-rose-500/10 text-rose-500",
  };

  const labels: Record<string, string> = {
    signed: "Signed",
    pending: "Pending",
    sent: "Sent",
    viewed: "Viewed",
    draft: "Draft",
    expired: "Expired",
    terminated: "Ended",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold tracking-wider uppercase ${styles[status] ?? styles.draft}`}
    >
      {status === "signed" ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : (
        <FileText className="h-3 w-3" />
      )}
      {labels[status] ?? status}
    </span>
  );
}
```

Import `FileText` from lucide-react at the top (already imported in profile card, but needs to be added to data-table imports).

**Step 6: Run typecheck**

Run: `pnpm turbo typecheck --filter=web`

Expected: 0 errors (or fix any type mismatches).

**Step 7: Verify visually**

Run: `pnpm --filter web dev`

Navigate to `/dashboard/people`. Confirm:

- "Last Active" column shows relative time or "Never"
- "Contract" column shows status badge or "None"
- Table layout isn't broken (may need responsive adjustments)

**Step 8: Commit**

```bash
git add apps/web/src/app/dashboard/people/_components/people-data-table.tsx
git commit -m "feat(people): add Last Active and Contract status columns to table"
```

---

## Task 3: Restyle Department Filter Pills

Change department filter buttons from dark/white toggle to smaller pills with emerald active state.

**Files:**

- Modify: `apps/web/src/app/dashboard/people/_components/people-data-table.tsx`

**Step 1: Replace the department filter button styles**

Find the department filter button group in `people-data-table.tsx` (around line 286-312). Replace the existing styling:

Old pattern:

```tsx
className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
  selectedDept === dept
    ? isDark
      ? "bg-zinc-800 text-white shadow-sm"
      : "bg-zinc-100 text-zinc-900 shadow-sm"
    : isDark
      ? "text-zinc-500 hover:text-zinc-300"
      : "text-zinc-500 hover:text-zinc-700"
}`}
```

New pattern — smaller pills, emerald active:

```tsx
className={`rounded-md px-2.5 py-1 text-[11px] font-bold tracking-wide transition-all ${
  selectedDept === dept
    ? "bg-emerald-500/15 text-emerald-500 ring-1 ring-emerald-500/30"
    : isDark
      ? "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
      : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
}`}
```

Also update the container border to be tighter:

```tsx
className={`${isDark ? "border-zinc-800 bg-zinc-950" : "border-zinc-200 bg-white"} flex rounded-lg border p-0.5 gap-0.5`}
```

**Step 2: Verify visually**

Run dev server. Confirm:

- Unselected pills are white/transparent with muted text
- Selected pill has emerald green background and ring
- Pills are visually smaller than before
- "All" tab still works as default

**Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/people/_components/people-data-table.tsx
git commit -m "style(people): restyle department filter pills with emerald active state"
```

---

## Task 4: Advanced Filter Popover

Wire up the filter icon button (currently a no-op) with a popover for Status, Role, Contract, and Readiness filters.

**Files:**

- Create: `apps/web/src/app/dashboard/people/_components/advanced-filter-popover.tsx`
- Modify: `apps/web/src/app/dashboard/people/_components/people-data-table.tsx`

**Step 1: Create the advanced filter popover component**

Create `apps/web/src/app/dashboard/people/_components/advanced-filter-popover.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Filter, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

export type AdvancedFilters = {
  statuses: string[];
  roles: string[];
  contractStatuses: string[];
  readinessMin: number;
  readinessMax: number;
};

const EMPTY_FILTERS: AdvancedFilters = {
  statuses: [],
  roles: [],
  contractStatuses: [],
  readinessMin: 0,
  readinessMax: 100,
};

export function AdvancedFilterPopover({
  filters,
  onChange,
  isDark,
}: {
  filters: AdvancedFilters;
  onChange: (f: AdvancedFilters) => void;
  isDark: boolean;
}) {
  const [open, setOpen] = useState(false);

  const activeCount =
    filters.statuses.length +
    filters.roles.length +
    filters.contractStatuses.length +
    (filters.readinessMin > 0 || filters.readinessMax < 100 ? 1 : 0);

  function toggleArrayItem(arr: string[], item: string): string[] {
    return arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item];
  }

  function clearAll() {
    onChange(EMPTY_FILTERS);
  }

  const sectionTitle = `mb-2 text-[10px] font-bold tracking-widest uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`;
  const checkboxLabel = `text-xs font-medium ${isDark ? "text-zinc-300" : "text-zinc-700"}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={`relative rounded-lg border p-2.5 transition-all ${
            isDark
              ? "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-white"
              : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:text-zinc-900"
          } ${activeCount > 0 ? "ring-1 ring-emerald-500/50" : ""}`}
        >
          <Filter className="h-4 w-4" />
          {activeCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white">
              {activeCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className={`w-64 p-4 ${isDark ? "border-zinc-800 bg-zinc-950" : ""}`}
      >
        <div className="mb-3 flex items-center justify-between">
          <h4 className={`text-sm font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>
            Filters
          </h4>
          {activeCount > 0 && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1 text-[11px] font-medium text-zinc-500 hover:text-zinc-300"
            >
              <X className="h-3 w-3" /> Clear all
            </button>
          )}
        </div>

        {/* Status */}
        <div className="mb-4">
          <p className={sectionTitle}>Status</p>
          <div className="space-y-2">
            {["active", "trainee", "inactive", "offboarding"].map((s) => (
              <label key={s} className="flex items-center gap-2">
                <Checkbox
                  checked={filters.statuses.includes(s)}
                  onCheckedChange={() =>
                    onChange({ ...filters, statuses: toggleArrayItem(filters.statuses, s) })
                  }
                />
                <span className={checkboxLabel}>{s.charAt(0).toUpperCase() + s.slice(1)}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Role */}
        <div className="mb-4">
          <p className={sectionTitle}>Role</p>
          <div className="space-y-2">
            {["owner", "admin", "manager", "employee"].map((r) => (
              <label key={r} className="flex items-center gap-2">
                <Checkbox
                  checked={filters.roles.includes(r)}
                  onCheckedChange={() =>
                    onChange({ ...filters, roles: toggleArrayItem(filters.roles, r) })
                  }
                />
                <span className={checkboxLabel}>{r.charAt(0).toUpperCase() + r.slice(1)}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Contract */}
        <div className="mb-4">
          <p className={sectionTitle}>Contract</p>
          <div className="space-y-2">
            {[
              { value: "signed", label: "Signed" },
              { value: "pending", label: "Pending" },
              { value: "none", label: "No contract" },
            ].map((c) => (
              <label key={c.value} className="flex items-center gap-2">
                <Checkbox
                  checked={filters.contractStatuses.includes(c.value)}
                  onCheckedChange={() =>
                    onChange({
                      ...filters,
                      contractStatuses: toggleArrayItem(filters.contractStatuses, c.value),
                    })
                  }
                />
                <span className={checkboxLabel}>{c.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Readiness Range */}
        <div>
          <p className={sectionTitle}>Readiness</p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={100}
              value={filters.readinessMin}
              onChange={(e) => onChange({ ...filters, readinessMin: Number(e.target.value) })}
              className={`w-16 rounded border px-2 py-1 text-xs ${
                isDark ? "border-zinc-800 bg-zinc-900 text-white" : "border-zinc-200 text-zinc-900"
              }`}
            />
            <span className="text-xs text-zinc-500">to</span>
            <input
              type="number"
              min={0}
              max={100}
              value={filters.readinessMax}
              onChange={(e) => onChange({ ...filters, readinessMax: Number(e.target.value) })}
              className={`w-16 rounded border px-2 py-1 text-xs ${
                isDark ? "border-zinc-800 bg-zinc-900 text-white" : "border-zinc-200 text-zinc-900"
              }`}
            />
            <span className="text-xs text-zinc-500">%</span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { EMPTY_FILTERS };
```

**Step 2: Integrate into PeopleDataTable**

In `people-data-table.tsx`:

1. Import:

```typescript
import {
  AdvancedFilterPopover,
  EMPTY_FILTERS,
  type AdvancedFilters,
} from "./advanced-filter-popover";
```

2. Add state:

```typescript
const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(EMPTY_FILTERS);
```

3. Replace the `<button>` with `<Filter>` icon (the no-op button around line 307-311) with:

```tsx
<AdvancedFilterPopover filters={advancedFilters} onChange={setAdvancedFilters} isDark={isDark} />
```

4. Apply advanced filters in the `filteredEmployees` useMemo, after existing filters:

```typescript
// Advanced filters
if (advancedFilters.statuses.length > 0) {
  result = result.filter((emp) => advancedFilters.statuses.includes(emp.status));
}
if (advancedFilters.roles.length > 0) {
  result = result.filter((emp) => advancedFilters.roles.includes(emp.role.toLowerCase()));
}
if (advancedFilters.contractStatuses.length > 0) {
  result = result.filter((emp) => {
    if (advancedFilters.contractStatuses.includes("none") && !emp.contractStatus) return true;
    return emp.contractStatus && advancedFilters.contractStatuses.includes(emp.contractStatus);
  });
}
if (advancedFilters.readinessMin > 0 || advancedFilters.readinessMax < 100) {
  result = result.filter((emp) => {
    const score = emp.readinessScore ?? 0;
    return score >= advancedFilters.readinessMin && score <= advancedFilters.readinessMax;
  });
}
```

**Step 3: Ensure Popover component exists**

Run: `ls apps/web/src/components/ui/popover.tsx`

If not found: `cd apps/web && npx shadcn@latest add popover`

**Step 4: Run typecheck**

Run: `pnpm turbo typecheck --filter=web`

**Step 5: Verify visually**

Confirm filter icon shows badge count when active. Confirm filters apply correctly.

**Step 6: Commit**

```bash
git add apps/web/src/app/dashboard/people/_components/advanced-filter-popover.tsx \
  apps/web/src/app/dashboard/people/_components/people-data-table.tsx
git commit -m "feat(people): add advanced filter popover for status, role, contract, readiness"
```

---

## Task 5: Fix Invite Dialog — Real Departments

Replace hardcoded department options in the invite dialog with real departments from the database.

**Files:**

- Modify: `apps/web/src/app/dashboard/people/_components/invite-member-dialog.tsx`
- Modify: `apps/web/src/app/dashboard/people/_components/people-data-table.tsx` (pass departments prop)

**Step 1: Add departments prop to InviteMemberDialog**

In `invite-member-dialog.tsx`, change the component signature:

```typescript
export function InviteMemberDialog({
  isOpen,
  onClose,
  departments,
}: {
  isOpen: boolean;
  onClose: () => void;
  departments: Array<{ department_id: string; name: string }>;
}) {
```

**Step 2: Replace hardcoded department options**

Find the `{/* TODO: Map actual departments from DB */}` comment and the hardcoded options. Replace with:

```tsx
{
  departments.map((d) => (
    <option key={d.department_id} value={d.department_id}>
      {d.name}
    </option>
  ));
}
```

**Step 3: Pass departments from PeopleDataTable**

In `people-data-table.tsx`, update the `InviteMemberDialog` render:

```tsx
<InviteMemberDialog
  isOpen={isInviteOpen}
  onClose={() => setIsInviteOpen(false)}
  departments={departments}
/>
```

**Step 4: Run typecheck and verify**

Run: `pnpm turbo typecheck --filter=web`

Verify: Open invite dialog, confirm real departments show in dropdown.

**Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/people/_components/invite-member-dialog.tsx \
  apps/web/src/app/dashboard/people/_components/people-data-table.tsx
git commit -m "fix(people): use real departments in invite dialog instead of hardcoded values"
```

---

## Task 6: Improve Context Menu with Current-Value Badges

Show the current role/department highlighted with a colored badge in the dropdown submenus.

**Files:**

- Modify: `apps/web/src/app/dashboard/people/_components/people-row-actions.tsx`

**Step 1: Update the Change Role submenu items**

Replace the current role display (plain "Current" text) with a colored badge:

```tsx
{
  assignableRoles.map((role) => {
    const isCurrent = employee.role.toLowerCase() === role;
    return (
      <DropdownMenuItem
        key={role}
        disabled={isCurrent}
        onClick={() => onRoleChange(employee.id, role)}
        className={isCurrent ? "opacity-100" : ""}
      >
        <span className="flex-1">{role.charAt(0).toUpperCase() + role.slice(1)}</span>
        {isCurrent && (
          <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold tracking-wider text-emerald-500 uppercase">
            Current
          </span>
        )}
      </DropdownMenuItem>
    );
  });
}
```

**Step 2: Update the Change Department submenu items**

Same pattern for departments:

```tsx
{
  departments.map((dept) => {
    const isCurrent = employee.departmentId === dept.department_id;
    return (
      <DropdownMenuItem
        key={dept.department_id}
        disabled={isCurrent}
        onClick={() => onDepartmentChange(employee.id, dept.department_id)}
        className={isCurrent ? "opacity-100" : ""}
      >
        <span className="flex-1">{dept.name}</span>
        {isCurrent && (
          <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold tracking-wider text-emerald-500 uppercase">
            Current
          </span>
        )}
      </DropdownMenuItem>
    );
  });
}
```

**Step 3: Show current value in the submenu trigger**

For the Role submenu trigger, show the current role inline:

```tsx
<DropdownMenuSubTrigger>
  <Shield className="mr-2 h-4 w-4" />
  <span className="flex-1">Change Role</span>
  <span className="ml-2 text-[10px] font-medium text-zinc-500">{employee.role}</span>
</DropdownMenuSubTrigger>
```

For the Department submenu trigger:

```tsx
<DropdownMenuSubTrigger>
  <Building2 className="mr-2 h-4 w-4" />
  <span className="flex-1">Change Dept</span>
  <span className="ml-2 max-w-[60px] truncate text-[10px] font-medium text-zinc-500">
    {employee.department}
  </span>
</DropdownMenuSubTrigger>
```

**Step 4: Verify visually**

Open context menu on an employee. Confirm current role/dept is visible with green badge.

**Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/people/_components/people-row-actions.tsx
git commit -m "style(people): show current role/dept with colored badge in context menu"
```

---

## Task 7: Export and Print Functionality

Add an export dialog with column selection and format choice (PDF via browser print, Excel via `xlsx`).

**Files:**

- Create: `apps/web/src/app/dashboard/people/_components/export-dialog.tsx`
- Modify: `apps/web/src/app/dashboard/people/_components/people-data-table.tsx`

**Step 1: Install xlsx dependency**

```bash
cd /home/sxtnl/dev/smartout.ai && pnpm --filter web add xlsx
```

**Step 2: Create the export dialog**

Create `apps/web/src/app/dashboard/people/_components/export-dialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, Printer, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import type { Employee } from "./types";
import { formatRelativeTime } from "../_lib/format-relative-time";

type ExportColumn = {
  key: string;
  label: string;
  enabled: boolean;
  getter: (emp: Employee) => string;
};

const DEFAULT_COLUMNS: ExportColumn[] = [
  { key: "name", label: "Name", enabled: true, getter: (e) => e.name },
  { key: "email", label: "Email", enabled: true, getter: (e) => e.email },
  { key: "role", label: "Role", enabled: true, getter: (e) => e.role },
  { key: "department", label: "Department", enabled: true, getter: (e) => e.department },
  { key: "status", label: "Status", enabled: true, getter: (e) => e.status },
  {
    key: "readiness",
    label: "Readiness",
    enabled: true,
    getter: (e) => `${e.readinessScore ?? 0}%`,
  },
  {
    key: "lastActive",
    label: "Last Active",
    enabled: false,
    getter: (e) => formatRelativeTime(e.lastLoginAt),
  },
  {
    key: "contract",
    label: "Contract",
    enabled: false,
    getter: (e) => e.contractStatus ?? "None",
  },
  { key: "phone", label: "Phone", enabled: false, getter: (e) => e.phone ?? "" },
];

export function ExportDialog({
  isOpen,
  onClose,
  employees,
  isDark,
}: {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  isDark: boolean;
}) {
  const [columns, setColumns] = useState<ExportColumn[]>(DEFAULT_COLUMNS);

  function toggleColumn(key: string) {
    setColumns((prev) => prev.map((c) => (c.key === key ? { ...c, enabled: !c.enabled } : c)));
  }

  const enabledCols = columns.filter((c) => c.enabled);

  async function handleExcel() {
    const XLSX = await import("xlsx");
    const data = employees
      .filter((e) => e.status !== "invited")
      .map((emp) => {
        const row: Record<string, string> = {};
        for (const col of enabledCols) {
          row[col.label] = col.getter(emp);
        }
        return row;
      });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "People");
    XLSX.writeFile(wb, `people-export-${new Date().toISOString().slice(0, 10)}.xlsx`);
    onClose();
  }

  function handlePrint() {
    const enabledData = employees.filter((e) => e.status !== "invited");
    const printContent = `
      <html>
      <head>
        <title>People Export</title>
        <style>
          body { font-family: system-ui, sans-serif; padding: 20px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th { text-align: left; padding: 8px; border-bottom: 2px solid #333; font-weight: 700; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; }
          td { padding: 8px; border-bottom: 1px solid #e5e5e5; }
          h1 { font-size: 18px; margin-bottom: 4px; }
          .meta { color: #666; font-size: 12px; margin-bottom: 16px; }
        </style>
      </head>
      <body>
        <h1>People Directory</h1>
        <p class="meta">${enabledData.length} employees &middot; Exported ${new Date().toLocaleDateString("nb-NO")}</p>
        <table>
          <thead><tr>${enabledCols.map((c) => `<th>${c.label}</th>`).join("")}</tr></thead>
          <tbody>${enabledData
            .map(
              (emp) => `<tr>${enabledCols.map((c) => `<td>${c.getter(emp)}</td>`).join("")}</tr>`,
            )
            .join("")}</tbody>
        </table>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
    onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={isDark ? "border-zinc-800 bg-zinc-950" : ""}>
        <DialogHeader>
          <DialogTitle>Export People List</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <p
              className={`mb-2 text-xs font-bold tracking-widest uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
            >
              Columns to include
            </p>
            <div className="grid grid-cols-2 gap-2">
              {columns.map((col) => (
                <label key={col.key} className="flex items-center gap-2">
                  <Checkbox checked={col.enabled} onCheckedChange={() => toggleColumn(col.key)} />
                  <span className={`text-sm ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
                    {col.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleExcel}
              disabled={enabledCols.length === 0}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-500 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Export Excel
            </button>
            <button
              onClick={handlePrint}
              disabled={enabledCols.length === 0}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-bold transition-colors disabled:opacity-50 ${
                isDark
                  ? "border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white"
                  : "border-zinc-200 text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              <Printer className="h-4 w-4" />
              Print / PDF
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 3: Add export button to PeopleDataTable**

Import and add state:

```typescript
import { ExportDialog } from "./export-dialog";

// In component:
const [isExportOpen, setIsExportOpen] = useState(false);
```

Add export button next to the invite button in the header:

```tsx
<button
  onClick={() => setIsExportOpen(true)}
  className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
    isDark
      ? "border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white"
      : "border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
  }`}
>
  <Download className="h-4 w-4" />
  <span className="hidden sm:inline">Export</span>
</button>
```

Import `Download` from lucide-react.

Add the dialog render at the bottom of the component (near the other dialogs):

```tsx
<ExportDialog
  isOpen={isExportOpen}
  onClose={() => setIsExportOpen(false)}
  employees={filteredEmployees}
  isDark={isDark}
/>
```

**Step 4: Add Print option to bulk action bar**

In the bulk action bar (when `selectedIds.size > 0`), add a Print button:

```tsx
<button
  onClick={() => {
    // Filter to selected employees and open export dialog
    setIsExportOpen(true);
  }}
  className={`rounded-lg border px-2 py-1.5 text-xs font-semibold ${
    isDark
      ? "border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-zinc-200"
      : "border-zinc-200 bg-white text-zinc-500 hover:text-zinc-700"
  }`}
>
  Print
</button>
```

**Step 5: Run typecheck**

Run: `pnpm turbo typecheck --filter=web`

**Step 6: Verify export works**

1. Click Export button → dialog opens with column checkboxes
2. Click "Export Excel" → downloads .xlsx file, opens correctly in Excel
3. Click "Print / PDF" → opens print preview in new tab
4. Select employees → "Print" button in bulk bar opens export dialog

**Step 7: Commit**

```bash
git add apps/web/src/app/dashboard/people/_components/export-dialog.tsx \
  apps/web/src/app/dashboard/people/_components/people-data-table.tsx \
  apps/web/package.json pnpm-lock.yaml
git commit -m "feat(people): add export dialog with Excel and Print/PDF support"
```

---

## Task 8: Fix Hardcoded Data in Profile Card

Replace hardcoded phone number, hours, and recent activity in the employee profile card.

**Files:**

- Modify: `apps/web/src/app/dashboard/people/_components/employee-profile-card.tsx`

**Step 1: Fix the hardcoded phone number**

In the overview tab, find line 333:

```tsx
<span className="text-zinc-300">+47 912 34 567</span>
```

Replace with:

```tsx
<span className="text-zinc-300">{employee.phone || "No phone"}</span>
```

**Step 2: Fix the hardcoded hours**

In the metrics grid, find the "Hours" metric (line 249-254). Replace:

```tsx
<span className={`text-lg font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>
  142<span className="ml-0.5 text-xs font-normal text-zinc-500">h</span>
</span>
```

With a placeholder that's honest about the data not being available yet:

```tsx
<span className={`text-lg font-bold ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>—</span>
```

**Step 3: Replace hardcoded recent activity with real data placeholder**

Find the "Recent Activity" section (lines 361-401). Replace the 3 hardcoded entries with:

```tsx
<div>
  <h3 className="mb-3 text-xs font-bold tracking-widest text-zinc-500 uppercase">
    Recent Activity
  </h3>
  <p className={`text-sm ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
    Activity tracking coming soon
  </p>
</div>
```

**Note:** Real activity data requires an `activity_log` or event system that doesn't exist yet. Showing a clean placeholder is better than fake data.

**Step 4: Verify the profile card shows real data**

Open a profile card. Confirm:

- Phone shows real phone number from `user_identity` (or "No phone")
- Hours shows "—" instead of fake "142h"
- Recent Activity shows placeholder text

**Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/people/_components/employee-profile-card.tsx
git commit -m "fix(people): replace hardcoded phone, hours, and activity with real data"
```

---

## Task 9: Assign Protocol from Competence Tab

Add a button in the Competence tab to assign protocols to an employee.

**Files:**

- Create: `apps/web/src/app/dashboard/people/_components/assign-protocol-dialog.tsx`
- Modify: `apps/web/src/app/dashboard/people/_components/employee-profile-card.tsx`
- Modify: `apps/web/src/app/dashboard/people/_actions/people-actions.ts`

**Step 1: Add assignProtocol server action**

In `people-actions.ts`, add:

```typescript
"use server";

import { createClient } from "@smartout/supabase/server";

// ... existing actions ...

export async function assignProtocol(profileId: string, protocolId: string) {
  const supabase = await createClient();

  // Check if already assigned
  const { data: existing } = await supabase
    .from("protocol_assignment")
    .select("assignment_id")
    .eq("profile_id", profileId)
    .eq("protocol_id", protocolId)
    .maybeSingle();

  if (existing) {
    throw new Error("Protocol already assigned to this employee");
  }

  const { error } = await supabase.from("protocol_assignment").insert({
    profile_id: profileId,
    protocol_id: protocolId,
    status: "pending",
  });

  if (error) throw error;
}
```

**Step 2: Create the assign protocol dialog**

Create `apps/web/src/app/dashboard/people/_components/assign-protocol-dialog.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { Search, Loader2, BookOpen } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createClient } from "@smartout/supabase/client";
import { toast } from "sonner";
import { assignProtocol } from "../_actions/people-actions";

type Protocol = {
  protocol_id: string;
  name: string;
  description: string | null;
};

export function AssignProtocolDialog({
  isOpen,
  onClose,
  profileId,
  workspaceId,
  existingProtocolIds,
  isDark,
  onAssigned,
}: {
  isOpen: boolean;
  onClose: () => void;
  profileId: string;
  workspaceId: string;
  existingProtocolIds: string[];
  isDark: boolean;
  onAssigned: () => void;
}) {
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [assigning, setAssigning] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    async function fetchProtocols() {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("protocol")
        .select("protocol_id, name, description")
        .eq("workspace_id", workspaceId)
        .order("name");
      setProtocols(data ?? []);
      setLoading(false);
    }
    fetchProtocols();
  }, [isOpen, workspaceId]);

  const filtered = protocols.filter((p) => {
    if (existingProtocolIds.includes(p.protocol_id)) return false;
    if (!search) return true;
    return p.name.toLowerCase().includes(search.toLowerCase());
  });

  async function handleAssign(protocolId: string) {
    setAssigning(protocolId);
    try {
      await assignProtocol(profileId, protocolId);
      toast.success("Protocol assigned");
      onAssigned();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to assign protocol");
    }
    setAssigning(null);
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={isDark ? "border-zinc-800 bg-zinc-950" : ""}>
        <DialogHeader>
          <DialogTitle>Assign Protocol</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search protocols..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full rounded-lg py-2 pr-4 pl-9 text-sm ${
                isDark
                  ? "border-zinc-800 bg-zinc-900 text-white placeholder:text-zinc-600"
                  : "border-zinc-200 bg-zinc-50 text-zinc-900 placeholder:text-zinc-400"
              }`}
            />
          </div>

          <div className="max-h-64 space-y-1.5 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="py-4 text-center text-sm text-zinc-500">
                {protocols.length === 0
                  ? "No protocols in this workspace"
                  : "No matching protocols"}
              </p>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.protocol_id}
                  onClick={() => handleAssign(p.protocol_id)}
                  disabled={assigning !== null}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                    isDark
                      ? "border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900"
                      : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
                  } ${assigning === p.protocol_id ? "opacity-50" : ""}`}
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isDark ? "bg-zinc-800 text-zinc-400" : "bg-zinc-100 text-zinc-500"}`}
                  >
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-bold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}
                    >
                      {p.name}
                    </p>
                    {p.description && (
                      <p className="mt-0.5 truncate text-xs text-zinc-500">{p.description}</p>
                    )}
                  </div>
                  {assigning === p.protocol_id && (
                    <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 3: Add "Assign Protocol" button to Competence tab**

In `employee-profile-card.tsx`, import the dialog:

```typescript
import { AssignProtocolDialog } from "./assign-protocol-dialog";
```

Add state for the dialog:

```typescript
const [isAssignProtocolOpen, setIsAssignProtocolOpen] = useState(false);
```

Get `workspaceData` from context (already imported):

```typescript
const { isDark, workspaceData } = useContext(DashboardContext);
```

In the Competence tab, after the "Assigned Protocols" heading section, add a button:

```tsx
<div className="mb-3 flex items-center justify-between">
  <h3
    className={`text-xs font-bold tracking-widest uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
  >
    <span>Assigned Protocols</span>
    {protocols.length > 0 && (
      <span className="ml-2 font-medium text-zinc-600">
        {protocols.filter((p) => p.status === "completed").length}/{protocols.length} Completed
      </span>
    )}
  </h3>
  <button
    onClick={() => setIsAssignProtocolOpen(true)}
    className="rounded-md bg-orange-500 px-2.5 py-1 text-xs font-bold text-white transition-colors hover:bg-orange-600"
  >
    + Assign
  </button>
</div>
```

Add the dialog render at the bottom of the component (before the closing `</>` of the fragment):

```tsx
{
  employee.profileId && (
    <AssignProtocolDialog
      isOpen={isAssignProtocolOpen}
      onClose={() => setIsAssignProtocolOpen(false)}
      profileId={employee.profileId}
      workspaceId={workspaceData?.workspace_id ?? ""}
      existingProtocolIds={protocols.map((p) => p.assignment_id)}
      isDark={isDark}
      onAssigned={() => {
        fetchProtocols();
        onRefresh();
      }}
    />
  );
}
```

**Important:** The `existingProtocolIds` should be `protocol_id`, not `assignment_id`. But the current `protocols` state doesn't store `protocol_id`. Update the protocols fetch to include it:

In the `fetchProtocols` function, update the select:

```typescript
.select("assignment_id, status, protocol_id, protocol:protocol_id(name)")
```

And update the `protocols` state type:

```typescript
const [protocols, setProtocols] = useState<
  Array<{
    assignment_id: string;
    protocol_id: string;
    status: string;
    protocol: { name: string } | null;
  }>
>([]);
```

Then pass:

```tsx
existingProtocolIds={protocols.map((p) => p.protocol_id)}
```

**Step 4: Run typecheck**

Run: `pnpm turbo typecheck --filter=web`

**Step 5: Verify the flow**

1. Open profile card → Competence tab
2. Click "+ Assign" button
3. Dialog opens showing available protocols
4. Search works
5. Click protocol → assigns → toast success → dialog closes → protocol appears in list

**Step 6: Commit**

```bash
git add apps/web/src/app/dashboard/people/_components/assign-protocol-dialog.tsx \
  apps/web/src/app/dashboard/people/_components/employee-profile-card.tsx \
  apps/web/src/app/dashboard/people/_actions/people-actions.ts
git commit -m "feat(people): add protocol assignment from Competence tab"
```

---

## Task 10: Full-Page Employee Profile Route

Create `/dashboard/people/[id]` as a full-page employee profile with extended tabs.

**Files:**

- Create: `apps/web/src/app/dashboard/people/[id]/page.tsx`
- Modify: `apps/web/src/app/dashboard/people/_components/employee-profile-card.tsx` (add "View Full Profile" link)

**Step 1: Create the full-page profile route**

Create `apps/web/src/app/dashboard/people/[id]/page.tsx`:

```tsx
import { createClient } from "@smartout/supabase/server";
import { redirect } from "next/navigation";
import { EmployeeFullProfile } from "./employee-full-profile";

export default async function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profile")
    .select(
      `profile_id, display_name, job_title, role, status, avatar_url,
       department_id, employee_number, joined_at, is_active,
       address_line_1, address_line_2, postal_code, city,
       personal_number, bank_account, trainee_started, trainee_completed,
       department:department_id(department_id, name),
       user_identity:user_id(
         email, phone, personal_email, date_of_birth,
         emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
         last_login_at
       )`,
    )
    .eq("profile_id", id)
    .single();

  if (!profile) redirect("/dashboard/people");

  const [teamsRes, contractsRes, protocolsRes, departmentsRes] = await Promise.all([
    supabase
      .from("team_member")
      .select("team:team_id(team_id, name, team_type)")
      .eq("profile_id", id),
    supabase
      .from("employment_contract")
      .select("contract_id, status, position_title, start_date, end_date, signed_at, created_at")
      .eq("profile_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("protocol_assignment")
      .select(
        "assignment_id, protocol_id, status, assigned_at, completed_at, protocol:protocol_id(name)",
      )
      .eq("profile_id", id),
    supabase
      .from("department")
      .select("department_id, name")
      .eq("workspace_id", profile.department?.department_id ? profile.department_id : "")
      .order("sort_order"),
  ]);

  return (
    <EmployeeFullProfile
      profile={profile}
      teams={(teamsRes.data ?? []).map((t) => t.team).filter(Boolean)}
      contracts={contractsRes.data ?? []}
      protocols={protocolsRes.data ?? []}
      departments={departmentsRes.data ?? []}
    />
  );
}
```

**Step 2: Create the client component for the full profile**

Create `apps/web/src/app/dashboard/people/[id]/employee-full-profile.tsx`:

This is a large component. Key sections:

```tsx
"use client";

import { useState, useContext } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail, Phone, MapPin, Calendar, Shield, Building2 } from "lucide-react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { formatRelativeTime } from "../_lib/format-relative-time";

type Tab = "overview" | "competence" | "hr" | "settings" | "schedule" | "activity";

export function EmployeeFullProfile({
  profile,
  teams,
  contracts,
  protocols,
  departments,
}: {
  profile: /* type from server component */;
  teams: Array<{ team_id: string; name: string; team_type: string }>;
  contracts: Array<{
    contract_id: string;
    status: string;
    position_title: string | null;
    start_date: string | null;
    end_date: string | null;
    signed_at: string | null;
  }>;
  protocols: Array<{
    assignment_id: string;
    protocol_id: string;
    status: string;
    assigned_at: string | null;
    completed_at: string | null;
    protocol: { name: string } | null;
  }>;
  departments: Array<{ department_id: string; name: string }>;
}) {
  const router = useRouter();
  const { isDark } = useContext(DashboardContext);
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const ui = profile.user_identity;
  const dept = profile.department;

  const completedProtocols = protocols.filter((p) => p.status === "completed").length;
  const readinessScore = protocols.length > 0
    ? Math.round((completedProtocols / protocols.length) * 100)
    : 0;

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "competence", label: "Competence" },
    { key: "hr", label: "HR & Logs" },
    { key: "settings", label: "Settings" },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      {/* Back button + Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => router.push("/dashboard/people")}
          className={`mt-1 rounded-lg border p-2 transition-colors ${
            isDark ? "border-zinc-800 hover:bg-zinc-800" : "border-zinc-200 hover:bg-zinc-100"
          }`}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className="flex flex-1 items-center gap-4">
          <div className={`flex h-16 w-16 items-center justify-center rounded-full border text-xl font-bold ${isDark ? "border-zinc-700 bg-zinc-800 text-zinc-300" : "border-zinc-200 bg-zinc-100 text-zinc-500"}`}>
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.display_name} className="h-full w-full rounded-full object-cover" />
            ) : (
              profile.display_name.charAt(0)
            )}
          </div>
          <div>
            <h1 className={`text-2xl font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>
              {profile.display_name}
            </h1>
            <p className="text-sm text-orange-500">{profile.job_title ?? profile.role}</p>
            <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
              {dept && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{dept.name}</span>}
              <span className="flex items-center gap-1"><Shield className="h-3 w-3" />{profile.role}</span>
              {ui?.last_login_at && <span>Last active: {formatRelativeTime(ui.last_login_at)}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-4 gap-4">
        {/* Readiness, Contract, Teams, Joined — implement similar to quick card but wider */}
      </div>

      {/* Tabs */}
      <div className={`border-b ${isDark ? "border-zinc-800" : "border-zinc-200"}`}>
        <div className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative pb-3 text-sm font-semibold transition-colors ${
                activeTab === tab.key
                  ? isDark ? "text-white" : "text-zinc-900"
                  : isDark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <div className="absolute bottom-0 left-0 h-0.5 w-full rounded-t-full bg-orange-500" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content — full width, more space than quick card */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Contact info card */}
            {/* Teams card */}
            {/* Quick stats card */}
          </div>
        )}
        {activeTab === "competence" && (
          <div>
            {/* Same as quick card competence but with more room */}
            {/* Include assign protocol button */}
          </div>
        )}
        {activeTab === "hr" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Contract history (full list, not just latest) */}
            {/* Personal info (edit mode) */}
            {/* Emergency contact */}
          </div>
        )}
        {activeTab === "settings" && (
          <div className="max-w-md">
            {/* Role, dept, status controls — same as quick card */}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Implementation note:** The full profile page reuses logic from `employee-profile-card.tsx`. Extract shared utilities (like the HR edit form, settings form) into separate components if the duplication becomes unwieldy. But for the first pass, keep it self-contained. Refactor later.

**Step 3: Add "View Full Profile" link to the quick card**

In `employee-profile-card.tsx`, add a link in the header area, next to the close button:

```tsx
import Link from "next/link";
import { ExternalLink } from "lucide-react";

// In the header, next to the X button:
<Link
  href={`/dashboard/people/${employee.profileId}`}
  className={`absolute top-4 right-14 rounded-full p-2 backdrop-blur-md transition-colors ${
    isDark
      ? "bg-black/20 text-white/70 hover:bg-black/40 hover:text-white"
      : "border border-zinc-200/50 bg-white/50 text-zinc-600 shadow-sm hover:bg-white/80 hover:text-zinc-900"
  }`}
>
  <ExternalLink className="h-4 w-4" />
</Link>;
```

**Step 4: Run typecheck**

Run: `pnpm turbo typecheck --filter=web`

Fix any type issues — the server component types from Supabase query results need careful typing.

**Step 5: Navigate to the full profile page**

1. Click on an employee in the table → quick card opens
2. Click the "expand" (ExternalLink) icon in the quick card header
3. Navigates to `/dashboard/people/{profile_id}`
4. Full profile page loads with all tabs
5. "Back" button returns to `/dashboard/people`

**Step 6: Commit**

```bash
git add apps/web/src/app/dashboard/people/[id]/page.tsx \
  apps/web/src/app/dashboard/people/[id]/employee-full-profile.tsx \
  apps/web/src/app/dashboard/people/_components/employee-profile-card.tsx
git commit -m "feat(people): add full-page employee profile at /people/[id]"
```

---

## Task 11: Column Sorting

Add clickable column headers to sort the table.

**Files:**

- Modify: `apps/web/src/app/dashboard/people/_components/people-data-table.tsx`

**Step 1: Add sort state**

```typescript
type SortField = "name" | "role" | "status" | "readiness" | "lastActive" | "contract";
type SortDirection = "asc" | "desc";

const [sortField, setSortField] = useState<SortField | null>(null);
const [sortDir, setSortDir] = useState<SortDirection>("asc");
```

**Step 2: Create sort toggle function**

```typescript
function toggleSort(field: SortField) {
  if (sortField === field) {
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  } else {
    setSortField(field);
    setSortDir("asc");
  }
}
```

**Step 3: Apply sort in filteredEmployees useMemo**

After filtering, add sorting:

```typescript
// Sort
if (sortField) {
  result = [...result].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case "name":
        cmp = a.name.localeCompare(b.name);
        break;
      case "role":
        cmp = a.role.localeCompare(b.role);
        break;
      case "status":
        cmp = a.status.localeCompare(b.status);
        break;
      case "readiness":
        cmp = (a.readinessScore ?? 0) - (b.readinessScore ?? 0);
        break;
      case "lastActive":
        cmp = (a.lastLoginAt ?? "").localeCompare(b.lastLoginAt ?? "");
        break;
      case "contract":
        cmp = (a.contractStatus ?? "").localeCompare(b.contractStatus ?? "");
        break;
    }
    return sortDir === "desc" ? -cmp : cmp;
  });
}
```

Add `sortField` and `sortDir` to the useMemo deps.

**Step 4: Make column headers clickable**

Create a reusable sortable header:

```tsx
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

function SortableHeader({
  field,
  label,
  currentField,
  currentDir,
  onSort,
  className,
}: {
  field: SortField;
  label: string;
  currentField: SortField | null;
  currentDir: SortDirection;
  onSort: (f: SortField) => void;
  className?: string;
}) {
  const active = currentField === field;
  return (
    <th
      className={`cursor-pointer px-6 py-4 text-xs font-bold tracking-widest text-zinc-500 uppercase transition-colors select-none hover:text-zinc-300 ${className ?? ""}`}
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (
          currentDir === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </span>
    </th>
  );
}
```

Replace the static `<th>` elements with `<SortableHeader>` for Employee, Role & Dept, Status, Readiness, Last Active, and Contract columns.

**Step 5: Verify sorting**

Click each column header. Confirm:

- Arrow indicator shows sort direction
- Data sorts correctly
- Clicking again toggles direction

**Step 6: Commit**

```bash
git add apps/web/src/app/dashboard/people/_components/people-data-table.tsx
git commit -m "feat(people): add column sorting to people table"
```

---

## Task 12: Final Typecheck and Cleanup

Run full typecheck and fix any remaining issues.

**Files:**

- Any files with type errors

**Step 1: Run full typecheck**

```bash
pnpm turbo typecheck
```

Fix all errors.

**Step 2: Run lint**

```bash
pnpm turbo lint --filter=web
```

Fix all lint errors.

**Step 3: Visual QA checklist**

Navigate through the full People module and verify:

- [ ] Metric cards show correct numbers (especially readiness)
- [ ] Department filter pills are smaller and use emerald active state
- [ ] Advanced filter popover opens and filters work
- [ ] "Last Active" column shows relative times
- [ ] "Contract" column shows status badges
- [ ] Column headers are sortable
- [ ] Export button opens dialog with column selection
- [ ] Excel export downloads valid .xlsx file
- [ ] Print/PDF opens print preview with selected columns
- [ ] Invite dialog shows real departments
- [ ] Context menu shows current role/dept with green badges
- [ ] Profile card phone shows real data (not hardcoded)
- [ ] Competence tab has "+ Assign" button
- [ ] Assign protocol dialog works end-to-end
- [ ] "View Full Profile" icon in quick card navigates to `/people/[id]`
- [ ] Full profile page loads with all data
- [ ] Back button from full profile returns to people list
- [ ] Bulk action bar has Print button
- [ ] Dark mode works for all new components
- [ ] Responsive: table doesn't break on smaller screens

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore(people): typecheck and lint cleanup"
```

---

## Summary

| Task | Description                                     | New Files                               | Modified Files                                      |
| ---- | ----------------------------------------------- | --------------------------------------- | --------------------------------------------------- |
| 1    | Data layer: last_login_at, contracts, readiness | 1 (format-relative-time.ts)             | 2 (types.ts, page.tsx)                              |
| 2    | Last Active + Contract columns                  | 0                                       | 1 (people-data-table.tsx)                           |
| 3    | Restyle department filter pills                 | 0                                       | 1 (people-data-table.tsx)                           |
| 4    | Advanced filter popover                         | 1 (advanced-filter-popover.tsx)         | 1 (people-data-table.tsx)                           |
| 5    | Fix invite dialog departments                   | 0                                       | 2 (invite-member-dialog.tsx, people-data-table.tsx) |
| 6    | Context menu current-value badges               | 0                                       | 1 (people-row-actions.tsx)                          |
| 7    | Export/Print functionality                      | 1 (export-dialog.tsx)                   | 1 (people-data-table.tsx)                           |
| 8    | Fix hardcoded data in profile card              | 0                                       | 1 (employee-profile-card.tsx)                       |
| 9    | Assign protocol from Competence tab             | 1 (assign-protocol-dialog.tsx)          | 2 (employee-profile-card.tsx, people-actions.ts)    |
| 10   | Full-page employee profile                      | 2 (page.tsx, employee-full-profile.tsx) | 1 (employee-profile-card.tsx)                       |
| 11   | Column sorting                                  | 0                                       | 1 (people-data-table.tsx)                           |
| 12   | Typecheck + cleanup                             | 0                                       | Any with errors                                     |

**Total:** 6 new files, 7 modified files, 1 new dependency (`xlsx`)
