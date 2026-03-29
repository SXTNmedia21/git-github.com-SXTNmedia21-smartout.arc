# Staff Handling Complete — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 19 staff handling gaps, clean up 266 hardcoded design tokens, and add mobile read-only screens with a shared data layer.

**Architecture:** Shared types and data-fetching logic extracted to `packages/utils/src/people/`. Web components refactored to use semantic CSS variable classes. Mobile screens read from the same Supabase queries via shared functions. One Edge Function modification (watchdog-integrity) for invitation expiry cleanup.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Supabase (PostgreSQL), React Native + Expo, Tailwind v4 CSS variables, shadcn/ui, `@smartout/design-tokens`, `@smartout/utils`

**Spec:** `docs/superpowers/specs/2026-03-22-staff-handling-complete-design.md`

---

## File Structure

| File                                                                      | Action | Responsibility                                                                                                                                                         |
| ------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/utils/src/people/types.ts`                                      | Create | Shared `Employee`, `Department`, `ProfileRole`, `ProfileStatus` types                                                                                                  |
| `packages/utils/src/people/status-transitions.ts`                         | Create | `VALID_TRANSITIONS` map + `isValidTransition()` helper                                                                                                                 |
| `packages/utils/src/people/fetch-people.ts`                               | Create | `fetchWorkspacePeople()` — 4 parallel queries (profiles, depts, invitations, readiness + contracts)                                                                    |
| `packages/utils/src/people/index.ts`                                      | Create | Barrel export                                                                                                                                                          |
| `packages/utils/src/index.ts`                                             | Modify | Add `people` re-export                                                                                                                                                 |
| `apps/web/src/app/dashboard/people/_components/types.ts`                  | Modify | Re-export from `@smartout/utils/people`                                                                                                                                |
| `apps/web/src/app/dashboard/people/_actions/people-actions.ts`            | Modify | Add server actions: `resendInvitation`, `sendProtocolReminder`, `addToTeam`, `removeFromTeam`, `reactivateProfile`, `updateProfileStatus` (with transition validation) |
| `apps/web/src/app/dashboard/people/page.tsx`                              | Modify | Use `fetchWorkspacePeople()`, fix readiness/contract/expired-invite metrics                                                                                            |
| `apps/web/src/app/dashboard/people/_components/people-data-table.tsx`     | Modify | Fix readiness display, add bulk deactivate, export, advanced filters, design tokens                                                                                    |
| `apps/web/src/app/dashboard/people/_components/people-row-actions.tsx`    | Modify | Fix `profileId` usage, add reactivate action                                                                                                                           |
| `apps/web/src/app/dashboard/people/_components/employee-profile-card.tsx` | Modify | Fix invited drawer (remove fake hours/activity), wire reminder, design tokens                                                                                          |
| `apps/web/src/app/dashboard/people/_components/invite-member-dialog.tsx`  | Modify | Add SMS/link invite type selector, design tokens                                                                                                                       |
| `apps/web/src/app/dashboard/people/[id]/page.tsx`                         | Modify | Add schedule tab, activity tab, team management, status transition enforcement, design tokens                                                                          |
| `supabase/functions/watchdog-integrity/index.ts`                          | Modify | Add `expire_stale_invitations()` RPC call                                                                                                                              |
| `apps/mobile/app/(app)/(home)/team.tsx`                                   | Create | Mobile team list screen                                                                                                                                                |
| `apps/mobile/app/(app)/(home)/team/[id].tsx`                              | Create | Mobile team member detail screen                                                                                                                                       |

---

### Task 1: Shared types + status transitions package

**Why:** Foundation for all other tasks. Types and transition logic must exist before web/mobile can consume them.

**Files:**

- Create: `packages/utils/src/people/types.ts`
- Create: `packages/utils/src/people/status-transitions.ts`
- Create: `packages/utils/src/people/index.ts`
- Modify: `packages/utils/src/index.ts`

- [ ] **Step 1: Create shared types**

Create `packages/utils/src/people/types.ts`:

```typescript
export type ProfileStatus = "active" | "inactive" | "trainee" | "offboarding";

export type ProfileRole = "owner" | "admin" | "manager" | "employee";

export type Employee = {
  id: string;
  profileId?: string;
  name: string;
  email: string;
  role: string;
  department: string;
  departmentId: string | null;
  departments?: string[];
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
  inviteStatus?: "pending" | "expired";
  inviteToken?: string;
  inviteExpiresAt?: string;
  inviteType?: "email" | "sms" | "link";
  teamCount?: number;
};

export type Department = {
  department_id: string;
  name: string;
};
```

- [ ] **Step 2: Create status transitions**

Create `packages/utils/src/people/status-transitions.ts`:

```typescript
import type { ProfileStatus } from "./types";

export const VALID_TRANSITIONS: Record<ProfileStatus, ProfileStatus[]> = {
  trainee: ["active", "offboarding"],
  active: ["inactive", "offboarding"],
  inactive: ["active", "offboarding"],
  offboarding: ["active"],
};

export function isValidTransition(from: ProfileStatus, to: ProfileStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
```

- [ ] **Step 3: Create barrel export and wire to parent package**

Create `packages/utils/src/people/index.ts`:

```typescript
export * from "./types";
export * from "./status-transitions";
```

Add to `packages/utils/src/index.ts`:

```typescript
export * from "./people";
```

- [ ] **Step 4: Update web types.ts to re-export**

In `apps/web/src/app/dashboard/people/_components/types.ts`, replace the contents with:

```typescript
export type { Employee, Department, ProfileRole, ProfileStatus } from "@smartout/utils";
```

- [ ] **Step 5: Verify typecheck passes**

```bash
cd apps/web && ./node_modules/.bin/tsc --noEmit 2>&1 | grep "people" | head -20
```

Expected: 0 errors in people module (existing errors elsewhere are pre-existing).

- [ ] **Step 6: Commit**

```bash
git add packages/utils/src/people/ packages/utils/src/index.ts apps/web/src/app/dashboard/people/_components/types.ts
git commit -m "refactor(people): extract shared types and status transitions to @smartout/utils"
```

---

### Task 2: Shared data fetching + fix readiness/contracts/expiry on people page

**Why:** Fixes the 3 worst data integrity issues (readiness always 0%, hasContract always false, expired shown as pending) and creates the shared fetch function for mobile.

**Files:**

- Create: `packages/utils/src/people/fetch-people.ts`
- Modify: `apps/web/src/app/dashboard/people/page.tsx`

- [ ] **Step 1: Create shared fetch function**

Create `packages/utils/src/people/fetch-people.ts`:

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";

type ProfileRow = {
  profile_id: string;
  display_name: string;
  job_title: string | null;
  role: string;
  status: string;
  avatar_url: string | null;
  department_id: string | null;
  departments: string[] | null;
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
  } | null;
};

type InvitationRow = {
  invitation_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  department_ids: string[] | null;
  status: string;
  token: string;
  expires_at: string;
  invite_type: string | null;
};

type ReadinessRow = {
  profile_id: string;
  total: number;
  completed: number;
};

export type FetchPeopleResult = {
  profiles: ProfileRow[];
  departments: { department_id: string; name: string }[];
  invitations: InvitationRow[];
  readinessMap: Map<string, number>;
  contractProfileIds: Set<string>;
};

export async function fetchWorkspacePeople(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<FetchPeopleResult> {
  const [profilesRes, deptsRes, invitesRes, readinessRes, contractsRes] = await Promise.all([
    supabase
      .from("profile")
      .select(
        `profile_id, display_name, job_title, role, status, avatar_url,
         department_id, departments, address_line_1, postal_code, city,
         personal_number, bank_account, is_active,
         department:department_id(name),
         user_identity:user_id(email, phone, emergency_contact_name, emergency_contact_phone)`,
      )
      .eq("workspace_id", workspaceId)
      .returns<ProfileRow[]>(),
    supabase
      .from("department")
      .select("department_id, name")
      .eq("workspace_id", workspaceId)
      .order("sort_order"),
    supabase
      .from("invitation")
      .select(
        "invitation_id, email, first_name, last_name, role, department_ids, status, token, expires_at, invite_type",
      )
      .eq("workspace_id", workspaceId)
      .eq("status", "pending")
      .returns<InvitationRow[]>(),
    // Readiness: join through profile to scope by workspace
    supabase.rpc("get_workspace_readiness", { p_workspace_id: workspaceId }),
    // Contracts: distinct profile_ids with signed contracts
    supabase
      .from("employment_contract")
      .select("profile_id")
      .eq("workspace_id", workspaceId)
      .eq("status", "signed"),
  ]);

  // Build readiness map
  const readinessMap = new Map<string, number>();
  if (readinessRes.data) {
    for (const row of readinessRes.data as ReadinessRow[]) {
      readinessMap.set(
        row.profile_id,
        row.total > 0 ? Math.round((row.completed / row.total) * 100) : 0,
      );
    }
  }

  // Build contract set
  const contractProfileIds = new Set<string>();
  if (contractsRes.data) {
    for (const row of contractsRes.data) {
      contractProfileIds.add((row as { profile_id: string }).profile_id);
    }
  }

  return {
    profiles: profilesRes.data ?? [],
    departments: deptsRes.data ?? [],
    invitations: invitesRes.data ?? [],
    readinessMap,
    contractProfileIds,
  };
}
```

- [ ] **Step 2: Create the readiness RPC migration**

The `get_workspace_readiness` RPC doesn't exist yet. Create a migration:

```bash
echo "supabase/migrations/$(date +%Y%m%d%H%M%S)_add_workspace_readiness_rpc.sql"
```

Write the migration:

```sql
-- RPC to compute readiness scores per profile in a workspace.
-- Joins protocol_assignment through profile to scope by workspace.
CREATE OR REPLACE FUNCTION public.get_workspace_readiness(p_workspace_id uuid)
RETURNS TABLE(profile_id uuid, total bigint, completed bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    p.profile_id,
    COUNT(pa.assignment_id) AS total,
    COUNT(pa.assignment_id) FILTER (WHERE pa.status = 'completed') AS completed
  FROM public.profile p
  JOIN public.protocol_assignment pa ON pa.profile_id = p.profile_id
  WHERE p.workspace_id = p_workspace_id
  GROUP BY p.profile_id;
$$;

COMMENT ON FUNCTION public.get_workspace_readiness(uuid)
  IS 'Returns readiness stats (total/completed protocol assignments) per profile in a workspace.';
```

Apply locally:

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/<filename>.sql
```

- [ ] **Step 3: Update barrel export**

Add to `packages/utils/src/people/index.ts`:

```typescript
export * from "./fetch-people";
```

- [ ] **Step 4: Refactor page.tsx to use shared fetch + fix all 3 data issues**

Rewrite `page.tsx` `fetchData` to use `fetchWorkspacePeople()`. Key changes:

1. Import `fetchWorkspacePeople` from `@smartout/utils`
2. Replace inline queries with shared function call
3. Map `readinessScore: result.readinessMap.get(p.profile_id)` (undefined if no assignments)
4. Map `hasContract: result.contractProfileIds.has(p.profile_id)`
5. Map invitation rows with `inviteExpiresAt` and `inviteType`
6. Fix pending invites count: `invitations.filter(i => i.inviteStatus !== 'expired').length`

- [ ] **Step 5: Fix readiness display in people-data-table.tsx**

In the readiness column (around line 556-589), change:

```typescript
// OLD: always renders 0%
{emp.readinessScore ?? 0}%

// NEW: render "N/A" when undefined
{emp.readinessScore !== undefined ? `${emp.readinessScore}%` : "—"}
```

Also fix the readiness bar and icon to not render when `readinessScore === undefined`.

- [ ] **Step 6: Commit**

```bash
git add packages/utils/src/people/ supabase/migrations/*_add_workspace_readiness_rpc.sql apps/web/src/app/dashboard/people/page.tsx apps/web/src/app/dashboard/people/_components/people-data-table.tsx
git commit -m "fix(people): compute real readiness scores, contract status, and fix expired invite count"
```

---

### Task 3: Fix profileId usage + reactivation path

**Why:** Fixes silent failures when mutation callbacks receive `invitation_id` instead of `profile_id`. Adds reactivation action for offboarding employees.

**Files:**

- Modify: `apps/web/src/app/dashboard/people/_components/people-row-actions.tsx`
- Modify: `apps/web/src/app/dashboard/people/_components/people-data-table.tsx`
- Modify: `apps/web/src/app/dashboard/people/_actions/people-actions.ts`

- [ ] **Step 1: Fix people-row-actions.tsx — use profileId for all profile mutations**

Replace `employee.id` with `employee.profileId!` in:

- `onRoleChange` call (line ~146)
- `onDepartmentChange` call (line ~169)
- `onConfirmAction` deactivate (line ~201) — already uses `employee.id` as `profileId` field

Add reactivate action for offboarding employees:

```typescript
// After the isActionable block, add:
{employee.status === "offboarding" && isAdmin && (
  <>
    <DropdownMenuSeparator />
    <DropdownMenuItem
      onClick={() =>
        onConfirmAction({
          type: "reactivate",
          profileId: employee.profileId!,
          name: employee.name,
        })
      }
    >
      <RefreshCw className="mr-2 h-4 w-4" />
      Reactivate
    </DropdownMenuItem>
  </>
)}
```

Update `ConfirmAction` type to include reactivate:

```typescript
type ConfirmAction =
  | { type: "deactivate"; profileId: string; name: string }
  | { type: "cancelInvite"; invitationId: string; name: string }
  | { type: "resetPassword"; email: string; name: string }
  | { type: "reactivate"; profileId: string; name: string };
```

Update `onResendInvite` prop type — already fixed in previous branch.

- [ ] **Step 2: Add reactivate handler in people-data-table.tsx**

Add a new case in `handleConfirmAction`:

```typescript
case "reactivate":
  setConfirmDialog({
    open: true,
    title: "Reactivate employee",
    description: `This will restore full access for ${action.name}. Continue?`,
    confirmLabel: "Reactivate",
    variant: "default",
    onConfirm: async () => {
      try {
        await reactivateProfile(action.profileId, workspaceId);
        toast.success(`${action.name} has been reactivated`);
        onRefresh();
      } catch {
        toast.error("Failed to reactivate employee");
      }
      setConfirmDialog((prev) => ({ ...prev, open: false }));
    },
  });
  break;
```

Add `reactivateProfile` to imports from `people-actions`.

- [ ] **Step 3: Add reactivateProfile server action**

In `people-actions.ts`:

```typescript
export async function reactivateProfile(profileId: string, workspaceId: string) {
  const supabase = await getClient();
  const { error } = await supabase
    .from("profile")
    .update({ status: "active", is_active: true } satisfies TablesUpdate<"profile">)
    .eq("profile_id", profileId)
    .eq("workspace_id", workspaceId);

  if (error) throw new Error(error.message);
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/people/_components/people-row-actions.tsx apps/web/src/app/dashboard/people/_components/people-data-table.tsx apps/web/src/app/dashboard/people/_actions/people-actions.ts
git commit -m "fix(people): use profileId for mutations, add reactivation path for offboarding"
```

---

### Task 4: Fix invited drawer + profile detail activity

**Why:** Removes fake data (142h, hardcoded activity) and replaces with truthful content.

**Files:**

- Modify: `apps/web/src/app/dashboard/people/_components/employee-profile-card.tsx`
- Modify: `apps/web/src/app/dashboard/people/[id]/page.tsx`

- [ ] **Step 1: Fix employee-profile-card.tsx — invited drawer**

1. Replace the hardcoded "142h" metric with invite metadata:
   - If employee is invited: show invite status (Pending/Expired), expiry date, invite type
   - If employee has a profile: show "Teams: {teamCount}" from fetched teams

2. Remove the fake "Recent Activity" section for invited users. Only show activity for users with a `profileId`.

- [ ] **Step 2: Add real activity_trail query to profile detail page**

In `[id]/page.tsx`, add an `activity_trail` fetch in the data loading:

```typescript
// Add to the parallel fetch
const activityRes = await supabase
  .from("activity_trail")
  .select("id, event, action_verb, category, entity_type, entity_id, metadata, created_at")
  .eq("actor_id", profileId)
  .order("created_at", { ascending: false })
  .limit(5);
```

Replace the hardcoded activity items on the Overview tab with real data or an empty state:

```typescript
{activities.length > 0 ? (
  activities.map((a) => (
    <ActivityItem key={a.id} title={a.event} time={new Date(a.created_at).toLocaleString()} />
  ))
) : (
  <p className="text-muted-foreground text-sm">No activity recorded yet</p>
)}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/people/_components/employee-profile-card.tsx apps/web/src/app/dashboard/people/[id]/page.tsx
git commit -m "fix(people): replace fake hours and activity with real data and empty states"
```

---

### Task 5: Server actions — reminder, teams, status validation, multi-dept

**Why:** Wires up all the stub buttons and adds missing server-side logic.

**Files:**

- Modify: `apps/web/src/app/dashboard/people/_actions/people-actions.ts`

- [ ] **Step 1: Add sendProtocolReminder**

```typescript
export async function sendProtocolReminder(
  profileId: string,
  assignmentId: string,
  workspaceId: string,
) {
  const supabase = await getClient();

  // Fetch protocol name for the activity log
  const { data: assignment } = await supabase
    .from("protocol_assignment")
    .select("protocol:protocol_id(name)")
    .eq("assignment_id", assignmentId)
    .single();

  const protocolName =
    (assignment?.protocol as { name: string } | null)?.name ?? "Unknown protocol";

  // Log reminder to activity_trail
  // TODO: dispatch actual email/push notification via Edge Function when available
  const { error } = await supabase.from("activity_trail").insert({
    workspace_id: workspaceId,
    actor_id: profileId,
    event: `Reminder sent for ${protocolName}`,
    action_verb: "sent",
    category: "training",
    entity_type: "protocol_assignment",
    entity_id: assignmentId,
    metadata: { protocol_name: protocolName, type: "reminder" },
  });

  if (error) throw new Error(error.message);
}
```

- [ ] **Step 2: Add team management actions**

```typescript
export async function addToTeam(profileId: string, teamId: string) {
  const supabase = await getClient();
  const { error } = await supabase
    .from("team_member")
    .insert({ profile_id: profileId, team_id: teamId });

  if (error) throw new Error(error.message);
}

export async function removeFromTeam(profileId: string, teamId: string) {
  const supabase = await getClient();
  const { error } = await supabase
    .from("team_member")
    .delete()
    .eq("profile_id", profileId)
    .eq("team_id", teamId);

  if (error) throw new Error(error.message);
}
```

- [ ] **Step 3: Add updateProfileStatus with transition validation**

```typescript
import { isValidTransition } from "@smartout/utils";
import type { ProfileStatus } from "@smartout/utils";

export async function updateProfileStatus(
  profileId: string,
  workspaceId: string,
  currentStatus: ProfileStatus,
  newStatus: ProfileStatus,
) {
  if (!isValidTransition(currentStatus, newStatus)) {
    throw new Error(`Invalid status transition: ${currentStatus} → ${newStatus}`);
  }

  const supabase = await getClient();
  const isActive = newStatus === "active" || newStatus === "trainee";
  const { error } = await supabase
    .from("profile")
    .update({ status: newStatus, is_active: isActive } satisfies TablesUpdate<"profile">)
    .eq("profile_id", profileId)
    .eq("workspace_id", workspaceId);

  if (error) throw new Error(error.message);
}
```

- [ ] **Step 4: Update updateProfileDepartment for multi-dept**

Update the existing function to preserve the departments array:

```typescript
export async function updateProfileDepartment(
  profileId: string,
  workspaceId: string,
  departmentId: string,
) {
  const supabase = await getClient();

  // Fetch current departments array to preserve multi-dept assignments
  const { data: current } = await supabase
    .from("profile")
    .select("departments")
    .eq("profile_id", profileId)
    .single();

  const currentDepts: string[] = (current?.departments as string[]) ?? [];
  // Replace the first element (primary dept) while keeping the rest
  const updatedDepts =
    currentDepts.length > 1 ? [departmentId, ...currentDepts.slice(1)] : [departmentId];

  const { error } = await supabase
    .from("profile")
    .update({ department_id: departmentId, departments: updatedDepts })
    .eq("profile_id", profileId)
    .eq("workspace_id", workspaceId);

  if (error) throw new Error(error.message);
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/people/_actions/people-actions.ts
git commit -m "feat(people): add reminder, team management, status validation, multi-dept server actions"
```

---

### Task 6: Profile detail page — schedule tab, activity tab, team management, status enforcement

**Why:** Adds the 3 missing tabs and wires status transition enforcement + team management UI.

**Files:**

- Modify: `apps/web/src/app/dashboard/people/[id]/page.tsx`

- [ ] **Step 1: Add Schedule tab**

Add a tab option and query `schedule_shift`:

```typescript
const shiftsRes = await supabase
  .from("schedule_shift")
  .select("shift_id, start_time, end_time, status, department:department_id(name)")
  .eq("profile_id", profileId)
  .gte("start_time", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
  .lte("start_time", new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
  .order("start_time");
```

Render as a compact list with date headers. Empty state: "No shifts scheduled" with calendar icon.

- [ ] **Step 2: Add Activity tab**

Full paginated view of `activity_trail`:

```typescript
const [activityPage, setActivityPage] = useState(0);
const ACTIVITY_PAGE_SIZE = 20;

// Fetch on tab switch or "load more"
const activityRes = await supabase
  .from("activity_trail")
  .select("id, event, action_verb, category, entity_type, created_at, metadata")
  .eq("actor_id", profileId)
  .order("created_at", { ascending: false })
  .range(0, (activityPage + 1) * ACTIVITY_PAGE_SIZE - 1);
```

Render chronological list with "Load more" button.

- [ ] **Step 3: Add team management to Settings tab**

Add after the department dropdown in the Settings tab:

1. Fetch workspace teams: `supabase.from("team").select("team_id, name").eq("workspace_id", workspaceId)`
2. Display current teams with remove (X) button
3. Dropdown to add to team (filtered to exclude already-assigned)
4. Call `addToTeam`/`removeFromTeam` server actions

- [ ] **Step 4: Enforce status transitions in Settings tab**

Import `VALID_TRANSITIONS` from `@smartout/utils`. In the status dropdown:

```typescript
const allowedStatuses = VALID_TRANSITIONS[profile.status as ProfileStatus] ?? [];

// In the <select>:
{(["active", "trainee", "inactive", "offboarding"] as ProfileStatus[]).map((s) => (
  <option key={s} value={s} disabled={!allowedStatuses.includes(s) && s !== profile.status}>
    {STATUS_LABELS[s]} {!allowedStatuses.includes(s) && s !== profile.status ? "(not allowed)" : ""}
  </option>
))}
```

Wire save to `updateProfileStatus` instead of raw profile update.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/people/[id]/page.tsx
git commit -m "feat(people): add schedule tab, activity tab, team management, status enforcement"
```

---

### Task 7: Invite dialog — SMS/link support

**Why:** The Edge Function supports 3 invite types but the UI only exposes email.

**Files:**

- Modify: `apps/web/src/app/dashboard/people/_components/invite-member-dialog.tsx`

- [ ] **Step 1: Add invite type selector to single-invite form**

Add a radio group or segmented control with 3 options:

- **Email** (default): shows email input, hides phone
- **SMS**: shows phone input, hides email
- **Link**: hides both, shows info text "A shareable invite link will be generated"

- [ ] **Step 2: Wire invite_type to the Edge Function call**

In the submit handler for single invite, pass `invite_type` to the Edge Function:

```typescript
const { data, error } = await supabase.functions.invoke("create-invitation", {
  body: {
    workspace_id: workspaceId,
    invite_type: inviteType, // "email" | "sms" | "link"
    email: inviteType === "email" ? email : undefined,
    phone: inviteType === "sms" ? phone : undefined,
    role: selectedRole,
  },
});
```

For link invites, display the returned token as a copyable URL after creation.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/people/_components/invite-member-dialog.tsx
git commit -m "feat(people): add SMS and link invite types to invite dialog"
```

---

### Task 8: Bulk deactivate + export + advanced filters

**Why:** Completes the data table features — bulk operations, data export, and filter popover.

**Files:**

- Modify: `apps/web/src/app/dashboard/people/_components/people-data-table.tsx`

- [ ] **Step 1: Add bulk deactivate button to bulk action bar**

After the "Clear" button in the bulk action bar, add:

```typescript
<button
  onClick={() => {
    const profileIds = Array.from(selectedIds)
      .map((id) => employees.find((emp) => emp.id === id)?.profileId)
      .filter((pid): pid is string => !!pid);
    setConfirmDialog({
      open: true,
      title: "Deactivate selected employees",
      description: `Are you sure you want to deactivate ${profileIds.length} employees? They will be moved to offboarding status.`,
      confirmLabel: "Deactivate All",
      variant: "destructive",
      onConfirm: async () => {
        try {
          await bulkUpdateProfiles(profileIds, workspaceId, {
            status: "offboarding",
            is_active: false,
          });
          toast.success(`Deactivated ${profileIds.length} employees`);
          setSelectedIds(new Set());
          onRefresh();
        } catch {
          toast.error("Failed to deactivate employees");
        }
        setConfirmDialog((prev) => ({ ...prev, open: false }));
      },
    });
  }}
  className="rounded-lg border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/20"
>
  Deactivate Selected
</button>
```

- [ ] **Step 2: Add export button**

Add an export button in the table header (next to the filter button):

```typescript
function handleExport() {
  const headers = [
    "Name",
    "Email",
    "Phone",
    "Role",
    "Department",
    "Status",
    "Readiness %",
    "Contract",
  ];
  const rows = filteredEmployees.map((emp) => [
    emp.name,
    emp.email,
    emp.phone ?? "",
    emp.role,
    emp.department,
    emp.status,
    emp.readinessScore !== undefined ? `${emp.readinessScore}` : "N/A",
    emp.hasContract ? "Yes" : "No",
  ]);

  const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `employees-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
```

Add button:

```typescript
<button onClick={handleExport} className="rounded-lg border border-border p-2.5 transition-all hover:bg-accent">
  <Download className="h-4 w-4" />
</button>
```

- [ ] **Step 3: Add advanced filter popover**

Wire the existing filter button to a `Popover` component:

```typescript
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const [advancedFilters, setAdvancedFilters] = useState({
  statuses: [] as string[],
  roles: [] as string[],
  readinessMin: 0,
  readinessMax: 100,
  hasContract: null as boolean | null,
});
```

Popover content with:

- Status checkboxes (active, trainee, inactive, offboarding, invited)
- Role checkboxes (owner, admin, manager, employee)
- Readiness range (4 preset buttons: 0-25%, 25-50%, 50-75%, 75-100%)
- Contract toggle (has/no/all)
- Clear filters button
- Badge on filter button showing active filter count

Apply filters in `filteredEmployees` memo.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/people/_components/people-data-table.tsx
git commit -m "feat(people): add bulk deactivate, CSV export, and advanced filter popover"
```

---

### Task 9: Watchdog — wire invitation expiry cleanup

**Why:** The `expire_stale_invitations()` function exists but nothing calls it.

**Files:**

- Modify: `supabase/functions/watchdog-integrity/index.ts`

- [ ] **Step 1: Add RPC call to watchdog**

In `watchdog-integrity/index.ts`, add to the `Promise.all` array (after the existing expired invitations check):

```typescript
// 5. Clean up expired invitations (mark pending → expired)
supabase.rpc("expire_stale_invitations"),
```

Destructure the result:

```typescript
const [danglingResult, staleResult, emptyWsResult, expiredInvitesResult, cleanupResult] = await Promise.all([...]);
```

Add a check result:

```typescript
// 5. Expired invitations cleaned up
if (cleanupResult.error) {
  checks.push({
    name: "invitation_cleanup",
    status: "error",
    details: cleanupResult.error.message,
  });
} else {
  const cleaned = cleanupResult.data ?? 0;
  checks.push({
    name: "invitation_cleanup",
    status: "pass",
    count: cleaned,
    details: cleaned > 0 ? `Expired ${cleaned} stale invitations` : "No stale invitations",
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/watchdog-integrity/index.ts
git commit -m "fix(watchdog): wire expire_stale_invitations() RPC to integrity check"
```

---

### Task 10: Design token cleanup — 5 files

**Why:** 266 hardcoded zinc-\* references replaced with semantic CSS variable classes.

**Files:**

- Modify: `apps/web/src/app/dashboard/people/page.tsx`
- Modify: `apps/web/src/app/dashboard/people/_components/people-data-table.tsx`
- Modify: `apps/web/src/app/dashboard/people/_components/employee-profile-card.tsx`
- Modify: `apps/web/src/app/dashboard/people/_components/invite-member-dialog.tsx`
- Modify: `apps/web/src/app/dashboard/people/[id]/page.tsx`

- [ ] **Step 1: Clean page.tsx (17 occurrences)**

Replace `isDark` color ternaries with semantic classes. Key patterns:

- `isDark ? "border-zinc-800/50 bg-zinc-950" : "border-zinc-200 bg-white"` → `border-border/50 bg-background`
- `isDark ? "text-white" : "text-zinc-900"` → `text-foreground`
- `isDark ? "text-zinc-500" : "text-zinc-400"` → `text-muted-foreground`
- `isDark ? "border-zinc-800 bg-zinc-900 text-zinc-400" : "..."` → `border-border bg-secondary text-muted-foreground`

Keep `isDark` if it controls non-color properties (opacity of glow effects etc.).

- [ ] **Step 2: Clean people-data-table.tsx (42 occurrences)**

Same pattern replacements. Key areas:

- Table header/controls section
- Bulk action bar
- Table body and rows
- Search input
- Department filter pills

- [ ] **Step 3: Clean employee-profile-card.tsx (90 occurrences)**

Highest count. The slide-out drawer has extensive `isDark` ternaries:

- Drawer overlay and container
- Tab buttons
- Form inputs
- Card sections
- Protocol list items

- [ ] **Step 4: Clean invite-member-dialog.tsx (45 occurrences)**

- Modal backdrop and container
- Input fields
- Tab buttons
- CSV mapping section
- Error displays

- [ ] **Step 5: Clean [id]/page.tsx (72 occurrences)**

- Profile header
- Tab navigation
- Detail sections (overview, competence, HR, settings)
- Form inputs and dropdowns

- [ ] **Step 6: Verify visual appearance**

```bash
pnpm --filter web dev
```

Check both light and dark mode for all people pages. Verify no visual regressions.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/dashboard/people/
git commit -m "style(people): replace 266 hardcoded zinc classes with semantic CSS variable tokens"
```

---

### Task 11: Mobile — team list and detail screens

**Why:** Mobile parity for read-only staff viewing. Uses shared data layer from Task 1-2.

**Files:**

- Create: `apps/mobile/app/(app)/(home)/team.tsx`
- Create: `apps/mobile/app/(app)/(home)/team/[id].tsx`

- [ ] **Step 1: Create team list screen**

Create `apps/mobile/app/(app)/(home)/team.tsx`:

- Import `nativeTheme` from `@smartout/design-tokens/native`
- Import shared types from `@smartout/utils`
- FlatList of workspace members
- Each row: avatar, name, role, department, status badge (using `nativeTheme.status.*`)
- Pull-to-refresh
- Search bar (client-side filter)
- Tap navigates to `team/[id]`
- Use `nativeTheme.spacing.*` for padding, `nativeTheme.radius.*` for border radius
- No hardcoded hex values

- [ ] **Step 2: Create team member detail screen**

Create `apps/mobile/app/(app)/(home)/team/[id].tsx`:

- Profile header: avatar, name, role, department, status badge
- Contact section: email (Linking.openURL `mailto:`), phone (Linking.openURL `tel:`)
- Readiness section: progress bar + protocol list with completion status
- Teams section: list of team memberships as pills
- All colors from `nativeTheme`

- [ ] **Step 3: Verify mobile typecheck**

```bash
cd apps/mobile && npx tsc --noEmit 2>&1 | grep "team" | head -10
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/\(app\)/\(home\)/team.tsx apps/mobile/app/\(app\)/\(home\)/team/\[id\].tsx
git commit -m "feat(mobile): add team list and member detail screens with design tokens"
```

---

### Task 12: Final typecheck, lint, and verification

**Why:** Quality gate before merge.

**Files:** All modified files

- [ ] **Step 1: Run typecheck**

```bash
cd apps/web && ./node_modules/.bin/tsc --noEmit
```

Fix any type errors.

- [ ] **Step 2: Run lint**

```bash
pnpm lint
```

Fix any lint errors.

- [ ] **Step 3: Regenerate database types**

```bash
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
```

- [ ] **Step 4: Verify acceptance criteria**

Walk through each acceptance criterion in the spec and verify with grep/read:

- Readiness computed from protocol_assignment ✓
- hasContract from employment_contract.status = 'signed' ✓
- profileId used consistently ✓
- Fake data removed ✓
- All new server actions have error handling ✓
- No `any` types ✓
- Mobile screens use nativeTheme ✓

- [ ] **Step 5: Final commit if fixes needed**

```bash
git add -A
git commit -m "fix(people): typecheck and lint cleanup"
```

---

## Acceptance Criteria

See spec: `docs/superpowers/specs/2026-03-22-staff-handling-complete-design.md` — Acceptance Criteria section.

## Task Dependency Graph

```
Task 1 (shared types) ──┬──→ Task 2 (data fetching + page fixes)
                         ├──→ Task 3 (profileId + reactivation)
                         ├──→ Task 5 (server actions)
                         └──→ Task 11 (mobile)

Task 2 ──→ Task 8 (bulk/export/filters — needs readiness data)

Task 4 (drawer + activity) — independent
Task 5 ──→ Task 6 (detail page — needs server actions)
Task 7 (invite dialog) — independent
Task 9 (watchdog) — independent
Task 10 (design tokens) — do LAST before mobile, after all feature changes
Task 12 (verification) — final gate
```

## Out of Scope

- Mobile admin actions (role change, deactivation, invite)
- Mobile invite flow
- Push notifications for reminders
- Batch SMS invites
- Schedule shift editing from people module
- Protocol assignment modal
- `pg_cron` extension installation
