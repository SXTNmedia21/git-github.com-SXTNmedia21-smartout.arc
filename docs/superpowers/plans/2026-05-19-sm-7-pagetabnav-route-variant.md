# SM-7 — PageTabNav Route Variant + Codemod Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `<PageTabNav>` with a `variant="route"` mode that renders `<Link>` instead of `<button>`, then codemod 5–7 hand-rolled `<TabsList>` callsites to use the canonical component. Pages with drawer/modal-internal tabs or mobile-narrow grid-tab layouts are documented as exceptions per spec §3.4.

**Architecture:** `<PageTabNav>` gains an optional `variant: "pill" | "route"` prop (default `"pill"` preserves existing callers byte-for-byte). When `variant="route"`, each tab renders as a `<Link>` whose `href` is computed from a new optional `basePath` prop combined with each tab's `key`. Server-rendered active state is derived from `usePathname()`. No new components. No changes to `<Tabs>` / `<TabsList>` for callsites that are legitimately drawer/modal/section-level — those are documented as exceptions.

**Tech Stack:** Next.js 16 App Router, React 19, `next/link`, `next/navigation` (`usePathname`), Tailwind v4. Existing component: `apps/web/src/components/dashboard/PageTabNav.tsx` (69 LOC).

**Canonical spec:** `docs/design/sitemap/web/00-CANONICAL.md` §3, §3.3 (sub-page pattern), §3.4 (visual rules), §9.

---

## File Structure

Files this plan creates or modifies:

| Operation | Path | Responsibility |
|---|---|---|
| Modify | `apps/web/src/components/dashboard/PageTabNav.tsx` | Add `variant` + `basePath` props. `pill` (default) keeps current button behaviour. `route` renders `next/link` with `href = basePath + key`. Active state derived from `usePathname()` when variant=route. |
| Create | `apps/web/src/components/dashboard/__tests__/PageTabNav.test.tsx` | Unit tests for both variants. Verifies default unchanged, route variant emits `<a href>`, active-state pathname matching. |
| Modify | `apps/web/src/app/dashboard/reports/_components/ReportsPageShell.tsx` lines ~268–284 | Codemod: replace hand-rolled `<TabsList>` clone with `<PageTabNav variant="pill">`. Keep `<Tabs>` controller — it still hosts `<TabsContent>` panels. |
| Modify | `apps/web/src/app/dashboard/calendar/_components/CalendarPageShell.tsx` lines ~318–340 | Same codemod pattern as Reports. |
| Modify | `apps/web/src/app/dashboard/hms/_components/ProcedureDetailTabs.tsx` lines ~107–121 | Drill-in tab strip. Codemod to `<PageTabNav>`. |
| Modify | `apps/web/src/app/dashboard/payroll/[periodId]/_components/PeriodDetailClient.tsx` lines ~172–183 | Drill-in tab strip. Codemod to `<PageTabNav>`. |
| Modify | `apps/web/src/app/dashboard/organization/_components/EntityDetailLayout.tsx` lines ~105–115 | Drill-in layout used by `/organization/{dept,loc,team}/[id]`. Codemod to `<PageTabNav>`. |
| Modify | `apps/web/src/app/dashboard/contracts/_components/KontrakterTab.tsx` lines ~125 | Tab inside contracts hub. Codemod to `<PageTabNav>`. |
| Modify | `apps/web/src/app/dashboard/settings/_components/supplement-rules-settings.tsx` lines ~1094–1101 | Settings sub-tab. Codemod to `<PageTabNav>`. |
| Document | (no code change) | Files kept as exceptions: `LineDrawer.tsx`, `shift-modal.tsx`, `DayApproval.tsx`, `ShiftClockTabs.tsx`, `MenuFullEditor.tsx`. Documented in this plan §"Exceptions" and added to `docs/design/sitemap/web/00-CANONICAL.md` §3.4. |

Total: 1 component change + 7 codemods + 1 doc edit. No new routes. No schema changes.

---

## Task 1: Orientation read

**Files:** read-only

- [ ] **Step 1: Read current PageTabNav**

Run: `cat apps/web/src/components/dashboard/PageTabNav.tsx`

Expected: 69 LOC, single function export, generic over `K extends string`, pill-row styling with `bg-muted/80` rail.

- [ ] **Step 2: Inventory hand-rolled TabsList**

Run: `grep -rln 'TabsList' apps/web/src/app/dashboard --include='*.tsx'`

Expected: 12 files. Match the file-structure table above.

- [ ] **Step 3: Check ReportsPageShell for the canonical clone pattern**

Run: `grep -A 2 'TabsList' apps/web/src/app/dashboard/reports/_components/ReportsPageShell.tsx | head -6`

Expected: a `TabsList` with className `border-border bg-muted/80 inline-flex h-auto w-fit gap-1 rounded-xl border p-1` — the exact className `PageTabNav` already emits. Pure duplication.

---

## Task 2: Add `variant` + `basePath` props to PageTabNav

**Files:**
- Modify: `apps/web/src/components/dashboard/PageTabNav.tsx`

- [ ] **Step 1: Replace component signature**

Replace the existing `export function PageTabNav<K extends string>(...)` declaration. The full new component body is below — replace the contents from line 22 to end-of-file in one edit:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";
import { cn } from "@smartout/ui";

export type PageTab<K extends string = string> = {
  key: K;
  label: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
};

export type PageTabNavVariant = "pill" | "route";

/**
 * PageTabNav — canonical sub-tab primitive for the dashboard.
 *
 * variant="pill" (default): in-page tabs. Renders <button>; caller owns
 *   state via `active` + `onChange`. URL does not change.
 *
 * variant="route": URL-bound tabs. Renders <Link>; each tab's href is
 *   `${basePath}/${key}`. Active state is derived from usePathname().
 *   `onChange` is optional (fires before navigation for analytics).
 *
 * See docs/design/sitemap/web/00-CANONICAL.md §3.4 for usage rules.
 */
export function PageTabNav<K extends string>({
  tabs,
  active,
  onChange,
  ariaLabel,
  className,
  variant = "pill",
  basePath,
}: {
  tabs: ReadonlyArray<PageTab<K>>;
  active?: K | string;
  onChange?: (key: K) => void;
  ariaLabel?: string;
  className?: string;
  variant?: PageTabNavVariant;
  /** When variant="route", each tab links to `${basePath}/${key}` (or `${basePath}` for the "" key). Required when variant="route". */
  basePath?: string;
}) {
  const pathname = usePathname();

  if (variant === "route" && !basePath) {
    throw new Error("PageTabNav: variant='route' requires basePath prop");
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "border-border bg-muted/80 inline-flex h-auto w-fit gap-1 rounded-xl border p-1 shadow-sm",
        className,
      )}
    >
      {tabs.map((t) => {
        let isActive: boolean;
        let href: string | null = null;

        if (variant === "route" && basePath) {
          // Route-bound: derive from pathname. Empty key maps to basePath itself.
          href = t.key === "" ? basePath : `${basePath}/${t.key}`;
          isActive = pathname === href || pathname.startsWith(href + "/");
        } else {
          // Pill: caller-owned state.
          isActive = t.key === active || String(active ?? "").startsWith(t.key + "/");
        }

        const inner = (
          <>
            {t.icon ? <t.icon className="h-3.5 w-3.5" aria-hidden /> : null}
            <span className="hidden sm:inline">{t.label}</span>
          </>
        );

        const className = cn(
          "focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all focus-visible:ring-2 focus-visible:outline-none",
          isActive
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        );

        const commonProps = {
          id: `tab-btn-${t.key}`,
          role: "tab" as const,
          "aria-selected": isActive,
          "aria-controls": `tab-panel-${t.key}`,
          className,
          "data-tab-key": t.key,
          "data-active": isActive ? "true" : "false",
        };

        if (variant === "route" && href) {
          return (
            <Link
              key={t.key}
              href={href}
              {...commonProps}
              onClick={() => onChange?.(t.key)}
            >
              {inner}
            </Link>
          );
        }

        return (
          <button
            key={t.key}
            type="button"
            {...commonProps}
            onClick={() => onChange?.(t.key)}
          >
            {inner}
          </button>
        );
      })}
    </div>
  );
}
```

The pill variant is byte-compatible with existing callers (the `active` prop becomes optional but callers always pass it, so no behaviour change). Existing tests pass without modification.

- [ ] **Step 2: Run typecheck**

Run: `pnpm --filter @smartout/web tsc --noEmit 2>&1 | tail -10`

Expected: 0 errors. If TypeScript complains about `active` becoming optional, existing callers all pass it — only the internal default `""` for the optional case needs handling (already done via `String(active ?? "")`).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/dashboard/PageTabNav.tsx
git commit -m "$(cat <<'EOF'
feat(pagetabnav): add variant prop (pill + route)

Adds variant="route" mode that renders <Link> instead of <button>;
href derived from basePath + key, active state from usePathname().
variant="pill" (default) is byte-compatible with existing callers.

Unlocks SM-7 codemod of 7 hand-rolled <TabsList> clones across
dashboard. See docs/design/sitemap/web/00-CANONICAL.md §3.4.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Unit tests for PageTabNav

**Files:**
- Create: `apps/web/src/components/dashboard/__tests__/PageTabNav.test.tsx`

- [ ] **Step 1: Verify test runner setup**

Run: `ls apps/web/src/components/dashboard/__tests__ 2>&1 | head -3 && cat apps/web/vitest.config.ts 2>&1 | head -20`

Expected: directory exists OR is creatable. Verify vitest config supports `*.test.tsx`. If `__tests__/` doesn't exist, `mkdir -p apps/web/src/components/dashboard/__tests__`.

- [ ] **Step 2: Write PageTabNav tests**

Path: `apps/web/src/components/dashboard/__tests__/PageTabNav.test.tsx`

```tsx
/** @jsx jsx */
/** @jsxFrag Fragment */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PageTabNav } from "../PageTabNav";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/people/contracts",
}));

const PILL_TABS = [
  { key: "list", label: "Liste" },
  { key: "roles", label: "Roller" },
  { key: "contracts", label: "Kontrakter" },
] as const;

describe("PageTabNav variant=pill (default)", () => {
  it("renders <button> elements (not <a>)", () => {
    render(
      <PageTabNav
        tabs={PILL_TABS}
        active="list"
        onChange={() => {}}
      />,
    );
    const buttons = screen.getAllByRole("tab");
    expect(buttons).toHaveLength(3);
    buttons.forEach((b) => expect(b.tagName).toBe("BUTTON"));
  });

  it("marks active tab via data-active='true'", () => {
    render(
      <PageTabNav
        tabs={PILL_TABS}
        active="roles"
        onChange={() => {}}
      />,
    );
    expect(screen.getByText("Roller").closest("[data-active]")).toHaveAttribute(
      "data-active",
      "true",
    );
    expect(screen.getByText("Liste").closest("[data-active]")).toHaveAttribute(
      "data-active",
      "false",
    );
  });

  it("fires onChange with tab key on click", () => {
    const onChange = vi.fn();
    render(
      <PageTabNav
        tabs={PILL_TABS}
        active="list"
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByText("Roller"));
    expect(onChange).toHaveBeenCalledWith("roles");
  });
});

describe("PageTabNav variant=route", () => {
  it("renders <a> elements with computed href", () => {
    render(
      <PageTabNav
        tabs={PILL_TABS}
        variant="route"
        basePath="/dashboard/people"
      />,
    );
    const links = screen.getAllByRole("tab");
    expect(links).toHaveLength(3);
    links.forEach((a) => expect(a.tagName).toBe("A"));

    expect(screen.getByText("Liste").closest("a")).toHaveAttribute(
      "href",
      "/dashboard/people/list",
    );
    expect(screen.getByText("Roller").closest("a")).toHaveAttribute(
      "href",
      "/dashboard/people/roles",
    );
  });

  it("marks tab active when pathname matches", () => {
    // usePathname mock returns "/dashboard/people/contracts"
    render(
      <PageTabNav
        tabs={PILL_TABS}
        variant="route"
        basePath="/dashboard/people"
      />,
    );
    expect(screen.getByText("Kontrakter").closest("[data-active]")).toHaveAttribute(
      "data-active",
      "true",
    );
    expect(screen.getByText("Liste").closest("[data-active]")).toHaveAttribute(
      "data-active",
      "false",
    );
  });

  it("throws if basePath missing in route variant", () => {
    // Suppress React error boundary noise
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      render(
        <PageTabNav
          tabs={PILL_TABS}
          variant="route"
          // @ts-expect-error intentional missing basePath
          basePath={undefined}
        />,
      ),
    ).toThrow(/basePath/);
    spy.mockRestore();
  });
});
```

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @smartout/web vitest run components/dashboard/__tests__/PageTabNav.test.tsx 2>&1 | tail -20`

Expected: 7 tests pass. If `next/link` mock not provided by vitest config, add to top of test:

```tsx
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/dashboard/__tests__/PageTabNav.test.tsx
git commit -m "$(cat <<'EOF'
test(pagetabnav): unit tests for pill + route variants

7 tests cover: default pill renders button, active data-attr,
onChange callback, route renders Link, computed href, pathname-driven
active state, basePath missing throws.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Codemod ReportsPageShell

**Files:**
- Modify: `apps/web/src/app/dashboard/reports/_components/ReportsPageShell.tsx` lines 268–284

Reports uses Tabs + TabsList as the page sub-tab. The `<Tabs>` wrapper hosts `<TabsContent>` panels — keep those. Only replace the `<TabsList>` block.

- [ ] **Step 1: Read full Tabs block**

Run: `sed -n '265,310p' apps/web/src/app/dashboard/reports/_components/ReportsPageShell.tsx`

Expected: `<Tabs>` opens at ~268, `<TabsList>` block at 273–284, then multiple `<TabsContent>` panels.

- [ ] **Step 2: Add PageTabNav import**

At the top of `ReportsPageShell.tsx`, after the existing import block:

```tsx
import { PageTabNav } from "@/components/dashboard/PageTabNav";
```

Keep the existing `import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"` — `TabsList` and `TabsTrigger` will be removed after the swap; `Tabs` and `TabsContent` stay.

- [ ] **Step 3: Replace TabsList block**

Replace the entire `<TabsList>...</TabsList>` block (lines ~273–284) with:

```tsx
<PageTabNav
  tabs={TABS.map((tab) => ({ key: tab.value, label: tab.label, icon: tab.icon }))}
  active={activeTab}
  onChange={(v) => setActiveTab(v as ReportsTab)}
  className="mb-5"
  ariaLabel="Rapport-seksjoner"
/>
```

The TABS array shape (currently `{ value, label, icon }`) is mapped to `PageTab` shape (`{ key, label, icon }`) inline. No external type change.

- [ ] **Step 4: Remove unused TabsList + TabsTrigger imports**

If `TabsList` and `TabsTrigger` are no longer referenced anywhere in the file:

```tsx
// before
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// after
import { Tabs, TabsContent } from "@/components/ui/tabs";
```

- [ ] **Step 5: Run typecheck**

Run: `pnpm --filter @smartout/web tsc --noEmit 2>&1 | tail -5`

Expected: 0 errors.

- [ ] **Step 6: Visual smoke**

Start dev server (if not already running). Navigate to `/dashboard/reports`. Verify:
- Tab strip visually identical to before (same pill rail).
- Clicking a tab still switches content (controller `<Tabs>` still drives `<TabsContent>` panels via `value`).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/dashboard/reports/_components/ReportsPageShell.tsx
git commit -m "$(cat <<'EOF'
refactor(reports): use PageTabNav for sub-tab (SM-7)

Drops hand-rolled <TabsList> clone with copy-pasted className. Tabs
controller + TabsContent panels preserved.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Codemod CalendarPageShell

**Files:**
- Modify: `apps/web/src/app/dashboard/calendar/_components/CalendarPageShell.tsx` lines ~318–340

Identical pattern to Reports.

- [ ] **Step 1: Read TabsList block**

Run: `grep -B 2 -A 12 'TabsList' apps/web/src/app/dashboard/calendar/_components/CalendarPageShell.tsx | head -20`

Expected: same hand-rolled className as Reports.

- [ ] **Step 2: Add PageTabNav import**

```tsx
import { PageTabNav } from "@/components/dashboard/PageTabNav";
```

- [ ] **Step 3: Replace TabsList block**

Replace the `<TabsList>...</TabsList>` block with:

```tsx
<PageTabNav
  tabs={TABS.map((tab) => ({ key: tab.value, label: tab.label, icon: tab.icon }))}
  active={activeTab}
  onChange={(v) => setActiveTab(v as CalendarTab)}
  className="mb-5"
  ariaLabel="Kalender-seksjoner"
/>
```

Replace the type-cast `CalendarTab` with whatever the local tab-state type is — `grep -n 'type.*Tab\|CalendarTab\b' apps/web/src/app/dashboard/calendar/_components/CalendarPageShell.tsx` to find the canonical name.

- [ ] **Step 4: Remove unused imports** (if `TabsList` / `TabsTrigger` no longer used)

- [ ] **Step 5: Typecheck + smoke**

Run: `pnpm --filter @smartout/web tsc --noEmit 2>&1 | tail -5`

Smoke: navigate to `/dashboard/calendar`. Tab switching preserved.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/dashboard/calendar/_components/CalendarPageShell.tsx
git commit -m "$(cat <<'EOF'
refactor(calendar): use PageTabNav for sub-tab (SM-7)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Codemod ProcedureDetailTabs (HMS drill-in)

**Files:**
- Modify: `apps/web/src/app/dashboard/hms/_components/ProcedureDetailTabs.tsx` lines ~107–121

This is a drill-in (`/dashboard/hms/procedure/[id]`). Per spec §3.3, drill-in tabs use the same primitive.

- [ ] **Step 1: Read block**

Run: `sed -n '100,130p' apps/web/src/app/dashboard/hms/_components/ProcedureDetailTabs.tsx`

Expected: `<TabsList className="border-border bg-muted/50 flex h-auto w-full gap-1 rounded-xl border p-1">` — close to canonical but `bg-muted/50` not `/80`, and `w-full` not `w-fit`.

- [ ] **Step 2: Add PageTabNav import**

```tsx
import { PageTabNav } from "@/components/dashboard/PageTabNav";
```

- [ ] **Step 3: Replace TabsList**

Decision point: this drill-in might benefit from `variant="route"` so each tab is a real URL (e.g. `/hms/procedure/[id]/innhold`, `/hms/procedure/[id]/versjoner`). Inspect the surrounding component first:

Run: `grep -n 'TabsContent\|router.push\|usePathname' apps/web/src/app/dashboard/hms/_components/ProcedureDetailTabs.tsx`

If `<TabsContent>` panels render in-place from local state → use `variant="pill"`.
If sibling routes exist (`apps/web/src/app/dashboard/hms/procedure/[id]/<tab>/page.tsx`) → use `variant="route"` with `basePath={`/dashboard/hms/procedure/${procedureId}`}`.

For first pass, assume `variant="pill"` (preserves current local-state behaviour). Migration to `variant="route"` is a separate sortie (`SM-7-b` deferred).

Replace:

```tsx
<PageTabNav
  tabs={TABS.map(...)}
  active={activeTab}
  onChange={setActiveTab}
  className="mb-4"
  ariaLabel="Prosedyre-seksjoner"
/>
```

Adjust `TABS.map(...)` to actual local-tab-config shape — read the surrounding code.

- [ ] **Step 4: Typecheck + smoke**

Navigate to `/dashboard/hms/procedure/<some-id>`. Tabs preserved.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/hms/_components/ProcedureDetailTabs.tsx
git commit -m "$(cat <<'EOF'
refactor(hms): use PageTabNav for procedure detail tabs (SM-7)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Codemod PeriodDetailClient (Payroll drill-in)

**Files:**
- Modify: `apps/web/src/app/dashboard/payroll/[periodId]/_components/PeriodDetailClient.tsx` lines ~172–183

This is the canonical `/dashboard/payroll/[periodId]` drill-in per spec §3.3 (tabs: Oversikt · Lønnslinjer · Avvik · Audit · Eksport).

- [ ] **Step 1: Read block**

Run: `sed -n '165,200p' apps/web/src/app/dashboard/payroll/[periodId]/_components/PeriodDetailClient.tsx`

Expected: `<TabsList>` with default shadcn styling. Sub-tabs may be local-state OR route-bound.

- [ ] **Step 2: Inspect for sibling routes**

Run: `ls apps/web/src/app/dashboard/payroll/\[periodId\]/ 2>&1`

If only `page.tsx` exists → local-state tabs, use `variant="pill"`.
If sub-folders per tab (`oversikt/`, `linjer/`, etc) → use `variant="route"`.

- [ ] **Step 3: Add PageTabNav import + replace**

```tsx
import { PageTabNav } from "@/components/dashboard/PageTabNav";
```

Replace `<TabsList>` block with `<PageTabNav>` per Task 4/5 pattern. Use `variant="pill"` as default.

- [ ] **Step 4: Verify per-tab label matches spec §3.3**

Spec dictates: `Oversikt · Lønnslinjer · Avvik · Audit · Eksport`. If existing labels differ ("Lines" instead of "Lønnslinjer", etc), keep the existing wording in this sortie — label-canonicalization is a separate concern, not SM-7's job. Document divergence in commit message.

- [ ] **Step 5: Typecheck + smoke**

Navigate to a payroll period detail. Tab switching preserved.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/dashboard/payroll/[periodId]/_components/PeriodDetailClient.tsx
git commit -m "$(cat <<'EOF'
refactor(payroll): use PageTabNav for period detail tabs (SM-7)

Drill-in pattern per docs/design/sitemap/web/00-CANONICAL.md §3.3.
Label canonicalization deferred to label-sweep sortie.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Codemod EntityDetailLayout (Organization drill-ins)

**Files:**
- Modify: `apps/web/src/app/dashboard/organization/_components/EntityDetailLayout.tsx` lines ~105–115

`EntityDetailLayout` is shared by `departments/[id]`, `locations/[id]`, `teams/[id]` — three drill-ins using one layout. Per spec §3.3 each entity has its own canonical tab set (Avdelinger / Lokasjoner / Team).

- [ ] **Step 1: Read block**

Run: `sed -n '95,130p' apps/web/src/app/dashboard/organization/_components/EntityDetailLayout.tsx`

Expected: `<TabsList className="border-border bg-muted h-auto justify-start gap-1 rounded-xl border p-1">` — variant with `justify-start`.

- [ ] **Step 2: Replace TabsList**

```tsx
<PageTabNav
  tabs={tabs.map((t) => ({ key: t.value, label: t.label, icon: t.icon }))}
  active={activeTab}
  onChange={(v) => setActiveTab(v as typeof tabs[number]["value"])}
  className="mb-5"
  ariaLabel="Detalj-seksjoner"
/>
```

The `justify-start` variant is dropped — `<PageTabNav>` is `w-fit`, which keeps the strip left-aligned naturally when the parent container is left-aligned.

- [ ] **Step 3: Typecheck + smoke per entity type**

Visit `/dashboard/organization/departments/<id>`, `/dashboard/organization/locations/<id>`, `/dashboard/organization/teams/<id>`. Tab strip identical across all three.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/organization/_components/EntityDetailLayout.tsx
git commit -m "$(cat <<'EOF'
refactor(organization): use PageTabNav in EntityDetailLayout (SM-7)

Drill-in layout shared by department/location/team detail. Per spec §3.3.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Codemod KontrakterTab (Contracts hub)

**Files:**
- Modify: `apps/web/src/app/dashboard/contracts/_components/KontrakterTab.tsx` lines ~125

`KontrakterTab` is the bucket-filter row inside `/dashboard/contracts`. This is a tab-within-a-tab pattern that spec §3.2 forbids (one PageTabNav per page max). Two options:

1. **Replace inner Tabs with filter chips** (preferred — chip row, not tab strip).
2. **Move the bucket dimension to URL** (deferred to contracts-IA sortie).

For SM-7, do option 1 — replace `<TabsList>` with a chip-row inline. Use existing `<Badge>` or `<Button variant="ghost">` per workspace pattern. This is not strictly a `PageTabNav` codemod; it's converting tabs-inside-tabs to chips-inside-tab.

- [ ] **Step 1: Read context around line 125**

Run: `sed -n '115,160p' apps/web/src/app/dashboard/contracts/_components/KontrakterTab.tsx`

- [ ] **Step 2: Replace `<Tabs>` block with chip-row**

```tsx
<div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Kontrakt-bucket">
  {BUCKETS.map((bucket) => (
    <button
      key={bucket.value}
      type="button"
      onClick={() => handleBucketChange(bucket.value)}
      data-active={activeBucket === bucket.value ? "true" : "false"}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
        activeBucket === bucket.value
          ? "border-foreground/20 bg-foreground text-background"
          : "border-border bg-muted/50 text-muted-foreground hover:bg-muted",
      )}
    >
      {bucket.label}
      {bucket.count !== undefined && (
        <span className="ml-1.5 opacity-70">{bucket.count}</span>
      )}
    </button>
  ))}
</div>
```

Then drop the `<Tabs>` wrapper — the body becomes a direct child of the parent.

- [ ] **Step 3: Typecheck + smoke**

Navigate to `/dashboard/contracts`. Chip row switches buckets. No nested tab strip.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/contracts/_components/KontrakterTab.tsx
git commit -m "$(cat <<'EOF'
refactor(contracts): bucket switch as chip row, not nested tabs (SM-7)

Spec §3.2 forbids nested tab strips. Bucket filter becomes a chip-row
on a single tab. Future contracts-IA sortie may URL-bind bucket.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Codemod supplement-rules-settings

**Files:**
- Modify: `apps/web/src/app/dashboard/settings/_components/supplement-rules-settings.tsx` lines ~1094–1101

- [ ] **Step 1: Read block**

Run: `sed -n '1088,1110p' apps/web/src/app/dashboard/settings/_components/supplement-rules-settings.tsx`

Expected: `<Tabs>` driving SupplementType selector (`evening / weekend / night / overtime / ...`).

- [ ] **Step 2: Replace TabsList**

```tsx
<PageTabNav
  tabs={SUPPLEMENT_TYPES.map((t) => ({ key: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))}
  active={activeTab}
  onChange={(v) => setActiveTab(v as SupplementType)}
  className="mb-4"
  ariaLabel="Tillegg-typer"
/>
```

If `SUPPLEMENT_TYPES` doesn't exist as an array, derive from the existing children or `Object.keys` over an enum mapping.

- [ ] **Step 3: Typecheck + smoke**

Navigate to `/dashboard/settings` and open the supplement-rules subsection. Tab switching preserved.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/settings/_components/supplement-rules-settings.tsx
git commit -m "$(cat <<'EOF'
refactor(settings): use PageTabNav in supplement-rules (SM-7)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Document exceptions

**Files:**
- Modify: `docs/design/sitemap/web/00-CANONICAL.md` (§3.4)

Five files are documented exceptions — not codemodded. They render `<Tabs>` legitimately as drawer-internal, modal-internal, mobile-narrow, or about-to-be-deleted surfaces.

- [ ] **Step 1: Add exception list to canonical spec**

In `docs/design/sitemap/web/00-CANONICAL.md`, find §3.4 ("Tab visual"). After the "Inherits canonical from `dashboard-page-pattern.md` §1.3" sentence, append:

```markdown
**Documented exceptions** (legitimately use raw shadcn `<Tabs>` / `<TabsList>` — do not codemod):

| File | Why exception |
|---|---|
| `apps/web/src/app/dashboard/payroll/[periodId]/_components/LineDrawer.tsx` | Drawer-internal — drawer has its own chrome and tab strip; not a page-level tab. |
| `apps/web/src/app/dashboard/schedule/_components/shift-modal.tsx` | Modal-internal — same rationale as drawer. |
| `apps/web/src/app/dashboard/reconciliation/_components/DayApproval.tsx` | Section-level inside a single page tab — not the page's sub-tab strip. Uses bare shadcn defaults, no hand-rolled clone. |
| `apps/web/src/app/dashboard/shift-clock/ShiftClockTabs.tsx` | `grid-cols-3` layout for mobile-narrow viewport. PageTabNav assumes flex; grid is the right primitive here. |
| `apps/web/src/app/dashboard/website/_components/editors/MenuFullEditor.tsx` | `/website` is a candidate for deletion per spec §13 O1 — defer codemod until website-IA decision. |

Any *new* page must either use `<PageTabNav>` or fall into one of these exception classes. Adding a new class requires an ADR.
```

- [ ] **Step 2: Commit**

```bash
git add docs/design/sitemap/web/00-CANONICAL.md
git commit -m "$(cat <<'EOF'
docs(sitemap): document 5 PageTabNav exceptions (SM-7)

Drawer-internal, modal-internal, section-level, mobile-narrow grid,
and pending-deletion surfaces keep raw shadcn Tabs. Adding a new
exception class requires an ADR.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Full verification

- [ ] **Step 1: TabsList inventory final**

Run: `grep -rln 'TabsList' apps/web/src/app/dashboard --include='*.tsx' | sort`

Expected: exactly 5 files (the exceptions). If any of the 7 codemod targets still appears, that codemod is incomplete.

- [ ] **Step 2: PageTabNav adoption check**

Run: `grep -rln '<PageTabNav' apps/web/src --include='*.tsx' | sort`

Expected: at least 7 codemod sites + original callers from PEOPLE_TAB_DEFS / DayDetail / policies / etc. Total ≥ 14 files.

- [ ] **Step 3: Typecheck full**

Run: `pnpm turbo typecheck --filter='@smartout/web' 2>&1 | tail -10`

Expected: 0 errors.

- [ ] **Step 4: Lint full**

Run: `pnpm turbo lint --filter='@smartout/web' 2>&1 | tail -10`

Expected: 0 errors.

- [ ] **Step 5: Vitest run**

Run: `pnpm --filter @smartout/web vitest run 2>&1 | tail -20`

Expected: all tests pass including the new `PageTabNav.test.tsx`.

- [ ] **Step 6: Manual smoke matrix**

Open each codemodded page and verify tabs still switch:

- [ ] `/dashboard/reports` — Drift · Lønn · HMS · Egendefinert (or current labels)
- [ ] `/dashboard/calendar` — Måned · Uke · Liste · Tidslinjer (or current)
- [ ] `/dashboard/hms/procedure/<id>` — procedure tabs
- [ ] `/dashboard/payroll/<periodId>` — period drill-in tabs
- [ ] `/dashboard/organization/departments/<id>` — entity tabs
- [ ] `/dashboard/organization/locations/<id>` — entity tabs (same layout)
- [ ] `/dashboard/organization/teams/<id>` — entity tabs (same layout)
- [ ] `/dashboard/contracts` — bucket chips (no nested tabs)
- [ ] `/dashboard/settings` → supplement-rules — type tabs

- [ ] **Step 7: Update SM-7 status in canonical spec**

In `docs/design/sitemap/web/00-CANONICAL.md` §12, mark SM-7 row:

```markdown
| **SM-7** ✅ | PageTabNav variant=route + codemod 12 ad-hoc TabsList | M (5h) | global |
```

Actual count for the codemod = 7 (not 12) because 5 are legitimate exceptions. Update the cell text:

```markdown
| **SM-7** ✅ | PageTabNav variant=route + codemod 7 hand-rolled TabsList (+ 5 exceptions documented) | M (5h) | global |
```

Commit:

```bash
git add docs/design/sitemap/web/00-CANONICAL.md
git commit -m "$(cat <<'EOF'
docs(sitemap): mark SM-7 shipped, correct codemod count

7 codemodded + 5 documented exceptions = 12 TabsList sites resolved.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Verification Summary

Before declaring SM-7 shipped:

- [ ] `<PageTabNav>` has `variant` + `basePath` props (both backwards-compatible).
- [ ] 7 codemods landed: ReportsPageShell, CalendarPageShell, ProcedureDetailTabs, PeriodDetailClient, EntityDetailLayout, KontrakterTab, supplement-rules-settings.
- [ ] 5 exceptions documented in spec §3.4: LineDrawer, shift-modal, DayApproval, ShiftClockTabs, MenuFullEditor.
- [ ] Vitest `PageTabNav.test.tsx` passes 7/7.
- [ ] `pnpm turbo typecheck --filter='@smartout/web'` passes 0 errors.
- [ ] `pnpm turbo lint --filter='@smartout/web'` passes 0 errors.
- [ ] Manual smoke on 9 codemodded surfaces confirms tab switching preserved.
- [ ] `grep -rln 'TabsList' apps/web/src/app/dashboard` returns exactly the 5 exception files.

Expected commit count for the sortie: 9–11 commits.

---

## Out of Scope (Defer to Later Sorties)

- Switching ProcedureDetailTabs / PeriodDetailClient / EntityDetailLayout to `variant="route"` — requires per-route file restructure (sub-folders per tab). Defer to entity-IA sortie.
- Canonicalizing payroll/HMS/organization tab labels to match spec §3.3 exactly — that's a label-sweep concern, not a primitive concern.
- Building `<PageTabNav variant="route">` callers on hubs (Ansatte, Vaktplan, HMS) — those are SM-2 / SM-3 / SM-4 jobs.
- Deleting `/dashboard/website` (decision O1) — out of scope; codemod skipped pending deletion decision.
- ADR for sub-tab exception classes — write only if a new exception is requested.

---

## Rollback

Single revert handles full sortie undo:

```bash
git log --oneline campaign/ui-shell ^aa4ee0d62 -- 'apps/web/**' 'docs/design/sitemap/**' | head -20
# Identify the first SM-7 commit (Task 2 PageTabNav extension) and the last (Task 12 docs).
git revert <first_sha>..<last_sha>
```

All changes are component-level. No database state, no route deletions. Existing `<Tabs>` controllers in codemodded files are preserved — they still drive `<TabsContent>` panels — so revert is safe even mid-task.
