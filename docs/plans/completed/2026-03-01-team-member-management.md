# Team Member Management + Department Manager Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable managing team members (add/remove profiles, assign leader) via a slide-in sheet, and add department manager assignment to the edit dialog.

**Architecture:** Click a team card to open a Sheet showing current members with add/remove. Uses existing shadcn Sheet + Command components. Department manager needs a migration (new column) + picker in EditDepartmentDialog. All data ops are client-side Supabase queries following existing patterns.

**Tech Stack:** React 19, shadcn/ui (Sheet, Command), Supabase client, TypeScript strict

---

## Task 1: Add `manager_profile_id` column to department table

**Files:**

- Create: `supabase/migrations/20260301600000_department_manager.sql`

**Step 1: Write the migration**

```sql
-- ============================================
-- 20260301600000_department_manager.sql
-- Adds manager_profile_id to department table.
-- Allows assigning a workspace profile as the
-- department manager.
-- ============================================

ALTER TABLE public.department
  ADD COLUMN manager_profile_id uuid REFERENCES public.profile(profile_id);

COMMENT ON COLUMN public.department.manager_profile_id
  IS 'Profile assigned as department manager. NULL means no manager assigned.';
```

**Step 2: Apply the migration**

Run: `npx supabase migration up --local`
Expected: Migration applied successfully

**Step 3: Regenerate TypeScript types**

Run: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`
Expected: `department.Row` now includes `manager_profile_id: string | null`

**Step 4: Verify types**

Run: `pnpm typecheck`
Expected: PASS (new nullable column won't break existing code)

**Step 5: Commit**

```bash
git add supabase/migrations/20260301600000_department_manager.sql packages/supabase/src/database.types.ts
git commit -m "feat(db): add manager_profile_id column to department table"
```

---

## Task 2: Add `ProfileRow` type and update `DepartmentRow`

**Files:**

- Modify: `apps/web/src/app/dashboard/organization/_components/types.ts`

**Step 1: Add ProfileRow type and update DepartmentRow**

Add to `types.ts`:

```typescript
export type ProfileRow = {
  profile_id: string;
  display_name: string;
  role: string;
  department_id: string | null;
  status: string;
  is_active: boolean;
};
```

Update `DepartmentRow` to add:

```typescript
manager_profile_id: string | null;
```

**Step 2: Verify types**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/organization/_components/types.ts
git commit -m "feat(org): add ProfileRow type and manager_profile_id to DepartmentRow"
```

---

## Task 3: Fetch profiles in page.tsx and pass to TeamsTab + DepartmentsTab

**Files:**

- Modify: `apps/web/src/app/dashboard/organization/page.tsx`

**Step 1: Add profiles state and fetch**

Add state:

```typescript
const [profiles, setProfiles] = useState<ProfileRow[]>([]);
```

In the `Promise.all` block, change the profile query from head-only count to fetching actual rows:

```typescript
// Replace the existing profiles query (line ~80-83):
supabase
  .from("profile")
  .select("profile_id, display_name, role, department_id, status, is_active")
  .eq("workspace_id", wid)
  .eq("is_active", true),
```

After results, set both:

```typescript
const fetchedProfiles = (profilesRes.data ?? []) as ProfileRow[];
setProfiles(fetchedProfiles);
setProfileCount(fetchedProfiles.length);
```

**Step 2: Pass profiles to TeamsTab and DepartmentsTab**

Add `profiles={profiles}` prop to both `<TeamsTab>` and `<DepartmentsTab>`.

**Step 3: Verify types**

Run: `pnpm typecheck`
Expected: FAIL — TeamsTab and DepartmentsTab don't accept `profiles` prop yet. That's OK, we'll fix in next tasks.

**Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/organization/page.tsx
git commit -m "feat(org): fetch full profile rows and pass to tab components"
```

---

## Task 4: Create TeamMembersSheet component

**Files:**

- Create: `apps/web/src/app/dashboard/organization/_components/TeamMembersSheet.tsx`

**Step 1: Create the component**

This is the main feature component. It renders:

1. Sheet with team header (name, type badge, color accent)
2. Leader picker section — select from current members only
3. Member list — each row has initials circle + name + role badge + remove button
4. Add member section — Command (combobox) filtering profiles not yet in team

Key behaviors:

- On open: fetch `team_member` JOIN `profile` for this team_id
- Add member: INSERT into `team_member`, refresh list
- Remove member: DELETE from `team_member`, refresh list. If removed member was leader, clear `leader_profile_id`
- Set leader: UPDATE `team.leader_profile_id`

Props:

```typescript
type TeamMembersSheetProps = {
  team: TeamRow;
  allProfiles: ProfileRow[];
  isDark: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => Promise<void>;
};
```

State:

```typescript
const [members, setMembers] = useState<ProfileRow[]>([]);
const [loading, setLoading] = useState(true);
const [search, setSearch] = useState("");
const [adding, setAdding] = useState(false);
const [leaderId, setLeaderId] = useState<string | null>(team.leader_profile_id);
```

Data fetching (on open):

```typescript
async function fetchMembers() {
  setLoading(true);
  const supabase = createClient();
  const { data } = await supabase
    .from("team_member")
    .select(
      "profile_id, profile:profile_id(profile_id, display_name, role, department_id, status, is_active)",
    )
    .eq("team_id", team.team_id);
  // Extract the joined profile data
  const profiles = (data ?? []).map((row) => row.profile).filter(Boolean) as ProfileRow[];
  setMembers(profiles);
  setLoading(false);
}
```

Add member:

```typescript
async function addMember(profileId: string) {
  setAdding(true);
  const supabase = createClient();
  const { error } = await supabase
    .from("team_member")
    .insert({ team_id: team.team_id, profile_id: profileId });
  if (error) {
    toast.error(error.message);
  } else {
    toast.success("Member added");
    await fetchMembers();
    await onRefresh();
  }
  setAdding(false);
  setSearch("");
}
```

Remove member:

```typescript
async function removeMember(profileId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("team_member")
    .delete()
    .eq("team_id", team.team_id)
    .eq("profile_id", profileId);
  if (error) {
    toast.error(error.message);
  } else {
    // If removed member was leader, clear leader
    if (leaderId === profileId) {
      await supabase.from("team").update({ leader_profile_id: null }).eq("team_id", team.team_id);
      setLeaderId(null);
    }
    toast.success("Member removed");
    await fetchMembers();
    await onRefresh();
  }
}
```

Set leader:

```typescript
async function setLeader(profileId: string | null) {
  const supabase = createClient();
  const { error } = await supabase
    .from("team")
    .update({ leader_profile_id: profileId })
    .eq("team_id", team.team_id);
  if (error) {
    toast.error(error.message);
  } else {
    setLeaderId(profileId);
    toast.success(profileId ? "Leader assigned" : "Leader removed");
    await onRefresh();
  }
}
```

UI layout (inside Sheet):

```
┌─────────────────────────────────┐
│ [color bar]                     │
│ Team Name          type badge   │
│ N members                       │
├─────────────────────────────────┤
│ LEADER                          │
│ [select from members ▼] [clear] │
├─────────────────────────────────┤
│ MEMBERS                         │
│ ┌─ AB  Alice Barista  employee ─── ✕ │
│ ├─ JD  John Doe       manager  ─── ✕ │
│ └─ ...                          │
├─────────────────────────────────┤
│ ADD MEMBER                      │
│ [🔍 Search profiles...       ] │
│   Result 1                      │
│   Result 2                      │
└─────────────────────────────────┘
```

Initials helper (inline, no separate file):

```typescript
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
```

Role badge colors (reuse existing pattern from codebase):

```typescript
const ROLE_COLORS: Record<string, string> = {
  owner: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  admin: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  manager: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  employee: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};
```

Available profiles for adding = `allProfiles` filtered to exclude current `members` profile_ids.

**Step 2: Verify types**

Run: `pnpm typecheck`
Expected: PASS (component not yet imported anywhere)

**Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/organization/_components/TeamMembersSheet.tsx
git commit -m "feat(org): create TeamMembersSheet component for team member management"
```

---

## Task 5: Wire TeamMembersSheet into TeamsTab

**Files:**

- Modify: `apps/web/src/app/dashboard/organization/_components/teams-tab.tsx`

**Step 1: Accept profiles prop and add sheet state**

Add to `TeamsTabProps`:

```typescript
profiles: ProfileRow[];
```

Add import for `TeamMembersSheet` and `ProfileRow`.

Add state:

```typescript
const [sheetTeam, setSheetTeam] = useState<TeamRow | null>(null);
```

**Step 2: Make team cards clickable**

Change the team card `<div>` wrapper to be clickable:

```typescript
<div
  key={team.team_id}
  className={`group relative cursor-pointer ${cardBase}`}
  onClick={() => setSheetTeam(team)}
>
```

**Step 3: Add sheet render at bottom of component**

After the Edit Team Dialog, add:

```typescript
{sheetTeam && (
  <TeamMembersSheet
    team={sheetTeam}
    allProfiles={profiles}
    isDark={isDark}
    open={!!sheetTeam}
    onOpenChange={(open) => {
      if (!open) setSheetTeam(null);
    }}
    onRefresh={onRefresh}
  />
)}
```

**Step 4: Prevent card click when clicking dropdown**

Add `onClick={(e) => e.stopPropagation()}` on the `DropdownMenuTrigger` button to prevent the card click from firing.

**Step 5: Verify it compiles**

Run: `pnpm typecheck`
Expected: PASS

**Step 6: Commit**

```bash
git add apps/web/src/app/dashboard/organization/_components/teams-tab.tsx
git commit -m "feat(org): wire TeamMembersSheet into team cards"
```

---

## Task 6: Add department manager picker to EditDepartmentDialog

**Files:**

- Modify: `apps/web/src/app/dashboard/organization/_components/EditDepartmentDialog.tsx`

**Step 1: Accept profiles prop**

Add to `EditDepartmentDialogProps`:

```typescript
profiles: ProfileRow[];
```

Add import for `ProfileRow`.

Add state:

```typescript
const [managerProfileId, setManagerProfileId] = useState<string | null>(
  department.manager_profile_id,
);
```

**Step 2: Add manager picker UI**

After the icon picker section, before the slug preview, add a manager select:

```typescript
<div>
  <label className={labelClass}>Department Manager</label>
  <select
    value={managerProfileId ?? ""}
    onChange={(e) => setManagerProfileId(e.target.value || null)}
    className={`${inputClass} appearance-none`}
  >
    <option value="">No manager assigned</option>
    {profiles.map((p) => (
      <option key={p.profile_id} value={p.profile_id}>
        {p.display_name} ({p.role})
      </option>
    ))}
  </select>
</div>
```

**Step 3: Include manager_profile_id in the update query**

In `handleSave`, add to the `.update({...})` object:

```typescript
manager_profile_id: managerProfileId,
```

**Step 4: Verify types**

Run: `pnpm typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/organization/_components/EditDepartmentDialog.tsx
git commit -m "feat(org): add department manager picker to edit dialog"
```

---

## Task 7: Pass profiles to DepartmentsTab and thread to EditDepartmentDialog

**Files:**

- Modify: `apps/web/src/app/dashboard/organization/_components/departments-tab.tsx`

**Step 1: Accept profiles prop in DepartmentsTab**

Add to `DepartmentsTabProps`:

```typescript
profiles: ProfileRow[];
```

Add import for `ProfileRow`.

**Step 2: Pass profiles to EditDepartmentDialog**

Find where `<EditDepartmentDialog>` is rendered and add:

```typescript
profiles = { profiles };
```

**Step 3: Show manager name on department cards**

In the department card rendering, after the description section, if the department has `manager_profile_id`, show the manager name:

```typescript
{dept.manager_profile_id && (() => {
  const manager = profiles.find((p) => p.profile_id === dept.manager_profile_id);
  return manager ? (
    <div className="mt-1 flex items-center gap-1.5">
      <UserCircle className={`h-3 w-3 ${isDark ? "text-zinc-600" : "text-zinc-400"}`} />
      <span className={`text-xs font-medium ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
        {manager.display_name}
      </span>
    </div>
  ) : null;
})()}
```

Note: DepartmentRow needs `manager_profile_id` — already added in Task 2.

**Step 4: Verify types**

Run: `pnpm typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/organization/_components/departments-tab.tsx
git commit -m "feat(org): pass profiles to DepartmentsTab and show manager name"
```

---

## Task 8: Update page.tsx to pass profiles to both tabs

**Files:**

- Modify: `apps/web/src/app/dashboard/organization/page.tsx`

**Step 1: Pass profiles prop to TeamsTab and DepartmentsTab**

This should already be partially done from Task 3. Verify both components receive:

```typescript
profiles = { profiles };
```

**Step 2: Full typecheck**

Run: `pnpm typecheck`
Expected: All 18 packages PASS

**Step 3: Lint check**

Run: `pnpm lint`
Expected: PASS (or only pre-existing warnings)

**Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/organization/page.tsx
git commit -m "feat(org): thread profiles prop to TeamsTab and DepartmentsTab"
```

---

## Task 9: Manual verification and final commit

**Step 1: Start dev server**

Run: `pnpm --filter web dev`

**Step 2: Manual test checklist**

Navigate to `/dashboard/organization` → Teams tab:

- [ ] Click a team card → sheet opens
- [ ] Sheet shows current members (or empty state)
- [ ] Search and add a profile → member appears in list
- [ ] Remove a member → member disappears
- [ ] Assign a leader from current members → star icon shows
- [ ] Remove leader → star cleared
- [ ] Remove leader member → leader auto-cleared
- [ ] Close sheet → card member count updated

Navigate to → Departments tab:

- [ ] Edit a department → manager picker visible
- [ ] Select a manager → save → card shows manager name
- [ ] Clear manager → save → manager name disappears

**Step 3: Update BUILD_ORDER.md**

Mark the following items as done:

- [x] Assign/remove team members
- [x] Team detail view (members, leader, seasonal toggle)
- Note: Department manager assignment (not tracked in BUILD_ORDER, add note)

**Step 4: Final commit**

```bash
git add docs/plans/BUILD_ORDER.md
git commit -m "docs: mark team member management and dept manager as done in BUILD_ORDER"
```

---

## Summary

| Task | What                                              | Files                    |
| ---- | ------------------------------------------------- | ------------------------ |
| 1    | Migration: `manager_profile_id` on department     | 1 SQL + types regen      |
| 2    | Add `ProfileRow` type + update `DepartmentRow`    | types.ts                 |
| 3    | Fetch profiles in page.tsx                        | page.tsx                 |
| 4    | Create `TeamMembersSheet`                         | New component            |
| 5    | Wire sheet into TeamsTab (card click)             | teams-tab.tsx            |
| 6    | Department manager picker in EditDepartmentDialog | EditDepartmentDialog.tsx |
| 7    | Thread profiles to DepartmentsTab + show manager  | departments-tab.tsx      |
| 8    | Final prop wiring in page.tsx                     | page.tsx                 |
| 9    | Manual verify + update BUILD_ORDER                | docs                     |

**Total: 9 tasks, ~1 new file, ~5 modified files, 1 migration**
