---
title: "Interactive Dashboard Redesign — Living Command Center"
status: draft
updated: 2026-03-29
created: 2026-03-29
module: dashboard
tags: [dashboard, cockpit, redesign, bento-grid, interactive, action-oriented]
---

# Interactive Dashboard Redesign — Living Command Center

> Replace the passive tactical/strategic dashboard with an action-oriented bento grid that adapts between Operative and Preparatory modes.

## Problem

The current dashboard is a report you read, not a tool you use. Data takes too much space. There are no inline actions — everything requires navigating away. The strategic view is disconnected from the tactical view. The user's words: "Du skal ikke se på data, du skal kunne agere."

## Design Principles

1. **Action-first** — Every card either shows something you act on or helps you act
2. **Compact default, expand on demand** — Cards are small and dim until they need attention, then glow and expand
3. **Context-aware** — System picks the right mode; user can override
4. **Living** — Realtime updates, pulse animations, glow effects. Not a static page.
5. **No navigation** — Actions happen inline (drawers, popovers, inline forms). Never leave the dashboard to complete an action.

---

## 1. Dual Mode System

### 1.1 Modes

| Mode            | Norwegian label | When active                                                                                                       | Focus                                  |
| --------------- | --------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| **Operative**   | "Drift"         | Active shifts exist (any `schedule_shift` today with `status = 'published'` AND current time within shift window) | What's happening now, handle it        |
| **Preparatory** | "Forberedelse"  | No active shifts, OR manual toggle                                                                                | What needs to happen before next shift |

### 1.2 Auto-detection (council-corrected)

Primary signal: `schedule_shift` with `status = 'published'` AND `shift_date = today` AND current time within shift time window. This catches "shifts exist but nobody has clocked in yet" (e.g., 07:55 before 08:00 open).

```
if (todayShiftsInWindow.length > 0) → Operative
else → Preparatory
```

`useLiveShifts` enriches with `time_entry` data for status (clocked_in/late/etc), but mode detection uses the shift schedule, not clock-in state.

Re-evaluated on every `useLiveShifts` refetch (realtime subscription on `timesheet.time_entry`).

### 1.3 Toggle

Segmented control in the metric strip: `Drift | Forberedelse`. Active segment has brand-orange underline. Clicking overrides auto-detection until next page load or until user clicks "Auto" (third option that re-enables auto-detection).

Three states: `Drift | Forberedelse | Auto` — Auto is the default and shows a subtle indicator of which mode it selected.

---

## 2. Metric Strip (shared, both modes)

Compact 56px bar across the top. Always visible.

### 2.1 Layout

```
[Mode toggle: Drift|Forberedelse|Auto] [—spacer—] [metric pills] [—spacer—] [last updated]
```

### 2.2 Metric Pills

Small pill badges (not cards). Each pill: icon + number + label. Glows when value is non-zero and critical.

**Operative pills:**

- On duty: `{count}` (teal when > 0)
- Late: `{count}` (red glow when > 0)
- Deviations: `{count}` (red glow when > 0)
- Tasks due: `{count}` (orange when > 0)

**Preparatory pills:**

- Gaps next 7d: `{count}` (red when > 0)
- Unsigned contracts: `{count}` (orange when > 0)
- Expiring training: `{count}` (orange when > 0)
- Budget variance: `{%}` (red/green)

Pills transition with crossfade (200ms) when mode switches.

### 2.3 Glow behavior

A pill with value 0 = `text-muted-foreground`, no glow. Value > 0 and severity normal = `var(--color-warning)`. Value > 0 and severity critical = pulsing `var(--glow-brand)`, 2s cycle. All colors from design tokens, never hardcoded RGBA.

---

## 3. Bento Grid Layout

CSS Grid with named areas. Cards flow into the grid. Desktop: 12-column grid. Tablet: 6-column. Mobile: 2-column stack.

### 3.1 Operative Mode Grid (desktop)

```
┌──────────────────────┬─────────────┬──────────────┐
│                      │             │              │
│    Task Swiper       │  On-Duty    │  Activity    │
│    (6 cols, 2 rows)  │  Strip      │  Feed        │
│                      │  (3 cols)   │  (3 cols)    │
│                      │             │              │
├──────────────────────┤             │              │
│                      ├─────────────┤              │
│  Quick Broadcast     │  KPI Pills  │              │
│  (6 cols)            │  (3 cols)   │              │
│                      │             │              │
└──────────────────────┴─────────────┴──────────────┘
```

- **Task Swiper**: Biggest card. Main interaction point.
- **On-Duty Strip**: Compact avatar row with status dots.
- **Activity Feed**: Scrollable timeline. Full height of grid.
- **Quick Broadcast**: Inline message composer.
- **KPI Pills**: 2×2 mini KPI cards.

### 3.2 Preparatory Mode Grid (desktop)

```
┌──────────────────────┬─────────────┬──────────────┐
│                      │             │              │
│  Prep Action Cards   │  Staffing   │  Activity    │
│  (6 cols, 2 rows)    │  Coverage   │  Feed        │
│  - Gaps to fill      │  (3 cols)   │  (3 cols)    │
│  - Tasks to create   │  7-day view │              │
│  - Training overdue  │             │              │
├──────────────────────┤             │              │
│                      ├─────────────┤              │
│  Quick Broadcast     │  KPI Pills  │              │
│  (6 cols)            │  (3 cols)   │              │
│                      │             │              │
└──────────────────────┴─────────────┴──────────────┘
```

- **Prep Action Cards**: Stack of actionable items (create task, assign, fill gap). Each is a mini-form.
- **Staffing Coverage**: 7-day bar chart showing fill rate per day. Click a day → see gaps.
- **Activity Feed**: Same component, shared across modes.
- **KPI Pills**: Strategic KPIs in compact form.

---

## 4. Task Swiper (Operative)

The hero component. Shows one actionable card at a time. Swipe or arrow-key to next.

### 4.1 Card Types

| Type                 | Source                                   | Title                        | Actions                                                  |
| -------------------- | ---------------------------------------- | ---------------------------- | -------------------------------------------------------- |
| **Shift gap**        | `staffingQueue`                          | "{role} — {time}"            | "Finn vikar" → opens assign drawer, "Avvis" → swipe away |
| **Deviation**        | `operationalQueue` (blocking deviations) | "{deviation title}"          | "Tildel" → assign popover, "Se detaljer" → entity drawer |
| **Overdue task**     | `operationalQueue` (overdue tasks)       | "{task name}"                | "Fullfør" → mark done, "Tildel" → assign                 |
| **Late arrival**     | `onDutyEntries` where status=late        | "{name} — {minutes} min sen" | "Send påminnelse" → push notification, "Avvis"           |
| **Pending approval** | session signoff / shift approval         | "{session} venter signering" | "Godkjenn" → approve, "Se detaljer" → drawer             |
| **Upcoming task**    | `operationalQueue` (upcoming)            | "{task name} om {time}"      | "Tildel" → assign, "Utsett"                              |

### 4.2 Card Design

- `min-h-[10rem] max-h-[14rem]` (content-driven, not fixed). Rounded-2xl. `bg-card` with `border-border`.
- Left: severity color strip (4px). Glow if critical.
- Top: Type badge + timestamp.
- Center: Title (semibold 16px) + subtitle (muted 13px).
- Bottom: 2 action buttons. Primary = brand-orange filled. Secondary = ghost.
- Swipe gesture: drag horizontally. >50% threshold = dismiss. Spring animation back if not enough.
- Keyboard: ← → to navigate, Enter for primary action, Backspace to dismiss.
- Counter: "3 av 12" bottom-right in muted text.
- Empty state: "Ingen ventende oppgaver" with checkmark. Green tint.

### 4.3 Data Source

Aggregated from `useCockpitFirstScreen()`:

- `staffingQueue` → shift gap cards
- `operationalQueue` → deviation + task cards
- `onDutyEntries.filter(e => e.status === 'late')` → late arrival cards

Plus new query for pending approvals (session signoff where `status = 'pending_signoff'`).

Sorted by severity (critical first) → timestamp (oldest first).

### 4.4 Dismiss Behavior

Swiped/dismissed cards are hidden for the session (stored in `useState<Set<string>>`). They reappear on page reload. This is intentional — dismissing means "I've seen it" not "resolve it".

---

## 5. On-Duty Strip (Operative)

Compact horizontal row of avatars showing who is working right now.

### 5.1 Layout

```
[👤 👤 👤 👤 👤 👤 ... +3] [Totals: 8 på jobb · 1 pause · 1 sen]
```

- Avatar circles: 36px visual, 44px clickable area (WCAG 2.2 touch target). Initials inside (Geist Sans 11px bold).
- Status dot: 10px circle, bottom-right of avatar. `var(--color-success)` = clocked_in. `var(--color-info)` = on_break. `var(--color-error)` = late. `var(--color-warning)` = waiting.
- If > 8 people: show first 8 + "+N" overflow pill.
- Click avatar → entity drawer for that profile (read-only per ADR-0068).
- Click totals → expands to full on-duty list (current CockpitOnDutyProgress content, but as an expandable panel, not permanent).

### 5.2 Expand Behavior

Totals area is a button. Click → AnimatePresence panel slides down showing full shift cards (reusing existing card markup from CockpitOnDutyProgress). Click again → collapse. Spring animation (stiffness 35, damping 22).

---

## 6. Activity Feed (shared, both modes)

Right-side scrollable column. Shows what's happening/happened in real-time.

### 6.1 Layout

- Full height of grid (matches tallest neighbor).
- Header: "Aktivitet" + filter pills (Alle | I dag | 7 dager).
- Each entry: timestamp (Geist Mono 11px, muted) + dot (severity color) + text (13px) + actor name (muted).
- Auto-scroll to bottom. New entries slide in from bottom with stagger animation (y: 8→0, opacity 0→1, 100ms).
- "Pin to bottom" toggle — when on, auto-scrolls. When off, stays at scroll position.

### 6.2 Realtime

Uses existing `useActivityFeed()` hook with Supabase Realtime subscription on `activity_trail`.

### 6.3 Clickable entries

Click an entry → opens entity drawer based on `entityType` + `entityId` from the activity trail row (same routing logic as current CockpitActivityFeed).

---

## 7. Quick Broadcast (shared, both modes)

Inline message composer for sending to groups.

### 7.1 Layout

Card with 3 recipient-group buttons + text input + send button.

```
┌──────────────────────────────────────────────┐
│  Til:  [På jobb] [Kommer i dag] [Var her i går]  │
│                                              │
│  [Skriv melding...                    ] [Send]│
└──────────────────────────────────────────────┘
```

### 7.2 Recipient Groups

| Button        | Label                                           | Query                                            |
| ------------- | ----------------------------------------------- | ------------------------------------------------ |
| På jobb       | People with active `time_entry` now             | `timesheet.time_entry` where `clock_out IS NULL` |
| Kommer i dag  | People with shifts today who haven't clocked in | `schedule_shift` today, no matching `time_entry` |
| Var her i går | People who clocked out yesterday                | `time_entry` where `clock_out` was yesterday     |

Multiple groups can be selected (toggle). Badge shows count per group.

### 7.3 Send Behavior

Send → creates `channel_message` in a workspace-wide broadcast channel (or per-department if department filter active). Toast: "Sendt til {count} personer". Message appears in activity feed.

### 7.4 Expand Behavior

Default: collapsed to one line (just the recipient buttons + input). Expanded: shows recipient list preview below the buttons (avatars + names of who will receive).

---

## 8. Prep Action Cards (Preparatory)

Stack of actionable cards for things that need doing before next operations.

### 8.1 Card Types

| Type                  | Source                   | Title                                | Inline Action                                                             |
| --------------------- | ------------------------ | ------------------------------------ | ------------------------------------------------------------------------- |
| **Staffing gap**      | `useStaffingCoverage()`  | "Mandag 31/3: 2 hull"                | "Finn vikar" button → assign drawer                                       |
| **Create task**       | Quick-add                | "Ny oppgave"                         | Inline form: title + assign-to + due date. Submit creates `session_task`. |
| **Unsigned contract** | `useActionItems()`       | "{name} — kontrakt venter"           | "Send påminnelse" → push, "Se kontrakt" → drawer                          |
| **Training expiring** | `useTrainingReadiness()` | "{name} — {protocol} utløper {date}" | "Send påminnelse" → push, "Se status" → drawer                            |
| **Budget drift**      | KPI targets              | "Varekost {actual}% (mål {target}%)" | "Se detaljer" → strategic drill-down                                      |

### 8.2 Create Task Inline

One of the prep cards is always a "Ny oppgave +" card at the bottom. Click → expands to inline form:

- Title input (required)
- Assign to (profile selector dropdown)
- Due date (date picker, default: tomorrow)
- Submit → inserts `session_task`, toast confirmation, card collapses

### 8.3 Sort Order

Critical items first (staffing gaps, expiring training) → actionable items → informational. Same severity-based sort as task swiper.

---

## 9. KPI Pills (mode-specific)

2×2 grid of compact KPI cards. Each is ~120px wide, ~80px tall.

### 9.1 Operative KPIs

| KPI             | Source                      | Display                             |
| --------------- | --------------------------- | ----------------------------------- |
| Task completion | `useTaskCompletion()`       | Ring chart (tiny) + "67%"           |
| Deviation count | `operations.openDeviations` | Number + severity color             |
| Staff present   | `operations.staffPresent`   | "{present}/{expected}"              |
| Session status  | department session          | Badge: "Aktiv" / "Venter signering" |

### 9.2 Preparatory KPIs

| KPI                | Source                   | Display                |
| ------------------ | ------------------------ | ---------------------- |
| Training readiness | `useTrainingReadiness()` | "82%" + trend arrow    |
| Absence rate       | `useAbsenceRate()`       | "4.2%" + trend arrow   |
| Staff turnover     | `useStaffTurnover()`     | "8%" + trend arrow     |
| Fill rate next 7d  | `useStaffingCoverage()`  | "91%" + mini bar chart |

### 9.3 Click Behavior

Click any KPI → expands inline to show details + target configuration. Uses existing `useKpiTargets()` for editing. AnimatePresence layout animation.

---

## 10. Staffing Coverage (Preparatory)

7-day compact bar chart showing shift fill rate per day.

### 10.1 Layout

```
┌─────────────────────────────────────┐
│  Bemanning neste 7 dager            │
│  Man  Tir  Ons  Tor  Fre  Lør  Søn │
│  ██   ██   ██   ▓▓   ██   ▒▒   ██  │
│  100% 95%  100% 75%  90%  60%  100% │
└─────────────────────────────────────┘
```

- Full bar = 100% filled (green). Partial = proportional (orange < 80%, red < 60%).
- Click a day → popover with gap details (which shifts, which roles missing).
- Data: `useStaffingCoverage()` (already exists).

---

## 11. Animation & Glow System

All animations follow Nordic Split motion spec (`docs/design/motion.md`). Three spring tiers:

- **Ambient:** stiffness 30-45, damping 20-24, mass 2-2.5 (card entrance, mode switch)
- **Interactive:** stiffness 80-120, damping 14-18 (task swiper drag/snap)
- **Snappy:** stiffness 200-300, damping 20-25 (pill expand, button press)

### 11.1 Card Glow

Cards that need attention get a pulsing glow ring using design tokens:

- Critical: `var(--glow-brand)` — 2s pulse cycle. Icon: `AlertTriangle` (Lucide)
- Warning: `var(--color-warning)` at 20% opacity — 3s pulse cycle. Icon: `AlertCircle`
- Normal: no glow. Icon: `Info`

Color is NEVER the sole severity indicator — always paired with icon + label per WCAG 2.1 SC 1.4.1.

All severity styling uses `getSeverityToneStyles()` from `cockpit/severity-styles.ts`.

### 11.2 Card Transitions

- Mode switch: cards crossfade (exit: opacity 0, 250ms → enter: opacity 1 + y: 8→0, 500ms stagger 50ms). Ambient spring.
- Card expand: AnimatePresence with layout animation. Ambient spring (stiffness 40, damping 22, mass 2.2).
- Task swiper: horizontal drag with interactive spring snapback (stiffness 100, damping 16). Dismiss: x: ±300, opacity: 0, 250ms min.
- New activity entry: slide up (y: 12→0, opacity 0→1, 150ms).
- KPI pill expand: snappy spring (stiffness 250, damping 22).

### 11.3 `prefers-reduced-motion` (council-required)

When `prefers-reduced-motion: reduce` is active:

- All spring animations resolve instantly (duration: 0)
- Glow pulses become static solid colors
- Task swiper uses CSS scroll-snap instead of drag physics
- Activity feed items appear without slide animation
- Mode transitions are instant crossfade (no stagger)

### 11.4 Idle State

When nothing needs attention (all zeros, no pending tasks):

- Cards are dim (opacity 0.7)
- A subtle badge appears in the center (i18n key: `interactive.all_clear`)
- Metric pills are all `var(--color-success)` at muted opacity

---

## 12. Responsive Behavior

### Desktop (≥1280px)

12-column bento grid as described above.

### Tablet (768-1279px)

6-column grid. Task swiper full width. On-duty + broadcast stack below. Activity feed becomes a collapsible panel. KPIs in a horizontal scroll row.

### Mobile (< 768px)

Single column. Order: Metric strip → Task swiper → Quick broadcast → On-duty strip → Activity feed (collapsed, tap to expand) → KPIs (horizontal scroll).

---

## 13. Data Architecture

### 13.1 Reused Hooks (no changes)

- `useCockpitFirstScreen()` — main aggregator
- `useLiveShifts()` — on-duty data + realtime
- `useActivityFeed()` — activity trail + realtime
- `useActionItems()` — count queries
- `useStaffingCoverage()` — 7-day fill rates
- `useTrainingReadiness()` — training KPIs
- `useAbsenceRate()`, `useStaffTurnover()` — HR KPIs
- `useTaskCompletion()` — task KPI
- `useKpiTargets()` — target editing

### 13.2 New Hooks

- `usePendingApprovals()` — pending session signoffs for task swiper
- `useBroadcastRecipients(group: 'on_duty' | 'incoming' | 'yesterday')` — recipient counts + profile IDs
- `useDashboardMode()` — auto-detection + manual override state

### 13.3 New Mutations

- `useCreateQuickTask()` — inline task creation (see section 13.5 for table resolution)
- `useAssignTask()` — assign task to profile (updates `session_task.assigned_to`)
- `useSendBroadcast()` — send message to recipient group (see section 13.6)

Note: `useDismissSwipeCard` is local component state (`useState<Set<string>>`), not a mutation.

### 13.4 Telemetry Events (council-required)

Every mutation emits via `emit()` in `onSuccess`. Register in `packages/telemetry/src/registry.ts`.

| Mutation             | Event Name                     | Entity Type       | Destinations                          | Notes                                                          |
| -------------------- | ------------------------------ | ----------------- | ------------------------------------- | -------------------------------------------------------------- |
| `useCreateQuickTask` | `session_task.created`         | `session_task`    | activity_trail, engine_event, posthog | `source: 'dashboard_inline'` in metadata                       |
| `useAssignTask`      | `session_task.assigned`        | `session_task`    | activity_trail, engine_event, posthog | `source: 'dashboard_inline'` in metadata                       |
| `useSendBroadcast`   | `communication.broadcast_sent` | `channel_message` | activity_trail, posthog               | `source: 'dashboard_broadcast'`, `recipient_count` in metadata |

### 13.5 Task Creation — `department_session_id` Resolution (council-required)

`session_task.department_session_id` is NOT NULL. Resolution strategy:

**Operative mode:** Auto-resolve the active `department_session` for the workspace. If multiple departments have active sessions, show a department selector pill row above the form. If exactly one active session, auto-select it.

**Preparatory mode:** Query for the next upcoming session (`status = 'upcoming'`, earliest `session_date`). If found, use it. If no upcoming session exists, the "Ny oppgave" card is disabled with muted text: "Ingen kommende økt — opprett en økt først."

This avoids schema changes. The inline creator always targets a real session.

### 13.6 Broadcast Channel Mechanism (council-required)

Uses existing `channel_type = 'news'` channels. Resolution:

1. Query `channel` where `workspace_id` matches AND `channel_type = 'news'`.
2. If a workspace-level news channel exists, use it. If only department-level news channels exist, use the one matching the active department filter.
3. If no news channel exists, auto-create one: `INSERT INTO channel (workspace_id, channel_type, name, created_by) VALUES (ws_id, 'news', 'Driftsmeldinger', profile_id)`.

Message insert uses existing `channel_message` fields:

- `delivery_mode = 'notification_only'` — appears as push/notification, not in chat timeline
- `target_profile_ids` — filled with resolved recipient IDs from the selected group
- `metadata = { source: 'dashboard_broadcast' }` — for agent provenance

---

## 14. Mutation Boundary — ADR-0068 Compliance (council-required)

All mutations happen on **dashboard cards and popovers inline**. Entity drawers opened from the dashboard remain **read-only inspection surfaces** per ADR-0068.

- Task Swiper "Fullfør" / "Godkjenn" → inline mutation on the card itself
- Task Swiper "Tildel" → popover with profile selector, overlaid on the dashboard (not inside a drawer)
- Task Swiper "Se detaljer" → opens entity drawer for inspection only, no mutation buttons
- On-Duty Strip avatar click → opens entity drawer (read-only)
- Activity Feed entry click → opens entity drawer (read-only)

---

## 15. Files (renumbered after council additions)

### New Components

| File                       | Purpose                                                    |
| -------------------------- | ---------------------------------------------------------- |
| `InteractiveDashboard.tsx` | Main orchestrator, replaces HospitalityOperationsCockpit   |
| `DashboardModeToggle.tsx`  | Drift/Forberedelse/Auto segmented control                  |
| `DashboardMetricStrip.tsx` | Compact pill bar (replaces CockpitTopStrip)                |
| `TaskSwiper.tsx`           | Swipeable action card stack                                |
| `TaskSwiperCard.tsx`       | Individual swiper card with inline actions                 |
| `OnDutyStrip.tsx`          | Compact avatar row (replaces CockpitOnDutyProgress)        |
| `QuickBroadcast.tsx`       | Inline message composer with recipient groups              |
| `PrepActionCards.tsx`      | Preparatory mode action stack                              |
| `InlineTaskCreator.tsx`    | Quick task creation form                                   |
| `KpiPillGrid.tsx`          | 2×2 compact KPI cards (replaces StrategicView KPI section) |
| `StaffingCoverageBar.tsx`  | 7-day fill rate chart                                      |

### Modified

| File                                  | Change                                                       |
| ------------------------------------- | ------------------------------------------------------------ |
| `apps/web/src/app/dashboard/page.tsx` | Render `InteractiveDashboard` instead of cockpit + strategic |
| `DashboardShell.tsx`                  | Remove strategic/tactical tab toggle if present              |

### Preserved (moved to expandable panels)

| Component               | New role                                                   |
| ----------------------- | ---------------------------------------------------------- |
| `CockpitOnDutyProgress` | Expand panel content for OnDutyStrip                       |
| `CockpitActivityFeed`   | Refactored into ActivityFeed with new styling              |
| `CockpitRiskQueues`     | Data feeds into TaskSwiper cards                           |
| `CockpitActionRail`     | Replaced by TaskSwiper + PrepActionCards                   |
| `StrategicView`         | KPIs extracted to KpiPillGrid, pipeline to PrepActionCards |

---

## 15. i18n

All strings via `useTranslation("dashboard")`. New keys added to `packages/i18n/locales/{nb,en}/dashboard.json` under `interactive` namespace prefix.

---

## 16. Not In Scope

- Drag-and-drop card reordering
- User-configurable grid layout
- Dashboard widgets marketplace
- Sound effects for card arrivals (phase 2)
- Mobile app dashboard (separate PR, data hooks shared)
- AI agent mode-awareness (Agent Coord confirmed: not needed now, clean future extension)

---

## 18. Feature Flag (council-recommended)

`NEXT_PUBLIC_INTERACTIVE_DASHBOARD` — when false, falls back to existing `HospitalityOperationsCockpit` + `StrategicView`. Old components preserved (section 15 "Preserved" table). Enables safe rollback.

---

## 19. Empty, Error, and Loading States (council-required)

Each bento cell specifies three states:

| Cell              | Empty                                                        | Error                            | Loading                       |
| ----------------- | ------------------------------------------------------------ | -------------------------------- | ----------------------------- |
| Task Swiper       | Checkmark + i18n `interactive.no_pending_tasks`. Green tint. | Retry button + toast             | 3 skeleton cards with shimmer |
| On-Duty Strip     | Muted text: i18n `interactive.no_one_on_duty`                | — (fails silently, strip hidden) | 8 skeleton circles            |
| Activity Feed     | Dashed border + i18n `interactive.no_activity_yet`           | Reconnect button (realtime)      | Shimmer lines                 |
| Quick Broadcast   | Always visible (recipient count may be 0)                    | Toast on send failure            | —                             |
| KPI Pills         | Muted "—" value                                              | — (individual pill shows "—")    | Skeleton pills                |
| Prep Action Cards | i18n `interactive.all_clear_prep`                            | Retry per card                   | Skeleton stack                |
| Staffing Coverage | Flat gray bars + i18n `interactive.no_shift_data`            | Retry                            | Skeleton bars                 |

---

## 20. Performance Gates (council-recommended)

| Gate                 | Target  | Test                                     |
| -------------------- | ------- | ---------------------------------------- |
| Cold load (no cache) | < 3s    | E2E: navigate to /dashboard, measure LCP |
| Mode switch          | < 500ms | E2E: toggle mode, measure content paint  |
| Task swiper action   | < 200ms | E2E: click primary action, measure toast |

Add to `apps/e2e/tests/performance-gates.spec.ts`.

---

## 21. Council Review Log

Reviewed 2026-03-29 by System Council (4 agents).
Verdict: **APPROVE WITH CHANGES** (all changes incorporated above).
Agents: System Steward, Supervisor, Agent Coordinator, Frontend Designer.
Key decisions: session_task resolution via active/upcoming session, broadcast via `news` channel type, mutations inline only (ADR-0068), telemetry for all mutations.
