---
title: SM-9 — Settings absorbs Organisasjon (Struktur tab) + Integrasjoner tab
status: in_progress
created: 2026-05-19
updated: 2026-05-19
module: settings
tags: [sitemap, settings, organisation, integrasjoner, navigation, SM-9]
---

# SM-9 — Settings absorbs Organisasjon (Struktur tab) + Integrasjoner tab

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two new sections to the Settings left-rail sidebar — "Struktur" (hosting the existing Organisasjon tab content: Avdelinger, Lokasjoner, Team, and Overview) and "Integrasjoner" (hosting POS Integrations, with slots for future Tripletex/SendGrid). Existing `/dashboard/organization/*` routes stay alive; the main overview page redirects to Settings → Struktur. Deep-links into department/location/team detail pages are untouched.

**Canonical spec:** `docs/design/sitemap/web/00-CANONICAL.md` §2 (sidebar §2.2 "What is NOT in the sidebar") + §12 (migration table, SM-9 row: "Settings absorbs Organisasjon (Struktur tab) + Integrasjoner tab").

**Architecture decision (pre-recorded):**

- Struktur tab content: import the four existing `organization/_components/` panels (`OverviewTab`, `DepartmentsTab`, `LocationsTab`, `TeamsTab`) into a new lazy-loaded settings panel component. The `organization/page.tsx` data-fetching logic is lifted into a shared hook `use-organisation-structure.ts` under `settings/_hooks/`. The four sub-tab navigation inside Struktur mirrors the existing `OrgTabNav` choices (Overview · Avdelinger · Lokasjoner · Team) rendered as an inline pill-nav inside the Struktur panel.
- Existing `/dashboard/organization` route: add a permanent redirect to `/dashboard/settings#struktur-overview` so bookmarks / external deep-links land in the right place. Sub-routes (`departments/[id]`, `locations/[id]`, `teams/page`, `teams/[id]`) remain accessible as standalone pages — they are detail drilldowns reachable from the Struktur panel, not to be moved.
- Integrasjoner tab: render POS-Integrations content as a client panel that re-implements the data-fetch inline (mirrors `admin/pos-accounts/page.tsx` server-side fetch, converted to a TanStack Query hook). Tripletex and SendGrid slots are `TabPlaceholder` entries.
- `SettingsTabs` component: two new sections appended to the existing `SECTIONS` array — "Struktur" (4 tabs) and "Integrasjoner" (3 tabs). `TabId` union grows by 7 new values. `TabContent` switch grows by 7 new cases.
- Settings tool bridge: `SettingsTabId` union and `openSettingsSection` docstring updated to include new tab ids. `site-map.json` Botsson descriptor updated.

**Scope boundary — "Kun navigation":**

- No database migrations.
- No API changes.
- No file moves of `/dashboard/organization/**`.
- No changes to the detail pages (`departments/[id]`, `locations/[id]`, `teams/[id]`).
- No changes to the tools bridges on the detail pages.
- The `OrganizationToolsBridge` on `organization/page.tsx` remains in place — the tools it registers will no longer be reachable from the sidebar but remain accessible to Botsson while the redirect intermediary page exists. After the redirect is in place the bridge migrates into the Struktur panel; that migration is this sortie's Phase C.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Lucide icons, TanStack Query. No new npm dependencies.

---

## Recon Summary (verified 2026-05-19)

**Settings current shape:**

- `settings/page.tsx` — client component, owns `activeTab` state, renders `<SettingsToolsBridge>` + `<SettingsTabs>`.
- `settings/_components/settings-tabs.tsx` — left-rail sidebar nav + content area. `SECTIONS` has 5 sections (General, Payroll, Schedule, Framework, Organization-named). `TabId` union has 20 members. The "Organization" section currently holds Holidays, Contract-templates, Contract-template-bindings — unrelated to the Org/Struktur intent. Content switching via `switch` in `TabContent`. Lazy Suspense for all heavy panels.
- `settings/_hooks/` — 14 hooks for payroll/schedule/framework data. No structural-data hooks yet.
- `settings/_tools/` — `use-settings-tools.ts` (331 lines) + bridge. `SettingsTabId` mirrors `TabId`. `openSettingsSection` docstring lists all 20 valid ids.

**Organisation current shape:**

- `organization/page.tsx` — client component, 363 lines. Owns all state: `company`, `workspace`, `departments`, `locations`, `teams`, `positions`, `zones`, `assets`, `profiles`, `policies`, `memberCounts`, etc. Single `fetchData` callback with 10 parallel Supabase queries + 1 sequential team-members fetch. Renders `OrganizationToolsBridge` + `OrgTabNav` + one of four tab panels.
- `organization/_components/` — `org-tab-nav.tsx`, `overview-tab.tsx`, `departments-tab.tsx`, `locations-tab.tsx`, `teams-tab.tsx`, dialogs, `types.ts`, `constants.ts`. All self-contained, accept props from the parent page.
- `organization/_tools/` — `use-organization-tools.ts` + bridge.

**POS Accounts current shape:**

- `admin/pos-accounts/page.tsx` — **server component**, fetches `pos_account` rows, passes to `PosAccountsList` client island. No TanStack Query hooks — pure server-side.
- `admin/pos-accounts/_components/PosAccountsList.tsx` — client island (connect/disconnect CTAs).

**External references to `/dashboard/organization`** (23 `.tsx` + 10 `.ts` call-sites):

| File | Reference type |
|---|---|
| `DashboardShell.tsx` | path-to-segment map (line 86), autoplay demo step (line 868) |
| `GlobalSearchPalette.tsx` | deepLink in COMMAND_RESULTS (line 112) |
| `BotssonTools.ts` | navigation path map (line 224) |
| `entity-config.ts` | `href` templates for department/team entity drawers |
| `people/[id]/page.tsx` | `router.push` to teams detail |
| org `_components/*.tsx` | internal `router.push` to detail pages (stay untouched) |
| org `_tools/*.ts` | self-references in docstrings (untouched) |
| `site-map.json` | full page descriptor |

**i18n keys needed (nb + en):** `settings_page.sections.struktur`, `settings_page.sections.integrasjoner`, `settings_page.tabs.struktur_overview`, `settings_page.tabs.avdelinger`, `settings_page.tabs.lokasjoner`, `settings_page.tabs.team`, `settings_page.tabs.pos_integrasjoner`, `settings_page.tabs.tripletex`, `settings_page.tabs.sendgrid`.

---

## File Manifest

| Operation | Path | Responsibility |
|---|---|---|
| Create | `apps/web/src/app/dashboard/settings/_hooks/use-organisation-structure.ts` | Lifts `fetchData` logic from `organization/page.tsx` into a TanStack Query hook. Single hook, returns all Org data (company, workspace, departments, locations, teams, positions, zones, assets, profiles, policies, counts). |
| Create | `apps/web/src/app/dashboard/settings/_components/struktur-panel.tsx` | Lazy-loaded client panel. Imports existing `OverviewTab`, `DepartmentsTab`, `LocationsTab`, `TeamsTab` from `organization/_components/`. Has its own inner tab state (overview/departments/locations/teams). Calls `use-organisation-structure` for data. Mounts `OrganizationToolsBridge` while active. |
| Create | `apps/web/src/app/dashboard/settings/_components/integrasjoner-panel.tsx` | Lazy-loaded client panel. Fetches `pos_account` rows via TanStack Query (`supabase.from("pos_account")...`). Renders `PosAccountsList` from `admin/pos-accounts/_components/`. POS tab content is live. Tripletex + SendGrid tabs are `TabPlaceholder`. |
| Create | `apps/web/src/app/dashboard/settings/_components/struktur-tab-nav.tsx` | Pill-nav for the four Struktur sub-tabs (Overview, Avdelinger, Lokasjoner, Team). Mirrors `org-tab-nav.tsx` styling but is embedded inside the settings content area. |
| Modify | `apps/web/src/app/dashboard/settings/_components/settings-tabs.tsx` | Add two sections to `SECTIONS` (Struktur + Integrasjoner). Add 7 values to `TabId` union. Add 7 cases to `TabContent`. Add lazy imports for `StrukturPanel` and `IntegrasjonerPanel`. |
| Modify | `apps/web/src/app/dashboard/settings/_tools/use-settings-tools.ts` | Extend `SettingsTabId` with 7 new values. Extend `TAB_LABELS`. Extend `SECTION_TABS`. Update `openSettingsSection` docstring. |
| Modify | `apps/web/next.config.ts` | Add permanent redirect: `source: "/dashboard/organization"` → `destination: "/dashboard/settings#struktur-overview"`. |
| Modify | `apps/web/src/components/dashboard/GlobalSearchPalette.tsx` | Update `deepLink` in `cmd-org` to `/dashboard/settings#struktur-overview`. Update `subtitle` to "Gå til Struktur i Innstillinger". |
| Modify | `apps/web/src/components/dashboard/DashboardShell.tsx` | Line 86: map `"/dashboard/organization"` → keep as-is (redirect handles it); OR add `"/dashboard/settings": "mr-botsson"` entry if not already present. Line 868–869: update autoplay demo step to navigate to `/dashboard/settings` with `expectedPathname: "/dashboard/settings"`. Line 1489: keep `organization` segment label (redirect preserves it). |
| Modify | `apps/web/src/app/Botsson/_components/BotssonTools.ts` | Line 224: update `organization` entry path to `/dashboard/settings#struktur-overview`. |
| Modify | `apps/web/.botsson/site-map.json` | Update `/dashboard/organization` purpose to note redirect. Add `struktur` + `integrasjoner` tool entries to `/dashboard/settings` descriptor. Update `openSettingsSection` docstring to include new tab ids. |
| Modify | `packages/i18n/locales/nb/dashboard.json` | Add 9 new i18n keys. |
| Modify | `packages/i18n/locales/en/dashboard.json` | Same keys, English values. |
| Mark | `docs/design/sitemap/web/00-CANONICAL.md` | Update SM-9 row status from blank to ✅. |

No deletions. No moves. All 23 existing `organization` references with detail-page paths (`departments/[id]`, `locations/[id]`, `teams/[id]`) are left untouched — they are valid deep-links that remain alive.

---

## Open Decisions (pre-resolved)

| # | Question | Decision |
|---|---|---|
| OD-1 | Struktur panel — import org components or move route files? | **Import existing components into a new `StrukturPanel`.** Zero-rewrite. Org route files stay in place. Redirect handles the overview entry-point. |
| OD-2 | Data-fetching for Struktur — re-fetch in panel or SSR? | **New `use-organisation-structure` TanStack Query hook** inside `settings/_hooks/`. Pure client-side, matches the pattern of every other settings panel. SSR is not practical here because Settings is already a full client component page. |
| OD-3 | `OrganizationToolsBridge` — leave on org page or migrate? | **Migrate to StrukturPanel.** The bridge's tools are only useful while org content is visible. Moving it into the panel keeps Botsson tool registration accurate without duplicating the bridge. `organization/page.tsx` will keep the bridge too until it is retired (the redirect means the page still renders on direct nav). Leave bridge in both during transition. |
| OD-4 | Integrasjoner data-fetch — re-use server component or convert? | **Convert to TanStack Query client hook** inside `IntegrasjonerPanel`. The settings page is already a client component tree. A nested async server component inside it would require a Suspense-only slot (no data passing). TanStack Query is the correct pattern for this layer — consistent with every other settings panel. |
| OD-5 | Future Integrasjoner tabs (Tripletex, SendGrid)? | **TabPlaceholder for now.** Slots reserved in `SECTIONS`, rendered as "Kommer snart". No content ships here in SM-9. |
| OD-6 | Hash-based navigation (`#struktur-overview`) — does it conflict with existing hash routing? | `SettingsTabs` already reads `window.location.hash` on mount (line 376–388). Adding `struktur-overview` as a valid `TabId` means the existing hash handler will switch to that tab automatically when the redirect lands. No extra work needed. |
| OD-7 | `OrgTab` sub-state inside Struktur — own state or encode into hash? | **Own `useState<OrgTab>` inside `StrukturPanel`.** Encoding sub-tab into URL hash would conflict with settings top-level hash routing. The sub-tab is ephemeral view-state inside the panel. |

---

## Phase A — Shared data hook + i18n keys

**Why first:** Every later phase depends on having the data hook available. i18n keys are needed in Phase B (panel labels) and Phase C (settings-tabs labels). Doing both in one atomic task prevents "missing key" flicker during development.

### Task A1: Create `use-organisation-structure.ts`

Path: `apps/web/src/app/dashboard/settings/_hooks/use-organisation-structure.ts`

- [ ] **Step 1: Read organization/page.tsx fetchData** to capture exact query structure (already read in recon — 10 parallel queries + 1 sequential team-members fetch).

- [ ] **Step 2: Create hook**

```ts
/**
 * use-organisation-structure.ts
 *
 * Lifts the workspace structure data-fetch from /dashboard/organization/page.tsx
 * into a TanStack Query hook so the Struktur panel in Settings can consume it.
 *
 * Why a separate hook rather than importing from organization/:
 *   - organization/page.tsx is a client component, not a hook. Importing
 *     component state setters from a page is an antipattern.
 *   - TanStack Query deduplicates if organization/page.tsx is also mounted
 *     (same queryKey, same workspace_id). In practice the redirect means
 *     both are rarely simultaneously mounted.
 *
 * Returns the same data shape that organization/page.tsx computes locally.
 * Field names match to keep StrukturPanel's usage of DepartmentsTab,
 * LocationsTab, TeamsTab, OverviewTab compatible with zero changes to those
 * components.
 *
 * References:
 *   docs/design/sitemap/web/00-CANONICAL.md §2.2 (Struktur in Settings)
 *   apps/web/src/app/dashboard/organization/page.tsx (source of truth for queries)
 */
```

Shape: `useOrganisationStructure(): { data: OrgStructureData | undefined; loading: boolean; refetch: () => void }` where `OrgStructureData` mirrors the full state surface from `organization/page.tsx` (company, workspace, departments, locations, teams, positions, zones, assets, profiles, policies, derived maps, checklist). Use `useQuery` from `@tanstack/react-query`, key: `["organisation-structure", workspaceId]`. Read `workspaceId` from `DashboardContext`.

Import `DepartmentRow`, `LocationRow`, `TeamRow`, etc from `../../organization/_components/types` — do not duplicate these types. No new types needed.

- [ ] **Step 3: Verify TS** — `pnpm --filter @smartout/web tsc --noEmit 2>&1 | head -30`.

### Task A2: Add i18n keys

- [ ] **Step 4: Append to nb/dashboard.json**

Under `settings_page.sections` add:

```json
"struktur": "Struktur",
"integrasjoner": "Integrasjoner"
```

Under `settings_page.tabs` add:

```json
"struktur_overview": "Oversikt",
"avdelinger": "Avdelinger",
"lokasjoner": "Lokasjoner",
"team": "Team",
"pos_integrasjoner": "POS Integrasjoner",
"tripletex": "Tripletex",
"sendgrid": "SendGrid"
```

- [ ] **Step 5: Mirror in en/dashboard.json**

Same keys, English values:

```json
"struktur": "Structure",
"integrasjoner": "Integrations",
"struktur_overview": "Overview",
"avdelinger": "Departments",
"lokasjoner": "Locations",
"team": "Teams",
"pos_integrasjoner": "POS Integrations",
"tripletex": "Tripletex",
"sendgrid": "SendGrid"
```

---

## Phase B — Struktur panel + inner tab nav

**Why before settings-tabs.tsx:** It is cleaner to have the panel component ready before wiring it into the settings switch. Avoids a broken switch case during development.

### Task B1: Create `struktur-tab-nav.tsx`

Path: `apps/web/src/app/dashboard/settings/_components/struktur-tab-nav.tsx`

- [ ] **Step 6: Create inner tab nav**

Pill nav matching the styling of `org-tab-nav.tsx` but adapted to the settings content context. Props: `activeTab: OrgTab`, `onTabChange: (tab: OrgTab) => void`, `counts: { departments: number; locations: number; teams: number }`. Import `OrgTab` from `../../organization/_components/types`. Use `Building2`, `MapPin`, `Network`, `LayoutGrid` from lucide-react (matching `org-tab-nav.tsx`). Remove `isDark` prop — settings panels do not receive it; rely on CSS variables instead (Nordic Split compliance — no OKLCH literals, no hardcoded colours).

Key difference from org-tab-nav: no `isDark` ternary for badge colours. Use `bg-primary/10 text-primary` for active badge, `bg-muted text-muted-foreground` for inactive.

Tab order: Overview → Avdelinger → Lokasjoner → Team (matching spec §2.2 listed order: "Avdelinger / Lokasjoner / Team" — Overview is implicit entry point).

- [ ] **Step 7: Verify render** — ensure no hardcoded colours (OKLCH literals banned per ADR-0366). `grep -n 'oklch\|#[0-9a-f]\{3,6\}\|zinc-\|slate-\|gray-' struktur-tab-nav.tsx` must return zero hits.

### Task B2: Create `struktur-panel.tsx`

Path: `apps/web/src/app/dashboard/settings/_components/struktur-panel.tsx`

- [ ] **Step 8: Create panel**

```ts
/**
 * struktur-panel.tsx
 *
 * Settings → Struktur tab content.
 * Hosts the four organisation sub-tabs (Overview, Avdelinger, Lokasjoner, Team).
 *
 * Data: useOrganisationStructure() (TanStack Query, deduplicated).
 * Sub-tab state: local useState<OrgTab>.
 * Botsson tools: mounts OrganizationToolsBridge while rendered (ADR-0238 compliant —
 *   no domain chat surface; organisation has owns_chat_surface=false in site-map.json).
 *
 * Why import organisation components rather than moving files:
 *   SM-9 is "kun navigation" — zero file moves. DepartmentsTab, LocationsTab,
 *   TeamsTab, OverviewTab are stable leaf components that accept props. They are
 *   imported here and driven by useOrganisationStructure() rather than the
 *   page-level state machine in organization/page.tsx.
 *
 * References:
 *   docs/design/sitemap/web/00-CANONICAL.md §2.2
 *   apps/web/src/app/dashboard/organization/_components/ (source components)
 */
```

Structure:

1. Call `useOrganisationStructure()`.
2. Derive the same computed values that `organization/page.tsx` derives inline (`positionsByDept`, `zonesByLocation`, `assetsByLocation`, `setupChecklist`, `policyCountsByScope`, `entityPolicyCounts`, `deptsWithoutPositions`, `locsWithoutZones`) — extract these into the hook return value or compute them here. Prefer computing in the hook to keep this component slim.
3. Render `<StrukturTabNav>` above the content area.
4. Render the active sub-tab content. Pass `isDark={false}` to existing org components (or thread `isDark` from `DashboardContext` — prefer threading).
5. Mount `<OrganizationToolsBridge>` with all required props wired from hook data. This keeps Botsson informed while the Struktur panel is active.

- [ ] **Step 9: Verify types** — all props to `DepartmentsTab`, `LocationsTab`, `TeamsTab`, `OverviewTab` must satisfy their existing TypeScript signatures. Do not cast — fix any prop mismatches.

- [ ] **Step 10: Check no OKLCH literals** — `grep -n 'oklch\|#[0-9a-f]\{3,6\}\|orange-' struktur-panel.tsx` must return zero hits.

---

## Phase C — Integrasjoner panel

### Task C1: Create `integrasjoner-panel.tsx`

Path: `apps/web/src/app/dashboard/settings/_components/integrasjoner-panel.tsx`

- [ ] **Step 11: Create panel**

```ts
/**
 * integrasjoner-panel.tsx
 *
 * Settings → Integrasjoner tab content.
 * POS Integrations tab is live data. Tripletex + SendGrid are placeholders.
 *
 * Data: TanStack Query hook — fetches pos_account rows client-side.
 *   (admin/pos-accounts/page.tsx uses a server component; this panel converts
 *    to a client fetch because Settings is a full client component tree.)
 *
 * PosAccountsList is imported from admin/pos-accounts/_components/PosAccountsList.
 * No duplication of data-fetching logic.
 *
 * References:
 *   apps/web/src/app/dashboard/admin/pos-accounts/ (source surface)
 *   docs/design/sitemap/web/00-CANONICAL.md §2.2
 */
```

Structure:

1. Inner `IntegrasjonerTab` type: `"pos" | "tripletex" | "sendgrid"`.
2. Own `useState<IntegrasjonerTab>("pos")`.
3. Pill-nav with three tabs: POS Integrasjoner, Tripletex, SendGrid.
4. POS tab: `useQuery` key `["pos-accounts", workspaceId]` → `supabase.from("pos_account").select(...)`. Render `<PosAccountsList accounts={data} workspaceId={...} workspaceIsActive={...} />`. Handle loading/error states with `<SettingsLoadingSkeleton />`.
5. Tripletex + SendGrid tabs: `<TabPlaceholder icon={Plug} label={t("settings_page.tabs.tripletex")} />` (reuse existing `TabPlaceholder` from settings-tabs.tsx — extract to shared or copy locally).
6. Import `PosAccountRow` type from `admin/pos-accounts/page.tsx` (it is exported).
7. Import `PosAccountsList` from `admin/pos-accounts/_components/PosAccountsList`.

- [ ] **Step 12: Verify PosAccountsList props** — read `PosAccountsList.tsx` to confirm props signature (`accounts`, `workspaceId`, `workspaceIsActive`). Do not cast.

- [ ] **Step 13: Check no hardcoded colours** — same grep pattern as previous steps.

---

## Phase D — Wire into `settings-tabs.tsx`

**Why last among component phases:** All panels must exist before the switch can reference them without TypeScript errors.

### Task D1: Extend `settings-tabs.tsx`

- [ ] **Step 14: Add lazy imports**

```ts
const StrukturPanel = lazy(() =>
  import("./struktur-panel").then((m) => ({ default: m.StrukturPanel })),
);

const IntegrasjonerPanel = lazy(() =>
  import("./integrasjoner-panel").then((m) => ({ default: m.IntegrasjonerPanel })),
);
```

- [ ] **Step 15: Extend `SECTIONS` array**

Append two new sections AFTER the existing "organization" section (which holds Holidays / Contract-templates / Contract-template-bindings — that section is renamed from "Organization" to "Kontrakter" to avoid confusion with the new Struktur section):

**Rename existing section id "organization" → "kontrakter"** and update its `titleKey` to `"settings_page.sections.kontrakter"`. Add `"kontrakter"` to nb/en i18n files (nb: "Kontrakter", en: "Contracts").

Then append:

```ts
{
  id: "struktur",
  titleKey: "settings_page.sections.struktur",
  tabs: [
    { id: "struktur-overview", labelKey: "settings_page.tabs.struktur_overview", icon: LayoutGrid },
    { id: "avdelinger",        labelKey: "settings_page.tabs.avdelinger",        icon: Building2 },
    { id: "lokasjoner",        labelKey: "settings_page.tabs.lokasjoner",        icon: MapPin },
    { id: "team",              labelKey: "settings_page.tabs.team",              icon: Network },
  ],
},
{
  id: "integrasjoner",
  titleKey: "settings_page.sections.integrasjoner",
  tabs: [
    { id: "pos",        labelKey: "settings_page.tabs.pos_integrasjoner", icon: Plug },
    { id: "tripletex",  labelKey: "settings_page.tabs.tripletex",         icon: Link2 },
    { id: "sendgrid",   labelKey: "settings_page.tabs.sendgrid",          icon: Mail },
  ],
},
```

New icon imports needed: `LayoutGrid`, `MapPin`, `Network`, `Plug`, `Mail` (in addition to the already-imported set). Cross-check against current import list in `settings-tabs.tsx` — add only what is missing.

- [ ] **Step 16: Extend `TabId` union**

Add: `| "struktur-overview" | "avdelinger" | "lokasjoner" | "team" | "pos" | "tripletex" | "sendgrid"`.

Update initial default tab in `SettingsTabs` — keep `"hours"` as default. No change needed here.

- [ ] **Step 17: Extend `TabContent` switch**

```ts
case "struktur-overview":
case "avdelinger":
case "lokasjoner":
case "team":
  return (
    <Suspense fallback={<SettingsLoadingSkeleton />}>
      <StrukturPanel initialTab={
        tabId === "struktur-overview" ? "overview"
        : tabId === "avdelinger"     ? "departments"
        : tabId === "lokasjoner"     ? "locations"
        : "teams"
      } />
    </Suspense>
  );

case "pos":
case "tripletex":
case "sendgrid":
  return (
    <Suspense fallback={<SettingsLoadingSkeleton />}>
      <IntegrasjonerPanel initialTab={tabId} />
    </Suspense>
  );
```

`StrukturPanel` needs an `initialTab: OrgTab` prop so navigating directly to "avdelinger" opens the Avdelinger sub-tab without the user having to click. The panel uses this as the initial `useState` value.

`IntegrasjonerPanel` needs an `initialTab: IntegrasjonerTab` prop for the same reason.

- [ ] **Step 18: Also rename section "kontrakter" in i18n** — append `"settings_page.sections.kontrakter"` to nb (value: "Kontrakter") and en (value: "Contracts"). This is a supporting i18n addition on top of Task A2.

- [ ] **Step 19: Run typecheck** — `pnpm --filter @smartout/web tsc --noEmit 2>&1 | head -50`. Zero errors required.

---

## Phase E — Redirect + external reference updates

**Why last:** All internal settings machinery must be correct before external references point here. A broken redirect on top of a broken panel is harder to debug.

### Task E1: Next.js redirect

- [ ] **Step 20: Add redirect in `apps/web/next.config.ts`**

In the `async redirects()` array, append:

```ts
{
  source: "/dashboard/organization",
  destination: "/dashboard/settings#struktur-overview",
  permanent: true,
},
```

Note: Next.js permanent redirects are 308 (or 301 in older versions). The hash fragment is preserved client-side but is not sent to the server — Next.js redirect target including a hash is valid for client navigation. Verify this works in practice (hash routing in App Router context).

**Trap:** If Next.js strips the hash in the redirect (some versions do), the settings page will still render correctly because `SettingsTabs` defaults to `"hours"` when no matching hash is found. The user will land on Settings and need to click Struktur manually. This is acceptable fallback behaviour — document in a comment. The redirect destination can be updated to just `/dashboard/settings` if hash-in-redirect proves unreliable.

### Task E2: Update external references

- [ ] **Step 21: GlobalSearchPalette.tsx**

Line 112: change `deepLink: "/dashboard/organization"` to `deepLink: "/dashboard/settings#struktur-overview"`. Change `subtitle: "Ga til organisasjon"` to `subtitle: "Gå til Struktur i Innstillinger"`. (Also fix the typo `"Ga"` → `"Gå"` while here.)

- [ ] **Step 22: DashboardShell.tsx**

Line 86: The path-to-botsson-mode map `"/dashboard/organization": "mr-botsson"` — keep as-is (the redirect means this path is still served; Botsson mode on the interim org page is correct). Add `/dashboard/settings` to the same map if not already present (check around line 86).

Lines 868–869: Update the autoplay demo step:

```ts
{
  id: "organization",
  label: "Open organisation settings",
  selector: '[data-autoplay="nav-/dashboard/settings"]',
  expectedPathname: "/dashboard/settings",
},
```

The `data-autoplay` attribute on the Settings nav item in the sidebar will be `nav-/dashboard/settings` per the existing `DashboardShell` autoplay pattern. No new sidebar item — Settings is already in slot position (footer) per SM-1. Confirm the sidebar config already has a nav item for `/dashboard/settings`.

Line 1489: `organization: t("shell.segment.organization")` — keep as-is. The segment map is keyed by path prefix; `/dashboard/organization` still resolves during the redirect window.

- [ ] **Step 23: BotssonTools.ts**

Line 224: Update `organization` entry path to `/dashboard/settings#struktur-overview`. Label: keep `"Organisasjon"` or update to `"Struktur (Innstillinger)"` — consistent with canonical spec which calls it "Struktur" in the Settings tab but "Organisasjon" as the concept. Recommend keeping `"Organisasjon"` as the user-facing label, path updated.

- [ ] **Step 24: entity-config.ts**

Lines ~37 and ~65: `href` templates `"/dashboard/organization/departments/{id}"` and `"/dashboard/organization/teams/{id}"` — these are deep-links to detail pages that remain alive. **No change needed.** The detail pages (`departments/[id]`, `teams/[id]`) are not redirected. Leave untouched.

### Task E3: site-map.json update

- [ ] **Step 25: Update `/dashboard/organization` descriptor**

Append to `purpose`: `" (Redirects to /dashboard/settings#struktur-overview as of SM-9 2026-05-19)"`. Keep all existing tools — the org page still renders when navigated to directly (before redirect resolves on first paint).

- [ ] **Step 26: Update `/dashboard/settings` descriptor**

Append to `purpose`: `", organisasjonsstruktur (Struktur: Avdelinger/Lokasjoner/Team), POS-integrasjoner"`.

Append to `tools` array (under the `openSettingsSection` tool):

```json
{
  "name": "openStrukturTab",
  "description": "Navigate to the Struktur section in Settings — shows organisation structure (Avdelinger, Lokasjoner, Team). Valid sub-tab args: struktur-overview, avdelinger, lokasjoner, team."
},
{
  "name": "openIntegrasjonerTab",
  "description": "Navigate to the Integrasjoner section in Settings. Valid tab: pos (POS Integrasjoner — live data). Tripletex + SendGrid are placeholders."
}
```

Update `openSettingsSection` description to append: `", struktur-overview, avdelinger, lokasjoner, team, pos, tripletex, sendgrid"` to the valid tab ids list.

- [ ] **Step 27: Update `SettingsTabId` in `use-settings-tools.ts`**

Append 7 new values to `SettingsTabId` type (must match new `TabId` values exactly). Extend `TAB_LABELS` map. Extend `SECTION_TABS` with the two new sections. Update `openSettingsSection` docstring.

---

## Phase F — Canonical spec update + typecheck

### Task F1: Mark SM-9 done

- [ ] **Step 28: Update `docs/design/sitemap/web/00-CANONICAL.md`**

In the migration table (§12), change the SM-9 row from:

```
| **SM-9** | Settings absorbs Organisasjon (Struktur tab) + Integrasjoner tab | M (3h) | `/settings` |
```

to:

```
| **SM-9** ✅ | Settings absorbs Organisasjon (Struktur tab) + Integrasjoner tab | M (executed ~Xh) | `/settings/_components/settings-tabs.tsx`, `struktur-panel.tsx`, `integrasjoner-panel.tsx`, `next.config.ts` |
```

### Task F2: Final typecheck gate

- [ ] **Step 29: Full typecheck** — `pnpm turbo typecheck 2>&1 | tail -30`. Zero errors. If errors exist: fix before declaring done.

- [ ] **Step 30: OKLCH / colour hygiene sweep** — `grep -rn 'oklch\|#[0-9a-f]\{3,6\}\|zinc-\|slate-\|gray-\|orange-500' apps/web/src/app/dashboard/settings/_components/struktur-panel.tsx apps/web/src/app/dashboard/settings/_components/integrasjoner-panel.tsx apps/web/src/app/dashboard/settings/_components/struktur-tab-nav.tsx`. Must return zero hits.

- [ ] **Step 31: i18n hardcoded-string sweep** — `grep -n '"[A-ZÆØÅ][a-zæøå]' apps/web/src/app/dashboard/settings/_components/struktur-panel.tsx apps/web/src/app/dashboard/settings/_components/integrasjoner-panel.tsx apps/web/src/app/dashboard/settings/_components/struktur-tab-nav.tsx`. Any Norwegian/English user-visible string not going through `t()` is a violation. Fix before declaring done.

---

## Commit Sequence

Each phase is one commit. Squash is only acceptable within a phase — across phases: separate commits.

| Commit | Scope | Message |
|---|---|---|
| Phase A | `settings/_hooks/`, i18n | `feat(settings): add use-organisation-structure hook + SM-9 i18n keys` |
| Phase B | `struktur-panel.tsx`, `struktur-tab-nav.tsx` | `feat(settings): add StrukturPanel + inner tab nav (Avdelinger/Lokasjoner/Team)` |
| Phase C | `integrasjoner-panel.tsx` | `feat(settings): add IntegrasjonerPanel with POS Integrasjoner live + Tripletex/SendGrid placeholders` |
| Phase D | `settings-tabs.tsx`, `use-settings-tools.ts` | `feat(settings): wire Struktur + Integrasjoner sections into settings sidebar + tools` |
| Phase E | `next.config.ts`, `GlobalSearchPalette`, `DashboardShell`, `BotssonTools`, `entity-config`, `site-map.json` | `feat(navigation): redirect /organization → /settings#struktur-overview, update external references` |
| Phase F | `00-CANONICAL.md` | `docs(sitemap): mark SM-9 ✅` |

All commits target branch `campaign/ui-shell`. Conventional commits with `Co-Authored-By` trailer.

---

## Known Risks + Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| `OrganizationToolsBridge` registers tools from both `organization/page.tsx` (during redirect window) AND `StrukturPanel` simultaneously if user navigates to `/organization` and then to `/settings` within the same session | Low (redirect is 308 permanent — browser won't visit /organization on return) | Bridge uses `useRegisterTools("organization", tools)` keyed by scope string — duplicate registration under same scope is a no-op per the tool registry. No conflict. |
| `TabContent` mapping from settings `TabId` to `OrgTab` is hardcoded string mapping | Low | Typed constant map defined at module level. TypeScript will catch exhaustiveness gaps. |
| Next.js hash-in-redirect stripped by middleware | Medium | Fallback: user lands on `/dashboard/settings` (default tab `hours`). Document in code comment. If confirmed broken, change destination to `/dashboard/settings` and rely on sidebar being visible for user to click Struktur. |
| `use-organisation-structure` re-fetches on every Settings mount even if org data was recently fetched | Low (TanStack Query stale-time default 0) | Set `staleTime: 5 * 60 * 1000` (5 min) on the query. Org structure rarely changes mid-session. Matches the approach in other settings hooks. |
| Existing `OrgTab` sub-tab state lost when user switches settings tabs and returns | Acceptable — by design. `StrukturPanel` re-mounts and resets to `initialTab` (which is `"overview"` by default). Explicit deep-link (`#avdelinger`) re-opens the correct sub-tab. | |
| `PosAccountsList` was built expecting a server-component parent (data pre-fetched). Client-side fetch may produce a loading flash | Low | Wrap in `<Suspense fallback={<SettingsLoadingSkeleton />}>` — same pattern as all other panels. Flash is identical to every other settings panel on first open. |

---

## Rejected Alternatives

**Alt 1: Move `/dashboard/organization/**` files into `/dashboard/settings/struktur/`**

Rejected. 23+ internal call-sites reference `/dashboard/organization` sub-paths. Moving files would require updating breadcrumbs in three detail pages, router.push calls in five components, entity-config hrefs, Botsson tools URLs, and site-map.json. Risk of broken deep-links is high. The "import + redirect" approach (OD-1) achieves the same navigation goal with zero file-system changes.

**Alt 2: Keep `/dashboard/organization` in the sidebar as a secondary item**

Rejected. Spec §2.2 explicitly lists "Organisasjon" as "NOT in the sidebar". The sidebar is locked to 11 items per SM-1. Adding a 12th item contradicts the spec and the work done in SM-1.

**Alt 3: SSR the Struktur panel via a nested Server Component**

Rejected. The settings page (`settings/page.tsx`) is a `"use client"` component — it owns `useState` and passes `activeTab` state to `SettingsTabs`. A nested async Server Component inside a client tree requires a Suspense slot and cannot receive props from client state. TanStack Query is the consistent and correct pattern for all settings panels.

**Alt 4: POS Integrations as a standalone settings sub-route (`/settings/integrasjoner`)**

Rejected. Settings uses a hash-based tab router (not route-based) for its primary panels. Making one panel route-based while others are hash-based creates an inconsistent navigation model. Route-based tabs are valid for hub pages (Ansatte uses PageTabNav variant=route per SM-2/SM-7) but Settings is correctly a left-rail single-page config surface.

---

## Files NOT Modified

These files are explicitly out of scope:

- `organization/page.tsx` — stays alive, redirect handles entry-point.
- `organization/_components/*.tsx` — all five panels imported as-is, zero changes.
- `organization/_tools/*.ts` — Botsson tools remain on the org page.
- `organization/departments/[id]/page.tsx` — detail page, untouched.
- `organization/locations/[id]/page.tsx` — detail page, untouched.
- `organization/teams/page.tsx` and `[id]/page.tsx` — untouched.
- `organization/_components/types.ts` and `constants.ts` — imported, not modified.
- `people/[id]/page.tsx` line 515 (`router.push` to teams detail) — teams detail URL unchanged.
- `entity-config.ts` department/team href templates — detail routes unchanged.

---

## Definition of Done

SM-9 is complete when ALL of the following are true:

1. Navigating to `/dashboard/settings` shows a sidebar with "Struktur" and "Integrasjoner" sections after existing sections.
2. Clicking "Avdelinger" in the sidebar opens the Struktur panel with the Avdelinger sub-tab active.
3. Clicking "POS Integrasjoner" in the sidebar shows the POS list (live data).
4. Navigating to `/dashboard/organization` redirects to `/dashboard/settings#struktur-overview`.
5. Navigating to `/dashboard/organization/departments/some-id` does NOT redirect — the detail page renders normally.
6. `pnpm turbo typecheck` passes with zero errors.
7. OKLCH/colour sweep (Step 30) returns zero hits in new files.
8. i18n hardcoded-string sweep (Step 31) returns zero hits in new files.
9. `docs/design/sitemap/web/00-CANONICAL.md` SM-9 row is marked ✅.
