---
title: "People Management"
status: done
updated: 2026-04-10
created: 2026-03-01
module: meta
tags: []
---

# People Management + Position-Dept Mapping Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the people sidebar card functional with real data and editing, add bulk actions to the people table, and add position-department reassignment.

**Architecture:** The profile sidebar card already has 4 tabs with stub content. We rewrite each tab to fetch real data and support inline editing via Supabase client calls. Bulk actions add a checkbox column + floating action bar to the existing data table. Position mapping adds a "Move" menu item to department position dropdowns. All data ops reuse existing `people-actions.ts` server actions or client-side Supabase.

**Tech Stack:** React 19, shadcn/ui (Sheet, Checkbox, Dialog), Supabase client, TypeScript strict

---

## Task 1: Extend Employee type and pass extra data to profile card

**Files:**

- Modify: `apps/web/src/app/dashboard/people/_components/types.ts`
- Modify: `apps/web/src/app/dashboard/people/page.tsx`
- Modify: `apps/web/src/app/dashboard/people/_components/people-data-table.tsx`
- Modify: `apps/web/src/app/dashboard/people/_components/employee-profile-card.tsx`

**Step 1: Extend Employee type with profile_id field**

The `Employee.id` currently holds `profile_id` for profiles but `invitation_id` for invites. Add a dedicated `profileId` field for unambiguous profile updates:

In `types.ts`, add to `Employee`:

```typescript
  profileId?: string; // actual profile_id for DB updates (absent for invited)
```

**Step 2: Set profileId in page.tsx mapping**

In `page.tsx`, in the profile mapping (around line 110-128), add:

```typescript
profileId: p.profile_id,
```

**Step 3: Pass departments and onRefresh to EmployeeProfileCard**

In `people-data-table.tsx`, update the `EmployeeProfileCard` render (line ~435):

```typescript
<EmployeeProfileCard
  employee={selectedEmployee}
  departments={departments}
  isOpen={!!selectedEmployee}
  onClose={() => setSelectedEmployee(null)}
  onRefresh={onRefresh}
/>
```

**Step 4: Update EmployeeProfileCard props**

In `employee-profile-card.tsx`, update the interface:

```typescript
interface EmployeeProfileCardProps {
  employee: Employee | null;
  departments: Department[];
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}
```

Add imports for `Department` from `./types`.

**Step 5: Verify types**

Run: `pnpm typecheck`
Expected: PASS (new optional field won't break existing code)

**Step 6: Commit**

```bash
git add apps/web/src/app/dashboard/people/
git commit -m "feat(people): extend Employee type and thread deps to profile card"
```

---

## Task 2: Rewrite Settings tab with real data + save actions

**Files:**

- Modify: `apps/web/src/app/dashboard/people/_components/employee-profile-card.tsx`

The Settings tab is the most impactful — it enables role, department, and status changes.

**Step 1: Add state and save handlers at the top of the component**

After the `activeTab` state, add:

```typescript
const [editRole, setEditRole] = useState(employee?.role ?? "");
const [editDeptId, setEditDeptId] = useState(employee?.departmentId ?? "");
const [editStatus, setEditStatus] = useState(employee?.status ?? "active");
const [saving, setSaving] = useState(false);
```

Reset these when employee changes — add a useEffect:

```typescript
useEffect(() => {
  if (employee) {
    setEditRole(employee.role.toLowerCase());
    setEditDeptId(employee.departmentId ?? "");
    setEditStatus(employee.status);
    setActiveTab("overview");
  }
}, [employee]);
```

Add save function:

```typescript
async function handleSettingsSave() {
  if (!employee?.profileId) return;
  setSaving(true);
  const supabase = createClient();

  const updates: Record<string, unknown> = {};
  if (editRole !== employee.role.toLowerCase()) updates.role = editRole;
  if (editDeptId !== (employee.departmentId ?? "")) updates.department_id = editDeptId || null;
  if (editStatus !== employee.status) {
    updates.status = editStatus;
    if (editStatus === "offboarding" || editStatus === "inactive") updates.is_active = false;
    else updates.is_active = true;
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase
      .from("profile")
      .update(updates)
      .eq("profile_id", employee.profileId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Profile updated");
      onRefresh();
    }
  }
  setSaving(false);
}
```

Add imports: `createClient` from `@smartout/supabase/client`, `toast` from `sonner`, `useEffect` from `react`.

**Step 2: Rewrite the Settings tab content**

Replace the `{activeTab === "settings" && (...)}` block with:

```typescript
{activeTab === "settings" && (
  <div className="animate-in fade-in zoom-in-95 space-y-6 duration-200">
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
          Primary Department
        </label>
        <select
          value={editDeptId}
          onChange={(e) => setEditDeptId(e.target.value)}
          className={`w-full appearance-none rounded-lg border px-3 py-2 text-sm focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 focus:outline-none ${
            isDark ? "border-zinc-800 bg-zinc-900 text-white" : "border-zinc-200 bg-zinc-50 text-zinc-900"
          }`}
        >
          <option value="">No department</option>
          {departments.map((d) => (
            <option key={d.department_id} value={d.department_id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
          System Role
        </label>
        <select
          value={editRole}
          onChange={(e) => setEditRole(e.target.value)}
          className={`w-full appearance-none rounded-lg border px-3 py-2 text-sm focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 focus:outline-none ${
            isDark ? "border-zinc-800 bg-zinc-900 text-white" : "border-zinc-200 bg-zinc-50 text-zinc-900"
          }`}
        >
          <option value="employee">Employee</option>
          <option value="manager">Manager</option>
          <option value="admin">Admin</option>
          <option value="owner">Owner</option>
        </select>
        <p className={`pt-1 text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
          Defines what this user can see and do in the system.
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
          Status
        </label>
        <select
          value={editStatus}
          onChange={(e) => setEditStatus(e.target.value as Employee["status"])}
          className={`w-full appearance-none rounded-lg border px-3 py-2 text-sm focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 focus:outline-none ${
            isDark ? "border-zinc-800 bg-zinc-900 text-white" : "border-zinc-200 bg-zinc-50 text-zinc-900"
          }`}
        >
          <option value="active">Active</option>
          <option value="trainee">Trainee</option>
          <option value="inactive">Inactive</option>
          <option value="offboarding">Offboarding</option>
        </select>
      </div>

      <button
        onClick={handleSettingsSave}
        disabled={saving || employee?.status === "invited"}
        className="w-full rounded-lg bg-orange-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-500 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save Changes"}
      </button>
    </div>

    <div className={`space-y-3 border-t pt-4 ${isDark ? "border-zinc-800/50" : "border-zinc-200"}`}>
      <button className={`w-full rounded-lg border py-2.5 text-sm font-medium transition-colors ${
        isDark ? "border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white" : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100"
      }`}>
        Reset Password
      </button>
      <button className="w-full rounded-lg border border-rose-500/20 bg-rose-500/10 py-2.5 text-sm font-medium text-rose-500 transition-colors hover:bg-rose-500/20 hover:text-rose-400">
        Deactivate Account
      </button>
    </div>
  </div>
)}
```

**Step 3: Verify types**

Run: `pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/people/_components/employee-profile-card.tsx
git commit -m "feat(people): rewrite Settings tab with real department, role, and status editing"
```

---

## Task 3: Rewrite HR tab with editable personal info

**Files:**

- Modify: `apps/web/src/app/dashboard/people/_components/employee-profile-card.tsx`

**Step 1: Add HR editing state**

After the existing state declarations, add:

```typescript
const [editingHr, setEditingHr] = useState(false);
const [hrAddress, setHrAddress] = useState("");
const [hrPersonalNumber, setHrPersonalNumber] = useState("");
const [hrBankAccount, setHrBankAccount] = useState("");
const [hrEmergencyName, setHrEmergencyName] = useState("");
const [hrEmergencyPhone, setHrEmergencyPhone] = useState("");
```

In the employee useEffect, add resets:

```typescript
setHrAddress(employee.address ?? "");
setHrPersonalNumber(employee.personalNumber ?? "");
setHrBankAccount(employee.bankAccount ?? "");
setHrEmergencyName(employee.emergencyContactName ?? "");
setHrEmergencyPhone(employee.emergencyContactPhone ?? "");
setEditingHr(false);
```

Add save handler:

```typescript
async function handleHrSave() {
  if (!employee?.profileId) return;
  setSaving(true);
  const supabase = createClient();

  // Parse address back into components
  const addressParts = hrAddress.split(",").map((s) => s.trim());
  const { error } = await supabase
    .from("profile")
    .update({
      address_line_1: addressParts[0] || null,
      postal_code: addressParts[1] || null,
      city: addressParts[2] || null,
      personal_number: hrPersonalNumber || null,
      bank_account: hrBankAccount || null,
    })
    .eq("profile_id", employee.profileId);

  if (error) {
    toast.error(error.message);
  } else {
    toast.success("Personal info updated");
    setEditingHr(false);
    onRefresh();
  }
  setSaving(false);
}
```

**Step 2: Rewrite the HR tab content**

Replace the `{activeTab === "hr" && (...)}` block. Keep the Contract Status section as-is (it already works). Replace the Personal Information section with editable fields:

When `editingHr` is false: show read-only display (current pattern) + an "Edit" button.
When `editingHr` is true: show input fields + "Save" / "Cancel" buttons.

Use the same `isDark` input styling pattern from other dialogs:

```typescript
const hrInputClass = `w-full rounded-lg border px-3 py-2 text-sm focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 focus:outline-none ${
  isDark
    ? "border-zinc-800 bg-zinc-900 text-white placeholder:text-zinc-600"
    : "border-zinc-200 bg-zinc-50 text-zinc-900 placeholder:text-zinc-400"
}`;
```

Fields: Address (single text input), Personal Number, Bank Account, Emergency Contact Name, Emergency Contact Phone.

**Step 3: Verify types**

Run: `pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/people/_components/employee-profile-card.tsx
git commit -m "feat(people): rewrite HR tab with editable personal info"
```

---

## Task 4: Rewrite Competence tab with real protocol data

**Files:**

- Modify: `apps/web/src/app/dashboard/people/_components/employee-profile-card.tsx`

**Step 1: Add competence data fetching**

Add state:

```typescript
const [protocols, setProtocols] = useState<
  Array<{
    assignment_id: string;
    status: string;
    progress: number;
    protocol: { name: string; protocol_type: string } | null;
  }>
>([]);
const [loadingProtocols, setLoadingProtocols] = useState(false);
```

Add fetch function:

```typescript
async function fetchProtocols() {
  if (!employee?.profileId) return;
  setLoadingProtocols(true);
  const supabase = createClient();
  const { data } = await supabase
    .from("protocol_assignment")
    .select("protocol_assignment_id, status, progress, protocol:protocol_id(name, protocol_type)")
    .eq("profile_id", employee.profileId);
  setProtocols(
    (data ?? []).map((d) => ({
      assignment_id: d.protocol_assignment_id,
      status: d.status,
      progress: d.progress ?? 0,
      protocol: d.protocol as { name: string; protocol_type: string } | null,
    })),
  );
  setLoadingProtocols(false);
}
```

Call `fetchProtocols()` when the tab is clicked or when the employee changes (in the useEffect when `activeTab === "competence"`).

**Step 2: Rewrite Competence tab to use real data**

Replace the hardcoded protocol list with a `.map()` over `protocols`. Show:

- CheckCircle2 icon for `completed` status
- Animated dot + progress bar for `in_progress` status
- AlertCircle icon for `not_started` status
- Protocol name from `protocol.name`
- Status text and progress percentage

Keep the "Missing Requirements" warning box if readiness < 100%.
Keep the "Send Reminder" button as placeholder.

If `loadingProtocols`, show a spinner. If `protocols.length === 0`, show an empty state.

**Step 3: Verify types**

Run: `pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/people/_components/employee-profile-card.tsx
git commit -m "feat(people): rewrite Competence tab with real protocol assignment data"
```

---

## Task 5: Enhance Overview tab with team memberships

**Files:**

- Modify: `apps/web/src/app/dashboard/people/_components/employee-profile-card.tsx`

**Step 1: Add team membership fetching**

Add state:

```typescript
const [teams, setTeams] = useState<Array<{ team_id: string; name: string; team_type: string }>>([]);
```

Add fetch (call in useEffect when employee changes):

```typescript
async function fetchTeams() {
  if (!employee?.profileId) return;
  const supabase = createClient();
  const { data } = await supabase
    .from("team_member")
    .select("team:team_id(team_id, name, team_type)")
    .eq("profile_id", employee.profileId);
  setTeams(
    (data ?? [])
      .map((d) => d.team as { team_id: string; name: string; team_type: string } | null)
      .filter(Boolean) as Array<{ team_id: string; name: string; team_type: string }>,
  );
}
```

**Step 2: Add teams section to Overview tab**

After the contact info section, before "Recent Activity", add:

```typescript
{teams.length > 0 && (
  <div>
    <h3 className={`mb-3 text-xs font-bold tracking-widest uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
      Teams
    </h3>
    <div className="flex flex-wrap gap-2">
      {teams.map((t) => (
        <span
          key={t.team_id}
          className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
            isDark ? "border-zinc-800 bg-zinc-900 text-zinc-300" : "border-zinc-200 bg-zinc-50 text-zinc-700"
          }`}
        >
          {t.name}
        </span>
      ))}
    </div>
  </div>
)}
```

Keep "Recent Activity" as hardcoded placeholder (needs `activity_trail` data from future wave).

**Step 3: Verify types**

Run: `pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/people/_components/employee-profile-card.tsx
git commit -m "feat(people): add real team memberships to Overview tab"
```

---

## Task 6: Add bulk actions to PeopleDataTable

**Files:**

- Modify: `apps/web/src/app/dashboard/people/_components/people-data-table.tsx`
- Modify: `apps/web/src/app/dashboard/people/_actions/people-actions.ts`

**Step 1: Add bulk server actions**

In `people-actions.ts`, add:

```typescript
export async function bulkUpdateProfiles(
  profileIds: string[],
  workspaceId: string,
  updates: Record<string, unknown>,
) {
  const supabase = await getClient();
  const { error } = await supabase
    .from("profile")
    .update(updates)
    .in("profile_id", profileIds)
    .eq("workspace_id", workspaceId);
  if (error) throw new Error(error.message);
}
```

**Step 2: Add selection state to PeopleDataTable**

Add state:

```typescript
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
```

Import `Checkbox` from `@/components/ui/checkbox` and `bulkUpdateProfiles` from the actions.

Add helpers:

```typescript
const selectableEmployees = filteredEmployees.filter((e) => e.status !== "invited" && e.profileId);
const allSelected =
  selectableEmployees.length > 0 && selectableEmployees.every((e) => selectedIds.has(e.id));

function toggleSelect(id: string) {
  setSelectedIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
}

function toggleSelectAll() {
  if (allSelected) {
    setSelectedIds(new Set());
  } else {
    setSelectedIds(new Set(selectableEmployees.map((e) => e.id)));
  }
}
```

**Step 3: Add checkbox column to table**

Add a checkbox header:

```typescript
<th className="w-12 px-3 py-4">
  <Checkbox
    checked={allSelected}
    onCheckedChange={toggleSelectAll}
    className="border-zinc-600"
  />
</th>
```

Add checkbox to each row (only for non-invited):

```typescript
<td className="px-3 py-4" onClick={(e) => e.stopPropagation()}>
  {emp.status !== "invited" && emp.profileId && (
    <Checkbox
      checked={selectedIds.has(emp.id)}
      onCheckedChange={() => toggleSelect(emp.id)}
      className="border-zinc-600"
    />
  )}
</td>
```

**Step 4: Add floating bulk action bar**

Between the table header controls and the table body, add (only shown when `selectedIds.size > 0`):

```typescript
{selectedIds.size > 0 && (
  <div className={`flex items-center gap-3 border-b px-5 py-3 ${
    isDark ? "border-zinc-800 bg-orange-500/5" : "border-zinc-200 bg-orange-50"
  }`}>
    <span className={`text-sm font-semibold ${isDark ? "text-orange-400" : "text-orange-600"}`}>
      {selectedIds.size} selected
    </span>
    <div className="flex items-center gap-2">
      <select
        onChange={async (e) => {
          if (!e.target.value) return;
          const ids = Array.from(selectedIds).filter((id) => {
            const emp = employees.find((x) => x.id === id);
            return emp?.profileId;
          });
          const profileIds = ids.map((id) => employees.find((x) => x.id === id)!.profileId!);
          try {
            await bulkUpdateProfiles(profileIds, workspaceId, { department_id: e.target.value });
            toast.success(`${profileIds.length} profiles updated`);
            setSelectedIds(new Set());
            onRefresh();
          } catch { toast.error("Bulk update failed"); }
          e.target.value = "";
        }}
        className={`rounded-lg border px-2 py-1.5 text-xs ${
          isDark ? "border-zinc-700 bg-zinc-900 text-zinc-300" : "border-zinc-200 bg-white text-zinc-700"
        }`}
      >
        <option value="">Assign Dept...</option>
        {departments.map((d) => (
          <option key={d.department_id} value={d.department_id}>{d.name}</option>
        ))}
      </select>
      <select
        onChange={async (e) => {
          if (!e.target.value) return;
          const profileIds = Array.from(selectedIds)
            .map((id) => employees.find((x) => x.id === id)?.profileId)
            .filter(Boolean) as string[];
          try {
            await bulkUpdateProfiles(profileIds, workspaceId, { role: e.target.value });
            toast.success(`${profileIds.length} profiles updated`);
            setSelectedIds(new Set());
            onRefresh();
          } catch { toast.error("Bulk update failed"); }
          e.target.value = "";
        }}
        className={`rounded-lg border px-2 py-1.5 text-xs ${
          isDark ? "border-zinc-700 bg-zinc-900 text-zinc-300" : "border-zinc-200 bg-white text-zinc-700"
        }`}
      >
        <option value="">Change Role...</option>
        <option value="employee">Employee</option>
        <option value="manager">Manager</option>
        <option value="admin">Admin</option>
      </select>
      <select
        onChange={async (e) => {
          if (!e.target.value) return;
          const profileIds = Array.from(selectedIds)
            .map((id) => employees.find((x) => x.id === id)?.profileId)
            .filter(Boolean) as string[];
          const updates: Record<string, unknown> = { status: e.target.value };
          if (e.target.value === "offboarding" || e.target.value === "inactive") updates.is_active = false;
          else updates.is_active = true;
          try {
            await bulkUpdateProfiles(profileIds, workspaceId, updates);
            toast.success(`${profileIds.length} profiles updated`);
            setSelectedIds(new Set());
            onRefresh();
          } catch { toast.error("Bulk update failed"); }
          e.target.value = "";
        }}
        className={`rounded-lg border px-2 py-1.5 text-xs ${
          isDark ? "border-zinc-700 bg-zinc-900 text-zinc-300" : "border-zinc-200 bg-white text-zinc-700"
        }`}
      >
        <option value="">Change Status...</option>
        <option value="active">Active</option>
        <option value="trainee">Trainee</option>
        <option value="inactive">Inactive</option>
        <option value="offboarding">Offboarding</option>
      </select>
      <button
        onClick={() => setSelectedIds(new Set())}
        className={`rounded-lg px-2 py-1.5 text-xs font-medium ${
          isDark ? "text-zinc-400 hover:text-zinc-200" : "text-zinc-500 hover:text-zinc-700"
        }`}
      >
        Clear
      </button>
    </div>
  </div>
)}
```

**Step 5: Import bulkUpdateProfiles**

Add to the imports at the top:

```typescript
import {
  updateProfileRole,
  updateProfileDepartment,
  deactivateProfile,
  resetUserPassword,
  cancelInvitation,
  bulkUpdateProfiles,
} from "../_actions/people-actions";
```

**Step 6: Verify types**

Run: `pnpm typecheck`
Expected: PASS

**Step 7: Commit**

```bash
git add apps/web/src/app/dashboard/people/
git commit -m "feat(people): add bulk actions with multi-select to people data table"
```

---

## Task 7: Add position-department reassignment

**Files:**

- Create: `apps/web/src/app/dashboard/organization/_components/MovePositionDialog.tsx`
- Modify: `apps/web/src/app/dashboard/organization/_components/departments-tab.tsx`

**Step 1: Create MovePositionDialog**

```typescript
"use client";

import { useState } from "react";
import { createClient } from "@smartout/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import type { DepartmentRow, PositionRow } from "./types";

type MovePositionDialogProps = {
  position: PositionRow;
  departments: DepartmentRow[];
  isDark: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => Promise<void>;
};

export function MovePositionDialog({
  position,
  departments,
  isDark,
  open,
  onOpenChange,
  onSave,
}: MovePositionDialogProps) {
  const [targetDeptId, setTargetDeptId] = useState(position.department_id);
  const [saving, setSaving] = useState(false);

  const inputClass = `w-full rounded-lg border px-4 py-2.5 text-sm transition-all focus:outline-none focus:ring-1 ${
    isDark
      ? "border-zinc-800 bg-zinc-950 text-white focus:border-orange-500/50 focus:ring-orange-500/50"
      : "border-zinc-200 bg-white text-zinc-900 focus:border-orange-500/50 focus:ring-orange-500/50"
  }`;

  async function handleSave() {
    if (targetDeptId === position.department_id) {
      onOpenChange(false);
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("position")
      .update({ department_id: targetDeptId })
      .eq("position_id", position.position_id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`"${position.name}" moved`);
      onOpenChange(false);
      await onSave();
    }
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={
          isDark
            ? "border-zinc-800 bg-zinc-950 text-white"
            : "border-zinc-200 bg-white text-zinc-900"
        }
      >
        <DialogHeader>
          <DialogTitle>Move Position</DialogTitle>
          <DialogDescription className={isDark ? "text-zinc-400" : "text-zinc-500"}>
            Move &ldquo;{position.name}&rdquo; to a different department.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <select
            value={targetDeptId}
            onChange={(e) => setTargetDeptId(e.target.value)}
            className={`${inputClass} appearance-none`}
          >
            {departments
              .filter((d) => d.is_active)
              .map((d) => (
                <option key={d.department_id} value={d.department_id}>
                  {d.name}{d.department_id === position.department_id ? " (current)" : ""}
                </option>
              ))}
          </select>
        </div>
        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
              isDark
                ? "border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || targetDeptId === position.department_id}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-500 disabled:opacity-50"
          >
            {saving ? "Moving..." : "Move"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Add "Move to Department" menu item in departments-tab.tsx**

Import `MovePositionDialog` and `ArrowRightLeft` icon from lucide-react.

Add state:

```typescript
const [movePosition, setMovePosition] = useState<PositionRow | null>(null);
```

In the position dropdown menu (inside the expanded positions section), add before the Deactivate item:

```typescript
<DropdownMenuItem onClick={() => setMovePosition(pos)}>
  <ArrowRightLeft className="mr-2 h-3.5 w-3.5" />
  Move to Department
</DropdownMenuItem>
```

At the bottom of the component, add the dialog render:

```typescript
{movePosition && (
  <MovePositionDialog
    position={movePosition}
    departments={departments}
    isDark={isDark}
    open={!!movePosition}
    onOpenChange={(open) => {
      if (!open) setMovePosition(null);
    }}
    onSave={onRefresh}
  />
)}
```

**Step 3: Verify types**

Run: `pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/organization/_components/MovePositionDialog.tsx apps/web/src/app/dashboard/organization/_components/departments-tab.tsx
git commit -m "feat(org): add position-department reassignment dialog"
```

---

## Task 8: Full typecheck, lint, and update WORKLOG

**Step 1: Full typecheck**

Run: `pnpm typecheck`
Expected: All 18 packages PASS

**Step 2: Lint**

Run: `pnpm lint`
Expected: 0 errors (only pre-existing warnings)

**Step 3: Update WORKLOG**

Update `docs/WORKLOG.md` with all completed tasks.

**Step 4: Commit**

```bash
git add docs/WORKLOG.md
git commit -m "docs: update WORKLOG with people management progress"
```

---

## Summary

| Task | What                                              | Files                                       |
| ---- | ------------------------------------------------- | ------------------------------------------- |
| 1    | Extend Employee type, thread deps to profile card | types.ts, page.tsx, data-table, card        |
| 2    | Settings tab: real dept/role/status editing       | employee-profile-card.tsx                   |
| 3    | HR tab: editable personal info                    | employee-profile-card.tsx                   |
| 4    | Competence tab: real protocol data                | employee-profile-card.tsx                   |
| 5    | Overview tab: real team memberships               | employee-profile-card.tsx                   |
| 6    | Bulk actions: multi-select + action bar           | data-table.tsx, people-actions.ts           |
| 7    | Position-dept reassignment                        | MovePositionDialog.tsx, departments-tab.tsx |
| 8    | Typecheck + lint + WORKLOG                        | docs                                        |

**Total: 8 tasks, 1 new file, ~6 modified files**
