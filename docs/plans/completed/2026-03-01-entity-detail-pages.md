---
title: "Entity Detail Pages Implementation Plan"
status: draft
updated: 2026-03-03
created: 2026-03-01
module: org-structure
tags: [entity, detail-pages, department, location, team, profile]
---

# Entity Detail Pages Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create dedicated detail pages for Department, Location, Team, and Profile entities with a shared tabs layout.

**Architecture:** A shared `EntityDetailLayout` component provides the header + tabs chrome. Each entity page is a `"use client"` page that fetches its entity by ID, then renders the layout with entity-specific tabs. List views are modified to navigate to detail pages on click. Existing edit dialogs, member sheets, and tab content are reused where possible.

**Tech Stack:** Next.js 16 (App Router, dynamic routes), React 19, shadcn/ui, Supabase client, TypeScript strict

---

## Task 1: Create shared EntityDetailLayout component

**Files:**

- Create: `apps/web/src/app/dashboard/_components/EntityDetailLayout.tsx`

**Step 1: Create the layout component**

This is the shared chrome for all entity detail pages. It renders:

1. A back button + breadcrumb
2. Entity header (name, badges, accent color)
3. Horizontal tab navigation
4. Tab content area (children)

```typescript
"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useState, useContext, type ReactNode } from "react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";

type Tab = {
  key: string;
  label: string;
  badge?: number;
};

type EntityDetailLayoutProps = {
  title: string;
  subtitle?: string;
  breadcrumb: Array<{ label: string; href?: string }>;
  color?: string | null;
  icon?: ReactNode;
  badges?: ReactNode;
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  actions?: ReactNode;
  children: ReactNode;
};

export function EntityDetailLayout({
  title,
  subtitle,
  breadcrumb,
  color,
  icon,
  badges,
  tabs,
  activeTab,
  onTabChange,
  actions,
  children,
}: EntityDetailLayoutProps) {
  const { isDark } = useContext(DashboardContext);
  const router = useRouter();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Color accent bar */}
      {color && (
        <div className="h-1 w-full rounded-t-lg" style={{ backgroundColor: color }} />
      )}

      {/* Header */}
      <div className={`border-b px-6 py-5 ${isDark ? "border-zinc-800" : "border-zinc-200"}`}>
        {/* Breadcrumb */}
        <div className="mb-3 flex items-center gap-2">
          <button
            onClick={() => router.back()}
            className={`rounded-lg p-1.5 transition-colors ${
              isDark ? "text-zinc-400 hover:bg-zinc-800 hover:text-white" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
            }`}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1.5 text-xs">
            {breadcrumb.map((crumb, i) => (
              <span key={crumb.label} className="flex items-center gap-1.5">
                {i > 0 && <span className={isDark ? "text-zinc-700" : "text-zinc-300"}>/</span>}
                {crumb.href ? (
                  <button
                    onClick={() => router.push(crumb.href!)}
                    className={`font-medium transition-colors ${isDark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-400 hover:text-zinc-700"}`}
                  >
                    {crumb.label}
                  </button>
                ) : (
                  <span className={isDark ? "text-zinc-400" : "text-zinc-600"}>{crumb.label}</span>
                )}
              </span>
            ))}
          </div>
        </div>

        {/* Title row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {icon}
            <div>
              <h1 className={`text-xl font-extrabold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
                {title}
              </h1>
              {subtitle && (
                <p className={`mt-0.5 text-sm ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                  {subtitle}
                </p>
              )}
            </div>
            {badges && <div className="flex items-center gap-2">{badges}</div>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      </div>

      {/* Tab navigation */}
      <div className={`border-b px-6 ${isDark ? "border-zinc-800" : "border-zinc-200"}`}>
        <div className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`relative py-3 text-sm font-semibold transition-colors ${
                activeTab === tab.key
                  ? isDark ? "text-white" : "text-zinc-900"
                  : isDark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-400 hover:text-zinc-700"
              }`}
            >
              <span className="flex items-center gap-1.5">
                {tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    isDark ? "bg-zinc-800 text-zinc-400" : "bg-zinc-100 text-zinc-500"
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </span>
              {activeTab === tab.key && (
                <div className="absolute bottom-0 left-0 h-0.5 w-full rounded-t-full bg-orange-500" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="hide-scrollbar flex-1 overflow-y-auto p-6">
        {children}
      </div>
    </div>
  );
}
```

**Step 2: Verify types**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/_components/EntityDetailLayout.tsx
git commit -m "feat(ui): create shared EntityDetailLayout component"
```

---

## Task 2: Create Department Detail Page

**Files:**

- Create: `apps/web/src/app/dashboard/organization/departments/[id]/page.tsx`

**Step 1: Create the page**

This is a `"use client"` page that:

1. Reads the department ID from `useParams()`
2. Fetches the department + related data (positions, teams, profiles, policies) via Supabase
3. Renders `EntityDetailLayout` with 5 tabs: Overview, Positions, Teams, Policies, Settings

Key data queries:

- Department: `supabase.from("department").select("*").eq("department_id", id).single()`
- Positions: `supabase.from("position").select("*").eq("department_id", id)`
- Teams: `supabase.from("team").select("*").eq("department_id", id)`
- Profiles in dept: `supabase.from("profile").select("profile_id, display_name, role, status, is_active").eq("department_id", id).eq("is_active", true)`
- Manager profile: lookup from `department.manager_profile_id`
- Policies: `supabase.from("policy").select("*").eq("scope_ref_id", id).eq("policy_scope", "department")`

**Overview tab:** Stat cards (positions count, teams count, members count, policies count). Description. Manager name with UserCircle icon.

**Positions tab:** List of positions with color dot, name, minimum_role badge, active status. Create button (opens CreatePositionDialog). Each position has dropdown with Edit, Move, Deactivate.

**Teams tab:** Team cards with name, type badge, member count. Clickable → `/dashboard/organization/teams/[team_id]`.

**Policies tab:** Placeholder text: "Policy management will be available in a future update."

**Settings tab:** Edit form with name, description, color picker, icon picker, manager select, slug preview. Save button updates department. Deactivate button.

Use imports from existing components: `COLOR_PRESETS`, `ICON_PRESETS`, `ICON_COMPONENTS`, `toSlug` from the org types/constants. Reuse `CreatePositionDialog`, `EditPositionDialog`, `MovePositionDialog`.

Import `EntityDetailLayout` from `@/app/dashboard/_components/EntityDetailLayout`.

**Step 2: Verify types**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/organization/departments/
git commit -m "feat(org): create department detail page with tabs"
```

---

## Task 3: Create Location Detail Page

**Files:**

- Create: `apps/web/src/app/dashboard/organization/locations/[id]/page.tsx`

**Step 1: Create the page**

Same pattern as department. Fetches location + zones + assets.

Data queries:

- Location: `supabase.from("location").select("*").eq("location_id", id).single()`
- Zones: `supabase.from("zone").select("*").eq("location_id", id).order("sort_order")`
- Assets: `supabase.from("asset").select("*").eq("location_id", id).order("sort_order")`

4 tabs: Overview, Zones, Assets, Settings.

**Overview tab:** Stat cards (zones, assets). Description. Address. Capacity. Type badge.

**Zones tab:** Zone list with color dot, name, capacity badge, active status. Create/Edit/Deactivate. Reuse `CreateZoneDialog`, `EditZoneDialog`.

**Assets tab:** Asset list with icon, name, type badge, training/routine flags, active status. Create/Edit/Deactivate. Reuse `CreateAssetDialog`, `EditAssetDialog`.

**Settings tab:** Edit form (name, type select, description, address, capacity, floor). Save + Deactivate.

Use `LOCATION_TYPE_CONFIG` from constants for type display.

**Step 2: Verify types**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/organization/locations/
git commit -m "feat(org): create location detail page with tabs"
```

---

## Task 4: Create Team Detail Page

**Files:**

- Create: `apps/web/src/app/dashboard/organization/teams/[id]/page.tsx`

**Step 1: Create the page**

Fetches team + members + department + policies.

Data queries:

- Team: `supabase.from("team").select("*").eq("team_id", id).single()`
- Members: `supabase.from("team_member").select("profile_id, profile:profile_id(profile_id, display_name, role, status, is_active)").eq("team_id", id)`
- Department: lookup from `team.department_id`
- Policies: `supabase.from("policy").select("*").eq("scope_ref_id", id).eq("policy_scope", "team")`
- All profiles (for add-member): `supabase.from("profile").select("profile_id, display_name, role, department_id, status, is_active").eq("workspace_id", wid).eq("is_active", true)`

4 tabs: Overview, Members, Policies, Settings.

**Overview tab:** Stat cards (members, policies). Description. Department link (clickable → dept detail). Leader name with star icon. Season info if applicable.

**Members tab:** Reuse the member list/add/remove/leader-picker logic from `TeamMembersSheet`. Leader select. Member list with initials, name, role badge, remove button. Add member search/select.

**Policies tab:** Placeholder text.

**Settings tab:** Edit form (name, type select, department select, color, description). Save + Deactivate.

Use `TEAM_TYPE_CONFIG` from constants.

**Step 2: Verify types**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/organization/teams/
git commit -m "feat(org): create team detail page with tabs"
```

---

## Task 5: Create Profile Detail Page

**Files:**

- Create: `apps/web/src/app/dashboard/people/[id]/page.tsx`

**Step 1: Create the page**

This replaces the sidebar card as the primary profile view. Fetches profile + related data.

Data queries:

- Profile: `supabase.from("profile").select("*, department:department_id(name), user_identity:user_id(email, phone, emergency_contact_name, emergency_contact_phone)").eq("profile_id", id).single()`
- Teams: `supabase.from("team_member").select("team:team_id(team_id, name, team_type)").eq("profile_id", id)`
- Protocols: `supabase.from("protocol_assignment").select("assignment_id, status, protocol:protocol_id(name, protocol_type)").eq("profile_id", id)`
- Departments (for settings): `supabase.from("department").select("department_id, name").eq("workspace_id", wid)`
- Contract: `supabase.from("employment_contract").select("*").eq("profile_id", id).order("created_at", { ascending: false }).limit(1)`

4 tabs: Overview, Competence, HR & Logs, Settings.

Lift the tab content from `employee-profile-card.tsx` — same sections but in a full-page layout instead of a narrow sidebar. Key difference: more horizontal space, can use 2-column layouts.

**Overview tab:** Contact info (email, phone). Team memberships as clickable badges → team detail. Recent activity placeholder.

**Competence tab:** Protocol assignments with status icons. Readiness warning. Send Reminder placeholder.

**HR & Logs tab:** Contract status. Editable personal info (address, SSN, bank). Emergency contact. Communication log.

**Settings tab:** Department, role, status selects with save. Deactivate. Reset password.

Header: Large avatar circle with initials. Name. Role badge. Department name. Status badge. Email.

**Step 2: Verify types**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/people/\[id\]/
git commit -m "feat(people): create profile detail page with tabs"
```

---

## Task 6: Wire navigation from list views to detail pages

**Files:**

- Modify: `apps/web/src/app/dashboard/organization/_components/departments-tab.tsx`
- Modify: `apps/web/src/app/dashboard/organization/_components/locations-tab.tsx`
- Modify: `apps/web/src/app/dashboard/organization/_components/teams-tab.tsx`
- Modify: `apps/web/src/app/dashboard/people/_components/people-data-table.tsx`

**Step 1: Department cards → navigate to detail**

In `departments-tab.tsx`:

- Import `useRouter` from `next/navigation`
- Add `const router = useRouter();`
- Change department card `<div>` to include `onClick={() => router.push(\`/dashboard/organization/departments/\${dept.department_id}\`)}`and add`cursor-pointer`
- Add `onClick={(e) => e.stopPropagation()}` on the DropdownMenuTrigger button

**Step 2: Location cards → navigate to detail**

Same pattern in `locations-tab.tsx`:

- Card click → `/dashboard/organization/locations/${loc.location_id}`
- stopPropagation on dropdown

**Step 3: Team cards → navigate to detail**

In `teams-tab.tsx`:

- Change card click from `setSheetTeam(team)` to `router.push(\`/dashboard/organization/teams/\${team.team_id}\`)`
- Remove the `TeamMembersSheet` render (now handled by team detail page)
- Remove `sheetTeam` state
- Keep the `profiles` prop (might still be needed for other things, or remove if unused)

**Step 4: People rows → navigate to detail**

In `people-data-table.tsx`:

- Change row click from `setSelectedEmployee(emp)` to `router.push(\`/dashboard/people/\${emp.profileId ?? emp.id}\`)`
- Keep `EmployeeProfileCard` for now (can be removed later, but not breaking)
- Import `useRouter`

**Step 5: Verify types**

Run: `pnpm typecheck`
Expected: PASS

**Step 6: Commit**

```bash
git add apps/web/src/app/dashboard/organization/_components/ apps/web/src/app/dashboard/people/_components/
git commit -m "feat(nav): wire list view cards to entity detail pages"
```

---

## Task 7: Full typecheck, lint, and update WORKLOG

**Step 1: Full typecheck**

Run: `pnpm typecheck`
Expected: All 18 packages PASS

**Step 2: Lint**

Run: `pnpm lint`
Expected: 0 errors

**Step 3: Update WORKLOG**

Add all completed tasks to `docs/WORKLOG.md`.

**Step 4: Commit and push**

```bash
git add docs/WORKLOG.md
git commit -m "docs: update WORKLOG with entity detail pages"
git push
```

---

## Summary

| Task | What                                | Files            |
| ---- | ----------------------------------- | ---------------- |
| 1    | Shared EntityDetailLayout component | 1 new file       |
| 2    | Department detail page (5 tabs)     | 1 new file       |
| 3    | Location detail page (4 tabs)       | 1 new file       |
| 4    | Team detail page (4 tabs)           | 1 new file       |
| 5    | Profile detail page (4 tabs)        | 1 new file       |
| 6    | Wire navigation from list views     | 4 modified files |
| 7    | Typecheck + lint + WORKLOG          | docs             |

**Total: 7 tasks, 5 new files, 4 modified files**
