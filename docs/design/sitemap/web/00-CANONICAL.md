---
title: Web Dashboard Sitemap — Canonical
status: draft
updated: 2026-05-19
created: 2026-05-19
module: design
tags: [sitemap, sidebar, page-tabs, ia, navigation, cascade, canonical]
authors: [pontus, claude]
supersedes: [docs/design/SIDEBAR-reorg-proposal.md, docs/design/SITEMAP-dashboard-audit.md (route inventory only)]
---

# Web Dashboard Sitemap — Canonical

This document is the source of truth for the web dashboard information architecture. It defines **what goes in the left navigation**, **what goes in page-level sub-tabs**, **what is a view-mode**, and **what is a filter**. Companion documents (route inventory, migration path, per-page spec) live in the same `sitemap/web/` folder and are derived from this canonical.

Authority order if anything else contradicts: **this file > module docs > older sitemap drafts**. Code is the only thing that wins above this file — if code does something this file forbids, the code is wrong or this file needs an update.

This spec was derived through iterative design dialogue with Pontus 2026-05-18 → 2026-05-19. Approval is by transcript reference and by commit of this file. The sibling mobile sitemap (`docs/design/sitemap/mobile/`) is unaffected by this document; mobile follows ADR-0133 (web composes, mobile executes) and ADR-0268 (5-tab canonical).

---

## 1. The Four-Layer Model

The single most important rule in this document. Every navigation decision in the web dashboard belongs to exactly one of four layers. If a decision tries to belong to two layers at once, the IA is wrong.

| Layer | Role | UI primitive | Question it answers |
|---|---|---|---|
| **1. Sidebar** | Domain selector | left-rail `<NavItem>` | "Hvor jobber jeg?" |
| **2. Page tabs** | Perspective on the domain | `<PageTabNav>` at top of page | "Hvilken vinkel?" |
| **3. View-mode** | Visualisation of the same data | toggle inside tab body (List / Kalender / Tidslinjer) | "Hvordan vises det?" |
| **4. Filter** | Subset of the data | filter chips + search + status-pickers | "Hvilken del?" |

Worked example — manager planning next week's bar shifts:

1. Layer 1: clicks **Vaktplan** (D6 production domain).
2. Layer 2: selects tab **Vaktplan** (not Vaktbørs, not Ferieplan).
3. Layer 3: toggles view-mode **Tidslinjer** (one row per location).
4. Layer 4: filters to **denne uka** + department **Bar**.

Four decisions, one per layer. The user is taught one model and applies it everywhere. Status flags (Invitert, Sykmeldt, Trainee) belong to Layer 4 only — never their own tab, never their own sidebar entry.

This model maps directly to the Cascade Core (I1 + 6D + 4C + K1a/K1b). The sidebar is a projection of cascade dimensions onto the user surface. New features find their home by asking "which dimension?" before "which page?".

---

## 2. Sidebar — 11 Top-Level Items

The left rail. Manager surface (Drift mode). Employee mode toggles the rail content; see §10. Width is 240px; standalone items (no group header) read top-to-bottom in workflow frequency.

```
┌──────────────────────────────────┐
│  Strøm Mat & Bar          [▼]    │   workspace switcher
├──────────────────────────────────┤
│  ◆  Oversikt                     │
│  ✓  Oppgaver               [3]   │
│  🗓 Planlegging                  │
│  📅 Vaktplan                     │
│                                  │
│  👤 Ansatte                      │
│  🛡 HMS                    [!]   │
│                                  │
│  💰 Lønn                         │
│  📊 Avstemming                   │
│  📈 Rapporter                    │
│                                  │
│  💬 Chat                   [12]  │
│  📢 Kommunikasjon          [5]   │
├──────────────────────────────────┤
│   Mr. Botsson           [aktiv]  │   persistent orb widget
├──────────────────────────────────┤
│  ⚙  Innstillinger                │
│  ?  Hjelp                        │
│  [Drift mode  ━━●]               │
└──────────────────────────────────┘
```

Icons in the sketch are illustrative — final implementation uses Lucide React per `smartout-nordic-split`. No emojis ever ship to UI.

There are no group headers. The blank lines between rows three / six / nine / ten are subtle vertical spacing only (≈ 12px) — they cluster items by cadence (daily-ops / weekly-management / period-close / communication) without claiming the screen real estate that a "DRIFT / ADMINISTRASJON / KOMMUNIKASJON" header would.

The full item table:

| Slot | Item | Default route | Daily / Weekly / Period | Indicator |
|---|---|---|---|---|
| 1 | Oversikt | `/dashboard` | daily | — |
| 2 | Oppgaver | `/dashboard/tasks` | daily | count of own tasks due today |
| 3 | Planlegging | `/dashboard/planning` | weekly | — |
| 4 | Vaktplan | `/dashboard/schedule` | daily | open shifts count (optional) |
| 5 | Ansatte | `/dashboard/people` | weekly | trainee count (optional) |
| 6 | HMS | `/dashboard/hms` | weekly | unacked deviations / overdue training |
| 7 | Lønn | `/dashboard/payroll` | period | unlocked period state |
| 8 | Avstemming | `/dashboard/reconciliation` | daily | days behind close |
| 9 | Rapporter | `/dashboard/reports` | weekly | — |
| 10 | Chat | `/dashboard/chat` | daily | unread DM count |
| 11 | Kommunikasjon | `/dashboard/komm` | daily | unread broadcasts + open Skranke threads |

The icon column is illustrative until each item has a Lucide pick reviewed against Nordic Split (icon weight, stroke, sizing).

### 2.1 Rationale per item

- **Oversikt** — Status dashboard. Every session starts here. Cross-cuts all cascade dimensions.
- **Oppgaver** (C2 agent-utility + D6 production tasks per ADR-0298) — Action queue. Personal-frequency justifies its own slot, separate from Oversikt-as-status.
- **Planlegging** (D4 demand + D5 concept) — Strategic, forward-looking. Year-wheel, season prep, demand forecasting. Daily-ops user rarely opens it, but when they do they need it intact.
- **Vaktplan** (D6 production) — The product's most-used surface. Day-line / shift-session runtime per ADR-0367 lives here.
- **Ansatte** (D2 resource) — People-hub. Workforce identity, contracts, roles, training-status.
- **HMS** (D3 rules + C4 governance) — Compliance + workspace policy. Compliance pressure drives usage; warnings drive frequency.
- **Lønn** (C3 commercial) — Payroll engine surface (per `payroll-engine-developer`). Period-cadence.
- **Avstemming** (C1 calibration) — Day-close reconciliation. Plan-vs-actual.
- **Rapporter** (C1 + C3 read-side) — Insight. Manager meeting prep.
- **Chat** — Conversational messaging. 1↔1 and groups. Highest daily-message volume.
- **Kommunikasjon** — Structured workspace communication. Kanaler, Skranke (helpdesk), Nyheter (broadcasts), Varsler (notifications). Separate from Chat because the mental model is different — formal vs informal.

### 2.2 What is NOT in the sidebar (intentionally)

| Item | Where it lives instead |
|---|---|
| Organisasjon (departments, locations, teams) | tab in Innstillinger ("Struktur") — workspace structure is configuration, not a workflow domain |
| Forslag (change proposals, C4) | tab in Oversikt ("Til godkjenning") + bell badge — transient, not persistent |
| Vaktbørs, Årshjul, Sesong, Foreslått plan, Setup-veiviser | tabs inside Vaktplan / Planlegging — perspectives on D6/D4/D5 |
| Kontrakter, Trening, Roller, Innkalling, Fravær, Invitasjoner | tabs inside Ansatte — perspectives on D2 |
| Avvik, Dokumenter, Drift-sjekk, Styring, Policies, Handbok | tabs inside HMS — perspectives on D3+C4 |
| Kostnader, Fakturering | tabs inside Lønn — C3 sub-perspectives |
| Chat / Nyheter / Skranke / Kanaler / Varsler | distributed across Chat (own item) + Kommunikasjon tabs |
| POS-integrasjoner, Tripletex, other integrations | tab inside Innstillinger ("Integrasjoner") — configuration |
| Onboarding-assistent | inside Mr. Botsson orb experience — not a destination |
| Manualer | tab inside Hjelp |
| Mr. Botsson | persistent orb widget at sidebar bottom — companion, not destination |
| Setup-veiviser | first-run modal flow, surfaced via Planlegging tab when applicable |
| Nettside | open question — see §13 |

This is the result of applying the four-layer model to the current 67-route landscape. The full route inventory and per-route home decision is documented in `01-route-inventory.md` (to be written as a follow-up).

---

## 3. Page Tabs — Full Map

`<PageTabNav>` (canonical pill-row, `apps/web/src/components/dashboard/PageTabNav.tsx`) is the only sub-tab primitive. Variants: `pill` (state-only) and `route` (URL-bound). Tab order on every page is **workflow frequency, highest → lowest**, not alphabetical.

| Sidebar page | Tabs | Notes |
|---|---|---|
| Oversikt | (single page — no tab nav) | Cross-dimension status. Future tabs allowed (e.g. "Til godkjenning") but kept minimal. |
| Oppgaver | Mine · Team · Rutiner | Mine = `task.list_mine` (ADR-0298). Team = manager view. Rutiner = author recurring `session_hook` / `session_task`. |
| Planlegging | Kalender · Årshjul · Eventer · Bookings | D4 + D5. Kalender here = workspace events + holidays + `planning_event` (NOT shifts). |
| Vaktplan | Vaktplan · Vaktbørs · Ferieplan | D6. The "Vaktplan" tab is the drag-drop authoring surface. View-modes inside each tab. |
| Ansatte | Liste · Roller · Kontrakter · Trening | D2. "Invitert" is a status filter on Liste, not a separate tab (§7). |
| HMS | Oversikt · Avvik · Dokumenter · Trening · Drift-sjekk · Styring · Policies · Handbok | D3 + C4. Eight tabs — tolerable because each is a distinct compliance domain. |
| Lønn | Perioder · Lønnsgrunnlag · Tillegg · Kostnader · Fakturering | C3. "Lønnsgrunnlag" is the canonical noun (per L-0237) — never "lønnsslipp". |
| Avstemming | I dag · Historikk · Avvik | C1. "Avvik" here = reconciliation deviations, separate from HMS Avvik. |
| Rapporter | Drift · Lønn · HMS · Egendefinert | Cross-cut read-only. Egendefinert = saved custom reports per workspace. |
| Chat | (single page — no tab nav, channel list in left column inside the page) | DM + groups. |
| Kommunikasjon | Kanaler · Skranke · Nyheter · Varsler | Kanaler = structured workspace channels. Skranke = helpdesk inbox. Nyheter = broadcasts. Varsler = notification feed. |

Total: 35 in-page tabs across 9 tab-bearing pages (Oversikt + Chat are single-view).

### 3.1 Tab semantics — what's a tab vs not

A tab is justified when **the data is the same domain but the workflow is meaningfully different**. Tests:

- "Roller" in Ansatte: same `profile` data, different question ("who has which role" vs. "who exists"). → tab.
- "Sykmeldt" in Ansatte: same data, status filter. → filter, not tab.
- "Vaktplan editor" vs "Tidslinje view" inside Vaktplan: same data, different visualisation. → view-mode toggle, not tab.
- "Vaktbørs" in Vaktplan: different workflow (claim open shifts) on related but distinct data (open `schedule_shift` rows). → tab.

### 3.2 Tab depth — hard limit

Maximum one level of `<PageTabNav>` per page. Sub-sub-tabs are forbidden. If a tab needs further branching, that's a view-mode (Layer 3) or a filter (Layer 4), never another tab strip.

### 3.3 Sub-page navigation pattern

Drill-in routes (entity-detail pages like `/dashboard/people/[id]`, `/dashboard/payroll/[periodId]`, `/dashboard/contracts/[id]`, `/dashboard/season/[seasonId]`, `/dashboard/organization/departments/[id]`) follow the same tab pattern as their hub. The pattern repeats at every URL depth that has multiple perspectives on the same entity.

Rules:

1. **Same primitive.** Drill-in pages render `<PageTabNav>` at the top of the page body, directly below the entity-header. No different component.
2. **Tab keys mirror the hub where applicable.** When the hub tab is "Roller" (people-list as role-matrix), the person-detail tab is also "Roller" (this person's role assignment). The user learns the vocabulary once.
3. **One level only.** A drill-in page's own tab strip is the first level *on that page*. It is not a nested tab under the hub's tab strip. Sub-sub-tabs remain forbidden (§3.2).
4. **Hub tabs disappear on drill-in.** When a user clicks a person from `/people` (which has Liste · Roller · Kontrakter · Trening tabs), they land on `/people/[id]` which shows ONLY the person-detail tabs. Breadcrumb in the top-bar restores context ("Ansatte › Ida Holm").
5. **Tab definitions colocated.** Drill-in tabs typed in `apps/web/src/app/dashboard/<hub>/_lib/<entity>-tabs.ts`, mirroring the existing `people-tabs.ts` pattern.

Canonical drill-in tab sets (specified per entity, expanded over time):

| Drill-in route | Tabs |
|---|---|
| `/dashboard/people/[id]` | Profil · Roller · Kontrakt · Trening · Fravær · Aktivitet |
| `/dashboard/people/[id]/complete-data` | (single-step wizard — no tabs) |
| `/dashboard/payroll/[periodId]` | Oversikt · Lønnslinjer · Avvik · Audit · Eksport |
| `/dashboard/contracts/[id]` | Detaljer · Historikk · Signering · Aktivitet |
| `/dashboard/organization/departments/[id]` | Oversikt · Åpningstider · Sesjoner · Team |
| `/dashboard/organization/locations/[id]` | Oversikt · Avdelinger · Åpningstider |
| `/dashboard/organization/teams/[id]` | Oversikt · Medlemmer · Vakter · Mål |
| `/dashboard/season/[seasonId]` | Plan · Demand · Mål · Konkurranser |
| `/dashboard/hms/procedure/[id]` | Innhold · Versjoner · Tildelinger · Aktivitet |
| `/dashboard/proposals/[proposalId]` | Forslag · Begrunnelse · Diff · Aktivitet |

This list is illustrative — `01-route-inventory.md` (follow-up doc) will track the complete per-entity tab spec.

The pattern is **fractal**: every domain page has the same shape (header → PageTabNav → tab body), whether you're at hub level (`/people`) or drill-in level (`/people/[id]`). User learns one layout, applies it at every depth.

### 3.4 Tab visual

Inherits canonical from `dashboard-page-pattern.md §1.3`:
- `mb-5` between header and tab strip.
- `<PageTabNav>` component only — no hand-rolled `<TabsList>` with copy-pasted className (current state has 12+ ad-hoc instances; remediation lives in `SIDEBAR-UX-AUDIT.md` P1).

---

## 4. View-Modes — Tidslinjer

A view-mode is a visualisation toggle inside a tab body. The same underlying data is rendered differently. View-modes never change the URL (state only).

### 4.1 Tidslinjer — one row per location

`Tidslinjer` is the canonical timeline view-mode. Layout is Gantt-stacked with the Y-axis bound to `location` (one row per physical location in the workspace) and the X-axis bound to time (configurable: day / week / month).

```
[Vaktplan]    View: [📋 Liste] [🗓 Kalender] [⏱ Tidslinjer ◄]
─────────────────────────────────────────────────────────────
              06   09   12   15   18   21
Strøm Bar    ██████████████          ████████
Strøm Kjøk    █████   ████████████  ███████
Strøm Skj         ██████      ███████████
Annex Bar    ████████████████████████
─────────────────────────────────────────────────────────────
```

A single timeline row composes all timeline-eligible entities for that location:

| Entity | Source table | Cascade |
|---|---|---|
| Department session block | `department_session` + `day_line` + `shift_session` | D6 (per ADR-0367 tri-layer) |
| Planning event | `planning_event` | D4 |
| Booking | `booking` (or successor table per current schema) | D4/D5 |
| Absence block | `schedule_absence` | D2 |
| Open shift (Vaktbørs) | `schedule_shift WHERE status='open'` | D6 |

Tidslinjer is **the same component, reused on every timeline-bearing surface**. Wiring it once and exposing it as a view-mode toggle on each affected tab is cheaper and more consistent than building seven distinct Gantt screens.

### 4.2 Where Tidslinjer appears

| Sidebar page | Tab | Tidslinjer toggle |
|---|---|---|
| Oversikt | (single) | yes — multi-location today-view |
| Planlegging | Kalender | yes |
| Planlegging | Årshjul | yes (zoomed to season scale) |
| Planlegging | Eventer | yes |
| Planlegging | Bookings | yes |
| Vaktplan | Vaktplan | yes |
| Vaktplan | Vaktbørs | yes |
| Vaktplan | Ferieplan | yes |

Eight callsites for one component. Each location-bound entity that wants to appear on Tidslinjer must supply a `(location_id, start, end, label, kind)` projection — this is a small typed contract, not an inheritance hierarchy.

### 4.3 Other view-modes

Other view-modes are local to their tab and not cross-cutting:
- Vaktplan tab supports: `[📋 Liste] [🗓 Kalender] [⏱ Tidslinjer]` — three view-modes including the canonical Tidslinjer.
- Kalender tab supports: `[🗓 Måned] [📅 Uke] [📋 Liste] [⏱ Tidslinjer]`.
- Ferieplan tab supports: `[📋 Liste] [⏱ Tidslinjer]`.

A view-mode toggle that is unique to one tab is just normal page UI. It does not need its own primitive.

---

## 5. Cross-Cutting Primitives

Three things look like they want their own page but are actually instances of existing primitives. Recognising this saves entire sidebar slots and keeps the cascade model honest.

### 5.1 Innkalling = a `planning_event` with attendees

"Innkalling til ansatt-samtale" (calling in an employee for a 1-on-1) is a calendar event with attendees. It is not a new domain. It does not deserve a separate page or tab.

Implementation:
- Event row in `planning_event` (or `calendar_event` if a dedicated table exists).
- `event_type = 'employee_meeting'` (new enum value).
- `attendees` collection referencing `profile_id`.
- Organizer = the manager's `profile_id`.
- Visibility = private — only invited parties see the event.
- Notification fires to invitees through the standard Varsler pipeline.

Creation lives in Planlegging → Kalender → "Ny event" with the event-type picker. No new UI surface; the calendar already supports event creation, we just register a new event-type.

### 5.2 Varsler = a tab in Kommunikasjon AND a bell-overlay

Two surfaces, one data source. The notification feed (`notification` table or equivalent) is read in two ways:

- **Persistent** — Kommunikasjon → Varsler tab. Full feed, filterable, archivable. This is the home.
- **Transient** — bell icon in topbar opens a sheet with the latest N. Sheet's "Se alle →" links to the Varsler tab.

The same component (`<VarslerFeed>`) renders both surfaces. The sheet variant caps at N items + has a footer link; the tab variant has full list + filter chips. No duplicate state, no separate code path.

### 5.3 Invitasjoner = a status-filter on Liste, with a badge

"Pending invitations to the workspace" are not a separate workflow. They are people in the `invited` status, before they accept and become `trainee` or `active`. The Liste tab in Ansatte exposes a filter chip:

```
[Alle] [Aktive] [Trainees] [Invitert 7] [Offboarding]
                          └─ count badge
```

The badge on the "Invitert" chip is the answer to Pontus's question "kan ikke se hvor mange er på invitasjon nå". Count visible without opening a tab. Click chip → filtered list. Status is data, not structure.

---

## 6. Status-as-Filter Principle

A direct consequence of the four-layer model. Status flags belong to Layer 4. They never get their own tab and never get their own sidebar entry.

Smartout has several enum-valued status surfaces that have historically been tempted into IA:

| Status | Where it lives now (correct) | Where it would be wrong |
|---|---|---|
| `profile.status = invited` | filter on Ansatte → Liste | own tab "Invitasjoner" |
| `profile.status = trainee` | filter on Ansatte → Liste | own tab "Trainees" |
| `profile.status = offboarding` | filter on Ansatte → Liste | own tab "Offboarding" |
| `schedule_shift.status = open` | tab "Vaktbørs" in Vaktplan **OR** filter on Vaktplan tab | own sidebar item |
| `schedule_absence.kind = vacation` | tab "Ferieplan" in Vaktplan | own sidebar item |
| `payroll_period.status = locked` | filter on Lønn → Perioder | own tab |
| `deviation.acknowledged` | filter inside HMS → Avvik | own page |

Vaktbørs is an interesting case — it's a status (`schedule_shift.status='open'` with marketplace flag) **and** a distinct workflow (claim, swap, broadcast). When a workflow attaches to the status, a tab is justified. When only a filter attaches, it's a filter. The test is "does the operator's mental model treat this as a different activity?" — claiming an open shift is, filtering to active employees isn't.

---

## 7. Mr. Botsson — The Companion

Mr. Botsson is not a sidebar item. He is a persistent orb widget below the main nav and above the footer block. He travels with the user across every page. The orb is the call-to-action; tapping it opens the BotssonShell. Voice (LiveKit) routes through the same orb.

Implications:
- Onboarding-assistent is an interaction *with* Mr. Botsson, not a destination. The route `/dashboard/onboarding-assistant` (currently orphan) can be deleted once the orb-bound flow replaces it.
- `/dashboard/ai` and `/dashboard/ai/config` are operator-config surfaces, not user-facing. They live under Innstillinger → AI tab.
- The orb is always visible. The bell-icon (Varsler) is always visible. These two are the only persistent elements outside the main nav.

This matches ADR-0238 (domain chat ownership) — when a page declares a domain chat surface, the orb suppresses to passive mode and yields the textbox. Otherwise the orb is active and the textbox is workspace-wide.

---

## 8. Cascade Mapping

Each sidebar item maps to one or more cascade dimensions or control planes. New features find their home by asking "which dimension or plane?" and selecting the corresponding sidebar item.

| Sidebar item | Cascade dim / plane | Core tables |
|---|---|---|
| Oversikt | cross | aggregates from D2 + D6 + C1 |
| Oppgaver | C2 + D6 | `personal_task`, `emma_task`, `session_task`, `schedule_day_task` |
| Planlegging | D4 + D5 | `season_budget`, `planning_event`, `day_factor`, `hour_factor`, `workspace_budget`, workspace config |
| Vaktplan | D6 | `schedule_shift`, `department_session`, `day_line`, `shift_session`, `session_hook`, `session_task`, `deviation`, `schedule_absence` |
| Ansatte | D2 | `profile`, `employment_contract`, `employee_payroll_profile`, `team` |
| HMS | D3 + C4 | `regulatory_framework`, `framework_rule`, `framework_trigger`, `policy`, `protocol`, `change_proposal`, `engine_authority_config` |
| Lønn | C3 | `payroll_period`, `payroll_line`, `payroll_calculation`, `shift_pay_calculation_event`, `tariff_rate_table`, `manual_supplement` |
| Avstemming | C1 | `daily_reconciliation`, `workspace_kpi_target`, `planning_factors`, `adjustment_factors` |
| Rapporter | C1 + C3 read | (read-side aggregates across all of the above) |
| Chat | — (not a cascade dimension; conversational layer) | chat tables |
| Kommunikasjon | — (workspace-comm layer) | broadcast / notification / channel tables |

K1a (industry intelligence) surfaces through Planlegging during setup-veiviser flow and through HMS for tariff/regulatory display. K1b (workspace knowledge) is invisible — it's the substrate Mr. Botsson reads. Neither needs its own sidebar item.

I1 (industry bootstrap) is one-time per workspace and lives in Planlegging → Setup-veiviser, gated by `is_bootstrap_completed` workspace flag.

---

## 9. Sub-Tab Pattern (Authoritative)

Repeated here from the audit (`SIDEBAR-UX-AUDIT.md` §5) so this document is self-contained.

Use the single canonical primitive `<PageTabNav>` with two variants:

- **`variant="pill"`** — in-page state tabs. Tab state lives in component state. URL does not change. Default.
- **`variant="route"`** — URL-bound tabs. Each tab is a route. Refresh preserves tab. Deep-links land on the right tab.

```tsx
<div className="relative flex h-full min-h-0 flex-1 flex-col p-4 pt-1 md:p-6 md:pt-3">
  {/* Page header */}
  <div className="mb-5 flex items-end justify-between gap-4">
    <h1 className="font-heading text-foreground text-3xl leading-tight tracking-tight">
      {pageTitle}
    </h1>
    <div className="flex items-center gap-1.5">{actions}</div>
  </div>

  {/* Sub-tab */}
  <PageTabNav
    tabs={TAB_DEFS}
    active={activeTab}
    onChange={setActiveTab}
    variant="route"
    basePath="/dashboard/people"
    className="mb-5"
  />

  {/* Body — fills remaining height, never page-scrolls */}
  <div className="min-h-0 flex-1 overflow-hidden">
    {activeTab === "list" && <ListView />}
    {activeTab === "roles" && <RolesView />}
    {/* … */}
  </div>
</div>
```

Rules (enforced by audit + ESLint candidate):
1. One `<PageTabNav>` per page. Never two strips stacked.
2. Tabs labels ≤ 14 chars. Add icons only when strip has ≥ 5 tabs.
3. Order = workflow frequency, highest → lowest. Not alphabetical.
4. `mb-5` between page header and tab strip. Always.
5. No `<TabsList>` with hand-rolled classNames. The 12+ existing ad-hoc instances are scheduled for codemod in `SIDEBAR-UX-AUDIT.md` P1.
6. No view-mode toggle inside the tab strip. View-mode lives in the tab body, top-right.
7. No nested tab strips. Period.

---

## 10. Employee Mode

The toggle at the bottom of the sidebar (Drift mode ↔ Min Tid mode) replaces the entire nav content. It is not an additive switch; it is a context switch.

**Min Tid mode sidebar:**

```
◆  Oversikt
   Min plan                  /my-schedule
   Min lønn                  /my-salary
   Min kontrakt              /my-contract
   Min CV                    /my-cv
   Min trening               /my-training
   Min profil                /my-profile
   Stempelur                 /shift-clock
💬 Chat
📢 Kommunikasjon
```

10 items in Min Tid (1 Oversikt + 7 personal + Chat + Kommunikasjon). No HMS, no Lønn (manager view), no Vaktplan editor, no Planlegging, no Rapporter, no Avstemming — those are author/compose surfaces (ADR-0133) that don't apply to the employee role.

Mr. Botsson orb + Innstillinger + Hjelp + the toggle itself stay in the footer.

Min Tid mode's "Min plan" is the employee's read view of `schedule_shift` (their own rows only). It is not a separate IA — same data, scoped query. Status-as-filter applies: "alle / kommende / forrige uke" are filters on the personal schedule.

The detailed mobile mirror of this employee surface lives in `docs/design/sitemap/mobile/` and is not duplicated here.

---

## 11. Visual Hierarchy

This section is a pointer to `SIDEBAR-UX-AUDIT.md` (sibling, same `sitemap/` folder). The audit specifies:

- Sidebar width: 240px (down from 256px).
- Group headers: none on the 11-flat layout. Spacing as separator.
- Active-item indicator: pill highlight on `<NavItem>` (existing behavior).
- Active-section indicator: when a sub-route is active (e.g. on `/dashboard/people/contracts`), the corresponding `<NavItem>` ("Ansatte") stays highlighted. Sidebar never lies about location.
- Theme: drop `isDark ? ... : ...` ternaries in `DashboardShell.tsx`; replace with Nordic Split tokens (`bg-sidebar`, `border-sidebar-border`, `text-sidebar-foreground`). One source of truth.
- Footer: Settings + Help + mode toggle, unchanged behavior, normal `<NavItem>` styling (no parallel custom chrome).

Implementation lives in the audit's P0 sortie (UX-A). This canonical only specifies the structure; the audit specifies the visual.

---

## 12. Migration Path

Current state (`development` branch, verified 2026-05-18):
- 9 sidebar groups, 52 admin items, 12 employee items.
- 23 orphan routes (no sidebar entry, no breadcrumb path).
- 3 competing sub-tab implementations.

Target state (this document):
- 11 flat top-level items (no group headers).
- 35 in-page tabs.
- 0 orphan routes (every route resolves to a sidebar item, a tab, a view-mode, or a filter).
- 1 sub-tab primitive (`<PageTabNav>`).

Recommended sortie sequence (each independent, each reversible):

| Sortie | Scope | Effort | Touch |
|---|---|---|---|
| **SM-1** ✅ | Sidebar config rewrite — 11-flat structure (visual files preserved per "kun navigation" scope-tightening 2026-05-19) | M (executed ~30min) | `sidebar-config.ts`, `nb/dashboard.json`, `en/dashboard.json` |
| **SM-2** | Ansatte hub — add Roller / Trening / move Contracts under `/people/contracts` | M (6h) | `/people/*` |
| **SM-3** | Planlegging hub — gather Kalender, Årshjul, Eventer, Bookings | M (5h) | `/planning` (new), absorbs `/year-wheel`, `/season` |
| **SM-4** | Vaktplan tab structure + Vaktbørs + Ferieplan | M (4h) | `/schedule` |
| **SM-5** | Chat + Kommunikasjon split | M (4h) | `/chat` (new), `/komm` restructure |
| **SM-6** | Tidslinjer view-mode component | L (8h) | new component, wired into 8 callsites |
| **SM-7** ✅ | PageTabNav variant=route + codemod 7 hand-rolled TabsList (5 exceptions kept) | M (executed ~45min) | `PageTabNav.tsx`, 7 page-component files |
| **SM-8** | Mr. Botsson as orb (not menu item) | S (2h) | `DashboardShell.tsx` |
| **SM-9** | Settings absorbs Organisasjon (Struktur tab) + Integrasjoner tab | M (3h) | `/settings` |
| **SM-10** | Drop dead routes: `/onboarding-assistant`, `/ai/config` (move to settings), maybe `/website` (see §13) | S (2h) | various |

Total: ~43h of sortie work. Parallelizable into 3–4 worktrees if needed. Order is roughly SM-1 → SM-2/3/4/5 (parallel) → SM-6/7 (parallel) → SM-8/9/10.

Migration is reversible at every step — sidebar is a config file change, tab strips are component swaps, view-mode is additive. No database changes are required by this document; all referenced tables already exist.

---

## 13. Open Questions

These are unresolved as of writing. They are flagged but do not block this spec.

| # | Question | Default if unresolved | Resolution path |
|---|---|---|---|
| O1 | Is `/dashboard/website` active product or dormant? | Dormant — delete `website` route + landing-side surfaces, recover slot. | Pontus decides. |
| O2 | Is `/dashboard/billing` workspace-billing or platform-billing? | Platform-billing — delete from workspace dashboard, lives under platform-admin. | Pontus decides. |
| O3 | Should "Innkalling" event-type be `employee_meeting` or a more general `one_on_one`? | `employee_meeting` (matches Norwegian usage). | Implementation review. |
| O4 | Tidslinjer when the workspace has only one location — does the Y-axis collapse to departments? | Yes, collapse to `department` Y-axis when `locations.count = 1`. | Component spec. |
| O5 | Min Tid mode — does Chat in employee context include manager-DMs, or only peer-DMs? | Both. Filter by channel-membership only, no role-gate. | Confirm in implementation. |
| O6 | Are workspace-level `policy` and `handbook` two distinct HMS tabs, or one with a sub-filter? | Two tabs (Policies + Handbok) — different authorship workflows. | Confirmed by Pontus, locked. |
| O7 | "Foreslått plan" surface (currently `/schedule/proposed-plan`) — tab in Vaktplan, or modal/drawer triggered from Vaktplan? | Drawer triggered by C2 agent surface, not a tab. | Confirmed by dialogue. |

---

## 14. Companion Docs (to be written)

This spec is the canonical. Per-area detail belongs in sibling documents:

- `01-route-inventory.md` — full URL → home table (every existing route mapped to sidebar / tab / view-mode / filter / deleted).
- `02-navigation-graph.md` — links between pages, breadcrumb taxonomy, deep-link policy.
- `03-page-specs/ansatte.md` etc. — per-hub detailed tab spec, data hooks, KPI strip per tab.
- `04-tidslinjer-component.md` — Tidslinjer component contract (props, projection interface, performance budget).
- `05-employee-mode.md` — Min Tid surface detail (parallel to mobile `sitemap/mobile/`).
- `06-migration-runbook.md` — per-sortie checklist for SM-1 through SM-10.

These do not block the canonical. They are derived from it.

---

## 15. Minimal Code Change Principle

This spec is **not a rewrite**. It is a reshaping of what already exists, governed by the four-layer model. The ambition is world-class WFM; the discipline is to reach it by re-using what works, not by deleting and starting over.

Concrete rules every SM-sortie must satisfy:

1. **Reuse before rebuild.** Existing components (`<PageTabNav>`, `<NavItem>`, `<SidebarGroup>`, `<KpiAccentTile>`, all hooks under `_hooks/`) keep their public API. Codemods change call-sites; component bodies stay unless §3.4 requires a tightening.
2. **Reuse before re-route.** When a route moves (e.g. `/contracts` → `/people/contracts` in SM-2), the move is `git mv` + a Next.js `redirect()` from the old path. The page component body, hooks, server actions, telemetry registry entries stay identical. Old deep-links keep working.
3. **No schema changes.** Every table referenced in this spec already exists. New event-types (`employee_meeting`, etc.) are enum-value additions, not new tables.
4. **Component reuse explicit.** Tidslinjer (§4) is one new component reused 8 times. The view-mode toggle is one new primitive reused on every timeline-bearing tab. The Ansatte Trening tab queries the same `protocol_assignment` rows as HMS → Trening — only the projection differs. No data duplication, no parallel hooks.
5. **Status-as-filter, not new table.** §6 is partly a code rule: never invent a new status enum or new boolean column when an existing one already discriminates the rows the filter needs.
6. **Telemetry contracts intact.** Every existing `emit()` call site is preserved. No event renames. New events (e.g. `sidebar.group_collapsed`) are additive in `packages/telemetry/src/registry.ts`.
7. **ADR-0133 honored.** Web composes. Mobile executes. Nothing in this spec authors on mobile or executes on web. Min Tid (§10) is a read-view of web data, not a separate authoring surface.
8. **Cascade boundaries respected.** D1–D6 + C1–C4 + K1a/K1b boundaries stay intact. This spec does not move a table between dimensions. It only changes which sidebar item the user reaches it through.
9. **Reversibility.** Every sortie can be reverted by reverting one commit. Sidebar shape is a config file (`sidebar-config.ts`). Tab structure is a route file change. View-modes are local state. No migration is destructive.

If a proposed implementation breaks any of these, the implementation is wrong — not this spec.

The goal is the best WFM tool in the world. The path is small, careful, reversible cuts to an existing system that already does most of the job.

---

## 16. What Stays The Same

- All routes that survive (most of them) keep their URL until SM-2/3/4 sorties actively rename them. Migration is by redirect, not by ghost.
- Nordic Split design system applies as-is. No colors change. No fonts change.
- `dashboard-page-pattern.md` (page-shell rules) is unchanged and authoritative for page bodies. This spec sits above it.
- Mobile (`apps/mobile/`) is unaffected. ADR-0133 boundary preserved.
- Cascade Core (I1 + 6D + 4C + K1a/K1b) unchanged. This spec is a projection of it onto the user surface, not a change to it.

---

## 17. TL;DR

Eleven top-level items in the sidebar, flat, ordered by daily-frequency. Thirty-five in-page tabs across nine of those items. One canonical timeline view-mode (Tidslinjer, one row per location) reused on eight surfaces. Status is always a filter, never a tab. Cross-cutting concerns (Innkalling, Varsler, Invitasjoner) are instances of existing primitives, not new pages. The four-layer model (sidebar / tabs / view-mode / filter) tells you where any feature belongs. Cascade Core tells you which sidebar item it belongs to.

This is not a redesign. It is the existing system, applied consistently.
