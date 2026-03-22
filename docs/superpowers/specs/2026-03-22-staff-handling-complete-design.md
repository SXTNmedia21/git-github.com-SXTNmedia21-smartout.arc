---
title: "Staff Handling — Complete Fix & Feature Spec"
status: review
updated: 2026-03-22
created: 2026-03-22
module: core
tags: [people, invitation, profile, mobile, design-tokens, staff]
---

# Staff Handling — Complete Fix & Feature Spec

**Goal:** Fix all 19 identified gaps in staff handling, clean up 266 hardcoded design token violations, add mobile read-only screens, and extract shared data layer for mobile parity.

**Branch:** Single mega-branch covering all tiers.

**Architecture:** Fixes target existing files in `apps/web/src/app/dashboard/people/`, new shared logic in `packages/utils/src/people/`, mobile screens in `apps/mobile/app/(app)/(home)/team*`, one migration for status transition validation + watchdog expiry hookup.

---

## Section 1: Data Integrity Fixes (Tier A)

These fixes correct data that is currently wrong, fake, or silently failing. Admins make decisions based on this data — it must be truthful.

### 1.1 Readiness score — compute from protocol_assignment

**Problem:** `readinessScore` is never populated. People page shows 0% for everyone. The "Avg Readiness" metric card always shows 0%.

**Root cause:** `page.tsx` never queries `protocol_assignment`. The field is left `undefined`, and the table UI renders `?? 0`, making it look like employees have 0% readiness when they actually have no assignments.

**Fix:**

1. Add a 4th parallel query in `page.tsx` `fetchData`:

```sql
SELECT pa.profile_id,
  COUNT(*)::int as total,
  COUNT(*) FILTER (WHERE pa.status = 'completed')::int as completed
FROM protocol_assignment pa
JOIN profile p ON pa.profile_id = p.profile_id
WHERE p.workspace_id = $workspace_id
GROUP BY pa.profile_id
```

Note: `protocol_assignment` is NOT workspace-scoped directly — must join through `profile`.

2. Build a `Map<string, number>` of `profile_id → readiness%` from the results.

3. Map into each employee: `readinessScore: readinessMap.get(p.profile_id)` (not `?? 0`).

4. Fix table UI (`people-data-table.tsx`): when `readinessScore === undefined`, render "N/A" or a dash — NOT `0%`. The readiness bar and icon should not render for profiles with no assignments.

5. Fix `avgReadiness` calculation in `page.tsx`: only include profiles where `readinessScore !== undefined`.

**Files:** `page.tsx`, `people-data-table.tsx`

### 1.2 hasContract — query employment_contract with signed status

**Problem:** Hardcoded `hasContract: false` at `page.tsx:118`. Employee profile card shows "No Contract Found" for all employees, even those with signed contracts.

**Fix:**

1. Add to the parallel fetch in `page.tsx`:

```sql
SELECT DISTINCT profile_id
FROM employment_contract
WHERE workspace_id = $workspace_id
  AND status = 'signed'
```

2. Build a `Set<string>` of profile IDs with signed contracts.

3. Map: `hasContract: contractSet.has(p.profile_id)`.

4. Use this in both the people list rows AND the profile detail HR panel (`[id]/page.tsx` and `employee-profile-card.tsx`).

**Files:** `page.tsx`, `employee-profile-card.tsx`, `[id]/page.tsx`

### 1.3 Profile mutations — use profileId consistently

**Problem:** `people-row-actions.tsx` uses `employee.id` for role/dept/deactivation callbacks. For invited rows, `employee.id` is `invitation_id`, not `profile_id`. The UI gating (`isActionable`) prevents invited users from hitting these today, but the callback contract is wrong.

**Fix:**

1. In `people-row-actions.tsx`, change all profile mutation callbacks to use `employee.profileId`:
   - Line 146: `onRoleChange(employee.profileId!, role)`
   - Line 169: `onDepartmentChange(employee.profileId!, dept.department_id)`
   - Line 201: `onConfirmAction({ type: "deactivate", profileId: employee.profileId!, ... })`

2. Add an early guard: if `!employee.profileId`, don't render the actionable menu items. This is a defense-in-depth layer on top of the `isActionable` check.

**Files:** `people-row-actions.tsx`

### 1.4 Hours metric — remove fake 142h from invited drawer

**Problem:** `employee-profile-card.tsx` shows "142h" hardcoded. This drawer opens for invited users (rows without `profileId`).

**Fix:** Replace the hardcoded hours metric with invite-specific metadata:

- **Invite status:** Pending / Expired
- **Invite expiry:** Date string from `invitation.expires_at`
- **Invite type:** Email / SMS / Link

For profile-based drawers (if the card is ever used for real profiles), show "Teams: N" from the fetched teams array instead.

**Files:** `employee-profile-card.tsx`

### 1.5 Recent activity — replace fake data with real query

**Problem:** Hardcoded "Clocked in for Opening Shift" etc. in both the invited drawer and the profile detail page.

**Fix:**

1. **Profile detail page (`[id]/page.tsx`):** Query `activity_trail` filtered by profile's `user_id`. Show chronological list with action, timestamp, metadata. Limit to 5 most recent. Empty state: "No activity recorded yet" with subtle icon.

2. **Invited drawer (`employee-profile-card.tsx`):** Remove the activity section entirely for invited users. They have no profile, so no activity trail exists.

**Files:** `[id]/page.tsx`, `employee-profile-card.tsx`

### 1.6 Expired invitations — fix count and filter consistency

**Problem:** Expired invitations are included in the "Pending Invites" card count, but they're not really pending. The card label says one thing, the data says another.

**Fix:**

1. **Metric card count:** `invitations.filter(i => i.inviteStatus !== 'expired').length` — only count truly pending invites.

2. **Invites filter view:** When user clicks the "Pending Invites" card (activating `invites` filter), show BOTH pending and expired invitations in the table (so admins can see and act on expired ones), but the card count only reflects pending.

3. Expired invitations already render with a distinct badge (orange "Expired" with warning icon) — no change needed there.

**Files:** `page.tsx`

---

## Section 2: Incomplete Workflows (Tier B)

These features have UI elements that exist but don't work, or workflows that are half-wired.

### 2.1 "Send Reminder" button — wire to notification

**Problem:** Button renders on profile detail page and profile card competence tab. No click handler.

**Approach:**

1. Create server action `sendProtocolReminder(profileId: string, assignmentId: string)`:
   - Fetch profile's email via `user_identity` join
   - Fetch protocol name via `protocol_assignment` → `protocol`
   - Log to `activity_trail`: `{ action: 'reminder_sent', metadata: { protocol_name, assignment_id } }`
   - Dispatch: if a `send-notification` Edge Function exists, invoke it. Otherwise, use `supabase.auth.admin.generateLink({ type: 'magiclink', email })` to generate a login link and include it in a SendGrid email via Edge Function.

2. If no notification Edge Function exists yet: show toast "Reminder logged" and log to `activity_trail`, but mark email dispatch as a TODO comment. Don't fake the delivery.

3. Wire the button in both `[id]/page.tsx` and `employee-profile-card.tsx`.

**Files:** `people-actions.ts`, `[id]/page.tsx`, `employee-profile-card.tsx`

### 2.2 SMS/link invite from people page

**Problem:** `create-invitation` Edge Function supports `email`, `sms`, and `link` invite types. People page only exposes email.

**Fix:**

1. Add invite type selector to `invite-member-dialog.tsx` single-invite form:
   - **Email** (default) — requires email field, hides phone
   - **SMS** — requires phone field, hides email
   - **Link** — no contact field required, returns shareable URL displayed in a copy-able field

2. The `InviteRow` type already has a `phone` field (line 37). Wire `invite_type` through to the Edge Function invocation.

3. For batch/CSV mode: keep as email-only (batch SMS is out of scope).

**Files:** `invite-member-dialog.tsx`

### 2.3 Multi-department — preserve array on updates

**Problem:** `department_ids[]` stored on invitation, only first element used as `department_id`. The `departments` array on profile is set on creation but lost on subsequent updates.

**Fix:**

1. `accept-invitation` already stores both `department_id` (first) and `departments` (full array) — no change needed there.

2. People page query: add `departments` to the profile SELECT.

3. Profile update actions (`people-actions.ts`): when changing department via `updateProfileDepartment`, update BOTH `department_id` AND the `departments` array. If the profile has existing multi-dept assignments, changing the primary dept should update the first element of the array, not replace the entire array.

4. People data table: show primary department name. If `departments.length > 1`, show "+N" badge next to department name.

**Files:** `page.tsx`, `people-actions.ts`, `people-data-table.tsx`

### 2.4 Team management UI in profile detail

**Problem:** Teams auto-assigned on invite acceptance, but no manual add/remove UI exists.

**Fix:**

Add a "Teams" section to the profile detail page (`[id]/page.tsx`) Settings tab:

1. List current teams with remove button (X icon)
2. "Add to team" dropdown showing workspace teams not already assigned
3. Server actions in `people-actions.ts`:
   - `addToTeam(profileId: string, teamId: string)` — insert into `team_member`
   - `removeFromTeam(profileId: string, teamId: string)` — delete from `team_member`
4. Refresh team list after mutation

**Files:** `[id]/page.tsx`, `people-actions.ts`

### 2.5 Profile status transitions — enforce valid paths

**Problem:** Detail page status dropdown allows any status from any other status. Can go `active → trainee` (impossible in real flow).

**Fix:**

Define and enforce valid transitions:

| From        | Allowed to                                 |
| ----------- | ------------------------------------------ |
| trainee     | active, offboarding                        |
| active      | inactive, offboarding                      |
| inactive    | active, offboarding                        |
| offboarding | active (admin only, requires confirmation) |

1. Create `status-transitions.ts` in shared package with:

   ```typescript
   export const VALID_TRANSITIONS: Record<ProfileStatus, ProfileStatus[]> = {
     trainee: ["active", "offboarding"],
     active: ["inactive", "offboarding"],
     inactive: ["active", "offboarding"],
     offboarding: ["active"], // admin-only reactivation
   };
   ```

2. Detail page status dropdown: disable options not in `VALID_TRANSITIONS[currentStatus]`.

3. Server action: validate transition before executing update. Return error if invalid.

**Files:** `packages/utils/src/people/status-transitions.ts`, `[id]/page.tsx`, `people-actions.ts`

### 2.6 Bulk actions — wire and add bulk deactivate

**Problem:** Bulk select UI exists. `bulkUpdateProfiles()` server action exists. But:

- Bulk dropdowns use `employee.id` which may not be `profileId`
- No bulk deactivate button

**Fix:**

1. Verify bulk action handlers extract `profileId` from selected employees (not `employee.id`). The current code at `people-data-table.tsx:346` does: `.map((id) => employees.find((emp) => emp.id === id)?.profileId)` — this is correct.

2. Add "Deactivate Selected" button to bulk action bar:
   - Destructive style (red text/icon)
   - Confirmation dialog: "Deactivate {N} employees? They will be moved to offboarding status."
   - Calls `bulkUpdateProfiles(profileIds, workspaceId, { status: 'offboarding', is_active: false })`

**Files:** `people-data-table.tsx`

### 2.7 Invitation expiry cron

**Problem:** `expire_stale_invitations()` PL/pgSQL function exists (created in fix-invitation-flow branch) but nothing calls it.

**Fix:** Check if a watchdog/cron Edge Function exists. If yes, add a call to `expire_stale_invitations()` RPC. If no watchdog exists, create a simple scheduled Edge Function:

```typescript
// supabase/functions/expire-invitations/index.ts
// Cron: daily at 03:00 UTC
const { data } = await adminClient.rpc("expire_stale_invitations");
console.log(`Expired ${data} stale invitations`);
```

Add to `supabase/functions/config.toml` with `verify_jwt = false` and cron schedule.

**Files:** `supabase/functions/expire-invitations/index.ts`, `supabase/functions/config.toml`

---

## Section 3: Missing Features (Tier C)

### 3.1 Schedule tab on profile detail page

**Problem:** Declared in journey docs, not implemented.

**Approach:** Add a "Schedule" tab to `[id]/page.tsx`:

1. Query `schedule_shift` for the profile:
   - Upcoming shifts (next 7 days): date, start/end time, department, position
   - Past shifts (last 7 days): same fields + status badge (completed/missed)

2. Render as compact list with date headers.

3. Empty state: "No shifts scheduled" with calendar icon.

4. Read-only — shift management happens in the schedule module, not here.

**Files:** `[id]/page.tsx`

### 3.2 Activity tab on profile detail page

**Problem:** Only placeholder data exists.

**Approach:** Add a dedicated "Activity" tab to `[id]/page.tsx`:

1. Query `activity_trail` filtered by the profile's `user_id`.
2. Chronological list: action description, timestamp, metadata details.
3. Pagination: load 20 entries, "Load more" button for next batch.
4. Empty state: "No activity recorded yet."
5. This is the full history view. Section 1.5 puts a 5-item summary on the Overview tab; this tab gives unlimited scroll.

**Files:** `[id]/page.tsx`

### 3.3 Export employees

**Approach:** Add "Export" button in the table header (next to the filter icon button):

1. Export respects current filters (search, department, status, metric card filter).
2. CSV format with columns: Name, Email, Phone, Role, Department, Status, Readiness %, Contract Status, Teams.
3. Implementation: client-side CSV generation from `filteredEmployees` array. No server action needed — the data is already loaded.
4. Trigger download via `Blob` URL and programmatic `<a>` click.
5. Button shows download icon + "Export" label.

**Files:** `people-data-table.tsx`

### 3.4 Reactivation path

**Problem:** No way back from offboarding status.

**Approach:** Already covered in 2.5 status transitions — offboarding → active is allowed for admins with confirmation.

Additionally:

1. Add a "Reactivate" action in `people-row-actions.tsx` for employees with `status === 'offboarding'`:
   - New `ConfirmAction` type: `{ type: "reactivate"; profileId: string; name: string }`
   - Confirmation dialog: "This will restore full access for {name}. Continue?"
   - Handler: update profile `{ status: 'active', is_active: true }`

**Files:** `people-row-actions.tsx`, `people-data-table.tsx`, `people-actions.ts`

### 3.5 Bulk deactivate

Covered in Section 2.6.

### 3.6 Advanced filters

**Approach:** Wire the existing filter button (currently renders but does nothing) to a popover:

1. Filter popover with:
   - **Status** multi-select: active, trainee, inactive, offboarding, invited
   - **Role** multi-select: owner, admin, manager, employee
   - **Readiness** range: 0-25%, 25-50%, 50-75%, 75-100%
   - **Contract** toggle: has contract / no contract / all
   - **Clear filters** button

2. Filter state stored in component state as an object. Applied in the `filteredEmployees` memo alongside existing search and department filters.

3. Show active filter count as a badge on the filter button: e.g., filter icon with "3" badge.

4. Use shadcn `Popover` + `Checkbox` components for the filter UI.

**Files:** `people-data-table.tsx`

---

## Section 4: Design Token Cleanup

### Problem

266 hardcoded `zinc-*` references across 5 people-module files. The codebase uses `isDark ? "zinc-800" : "zinc-200"` ternaries everywhere instead of CSS variable classes.

### Scope

5 files with violations:

- `apps/web/src/app/dashboard/people/page.tsx` (17 occurrences)
- `apps/web/src/app/dashboard/people/_components/people-data-table.tsx` (42 occurrences)
- `apps/web/src/app/dashboard/people/_components/employee-profile-card.tsx` (90 occurrences)
- `apps/web/src/app/dashboard/people/_components/invite-member-dialog.tsx` (45 occurrences)
- `apps/web/src/app/dashboard/people/[id]/page.tsx` (72 occurrences)

Files already compliant (no changes):

- `people-row-actions.tsx` — uses semantic classes
- `types.ts` — no styles

### Replacement rules

Replace hardcoded neutral colors with semantic classes from `globals.css`:

| Context                   | Replace with                                 |
| ------------------------- | -------------------------------------------- |
| Page/card backgrounds     | `bg-background`, `bg-card`                   |
| Muted/secondary surfaces  | `bg-muted`, `bg-secondary`                   |
| Primary text              | `text-foreground`                            |
| Secondary/dim text        | `text-muted-foreground`                      |
| Borders                   | `border-border`                              |
| Dividers                  | `divide-border`                              |
| Hover surfaces            | `bg-accent`                                  |
| Hover text                | `text-accent-foreground`                     |
| Input backgrounds/borders | `bg-input`, `border-input` (where available) |

Use opacity variants where needed: `border-border/50`, `text-muted-foreground/70`, `bg-accent/40` — instead of paired `isDark` zinc values.

### What NOT to replace

- Orange glows, gradients, and brand accents (`bg-orange-500/10`, `shadow-[0_0_15px_rgba(249,115,22,0.2)]`) — these are intentional brand elements.
- Semantic status colors (`emerald-500`, `rose-500`, `blue-500`) — already correct.
- Opacity/hover intensity branches that control animation or interaction states — convert case-by-case, not mechanically.
- Status badge colors — use `status-trainee`, `status-active`, `status-inactive`, `status-offboarding` tokens where the visual meaning matches.

### Process

For each file:

1. Identify all `isDark ? "..." : "..."` ternaries that control neutral colors
2. Replace with the appropriate semantic class
3. Remove the `isDark` condition where it becomes unnecessary
4. If the branch also controls non-color properties (opacity, blur, etc.), keep the branch but replace only the color portion
5. Visual review: ensure light and dark modes still look correct

---

## Section 5: Mobile

### Current state

One mobile file exists: `apps/mobile/app/(app)/(home)/edit-profile.tsx` — self-edit only. No admin staff management screens.

### Architecture (from CLAUDE.md)

> Data hooks, API endpoints, and business logic must support both web and mobile surfaces. Shared logic goes in `packages/`, not `apps/web/`.

### Phase 1: Shared data layer

Extract people data fetching into `packages/utils/src/people/`:

1. **`types.ts`** — Move `Employee`, `Department`, `ProfileRole`, `ProfileStatus` types from `apps/web/src/app/dashboard/people/_components/types.ts`. Web re-exports from the package.

2. **`fetch-people.ts`** — Extract the query logic from `page.tsx` `fetchData`:
   - `fetchWorkspacePeople(supabase, workspaceId)` → returns `{ employees, departments, invitations, readinessMap, contractSet }`
   - Pure function that takes a Supabase client and workspace ID
   - Handles all 4 parallel queries (profiles, departments, invitations, readiness)
   - Returns raw data; mapping to `Employee[]` stays in the consuming component

3. **`status-transitions.ts`** — Valid status transition map (from Section 2.5). Used by both web and mobile.

### Phase 2: Mobile read-only screens

Two new screens using `nativeTheme` from `packages/design-tokens/src/native.ts`:

#### Team list screen (`apps/mobile/app/(app)/(home)/team.tsx`)

- FlatList of workspace members: name, role, department, status badge, readiness %
- Pull-to-refresh via `onRefresh` prop
- Tap to navigate to detail
- Search bar at top (filters client-side)
- Status badges use `nativeTheme.status.*` colors
- Department indicators use `nativeTheme.department.*` colors
- Layout uses `nativeTheme.spacing.*` and `nativeTheme.radius.*`

#### Team member detail screen (`apps/mobile/app/(app)/(home)/team/[id].tsx`)

- Profile header: avatar, name, role, department, status badge
- Contact section: email (tap to open mail), phone (tap to call)
- Readiness section: score with progress bar, protocol list with completion status
- Teams section: list of team memberships
- All colors from `nativeTheme` — no hardcoded hex values

### What's NOT in this branch

- Mobile admin actions (role change, deactivation, invite) — requires mobile auth role checks, separate feature
- Mobile invite flow — complex multi-step form, separate feature
- Push notifications for reminders — separate feature

---

## File Inventory

### Modified files

| File                                                                      | Sections                        |
| ------------------------------------------------------------------------- | ------------------------------- |
| `apps/web/src/app/dashboard/people/page.tsx`                              | 1.1, 1.2, 1.6, 4                |
| `apps/web/src/app/dashboard/people/_components/people-data-table.tsx`     | 1.1, 2.3, 2.6, 3.3, 3.6, 4      |
| `apps/web/src/app/dashboard/people/_components/people-row-actions.tsx`    | 1.3, 3.4                        |
| `apps/web/src/app/dashboard/people/_components/employee-profile-card.tsx` | 1.2, 1.4, 1.5, 2.1, 4           |
| `apps/web/src/app/dashboard/people/_components/invite-member-dialog.tsx`  | 2.2, 4                          |
| `apps/web/src/app/dashboard/people/_actions/people-actions.ts`            | 2.1, 2.3, 2.4, 2.5, 3.4         |
| `apps/web/src/app/dashboard/people/[id]/page.tsx`                         | 1.2, 1.5, 2.4, 2.5, 3.1, 3.2, 4 |
| `apps/web/src/app/dashboard/people/_components/types.ts`                  | 5.1 (re-export from package)    |

### New files

| File                                              | Section             |
| ------------------------------------------------- | ------------------- |
| `packages/utils/src/people/types.ts`              | 5.1                 |
| `packages/utils/src/people/fetch-people.ts`       | 5.1                 |
| `packages/utils/src/people/status-transitions.ts` | 2.5, 5.1            |
| `packages/utils/src/people/index.ts`              | 5.1 (barrel export) |
| `apps/mobile/app/(app)/(home)/team.tsx`           | 5.2                 |
| `apps/mobile/app/(app)/(home)/team/[id].tsx`      | 5.2                 |
| `supabase/functions/expire-invitations/index.ts`  | 2.7                 |

### Migration (if needed)

If the watchdog cron approach requires a migration for `pg_cron`, create:
`supabase/migrations/YYYYMMDDHHMMSS_add_invitation_expiry_cron.sql`

---

## Acceptance Criteria

### Data integrity (Tier A)

- [ ] Readiness scores computed from `protocol_assignment` joined through `profile`
- [ ] Profiles with no assignments show "N/A", not 0%
- [ ] `hasContract` computed from `employment_contract.status = 'signed'`
- [ ] All profile mutation callbacks use `employee.profileId`, not `employee.id`
- [ ] Invited drawer shows invite metadata, not fake hours
- [ ] Profile detail activity section shows real `activity_trail` data or empty state
- [ ] Invited drawer has no activity section
- [ ] "Pending Invites" card count excludes expired invitations
- [ ] Expired invitations still visible in table with expired badge

### Incomplete workflows (Tier B)

- [ ] "Send Reminder" button has a handler (logs to activity_trail, dispatches if possible)
- [ ] Invite dialog supports email, SMS, and link invite types
- [ ] Multi-department assignments preserved on profile updates
- [ ] Team management UI on profile detail page (add/remove teams)
- [ ] Status transitions enforced (invalid options disabled in dropdown, server validates)
- [ ] Bulk deactivate button in bulk action bar with confirmation
- [ ] `expire_stale_invitations()` called on a schedule

### Missing features (Tier C)

- [ ] Schedule tab on profile detail (upcoming + past shifts, read-only)
- [ ] Activity tab on profile detail (full paginated history)
- [ ] Export button generates CSV of filtered view
- [ ] Reactivate action for offboarding employees (admin only, with confirmation)
- [ ] Advanced filter popover with status, role, readiness, contract filters

### Design tokens

- [ ] All 5 people-module files use semantic CSS variable classes
- [ ] No `isDark` ternaries for neutral colors where semantic token exists
- [ ] Status badges use design token status colors
- [ ] Visual review passes for both light and dark mode

### Mobile

- [ ] `Employee`, `Department`, `ProfileRole` types in `packages/utils/src/people/`
- [ ] `fetchWorkspacePeople()` shared function in `packages/utils/src/people/`
- [ ] `VALID_TRANSITIONS` map in `packages/utils/src/people/`
- [ ] Web `page.tsx` imports from `@smartout/utils/people`
- [ ] Mobile team list screen with search, pull-to-refresh, status badges
- [ ] Mobile team member detail screen with contact, readiness, protocols, teams
- [ ] All mobile screens use `nativeTheme` from `@smartout/design-tokens` — no hardcoded hex

### Quality gates

- [ ] `pnpm turbo typecheck` passes with 0 errors
- [ ] `pnpm lint` passes
- [ ] All new server actions have error handling
- [ ] No `any` types introduced

## Out of Scope

- Mobile admin actions (role change, deactivation, invite)
- Mobile invite flow
- Push notifications
- Batch SMS invites
- Schedule shift editing from people module
- Protocol assignment modal (schema exists, full UI is a separate feature)
- `pg_cron` extension installation (if not already enabled)
