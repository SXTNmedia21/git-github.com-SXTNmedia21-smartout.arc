---
title: "Plan — platform-admin-polish"
status: in_progress
updated: 2026-03-18
created: 2026-03-18
module: platform-admin
tags: [plan, performance, ui, ux]
---

# Platform Admin Polish — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix performance bottlenecks and improve UI/UX across all platform admin pages.

**Architecture:** Server-side queries stay but get pagination. Client components get memoization, code splitting, and consistent loading states. Sidebar gets grouped navigation. No new dependencies — only better use of existing tools (useMemo, next/dynamic, Supabase .range()).

**Tech Stack:** Next.js 16 (App Router), TanStack Table, Recharts, Supabase admin client, shadcn/ui

---

### Task 1: Fix N+1 TooltipProvider in Billing Table

**Files:**

- Modify: `apps/web/src/app/platform-admin/billing/_components/billing-client.tsx:286-296`

**Step 1: Read the file and locate the TooltipProvider inside the columns useMemo**

The TooltipProvider is inside the actions column cell renderer (line 286), wrapped around a single DropdownMenuItem. It creates a new provider for every row's dropdown.

**Step 2: Move TooltipProvider to table wrapper level**

In the render section (~line 435), wrap the entire table in a single `<TooltipProvider>`:

```tsx
// Before:
<Table>

// After:
<TooltipProvider>
  <Table>
    ...
  </Table>
</TooltipProvider>
```

Then remove the per-row TooltipProvider from the column definition (lines 286-296):

```tsx
// Before:
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <DropdownMenuItem disabled>
        <ExternalLink className="h-4 w-4" />
        View in Stripe
      </DropdownMenuItem>
    </TooltipTrigger>
    <TooltipContent side="left">Stripe integration coming</TooltipContent>
  </Tooltip>
</TooltipProvider>

// After:
<Tooltip>
  <TooltipTrigger asChild>
    <DropdownMenuItem disabled>
      <ExternalLink className="h-4 w-4" />
      View in Stripe
    </DropdownMenuItem>
  </TooltipTrigger>
  <TooltipContent side="left">Stripe integration coming</TooltipContent>
</Tooltip>
```

**Step 3: Verify**

Run: `pnpm --filter web typecheck`
Expected: 0 errors

**Step 4: Commit**

```bash
git add apps/web/src/app/platform-admin/billing/_components/billing-client.tsx
git commit -m "perf(platform-admin): move TooltipProvider to table level in billing"
```

---

### Task 2: Memoize Chart Data in Billing + Dashboard

**Files:**

- Modify: `apps/web/src/app/platform-admin/billing/_components/billing-client.tsx:126-132`
- Modify: `apps/web/src/app/platform-admin/dashboard/_components/dashboard-client.tsx:142-185`

**Step 1: Memoize billing chart data**

In `billing-client.tsx`, the `chartData` mapping (~line 126) runs on every render:

```tsx
// Before:
const chartData = mrrData.map((d) => ({
  date: new Date(d.metric_date).toLocaleDateString("no-NO", {
    month: "short",
    day: "numeric",
  }),
  mrr: d.metric_value,
}));

// After:
const chartData = useMemo(
  () =>
    mrrData.map((d) => ({
      date: new Date(d.metric_date).toLocaleDateString("no-NO", {
        month: "short",
        day: "numeric",
      }),
      mrr: d.metric_value,
    })),
  [mrrData],
);
```

**Step 2: Memoize dashboard pie chart data**

In `dashboard-client.tsx`, the subscription data is filtered inline (~line 152). Wrap in useMemo:

```tsx
// Before:
const hasSubscriptionData = subscriptionData.some((d) => d.value > 0);

// After:
const filteredSubscriptionData = useMemo(
  () => subscriptionData.filter((d) => d.value > 0),
  [subscriptionData],
);
const hasSubscriptionData = filteredSubscriptionData.length > 0;
```

Then use `filteredSubscriptionData` in the Pie `data` prop and Cell map instead of filtering twice.

**Step 3: Verify**

Run: `pnpm --filter web typecheck`
Expected: 0 errors

**Step 4: Commit**

```bash
git add apps/web/src/app/platform-admin/billing/_components/billing-client.tsx \
       apps/web/src/app/platform-admin/dashboard/_components/dashboard-client.tsx
git commit -m "perf(platform-admin): memoize chart data in billing + dashboard"
```

---

### Task 3: Add Pagination to Contracts Query

**Files:**

- Modify: `apps/web/src/app/platform-admin/contracts/page.tsx:31-39`

**Step 1: Add .limit() to the unbounded query**

```tsx
// Before:
admin
  .from("contract" as never)
  .select(`contract_id, title, status, ...`)
  .order("created_at", { ascending: false });

// After:
admin
  .from("contract" as never)
  .select(`contract_id, title, status, ...`, { count: "exact" })
  .order("created_at", { ascending: false })
  .limit(200);
```

**Step 2: Verify**

Run: `pnpm --filter web typecheck`
Expected: 0 errors

**Step 3: Commit**

```bash
git add apps/web/src/app/platform-admin/contracts/page.tsx
git commit -m "perf(platform-admin): add limit to contracts query"
```

---

### Task 4: Add Pagination to Billing Companies Query

**Files:**

- Modify: `apps/web/src/app/platform-admin/billing/page.tsx:17-22`

**Step 1: Add .limit() to the company query**

```tsx
// Before:
admin
  .from("company")
  .select("company_id, name, slug, subscription_status, ...")
  .order("created_at", { ascending: false });

// After:
admin
  .from("company")
  .select("company_id, name, slug, subscription_status, ...", { count: "exact" })
  .order("created_at", { ascending: false })
  .limit(500);
```

**Step 2: Verify**

Run: `pnpm --filter web typecheck`
Expected: 0 errors

**Step 3: Commit**

```bash
git add apps/web/src/app/platform-admin/billing/page.tsx
git commit -m "perf(platform-admin): add limit to billing companies query"
```

---

### Task 5: Make KPI Cards Responsive

**Files:**

- Modify: `apps/web/src/app/platform-admin/dashboard/page.tsx` — KPI grid section (~line 114)

**Step 1: Find the KPI card grid container and make it responsive**

```tsx
// Before:
className = "grid grid-cols-5 gap-4";

// After:
className = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5";
```

**Step 2: Verify — resize browser window, cards should stack on mobile**

Run: `pnpm --filter web typecheck`
Expected: 0 errors

**Step 3: Commit**

```bash
git add apps/web/src/app/platform-admin/dashboard/page.tsx
git commit -m "fix(platform-admin): make dashboard KPI cards responsive"
```

---

### Task 6: Group Sidebar Navigation

**Files:**

- Modify: `apps/web/src/components/platform-admin/sidebar-nav.tsx`

**Step 1: Read the current nav items array (lines 23-60)**

**Step 2: Reorganize into groups**

Replace the flat array with grouped structure:

```tsx
type NavGroup = {
  label: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/platform-admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/platform-admin/health", label: "Health", icon: Activity },
      { href: "/platform-admin/services", label: "Services", icon: Server },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/platform-admin/workspaces", label: "Workspaces", icon: Building2 },
      { href: "/platform-admin/users", label: "Users", icon: Users },
      { href: "/platform-admin/billing", label: "Billing", icon: CreditCard },
      { href: "/platform-admin/contracts", label: "Contracts", icon: FileText },
      {
        href: "/platform-admin/contracts/templates",
        label: "Maler",
        icon: FilePlus2,
        indent: true,
      },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/platform-admin/communications", label: "Communications", icon: MessageSquare },
      { href: "/platform-admin/content", label: "Content", icon: FileText },
      { href: "/platform-admin/landing", label: "Landing", icon: Globe },
      {
        href: "/platform-admin/landing/variants",
        label: "Variants",
        icon: FlaskConical,
        indent: true,
      },
      { href: "/platform-admin/journeys", label: "Journey", icon: Map },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/platform-admin/keys", label: "Keys & Secrets", icon: KeyRound },
      { href: "/platform-admin/guardian", label: "Guardian", icon: Shield },
      { href: "/platform-admin/audit", label: "Audit Log", icon: ScrollText },
    ],
  },
];
```

**Step 3: Update the render to show groups with labels**

```tsx
<nav className="space-y-4 px-2 py-4">
  {navGroups.map((group) => (
    <div key={group.label}>
      <p className="text-muted-foreground mb-1 px-3 text-[11px] font-semibold tracking-wider uppercase">
        {group.label}
      </p>
      <div className="space-y-0.5">
        {group.items.map((item) => {
          const isActive =
            item.href === "/platform-admin/dashboard"
              ? pathname === item.href
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                item.indent && "pl-8",
                isActive
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  ))}
</nav>
```

**Step 4: Verify — sidebar should show 4 labeled groups**

Run: `pnpm --filter web typecheck`
Expected: 0 errors

**Step 5: Commit**

```bash
git add apps/web/src/components/platform-admin/sidebar-nav.tsx
git commit -m "feat(platform-admin): group sidebar navigation into categories"
```

---

### Task 7: Add Consistent Skeleton Loaders

**Files:**

- Modify: `apps/web/src/app/platform-admin/loading.tsx`

**Step 1: Replace the simple spinner with a skeleton layout**

```tsx
export default function PlatformAdminLoading() {
  return (
    <div className="space-y-6 p-6">
      {/* Title skeleton */}
      <div className="h-8 w-48 animate-pulse rounded-lg bg-zinc-800/50" />

      {/* KPI cards skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-xl border border-zinc-800/50 bg-zinc-900/50"
          />
        ))}
      </div>

      {/* Table skeleton */}
      <div className="space-y-2">
        <div className="h-10 animate-pulse rounded-lg bg-zinc-800/30" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-zinc-800/20" />
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Verify**

Run: `pnpm --filter web typecheck`
Expected: 0 errors

**Step 3: Commit**

```bash
git add apps/web/src/app/platform-admin/loading.tsx
git commit -m "feat(platform-admin): add skeleton loading state"
```

---

### Task 8: Add Table Horizontal Scroll Wrapper

**Files:**

- Modify: `apps/web/src/app/platform-admin/billing/_components/billing-client.tsx`
- Modify: `apps/web/src/app/platform-admin/users/_components/users-client.tsx`

**Step 1: Wrap tables in horizontal scroll container**

Find each `<Table>` render and wrap with:

```tsx
<div className="overflow-x-auto">
  <Table>...</Table>
</div>
```

Do this in both billing-client.tsx and users-client.tsx.

**Step 2: Verify on narrow viewport — table should scroll horizontally**

Run: `pnpm --filter web typecheck`
Expected: 0 errors

**Step 3: Commit**

```bash
git add apps/web/src/app/platform-admin/billing/_components/billing-client.tsx \
       apps/web/src/app/platform-admin/users/_components/users-client.tsx
git commit -m "fix(platform-admin): add horizontal scroll to tables for mobile"
```

---

### Task 9: Raise Users Query Limit + Show Count

**Files:**

- Modify: `apps/web/src/app/platform-admin/users/page.tsx:20`

**Step 1: Change the hardcoded limit and add count**

```tsx
// Before:
.select("user_id, email, first_name, last_name, is_godmode, is_active, last_login_at, created_at")
.order("created_at", { ascending: false })
.limit(250)

// After:
.select("user_id, email, first_name, last_name, is_godmode, is_active, last_login_at, created_at", { count: "exact" })
.order("created_at", { ascending: false })
.limit(1000)
```

**Step 2: Verify**

Run: `pnpm --filter web typecheck`
Expected: 0 errors

**Step 3: Commit**

```bash
git add apps/web/src/app/platform-admin/users/page.tsx
git commit -m "perf(platform-admin): raise users query limit and add count"
```

---

### Task 10: Final Typecheck + Worklog Update

**Step 1: Run full typecheck**

Run: `pnpm turbo typecheck`
Expected: 18/18 pass, 0 errors

**Step 2: Verify all commits are clean**

Run: `git log --oneline feat/platform-admin-polish ^development`
Expected: 9 commits, all conventional format

**Step 3: Update worklog**

Update `docs/worklogs/WORKLOG-platform-admin-polish.md` with all completed tasks and decisions.

```bash
git add docs/worklogs/WORKLOG-platform-admin-polish.md
git commit -m "docs: update worklog for platform-admin-polish"
```

---

## Acceptance Criteria

- [ ] Billing table uses single TooltipProvider (not per-row)
- [ ] Chart data memoized in billing + dashboard
- [ ] Contracts query has limit (200)
- [ ] Billing companies query has limit (500)
- [ ] KPI cards responsive on mobile/tablet
- [ ] Sidebar grouped into 4 categories
- [ ] Skeleton loading state on all admin pages
- [ ] Tables horizontally scrollable on mobile
- [ ] Users query raised to 1000 with count
- [ ] `pnpm turbo typecheck` passes 18/18
