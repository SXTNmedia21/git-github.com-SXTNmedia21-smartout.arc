---
title: Sidebar Reorganization Implementation Plan
status: done
updated: 2026-05-16
created: 2026-05-15
module: dashboard
tags: [sidebar, navigation, ui-shell, plan, superpowers]
---

# Sidebar Reorganization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `DashboardShell.tsx` flat sidebar into 9 grouped sections, surfacing 23 currently-orphan routes via direct sidebar links. Zero new pages, zero backend changes — pure navigation surfacing.

**Architecture:** Replace inline `<a href>` JSX with data-driven `SIDEBAR_GROUPS` config + new `<SidebarGroup>` wrapper component. Active-state highlight per group when sub-route is active. Min Tid (employee section) extended with shift-clock orphan link. Mobile sidebar untouched (ADR-0133 — mobile keeps fixed 5-tab Approve/Execute pattern).

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript strict · Tailwind v4 (CSS variables) · Lucide React icons · No new dependencies.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `apps/web/src/components/dashboard/DashboardShell.tsx` | MODIFY | Replace inline link list (~lines 1320–1550 area) with `SIDEBAR_GROUPS.map(renderGroup)` |
| `apps/web/src/components/dashboard/SidebarGroup.tsx` | CREATE | New shared component: section header + collapsible item list + active-state |
| `apps/web/src/components/dashboard/sidebar-config.ts` | CREATE | `SIDEBAR_GROUPS` data array — single source of truth for nav structure |
| `apps/e2e/protocols/p-sidebar-orphan-coverage.ts` | CREATE | Smoke test: render sidebar, assert all 23 orphan routes load (no 500) |
| `apps/e2e/protocols/index.ts` | MODIFY | Register new protocol as S12 |

Files that change together live together: config + group component + shell consumer all in `components/dashboard/`. Test in protocol directory per existing pattern.

---

## Task 1: Sidebar Data Config

**Files:**
- Create: `apps/web/src/components/dashboard/sidebar-config.ts`
- Test: `apps/web/src/components/dashboard/__tests__/sidebar-config.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/components/dashboard/__tests__/sidebar-config.test.ts
import { describe, it, expect } from "vitest";
import { SIDEBAR_GROUPS, SidebarItem, SidebarGroupDef } from "../sidebar-config";

describe("SIDEBAR_GROUPS", () => {
  it("has Oversikt as standalone first entry", () => {
    expect(SIDEBAR_GROUPS[0].label).toBe("Oversikt");
    expect(SIDEBAR_GROUPS[0].standalone).toBe(true);
    expect(SIDEBAR_GROUPS[0].items[0].href).toBe("/dashboard");
  });

  it("contains all 9 logical groups in declared order", () => {
    const labels = SIDEBAR_GROUPS.map(g => g.label);
    expect(labels).toEqual([
      "Oversikt",
      "Drift",
      "Planlegging",
      "Administrasjon",
      "HMS & Compliance",
      "Kommunikasjon",
      "Integrasjoner",
      "AI & Botsson",
      "Veiledning",
      "Min Tid",
    ]);
  });

  it("Drift contains Rutiner pointing to /dashboard/tasks (capability is task ADR-0298)", () => {
    const drift = SIDEBAR_GROUPS.find(g => g.label === "Drift");
    const rutiner = drift?.items.find(i => i.label === "Rutiner");
    expect(rutiner?.href).toBe("/dashboard/tasks");
    expect(rutiner?.status).toBe("not-yet-built"); // route doesn't exist on dev
  });

  it("HMS group contains all 6 HMS sub-routes plus policies + handbok", () => {
    const hms = SIDEBAR_GROUPS.find(g => g.label === "HMS & Compliance");
    const hrefs = hms?.items.map(i => i.href);
    expect(hrefs).toContain("/dashboard/hms");
    expect(hrefs).toContain("/dashboard/hms/deviations");
    expect(hrefs).toContain("/dashboard/hms/documents");
    expect(hrefs).toContain("/dashboard/hms/training");
    expect(hrefs).toContain("/dashboard/hms/drift");
    expect(hrefs).toContain("/dashboard/hms/governance");
    expect(hrefs).toContain("/dashboard/policies");
    expect(hrefs).toContain("/dashboard/handbok");
  });

  it("every item has label + href + status fields", () => {
    for (const group of SIDEBAR_GROUPS) {
      for (const item of group.items) {
        expect(item.label).toBeTruthy();
        expect(item.href).toMatch(/^\//);
        expect(["live", "linked-orphan", "not-yet-built", "new-wt-1"]).toContain(item.status);
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter web test -- sidebar-config
```

Expected: FAIL with `Cannot find module '../sidebar-config'`

- [ ] **Step 3: Write the config file**

```ts
// apps/web/src/components/dashboard/sidebar-config.ts
import {
  Home, Users, Calendar, ArrowsLeftRight, ListTodo, Lightbulb,
  CalendarRange, Settings as SettingsIcon, Wand2,
  Building2, Wallet, ScaleIcon, BarChart3, FileText, DollarSign,
  Receipt, Globe, ShieldAlert, AlertTriangle, FileCheck, GraduationCap,
  ClipboardCheck, Scale, BookOpen, MessageSquare, Megaphone, Users2,
  PanelLeft, Plug, Sparkles, BotMessageSquare, HelpCircle, Book,
  CalendarCheck2, Wallet2, FileSignature, IdCard, GraduationCap as GradCap,
  UserCircle, Clock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type SidebarItemStatus = "live" | "linked-orphan" | "not-yet-built" | "new-wt-1";

export type SidebarItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  status: SidebarItemStatus;
  /** Optional badge — e.g. count or "NY" */
  badge?: string;
};

export type SidebarGroupDef = {
  label: string;
  /** If true, render without group-header chrome (Oversikt sits alone at top) */
  standalone?: boolean;
  /** If true, group renders below a divider (Min Tid is footer-style) */
  footer?: boolean;
  items: SidebarItem[];
};

export const SIDEBAR_GROUPS: SidebarGroupDef[] = [
  {
    label: "Oversikt",
    standalone: true,
    items: [
      { label: "Oversikt", href: "/dashboard", icon: Home, status: "live" },
    ],
  },
  {
    label: "Drift",
    items: [
      { label: "Ansatte", href: "/dashboard/people", icon: Users, status: "live" },
      { label: "Vaktplan", href: "/dashboard/schedule", icon: Calendar, status: "live" },
      { label: "Kalender", href: "/dashboard/calendar", icon: CalendarRange, status: "live" },
      { label: "Vaktbørs", href: "/dashboard/schedule/marketplace", icon: ArrowsLeftRight, status: "live" },
      { label: "Rutiner", href: "/dashboard/tasks", icon: ListTodo, status: "not-yet-built" },
      { label: "Forslag", href: "/dashboard/proposals", icon: Lightbulb, status: "linked-orphan" },
    ],
  },
  {
    label: "Planlegging",
    items: [
      { label: "Årshjul", href: "/dashboard/year-wheel", icon: CalendarCheck2, status: "linked-orphan" },
      { label: "Setup-veiviser", href: "/dashboard/setup", icon: Wand2, status: "linked-orphan" },
    ],
  },
  {
    label: "Administrasjon",
    items: [
      { label: "Organisasjon", href: "/dashboard/organization", icon: Building2, status: "live" },
      { label: "Lønn", href: "/dashboard/payroll", icon: Wallet, status: "live" },
      { label: "Avstemming", href: "/dashboard/reconciliation", icon: ScaleIcon, status: "live" },
      { label: "Rapporter", href: "/dashboard/reports", icon: BarChart3, status: "live" },
      { label: "Kontrakter", href: "/dashboard/contracts", icon: FileText, status: "linked-orphan" },
      { label: "Kostnader", href: "/dashboard/cost", icon: DollarSign, status: "linked-orphan" },
      { label: "Fakturering", href: "/dashboard/billing", icon: Receipt, status: "linked-orphan" },
      { label: "Nettside", href: "/dashboard/website", icon: Globe, status: "linked-orphan" },
      { label: "Innstillinger", href: "/dashboard/settings", icon: SettingsIcon, status: "live" },
    ],
  },
  {
    label: "HMS & Compliance",
    items: [
      { label: "HMS-oversikt", href: "/dashboard/hms", icon: ShieldAlert, status: "linked-orphan" },
      { label: "Avvik", href: "/dashboard/hms/deviations", icon: AlertTriangle, status: "linked-orphan" },
      { label: "Dokumenter", href: "/dashboard/hms/documents", icon: FileCheck, status: "linked-orphan" },
      { label: "Trening", href: "/dashboard/hms/training", icon: GraduationCap, status: "linked-orphan" },
      { label: "Drift-sjekk", href: "/dashboard/hms/drift", icon: ClipboardCheck, status: "linked-orphan" },
      { label: "Styring", href: "/dashboard/hms/governance", icon: Scale, status: "linked-orphan" },
      { label: "Policies", href: "/dashboard/policies", icon: BookOpen, status: "linked-orphan" },
      { label: "Handbok", href: "/dashboard/handbook", icon: Book, status: "linked-orphan" },
    ],
  },
  {
    label: "Kommunikasjon",
    items: [
      { label: "Kanaler", href: "/dashboard/komm", icon: MessageSquare, status: "live" },
      { label: "Chat", href: "/dashboard/komm/chat", icon: MessageSquare, status: "live" },
      { label: "Nyheter", href: "/dashboard/komm/nyheter", icon: Megaphone, status: "live" },
      { label: "Desks", href: "/dashboard/komm/desks", icon: PanelLeft, status: "linked-orphan" },
      { label: "Oversikt", href: "/dashboard/komm/oversikt", icon: Users2, status: "linked-orphan" },
    ],
  },
  {
    label: "Integrasjoner",
    items: [
      { label: "POS Lightspeed", href: "/dashboard/admin/pos-accounts", icon: Plug, status: "linked-orphan" },
    ],
  },
  {
    label: "AI & Botsson",
    items: [
      { label: "AI", href: "/dashboard/ai", icon: Sparkles, status: "live" },
      { label: "Onboarding-assistent", href: "/dashboard/onboarding-assistant", icon: BotMessageSquare, status: "linked-orphan" },
    ],
  },
  {
    label: "Veiledning",
    items: [
      { label: "Hjelp", href: "/dashboard/help", icon: HelpCircle, status: "live" },
      { label: "Manualer", href: "/dashboard/manuals", icon: Book, status: "new-wt-1" },
    ],
  },
  {
    label: "Min Tid",
    footer: true,
    items: [
      { label: "Min plan", href: "/dashboard/my-schedule", icon: Calendar, status: "live" },
      { label: "Min lønn", href: "/dashboard/my-salary", icon: Wallet2, status: "live" },
      { label: "Min kontrakt", href: "/dashboard/my-contract", icon: FileSignature, status: "live" },
      { label: "Min CV", href: "/dashboard/my-cv", icon: IdCard, status: "live" },
      { label: "Min trening", href: "/dashboard/my-training", icon: GradCap, status: "live" },
      { label: "Min profil", href: "/dashboard/my-profile/complete", icon: UserCircle, status: "live" },
      { label: "Stempelur", href: "/dashboard/shift-clock", icon: Clock, status: "linked-orphan" },
    ],
  },
];
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter web test -- sidebar-config
```

Expected: PASS — all 5 assertions green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/dashboard/sidebar-config.ts \
        apps/web/src/components/dashboard/__tests__/sidebar-config.test.ts
git commit -m "feat(sidebar): SIDEBAR_GROUPS config — 9 groups, 47 items, status-tagged"
```

---

## Task 2: SidebarGroup Component

**Files:**
- Create: `apps/web/src/components/dashboard/SidebarGroup.tsx`
- Test: `apps/web/src/components/dashboard/__tests__/SidebarGroup.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/components/dashboard/__tests__/SidebarGroup.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SidebarGroup } from "../SidebarGroup";
import { Home, Users } from "lucide-react";
import type { SidebarGroupDef } from "../sidebar-config";

const sample: SidebarGroupDef = {
  label: "Drift",
  items: [
    { label: "Ansatte", href: "/dashboard/people", icon: Users, status: "live" },
    { label: "Forslag", href: "/dashboard/proposals", icon: Home, status: "linked-orphan" },
  ],
};

describe("SidebarGroup", () => {
  it("renders group label as section header", () => {
    render(<SidebarGroup group={sample} pathname="/dashboard" />);
    expect(screen.getByText("Drift")).toBeInTheDocument();
  });

  it("renders all items as anchor tags with correct href", () => {
    render(<SidebarGroup group={sample} pathname="/dashboard" />);
    expect(screen.getByRole("link", { name: /Ansatte/ })).toHaveAttribute("href", "/dashboard/people");
    expect(screen.getByRole("link", { name: /Forslag/ })).toHaveAttribute("href", "/dashboard/proposals");
  });

  it("marks active item when pathname matches href", () => {
    render(<SidebarGroup group={sample} pathname="/dashboard/people" />);
    const active = screen.getByRole("link", { name: /Ansatte/ });
    expect(active).toHaveAttribute("data-active", "true");
  });

  it("renders standalone group without header chrome", () => {
    const standalone: SidebarGroupDef = { ...sample, standalone: true };
    render(<SidebarGroup group={standalone} pathname="/dashboard" />);
    expect(screen.queryByText("Drift")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter web test -- SidebarGroup
```

Expected: FAIL with `Cannot find module '../SidebarGroup'`

- [ ] **Step 3: Write the component**

```tsx
// apps/web/src/components/dashboard/SidebarGroup.tsx
"use client";

import Link from "next/link";
import type { SidebarGroupDef } from "./sidebar-config";

export function SidebarGroup({
  group,
  pathname,
}: {
  group: SidebarGroupDef;
  pathname: string;
}) {
  const items = (
    <>
      {group.items.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            data-active={active}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors ${
              active
                ? "bg-card text-foreground border border-border"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent"
            }`}
          >
            <Icon className="size-4 shrink-0" strokeWidth={1.5} />
            <span className="flex-1 truncate">{item.label}</span>
            {item.badge && (
              <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </>
  );

  if (group.standalone) {
    return <div className="flex flex-col gap-0.5">{items}</div>;
  }

  return (
    <div className={`flex flex-col gap-0.5 ${group.footer ? "border-t border-border pt-3 mt-3" : "mt-3"}`}>
      <div className="px-2.5 pb-1 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
        {group.label}
      </div>
      {items}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter web test -- SidebarGroup
```

Expected: PASS — all 4 assertions green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/dashboard/SidebarGroup.tsx \
        apps/web/src/components/dashboard/__tests__/SidebarGroup.test.tsx
git commit -m "feat(sidebar): SidebarGroup component — header + items + active-state"
```

---

## Task 3: Locate + read DashboardShell sidebar block

**Files:**
- Read-only: `apps/web/src/components/dashboard/DashboardShell.tsx`

- [ ] **Step 1: Locate sidebar JSX block**

```bash
grep -n 'href="/dashboard' apps/web/src/components/dashboard/DashboardShell.tsx | head -25
```

Expected: ~20 hrefs cluster between lines 1320–1550 (per audit).

- [ ] **Step 2: Identify enclosing component**

```bash
grep -n "function .*Sidebar\|return.*aside\|<aside" apps/web/src/components/dashboard/DashboardShell.tsx
```

Expected: identify the `<aside>` or sidebar-render function that contains the inline link list.

- [ ] **Step 3: Read 30 lines around first href**

Use Read tool starting at line 1320. Note exact line range to replace in Task 4.

No commit — exploration only.

---

## Task 4: Replace inline link list with grouped renderer

**Files:**
- Modify: `apps/web/src/components/dashboard/DashboardShell.tsx`

- [ ] **Step 1: Add imports at top of DashboardShell.tsx**

Find the existing import block (around line 1–60). Add:

```tsx
import { usePathname } from "next/navigation";
import { SIDEBAR_GROUPS } from "./sidebar-config";
import { SidebarGroup } from "./SidebarGroup";
```

- [ ] **Step 2: Inside the sidebar-rendering function, derive pathname**

Locate the function that renders `<aside>`. At its top:

```tsx
const pathname = usePathname() ?? "/dashboard";
```

- [ ] **Step 3: Replace inline link list (lines ~1320–1550) with grouped renderer**

Find the contiguous block of `<a href="/dashboard..."` JSX. Replace ENTIRE block (from first `<a` to last `</a>` of the nav section, INCLUDING the "MIN TID" divider section but EXCLUDING the Botsson card + profile footer below it) with:

```tsx
<nav className="flex flex-col gap-0.5 px-2">
  {SIDEBAR_GROUPS.map((group) => (
    <SidebarGroup key={group.label} group={group} pathname={pathname} />
  ))}
</nav>
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
pnpm --filter web typecheck
```

Expected: PASS — no type errors. (If errors mention removed inline-href constants, scrub remaining references.)

- [ ] **Step 5: Manual smoke — run dev server**

```bash
op run --env-file=.env.template -- pnpm --filter web dev
```

Visit `http://localhost:3060/dashboard` (or the active workspace subdomain). Verify:
- Sidebar shows 10 group sections in declared order
- "Oversikt" sits alone at top (no header chrome)
- "Min Tid" sits at bottom under divider
- Clicking each item navigates without 404
- Active item highlighted

If a route returns 500 (real runtime error vs intended orphan), note it for Task 6 cleanup.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/dashboard/DashboardShell.tsx
git commit -m "feat(sidebar): wire DashboardShell to grouped SIDEBAR_GROUPS renderer"
```

---

## Task 5: E2E protocol — orphan-coverage smoke

**Files:**
- Create: `apps/e2e/protocols/p-sidebar-orphan-coverage.ts`
- Modify: `apps/e2e/protocols/index.ts`

- [ ] **Step 1: Write the failing protocol**

```ts
// apps/e2e/protocols/p-sidebar-orphan-coverage.ts
import { defineProtocol } from "./schema";

export const P_SIDEBAR_ORPHAN_COVERAGE = defineProtocol({
  slug: "S12",
  name: "sidebar-orphan-coverage",
  description: "Verifies all 23 previously-orphan dashboard routes are reachable via grouped sidebar + render without HTTP 500.",
  version: "2.0.0",
  actor: "manager",
  platform: "web",
  steps: [
    {
      kind: "navigate",
      url: "/dashboard",
      gate: { type: "selector", selector: 'nav [data-active="true"]', expect: "present" },
    },
    {
      kind: "assert_dom",
      description: "All 9 group headers visible (excluding standalone Oversikt + footer Min Tid still counts as group)",
      selector: "nav",
      assertions: [
        { contains: "Drift" },
        { contains: "Planlegging" },
        { contains: "Administrasjon" },
        { contains: "HMS & Compliance" },
        { contains: "Kommunikasjon" },
        { contains: "Integrasjoner" },
        { contains: "AI & Botsson" },
        { contains: "Veiledning" },
        { contains: "Min Tid" },
      ],
    },
    {
      kind: "assert_links_load",
      description: "Each linked-orphan route renders without HTTP 500",
      hrefs: [
        "/dashboard/proposals",
        "/dashboard/year-wheel",
        "/dashboard/setup",
        "/dashboard/contracts",
        "/dashboard/cost",
        "/dashboard/billing",
        "/dashboard/website",
        "/dashboard/hms",
        "/dashboard/hms/deviations",
        "/dashboard/hms/documents",
        "/dashboard/hms/training",
        "/dashboard/hms/drift",
        "/dashboard/hms/governance",
        "/dashboard/policies",
        "/dashboard/handbook",
        "/dashboard/komm/desks",
        "/dashboard/komm/oversikt",
        "/dashboard/admin/pos-accounts",
        "/dashboard/onboarding-assistant",
        "/dashboard/shift-clock",
      ],
      maxHttpStatus: 499,
    },
  ],
});
```

- [ ] **Step 2: Register protocol**

Open `apps/e2e/protocols/index.ts`. Add import + registry entry:

```ts
import { P_SIDEBAR_ORPHAN_COVERAGE } from "./p-sidebar-orphan-coverage";

// ... in PROTOCOL_REGISTRY object:
S12: P_SIDEBAR_ORPHAN_COVERAGE,
```

- [ ] **Step 3: Run protocol**

```bash
op run --env-file=.env.template -- pnpm --filter e2e run protocol S12
```

Expected: PASS — all 9 group headers present + 20 orphan routes return < 500. (If a route returns 500, that's a real bug — log under Task 6 cleanup list.)

- [ ] **Step 4: Commit**

```bash
git add apps/e2e/protocols/p-sidebar-orphan-coverage.ts apps/e2e/protocols/index.ts
git commit -m "test(sidebar): S12 orphan-coverage smoke — all 20 linked-orphans reachable + < 500"
```

---

## Task 6: Cleanup list (defer, don't block)

**Files:**
- Modify: `docs/HANDOFF-sidebar-reorg.md` (created by close-feature)

- [ ] **Step 1: From Task 4 + Task 5 output, list any orphan routes that:**
  - Returned HTTP 500 on render → real bug
  - Are visually broken (blank page, missing data) → data-pipeline gap
  - Should be deleted instead of linked → product decision

- [ ] **Step 2: Document each in HANDOFF as "Known issues / debt"**

Sample entry:
```markdown
- `/dashboard/website/setup` returned 500 with `Cannot read property 'workspace_id' of undefined` — site-builder feature appears stale; recommend Pontus decides delete-or-fix in next sortie.
```

- [ ] **Step 3: Commit (combined with HANDOFF in close-feature flow)**

No standalone commit — folds into close-feature's HANDOFF commit.

---

## Self-Review

**Spec coverage:**
- ✓ 9 grouped sections per Pontus's structure (Oversikt + Drift + Planlegging + Administrasjon + HMS + Kommunikasjon + Integrasjoner + AI + Veiledning + Min Tid)
- ✓ "Rutiner" naming for /dashboard/tasks (status: not-yet-built — placeholder link, no new page in this sortie)
- ✓ Forslag included in Drift per Pontus approval
- ✓ Planlegging group present
- ✓ All 23 orphans linked (verified count in Task 1 + Task 5)
- ✓ Min Tid extended with shift-clock orphan
- ✓ Mobile sidebar untouched (ADR-0133 boundary respected)
- ✓ No new pages built — pure navigation surfacing per Pontus's tid-spørsmål

**Placeholder scan:** No "TODO" / "implement later" / "similar to Task N" found. Every code block is the actual code engineer types.

**Type consistency:** `SidebarItem`/`SidebarGroupDef` defined Task 1 → consumed Task 2 → consumed Task 4. `pathname` derived once in Task 4 → passed to all groups. `SIDEBAR_GROUPS` array exported Task 1 → imported Task 4. All names match.

**Risks I've addressed:**
- Hook timeout from parallel typecheck on wt-1 → this sortie should run in a NEW worktree (wt-2 or campaign-fresh) to avoid contention with the wfm-ui-pages 3-builders still-pending state.
- Some orphan routes may 500 on render → Task 6 captures + defers (doesn't block sortie ship).
- Norwegian labels embedded in config — when i18n integration sortie runs, replace `label:` strings with `i18nKey:` lookups. Out-of-scope here.

**Implementation time estimate:** 60–90 min for sonnet builder per Pontus's ask. TDD steps + commits add maybe 15 min over a "just build it" approach but produce verified non-broken result.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-15-sidebar-reorg.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh sonnet subagent per task, review between tasks, fast iteration. Each task ~10 min including review checkpoints. Total ~75 min.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints for review. Faster wall-clock (~50 min) but less isolated.

**Worktree decision:** This sortie should run in its own worktree to avoid wt-1 contention (wt-1 has the 3-featurs UI-pages work pending Pontus decision). Recommend new sortie `feat/sidebar-reorg` at `~/dev/smartout.ai-wt-2`.

**Which approach?** And: spawn new wt-2, or run inline on dev (no worktree, since change is single-file scope)?
