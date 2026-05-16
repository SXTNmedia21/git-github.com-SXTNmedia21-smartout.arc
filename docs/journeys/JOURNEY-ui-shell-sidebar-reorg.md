---
title: Sidebar Reorg — User Journeys
feature: ui-shell-sidebar-reorg
status: verified
verified_at: 2026-05-16
updated: 2026-05-16
created: 2026-05-15
module: dashboard
tags: [sidebar, navigation, ui-shell, campaign-ui-shell, journey]
---

# User Journeys — feat/ui-shell-sidebar-reorg

Six journeys covering admin / employee / demo modes, disabled placeholders, and collapsed-sidebar state.

---

## Journey 1: Manager opens an Avvik (HMS deviation) via the sidebar

**Precondition:** Manager is signed in as admin/manager role. They are on `/dashboard`. Sidebar is in admin mode (default). They want to inspect open HMS deviations.

1. Manager scans the sidebar groups → sees nine grouped sections, including a new "HMS & Compliance" group.
2. Manager clicks "Avvik" inside the HMS & Compliance group → SidebarGroup resolves `href="/dashboard/hms/deviations"` and renders a `<Link>`.
3. Browser navigates to `/dashboard/hms/deviations` → page renders without HTTP 500.
4. Manager sees the deviation list page (route content unchanged in this sortie — was previously orphan, now reachable).
5. Sidebar `<SidebarGroup>` re-renders with "Avvik" highlighted active (prefix-match on `/dashboard/hms/deviations`).

**Postcondition:** Manager is on the HMS deviations page. Sidebar shows "Avvik" as active item, "HMS & Compliance" group expanded.

**Error paths:**
- If `/dashboard/hms/deviations` page throws → user sees Next.js error boundary; S12 protocol would catch this regression on every test run.
- If pathname becomes a non-string (theoretical) → `computeActive` falls back to `false` for all items; sidebar shows no active item but is otherwise functional.

---

## Journey 2: Manager finds Forslag (proposals) inside the Drift group

**Precondition:** Manager is signed in as admin. They are on `/dashboard/schedule` (Vaktplan). They want to review pending proposals.

1. Manager looks at the Drift group → sees Ansatte / Vaktplan / Kalender / Vaktbørs / Rutiner / Forslag.
2. Manager clicks "Forslag" → `href="/dashboard/proposals"` resolves, browser navigates.
3. `/dashboard/proposals` renders (route was always live, now surfaced through sidebar instead of being orphan).
4. SidebarGroup recalculates active state — "Forslag" highlights, "Vaktplan" deactivates.

**Postcondition:** Manager on `/dashboard/proposals`, Forslag active in Drift group.

**Error paths:**
- None specific. Forslag is a `linked-orphan` route that S12 verifies returns < 500.

---

## Journey 3: Manager clicks the disabled Rutiner placeholder

**Precondition:** Manager is signed in as admin, on any dashboard route. They see "Rutiner" in the Drift group rendered with reduced opacity.

1. Manager hovers over "Rutiner" → cursor becomes `cursor-not-allowed` (DisabledNavItem styling).
2. Manager attempts to click → nothing happens. No navigation. No anchor `href` exists on the rendered element.
3. Manager sees a "Snart" badge to the right of the label (expanded sidebar) or relies on the `title="Kommer snart"` tooltip (collapsed sidebar).
4. Manager understands the surface is coming-soon and moves on.

**Postcondition:** Pathname unchanged. No route change. Sidebar state unchanged.

**Error paths:**
- A future developer accidentally removes the `disabled: true` flag in `sidebar-config.ts` → item becomes clickable → user hits `/dashboard/tasks` → 404 (route does not exist). Mitigation: HANDOFF debt item #1 (testids) would let S12 assert disabled-state directly.

---

## Journey 4: Manager toggles from admin to employee mode

**Precondition:** Manager is signed in. Sidebar in admin mode (9 groups visible — Oversikt / Drift / Planlegging / Administrasjon / HMS / Kommunikasjon / Integrasjoner / AI / Veiledning).

1. Manager clicks the Admin/Employee toggle in the sidebar footer → `isAdminMode` flips to `false`.
2. DashboardShell re-renders. Mode branch switches from `SIDEBAR_GROUPS_ADMIN` to `SIDEBAR_GROUPS_EMPLOYEE`.
3. Sidebar shrinks to 3 groups: Oversikt (standalone) + Min Tid (with Min plan / Min lønn / Min kontrakt / Min CV (feature-flagged) / Min trening / Min profil / Stempelur) + Kommunikasjon (Kanaler / Chat / Nyheter / Desks / Oversikt).
4. The footer Admin/Employee toggle label updates to "Ansattmodus", switch position moves to the off state.
5. Manager sees their employee-facing view of the sidebar.

**Postcondition:** `isAdminMode === false`. Sidebar shows employee groups only.

**Error paths:**
- If `FEATURE_FLAGS.MY_CV` is `false` → "Min CV" item is filtered out by SidebarGroup before render. The Min Tid group still renders with 6 items instead of 7.
- If the toggle clicks during navigation → state update batches with route change; sidebar may flash both states for one frame. Not blocking.

---

## Journey 5: Investor sees Demo mode sidebar

**Precondition:** Demo mode is enabled (`isDemoMode === true`, typically toggled by Pontus for an investor pitch session). Manager is signed in as admin.

1. DashboardShell mode branch resolves: `isAdminMode && isDemoMode` → consumes `SIDEBAR_GROUPS_DEMO`.
2. Sidebar renders the Showcase group at the top: Oversikt → "Templates" (mapped to `/dashboard/schedule`) → "Analytics" (mapped to `/dashboard/reports`) → "System Intelligence" (mapped to `/onboarding`, ai-glow on icon).
3. Below the Showcase group, the sidebar renders admin groups 2-9 (Drift / Planlegging / Administrasjon / HMS / Kommunikasjon / Integrasjoner / AI / Veiledning) — so the investor sees the full breadth of the platform after the pitch entry points.
4. Investor sees clear pitch language at top, full product surface below.

**Postcondition:** Sidebar in demo layout. All routes still functional — labels are presentation-layer renames.

**Error paths:**
- If a future change forgets to update both `SIDEBAR_GROUPS_DEMO` Showcase labels AND the actual `/onboarding` route, the pitch could land an investor on the real onboarding wizard. Acceptable — `/onboarding` was always the demo target.

---

## Journey 6: Manager collapses the sidebar

**Precondition:** Manager in admin mode, sidebar expanded (`isSidebarCollapsed === false`). Sidebar is 256px wide.

1. Manager clicks the chevron at the top of the sidebar → `isSidebarCollapsed` flips to `true`.
2. DashboardShell re-renders sidebar at 64px width (`w-16` instead of `w-64`).
3. SidebarGroup detects `isCollapsed` → drops group-header text, drops item label text, drops `<NavBadgePill>` indicators, keeps the lucide icon.
4. NavItem renders icon-only inside a `<Tooltip>` wrapper. Hover surfaces the label as tooltip text.
5. Dynamic indicators (kanaler unread count, live-call indicator) render as a single corner dot on the icon via `<NavBadgeDot>` (highest-priority indicator wins).
6. Active item still highlights via border + background — visible at icon-only width.

**Postcondition:** Sidebar at 64px. All items icon-only. Tooltips on hover for labels.

**Error paths:**
- If an item has no `indicators` array but is active → the active-state dot still renders (small orange dot, expanded-mode behavior). In collapsed mode the dot is suppressed when indicators exist (per NavItem render logic).
- If browser zoom + small viewport conspire → tooltip placement may overlap content. Pre-existing tooltip behavior; not introduced by this sortie.

---

## Coverage map

| Mode | Journey | SIDEBAR_GROUPS variant |
|---|---|---|
| Admin | 1, 2, 3, 6 | SIDEBAR_GROUPS_ADMIN |
| Employee | 4 | SIDEBAR_GROUPS_EMPLOYEE |
| Demo | 5 | SIDEBAR_GROUPS_DEMO |
| Document | (untouched in this sortie) | DocumentModeSidebar (existing component) |

## Out of scope

- Mobile sidebar — ADR-0133 boundary.
- Per-orphan-route data + UX polish — separate sortie per route using `smartout-page-polish` skill.
- i18n key migration — separate sortie.
- Sidebar testid attrs + S12 `ui_state` upgrade — follow-up `sidebar-testids` sortie.
