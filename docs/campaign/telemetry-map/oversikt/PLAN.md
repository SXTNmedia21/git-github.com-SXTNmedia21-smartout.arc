---
title: Implementation Plan — Oversikt Telemetry
status: draft
created: 2026-05-31
updated: 2026-05-31
domain: oversikt
module: dashboard/oversikt
tags: [telemetry, plan, oversikt]
---

# Implementation Plan — Oversikt Telemetry

## Gate Status: FAIL

Gate fails because 11 required events are missing from the registry and 3 backend hooks are not wired for the oversikt surface. See `control.json` for machine-readable gate state.

---

## Phase 1 — Registry additions (no code changes required yet)

Add the following events to `packages/telemetry/src/registry.ts`. All are new — zero existing conflicts.

### New events to register

| Event name                          | Category            | Destinations                                          | Rationale                                                    |
| ----------------------------------- | ------------------- | ----------------------------------------------------- | ------------------------------------------------------------ |
| `oversikt.viewed`                   | `navigation`        | `posthog`, `logger`                                   | Page-level view (more specific than generic `page viewed`)   |
| `oversikt.brief_why_toggled`        | `navigation`        | `posthog`, `logger`                                   | Botsson transparency funnel signal                           |
| `oversikt.brief_action_taken`       | `operations`        | `posthog`, `logger`, `activity_trail`                 | Manager acts on Botsson brief CTA — key engagement KPI       |
| `oversikt.pulse_tile_clicked`       | `navigation`        | `posthog`, `logger`                                   | Navigation funnel from cockpit KPI tiles                     |
| `oversikt.action_queue_row_clicked` | `navigation`        | `posthog`, `logger`                                   | Row-level drill-down intent from action queue                |
| `oversikt.action_cta_clicked`       | `operations`        | `posthog`, `logger`, `activity_trail`                 | Manager resolves action item inline                          |
| `oversikt.nav_link_clicked`         | `navigation`        | `posthog`, `logger`                                   | "All X" header link clicks (feed, action queue)              |
| `oversikt.dagsrapport_requested`    | `operations`        | `posthog`, `logger`, `activity_trail`                 | Day report generation request                                |
| `oversikt.gap_fill_requested`       | `shift_marketplace` | `posthog`, `logger`, `activity_trail`, `engine_event` | Manager requests substitute from roster gap banner           |
| `oversikt.receipt_nudge_sent`       | `communication`     | `posthog`, `logger`, `activity_trail`                 | Manager pushes read-nudge to unread staff                    |
| `oversikt.budget_empty_state_shown` | `operations`        | `posthog`, `logger`                                   | workspace_budget is 0-seeded — track hollow KPI tile renders |

**Note:** `oversikt.risk_item_clicked` is deferred until `RiskTomorrow` risk items receive `onClick` handlers in the design.

### Registry addition — where to insert

Append a new section after the `// ─── Oppgaver Read-surface (P11 oppgaver-page)` block at the end of the registry (after line 16158). Add a new `EventCategory` union member `"oversikt"` at line 65 (after `"oppgaver"`).

### EventCategory addition

```typescript
| "oversikt" // Oversikt today-dashboard cockpit interaction events
```

---

## Phase 2 — Emit wiring (requires UI work)

Wire emit calls at each interaction site. Below is the priority order.

### P0 — Mutations (highest priority; these are write-path events)

1. **`oversikt.brief_action_taken`** — emit on each of the 3 Brief CTA buttons
   - Call-site: `Brief` component, inside each `acts.map` onClick
   - Also call downstream hooks: `useSendBroadcast` for b2, b3; `deviation viewed` for b1
   - File to create/modify: production `Brief` component (not the design prototype)

2. **`oversikt.action_cta_clicked`** — emit on ActionQueue CTA button click
   - Call-site: `ActionQueue`, `<button className="aq-btn">` onClick (after `e.stopPropagation()`)
   - Downstream: wire `deviation updated` for Avvik CTAs, `approval resolved` for Godkjenning, new `session_task completed` for Levering

3. **`oversikt.gap_fill_requested`** — emit on "Finn vikar" button click
   - Call-site: `Roster`, `roster-gapfill` button onClick
   - Downstream: `open_shift created` + `shift_offer.posted` — hook wiring needs `useCreateOpenShift` mutation

4. **`oversikt.dagsrapport_requested`** — emit on header "Dagsrapport" button
   - Call-site: `OversiktPage` header button onClick
   - Backend: MISSING hook — needs `useGenerateDayReport` or equivalent Edge Function call

5. **`oversikt.receipt_nudge_sent`** — emit on Receipts "Påminn" button
   - Call-site: `Receipts`, nudge button onClick
   - Backend: Use `useSendBroadcast` with `kind: "read_nudge"` or dedicated reminder mutation

### P1 — Navigation (medium priority; analytics funnel)

6. `oversikt.pulse_tile_clicked` — all 5 Pulse tiles
7. `oversikt.action_queue_row_clicked` — ActionQueue row onClick
8. `oversikt.nav_link_clicked` — "Alle oppgaver" and "Alle" feed links
9. `oversikt.brief_why_toggled` — Brief "Hvorfor?" toggle

### P2 — View events (lower priority; passive)

10. `oversikt.viewed` — OversiktPage mount (useEffect or server component instrumentation)
11. `oversikt.budget_empty_state_shown` — emit from `useDayBudget` when result is all-null (F0.4 scope)

---

## Phase 3 — Backend hook gaps

### Gap 1: Gap-fill / open-shift hook (Roster "Finn vikar")

- **Required:** `useCreateOpenShift` mutation hook
- **Tables:** `schedule_shift` (gap identification), `open_shift` (create row)
- **Emits:** `open_shift created` + `shift_offer.posted` + `oversikt.gap_fill_requested`
- **Effort:** Medium — `open_shift` table schema exists; hook needs to be written
- **ADR reference:** ADR-0306 (shift_marketplace)

### Gap 2: Day-report generation hook (Header "Dagsrapport")

- **Required:** `useGenerateDayReport` hook or Edge Function invocation
- **Tables:** Aggregates from `schedule_shift`, `deviation`, `session_task`, `workspace_budget`
- **Emits:** `oversikt.dagsrapport_requested`
- **Effort:** High — no existing Edge Function for day report; full new capability
- **Recommendation:** Defer to dedicated sortie. Add empty-state or "coming soon" state for the button in interim.

### Gap 3: Levering/delivery checklist wiring (ActionQueue CTA "Klargjør")

- **Required:** A delivery checklist `session_task` creation or `session_hook` trigger
- **Tables:** `session_task` (insert row as checklist), `session_hook` (lookup)
- **Emits:** `session_task.created` + `oversikt.action_cta_clicked`
- **Effort:** Medium — session_task insert is already covered by `useCreateQuickTask`; needs context plumbing

---

## Phase 4 — Budget tile empty-state (F0.4 trap)

`workspace_budget` is 0-seeded. Any budget KPIs rendered on the oversikt pulse bar (current or future) will silently return `null`.

**Required actions:**

1. Add seed data to `supabase/seed.sql` or a new migration for `workspace_budget` (at minimum one `period_type='daily'` row per test workspace)
2. Add `oversikt.budget_empty_state_shown` emit to `useDayBudget` null-return path
3. Coordinate with F0.4 scope owner before adding budget tiles to oversikt

**Risk if unaddressed:** Budget-linked KPI tiles ship showing `—` in production with no observability. Silent data gap.

---

## Noop Candidates (confirmed, no telemetry needed)

| Element                                  | Reason                                                |
| ---------------------------------------- | ----------------------------------------------------- |
| RiskTomorrow risk items ("Løs", "Se")    | Static text in design — no onClick; noop until wired  |
| `window.CreateButton`                    | Shell-level component; telemetry owned externally     |
| Page-level `page viewed`                 | Covered by existing generic event                     |
| Roster bar visuals (shift timeline bars) | Display-only, no interaction                          |
| Feed items                               | Read-only list; no clickable rows in current design   |
| Receipts list rows                       | Display-only (read/unread status shown, no row click) |

---

## Deferred Events (design gap)

| Event                              | Trigger                       | Condition                                          |
| ---------------------------------- | ----------------------------- | -------------------------------------------------- |
| `oversikt.risk_item_clicked`       | RiskTomorrow risk item action | When onClick added to "Løs"/"Se" buttons in design |
| `oversikt.feed_item_clicked`       | Feed item click               | When feed items become interactive                 |
| `oversikt.roster_employee_clicked` | Roster row click              | If employee drawer wired from roster               |
