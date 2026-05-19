# SM-1 — Sidebar 11-Flat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the dashboard sidebar from 9 grouped sections (52 admin items) to 11 flat top-level items, drop `isDark ?` ternaries in favour of Nordic Split sidebar tokens, and narrow the rail from 256px to 240px.

**Architecture:** No new components. `sidebar-config.ts` is rewritten to 11 single-item `SidebarGroupDef` entries with `standalone: true` — existing `<SidebarGroup>` component already renders header-less when `standalone` is set, so the grouping primitive is reused, not replaced. `<NavItem>` and `<SidebarGroup>` `isDark` ternaries are replaced with Tailwind `--sidebar` token classes that `globals.css` already exports. Width change is one className edit in `DashboardShell.tsx`.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4 (CSS-config), TypeScript strict, Playwright for E2E. Canonical sidebar tokens in `apps/web/src/app/globals.css` (lines 12–19).

**Canonical spec:** `docs/design/sitemap/web/00-CANONICAL.md` §2, §11, §15.

---

## File Structure

Files this plan creates or modifies:

| Operation | Path | Responsibility |
|---|---|---|
| Modify | `apps/web/src/components/dashboard/sidebar-config.ts` | Rewrite `SIDEBAR_GROUPS_ADMIN` to 11 single-item standalone groups. Same for `SIDEBAR_GROUPS_EMPLOYEE` (11 items via Min Tid expansion). `SIDEBAR_GROUPS_DEMO` follows admin slice. |
| Modify | `apps/web/src/components/dashboard/DashboardShell.tsx` (lines 1320–1435 only) | Drop `isDark ?` ternaries in sidebar `<aside>` block + bottom controls block. Replace with `bg-sidebar`, `text-sidebar-foreground`, `border-sidebar-border`. Width `w-64` → `w-60`. |
| Modify | `apps/web/src/components/dashboard/NavItem.tsx` (lines 65–75) | Drop `isDark ?` ternary in `baseClassName`. Use `bg-sidebar-accent`, `text-sidebar-accent-foreground`, `text-sidebar-foreground` tokens. |
| Modify | `packages/i18n/locales/nb/dashboard.json` | Add 4 new keys: `sidebar.item_oppgaver`, `sidebar.item_planlegging`, `sidebar.item_chat_standalone`, `sidebar.item_kommunikasjon_root`. Group keys retained for backwards-compat but go unused. |
| Modify | `packages/i18n/locales/en/dashboard.json` | Same 4 keys. |
| Create | `apps/e2e/tests/sidebar-11-flat.spec.ts` | Playwright tests asserting: 11 admin nav items in order, 11 employee nav items in order, no group-header text rendered, active-state highlights on direct + sub-route. |

No new components. No database changes. No new routes. Three of the eleven items (`/dashboard/tasks`, `/dashboard/planning`, `/dashboard/chat`) point at routes that do not yet exist — they ship as `disabled: true` in this sortie and become enabled in SM-2 / SM-3 / SM-5 respectively.

---

## Task 1: Orientation read

**Files:** read-only

- [ ] **Step 1: Read sidebar-config to understand current shape**

Run: `cat apps/web/src/components/dashboard/sidebar-config.ts | head -200`

Expected: `SidebarItem`, `SidebarGroupDef`, `SIDEBAR_GROUPS_ADMIN` declared. 9 groups. `standalone: true` only on Oversikt group. Confirm `KOMM_ITEMS` shared array exists.

- [ ] **Step 2: Read DashboardShell sidebar block**

Run: `sed -n '1320,1435p' apps/web/src/components/dashboard/DashboardShell.tsx | head -120`

Expected: `<aside>` opens at line 1320 with `isDark ? "border-border bg-card" : "border-[var(--border)] bg-[var(--surface-base)] ..."`. Bottom controls block at 1379–1432 has more `isDark ?` ternaries.

- [ ] **Step 3: Read NavItem baseClassName ternaries**

Run: `sed -n '65,80p' apps/web/src/components/dashboard/NavItem.tsx`

Expected: `baseClassName` four-branch ternary on `active` × `isDark`. This is the centerpiece of the cleanup.

- [ ] **Step 4: Confirm sidebar tokens exist in globals.css**

Run: `grep -n 'sidebar-' apps/web/src/app/globals.css | head -20`

Expected: lines 12–19 export `--color-sidebar-*` mappings to `--sidebar-*` CSS variables. Confirms `bg-sidebar` / `text-sidebar-foreground` Tailwind classes work without further token wiring.

---

## Task 2: Add i18n keys

**Files:**
- Modify: `packages/i18n/locales/nb/dashboard.json`
- Modify: `packages/i18n/locales/en/dashboard.json`

- [ ] **Step 1: Locate existing sidebar.* keys in nb/dashboard.json**

Run: `grep -n '"sidebar.item_' packages/i18n/locales/nb/dashboard.json | head -10`

Expected: existing keys like `sidebar.item_oversikt`, `sidebar.item_ansatte`, `sidebar.item_vaktplan` already present. Confirms file structure.

- [ ] **Step 2: Add 4 new keys to nb/dashboard.json**

Locate the `"sidebar.item_*"` block (preserve alphabetical or existing order). Add these keys, retaining surrounding JSON:

```json
"sidebar.item_oppgaver": "Oppgaver",
"sidebar.item_planlegging": "Planlegging",
"sidebar.item_chat_standalone": "Chat",
"sidebar.item_kommunikasjon_root": "Kommunikasjon"
```

The `_standalone` and `_root` suffixes distinguish the top-level slot from the existing `sidebar.item_chat` (used as a Komm sub-item) and `sidebar.group_kommunikasjon` (current group header) which both retain their meanings until later sortier dismantle the Komm group.

- [ ] **Step 3: Add same 4 keys to en/dashboard.json**

```json
"sidebar.item_oppgaver": "Tasks",
"sidebar.item_planlegging": "Planning",
"sidebar.item_chat_standalone": "Chat",
"sidebar.item_kommunikasjon_root": "Communication"
```

- [ ] **Step 4: Verify both JSON files parse**

Run: `node -e "JSON.parse(require('fs').readFileSync('packages/i18n/locales/nb/dashboard.json','utf8'))" && node -e "JSON.parse(require('fs').readFileSync('packages/i18n/locales/en/dashboard.json','utf8'))"`

Expected: no output, exit code 0. Any parse error stops the task.

- [ ] **Step 5: Commit**

```bash
git add packages/i18n/locales/nb/dashboard.json packages/i18n/locales/en/dashboard.json
git commit -m "$(cat <<'EOF'
i18n(sidebar): add 4 keys for 11-flat sidebar restructure

Adds sidebar.item_oppgaver, _planlegging, _chat_standalone,
_kommunikasjon_root for SM-1 11-flat sidebar. Existing keys retained
for backwards-compat.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Failing E2E test

**Files:**
- Create: `apps/e2e/tests/sidebar-11-flat.spec.ts`

- [ ] **Step 1: Inspect existing protocol-test naming convention**

Run: `ls apps/e2e/tests/ 2>&1 | head -10 && cat apps/e2e/protocols/p-sidebar-orphan-coverage.ts | head -30`

Expected: existing tests follow `apps/e2e/tests/*.spec.ts` for general tests and `apps/e2e/protocols/p-*.ts` for the protocol harness. Use `apps/e2e/tests/` for this new spec because it's a single-feature regression test.

- [ ] **Step 2: Create sidebar-11-flat.spec.ts**

Path: `apps/e2e/tests/sidebar-11-flat.spec.ts`

```ts
import { test, expect } from "@playwright/test";

const ADMIN_SLOTS_IN_ORDER = [
  { testId: "sidebar-item-dashboard", label: "Oversikt" },
  { testId: "sidebar-item-tasks", label: "Oppgaver" },
  { testId: "sidebar-item-planning", label: "Planlegging" },
  { testId: "sidebar-item-schedule", label: "Vaktplan" },
  { testId: "sidebar-item-people", label: "Ansatte" },
  { testId: "sidebar-item-hms", label: "HMS" },
  { testId: "sidebar-item-payroll", label: "Lønn" },
  { testId: "sidebar-item-reconciliation", label: "Avstemming" },
  { testId: "sidebar-item-reports", label: "Rapporter" },
  { testId: "sidebar-item-chat", label: "Chat" },
  { testId: "sidebar-item-komm", label: "Kommunikasjon" },
];

const EMPLOYEE_SLOTS_IN_ORDER = [
  { testId: "sidebar-item-dashboard", label: "Oversikt" },
  { testId: "sidebar-item-my-schedule", label: "Min plan" },
  { testId: "sidebar-item-my-salary", label: "Min lønn" },
  { testId: "sidebar-item-my-contract", label: "Min kontrakt" },
  { testId: "sidebar-item-my-cv", label: "Min CV" },
  { testId: "sidebar-item-my-training", label: "Min trening" },
  { testId: "sidebar-item-my-profile", label: "Min profil" },
  { testId: "sidebar-item-shift-clock", label: "Stempelur" },
  { testId: "sidebar-item-chat", label: "Chat" },
  { testId: "sidebar-item-komm", label: "Kommunikasjon" },
];

test.describe("Sidebar 11-flat structure (SM-1)", () => {
  test.beforeEach(async ({ page }) => {
    // Seed admin profile per docs/protocols — adjust if seed harness differs.
    await page.goto("/dashboard");
    await page.waitForSelector('[data-testid="sidebar-nav"]');
  });

  test("admin mode renders 11 items in canonical order", async ({ page }) => {
    // Ensure admin mode is active. Toggle button labelled "Drift mode" when in admin.
    const adminToggle = page.locator('[data-autoplay="admin-mode-toggle"]');
    const currentLabel = await adminToggle.textContent();
    if (currentLabel?.includes("Min Tid") === false) {
      // Already admin — no-op
    } else {
      await adminToggle.click();
    }

    for (let i = 0; i < ADMIN_SLOTS_IN_ORDER.length; i++) {
      const slot = ADMIN_SLOTS_IN_ORDER[i]!;
      const item = page.locator(`[data-testid="${slot.testId}"]`);
      await expect(item, `slot ${i} (${slot.testId})`).toBeVisible();
    }

    // Assert no group-header chrome rendered (no uppercase tracking-widest labels).
    const groupHeaders = page.locator('[data-testid^="sidebar-group-"]');
    await expect(groupHeaders).toHaveCount(0);
  });

  test("employee mode renders 10 items in canonical order", async ({ page }) => {
    const adminToggle = page.locator('[data-autoplay="admin-mode-toggle"]');
    await adminToggle.click();
    // Wait for switch (one of the my-* items must be visible)
    await page.waitForSelector('[data-testid="sidebar-item-my-schedule"]');

    for (let i = 0; i < EMPLOYEE_SLOTS_IN_ORDER.length; i++) {
      const slot = EMPLOYEE_SLOTS_IN_ORDER[i]!;
      const item = page.locator(`[data-testid="${slot.testId}"]`);
      await expect(item, `slot ${i} (${slot.testId})`).toBeVisible();
    }
  });

  test("active state highlights parent on sub-route", async ({ page }) => {
    await page.goto("/dashboard/people");
    const peopleItem = page.locator('[data-testid="sidebar-item-people"]');
    await expect(peopleItem).toHaveAttribute("data-active", "true");

    // Drill into sub-route — parent stays active
    await page.goto("/dashboard/people/invitations");
    await expect(peopleItem).toHaveAttribute("data-active", "true");
  });

  test("sidebar width is 240px when expanded", async ({ page }) => {
    const aside = page.locator("aside").first();
    const box = await aside.boundingBox();
    expect(box?.width).toBe(240);
  });
});
```

- [ ] **Step 3: Run the test, verify it fails**

Run: `pnpm --filter @smartout/e2e playwright test sidebar-11-flat.spec.ts --reporter=line`

Expected: 4 tests, all FAIL. Specifically:
- "renders 11 items in canonical order" fails because current sidebar still groups items.
- "active state highlights parent" likely passes already (existing behaviour) but may fail on `data-active` attribute if attribute is missing.
- "width is 240px" fails because current width is 256px (`w-64`).

Capture the failing output; it becomes the verification target.

> **Branch hygiene:** This test file lands red — that's correct for TDD. If lint-staged or husky blocks the commit because the spec file imports from an unbuilt package, commit the test with `git add apps/e2e/tests/sidebar-11-flat.spec.ts` only and explicitly skip running `pnpm test` in the commit hook by setting `SKIP_E2E_PRECOMMIT=1` if such a flag exists in `.husky/pre-commit` — otherwise leave uncommitted until Task 4 lands and the test goes green.

- [ ] **Step 4: Commit the failing test (if pre-commit allows)**

```bash
git add apps/e2e/tests/sidebar-11-flat.spec.ts
git commit -m "$(cat <<'EOF'
test(sidebar): add failing 11-flat regression spec

TDD red phase for SM-1 sidebar restructure. 4 tests verify item order
+ count + no group headers + 240px width. All fail against current
9-grouped sidebar.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

If pre-commit hook refuses red test, defer this commit to Task 5 and bundle with implementation.

---

## Task 4: Rewrite sidebar-config to 11 flat

**Files:**
- Modify: `apps/web/src/components/dashboard/sidebar-config.ts`

- [ ] **Step 1: Add icon imports (if missing)**

Inspect imports at top of file. The 11 admin items need these icons. Most are already imported; add missing:

```ts
import {
  Home,          // Oversikt
  ListTodo,      // Oppgaver (already imported)
  CalendarRange, // Planlegging (already imported)
  CalendarDays,  // Vaktplan (verify — existing schedule uses Calendar)
  Users,         // Ansatte (already imported)
  ShieldAlert,   // HMS (already imported)
  Wallet,        // Lønn (already imported, currently for payroll)
  ClipboardCheck,// Avstemming (already imported)
  BarChart3,     // Rapporter (already imported)
  MessageCircle, // Chat (already imported)
  Hash,          // Kommunikasjon (already imported)
} from "lucide-react";
```

No-op if all already present.

- [ ] **Step 2: Replace SIDEBAR_GROUPS_ADMIN body**

Replace the entire `export const SIDEBAR_GROUPS_ADMIN: SidebarGroupDef[] = [ … ];` declaration with this exact body. Eleven groups, every group `standalone: true`, every group one item:

```ts
export const SIDEBAR_GROUPS_ADMIN: SidebarGroupDef[] = [
  // 1. Oversikt
  {
    labelKey: "sidebar.group_oversikt",
    standalone: true,
    items: [
      {
        labelKey: "sidebar.item_oversikt",
        href: "/dashboard",
        icon: Home,
        status: "live",
        exactMatch: true,
      },
    ],
  },
  // 2. Oppgaver — destination ships in SM-2 (currently disabled)
  {
    labelKey: "sidebar.group_oppgaver",
    standalone: true,
    items: [
      {
        labelKey: "sidebar.item_oppgaver",
        href: "/dashboard/tasks",
        icon: ListTodo,
        status: "not-yet-built",
        disabled: true,
      },
    ],
  },
  // 3. Planlegging — destination ships in SM-3
  {
    labelKey: "sidebar.group_planlegging",
    standalone: true,
    items: [
      {
        labelKey: "sidebar.item_planlegging",
        href: "/dashboard/planning",
        icon: CalendarRange,
        status: "not-yet-built",
        disabled: true,
      },
    ],
  },
  // 4. Vaktplan
  {
    labelKey: "sidebar.group_vaktplan",
    standalone: true,
    items: [
      {
        labelKey: "sidebar.item_vaktplan",
        href: "/dashboard/schedule",
        icon: CalendarDays,
        status: "live",
        compositeActive: ["/dashboard/calendar"],
      },
    ],
  },
  // 5. Ansatte — composite active for contracts hub (moves under /people in SM-2)
  {
    labelKey: "sidebar.group_ansatte",
    standalone: true,
    items: [
      {
        labelKey: "sidebar.item_ansatte",
        href: "/dashboard/people",
        icon: Users,
        status: "live",
        compositeActive: ["/dashboard/contracts"],
      },
    ],
  },
  // 6. HMS
  {
    labelKey: "sidebar.group_hms",
    standalone: true,
    items: [
      {
        labelKey: "sidebar.item_hms",
        href: "/dashboard/hms",
        icon: ShieldAlert,
        status: "live",
        compositeActive: ["/dashboard/policies", "/dashboard/handbook"],
      },
    ],
  },
  // 7. Lønn
  {
    labelKey: "sidebar.group_lonn",
    standalone: true,
    items: [
      {
        labelKey: "sidebar.item_lonn",
        href: "/dashboard/payroll",
        icon: Wallet,
        status: "live",
        compositeActive: ["/dashboard/cost", "/dashboard/billing"],
      },
    ],
  },
  // 8. Avstemming
  {
    labelKey: "sidebar.group_avstemming",
    standalone: true,
    items: [
      {
        labelKey: "sidebar.item_avstemming",
        href: "/dashboard/reconciliation",
        icon: ClipboardCheck,
        status: "live",
      },
    ],
  },
  // 9. Rapporter
  {
    labelKey: "sidebar.group_rapporter",
    standalone: true,
    items: [
      {
        labelKey: "sidebar.item_rapporter",
        href: "/dashboard/reports",
        icon: BarChart3,
        status: "live",
      },
    ],
  },
  // 10. Chat — destination ships in SM-5 (currently routes to /komm/chat as interim)
  {
    labelKey: "sidebar.group_chat",
    standalone: true,
    items: [
      {
        labelKey: "sidebar.item_chat_standalone",
        href: "/dashboard/chat",
        icon: MessageCircle,
        status: "not-yet-built",
        disabled: true,
      },
    ],
  },
  // 11. Kommunikasjon — points at existing /komm; tabs adjust in SM-5
  {
    labelKey: "sidebar.group_kommunikasjon",
    standalone: true,
    items: [
      {
        labelKey: "sidebar.item_kommunikasjon_root",
        href: "/dashboard/komm",
        icon: Hash,
        status: "live",
        exactMatch: false,
      },
    ],
  },
];
```

- [ ] **Step 3: Add new group label keys to i18n**

The group `labelKey` values are still referenced for `data-testid` generation in `SidebarGroup.tsx` line 59 (`sidebar-group-${groupLabel.toLowerCase()…}`). With `standalone: true` they don't render visually, but the `t(group.labelKey)` call still executes. Add corresponding i18n keys to avoid translation-warnings in dev console:

Append to `packages/i18n/locales/nb/dashboard.json`:

```json
"sidebar.group_oppgaver": "Oppgaver",
"sidebar.group_planlegging": "Planlegging",
"sidebar.group_ansatte": "Ansatte",
"sidebar.group_hms": "HMS",
"sidebar.group_lonn": "Lønn",
"sidebar.group_avstemming": "Avstemming",
"sidebar.group_rapporter": "Rapporter",
"sidebar.group_vaktplan": "Vaktplan",
"sidebar.group_chat": "Chat"
```

Append to `packages/i18n/locales/en/dashboard.json` with English values.

- [ ] **Step 4: Replace SIDEBAR_GROUPS_EMPLOYEE body**

Replace the current 3-group employee structure with 10 single-item standalone groups:

```ts
export const SIDEBAR_GROUPS_EMPLOYEE: SidebarGroupDef[] = [
  {
    labelKey: "sidebar.group_oversikt",
    standalone: true,
    items: [{ labelKey: "sidebar.item_oversikt", href: "/dashboard", icon: Home, status: "live", exactMatch: true }],
  },
  {
    labelKey: "sidebar.group_min_plan",
    standalone: true,
    items: [{ labelKey: "sidebar.item_min_plan", href: "/dashboard/my-schedule", icon: Calendar, status: "live" }],
  },
  {
    labelKey: "sidebar.group_min_lonn",
    standalone: true,
    items: [{ labelKey: "sidebar.item_min_lonn", href: "/dashboard/my-salary", icon: Banknote, status: "live" }],
  },
  {
    labelKey: "sidebar.group_min_kontrakt",
    standalone: true,
    items: [{ labelKey: "sidebar.item_min_kontrakt", href: "/dashboard/my-contract", icon: FileCheck, status: "live" }],
  },
  {
    labelKey: "sidebar.group_min_cv",
    standalone: true,
    items: [{ labelKey: "sidebar.item_min_cv", href: "/dashboard/my-cv", icon: IdCard, status: "live", featureFlag: "MY_CV" }],
  },
  {
    labelKey: "sidebar.group_min_trening",
    standalone: true,
    items: [{ labelKey: "sidebar.item_min_trening", href: "/dashboard/my-training", icon: GraduationCap, status: "live", indicators: [{ type: "warning", label: "1 forfalt" }] }],
  },
  {
    labelKey: "sidebar.group_min_profil",
    standalone: true,
    items: [{ labelKey: "sidebar.item_min_profil", href: "/dashboard/my-profile", icon: UserCircle, status: "live" }],
  },
  {
    labelKey: "sidebar.group_stempelur",
    standalone: true,
    items: [{ labelKey: "sidebar.item_stempelur", href: "/dashboard/shift-clock", icon: Clock, status: "linked-orphan" }],
  },
  {
    labelKey: "sidebar.group_chat",
    standalone: true,
    items: [{ labelKey: "sidebar.item_chat_standalone", href: "/dashboard/chat", icon: MessageCircle, status: "not-yet-built", disabled: true }],
  },
  {
    labelKey: "sidebar.group_kommunikasjon",
    standalone: true,
    items: [{ labelKey: "sidebar.item_kommunikasjon_root", href: "/dashboard/komm", icon: Hash, status: "live" }],
  },
];
```

- [ ] **Step 5: Append employee-specific group i18n keys**

Append to `packages/i18n/locales/nb/dashboard.json`:

```json
"sidebar.group_min_plan": "Min plan",
"sidebar.group_min_lonn": "Min lønn",
"sidebar.group_min_kontrakt": "Min kontrakt",
"sidebar.group_min_cv": "Min CV",
"sidebar.group_min_trening": "Min trening",
"sidebar.group_min_profil": "Min profil",
"sidebar.group_stempelur": "Stempelur"
```

Append English equivalents to `en/dashboard.json`.

- [ ] **Step 6: Run typecheck**

Run: `pnpm --filter @smartout/web tsc --noEmit 2>&1 | tail -20`

Expected: 0 errors. If any error references an icon name (e.g. `ListTodo` not exported), revisit Task 4 Step 1 and add the missing import.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/dashboard/sidebar-config.ts packages/i18n/locales/nb/dashboard.json packages/i18n/locales/en/dashboard.json
git commit -m "$(cat <<'EOF'
refactor(sidebar): flatten to 11 standalone groups (SM-1)

Replaces 9-group admin (52 items) with 11 single-item standalone
groups per docs/design/sitemap/web/00-CANONICAL.md §2. Employee mode
flattens to 10 standalone items. Three destinations (/tasks, /planning,
/chat) marked disabled until SM-2/3/5 ship them. Composite-active
preserves cross-route highlighting (e.g. /contracts highlights Ansatte).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Sidebar width 256 → 240

**Files:**
- Modify: `apps/web/src/components/dashboard/DashboardShell.tsx` (lines 1321–1322 area)

- [ ] **Step 1: Find the width className**

Run: `grep -n 'w-64\|w-16' apps/web/src/components/dashboard/DashboardShell.tsx | head -5`

Expected: a line containing `${isSidebarCollapsed ? "w-16" : "w-64"}` near line 1322. The `w-64` is the expanded width.

- [ ] **Step 2: Replace w-64 with w-60**

In `DashboardShell.tsx`, change:

```tsx
isSidebarCollapsed ? "w-16" : "w-64"
```

to:

```tsx
isSidebarCollapsed ? "w-16" : "w-60"
```

Only this one occurrence in the sidebar `<aside>` className.

- [ ] **Step 3: Run typecheck**

Run: `pnpm --filter @smartout/web tsc --noEmit 2>&1 | tail -5`

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/dashboard/DashboardShell.tsx
git commit -m "$(cat <<'EOF'
style(sidebar): narrow expanded width 256→240 (SM-1)

w-64 → w-60. 16px back to canvas. 12px label still fits per
docs/design/sitemap/web/00-CANONICAL.md §11.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Drop isDark in sidebar `<aside>` + collapse-toggle

**Files:**
- Modify: `apps/web/src/components/dashboard/DashboardShell.tsx` lines 1320–1378

This task removes the dark-vs-light ternaries inside the sidebar `<aside>` block (header strip + collapse button) only. Bottom controls block (lines 1379–1432) is Task 7. NavItem internals are Task 8.

- [ ] **Step 1: Identify the four ternaries**

Run: `sed -n '1320,1378p' apps/web/src/components/dashboard/DashboardShell.tsx | grep -n 'isDark'`

Expected: four `isDark ?` occurrences inside this slice. Approximately:
- Line 1324–1326: `<aside>` background + border
- Line 1333: collapse-toggle wrapper border
- Line 1339–1341: collapse-toggle button hover + colors

- [ ] **Step 2: Replace `<aside>` className**

Locate this block:

```tsx
<aside
  className={`z-20 flex flex-col overflow-hidden border-r transition-[width] duration-200 ${
    isSidebarCollapsed ? "w-16" : "w-60"
  } ${
    isDark
      ? "border-border bg-card"
      : "border-[var(--border)] bg-[var(--surface-base)] shadow-[1px_0_12px_-4px_color-mix(in_oklch,var(--foreground)_8%,transparent)]"
  } print:hidden`}
>
```

Replace with:

```tsx
<aside
  className={`bg-sidebar text-sidebar-foreground border-sidebar-border z-20 flex flex-col overflow-hidden border-r transition-[width] duration-200 print:hidden ${
    isSidebarCollapsed ? "w-16" : "w-60"
  }`}
>
```

The drop-shadow in the light-theme branch is removed; the warmer Nordic Split surface no longer needs to fake elevation.

- [ ] **Step 3: Replace collapse-toggle wrapper className**

Locate (around line 1331–1334):

```tsx
<div
  className={`flex items-center border-b ${isSidebarCollapsed ? "justify-center px-2" : "justify-end px-3"} py-2 ${
    isDark ? "border-border" : "border-[var(--border)]"
  }`}
>
```

Replace with:

```tsx
<div
  className={`border-sidebar-border flex items-center border-b py-2 ${
    isSidebarCollapsed ? "justify-center px-2" : "justify-end px-3"
  }`}
>
```

- [ ] **Step 4: Replace collapse-toggle button className**

Locate (around line 1336–1343):

```tsx
<button
  onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
  className={`rounded-lg p-1.5 transition-colors ${
    isDark
      ? "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      : "text-[var(--text-dim)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-mid)]"
  }`}
>
```

Replace with:

```tsx
<button
  onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
  className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground rounded-lg p-1.5 transition-colors"
>
```

- [ ] **Step 5: Run typecheck**

Run: `pnpm --filter @smartout/web tsc --noEmit 2>&1 | tail -5`

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/dashboard/DashboardShell.tsx
git commit -m "$(cat <<'EOF'
refactor(sidebar): drop isDark in aside + collapse-toggle (SM-1)

Replaces 4 isDark ternaries in DashboardShell sidebar header block
with Nordic Split --sidebar tokens already exported from globals.css.
One theme path, one source of truth.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Drop isDark in sidebar footer controls

**Files:**
- Modify: `apps/web/src/components/dashboard/DashboardShell.tsx` lines 1379–1432

- [ ] **Step 1: Identify ternaries**

Run: `sed -n '1379,1432p' apps/web/src/components/dashboard/DashboardShell.tsx | grep -n 'isDark'`

Expected: ~3 `isDark ?` occurrences (wrapper border + admin-toggle border + admin-toggle text).

- [ ] **Step 2: Replace footer wrapper className**

Locate (around line 1380–1385):

```tsx
<div
  className={`border-t ${isSidebarCollapsed ? "p-2" : "p-4"} ${
    isDark
      ? "border-border bg-muted"
      : "border-[var(--border)] bg-[var(--surface-raised)]"
  } ${isSidebarCollapsed ? "p-1.5" : "p-2"} space-y-1`}
>
```

Replace with:

```tsx
<div
  className={`bg-sidebar-accent/40 border-sidebar-border space-y-1 border-t ${
    isSidebarCollapsed ? "p-1.5" : "p-2"
  }`}
>
```

Note: the duplicate-padding bug (the original has two `${isSidebarCollapsed ? "p-2" : "p-4"}` and `${isSidebarCollapsed ? "p-1.5" : "p-2"}` chained — the second wins) is also cleaned up.

- [ ] **Step 3: Replace admin-toggle button className**

Locate the admin-toggle button (around line 1405–1414):

```tsx
<button
  onClick={() => setIsAdminMode(!isAdminMode)}
  data-autoplay="admin-mode-toggle"
  className={`flex w-full items-center ${isSidebarCollapsed ? "justify-center" : "justify-between"} rounded-lg border ${isSidebarCollapsed ? "px-0 py-1.5" : "px-2.5 py-1.5"} text-xs font-semibold transition-all ${
    isAdminMode
      ? isDark
        ? "border-orange-500/20 bg-orange-500/10 text-orange-500"
        : "border-orange-200 bg-orange-50 text-orange-600"
      : "border-border bg-muted text-foreground shadow-sm"
  }`}
>
```

Replace the active-state nesting with a single token-based pair:

```tsx
<button
  onClick={() => setIsAdminMode(!isAdminMode)}
  data-autoplay="admin-mode-toggle"
  className={`flex w-full items-center rounded-lg border text-xs font-semibold transition-all ${
    isSidebarCollapsed ? "justify-center px-0 py-1.5" : "justify-between px-2.5 py-1.5"
  } ${
    isAdminMode
      ? "border-orange-500/30 bg-orange-500/15 text-orange-600 dark:text-orange-400"
      : "border-sidebar-border bg-sidebar text-sidebar-foreground shadow-sm"
  }`}
>
```

The orange accent kept (it's a deliberate semantic colour for "drift mode active", not a theme concern). Dark-mode text is now expressed via Tailwind `dark:` prefix on a single line.

- [ ] **Step 4: Run typecheck**

Run: `pnpm --filter @smartout/web tsc --noEmit 2>&1 | tail -5`

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/dashboard/DashboardShell.tsx
git commit -m "$(cat <<'EOF'
refactor(sidebar): drop isDark in footer controls (SM-1)

Replaces 3 isDark ternaries in DashboardShell sidebar footer block
with --sidebar tokens. Orange accent retained via dark: prefix on a
single class. Padding bug (two chained ternaries) cleaned up.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Drop isDark in NavItem

**Files:**
- Modify: `apps/web/src/components/dashboard/NavItem.tsx` lines 65–75

- [ ] **Step 1: Inspect current baseClassName**

Read NavItem.tsx lines 65–80. Confirm the four-branch active × isDark ternary.

- [ ] **Step 2: Replace baseClassName**

Replace the entire `baseClassName` declaration:

```tsx
const baseClassName = `group flex items-center rounded-xl transition-all ${
  isCollapsed ? "justify-center px-0 py-1.5" : "justify-between px-2.5 py-1.5"
} ${
  active
    ? isDark
      ? "border border-border bg-accent font-semibold text-accent-foreground"
      : "border border-[var(--surface-border-strong)/50] bg-[var(--surface-overlay)] font-bold text-[var(--text-strong)] shadow-sm"
    : isDark
      ? "border border-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      : "border border-transparent text-[var(--text-dim)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-strong)]"
}`;
```

With:

```tsx
const baseClassName = `group flex items-center rounded-xl border transition-all ${
  isCollapsed ? "justify-center px-0 py-1.5" : "justify-between px-2.5 py-1.5"
} ${
  active
    ? "border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-sm"
    : "border-transparent text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
}`;
```

- [ ] **Step 3: Add data-active attribute for E2E**

In the same NavItem.tsx, find the `Link` / `button` wrapping element (search for `aria-current`). Add a `data-active` attribute alongside whatever the current active state expresses:

```tsx
data-active={active ? "true" : "false"}
```

This is required by the Task 3 E2E test (`expect(peopleItem).toHaveAttribute("data-active", "true")`).

- [ ] **Step 4: Remove unused isDark prop reference**

The `isDark` prop still exists on `NavItemProps` (line 29). Leave the prop in place to avoid breaking callers that pass it — strip out the *usage* only, not the prop interface. Add a comment:

```tsx
isDark, // retained for prop-shape compatibility; no longer affects render — see ADR-pending sidebar-tokens
```

- [ ] **Step 5: Run typecheck**

Run: `pnpm --filter @smartout/web tsc --noEmit 2>&1 | tail -5`

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/dashboard/NavItem.tsx
git commit -m "$(cat <<'EOF'
refactor(navitem): drop isDark, use --sidebar tokens (SM-1)

NavItem now reads bg-sidebar-accent / text-sidebar-foreground from
the Nordic Split token layer instead of branching on isDark. Adds
data-active attribute for E2E selectors. Prop interface unchanged.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Run the failing test, verify it passes

- [ ] **Step 1: Re-run sidebar-11-flat.spec.ts**

Run: `pnpm --filter @smartout/e2e playwright test sidebar-11-flat.spec.ts --reporter=line`

Expected: 4 tests, all PASS.

If "admin renders 11 items" fails: open `sidebar-config.ts`, verify all 11 items present, `data-testid` derives from `routeSlug` in `SidebarGroup.tsx:72` correctly. The `disabled` items still render — `DisabledNavItem` uses `data-testid="sidebar-disabled-${routeSlug}"`, so the test must select either prefix. If `data-testid` mismatches, update the test selectors to use `[data-testid^="sidebar-item-"]` OR `[data-testid^="sidebar-disabled-"]`. Adjust spec at Step 2 below if needed.

- [ ] **Step 2: If disabled items use disabled-testid, broaden test**

If the test failed because disabled items use `sidebar-disabled-tasks` not `sidebar-item-tasks`, update `ADMIN_SLOTS_IN_ORDER` to support both:

```ts
const SLOT_SELECTORS = (slot: { testId: string }) =>
  `[data-testid="${slot.testId}"], [data-testid="${slot.testId.replace("sidebar-item-", "sidebar-disabled-")}"]`;
```

Use `page.locator(SLOT_SELECTORS(slot)).first()` in the assertion.

- [ ] **Step 3: If width fails by ±1px, adjust assertion**

Browsers may report fractional widths. Replace `expect(box?.width).toBe(240)` with `expect(box?.width).toBeGreaterThanOrEqual(238)` and `expect(box?.width).toBeLessThanOrEqual(242)`.

- [ ] **Step 4: Commit any test adjustments**

```bash
git add apps/e2e/tests/sidebar-11-flat.spec.ts
git commit -m "$(cat <<'EOF'
test(sidebar): tighten 11-flat assertions for disabled items + width tolerance

Adjusts test selectors to handle DisabledNavItem testid prefix and
width measurement variance.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

If no adjustments were needed, skip this commit.

---

## Task 10: Visual smoke + typecheck full

- [ ] **Step 1: Run full typecheck**

Run: `pnpm turbo typecheck --filter='@smartout/web' 2>&1 | tail -20`

Expected: 0 errors across web + dependencies.

- [ ] **Step 2: Run full lint**

Run: `pnpm turbo lint --filter='@smartout/web' 2>&1 | tail -10`

Expected: 0 errors.

- [ ] **Step 3: Start dev server**

Run: `op run --env-file=.env.template -- pnpm --filter @smartout/web dev`

Wait for `Ready in NNNs` log. Open `http://localhost:3060/dashboard` in a browser.

- [ ] **Step 4: Manual visual checks**

Verify in browser:

- [ ] Sidebar shows 11 items (admin mode default).
- [ ] No group-header text ("DRIFT", "ADMINISTRASJON", etc) anywhere.
- [ ] Spacing between items is uniform `mt-3` per group (no extra dividers).
- [ ] Sidebar width ≈ 240px (measure devtools).
- [ ] Disabled items (Oppgaver, Planlegging, Chat) render greyed out with tooltip "Kommer snart".
- [ ] Clicking Ansatte highlights the row; clicking through to `/dashboard/people/invitations` keeps Ansatte highlighted.
- [ ] Toggle dark/light theme — sidebar adapts smoothly; no hardcoded zinc/gray bleeding through.
- [ ] Toggle Drift/Min Tid — switches to 10-item employee surface.

Capture a screenshot of admin-mode sidebar (both themes) for the commit screenshot drop in Task 11.

- [ ] **Step 5: Stop dev server (Ctrl-C)**

---

## Task 11: Update HANDOFF + CANONICAL spec status

**Files:**
- Modify: `docs/design/sitemap/web/00-CANONICAL.md` (mark SM-1 as shipped in §12)

- [ ] **Step 1: Edit §12 migration table**

Add a "Status" column to the migration table, or amend the SM-1 row inline. In `docs/design/sitemap/web/00-CANONICAL.md`, change the SM-1 row from:

```markdown
| **SM-1** | Sidebar config rewrite — 11-flat structure, drop groups, drop isDark branching | M (4h) | `sidebar-config.ts`, `SidebarGroup.tsx`, `DashboardShell.tsx` |
```

to:

```markdown
| **SM-1** ✅ | Sidebar config rewrite — 11-flat structure, drop groups, drop isDark branching | M (4h) | `sidebar-config.ts`, `SidebarGroup.tsx`, `DashboardShell.tsx`, `NavItem.tsx` |
```

(NavItem.tsx added to the touch list; ✅ marker shows shipped status.)

- [ ] **Step 2: Commit**

```bash
git add docs/design/sitemap/web/00-CANONICAL.md
git commit -m "$(cat <<'EOF'
docs(sitemap): mark SM-1 shipped in canonical spec

Sidebar 11-flat + isDark drop landed. NavItem.tsx added to migration
table touch-list (it was not initially listed).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Verification Summary

Before declaring SM-1 shipped:

- [ ] `pnpm --filter @smartout/e2e playwright test sidebar-11-flat.spec.ts` passes 4/4
- [ ] `pnpm turbo typecheck --filter='@smartout/web'` passes 0 errors
- [ ] `pnpm turbo lint --filter='@smartout/web'` passes 0 errors
- [ ] Visual smoke in browser confirms 11 items, no group headers, 240px width, theme parity
- [ ] All commits on `campaign/ui-shell` (current branch), no force-pushes, no `--no-verify`
- [ ] Decision log entry NOT required (this is implementation of an already-accepted spec; the spec's §12 row update is sufficient)

Expected commit count for the sortie: 7–9 commits.

---

## Out of Scope (Defer to Later Sorties)

- Building `/dashboard/tasks` page (SM-2 task hub).
- Building `/dashboard/planning` page (SM-3 planning hub).
- Building `/dashboard/chat` page (SM-5 chat / komm split).
- Active-section accent rail on group headers — there are no group headers in the 11-flat layout, so the audit P0 #2 from `SIDEBAR-UX-AUDIT.md` does not apply here.
- Nested sub-route rendering inside the sidebar (audit P0 #3). This was a 9-grouped-sidebar improvement; it becomes obsolete with the 11-flat layout because each top-level item now corresponds to one cascade dimension and sub-routes surface as tabs INSIDE the destination page, not inside the sidebar.
- Codemod of `<TabsList>` callsites — that is SM-7's job, runnable in parallel.

---

## Rollback

Single revert handles full sortie undo:

```bash
git log --oneline --all | grep -E "(sidebar|navitem)" | head -10
# Identify the first SM-1 commit (Task 2 i18n) and the last (Task 11 docs).
git revert <first_sha>..<last_sha>
```

All changes are reversible. No database state, no route deletions, no schema migrations.
