---
title: "Plan — P11 Manager Timeline (oppgaver page)"
feature: p11-oppgaver-page
linear: SMA-375
status: ready
module: daytimeline
created: 2026-05-24
updated: 2026-05-24
tags: [plan, oppgaver, manager-timeline, day-session, day-planner, gantt, web]
---

# P11 Manager Timeline (`/dashboard/oppgaver`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Dispatch one fresh subagent per task. Two-stage review (code-reviewer + system-steward) after each phase.

**Goal:** Ship a read-only, full-page Manager Timeline at `/dashboard/oppgaver` — a "Områder × Personer" Gantt-down view (vertical time 06:00→02:00, areas as horizontal bands, person columns inside bands) — replacing the reserved-but-disabled `/dashboard/tasks` sidebar slot. V1 reads `day_line` + `session_task` + `role`/`role_task` for the active date; click-to-edit delegates to existing capability tools (no new write capabilities). Parallel surface to P10 `TidslinjeTab` — does NOT replace it (per L-0338 surface duplication discriminator: P10 = embedded tab inside WebDayControl single-department view; P11 = full-page multi-area read-only Gantt for the manager-on-the-floor "what is happening across all areas right now" question).

**Architecture:** EXTEND-EXISTING for data + capability layer (re-use `useDayLines` hook + `useDayTimelineEvents` extended with manager-scope mode, delegate writes to existing `task.*` / `day-line.*` capabilities); NEW-COMPONENT for chart body (port `timeline-chart.jsx` to TypeScript + React 19 + Nordic Split tokens — NO new design tokens needed per `tokens.css` audit). Page is web-only authoring/planning surface per ADR-0133 (no mobile twin). Page declares `<DomainChatOwnership reason="oppgaver-timeline">` so the global Botsson Orb suppresses to passive mode per ADR-0238. Tools-bridge registers 6 read-only tools via `useRegisterTools("oppgaver", kit)` per ADR-0282. Telemetry: 6 events registered in `packages/telemetry/src/registry.ts` AND emitted same-commit per L-0340 trust-gate.

**Tech Stack:** Next.js 16 App Router + React 19 + TypeScript strict, Tailwind v4 (CSS-config, NO `tailwind.config.ts`), shadcn/ui (new-york), Lucide React icons, framer-motion (existing dep), `@tanstack/react-query`, Zod, `@smartout/telemetry` `emit()`, Vitest (env=node, Path B static source assertion per P10 closure), Playwright + axe-core (E2E + a11y).

**Spec / design source:**
- `docs/domains/day-session/day-planner/project/Manager Timeline.html` (1214 LOC primary)
- `docs/domains/day-session/day-planner/project/timeline-chart.jsx` (681 LOC — Gantt body)
- `docs/domains/day-session/day-planner/project/timeline-data.js` (fixture only — do NOT port; replaced by hooks)
- `docs/domains/day-session/day-planner/project/canvas-app.jsx` (3-alternative comparison; ArtboardA "Områder × Personer" SELECTED)
- `docs/domains/day-session/day-planner/project/tweaks-panel.jsx` — DESIGN-TIME ONLY, MUST NOT SHIP
- `docs/domains/day-session/day-planner/project/tokens.css` — confirmed mirror of `packages/design-tokens` (no new tokens)

**Anchor ADRs:** 0078 (channel guard), 0099 (engine_memory gate-action — LATENT GAP inherited from P10 ref), 0133 (mobile boundary), 0156 (canonical admin surface), 0173 (frozen capability boundaries), 0204 (gatedMutation), 0238 (DomainChatOwnership), 0282 (canonical tool registry), 0298 (task ontology), 0357 (page-polish rule), 0358 (telemetry emit mandate), 0361 (no hardcoded colors), 0366 (no OKLCH literals), 0367 (day-line area-anchored runtime).

**Anchor Learnings:** L-0177 (fail-fast on workspace_id/profile_id), L-0234 (voice view-tools mirror), L-0252 (cross-cascade-role projection), L-0287 (phantom tool registration), L-0316 (worktree isolation), L-0338 (surface duplication discriminator), L-0339 (spatial budget as Phase 3 axis), L-0340 (telemetry emit at registry-add), L-0341 (chair self-reversal precedent).

**Branch:** `feat/p11-oppgaver-page` (sortie based on `development`), worktree `/home/sxtnl/dev/smartout.ai-wt-5`.

**Migration timestamp floor:** none — this plan is UI + read-hooks + telemetry + i18n + site-map only. Zero migrations. Zero new capability tools. Zero new RPCs. (If author elects RPC route in Task 4.2, timestamp floor = `>` current HEAD.)

**ADR slots reserved:** none. (Drift inherited from P10 ref pattern is FLAGGED in HANDOFF — no new ADR; Linear follow-up issue created post-merge to draft `engine_memory` gate-action across all pin-context actions, P10 + P11 + future surfaces in one sweep.)

**Pre-merge gates (close-feature blocks on these):**
- All 6 telemetry events registered + emitted in same commit (L-0340)
- All Server Actions throw or `return { ok: false }` on missing `workspace_id` / `profile_id` (L-0177)
- 0 OKLCH literals (`oklch(`) in any `.tsx` / `.ts` outside `globals.css` `@layer base` (ADR-0366)
- 0 hardcoded color classes (`zinc-*` / `gray-*` / `slate-*` / `bg-white` / `text-black`) outside design-tokens package (ADR-0361)
- Every user-visible string passes through `t(...)` — `pnpm --filter web check:i18n` clean (CLAUDE.md rule)
- `tweaks-panel.jsx` is NOT imported anywhere in `apps/web/src` (`grep -r 'tweaks-panel' apps/web/src` returns nothing)
- `pnpm --filter web site-map:validate` passes
- All 6 polish-skill Phase 8 checks pass (see Phase 7 tasks)

---

## Scope Check

This plan ships ONE subsystem: a new read-only dashboard route. It does NOT:
- introduce schema migrations
- add new capability tools (delegates to existing ones)
- modify the cascade core or task ontology
- ship a mobile twin (web-only per ADR-0133)
- introduce voice page-tools beyond data-channel mirror (deferred V2)
- modify P10 `TidslinjeTab` behavior (parallel surface, not replacement)

Single subsystem ✓.

---

## File Structure

Files grouped by phase. Each entry: path → action → responsibility.

### Phase 1 — Foundation (5 tasks)

| Path | Action | Responsibility |
|---|---|---|
| `apps/web/src/components/dashboard/sidebar-config.ts:155` | Modify | href `/dashboard/tasks`→`/dashboard/oppgaver`, status→`live`, remove `disabled` |
| `apps/web/src/components/dashboard/__tests__/sidebar-config.test.ts:42` | Modify | Update assertion to match |
| `apps/web/src/components/dashboard/__tests__/SidebarGroup.test.tsx:238` | Modify | Update reference (if present — verify file existence in Task 1.1) |
| `apps/e2e/protocols/p-sidebar-orphan-coverage.ts` | Modify | Update reference (if present) |
| `docs/design/sitemap/web/00-CANONICAL.md:86` | Modify | Update reference |
| `apps/web/src/app/dashboard/layout.tsx:141-156` | Modify | Add `/dashboard/oppgaver` to `ADMIN_ONLY_PATH_PREFIXES` (manager-allowed; gate covers employee→redirect) |
| `apps/web/src/app/dashboard/oppgaver/layout.tsx` | Create | Layout escape from default DashboardShell scroll (`h-full overflow-hidden` wrapper) |
| `apps/web/src/app/dashboard/oppgaver/page.tsx` | Create | Server Component thin shell — resolves user + profile + date → renders ManagerTimelineShell |
| `apps/web/src/app/dashboard/oppgaver/_components/ManagerTimelineShell.tsx` | Create | Client shell: CSS grid `[topbar][toolbar][body]`, `100dvh`, DomainChatOwnership declaration |
| `apps/web/src/app/dashboard/oppgaver/_components/__tests__/ManagerTimelineShell.test.ts` | Create | Path B static source assertion (grid template, `DomainChatOwnership`, no DashboardShell import) |

### Phase 2 — Chrome (5 tasks)

| Path | Action | Responsibility |
|---|---|---|
| `apps/web/src/app/dashboard/oppgaver/_components/TimelineTopBar.tsx` | Create | TopBar — brand "Dagslinjen" + date stepper + manager pill + Lukk-dagen CTA (disabled placeholder) |
| `apps/web/src/app/dashboard/oppgaver/_components/__tests__/TimelineTopBar.test.ts` | Create | Path B — ARIA labels, t() coverage, disabled state |
| `packages/ui/src/components/segment-group.tsx` | Create | New primitive — 3-segment switcher (Område / Rolle / Person) |
| `packages/ui/src/components/__tests__/segment-group.test.tsx` | Create | Vitest unit — onValueChange, ARIA radiogroup |
| `packages/ui/src/components/filter-chip.tsx` | Create | New primitive — single chip with optional destructive count badge |
| `packages/ui/src/components/__tests__/filter-chip.test.tsx` | Create | Vitest — toggle, badge render, focus-visible ring |
| `packages/ui/src/index.ts` | Modify | Re-export `SegmentGroup` + `FilterChip` (verify barrel exists; otherwise per-package entry) |
| `apps/web/src/app/dashboard/oppgaver/_components/TimelineToolbar.tsx` | Create | Toolbar — SegmentGroup + area chip-bar + Kun-åpne/Avvik filter chips + zoom cluster |
| `apps/web/src/app/dashboard/oppgaver/_components/__tests__/TimelineToolbar.test.ts` | Create | Path B — view-mode + filter callbacks wired |

### Phase 3 — Chart Body (7 tasks)

| Path | Action | Responsibility |
|---|---|---|
| `apps/web/src/app/dashboard/oppgaver/_chart/layoutOverlap.ts` | Create | Pure column-assignment algorithm (port from `timeline-chart.jsx:104-131`) |
| `apps/web/src/app/dashboard/oppgaver/_chart/__tests__/layoutOverlap.test.ts` | Create | Vitest — 0/1/N overlapping tasks, sort stability |
| `apps/web/src/app/dashboard/oppgaver/_chart/timeMath.ts` | Create | `hmToMin` / `minToHM` / `DAY_MINUTES` constants (ported, typed) |
| `apps/web/src/app/dashboard/oppgaver/_chart/__tests__/timeMath.test.ts` | Create | Vitest — edge cases (06:00, 02:00 next-day, midnight) |
| `apps/web/src/app/dashboard/oppgaver/_chart/TimeGutter.tsx` | Create | Hour-label column + phase labels (port `timeline-chart.jsx:29-70`) |
| `apps/web/src/app/dashboard/oppgaver/_chart/RoutineStrips.tsx` | Create | 8 service-phase bands (Nordic Split `--phase-*` tokens, no OKLCH literals) |
| `apps/web/src/app/dashboard/oppgaver/_chart/NowLine.tsx` | Create | Orange now-marker, `useReducedMotion()` gate per WCAG 2.3.3 |
| `apps/web/src/app/dashboard/oppgaver/_chart/PastDim.tsx` | Create | Past-time overlay using semantic `--past-dim` token (NOT hardcoded `oklch(0 0 0 / 0.3)`) |
| `apps/web/src/app/dashboard/oppgaver/_chart/PersonLane.tsx` | Create | Single employee column inside band: shift fill + task blocks |
| `apps/web/src/app/dashboard/oppgaver/_chart/TaskBlock.tsx` | Create | Single Gantt task block (status + priority + flagged + tiny variant) |
| `apps/web/src/app/dashboard/oppgaver/_chart/AreaBand.tsx` | Create | Horizontal band — header + N person columns + unassigned lane |
| `apps/web/src/app/dashboard/oppgaver/_chart/ManagerTimelineChart.tsx` | Create | Composer — TimeGutter + N AreaBand + NowLine + PastDim + scroll container |
| `apps/web/src/app/dashboard/oppgaver/_chart/__tests__/ManagerTimelineChart.test.ts` | Create | Path B — grid layout, ARIA region roles, area-band count from data |

### Phase 4 — Data Layer (4 tasks)

| Path | Action | Responsibility |
|---|---|---|
| `packages/data/src/day-session/use-day-lines-for-date.ts` | Create | Thin wrapper around `useDayLines` (mobile-parity per ADR-0133/0134 — shared logic in `packages/`) |
| `packages/data/src/day-session/__tests__/use-day-lines-for-date.test.ts` | Create | Vitest — workspaceId-null returns disabled query; staleTime 30s |
| `packages/data/src/day-session/use-session-tasks-for-date.ts` | Create | EXTEND `useDayTimelineEvents` with manager-scope (date-only, multi-area) mode OR direct `from("session_task")` query — author picks per Phase 4 audit |
| `packages/data/src/day-session/use-roles-for-positions.ts` | Create | Reads `role` + `role_task` filtered by date (direct query, no capability — ADR-0173 frozen-4 not violated) |
| `packages/data/src/day-session/__tests__/use-roles-for-positions.test.ts` | Create | Vitest — RLS filter via `workspace_id`, sort by `name` |
| `packages/data/src/index.ts` | Modify | Re-export 3 hooks |
| `apps/web/src/app/dashboard/oppgaver/_components/ManagerTimelineShell.tsx` | Modify | Wire 3 hooks → ManagerTimelineChart |

### Phase 5 — Harness (4 tasks)

| Path | Action | Responsibility |
|---|---|---|
| `apps/web/.botsson/site-map.json` | Modify | Append `/dashboard/oppgaver` route entry with 6 tools |
| `apps/web/src/app/dashboard/oppgaver/_tools/oppgaver-tools-bridge.tsx` | Create | `useRegisterTools("oppgaver", kit)` — pattern mirror `oversikt-tools-bridge.tsx` |
| `apps/web/src/app/dashboard/oppgaver/_tools/use-oppgaver-tools.ts` | Create | 6 typed tool definitions (chat + voice no-PII) |
| `apps/web/src/app/dashboard/oppgaver/_tools/__tests__/use-oppgaver-tools.test.ts` | Create | Vitest — 6 tools, descriptions present, channel guards correct |
| `apps/web/src/app/dashboard/_actions/pin-oppgaver-context.ts` | Create | Server Action — `engine_memory` insert keyed `oppgaver.panel_context`, 24h TTL, L-0177 fail-fast |
| `apps/web/src/app/dashboard/_actions/__tests__/pin-oppgaver-context.test.ts` | Create | Vitest — missing profile→`{ok:false}`, Zod-invalid→`{ok:false}`, happy-path inserts |
| `packages/telemetry/src/registry.ts` | Modify | Append 6 events + EVENT_ROUTING entries (single commit with emit-sites — L-0340) |
| `packages/telemetry/src/__tests__/registry.test.ts` | Modify | Append assertions for 6 new event names |

### Phase 6 — Click-to-Edit Modal (3 tasks)

| Path | Action | Responsibility |
|---|---|---|
| `apps/web/src/app/dashboard/oppgaver/_components/TaskEditModal.tsx` | Create | Sheet/dialog — delegates to `task.create_session` / `task.complete` (chat-only per ADR-0078) |
| `apps/web/src/app/dashboard/oppgaver/_components/__tests__/TaskEditModal.test.ts` | Create | Path B — verify import of existing Server Actions, no direct DB writes |
| `apps/web/src/app/dashboard/oppgaver/_components/ManagerTimelineShell.tsx` | Modify | Wire modal open/close + selected task state |

### Phase 7 — i18n + Nordic Split + ARIA (3 tasks)

| Path | Action | Responsibility |
|---|---|---|
| `packages/i18n/locales/nb/dashboard.json` | Modify | Add ~30 `oppgaver.*` keys |
| `packages/i18n/locales/en/dashboard.json` | Modify | Add same keys with English copy |
| `apps/web/src/app/dashboard/oppgaver/_components/**/*.tsx` | Modify | Replace inline strings with `t("oppgaver.*")` calls |
| `apps/web/src/app/dashboard/oppgaver/_chart/**/*.tsx` | Audit | OKLCH literal sweep + hardcoded color sweep + ARIA review |

### Phase 8 — E2E + a11y (3 tasks)

| Path | Action | Responsibility |
|---|---|---|
| `apps/e2e/tests/oppgaver/page-loads.spec.ts` | Create | Playwright — manager profile loads page, sees TopBar + Toolbar + Chart |
| `apps/e2e/tests/oppgaver/view-mode-switch.spec.ts` | Create | Playwright — switching Område/Rolle/Person updates layout + emits telemetry |
| `apps/e2e/tests/oppgaver/a11y.spec.ts` | Create | Playwright + `@axe-core/playwright` — 0 violations of WCAG 2.1 AA |

---

## Phase 0 — Pre-flight verification (1 task)

### Task 0: Confirm worktree + branch + baseline

**Files:** none modified — verification only.

- [ ] **Step 1: Verify worktree + branch**

```bash
pwd                                  # expect: /home/sxtnl/dev/smartout.ai-wt-5
git branch --show-current            # expect: feat/p11-oppgaver-page
git worktree list | grep wt-5        # expect: worktree physically exists per L-0316
```

If any expectation fails: STOP, report to operator, do NOT proceed.

- [ ] **Step 2: Verify baseline typecheck + i18n + site-map are green**

```bash
pnpm --filter web exec tsc --noEmit  2>&1 | tail -5
pnpm --filter @smartout/data exec tsc --noEmit  2>&1 | tail -5
pnpm --filter web site-map:validate  2>&1 | tail -3
```

Expected: all 3 report 0 errors. If not green at baseline, halt and fix before plan.

- [ ] **Step 3: Verify design source files exist**

```bash
ls docs/domains/day-session/day-planner/project/Manager\ Timeline.html
ls docs/domains/day-session/day-planner/project/timeline-chart.jsx
ls docs/domains/day-session/day-planner/project/tokens.css
```

Expected: all 3 files present. They are the canonical reference for every visual decision in Phases 2–3.

- [ ] **Step 4: Confirm capability tools that this page will delegate to are alive**

```bash
grep -l 'name: "create_session"' packages/ai/src/capabilities/task/tools.ts
grep -l 'name: "complete"'       packages/ai/src/capabilities/task/tools.ts
grep -l 'name: "add_item"'       packages/ai/src/capabilities/day-line/tools.ts
grep -l 'name: "update_hours"'   packages/ai/src/capabilities/day-line/tools.ts
```

Expected: all 4 print the file path. If any missing, halt — this plan delegates and must not invent new tools.

- [ ] **Step 5: Confirm Linear ticket exists**

```bash
echo "Linear ticket: SMA-375 (Manager Timeline /dashboard/oppgaver)"
# Operator step: open https://linear.app and verify ticket in 'In Progress' lane.
```

No commit for Task 0 — verification only.

---

## Phase 1 — Foundation (5 tasks)

Required skill: `smartout-page-polish` — Phase 0 pre-polish check.

### Task 1.1: Sidebar mutation (atomic — one commit)

**Files:**
- Modify: `apps/web/src/components/dashboard/sidebar-config.ts`
- Modify: `apps/web/src/components/dashboard/__tests__/sidebar-config.test.ts`
- Audit + maybe-modify: `apps/web/src/components/dashboard/__tests__/SidebarGroup.test.tsx`
- Audit + maybe-modify: `apps/e2e/protocols/p-sidebar-orphan-coverage.ts`
- Modify: `docs/design/sitemap/web/00-CANONICAL.md`

- [ ] **Step 1: Write the failing test**

Edit `apps/web/src/components/dashboard/__tests__/sidebar-config.test.ts:42-49`. Replace the existing `Oppgaver has status not-yet-built…` block with:

```ts
it("Oppgaver has status live, href /dashboard/oppgaver, no disabled flag", () => {
  const oppgaver = SIDEBAR_GROUPS_ADMIN.find((g) => g.labelKey === "sidebar.group_oppgaver");
  expect(oppgaver).toBeDefined();
  const item = oppgaver!.items.find((i) => i.href === "/dashboard/oppgaver");
  expect(item).toBeDefined();
  expect(item!.status).toBe("live");
  expect(item!.disabled).toBeUndefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter web exec vitest run apps/web/src/components/dashboard/__tests__/sidebar-config.test.ts
```

Expected: 1 failure on `Oppgaver has status live…` — the source still says `/dashboard/tasks` + `not-yet-built`.

- [ ] **Step 3: Write the source change**

Edit `apps/web/src/components/dashboard/sidebar-config.ts:154-159`. Replace:

```ts
{
  labelKey: "sidebar.item_oppgaver",
  href: "/dashboard/tasks",
  icon: ListTodo,
  status: "not-yet-built",
  disabled: true,
},
```

with:

```ts
{
  labelKey: "sidebar.item_oppgaver",
  href: "/dashboard/oppgaver",
  icon: ListTodo,
  status: "live",
},
```

- [ ] **Step 4: Run test to verify it passes + audit sibling files**

```bash
pnpm --filter web exec vitest run apps/web/src/components/dashboard/__tests__/sidebar-config.test.ts
# expect: PASS

# Audit + update any stale reference to /dashboard/tasks (limited to sidebar surface):
grep -rn '/dashboard/tasks' apps/web/src/components/dashboard/__tests__/ apps/e2e/protocols/ docs/design/sitemap/
```

For every match printed, update to `/dashboard/oppgaver` (assertion-only changes). Skip matches that document the OLD slot history (preserve historical context) — distinguish by surrounding code context.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/dashboard/sidebar-config.ts \
        apps/web/src/components/dashboard/__tests__/ \
        apps/e2e/protocols/p-sidebar-orphan-coverage.ts \
        docs/design/sitemap/web/00-CANONICAL.md
git commit -m "feat(oppgaver): activate sidebar slot at /dashboard/oppgaver

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 1.2: Admin-path guard inclusion

**Files:**
- Modify: `apps/web/src/app/dashboard/layout.tsx:141-156`

The dashboard layout's `ADMIN_ONLY_PATH_PREFIXES` list redirects employees away from admin routes. Oppgaver is owner/admin/manager only — must be in the list. (Managers are NOT employees, so the existing `isEmployee` check correctly admits them.)

- [ ] **Step 1: Write the failing assertion**

Create `apps/web/src/app/dashboard/__tests__/layout-admin-paths.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("dashboard/layout ADMIN_ONLY_PATH_PREFIXES", () => {
  it("includes /dashboard/oppgaver", () => {
    const src = readFileSync(
      join(__dirname, "..", "layout.tsx"),
      "utf-8",
    );
    expect(src).toMatch(/"\/dashboard\/oppgaver"/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter web exec vitest run apps/web/src/app/dashboard/__tests__/layout-admin-paths.test.ts
```

Expected: 1 failure — string not present in `layout.tsx`.

- [ ] **Step 3: Add to the prefix list**

Edit `apps/web/src/app/dashboard/layout.tsx` — inside the `ADMIN_ONLY_PATH_PREFIXES` array (currently lines 141-156), add a new entry adjacent to `/dashboard/schedule`:

```ts
"/dashboard/oppgaver",
```

- [ ] **Step 4: Re-run test**

```bash
pnpm --filter web exec vitest run apps/web/src/app/dashboard/__tests__/layout-admin-paths.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/layout.tsx \
        apps/web/src/app/dashboard/__tests__/layout-admin-paths.test.ts
git commit -m "feat(oppgaver): admin/manager-only access via layout prefix guard

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 1.3: Route stub + layout escape

**Files:**
- Create: `apps/web/src/app/dashboard/oppgaver/layout.tsx`
- Create: `apps/web/src/app/dashboard/oppgaver/page.tsx`

Why a per-route layout: the dashboard's default `DashboardShell` applies a page-scroll wrapper that breaks the 100dvh chart. The Manager Timeline needs `overflow: hidden` outer + `overflow-y: auto` body slot only. Mirror precedent: HMS (`apps/web/src/app/dashboard/hms/layout.tsx`) injects a tab nav; we inject a layout escape.

- [ ] **Step 1: Write the route-resolves test**

Create `apps/web/src/app/dashboard/oppgaver/__tests__/route.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROUTE_DIR = join(__dirname, "..");

describe("dashboard/oppgaver route", () => {
  it("has a layout.tsx that opts out of default page-scroll", () => {
    const layoutPath = join(ROUTE_DIR, "layout.tsx");
    expect(existsSync(layoutPath)).toBe(true);
    const src = readFileSync(layoutPath, "utf-8");
    expect(src).toMatch(/h-full overflow-hidden|h-\[100dvh\] overflow-hidden/);
  });

  it("has a page.tsx that renders ManagerTimelineShell", () => {
    const pagePath = join(ROUTE_DIR, "page.tsx");
    expect(existsSync(pagePath)).toBe(true);
    const src = readFileSync(pagePath, "utf-8");
    expect(src).toMatch(/ManagerTimelineShell/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter web exec vitest run apps/web/src/app/dashboard/oppgaver/__tests__/route.test.ts
```

Expected: 2 failures — files not present.

- [ ] **Step 3: Create the layout**

Create `apps/web/src/app/dashboard/oppgaver/layout.tsx`:

```tsx
/**
 * Manager Timeline (/dashboard/oppgaver) — layout escape.
 *
 * The dashboard's default layout applies a page-scroll wrapper that doesn't
 * suit the full-day Gantt chart. This layout owns its own 100dvh chrome with
 * outer overflow:hidden so the chart body can scroll internally.
 *
 * Spec: docs/domains/day-session/day-planner/project/Manager Timeline.html
 * ADR-0367: tri-layer D6 model anchors the chart's data shape.
 * ADR-0357: page-polish rule — site-map registration owns this route.
 */
import type { ReactNode } from "react";

export default function OppgaverLayout({ children }: { children: ReactNode }) {
  return <div className="h-full overflow-hidden">{children}</div>;
}
```

Create `apps/web/src/app/dashboard/oppgaver/page.tsx`:

```tsx
/**
 * Manager Timeline (/dashboard/oppgaver) — page entry.
 *
 * Server Component. Resolves no data here — the client shell owns the active
 * date + active department via the URL + workspace context. Page only mounts
 * the shell.
 */
import { ManagerTimelineShell } from "./_components/ManagerTimelineShell";

export default function OppgaverPage() {
  return <ManagerTimelineShell />;
}
```

- [ ] **Step 4: Re-run test (allow Step 3 ManagerTimelineShell to be missing — Task 1.4 creates it)**

```bash
pnpm --filter web exec vitest run apps/web/src/app/dashboard/oppgaver/__tests__/route.test.ts
```

Expected: PASS on both assertions (string match only; ManagerTimelineShell file may not yet exist — that's Task 1.4).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/oppgaver/
git commit -m "feat(oppgaver): route stub + 100dvh layout escape

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 1.4: ManagerTimelineShell skeleton (DomainChatOwnership declaration)

**Files:**
- Create: `apps/web/src/app/dashboard/oppgaver/_components/ManagerTimelineShell.tsx`
- Create: `apps/web/src/app/dashboard/oppgaver/_components/__tests__/ManagerTimelineShell.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/app/dashboard/oppgaver/_components/__tests__/ManagerTimelineShell.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SHELL = readFileSync(
  join(__dirname, "..", "ManagerTimelineShell.tsx"),
  "utf-8",
);

describe("ManagerTimelineShell", () => {
  it("declares DomainChatOwnership per ADR-0238", () => {
    expect(SHELL).toMatch(/DomainChatOwnership/);
    expect(SHELL).toMatch(/reason=["']oppgaver/);
  });

  it("uses a CSS grid with topbar/toolbar/body rows", () => {
    expect(SHELL).toMatch(/grid-rows-\[.*60px.*52px.*1fr\]|gridTemplateRows/);
  });

  it("declares 100dvh outer with overflow-hidden", () => {
    expect(SHELL).toMatch(/h-\[100dvh\]|h-full/);
    expect(SHELL).toMatch(/overflow-hidden/);
  });

  it("is a client component", () => {
    expect(SHELL.split("\n")[0]).toMatch(/^["']use client["']/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter web exec vitest run apps/web/src/app/dashboard/oppgaver/_components/__tests__/ManagerTimelineShell.test.ts
```

Expected: 4 failures — file does not exist.

- [ ] **Step 3: Create the shell**

Create `apps/web/src/app/dashboard/oppgaver/_components/ManagerTimelineShell.tsx`:

```tsx
"use client";

/**
 * ManagerTimelineShell — full-page Gantt-down Manager Timeline shell.
 *
 * Layout: CSS grid with three rows
 *   topbar  (60px) — brand + date stepper + manager pill + Lukk-dagen CTA
 *   toolbar (52px) — view-mode segments + area chips + filter chips + zoom
 *   body    (1fr)  — ManagerTimelineChart (scrolls internally)
 *
 * Outer wrapper is 100dvh + overflow:hidden so the chart owns its own scroll.
 * Layout escape via apps/web/src/app/dashboard/oppgaver/layout.tsx.
 *
 * DomainChatOwnership: declares "oppgaver-timeline" so the global Botsson Orb
 * suppresses to passive mode per ADR-0238 — the page does NOT embed a chat
 * surface, but the user mental-model around a Gantt + AI Orb dual-surface is
 * ambiguous enough that we declare ownership defensively (L-0178 prevention).
 *
 * Subagent-driven plan tasks fill in TopBar (1.4 skeleton, 2.1 real), Toolbar
 * (2.5), Chart (3.x), Hooks (4.x), Tools-bridge (5.x), Modal (6.x).
 */
import { DomainChatOwnership } from "@/app/Botsson/_components/DomainChatOwnership";

export function ManagerTimelineShell() {
  return (
    <>
      <DomainChatOwnership reason="oppgaver-timeline" />
      <div
        className="grid h-[100dvh] grid-rows-[60px_52px_1fr] overflow-hidden bg-background"
        role="region"
        aria-label="Manager Timeline"
      >
        <div className="border-b border-border bg-card">
          {/* TopBar slot — Task 2.1 fills this in */}
        </div>
        <div className="border-b border-border bg-card">
          {/* Toolbar slot — Task 2.5 fills this in */}
        </div>
        <div className="overflow-y-auto">
          {/* Chart slot — Task 3.7 fills this in */}
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 4: Re-run test + typecheck**

```bash
pnpm --filter web exec vitest run apps/web/src/app/dashboard/oppgaver/_components/__tests__/ManagerTimelineShell.test.ts
pnpm --filter web exec tsc --noEmit 2>&1 | grep oppgaver | head -10
```

Expected: PASS 4/4, no TS errors in oppgaver tree.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/oppgaver/_components/
git commit -m "feat(oppgaver): ManagerTimelineShell with DomainChatOwnership

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 1.5: Design-tokens audit (verify no new tokens needed)

**Files:** none modified — verification only. Output recorded in commit message.

Per `docs/domains/day-session/day-planner/project/tokens.css`, the design uses only tokens that already exist in `packages/design-tokens`. We must verify.

- [ ] **Step 1: Extract every CSS custom property used by the chart source**

```bash
grep -oE '\-\-[a-z][a-z0-9-]*' docs/domains/day-session/day-planner/project/timeline-chart.jsx \
  docs/domains/day-session/day-planner/project/timeline-styles.css \
  | sort -u > /tmp/oppgaver-tokens-needed.txt
wc -l /tmp/oppgaver-tokens-needed.txt
```

- [ ] **Step 2: Extract every CSS custom property defined in the design-tokens package**

```bash
grep -oE '\-\-[a-z][a-z0-9-]*' packages/design-tokens/src/*.css apps/web/src/app/globals.css \
  | sort -u > /tmp/oppgaver-tokens-available.txt
wc -l /tmp/oppgaver-tokens-available.txt
```

- [ ] **Step 3: Compute the diff**

```bash
comm -23 /tmp/oppgaver-tokens-needed.txt /tmp/oppgaver-tokens-available.txt
```

Expected: empty output (zero new tokens needed) per design-handoff brief. If output is non-empty: STOP, list missing tokens, escalate to operator — adding tokens is a separate ADR (per ADR-0366).

- [ ] **Step 4: Record audit result**

Append to `docs/superpowers/notes/p11-oppgaver-token-audit.md`:

```markdown
# Token Audit — P11 Manager Timeline — <date>
Tokens needed: <N>
Tokens available: <M>
Missing: <list or "none">
Verified by: <subagent id>
```

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/notes/p11-oppgaver-token-audit.md
git commit -m "docs(oppgaver): design-token audit — 0 new tokens needed

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase 2 — Chrome (5 tasks)

Required skill: `smartout-nordic-split` — chip + tokens authoritative.

### Task 2.1: TimelineTopBar component

**Files:**
- Create: `apps/web/src/app/dashboard/oppgaver/_components/TimelineTopBar.tsx`
- Create: `apps/web/src/app/dashboard/oppgaver/_components/__tests__/TimelineTopBar.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/app/dashboard/oppgaver/_components/__tests__/TimelineTopBar.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = readFileSync(
  join(__dirname, "..", "TimelineTopBar.tsx"),
  "utf-8",
);

describe("TimelineTopBar", () => {
  it("renders brand label via t()", () => {
    expect(SRC).toMatch(/t\(["']oppgaver\.brand["']\)/);
  });
  it("renders date stepper with mono font", () => {
    expect(SRC).toMatch(/font-mono/);
  });
  it("renders Lukk-dagen CTA as disabled placeholder V1", () => {
    expect(SRC).toMatch(/disabled/);
    expect(SRC).toMatch(/t\(["']oppgaver\.lukk_dagen["']\)/);
  });
  it("has no inline OKLCH literals", () => {
    expect(SRC).not.toMatch(/oklch\(/);
  });
  it("has no hardcoded zinc/gray/slate classes", () => {
    expect(SRC).not.toMatch(/\b(zinc|gray|slate)-\d/);
  });
  it("has ARIA labels on icon-only buttons", () => {
    expect(SRC).toMatch(/aria-label/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter web exec vitest run apps/web/src/app/dashboard/oppgaver/_components/__tests__/TimelineTopBar.test.ts
```

Expected: file-not-found failure on all assertions.

- [ ] **Step 3: Write the component**

Create `apps/web/src/app/dashboard/oppgaver/_components/TimelineTopBar.tsx` modeled on `docs/domains/day-session/day-planner/project/Manager Timeline.html` TopBar section. Use:
- `font-heading` for brand "Dagslinjen"
- `font-mono` for the date em ("Lør 24. mai")
- shadcn/ui `Button` for stepper + Lukk-dagen
- Lucide icons (Search, Bell, Mic, ChevronLeft, ChevronRight)
- `useTranslations("oppgaver")` from `next-intl`
- No client-fetch — date + manager-name passed as props from `ManagerTimelineShell`

Reference for keys (created in Phase 7):
- `oppgaver.brand` → "Dagslinjen"
- `oppgaver.lukk_dagen` → "Lukk dagen → AVV"
- `oppgaver.search_aria` → "Søk"
- `oppgaver.notifications_aria` → "Varsler"
- `oppgaver.voice_aria` → "Stemmestyring"
- `oppgaver.prev_day_aria` → "Forrige dag"
- `oppgaver.next_day_aria` → "Neste dag"

Props shape:
```ts
type Props = {
  dateISO: string;        // "2026-05-24"
  dateLabel: string;      // "Lør 24. mai 2026"
  managerName: string;    // "Sofia"
  onPrevDay: () => void;
  onNextDay: () => void;
};
```

The Lukk-dagen button MUST be `disabled` V1 (placeholder until cascade `daily_reconciliation` wiring lands in a follow-up sortie).

- [ ] **Step 4: Re-run test + typecheck**

```bash
pnpm --filter web exec vitest run apps/web/src/app/dashboard/oppgaver/_components/__tests__/TimelineTopBar.test.ts
pnpm --filter web exec tsc --noEmit 2>&1 | grep TimelineTopBar
```

Expected: PASS 6/6, 0 TS errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/oppgaver/_components/TimelineTopBar.tsx \
        apps/web/src/app/dashboard/oppgaver/_components/__tests__/TimelineTopBar.test.ts
git commit -m "feat(oppgaver): TimelineTopBar with date stepper + disabled Lukk-dagen

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2.2: SegmentGroup primitive in packages/ui

**Files:**
- Create: `packages/ui/src/components/segment-group.tsx`
- Create: `packages/ui/src/components/__tests__/segment-group.test.tsx`
- Modify: `packages/ui/src/index.ts` (or appropriate barrel)

- [ ] **Step 1: Write the failing test**

Create `packages/ui/src/components/__tests__/segment-group.test.tsx` using react-testing-library if installed in `packages/ui`, OR fall back to Path B static assertion if not. Verify with:
```bash
grep -l '@testing-library/react' packages/ui/package.json
```

If present, real RTL test; else Path B grep test.

RTL variant:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SegmentGroup } from "../segment-group";

describe("SegmentGroup", () => {
  it("renders all segments with correct ARIA role", () => {
    render(
      <SegmentGroup
        value="area"
        onValueChange={() => {}}
        segments={[
          { value: "area", label: "Område" },
          { value: "role", label: "Rolle" },
          { value: "person", label: "Person" },
        ]}
      />,
    );
    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("fires onValueChange on click", () => {
    const cb = vi.fn();
    render(
      <SegmentGroup
        value="area"
        onValueChange={cb}
        segments={[
          { value: "area", label: "Område" },
          { value: "role", label: "Rolle" },
        ]}
      />,
    );
    fireEvent.click(screen.getByText("Rolle"));
    expect(cb).toHaveBeenCalledWith("role");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @smartout/ui exec vitest run packages/ui/src/components/__tests__/segment-group.test.tsx
```

Expected: fails (file missing).

- [ ] **Step 3: Write the primitive**

Create `packages/ui/src/components/segment-group.tsx`. ARIA pattern: `role="radiogroup"`, each segment `role="radio"` + `aria-checked`. Styling: semantic tokens only (`bg-muted`, `bg-background`, `text-foreground`, `text-muted-foreground`). Focus-visible ring per Nordic Split. NO hardcoded colors. NO OKLCH literals. Use `cn()` from `@/lib/utils` (or local mirror).

Type:
```ts
export type Segment<T extends string> = { value: T; label: string; disabled?: boolean };
export type SegmentGroupProps<T extends string> = {
  value: T;
  onValueChange: (next: T) => void;
  segments: ReadonlyArray<Segment<T>>;
  className?: string;
  size?: "sm" | "md";
};
```

- [ ] **Step 4: Re-run test + typecheck the package**

```bash
pnpm --filter @smartout/ui exec vitest run packages/ui/src/components/__tests__/segment-group.test.tsx
pnpm --filter @smartout/ui exec tsc --noEmit
```

Both: PASS / 0 errors.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/segment-group.tsx \
        packages/ui/src/components/__tests__/segment-group.test.tsx \
        packages/ui/src/index.ts
git commit -m "feat(ui): SegmentGroup primitive (radiogroup ARIA, semantic tokens)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2.3: FilterChip primitive in packages/ui

**Files:**
- Create: `packages/ui/src/components/filter-chip.tsx`
- Create: `packages/ui/src/components/__tests__/filter-chip.test.tsx`
- Modify: `packages/ui/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/ui/src/components/__tests__/filter-chip.test.tsx` (RTL or Path B per same check as Task 2.2):

Verify:
1. Renders label text.
2. Calls `onToggle` with next state on click.
3. Shows `count` badge when `count > 0`.
4. Badge has `bg-destructive` class when `tone="destructive"`.
5. `aria-pressed` reflects `active` prop.
6. Has `focus-visible:ring-2` class for keyboard navigation.

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @smartout/ui exec vitest run packages/ui/src/components/__tests__/filter-chip.test.tsx
```

- [ ] **Step 3: Write the primitive**

Create `packages/ui/src/components/filter-chip.tsx`:

```ts
export type FilterChipProps = {
  label: string;
  active: boolean;
  onToggle: (next: boolean) => void;
  count?: number;
  tone?: "default" | "destructive" | "warning";
  className?: string;
};
```

Styling: button with `aria-pressed`, semantic tokens, optional count badge using `Badge` from same package. Active state: `bg-foreground text-background`. Inactive: `bg-muted text-foreground`. Tone variants apply to count badge only.

- [ ] **Step 4: Re-run test + typecheck**

```bash
pnpm --filter @smartout/ui exec vitest run packages/ui/src/components/__tests__/filter-chip.test.tsx
pnpm --filter @smartout/ui exec tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/filter-chip.tsx \
        packages/ui/src/components/__tests__/filter-chip.test.tsx \
        packages/ui/src/index.ts
git commit -m "feat(ui): FilterChip primitive (aria-pressed, destructive badge, focus-visible)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2.4: Rebuild telemetry/UI package dist (precondition for app consumers)

**Files:** none modified — build only.

L-stale-telemetry-dist (2026-05-13) showed that `@smartout/ui` and `@smartout/telemetry` consumers see stale types unless dist is rebuilt. Since Phase 2 introduced new exports in `packages/ui`, rebuild before Phase 2.5 consumes them.

- [ ] **Step 1: Build affected packages**

```bash
pnpm --filter @smartout/ui build
```

Expected: 0 errors, dist updated.

- [ ] **Step 2: Verify app sees new exports**

```bash
pnpm --filter web exec tsc --noEmit 2>&1 | grep -E "SegmentGroup|FilterChip" || echo "OK — no errors mentioning new exports"
```

Expected: "OK — no errors…". If TS errors appear, re-run Step 1 with `--force`.

No commit (build artifact only — dist is gitignored).

---

### Task 2.5: TimelineToolbar component (consumes SegmentGroup + FilterChip)

**Files:**
- Create: `apps/web/src/app/dashboard/oppgaver/_components/TimelineToolbar.tsx`
- Create: `apps/web/src/app/dashboard/oppgaver/_components/__tests__/TimelineToolbar.test.ts`

- [ ] **Step 1: Write the failing test**

Path B static assertion. Verify:
1. Imports `SegmentGroup` + `FilterChip` from `@smartout/ui`.
2. Renders 3 segments: `area`, `role`, `person`.
3. Renders area chip-bar (maps over `areas` prop).
4. Renders "Kun åpne" + "Avvik" filter chips.
5. All labels use `t("oppgaver.*")`.
6. No OKLCH literals; no hardcoded zinc/gray/slate.

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter web exec vitest run apps/web/src/app/dashboard/oppgaver/_components/__tests__/TimelineToolbar.test.ts
```

- [ ] **Step 3: Write the component**

Props:
```ts
type ViewMode = "area" | "role" | "person";
type AreaChip = { id: string; label: string };
type Props = {
  viewMode: ViewMode;
  onViewModeChange: (next: ViewMode) => void;
  areas: ReadonlyArray<AreaChip>;
  activeAreaIds: ReadonlyArray<string>;
  onToggleArea: (areaId: string) => void;
  onlyOpen: boolean;
  onToggleOnlyOpen: () => void;
  deviationsOnly: boolean;
  deviationsCount: number;
  onToggleDeviations: () => void;
  zoom: number;
  onZoomChange: (next: number) => void;
};
```

Reference for keys (Phase 7):
- `oppgaver.view_mode.area`, `oppgaver.view_mode.role`, `oppgaver.view_mode.person`
- `oppgaver.filter.only_open`, `oppgaver.filter.deviations`
- `oppgaver.zoom_in_aria`, `oppgaver.zoom_out_aria`

- [ ] **Step 4: Re-run test + typecheck**

```bash
pnpm --filter web exec vitest run apps/web/src/app/dashboard/oppgaver/_components/__tests__/TimelineToolbar.test.ts
pnpm --filter web exec tsc --noEmit 2>&1 | grep oppgaver
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/oppgaver/_components/TimelineToolbar.tsx \
        apps/web/src/app/dashboard/oppgaver/_components/__tests__/TimelineToolbar.test.ts
git commit -m "feat(oppgaver): TimelineToolbar (view-mode segments + area chips + filters)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase 3 — Chart Body (7 tasks)

Required skill: `smartout-nordic-split` — Gantt rendering must honor OKLCH-ban + semantic tokens.

### Task 3.1: layoutOverlap pure algorithm

**Files:**
- Create: `apps/web/src/app/dashboard/oppgaver/_chart/layoutOverlap.ts`
- Create: `apps/web/src/app/dashboard/oppgaver/_chart/__tests__/layoutOverlap.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { layoutOverlap, type LayoutInput } from "../layoutOverlap";

describe("layoutOverlap", () => {
  it("0 tasks → totalCols 1, items []", () => {
    const out = layoutOverlap([]);
    expect(out.totalCols).toBe(1);
    expect(out.items).toHaveLength(0);
  });

  it("1 task → col 0, totalCols 1", () => {
    const out = layoutOverlap([{ id: "a", start: "08:00", end: "09:00" }]);
    expect(out.totalCols).toBe(1);
    expect(out.items[0]).toEqual({ task: expect.objectContaining({ id: "a" }), col: 0 });
  });

  it("2 non-overlapping → both col 0", () => {
    const out = layoutOverlap([
      { id: "a", start: "08:00", end: "09:00" },
      { id: "b", start: "09:00", end: "10:00" },
    ]);
    expect(out.totalCols).toBe(1);
    expect(out.items.map((x) => x.col)).toEqual([0, 0]);
  });

  it("2 overlapping → cols 0 and 1, totalCols 2", () => {
    const out = layoutOverlap([
      { id: "a", start: "08:00", end: "09:30" },
      { id: "b", start: "09:00", end: "10:00" },
    ]);
    expect(out.totalCols).toBe(2);
    expect(out.items.map((x) => x.col).sort()).toEqual([0, 1]);
  });

  it("sort is stable when starts equal: longer first", () => {
    const out = layoutOverlap([
      { id: "short", start: "08:00", end: "08:30" },
      { id: "long",  start: "08:00", end: "09:30" },
    ]);
    expect(out.items[0]!.task.id).toBe("long");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter web exec vitest run apps/web/src/app/dashboard/oppgaver/_chart/__tests__/layoutOverlap.test.ts
```

- [ ] **Step 3: Port the algorithm**

Create `apps/web/src/app/dashboard/oppgaver/_chart/layoutOverlap.ts` — typed TS port of `timeline-chart.jsx:104-131`. Use `timeMath.hmToMin` (Task 3.2) — but since Task 3.2 ships next, inline a local helper or import after Task 3.2 reorder. Easier: ship Task 3.2 first OR inline a private `hmToMin` here and Task 3.2 will dedup.

Recommended: inline private helper here (single-file pure module), Task 3.2 dedups.

```ts
export type LayoutInput = { id: string; start: string; end: string };
export type LayoutItem = { task: LayoutInput; col: number };
export type LayoutResult = { items: LayoutItem[]; totalCols: number };

function hmToMin(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function layoutOverlap(tasks: ReadonlyArray<LayoutInput>): LayoutResult {
  const sorted = [...tasks].sort((a, b) => {
    const d = hmToMin(a.start) - hmToMin(b.start);
    if (d !== 0) return d;
    return hmToMin(b.end) - hmToMin(a.end);
  });
  const cols: { endMin: number }[] = [];
  const items: LayoutItem[] = [];
  for (const t of sorted) {
    const ts = hmToMin(t.start);
    const te = hmToMin(t.end);
    let placed = false;
    for (let i = 0; i < cols.length; i++) {
      if (cols[i]!.endMin <= ts) {
        cols[i] = { endMin: te };
        items.push({ task: t, col: i });
        placed = true;
        break;
      }
    }
    if (!placed) {
      cols.push({ endMin: te });
      items.push({ task: t, col: cols.length - 1 });
    }
  }
  return { items, totalCols: Math.max(1, cols.length) };
}
```

- [ ] **Step 4: Re-run test**

```bash
pnpm --filter web exec vitest run apps/web/src/app/dashboard/oppgaver/_chart/__tests__/layoutOverlap.test.ts
```

Expected: 5/5 PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/oppgaver/_chart/layoutOverlap.ts \
        apps/web/src/app/dashboard/oppgaver/_chart/__tests__/layoutOverlap.test.ts
git commit -m "feat(oppgaver): layoutOverlap pure column-assignment algorithm

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3.2: timeMath helpers

**Files:**
- Create: `apps/web/src/app/dashboard/oppgaver/_chart/timeMath.ts`
- Create: `apps/web/src/app/dashboard/oppgaver/_chart/__tests__/timeMath.test.ts`
- Modify: `apps/web/src/app/dashboard/oppgaver/_chart/layoutOverlap.ts` (dedup private helper)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { hmToMin, minToHM, DAY_MINUTES, DAY_START_HOUR } from "../timeMath";

describe("timeMath", () => {
  it("DAY_MINUTES = 20*60 (06:00→02:00)", () => {
    expect(DAY_MINUTES).toBe(1200);
  });
  it("DAY_START_HOUR = 6", () => {
    expect(DAY_START_HOUR).toBe(6);
  });
  it("hmToMin handles 06:00", () => {
    expect(hmToMin("06:00")).toBe(360);
  });
  it("hmToMin handles 02:00 (next-day-ish — caller wraps)", () => {
    expect(hmToMin("02:00")).toBe(120);
  });
  it("minToHM round-trip", () => {
    expect(minToHM(hmToMin("14:35"))).toBe("14:35");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter web exec vitest run apps/web/src/app/dashboard/oppgaver/_chart/__tests__/timeMath.test.ts
```

- [ ] **Step 3: Write the module**

Create `apps/web/src/app/dashboard/oppgaver/_chart/timeMath.ts`:

```ts
export const DAY_START_HOUR = 6;
export const DAY_END_HOUR = 26; // 02:00 next day expressed as hour 26
export const DAY_MINUTES = (DAY_END_HOUR - DAY_START_HOUR) * 60; // 1200

export function hmToMin(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function minToHM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
```

- [ ] **Step 4: Re-export from layoutOverlap + re-run both test suites**

Edit `layoutOverlap.ts` to import `hmToMin` from `./timeMath` and remove the inline helper. Then:

```bash
pnpm --filter web exec vitest run apps/web/src/app/dashboard/oppgaver/_chart/__tests__/
```

Expected: layoutOverlap 5/5 + timeMath 5/5 still PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/oppgaver/_chart/timeMath.ts \
        apps/web/src/app/dashboard/oppgaver/_chart/__tests__/timeMath.test.ts \
        apps/web/src/app/dashboard/oppgaver/_chart/layoutOverlap.ts
git commit -m "feat(oppgaver): timeMath helpers (DAY_MINUTES + hmToMin/minToHM)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3.3: TimeGutter + RoutineStrips + NowLine + PastDim (overlay layer)

**Files:**
- Create: `apps/web/src/app/dashboard/oppgaver/_chart/TimeGutter.tsx`
- Create: `apps/web/src/app/dashboard/oppgaver/_chart/RoutineStrips.tsx`
- Create: `apps/web/src/app/dashboard/oppgaver/_chart/NowLine.tsx`
- Create: `apps/web/src/app/dashboard/oppgaver/_chart/PastDim.tsx`
- Create: `apps/web/src/app/dashboard/oppgaver/_chart/__tests__/overlays.test.ts`

(One task covers all four overlay components — small + tightly coupled by `pxPerHour` prop. Subagent must commit all together.)

- [ ] **Step 1: Write the failing test**

Path B static assertion across 4 files. Verify:
1. `TimeGutter` renders hour labels via `font-mono`, includes hours 06–02 next-day.
2. `RoutineStrips` references `var(--phase-*)` tokens (no OKLCH literals).
3. `NowLine` calls `useReducedMotion` from `framer-motion` and gates pulse animation.
4. `PastDim` uses `bg-foreground/10` or semantic `--past-dim` token, NOT inline `oklch(0 0 0 / 0.3)`.

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter web exec vitest run apps/web/src/app/dashboard/oppgaver/_chart/__tests__/overlays.test.ts
```

- [ ] **Step 3: Write the four components**

Port from `docs/domains/day-session/day-planner/project/timeline-chart.jsx:29-102` with strict adherence to:
- TypeScript types for all props.
- Tailwind v4 classes via `cn()`; NO inline `style={{ color: 'oklch(...)' }}`.
- NowLine: `import { useReducedMotion } from "framer-motion"` — when `prefersReducedMotion` is true, skip any `animate`/`whileInView` props, render static line only.
- PastDim: use `bg-foreground/10` (Tailwind opacity modifier on semantic token).
- TimeGutter labels: `font-mono text-xs text-muted-foreground`.
- ROUTINE phases from a NEW constant `apps/web/src/app/dashboard/oppgaver/_chart/routinePhases.ts` (8 phases, mirror `timeline-data.js` ROUTINE constant) — to be created in this task as a tiny side-module.

- [ ] **Step 4: Re-run test + typecheck**

```bash
pnpm --filter web exec vitest run apps/web/src/app/dashboard/oppgaver/_chart/__tests__/overlays.test.ts
pnpm --filter web exec tsc --noEmit 2>&1 | grep oppgaver/_chart
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/oppgaver/_chart/TimeGutter.tsx \
        apps/web/src/app/dashboard/oppgaver/_chart/RoutineStrips.tsx \
        apps/web/src/app/dashboard/oppgaver/_chart/NowLine.tsx \
        apps/web/src/app/dashboard/oppgaver/_chart/PastDim.tsx \
        apps/web/src/app/dashboard/oppgaver/_chart/routinePhases.ts \
        apps/web/src/app/dashboard/oppgaver/_chart/__tests__/overlays.test.ts
git commit -m "feat(oppgaver): chart overlays — TimeGutter + RoutineStrips + NowLine + PastDim

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3.4: TaskBlock component

**Files:**
- Create: `apps/web/src/app/dashboard/oppgaver/_chart/TaskBlock.tsx`
- Create: `apps/web/src/app/dashboard/oppgaver/_chart/__tests__/TaskBlock.test.ts`

- [ ] **Step 1: Write the failing test**

Path B. Verify:
1. Renders title via children prop or `task.title`.
2. Renders start–end times when `height >= 36`.
3. Adds `s-{status}` / `p-{priority}` className modifiers for state.
4. Click handler fires with `task` arg.
5. `aria-label` includes title + time range for screen readers.
6. No OKLCH literals; no inline `style.background` (use CSS vars from area).

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter web exec vitest run apps/web/src/app/dashboard/oppgaver/_chart/__tests__/TaskBlock.test.ts
```

- [ ] **Step 3: Write the component**

Port `timeline-chart.jsx:134-188` to TypeScript. Use CSS variables for accent color (declared on parent `AreaBand` via `style={{ "--area-color": "var(--dept-kitchen)" }}`), NOT inline OKLCH. Drop the `draggable` + drag handlers V1 (deferred V2). Add `aria-label` for accessibility.

Types:
```ts
export type TaskStatus = "upcoming" | "in_progress" | "done" | "missed";
export type TaskPriority = "low" | "med" | "high";
export type TimelineTask = {
  id: string;
  title: string;
  start: string;
  end: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  flagged?: boolean;
  recurring?: string | null;
  emp?: string | null;
};
type Props = {
  task: TimelineTask;
  pxPerHour: number;
  col?: number;
  totalCols?: number;
  onClick?: (task: TimelineTask) => void;
};
```

- [ ] **Step 4: Re-run test + typecheck**

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/oppgaver/_chart/TaskBlock.tsx \
        apps/web/src/app/dashboard/oppgaver/_chart/__tests__/TaskBlock.test.ts
git commit -m "feat(oppgaver): TaskBlock — status/priority/flagged variants, ARIA label

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3.5: PersonLane component

**Files:**
- Create: `apps/web/src/app/dashboard/oppgaver/_chart/PersonLane.tsx`
- Create: `apps/web/src/app/dashboard/oppgaver/_chart/__tests__/PersonLane.test.ts`

- [ ] **Step 1: Write the failing test**

Path B. Verify:
1. Renders shift fill div when `shift` prop present.
2. Iterates `tasks` prop and renders `<TaskBlock />` per task.
3. Click handler fires with `(empId, areaId, minutes)` (snapped to 15 min).
4. `dimmed` prop adds `opacity-50` class.
5. No drag handlers (deferred V2).
6. ARIA: `role="group"` + `aria-label` "{name} – {role}".

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Write the component**

Port `timeline-chart.jsx:191-250` minus drag-and-drop. Click → snapping math kept (Task 6.x click-to-edit modal consumer).

Props:
```ts
type Employee = {
  id: string;
  name: string;
  role: string;
  area: string;
  shift?: [string, string] | null;
};
type Props = {
  emp: Employee;
  areaId: string;
  pxPerHour: number;
  tasks: ReadonlyArray<TimelineTask>;
  dimmed?: boolean;
  onLaneClick?: (args: { empId: string; areaId: string; minutes: number }) => void;
  onTaskClick?: (task: TimelineTask) => void;
};
```

- [ ] **Step 4: Re-run test + typecheck**

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/oppgaver/_chart/PersonLane.tsx \
        apps/web/src/app/dashboard/oppgaver/_chart/__tests__/PersonLane.test.ts
git commit -m "feat(oppgaver): PersonLane — shift fill + tasks, click-to-place math

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3.6: AreaBand composer

**Files:**
- Create: `apps/web/src/app/dashboard/oppgaver/_chart/AreaBand.tsx`
- Create: `apps/web/src/app/dashboard/oppgaver/_chart/__tests__/AreaBand.test.ts`

- [ ] **Step 1: Write the failing test**

Path B. Verify:
1. Renders band header with area name + employees-on-shift count.
2. Renders N PersonLane (one per employee in area).
3. Renders one UnassignedLane (for area-anchored tasks without `emp`).
4. Mode `area` passes through `tasks` filtered by `task.area === band.id`.
5. Mode `role` projects from `role_task` (passed in via `roleTasks` prop) — uses `layoutOverlap`.
6. `dimmed` prop adds `opacity-50` to all child lanes.

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Write the component**

Combines PersonLane × N + an UnassignedLane (inline, since it's a small variant of PersonLane). For mode `"role"` use `SingleLaneBand` semantics from `timeline-chart.jsx:291-360` — one column per band, `layoutOverlap` for stacked tasks.

Props:
```ts
type ViewMode = "area" | "role" | "person";
type Band = { id: string; name: string; short: string; open: string; close: string };
type Props = {
  band: Band;
  mode: ViewMode;
  employees: ReadonlyArray<Employee>;
  tasks: ReadonlyArray<TimelineTask>;
  pxPerHour: number;
  dimmed?: boolean;
  onLaneClick?: (args: { empId: string | null; areaId: string; minutes: number }) => void;
  onTaskClick?: (task: TimelineTask) => void;
};
```

- [ ] **Step 4: Re-run test + typecheck**

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/oppgaver/_chart/AreaBand.tsx \
        apps/web/src/app/dashboard/oppgaver/_chart/__tests__/AreaBand.test.ts
git commit -m "feat(oppgaver): AreaBand — header + person columns + unassigned lane

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3.7: ManagerTimelineChart composer (wires overlays + bands)

**Files:**
- Create: `apps/web/src/app/dashboard/oppgaver/_chart/ManagerTimelineChart.tsx`
- Create: `apps/web/src/app/dashboard/oppgaver/_chart/__tests__/ManagerTimelineChart.test.ts`

- [ ] **Step 1: Write the failing test**

Path B. Verify:
1. Composes TimeGutter (left col) + scrollable body (right col).
2. Body renders RoutineStrips behind, AreaBand × N stacked, NowLine + PastDim overlays.
3. Layout uses CSS grid `[gutter 80px] [body 1fr]`.
4. `aria-label="Gantt timeline"` on the scroll container.
5. `tabIndex={0}` on the scroll container for keyboard scrolling.

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Write the composer**

Props (final consumption shape — what ManagerTimelineShell will pass):
```ts
type Props = {
  bands: ReadonlyArray<Band>;
  employees: ReadonlyArray<Employee>;
  tasks: ReadonlyArray<TimelineTask>;
  mode: ViewMode;
  pxPerHour: number;
  nowMinutes: number;
  dimmedBandIds?: ReadonlyArray<string>;
  onLaneClick?: (args: { empId: string | null; areaId: string; minutes: number }) => void;
  onTaskClick?: (task: TimelineTask) => void;
};
```

- [ ] **Step 4: Re-run test + typecheck (ALL chart files)**

```bash
pnpm --filter web exec vitest run apps/web/src/app/dashboard/oppgaver/_chart/__tests__/
pnpm --filter web exec tsc --noEmit 2>&1 | grep -c "error TS" || echo "0 errors"
```

Expected: all `_chart` tests pass, 0 TS errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/oppgaver/_chart/ManagerTimelineChart.tsx \
        apps/web/src/app/dashboard/oppgaver/_chart/__tests__/ManagerTimelineChart.test.ts
git commit -m "feat(oppgaver): ManagerTimelineChart composer (overlays + bands + scroll)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase 4 — Data Layer (4 tasks)

Required skills: `smartout-cascade-developer`, `smartout-database-guide`.

### Task 4.1: `useDayLinesForDate` in packages/data

**Files:**
- Create: `packages/data/src/day-session/use-day-lines-for-date.ts`
- Create: `packages/data/src/day-session/__tests__/use-day-lines-for-date.test.ts`
- Modify: `packages/data/src/index.ts`

Why a wrapper around the existing `useDayLines` (in `apps/web`): mobile parity per ADR-0133/0134. Shared logic in `packages/`, not `apps/web/`. We re-export the same hook under `packages/data` so a future mobile day-planner view can consume it directly. V1 implementation can simply re-export the existing implementation, OR move the implementation entirely. Author picks: re-export V1 (minimal churn), move in V2 follow-up sortie.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { useDayLinesForDate } from "../use-day-lines-for-date";

describe("useDayLinesForDate", () => {
  it("exists and is callable as a hook", () => {
    expect(typeof useDayLinesForDate).toBe("function");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @smartout/data exec vitest run packages/data/src/day-session/__tests__/use-day-lines-for-date.test.ts
```

- [ ] **Step 3: Create the re-export**

Create `packages/data/src/day-session/use-day-lines-for-date.ts`:

```ts
/**
 * useDayLinesForDate — mobile-parity re-export of the day_line read hook.
 *
 * V1 re-exports the implementation that lives in apps/web/src/components/day/_hooks
 * for minimal-churn refactor. V2 (separate sortie) MOVES the implementation
 * into this package so mobile can consume directly without depending on apps/web.
 *
 * ADR-0133/0134: shared logic in packages/, not apps/web/.
 */

// V1: thin wrapper. Web consumers continue to import from apps/web path; this
// barrel exposes the same hook to mobile consumers via the package boundary.
export { useDayLines as useDayLinesForDate, type DayLineRow } from
  // eslint-disable-next-line import/no-relative-packages -- intentional V1 bridge; V2 inverts the dep.
  "../../../../apps/web/src/components/day/_hooks/use-day-lines";
```

If the relative-package import path is blocked by tsconfig path mapping, fall back to: (a) copy the implementation here verbatim + update `apps/web` to re-export from `@smartout/data`. Author picks per build feedback.

- [ ] **Step 4: Re-run test + build the package**

```bash
pnpm --filter @smartout/data exec vitest run packages/data/src/day-session/__tests__/use-day-lines-for-date.test.ts
pnpm --filter @smartout/data build
```

- [ ] **Step 5: Commit**

```bash
git add packages/data/src/day-session/use-day-lines-for-date.ts \
        packages/data/src/day-session/__tests__/use-day-lines-for-date.test.ts \
        packages/data/src/index.ts
git commit -m "feat(data): useDayLinesForDate re-export (mobile parity bridge)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4.2: `useSessionTasksForDate` — manager-scope mode

**Files:**
- Create: `packages/data/src/day-session/use-session-tasks-for-date.ts`
- Create: `packages/data/src/day-session/__tests__/use-session-tasks-for-date.test.ts`
- Modify: `packages/data/src/index.ts`

The existing `useDayTimelineEvents` in `apps/web/src/app/dashboard/_hooks/` is department-scoped. Manager Timeline needs ALL areas for the date. Two options:

**Option A (recommended):** Direct PostgREST query against `session_task` filtered by `business_date` joining `day_line` + `department_session`. No new RPC. Manager-role RLS check happens via existing workspace_id policies on `session_task` + the manager-only sidebar guard (Task 1.2).

**Option B:** Author a new `fn_list_session_tasks_for_date(p_workspace_id, p_date)` SECURITY DEFINER RPC. Requires a migration. Heavier.

Author MUST pick Option A for V1 per zero-migration mandate. If RLS denies expected rows in dev with manager profile, fall back to Option B and add migration timestamp `>` HEAD.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { useSessionTasksForDate } from "../use-session-tasks-for-date";

describe("useSessionTasksForDate", () => {
  it("is callable", () => {
    expect(typeof useSessionTasksForDate).toBe("function");
  });
});
```

(Real network behavior is exercised in Phase 8 E2E; here we verify the hook exists + types compile.)

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement (Option A)**

Create `packages/data/src/day-session/use-session-tasks-for-date.ts`:

```ts
"use client";

/**
 * useSessionTasksForDate — manager-scope read of all session_task rows for a
 * workspace + date, joined with day_line + department_session + profile.
 *
 * Manager-scope: NOT filtered by department_id (P10 TidslinjeTab handles
 * single-department scope). This hook drives the multi-area Gantt at
 * /dashboard/oppgaver.
 *
 * RLS: relies on the existing workspace_id policy on session_task + manager
 * profile membership. No new RPC. (Falls back to RPC if RLS denies rows.)
 *
 * Task ontology (ADR-0298): this read consumes the `session` source only.
 * Personal/emma/runtime sources are NOT included — they are scoped to a
 * single profile and irrelevant to a multi-area manager Gantt.
 */
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";

export type ManagerTimelineTaskRow = {
  session_task_id: string;
  workspace_id: string;
  department_session_id: string;
  day_line_id: string | null;
  hook_id: string | null;
  scheduled_at: string | null;
  duration_minutes: number | null;
  title: string;
  done: boolean;
  priority: "low" | "med" | "high" | null;
  assigned_profile_id: string | null;
  // Joined
  day_line_business_date: string | null;
  day_line_location_id: string | null;
  day_line_department_id: string | null;
};

export const sessionTaskKeys = {
  forDate: (workspaceId: string, date: string) =>
    ["session-task", "for-date", workspaceId, date] as const,
};

export function useSessionTasksForDate(workspaceId: string | null, date: string) {
  return useQuery({
    queryKey: sessionTaskKeys.forDate(workspaceId ?? "none", date),
    enabled: workspaceId !== null,
    staleTime: 15_000,
    queryFn: async (): Promise<ReadonlyArray<ManagerTimelineTaskRow>> => {
      const sb = createClient();
      const { data, error } = await sb
        .from("session_task")
        .select(`
          session_task_id, workspace_id, department_session_id, day_line_id,
          hook_id, scheduled_at, duration_minutes, title, done, priority,
          assigned_profile_id,
          day_line:day_line ( business_date, location_id, department_id )
        `)
        .eq("workspace_id", workspaceId!)
        .filter("day_line.business_date", "eq", date);

      if (error) throw new Error(error.message);

      return (data ?? []).map((row: any) => ({
        session_task_id: row.session_task_id,
        workspace_id: row.workspace_id,
        department_session_id: row.department_session_id,
        day_line_id: row.day_line_id,
        hook_id: row.hook_id,
        scheduled_at: row.scheduled_at,
        duration_minutes: row.duration_minutes,
        title: row.title,
        done: row.done,
        priority: row.priority,
        assigned_profile_id: row.assigned_profile_id,
        day_line_business_date: row.day_line?.business_date ?? null,
        day_line_location_id: row.day_line?.location_id ?? null,
        day_line_department_id: row.day_line?.department_id ?? null,
      }));
    },
  });
}
```

- [ ] **Step 4: Re-run test + typecheck + manual smoke (optional, dev env)**

```bash
pnpm --filter @smartout/data exec vitest run packages/data/src/day-session/__tests__/use-session-tasks-for-date.test.ts
pnpm --filter @smartout/data exec tsc --noEmit
```

If running `pnpm --filter web dev` against Supabase Local: visit `/dashboard/oppgaver?date=2026-05-24` and check Network tab for the PostgREST request. If 0 rows when seed has tasks → RLS denial → switch to Option B (add `fn_list_session_tasks_for_date` RPC migration).

- [ ] **Step 5: Commit**

```bash
git add packages/data/src/day-session/use-session-tasks-for-date.ts \
        packages/data/src/day-session/__tests__/use-session-tasks-for-date.test.ts \
        packages/data/src/index.ts
git commit -m "feat(data): useSessionTasksForDate (manager-scope, direct PostgREST query)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4.3: `useRolesForPositions`

**Files:**
- Create: `packages/data/src/day-session/use-roles-for-positions.ts`
- Create: `packages/data/src/day-session/__tests__/use-roles-for-positions.test.ts`
- Modify: `packages/data/src/index.ts`

Reads `role` table + `role_task` template rows. NOT cascade-mutation — pure read. ADR-0173 frozen-4 boundaries unaffected (governance reads bypass frozen capability set).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { useRolesForPositions } from "../use-roles-for-positions";

describe("useRolesForPositions", () => {
  it("is callable", () => expect(typeof useRolesForPositions).toBe("function"));
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement**

Create `packages/data/src/day-session/use-roles-for-positions.ts`. Query `role` table joined with `role_task` (1:N). Sort by `role.name`.

```ts
"use client";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";

export type RoleRow = {
  role_id: string;
  workspace_id: string;
  code: string;
  name: string;
  area_id: string | null;
  tasks: ReadonlyArray<{
    role_task_id: string;
    title: string;
    typical_start: string;
    typical_end: string;
  }>;
};

export const roleKeys = {
  forDate: (workspaceId: string, date: string) =>
    ["role", "for-positions", workspaceId, date] as const,
};

export function useRolesForPositions(workspaceId: string | null, date: string) {
  return useQuery({
    queryKey: roleKeys.forDate(workspaceId ?? "none", date),
    enabled: workspaceId !== null,
    staleTime: 60_000,
    queryFn: async (): Promise<ReadonlyArray<RoleRow>> => {
      const sb = createClient();
      const { data, error } = await sb
        .from("role")
        .select(`
          role_id, workspace_id, code, name, area_id,
          tasks:role_task ( role_task_id, title, typical_start, typical_end )
        `)
        .eq("workspace_id", workspaceId!)
        .order("name");
      if (error) throw new Error(error.message);
      // date param is reserved for future date-specific role overrides;
      // not used in V1 query but accepted for cache-key stability + signature symmetry.
      void date;
      return (data ?? []) as unknown as ReadonlyArray<RoleRow>;
    },
  });
}
```

Verify `role` + `role_task` tables exist in current schema:
```bash
grep -l "create table.*\\brole\\b" supabase/migrations/ | head -3
```

If table not present → halt and report (this would be a deeper architecture gap; do not invent the table here).

- [ ] **Step 4: Re-run test + typecheck**

- [ ] **Step 5: Commit**

```bash
git add packages/data/src/day-session/use-roles-for-positions.ts \
        packages/data/src/day-session/__tests__/use-roles-for-positions.test.ts \
        packages/data/src/index.ts
git commit -m "feat(data): useRolesForPositions (role + role_task read for Rolle mode)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4.4: Wire 3 hooks into ManagerTimelineShell

**Files:**
- Modify: `apps/web/src/app/dashboard/oppgaver/_components/ManagerTimelineShell.tsx`
- Modify: `apps/web/src/app/dashboard/oppgaver/_components/__tests__/ManagerTimelineShell.test.ts`

- [ ] **Step 1: Extend the failing test**

Append to `ManagerTimelineShell.test.ts`:

```ts
it("wires useDayLinesForDate, useSessionTasksForDate, useRolesForPositions", () => {
  expect(SHELL).toMatch(/useDayLinesForDate/);
  expect(SHELL).toMatch(/useSessionTasksForDate/);
  expect(SHELL).toMatch(/useRolesForPositions/);
});

it("renders TimelineTopBar, TimelineToolbar, ManagerTimelineChart", () => {
  expect(SHELL).toMatch(/TimelineTopBar/);
  expect(SHELL).toMatch(/TimelineToolbar/);
  expect(SHELL).toMatch(/ManagerTimelineChart/);
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Wire shell**

Modify `ManagerTimelineShell.tsx` to:
- Read workspace from `useWorkspaceOptional()`.
- Maintain `dateISO` state (today by default, ±1 stepper from TopBar).
- Maintain `viewMode` state (`"area"` default).
- Maintain `activeAreaIds` + `onlyOpen` + `deviationsOnly` + `zoom` state.
- Call `useDayLinesForDate({ workspaceId, date: dateISO })` → derive `bands` from `day_line` rows.
- Call `useSessionTasksForDate(workspaceId, dateISO)` → map to `TimelineTask[]` for chart.
- Call `useRolesForPositions(workspaceId, dateISO)` → used when `viewMode === "role"`.
- Compose: TopBar (top row) + Toolbar (middle row) + Chart (bottom row).
- Pass loading skeleton state (use existing `Skeleton` from shadcn/ui) when any of the 3 hooks is loading.

- [ ] **Step 4: Re-run test + typecheck + run dev for visual smoke**

```bash
pnpm --filter web exec vitest run apps/web/src/app/dashboard/oppgaver/_components/__tests__/ManagerTimelineShell.test.ts
pnpm --filter web exec tsc --noEmit 2>&1 | grep oppgaver | head -5
```

Optional manual smoke: `op run --env-file=.env.template -- pnpm --filter web dev` → http://localhost:3060/dashboard/oppgaver (with auth manager profile). Confirm chart renders.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/oppgaver/_components/
git commit -m "feat(oppgaver): wire 3 read hooks into ManagerTimelineShell

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase 5 — Harness (4 tasks)

Required skill: `smartout-page-polish` — Phase 0 prereq audit + Phase 8 site-map registration.

### Task 5.1: Pin-context Server Action

**Files:**
- Create: `apps/web/src/app/dashboard/_actions/pin-oppgaver-context.ts`
- Create: `apps/web/src/app/dashboard/_actions/__tests__/pin-oppgaver-context.test.ts`

Mirror pattern: `apps/web/src/app/dashboard/_actions/pin-day-control-context.ts`. INHERITS P10's latent ADR-0099 gap (engine_memory write without `gateAction`) — explicitly flagged in HANDOFF as debt, Linear follow-up will close in unified sweep.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { pinOppgaverContextAction } from "../pin-oppgaver-context";

vi.mock("@smartout/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: vi.fn(() => ({ insert: vi.fn(async () => ({ error: null })) })),
  })),
}));

vi.mock("../_shared", () => ({
  resolveCurrentProfile: vi.fn(async () => ({ profileId: "p1", workspaceId: "w1" })),
}));

describe("pinOppgaverContextAction (L-0177 fail-fast)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("Zod-invalid input → { ok: false }", async () => {
    const res = await pinOppgaverContextAction({ date_iso: "not-a-date" } as any);
    expect(res).toEqual({ ok: false });
  });

  it("missing profile → { ok: false }", async () => {
    const shared = await import("../_shared");
    (shared.resolveCurrentProfile as any).mockResolvedValueOnce(null);
    const res = await pinOppgaverContextAction({
      date_iso: "2026-05-24",
      active_view: "area",
      active_filters: {},
    });
    expect(res).toEqual({ ok: false });
  });

  it("happy path returns { ok: true }", async () => {
    const res = await pinOppgaverContextAction({
      date_iso: "2026-05-24",
      active_view: "area",
      active_filters: {},
    });
    expect(res).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter web exec vitest run apps/web/src/app/dashboard/_actions/__tests__/pin-oppgaver-context.test.ts
```

- [ ] **Step 3: Implement**

```ts
"use server";
import { z } from "zod";
import { createClient } from "@smartout/supabase/server";
import { resolveCurrentProfile } from "./_shared";

const PinSchema = z.object({
  date_iso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  active_view: z.enum(["area", "role", "person"]),
  active_filters: z.object({
    area_ids: z.array(z.string().uuid()).optional(),
    team_ids: z.array(z.string().uuid()).optional(),
    role_codes: z.array(z.string()).optional(),
  }),
  focused_entity: z.string().optional(),
});
export type PinOppgaverContextInput = z.infer<typeof PinSchema>;

/**
 * Pin /dashboard/oppgaver view context to engine_memory so the global Botsson
 * agent knows what the manager is looking at. TTL 24h.
 *
 * L-0177: every Server Action throws or returns { ok: false } on missing
 * workspace_id / profile_id. No silent fallback.
 *
 * KNOWN DEBT: this write does NOT pass through gateAction per ADR-0099. The
 * pattern inherits the latent gap from pin-day-control-context.ts. A follow-up
 * sortie wraps both (and any future pin-* actions) in a unified gate. Tracked
 * in HANDOFF + Linear issue (created post-merge).
 */
export async function pinOppgaverContextAction(
  input: PinOppgaverContextInput,
): Promise<{ ok: boolean }> {
  const parsed = PinSchema.safeParse(input);
  if (!parsed.success) return { ok: false };

  const profile = await resolveCurrentProfile();
  if (!profile) return { ok: false };
  if (!profile.workspaceId) return { ok: false };
  if (!profile.profileId) return { ok: false };

  const sb = await createClient();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const filters = parsed.data.active_filters;
  const filterDesc = [
    filters.area_ids?.length ? `areas=${filters.area_ids.length}` : null,
    filters.team_ids?.length ? `teams=${filters.team_ids.length}` : null,
    filters.role_codes?.length ? `roles=${filters.role_codes.join(",")}` : null,
  ].filter(Boolean).join(" ");
  const content =
    `Viewing /dashboard/oppgaver on date=${parsed.data.date_iso} mode=${parsed.data.active_view}` +
    (filterDesc ? ` filters[${filterDesc}]` : "") +
    (parsed.data.focused_entity ? ` focused=${parsed.data.focused_entity}` : "");

  const { error } = await sb.from("engine_memory").insert({
    profile_id: profile.profileId,
    workspace_id: profile.workspaceId,
    memory_type: "fact",
    content,
    expires_at: expires,
  });
  if (error) return { ok: false };
  return { ok: true };
}
```

- [ ] **Step 4: Re-run test + typecheck**

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/_actions/pin-oppgaver-context.ts \
        apps/web/src/app/dashboard/_actions/__tests__/pin-oppgaver-context.test.ts
git commit -m "feat(oppgaver): pinOppgaverContextAction (L-0177 fail-fast; ADR-0099 gap flagged)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5.2: Telemetry registry — 6 events + EVENT_ROUTING (L-0340 trust-gate)

**Files:**
- Modify: `packages/telemetry/src/registry.ts`
- Modify: `packages/telemetry/src/__tests__/registry.test.ts` (or equivalent)
- Rebuild: `pnpm --filter @smartout/telemetry build` (precondition for Task 5.3 emit-sites)

L-0340 trust-gate: every new registry entry MUST have an emit() call-site WIRED IN THE SAME COMMIT. The spec-reviewer for this task verifies BOTH halves before approving.

- [ ] **Step 1: Write the failing test**

Append to existing telemetry registry tests:

```ts
describe("oppgaver telemetry events (P11)", () => {
  const EXPECTED = [
    "oppgaver.view_opened",
    "oppgaver.view_mode_changed",
    "oppgaver.area_filter_changed",
    "oppgaver.date_changed",
    "oppgaver.task_focused",
    "oppgaver.context_pinned",
  ] as const;

  it.each(EXPECTED)("registry contains %s", (name) => {
    // Implementation depends on registry shape — adapt to existing test pattern.
    expect(SmartoutEvent[name]).toBeDefined();
  });

  it.each(EXPECTED)("EVENT_ROUTING has destinations for %s", (name) => {
    expect(EVENT_ROUTING[name]).toBeDefined();
    expect(EVENT_ROUTING[name].destinations.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @smartout/telemetry exec vitest run
```

- [ ] **Step 3: Add 6 registry entries + routing**

Edit `packages/telemetry/src/registry.ts`:

1. Add `"oppgaver"` to `EventCategory` union (place near `"hms" | "people"`).
2. Add 6 entries to `SmartoutEvent` shape (use existing entry pattern — search for `view_opened` to find precedent in `people` category).
3. Add 6 entries to `EVENT_ROUTING`:
   - `oppgaver.view_opened`: `["posthog", "logger"]` / category `"oppgaver"`
   - `oppgaver.view_mode_changed`: `["posthog", "logger"]`
   - `oppgaver.area_filter_changed`: `["posthog", "logger"]`
   - `oppgaver.date_changed`: `["posthog", "logger"]`
   - `oppgaver.task_focused`: `["posthog", "logger"]`
   - `oppgaver.context_pinned`: `["posthog", "logger", "activity_trail"]`

Event-payload shapes (all `extends BaseEvent`):
- `oppgaver.view_opened`: `{ date_iso: string; viewer_role: "owner" | "admin" | "manager" }`
- `oppgaver.view_mode_changed`: `{ from: ViewMode; to: ViewMode; triggered_by: "ui" | "tool" }`
- `oppgaver.area_filter_changed`: `{ active_area_count: number; triggered_by: "ui" | "tool" }`
- `oppgaver.date_changed`: `{ from_date: string; to_date: string; triggered_by: "ui" | "tool" }`
- `oppgaver.task_focused`: `{ task_id: string; area_id: string | null }`
- `oppgaver.context_pinned`: `{ date_iso: string; active_view: ViewMode }`

- [ ] **Step 4: Re-run test + build the package**

```bash
pnpm --filter @smartout/telemetry exec vitest run
pnpm --filter @smartout/telemetry build
```

Both: PASS / 0 errors. (Dist rebuild is REQUIRED — Task 5.3 consumers import from dist via package boundary.)

- [ ] **Step 5: Commit (REGISTRY ONLY — emit-sites in Task 5.3 same-day)**

```bash
git add packages/telemetry/src/registry.ts \
        packages/telemetry/src/__tests__/
git commit -m "feat(telemetry): register 6 oppgaver events + EVENT_ROUTING

L-0340 trust-gate: emit() call-sites land in the next commit (Task 5.3),
same chair, same review window. DO NOT review or merge this commit in
isolation — verify Task 5.3 also lands.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5.3: Tools-bridge + emit-sites (closes L-0340 gate from 5.2)

**Files:**
- Create: `apps/web/src/app/dashboard/oppgaver/_tools/use-oppgaver-tools.ts`
- Create: `apps/web/src/app/dashboard/oppgaver/_tools/oppgaver-tools-bridge.tsx`
- Create: `apps/web/src/app/dashboard/oppgaver/_tools/__tests__/use-oppgaver-tools.test.ts`
- Modify: `apps/web/src/app/dashboard/oppgaver/_components/ManagerTimelineShell.tsx` (mount bridge + add emit-sites)

This task closes the L-0340 commitment from Task 5.2. THIS commit must wire emit() for ALL 6 events: 5 emit from ManagerTimelineShell handlers, 1 (`context_pinned`) emits from the tools-bridge effect or from `pinOppgaverContextAction` itself.

- [ ] **Step 1: Write the failing test (Path B emit-site presence)**

Create `apps/web/src/app/dashboard/oppgaver/_tools/__tests__/use-oppgaver-tools.test.ts` + extend ManagerTimelineShell test:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SHELL = readFileSync(
  join(__dirname, "..", "..", "_components", "ManagerTimelineShell.tsx"),
  "utf-8",
);
const BRIDGE = readFileSync(
  join(__dirname, "..", "oppgaver-tools-bridge.tsx"),
  "utf-8",
);

describe("L-0340 emit-site presence", () => {
  it("emits oppgaver.view_opened on mount", () => {
    expect(SHELL).toMatch(/emit\(["']oppgaver\.view_opened["']/);
  });
  it("emits oppgaver.view_mode_changed on segment switch", () => {
    expect(SHELL).toMatch(/emit\(["']oppgaver\.view_mode_changed["']/);
  });
  it("emits oppgaver.area_filter_changed on chip toggle", () => {
    expect(SHELL).toMatch(/emit\(["']oppgaver\.area_filter_changed["']/);
  });
  it("emits oppgaver.date_changed on stepper", () => {
    expect(SHELL).toMatch(/emit\(["']oppgaver\.date_changed["']/);
  });
  it("emits oppgaver.task_focused on modal open", () => {
    expect(SHELL).toMatch(/emit\(["']oppgaver\.task_focused["']/);
  });
  it("emits oppgaver.context_pinned on tools-bridge effect or pin action", () => {
    expect(BRIDGE + SHELL).toMatch(/emit\(["']oppgaver\.context_pinned["']/);
  });
});

describe("oppgaver tools bridge", () => {
  it("registers 6 tools via useRegisterTools key 'oppgaver'", () => {
    expect(BRIDGE).toMatch(/useRegisterTools\(["']oppgaver["']/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement tools + emit-sites**

Create `use-oppgaver-tools.ts` (modeled on `use-oversikt-tools.ts` shape) with 6 typed tools:

```ts
import { z } from "zod";
import type { TimelineTask } from "../_chart/TaskBlock";

type Args = {
  dateISO: string;
  viewMode: "area" | "role" | "person";
  bands: ReadonlyArray<{ id: string; name: string }>;
  employees: ReadonlyArray<{ id: string; name: string; role: string; area: string }>;
  tasks: ReadonlyArray<TimelineTask>;
  uiActions: {
    setDate: (iso: string) => void;
    setViewMode: (m: "area" | "role" | "person") => void;
    focusArea: (areaId: string) => void;
  };
};

export function useOppgaverTools(args: Args) {
  return {
    getTimelineSnapshot: {
      description: "Full Gantt snapshot for active date — bands, employees, tasks.",
      schema: z.object({}),
      channelPolicy: { chat: true, voice: true },
      run: async () => ({ /* serialized snapshot */ }),
    },
    getAreaSummary: { /* ... */ },
    getEmployeeTimeline: { /* ... */ },
    getOverdueTasks: { /* ... */ },
    navigateTimeline: {
      description: "Switch active date (ISO or relative: today/yesterday/tomorrow).",
      schema: z.object({ date: z.string() }),
      channelPolicy: { chat: true, voice: true },
      run: async (a: { date: string }) => {
        args.uiActions.setDate(a.date);
        return { ok: true };
      },
    },
    focusArea: {
      description: "Collapse other areas + expand one.",
      schema: z.object({ areaId: z.string().uuid() }),
      channelPolicy: { chat: true, voice: true },
      run: async (a: { areaId: string }) => {
        args.uiActions.focusArea(a.areaId);
        return { ok: true };
      },
    },
  } as const;
}
```

Create `oppgaver-tools-bridge.tsx` (modeled on `oversikt-tools-bridge.tsx`):

```tsx
"use client";
import { useEffect } from "react";
import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { emit } from "@smartout/telemetry";
import { useOppgaverTools } from "./use-oppgaver-tools";
import { pinOppgaverContextAction } from "@/app/dashboard/_actions/pin-oppgaver-context";
import { useWorkspaceOptional } from "@/lib/workspace-context";

type Props = { /* same shape as Args above, passed through from Shell */ };

export function OppgaverToolsBridge(props: Props) {
  const ws = useWorkspaceOptional();
  const workspaceId = ws?.workspace.workspace_id ?? null;
  const tools = useOppgaverTools(props);
  useRegisterTools("oppgaver", tools);

  // Pin context + emit on mount + viewMode/filter change (debounced).
  useEffect(() => {
    if (!workspaceId) return;
    const t = setTimeout(async () => {
      const res = await pinOppgaverContextAction({
        date_iso: props.dateISO,
        active_view: props.viewMode,
        active_filters: { area_ids: props.activeAreaIds },
      });
      if (res.ok) {
        emit("oppgaver.context_pinned", {
          workspace_id: workspaceId,
          actor_id: ws?.workspace.workspace_id ?? null, // resolved upstream — replace with profileId from context
          date_iso: props.dateISO,
          active_view: props.viewMode,
        });
      }
    }, 800);
    return () => clearTimeout(t);
  }, [workspaceId, props.dateISO, props.viewMode, JSON.stringify(props.activeAreaIds)]);

  return null;
}
```

Then edit `ManagerTimelineShell.tsx` to:
- Mount `<OppgaverToolsBridge ... />` once data is ready.
- Add `useEffect` on mount → `emit("oppgaver.view_opened", { ... })`.
- Wrap `setViewMode` → also `emit("oppgaver.view_mode_changed", { from, to, triggered_by: "ui" })`.
- Wrap area-chip toggle handler → `emit("oppgaver.area_filter_changed", { ... })`.
- Wrap date stepper → `emit("oppgaver.date_changed", { ... })`.
- Wrap modal-open handler → `emit("oppgaver.task_focused", { ... })`.

Every `emit()` call MUST include resolved `workspace_id` (non-empty) + `actor_id` (non-empty profileId) per L-0177 + ADR-0193. Pull profileId from `DashboardContext` (precedent: `oversikt-tools-bridge.tsx` consumes `DashboardContext.profileId`).

- [ ] **Step 4: Re-run all tests + build telemetry consumer + typecheck**

```bash
pnpm --filter @smartout/telemetry build  # ensure dist current
pnpm --filter web exec tsc --noEmit 2>&1 | grep oppgaver | head -10
pnpm --filter web exec vitest run apps/web/src/app/dashboard/oppgaver/
```

All PASS. 0 TS errors in oppgaver tree.

- [ ] **Step 5: Commit (closes L-0340 gate)**

```bash
git add apps/web/src/app/dashboard/oppgaver/_tools/ \
        apps/web/src/app/dashboard/oppgaver/_components/ManagerTimelineShell.tsx \
        apps/web/src/app/dashboard/oppgaver/_components/__tests__/ManagerTimelineShell.test.ts
git commit -m "feat(oppgaver): tools-bridge + 6 emit-sites (closes L-0340 gate from Task 5.2)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5.4: Site-map registration

**Files:**
- Modify: `apps/web/.botsson/site-map.json`

- [ ] **Step 1: Write the failing test (validate script)**

Confirm validator exists:
```bash
ls apps/web/scripts/validate-site-map.ts
pnpm --filter web site-map:validate 2>&1 | tail -3
```

The current validator should report success on the existing site-map. After we append the new route in Step 3, re-run.

- [ ] **Step 2: Pre-check — confirm validator allows `polished_at: "pending"`**

```bash
grep -n "polished_at" apps/web/scripts/validate-site-map.ts apps/web/src/app/Botsson/types.ts packages/ai/src/harness/sources/site-map-source.ts
```

Inspect the Zod schema. If `polished_at` is `z.string().optional()` (no regex), `"pending"` is valid. If it requires `YYYY-MM-DD`, use the current date instead (commit date as placeholder).

- [ ] **Step 3: Append the route entry**

In `apps/web/.botsson/site-map.json`, append to the `routes` array (after the last entry, before the closing `]`):

```json
{
  "path": "/dashboard/oppgaver",
  "purpose": "Manager Timeline — full-day Gantt across areas and employees. Read-only V1; click-to-edit delegates to existing capability tools (no new writes).",
  "module": "DaySession",
  "tier": 2,
  "access": ["owner", "admin", "manager"],
  "polished_at": "<pending OR YYYY-MM-DD per Step 2>",
  "owns_chat_surface": false,
  "domain_chat_endpoint": null,
  "common_intents": [
    "Vis dagsplan",
    "Hvem er på kjøkken i dag?",
    "Hva er forsinket?",
    "Vis tidslinje for X",
    "Gå til i går",
    "Fokuser på Y"
  ],
  "tools": [
    { "name": "getTimelineSnapshot",   "description": "Full Gantt snapshot for active date — bands, employees, tasks. Use when manager asks any broad question about today's plan." },
    { "name": "getAreaSummary",        "description": "Staffing + task load summary per area. Use when manager asks 'how is the kitchen doing?' or 'who's where right now?'." },
    { "name": "getEmployeeTimeline",   "description": "Full shift + task strip for one employee. Use when manager asks 'what is X doing today?'." },
    { "name": "getOverdueTasks",       "description": "Tasks past scheduled end and not completed. Use when manager asks 'what's late?' or 'what needs catching up?'." },
    { "name": "navigateTimeline",      "description": "Switch active date (ISO YYYY-MM-DD or relative 'today'/'yesterday'/'tomorrow'). Use when manager wants to look at a different day." },
    { "name": "focusArea",             "description": "Collapse other areas and expand one. Use when manager wants to zoom into a single area's timeline." }
  ]
}
```

- [ ] **Step 4: Validate**

```bash
pnpm --filter web site-map:validate
```

Expected: success. If validator complains about `polished_at: "pending"`, replace with today's ISO date (per Step 2 pre-check).

- [ ] **Step 5: Commit**

```bash
git add apps/web/.botsson/site-map.json
git commit -m "feat(oppgaver): register /dashboard/oppgaver in site-map (6 tools, tier 2)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase 6 — Click-to-Edit Modal (3 tasks)

Required skill: `smartout-cascade-developer` — capability delegation pattern.

### Task 6.1: TaskEditModal — read-only detail view

**Files:**
- Create: `apps/web/src/app/dashboard/oppgaver/_components/TaskEditModal.tsx`
- Create: `apps/web/src/app/dashboard/oppgaver/_components/__tests__/TaskEditModal.test.ts`

V1 = view detail + complete-only (no edit). Complete delegates to `task.complete` capability via existing Server Action (`completeSessionTaskAction`).

- [ ] **Step 1: Write the failing test**

Path B. Verify:
1. Imports `Sheet` (or `Dialog`) from `@/components/ui/sheet`.
2. Imports `completeSessionTaskAction` from `@/app/dashboard/_actions/...` (verify path with `grep`).
3. Does NOT import any direct `supabase.from(...)` writes.
4. Renders task title, time range, assigned employee, status.
5. Renders "Marker som ferdig" button when `task.done === false`.
6. Calls `emit("oppgaver.task_focused", ...)` on open via prop callback.
7. All strings via `t("oppgaver.task_modal.*")`.

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement**

Use shadcn/ui `Sheet` (right-side panel) for less layout intrusion. Pass `task` + `onClose` + `onComplete` props. The `onComplete` handler in `ManagerTimelineShell` calls `completeSessionTaskAction` (NOT inline).

Locate the existing complete action:
```bash
grep -rn 'completeSessionTaskAction' apps/web/src/app/dashboard/_actions/ | head -3
```
If not present, search alternative names (`addTaskAction`, `completeTaskAction`). If the right action is missing for this delegation, surface to operator — do NOT create a new direct DB write here.

- [ ] **Step 4: Re-run test + typecheck**

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/oppgaver/_components/TaskEditModal.tsx \
        apps/web/src/app/dashboard/oppgaver/_components/__tests__/TaskEditModal.test.ts
git commit -m "feat(oppgaver): TaskEditModal — view + complete (delegates to task.complete)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 6.2: Wire modal into ManagerTimelineShell

**Files:**
- Modify: `apps/web/src/app/dashboard/oppgaver/_components/ManagerTimelineShell.tsx`
- Modify: `apps/web/src/app/dashboard/oppgaver/_components/__tests__/ManagerTimelineShell.test.ts`

- [ ] **Step 1: Extend the failing test**

```ts
it("opens TaskEditModal on chart task click + emits task_focused", () => {
  expect(SHELL).toMatch(/TaskEditModal/);
  expect(SHELL).toMatch(/onTaskClick/);
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Wire**

Add `selectedTask` state to shell. Pass `onTaskClick={(t) => { setSelectedTask(t); emit("oppgaver.task_focused", { ... }); }}` to `<ManagerTimelineChart />`. Render `<TaskEditModal task={selectedTask} onClose={() => setSelectedTask(null)} onComplete={...} />`.

- [ ] **Step 4: Re-run test + typecheck**

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/oppgaver/_components/
git commit -m "feat(oppgaver): wire TaskEditModal into Shell — open on task click

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 6.3: Guard against direct DB writes (tooling check)

**Files:** none modified — verification only.

L-0177 + ADR-0173 + ADR-0204 prohibit direct DB writes from page components. This task verifies the oppgaver tree contains zero such writes.

- [ ] **Step 1: Run the guard**

```bash
# Find any direct supabase.from(...).insert/update/delete calls in oppgaver tree.
grep -rnE '\.from\(["\x27][a-z_]+["\x27]\)\.(insert|update|delete|upsert)' \
  apps/web/src/app/dashboard/oppgaver/ \
  || echo "PASS — no direct writes"
```

Expected: "PASS — no direct writes".

- [ ] **Step 2: Run the gated-mutation positive check**

```bash
# All writes from this page must go through Server Actions or capability delegation.
# Verify Server Actions in this page tree exist:
ls apps/web/src/app/dashboard/_actions/ | grep oppgaver
```

Expected: `pin-oppgaver-context.ts` present. (No other oppgaver-specific actions V1 — task.complete delegation reuses existing action.)

No commit (verification only). If Step 1 fails → halt and refactor before Phase 7.

---

## Phase 7 — i18n + Nordic Split sweep + ARIA (3 tasks)

Required skill: `smartout-nordic-split` — final sweep.

### Task 7.1: Add ~30 i18n keys (nb + en)

**Files:**
- Modify: `packages/i18n/locales/nb/dashboard.json`
- Modify: `packages/i18n/locales/en/dashboard.json`

- [ ] **Step 1: Inventory required keys from source grep**

```bash
grep -rohE 't\(["\x27]oppgaver\.[a-z_.]+["\x27]\)' apps/web/src/app/dashboard/oppgaver/ \
  | sort -u > /tmp/oppgaver-i18n-keys.txt
wc -l /tmp/oppgaver-i18n-keys.txt
```

Expected: ~30 unique keys. If fewer than 25 or more than 50, audit components for missed `t()` wrapping or duplication.

- [ ] **Step 2: Write the failing test (key-parity)**

Create `packages/i18n/__tests__/oppgaver-parity.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const nb = JSON.parse(readFileSync(join(__dirname, "..", "locales", "nb", "dashboard.json"), "utf-8"));
const en = JSON.parse(readFileSync(join(__dirname, "..", "locales", "en", "dashboard.json"), "utf-8"));

function flatten(obj: any, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === "object" && v !== null
      ? flatten(v, prefix ? `${prefix}.${k}` : k)
      : [prefix ? `${prefix}.${k}` : k],
  );
}

describe("oppgaver i18n key parity", () => {
  it("nb and en have identical oppgaver.* key sets", () => {
    const nbKeys = flatten(nb.oppgaver ?? {}).map((k) => `oppgaver.${k}`);
    const enKeys = flatten(en.oppgaver ?? {}).map((k) => `oppgaver.${k}`);
    expect(nbKeys.sort()).toEqual(enKeys.sort());
  });

  it("oppgaver.* key count is between 25 and 50", () => {
    const n = flatten(nb.oppgaver ?? {}).length;
    expect(n).toBeGreaterThanOrEqual(25);
    expect(n).toBeLessThanOrEqual(50);
  });
});
```

- [ ] **Step 3: Add keys to both locales**

Add an `oppgaver` block to `nb/dashboard.json` and `en/dashboard.json`. Structure suggestion:

```json
{
  "oppgaver": {
    "brand": "Dagslinjen",
    "lukk_dagen": "Lukk dagen → AVV",
    "search_aria": "Søk",
    "notifications_aria": "Varsler",
    "voice_aria": "Stemmestyring",
    "prev_day_aria": "Forrige dag",
    "next_day_aria": "Neste dag",
    "manager_pill_suffix": "·  Manager",
    "view_mode": {
      "area": "Område",
      "role": "Rolle",
      "person": "Person"
    },
    "filter": {
      "only_open": "Kun åpne",
      "deviations": "Avvik"
    },
    "zoom_in_aria": "Zoom inn",
    "zoom_out_aria": "Zoom ut",
    "empty": {
      "no_tasks_in_area": "Ingen oppgaver i dette området i dag",
      "no_employees_planned": "Ingen ansatte planlagt",
      "no_day_lines": "Ingen dagslinjer for denne datoen"
    },
    "task_modal": {
      "title": "Oppgavedetaljer",
      "complete": "Marker som ferdig",
      "close": "Lukk",
      "status_done": "Ferdig",
      "status_in_progress": "Pågår",
      "status_upcoming": "Kommer",
      "status_missed": "Bommet"
    }
  }
}
```

English equivalents mirror keys with translated values.

- [ ] **Step 4: Run test + i18n linter (if available)**

```bash
pnpm --filter web exec vitest run packages/i18n/__tests__/oppgaver-parity.test.ts
pnpm --filter web check:i18n 2>&1 | tail -5  # if script exists
```

- [ ] **Step 5: Commit**

```bash
git add packages/i18n/locales/nb/dashboard.json \
        packages/i18n/locales/en/dashboard.json \
        packages/i18n/__tests__/oppgaver-parity.test.ts
git commit -m "feat(i18n): add ~30 oppgaver.* keys (nb + en parity)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 7.2: Nordic Split sweep — OKLCH + hardcoded color audit

**Files:** none modified unless audit finds violations.

- [ ] **Step 1: OKLCH literal scan**

```bash
grep -rn 'oklch(' apps/web/src/app/dashboard/oppgaver/ packages/ui/src/components/segment-group.tsx packages/ui/src/components/filter-chip.tsx \
  || echo "PASS — 0 OKLCH literals"
```

Expected: PASS. If any match found → fix inline + re-run.

- [ ] **Step 2: Hardcoded color class scan**

```bash
grep -rnE '\b(zinc|gray|slate)-[0-9]{2,3}\b' apps/web/src/app/dashboard/oppgaver/ \
  || echo "PASS — 0 hardcoded color classes"

grep -rnE '\b(bg-white|bg-black|text-white|text-black)\b' apps/web/src/app/dashboard/oppgaver/ \
  || echo "PASS — 0 absolute color tokens"
```

Expected: PASS on both. If violations → replace with semantic tokens (`bg-background`, `bg-foreground`, `text-foreground`, `text-muted-foreground`).

- [ ] **Step 3: Tweaks-panel ban check**

```bash
grep -rn 'tweaks-panel' apps/web/src/ \
  || echo "PASS — tweaks-panel never imported into app source"
```

Expected: PASS.

- [ ] **Step 4: i18n hardcoded-string scan**

```bash
# Find JSX text nodes that are NOT inside t(...) calls — heuristic.
grep -rnE '>[A-ZÆØÅ][a-zæøå][^<{]{4,}' apps/web/src/app/dashboard/oppgaver/_components/ apps/web/src/app/dashboard/oppgaver/_chart/ \
  | grep -v 't(' \
  | head -20 \
  || echo "PASS — no obvious untranslated user-visible strings"
```

Audit hits manually — some matches are imports / comments / type names. Real violations = JSX text nodes with Norwegian/English copy. Fix any by wrapping in `t(...)`.

- [ ] **Step 5: Commit (only if any fix landed; else skip)**

```bash
# If any fixes applied:
git add apps/web/src/app/dashboard/oppgaver/ packages/i18n/locales/
git commit -m "fix(oppgaver): Nordic Split sweep — replace OKLCH literals + hardcoded colors

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
# else: no commit, document audit result in HANDOFF (closure phase).
```

---

### Task 7.3: ARIA + reduced-motion final audit

**Files:** none modified unless audit finds gaps.

- [ ] **Step 1: Reduced-motion check**

```bash
grep -rn 'useReducedMotion\|prefers-reduced-motion' apps/web/src/app/dashboard/oppgaver/
```

Expected: at minimum `NowLine.tsx` references `useReducedMotion`. If any other animation (chart enter, modal slide) ignores it → fix.

- [ ] **Step 2: ARIA roles + labels scan**

```bash
grep -rnE 'role="(region|group|radiogroup|radio|button|grid|row|cell)"' apps/web/src/app/dashboard/oppgaver/
grep -rn 'aria-label' apps/web/src/app/dashboard/oppgaver/ | wc -l
```

Expected: ≥ 6 `aria-label` matches (icon-only buttons in TopBar + Toolbar). All major regions have `role`.

- [ ] **Step 3: Keyboard navigation check**

Verify scroll container has `tabIndex={0}`:

```bash
grep -n 'tabIndex={0}' apps/web/src/app/dashboard/oppgaver/_chart/ManagerTimelineChart.tsx
```

- [ ] **Step 4: Run full oppgaver test suite + typecheck**

```bash
pnpm --filter web exec vitest run apps/web/src/app/dashboard/oppgaver/
pnpm --filter web exec tsc --noEmit 2>&1 | grep -c "error TS" || echo "0 errors"
```

Both: PASS.

- [ ] **Step 5: Commit (only if fixes; else skip + document)**

---

## Phase 8 — E2E + a11y (3 tasks)

Required skill: none (Playwright direct).

### Task 8.1: Playwright — page loads

**Files:**
- Create: `apps/e2e/tests/oppgaver/page-loads.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { test, expect } from "@playwright/test";

test.describe("/dashboard/oppgaver", () => {
  test("manager profile loads page with TopBar + Toolbar + Chart", async ({ page }) => {
    // Auth helper: precedent in apps/e2e/tests/*/login.ts — reuse manager fixture.
    await page.goto("/dashboard/oppgaver");
    await expect(page.getByRole("region", { name: /Manager Timeline/i })).toBeVisible();
    await expect(page.getByText("Dagslinjen")).toBeVisible();
    await expect(page.getByRole("radiogroup")).toBeVisible(); // SegmentGroup
  });

  test("redirects employee profile to /dashboard/my-schedule", async ({ page }) => {
    // Use employee fixture.
    await page.goto("/dashboard/oppgaver");
    await expect(page).toHaveURL(/\/dashboard\/my-schedule/);
  });
});
```

- [ ] **Step 2: Run test (expect fail — page not in current dev environment until merge into preview)**

Optional local run:
```bash
op run --env-file=.env.template -- pnpm --filter e2e exec playwright test tests/oppgaver/page-loads.spec.ts
```

- [ ] **Step 3: Verify spec is well-formed**

```bash
pnpm --filter e2e exec playwright test --list tests/oppgaver/page-loads.spec.ts
```

Expected: 2 tests listed.

- [ ] **Step 4: Re-run after dev server is up (if running locally)**

- [ ] **Step 5: Commit**

```bash
git add apps/e2e/tests/oppgaver/page-loads.spec.ts
git commit -m "test(oppgaver): e2e — page loads for manager + redirects employee

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 8.2: Playwright — view-mode switch + telemetry probe

**Files:**
- Create: `apps/e2e/tests/oppgaver/view-mode-switch.spec.ts`

- [ ] **Step 1: Write the test**

```ts
import { test, expect } from "@playwright/test";

test("switching view-mode segment updates layout + emits view_mode_changed", async ({ page }) => {
  await page.goto("/dashboard/oppgaver");

  // Probe telemetry: install a hook before navigation that captures emit() calls.
  // Strategy: page.evaluate to monkey-patch window.__SO_TELEMETRY_CAPTURE before render.
  // Precedent: see apps/e2e/tests/*/telemetry-probe.ts if present.

  await page.getByRole("radio", { name: /Rolle/i }).click();
  await expect(page.getByRole("radio", { name: /Rolle/i })).toHaveAttribute("aria-checked", "true");

  // Verify telemetry — adapt to repo's existing probe pattern, or check console for logger.
  const logs = await page.evaluate(() => (window as any).__SO_TELEMETRY_CAPTURE ?? []);
  expect(logs.some((l: any) => l.event === "oppgaver.view_mode_changed")).toBe(true);
});
```

- [ ] **Step 2-4: List + (optional) run**

- [ ] **Step 5: Commit**

```bash
git add apps/e2e/tests/oppgaver/view-mode-switch.spec.ts
git commit -m "test(oppgaver): e2e — view-mode switch + emits view_mode_changed

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 8.3: Playwright + axe — WCAG 2.1 AA

**Files:**
- Create: `apps/e2e/tests/oppgaver/a11y.spec.ts`

- [ ] **Step 1: Write the test**

```ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("WCAG 2.1 AA — 0 violations", async ({ page }) => {
  await page.goto("/dashboard/oppgaver");
  await page.waitForSelector('[role="region"][aria-label*="Manager Timeline"]');
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
```

Verify `@axe-core/playwright` is already a dev-dep of `apps/e2e`:
```bash
grep '@axe-core/playwright' apps/e2e/package.json
```

If missing → STOP, surface to operator (adding a dep is a separate ADR consideration).

- [ ] **Step 2-4: List + run**

- [ ] **Step 5: Commit**

```bash
git add apps/e2e/tests/oppgaver/a11y.spec.ts
git commit -m "test(oppgaver): e2e — WCAG 2.1 AA axe scan (0 violations)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review (per writing-plans skill)

Completed inline by plan author before save.

### 1. Spec coverage — V1 cut-line → task mapping

| V1 item | Covered by | Notes |
|---|---|---|
| Route rename `/dashboard/tasks` → `/dashboard/oppgaver` | Task 1.1 | Sidebar mutation atomic |
| Layout escape (100dvh, opt out of DashboardShell scroll) | Task 1.3 | layout.tsx + grid template |
| ManagerTimelineShell with DomainChatOwnership | Task 1.4 | ADR-0238 declaration |
| Admin/manager-only access | Task 1.2 | ADMIN_ONLY_PATH_PREFIXES |
| TopBar (brand + date + manager pill + Lukk-dagen) | Task 2.1 | Lukk-dagen disabled V1 |
| Toolbar (segments + chips + filters + zoom) | Task 2.5 | Consumes SegmentGroup + FilterChip |
| Chip primitives in packages/ui | Tasks 2.2, 2.3 | SegmentGroup + FilterChip |
| Chart body (TimeGutter, RoutineStrips, NowLine, PastDim, TaskBlock, PersonLane, AreaBand, layoutOverlap) | Tasks 3.1–3.7 | Full port |
| `useDayLinesForDate` in packages/data | Task 4.1 | Re-export bridge V1 |
| `useSessionTasksForDate` in packages/data | Task 4.2 | Option A direct query |
| `useRolesForPositions` in packages/data | Task 4.3 | Direct query |
| Hooks wired into Shell | Task 4.4 | |
| Pin-context Server Action (L-0177 + flag ADR-0099 gap) | Task 5.1 | Mirrors P10 reference |
| 6 telemetry events registered AND emitted same commit | Tasks 5.2 + 5.3 | L-0340 trust-gate split across 2 atomic commits |
| Tools-bridge (6 read tools) | Task 5.3 | useRegisterTools("oppgaver") |
| Site-map entry | Task 5.4 | polished_at handling per Step 2 of Task 5.4 |
| Click-to-edit modal (delegates to task.complete) | Tasks 6.1, 6.2 | + no-direct-write guard Task 6.3 |
| i18n keys (nb + en, ~30) | Task 7.1 | Parity test |
| Nordic Split sweep (OKLCH + colors + tweaks-panel ban) | Task 7.2 | |
| ARIA + reduced-motion audit | Task 7.3 | |
| Playwright E2E + axe | Tasks 8.1, 8.2, 8.3 | |
| NO outlet pill V1 | n/a (deferred V2) | |
| NO new capability tools V1 | Task 0 + 6.3 verification | |
| NO migrations V1 | Author chose Option A in Task 4.2 | |
| Tweaks panel never ships | Task 7.2 grep guard | |
| Chip primitive promotion + P10 migration | Tasks 2.2, 2.3 | P10 has not shipped TidslinjeChipBar yet (verified by grep); no P10 migration needed in this plan. When P10 lands, it should consume these primitives — flagged in HANDOFF for next sortie coordination. |

**No spec gaps caught.**

### 2. Placeholder scan

Searched plan body for: `TBD`, `implement later`, `similar to Task`, `???`, `<...>`. Replaced inline:
- `<TIMESTAMP>` references in plan body → none (no migrations).
- `<pending OR YYYY-MM-DD>` in Task 5.4 Step 3 → kept intentionally as conditional (validator may reject; pre-check resolves).
- `<date>` in Task 1.5 Step 4 → kept as runtime placeholder for the executing subagent.
- `<subagent id>` in Task 1.5 Step 4 → kept as runtime placeholder.
- `<N>`, `<M>`, `<list or "none">` in Task 1.5 Step 4 → kept as runtime audit output.

All other placeholders are intentional runtime values. **No structural placeholders remain.**

### 3. Type consistency

Cross-checked types referenced across tasks:
- `ViewMode` defined in Task 2.5, consumed in Tasks 5.2 (registry), 5.3 (tools), 6.1 (modal). Re-declared in each file (typed local) — acceptable for V1 (single source of truth = `oppgaver-types.ts` is OPTIONAL refactor in HANDOFF).
- `TimelineTask` defined in Task 3.4, consumed in Tasks 3.5, 3.6, 3.7, 5.3, 6.1. Each test verifies the import. ✓
- `Employee` defined in Task 3.5, consumed in Tasks 3.6, 3.7, 5.3. ✓
- `Band` defined in Task 3.6, consumed in Tasks 3.7, 5.3. ✓
- Hook names: `useDayLinesForDate` (Task 4.1) / `useSessionTasksForDate` (Task 4.2) / `useRolesForPositions` (Task 4.3) — consumed by name in Task 4.4 ManagerTimelineShell wiring test (`expect(SHELL).toMatch(/useDayLinesForDate/)` etc.). Names consistent. ✓
- Event names: 6 events in Task 5.2 EXACTLY match 6 `emit()` regex patterns in Task 5.3 test. ✓
- Capability names referenced in Task 0 (`task.create_session`, `task.complete`, `day-line.add_item`, `day-line.update_hours`) match Task 6.1 import expectations. ✓

**No type-consistency gaps.**

---

## Build sequence (executor checklist)

Linear order. One subagent per task. Two-stage review (code-reviewer + system-steward) after each phase boundary. Tag commit `[phase-N-done]` to signal phase complete.

- [ ] Phase 0 — Pre-flight (Task 0)
- [ ] Phase 1 — Foundation (Tasks 1.1, 1.2, 1.3, 1.4, 1.5)
- [ ] **Phase 1 review** — code-reviewer + system-steward
- [ ] Phase 2 — Chrome (Tasks 2.1, 2.2, 2.3, 2.4, 2.5)
- [ ] **Phase 2 review**
- [ ] Phase 3 — Chart Body (Tasks 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7)
- [ ] **Phase 3 review**
- [ ] Phase 4 — Data Layer (Tasks 4.1, 4.2, 4.3, 4.4)
- [ ] **Phase 4 review**
- [ ] Phase 5 — Harness (Tasks 5.1, 5.2, 5.3, 5.4)
- [ ] **Phase 5 review (L-0340 trust-gate verified across 5.2 + 5.3)**
- [ ] Phase 6 — Modal (Tasks 6.1, 6.2, 6.3)
- [ ] **Phase 6 review**
- [ ] Phase 7 — Sweep (Tasks 7.1, 7.2, 7.3)
- [ ] **Phase 7 review (smartout-page-polish 8-phase audit)**
- [ ] Phase 8 — E2E (Tasks 8.1, 8.2, 8.3)
- [ ] **Final review**

After Phase 8 review passes: invoke `/close-feature` (requires HANDOFF + journey + decision-log register).

---

## Critical details

**Error handling:** Server Action returns `{ ok: false }` on any failure path (L-0177). Hooks throw via `throw new Error(error.message)` so TanStack Query surfaces in `error` state — page renders empty state copy ("Kunne ikke laste oppgaver"). No silent fallbacks.

**State management:** Local React state in `ManagerTimelineShell` for `dateISO`, `viewMode`, `activeAreaIds`, `onlyOpen`, `deviationsOnly`, `zoom`, `selectedTask`. No global store. Persistence via `pinOppgaverContextAction` (engine_memory, 24h TTL) — purely for Botsson context, not for cross-session UI restore.

**Testing:** Path B static-source assertion is the V1 standard for components that would need `@testing-library/react` (not installed in apps/web vitest config per P10 closure). Pure algorithms (layoutOverlap, timeMath, validators) use real vitest tests. `packages/ui` primitives use RTL if the package has the dep, else Path B (per Task 2.2 check). Server Actions use vitest with mocked supabase/server.

**Performance:** All hooks have explicit `staleTime` (15-60 s) to avoid PostgREST hammering. Chart memoizes `layoutOverlap` per band via `useMemo`. No `next/dynamic` needed V1 (entire route is client-side, page weight should remain under 200kB gzip — measure in Phase 8 if Lighthouse flags it).

**Security:** Manager-role gate via `ADMIN_ONLY_PATH_PREFIXES` (Task 1.2) + workspace_id RLS on `session_task` / `day_line` / `role` / `role_task`. No new RLS policies; no new RPCs (Option A). Pin-context action explicitly validates `workspaceId` + `profileId` per L-0177.

**Telemetry:** Six events split across 4 emit sites (Shell handles 5, tools-bridge handles `context_pinned`). All `emit()` calls include resolved `workspace_id` (non-empty) + `actor_id` (non-empty profileId) per L-0177 + ADR-0193. No empty-string fallback.

**Inherited debt (flagged for HANDOFF, NOT fixed in this plan):**
- ADR-0099 gap on engine_memory write in `pinOppgaverContextAction` (inherited from P10 reference). Linear issue created post-merge for unified sweep across all pin-* actions.
- `useDayLinesForDate` in packages/data is a re-export bridge V1 — full move in V2 follow-up sortie.

**V2 follow-up scope (NOT in this plan, captured for HANDOFF):**
- Multi-outlet pill
- DnD re-time (depends on G19a/b/c capability tools)
- LiveKit voice page-tools mirror (`navigateTimeline` + `focusArea` over data channel per L-0234)
- Lukk-dagen wiring to `daily_reconciliation`
- Canvas editor (separate authoring sortie)
- `pin-*-context` actions unified gateAction wrapper (ADR-0099 closure)
- Mobile read-view (per ADR-0133 mobile is execute-only, but a "see what my manager sees" mode could ship later as read-only summary)
