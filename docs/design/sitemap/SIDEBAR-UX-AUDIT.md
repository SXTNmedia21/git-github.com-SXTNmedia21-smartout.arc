---
title: Sidebar + Page Hierarchy — UX/UI Audit
status: draft
updated: 2026-05-18
created: 2026-05-18
module: design
tags: [sidebar, navigation, ux, visual-hierarchy, sub-tabs, page-pattern, audit]
---

# Sidebar + Page Hierarchy — UX/UI Audit

Scope: **web dashboard left-rail + in-page sub-tab pattern only**. No product redesign. No new routes. Tightens what already exists.

Verified against code 2026-05-18:
- `apps/web/src/components/dashboard/DashboardShell.tsx` (1918 lines)
- `apps/web/src/components/dashboard/SidebarGroup.tsx`
- `apps/web/src/components/dashboard/sidebar-config.ts` (52 admin items, 9 groups)
- `apps/web/src/components/dashboard/PageTabNav.tsx`
- 22 sub-tab implementations across `apps/web/src/app/dashboard/**`

Companion docs (already accepted, not re-litigated here):
- `docs/design/SITEMAP-dashboard-audit.md` — route inventory + orphan list
- `docs/design/SIDEBAR-reorg-proposal.md` — grouping proposal (Pontus' 9-group taxonomy)
- `docs/design/dashboard-page-pattern.md` — page-shell canonical pattern (Oversikt-stil)

---

## 1. Audit — What's Wrong With Visual Hierarchy

### 1.1 Sidebar is too dense to scan

| Surface | Item count | Group count |
|---|---|---|
| `SIDEBAR_GROUPS_ADMIN` | 52 | 9 |
| `SIDEBAR_GROUPS_EMPLOYEE` | 12 | 3 |

52 items in 9 groups against 256px width = wall of labels. No collapsed groups, no nested children. Manager opens dashboard, sees a column they cannot parse in 2 seconds. Mental cost paid every session.

### 1.2 Group headers are invisible

```tsx
// SidebarGroup.tsx:60
className="text-muted-foreground mt-1 mb-1 px-2 text-[9px] font-bold tracking-widest uppercase"
```

- 9px font on `text-muted-foreground` = ~3:1 contrast on Nordic Split warm bg, fails WCAG AA for text.
- 1px margin top + bottom = group separator visually collapses into the previous item's hover-pill.
- "Drift", "Administrasjon", "HMS & Compliance" all look identical — they're hierarchy, but render as filler.

Net effect: the sidebar reads as **a flat list of 52 chips with random pauses**, not 9 distinct categories.

### 1.3 Active state names the item, not the section

`computeActive()` in `SidebarGroup.tsx:109` highlights only the matching `NavItem`. On `/dashboard/hms/deviations`:
- "Avvik" gets the active pill
- "HMS-oversikt" stays neutral
- The "HMS & COMPLIANCE" group header stays neutral

User cannot answer "which section am I in?" from the sidebar alone. The top-bar breadcrumb (DashboardShell.tsx:1452) shows only the last URL segment ("hms"), not the group.

### 1.4 Dark/light branching duplicates every visual decision

DashboardShell.tsx has ~30 sites of `isDark ? "border-border bg-card" : "border-[var(--border)] bg-[var(--surface-base)] ..."` — two parallel design systems. Nordic Split tokens (`bg-background`, `border-border`) already abstract this; the `var(--surface-base)` branch is a pre-token legacy. Every visual change costs two edits, drift is inevitable. This is the #1 reason the sidebar feels "off" in one theme vs the other.

### 1.5 No hierarchy for sub-routes

`/dashboard/hms` has 6 sub-pages (deviations, documents, training, drift, governance, procedure). All 6 rendered as **siblings of HMS-oversikt** at the same sidebar indentation. That makes the HMS group take 8 vertical slots and visually weight the same as Drift (6) — but HMS conceptually is a sub-domain, not a peer.

Same drift in `/komm`, `/organization`, `/settings/operations`. The sub-tree exists in the URL but not in the sidebar.

### 1.6 Footer drift

Bottom of sidebar (DashboardShell.tsx:1379-1432) renders Settings + Help + Admin/Employee toggle inline with its own borders, padding, color scheme — not a `SidebarGroup`. Three more visual idioms in one column.

### 1.7 Standalone "Oversikt" and footer-group mixing

`group.standalone` (Oversikt) renders without header. `group.footer` (Min Tid in employee mode) renders with a divider above. Two structural flags on top of regular groups = 3 visual variants for what should be one component.

---

## 2. Audit — What's Wrong With Sub-Tab Pattern

### 2.1 Three competing implementations

| Pattern | File count | Visual |
|---|---|---|
| `PageTabNav` (canonical) | 7 | `bg-muted/80` rail, `rounded-xl`, `text-xs font-semibold` |
| shadcn `Tabs + TabsList` (raw) | 12+ | varies wildly per page |
| Hand-rolled `role="tablist"` div | 3+ | per-page custom |

Examples of inconsistency on similar surfaces:
- `ReportsPageShell.tsx:273` hand-rolls a `TabsList` with **the exact PageTabNav className** instead of using the component.
- `CalendarPageShell.tsx:318` does the same.
- `ProcedureDetailTabs.tsx:107` uses `bg-muted/50` (vs canonical `bg-muted/80`).
- `marketplace-page-client.tsx:346` uses `border-border/40 rounded-xl` — no `bg-muted` fill at all.
- `ShiftClockTabs.tsx:67` uses `grid grid-cols-3` — different layout primitive.
- `EntityDetailLayout.tsx:106` uses `justify-start` variant.

Same UI element, six paint-jobs. User cannot learn the pattern.

### 2.2 No second-level pattern

When a tab is also a route (e.g. `/dashboard/people/invitations`), some pages use `PageTabNav` to push routes, others mount `<Tabs>` for in-page state. No rule for: "tabs that change URL" vs "tabs that don't." This bleeds into deep-link behavior — refresh on `/dashboard/payroll/[periodId]` loses tab state on some pages, persists on others.

### 2.3 Page-header + tab spacing inconsistent

`dashboard-page-pattern.md` mandates `mb-5` between header and tabs. Real pages: 12px / 16px / 20px / 24px. Hierarchy reads as "loose / tight / loose" across the product.

---

## 3. Prioritized Recommendations

### P0 — Visual hierarchy (ship in 1 sortie, 1 file)

The full reorg from `SIDEBAR-reorg-proposal.md` is route-level (long-running). These changes are **visual-hierarchy-only** and ship without route changes:

1. **Lift group header weight.** From `text-[9px] font-bold` → `text-[10px] font-bold text-foreground/70 mt-4 mb-1.5 px-2 tracking-[0.14em] uppercase`. Adds 3px height, +1px font, more breathing room. Headers become first-class.
2. **Add group-active indicator.** When any item in the group is active, render group header in `text-foreground` + 2px left accent rail (`before:absolute before:left-0 before:top-0 before:h-full before:w-[2px] before:bg-orange-500/60`). User knows the section instantly. No new state — derive from `pathname` already passed to `SidebarGroup`.
3. **Nest sub-routes under their parent.** When the parent item is active OR `pathname.startsWith(item.href + "/")`, render children indented `pl-6` with `text-[11px]` and a 1px left rail. Saves 12+ vertical slots, reveals tree structure. Add `children?: SidebarItem[]` to `SidebarItem` type — strict superset, no breakage.
4. **Kill `isDark` branching in sidebar.** Replace `isDark ? "bg-card" : "bg-[var(--surface-base)]"` with `bg-sidebar` (Nordic Split token). Single source. Saves ~30 LOC + drift surface. This is the single highest-leverage change.
5. **Tighten sidebar width.** `w-64` (256px) → `w-60` (240px). 16px back to the canvas, items still fit at 12px label. Consistent with shadcn defaults.

**Risk:** Low. One file (`SidebarGroup.tsx` + `DashboardShell.tsx`). Visual-only. No route changes. Reversible.

**File touch points:**
- `SidebarGroup.tsx` — header style, active-rail, optional nested-children render
- `sidebar-config.ts` — promote `/dashboard/hms/*`, `/dashboard/komm/*`, `/dashboard/organization/*` children into `children: [...]` on parent items
- `DashboardShell.tsx:1320-1435` — strip `isDark ?` ternaries, swap to tokens

### P1 — Sub-tab consistency (ship in 1 sortie)

1. **Single canonical sub-tab primitive.** Extend `PageTabNav` to be the **only** in-page tab component. Add two variants on the same component:
   - `variant="pill"` (default, current behavior) — for in-page state tabs.
   - `variant="route"` — same visuals, but renders `<Link>` instead of `<button>` for tabs that change URL. Optional `basePath` prop.
2. **Codemod the 12 ad-hoc `<Tabs><TabsList>` callers.** Each is a 5–10 line swap. Identify them with: `grep -rn 'TabsList' apps/web/src/app/dashboard`. Keep `<Tabs>` as the controller/Provider when needed; just replace `<TabsList>` paint-job.
3. **Mandate position.** `dashboard-page-pattern.md §1.3` already says `mb-5` after header. Add ESLint rule or audit grep: any `<PageTabNav>` not preceded by `mb-5` is a defect.
4. **Spacer rule.** Between sub-tab and content: `min-h-0 flex-1 overflow-hidden` (matches §1.4). No `<Separator>`, no extra padding.

**Risk:** Low–Med. 15 file edits across product. Each one isolated. Visual-only, no behavior change.

### P2 — Group structural cleanup (ship after P0 lands)

1. **Collapse 9 groups → 5.** Current Pontus proposal is correct in intent but 9 groups is still too many to scan. Suggested merge:
   - **Drift** (unchanged) — people, schedule, tasks, calendar, marketplace, proposals
   - **Planlegging** → fold into Drift as nested children under Vaktplan (`/year-wheel`, `/season/[id]`, `/setup` are scheduling-prep, not a peer category)
   - **Administrasjon** (unchanged) — org, payroll, reconciliation, reports, contracts, cost, billing
   - **HMS & Compliance** (unchanged) — already coherent
   - **Kommunikasjon** (unchanged) — channels, chat, news
   - **Integrasjoner + AI + Veiledning** → merge into one footer group "Verktøy" (POS, Botsson, Onboarding-assistent, Manualer). All are tools, not workflows.

5 groups × ~9 items each = scannable in 2 seconds. Matches shadcn dashboard reference layouts.

2. **Collapsible groups.** Each group `<button>` toggles its `<ul>`. Persist state in `localStorage["sidebar-groups-collapsed"]`. Default: Drift + active-group expanded, rest collapsed. Mobile-friendly when sidebar becomes hamburger.

**Risk:** Med. Touches sidebar-config schema. Requires UX testing with Pontus on hospitality manager flow.

### P3 — Page-level hierarchy alignment (incremental)

Audit each `apps/web/src/app/dashboard/<route>/page.tsx` against `dashboard-page-pattern.md §10` acceptance criteria. Pages off-pattern as of 2026-05-18 grep:
- `/website/_components/editors/MenuFullEditor.tsx` (raw Tabs)
- `/season/[seasonId]/_components/SeasonSubmenu.tsx` (custom border-b tablist)
- `/year-wheel/_components/shell/SeasonSidebar.tsx` (custom)
- `/schedule/marketplace/_components/marketplace-page-client.tsx` (custom)
- `/shift-clock/ShiftClockTabs.tsx` (grid layout — keep as exception, it's mobile-narrow)

One-by-one as those pages get touched. Not a sortie.

---

## 4. Revised Sidebar Structure (Visual)

Width 240px. 5 groups (P2). Group headers `text-[10px] uppercase tracking-[0.14em] mt-4`. Active group: 2px orange accent rail + bold header. Nested children: `pl-6` + 1px left rail when parent expanded/active.

```
┌──────────────────────────────────────┐
│  Strøm Mat & Bar              [▼]    │   workspace switcher
├──────────────────────────────────────┤
│                                      │
│  ◆  Oversikt                         │   standalone, no header
│                                      │
│  DRIFT                          ────  │   ← active accent when child active
│  ▏ Ansatte                           │
│  ▏ Vaktplan                          │
│  │   ├ Vaktbørs                      │   ← nested when parent expanded
│  │   ├ Foreslått plan                │
│  │   └ Årshjul                       │
│  ▏ Kalender                          │
│  ▏ Oppgaver                          │
│  ▏ Forslag                           │
│                                      │
│  ADMINISTRASJON                      │
│  ▏ Organisasjon                      │
│  │   ├ Avdelinger                    │
│  │   ├ Lokasjoner                    │
│  │   └ Team                          │
│  ▏ Lønn                              │
│  ▏ Avstemming                        │
│  ▏ Rapporter                         │
│  ▏ Kontrakter                        │
│  ▏ Kostnader  ·  Fakturering         │
│                                      │
│  HMS & COMPLIANCE             ────   │   ← active when on any /hms/*
│  ▏ HMS-oversikt                      │
│  │   ├ Avvik                         │
│  │   ├ Dokumenter                    │
│  │   ├ Trening                       │
│  │   ├ Drift-sjekk                   │
│  │   └ Styring                       │
│  ▏ Policies                          │
│  ▏ Handbok                           │
│                                      │
│  KOMMUNIKASJON                       │
│  ▏ Kanaler                           │
│  │   ├ Chat                          │
│  │   ├ Nyheter                       │
│  │   └ Oversikt                      │
│                                      │
│  VERKTØY                             │
│  ▏ Mr. Botsson           [aktiv]     │
│  ▏ Onboarding-assistent              │
│  ▏ POS-integrasjoner                 │
│  ▏ Manualer                          │
│                                      │
├──────────────────────────────────────┤
│  ⚙  Innstillinger                    │   footer block
│  ?  Hjelp                            │
│  [Drift mode  ━━●]                   │
└──────────────────────────────────────┘
```

Same routes, same items, same colors. Three visual moves:
1. Headers visible.
2. Sub-routes nested.
3. Active group rail.

---

## 5. Canonical Sub-Tab Pattern (Specification)

This is the rule for **every page below `/dashboard/*` that has more than one view**.

### 5.1 When to use what

| Need | Component | Variant |
|---|---|---|
| In-page view switch (state-only) | `<PageTabNav>` | `variant="pill"` |
| URL-tab routing (deep-link survives refresh) | `<PageTabNav>` | `variant="route"` |
| Drawer / dialog internal tabs | shadcn `<Tabs>` | raw — different visual context, OK |
| Wizard step indicator | NOT tabs — use a step indicator component | — |

### 5.2 Anatomy

```tsx
<div className="relative flex h-full min-h-0 flex-1 flex-col p-4 pt-1 md:p-6 md:pt-3">
  {/* Page header — H1 + subtitle + actions */}
  <div className="mb-5 flex items-end justify-between gap-4">…</div>

  {/* Sub-tab — ALWAYS PageTabNav, ALWAYS mb-5 */}
  <PageTabNav tabs={TABS} active={tab} onChange={setTab} className="mb-5" />

  {/* Body — fills remaining height, internal scroll only */}
  <div className="min-h-0 flex-1 overflow-hidden">…</div>
</div>
```

Rules:
- One `<PageTabNav>` per page max.
- Tab labels: ≤ 14 chars. Use icons only on dense pages (≥ 5 tabs).
- Tab order: most-frequent → least-frequent (not alphabetical).
- Active state: `bg-background text-foreground shadow-sm` (already canonical).
- Never combine `<PageTabNav>` + chip-row filter side-by-side. Pick one IA level.

### 5.3 Forbidden

- `<TabsList>` with hand-rolled `border-border bg-muted/80 inline-flex h-auto w-fit gap-1 rounded-xl border p-1 shadow-sm` className → use `<PageTabNav>` instead.
- Sub-sub-tabs (nesting). Three levels of tabs = wrong IA — use side-nav or drawer.
- Underline-style tabs (`border-b` per tab). Conflicts with Nordic Split pill paradigm.

---

## 6. Implementation Slices

Three independent sorties. Each one closes a P-bucket and is reversible.

| Sortie | Scope | Files | Effort |
|---|---|---|---|
| **UX-A** | P0 — sidebar visual hierarchy | `SidebarGroup.tsx`, `DashboardShell.tsx` (only sidebar block lines 1320–1435), `sidebar-config.ts` (add `children?:`), `NavItem.tsx` (accept indented variant) | 3–4h |
| **UX-B** | P1 — sub-tab primitive consolidation | `PageTabNav.tsx` (add variants), 12 caller files (codemod swap), `dashboard-page-pattern.md` (update §1.3) | 4–6h |
| **UX-C** | P2 — group collapse 9→5 + collapsible | `sidebar-config.ts` (re-bucket), `SidebarGroup.tsx` (collapsible state), `i18n` (new group labels) | 2–3h |

**Recommended order:** UX-A → UX-B (parallelizable) → UX-C after Pontus confirms 5-group taxonomy.

**Acceptance per sortie:**
- UX-A: take 3 screenshots (dashboard, hms/deviations, payroll/[id]) before+after; group header visible at 1m viewing distance; active group identifiable without reading labels.
- UX-B: `grep -rn 'TabsList' apps/web/src/app/dashboard` returns ≤ 3 hits (drawer-internal exceptions only).
- UX-C: sidebar item count visible without scroll on 1080p; 5 group headers fit above the fold; localStorage state persists across reload.

---

## 7. What Stays The Same

- Tab count + label text in `PageTabNav` callers (only the wrapper changes).
- All routes (no moves, no deletes).
- Nordic Split color system + Instrument Serif headings + Geist body.
- `dashboard-page-pattern.md` page-shell rules (`p-4 pt-1 md:p-6 md:pt-3`, no outer card, H1 + subtitle).
- `KpiAccentTile` + card primitive (`bg-card rounded-2xl border p-5 shadow-sm`).
- Bottom footer (Settings, Help, Admin toggle).
- Workspace switcher at top.

---

## 8. Open Decisions (Pontus owns)

| # | Decision | Recommended | Why |
|---|---|---|---|
| Q1 | Collapse 9 groups → 5 (P2)? | YES | Cognitive load + scannability |
| Q2 | Sub-routes nested under parent in sidebar (P0 #3)? | YES | URL tree = visual tree |
| Q3 | Active-group accent rail (P0 #2)? | YES | "Where am I?" answered in <1s |
| Q4 | Kill `isDark ?` branching in sidebar (P0 #4)? | YES | Removes whole drift surface |
| Q5 | `PageTabNav variant="route"` for URL tabs (P1 #1)? | YES | One primitive, two behaviors |
| Q6 | Default-collapsed groups (P2 collapsible)? | Active + Drift expanded, rest collapsed | Manager defaults |

---

## 9. Out of Scope

- Mobile sidebar (covered in `sitemap/mobile/10-UX-REVIEW.md`).
- Route additions or moves (covered in `SIDEBAR-reorg-proposal.md`).
- Top-bar / breadcrumb / action-bar redesign.
- Workspace switcher behavior.
- Demo-mode / godmode sidebar (separate surfaces).
- Page-body redesign beyond sub-tab placement.

---

## 10. TL;DR

Three problems, three fixes:

1. **Sidebar feels like 52 chips in a column** → make group headers visible, accent the active group, nest sub-routes. One file change.
2. **Sub-tabs look different on every page** → make `PageTabNav` the only primitive, codemod the 12 outliers. Visual-only.
3. **Nine groups too many** → collapse to 5, make them collapsible. After (1) ships.

No new routes. No new components. No new colors. Only the existing system, applied consistently.
