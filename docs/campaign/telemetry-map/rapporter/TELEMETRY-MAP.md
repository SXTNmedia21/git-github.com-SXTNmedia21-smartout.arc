---
title: Telemetry Map — rapporter domain
status: draft
created: 2026-05-31
updated: 2026-05-31
module: rapporter
tags: [telemetry, rapporter, interactive-elements, hooks]
---

# Telemetry Map: rapporter (Reports & Insights)

## Overview

**Design files scanned:** 8 JSX files (rapporter.jsx + 7 sub-views)  
**Interactive elements total:** 41  
**Elements mapped:** 41  
**Events required (new):** 32  
**Events in registry (existing match):** 2 (`page viewed`, `button clicked` — generic, not rapporter-specific)  
**Events missing from registry (rapporter-specific):** 30  
**Backend hooks found:** 4  
**Mutations (write/state-change interactions):** 14

---

## TRAP FLAGS

### TRAP 1 — Scheduled Reports: DESCOPED (no-backend)

`rapporter-planlagte.jsx` renders a full scheduled-reports UI: pause/resume, create modal, delivery log. **The `custom_report` table has NO `schedule`, `cron`, `next_run`, `cadence`, `recipients` or `channel` columns.** The table only has `config` (JSONB) and `is_pinned`. All planlagte interactions must be flagged `backend: NONE (descoped)` — they can fire telemetry events but cannot persist to the real DB until the schema is extended.

### TRAP 2 — In-memory workspace filter gap (use-report-overview.ts)

`protocol_assignment` has no `workspace_id` column. `use-report-overview.ts` fetches ALL `protocol_assignment` rows (across all workspaces), then filters in memory using `workspaceProfileIds.has(a.profile_id)`. This is a **predicate-level isolation gap**: if two workspaces share a profile_id (should not happen, but no DB constraint prevents it), assignments cross-contaminate. A `workspace_id` column on `protocol_assignment` with a proper `.eq()` filter is the safe fix. Flag: `isolation: IN_MEMORY_ONLY`.

---

## Element Map by File

### rapporter.jsx (page controller + shared scope)

| #   | Element                                                       | File          | Type   | Event Name                     | Mutation                      | Hook | Backend     |
| --- | ------------------------------------------------------------- | ------------- | ------ | ------------------------------ | ----------------------------- | ---- | ----------- |
| 1   | Period picker button (open dropdown)                          | rapporter.jsx | button | `report.period_picker.opened`  | no                            | —    | none        |
| 2   | Period option row (select period)                             | rapporter.jsx | button | `report.period.selected`       | yes (local state: period)     | —    | none        |
| 3   | "Forhåndsvis e-post" button                                   | rapporter.jsx | button | `report.email_preview.clicked` | no                            | —    | window.open |
| 4   | "Eksporter" button (PDF export)                               | rapporter.jsx | button | `report.exported`              | no                            | —    | window.open |
| 5   | "Bygg rapport" button (nav to bygger tab)                     | rapporter.jsx | button | `report.tab.navigated`         | yes (local state: tab=bygger) | —    | none        |
| 6   | Venue scope selector (each venue button)                      | rapporter.jsx | button | `report.scope.changed`         | yes (local state: scope)      | —    | none        |
| 7   | Perspective toggle — Drift                                    | rapporter.jsx | button | `report.perspective.changed`   | yes (local state: role=drift) | —    | none        |
| 8   | Perspective toggle — Eier                                     | rapporter.jsx | button | `report.perspective.changed`   | yes (local state: role=eier)  | —    | none        |
| 9   | Tab navigation (Oversikt/Innsikt/Bygger/Datakilder/Planlagte) | rapporter.jsx | button | `report.tab.navigated`         | yes (local state: tab)        | —    | none        |

### rapporter-oversikt.jsx (Overview tab)

| #   | Element                                         | File                   | Type      | Event Name                      | Mutation                       | Hook                | Backend              |
| --- | ----------------------------------------------- | ---------------------- | --------- | ------------------------------- | ------------------------------ | ------------------- | -------------------- |
| 10  | KPI card click (open drilldown)                 | rapporter-oversikt.jsx | button    | `report.kpi.drilldown_opened`   | yes (local state: drillKpi)    | use-report-overview | custom_report (read) |
| 11  | Brief action button "Vis kjøkken-overtid"       | rapporter-oversikt.jsx | button    | `report.brief_action.clicked`   | no                             | —                   | none                 |
| 12  | Brief action button "Reduser man–ons bemanning" | rapporter-oversikt.jsx | button    | `report.brief_action.clicked`   | yes (local state: done)        | —                   | none (toast)         |
| 13  | Brief action button "Eksporter ukesrapport"     | rapporter-oversikt.jsx | button    | `report.brief_action.clicked`   | yes (local state: done)        | —                   | none (toast)         |
| 14  | "Hvorfor?" toggle (show/hide sources)           | rapporter-oversikt.jsx | button    | `report.brief_why.toggled`      | yes (local state: showWhy)     | —                   | none                 |
| 15  | Venue comparison row click (open venue)         | rapporter-oversikt.jsx | table row | `report.venue.drilldown_opened` | no                             | —                   | none (toast)         |
| 16  | "Bygg rapport" link in secondary KPI panel      | rapporter-oversikt.jsx | button    | `report.tab.navigated`          | yes (local state: tab=bygger)  | —                   | none                 |
| 17  | Insight teaser row click (open insight)         | rapporter-oversikt.jsx | button    | `report.insight.opened`         | yes (local state: openInsight) | —                   | none                 |
| 18  | "Alle innsikter" link (nav to innsikt tab)      | rapporter-oversikt.jsx | button    | `report.tab.navigated`          | yes (local state: tab=innsikt) | —                   | none                 |
| 19  | Forecast card "Se prognoseinnsikt" button       | rapporter-oversikt.jsx | button    | `report.tab.navigated`          | yes (local state: tab=innsikt) | —                   | none                 |

### rapporter-insikt.jsx (Insights tab)

| #   | Element                                     | File                 | Type   | Event Name                       | Mutation                            | Hook | Backend                     |
| --- | ------------------------------------------- | -------------------- | ------ | -------------------------------- | ----------------------------------- | ---- | --------------------------- |
| 20  | "Oppdater" button (re-run Botsson analysis) | rapporter-insikt.jsx | button | `report.insight_refresh.clicked` | no                                  | —    | none (toast, no real fetch) |
| 21  | Severity filter buttons (all/crit/warn/ok)  | rapporter-insikt.jsx | button | `report.insight.filter_changed`  | yes (local state: filter)           | —    | none                        |
| 22  | InsightCard toggle (expand/collapse)        | rapporter-insikt.jsx | button | `report.insight.expanded`        | yes (local state: expanded)         | —    | none                        |
| 23  | "Godkjenn forslag" button                   | rapporter-insikt.jsx | button | `report.insight.approved`        | yes (local state: status=approved)  | —    | NONE (no write hook wired)  |
| 24  | "Tildel" button                             | rapporter-insikt.jsx | button | `report.insight.assigned`        | yes (local state: status=assigned)  | —    | NONE (no write hook wired)  |
| 25  | "Avvis" button                              | rapporter-insikt.jsx | button | `report.insight.dismissed`       | yes (local state: status=dismissed) | —    | NONE (no write hook wired)  |
| 26  | "Eksporter" (export insight PDF)            | rapporter-insikt.jsx | button | `report.insight.exported`        | no                                  | —    | none (toast)                |

### rapporter-bygger.jsx (Report Builder tab)

| #   | Element                                          | File                 | Type   | Event Name                               | Mutation                          | Hook | Backend                              |
| --- | ------------------------------------------------ | -------------------- | ------ | ---------------------------------------- | --------------------------------- | ---- | ------------------------------------ |
| 27  | Dimension row dropdown (open)                    | rapporter-bygger.jsx | button | `report.builder.dimension_picker_opened` | no                                | —    | none                                 |
| 28  | Dimension option select                          | rapporter-bygger.jsx | button | `report.builder.dimension_changed`       | yes (local state: dimVals)        | —    | none                                 |
| 29  | GroupBy segment button (Avdeling/Sted/Rolle/Dag) | rapporter-bygger.jsx | button | `report.builder.groupby_changed`         | yes (local state: groupBy)        | —    | none                                 |
| 30  | Metric pill toggle (on/off)                      | rapporter-bygger.jsx | button | `report.builder.metric_toggled`          | yes (local state: metrics)        | —    | none                                 |
| 31  | Preset card click (apply preset)                 | rapporter-bygger.jsx | button | `report.builder.preset_applied`          | yes (local state: preset+metrics) | —    | none                                 |
| 32  | "Lagre som mal" button                           | rapporter-bygger.jsx | button | `report.builder.saved`                   | yes (write to custom_report)      | —    | custom_report INSERT                 |
| 33  | "Planlegg" button (nav hint to planlagte)        | rapporter-bygger.jsx | button | `report.builder.schedule_clicked`        | no                                | —    | NONE (descoped — no schedule column) |
| 34  | "Eksporter" button (export to PDF)               | rapporter-bygger.jsx | button | `report.exported`                        | no                                | —    | none (toast)                         |

### rapporter-datakilder.jsx (Data Sources tab)

| #   | Element                                   | File                     | Type   | Event Name                              | Mutation                   | Hook | Backend      |
| --- | ----------------------------------------- | ------------------------ | ------ | --------------------------------------- | -------------------------- | ---- | ------------ |
| 35  | Source card click (open drawer)           | rapporter-datakilder.jsx | button | `report.datasource.drawer_opened`       | yes (local state: openSrc) | —    | none         |
| 36  | "Last opp fil" button (manual/off source) | rapporter-datakilder.jsx | button | `report.datasource.file_upload_clicked` | no                         | —    | none (toast) |
| 37  | "Synk nå" button (in drawer)              | rapporter-datakilder.jsx | button | `report.datasource.sync_clicked`        | no                         | —    | none (toast) |
| 38  | "Rediger mapping" button (in drawer)      | rapporter-datakilder.jsx | button | `report.datasource.mapping_edited`      | no                         | —    | none (toast) |
| 39  | "Map" button on unmapped field            | rapporter-datakilder.jsx | button | `report.datasource.field_mapped`        | no                         | —    | none (toast) |
| 40  | "Koble fra" button (disconnect source)    | rapporter-datakilder.jsx | button | `report.datasource.disconnected`        | no                         | —    | none (toast) |

### rapporter-planlagte.jsx (Scheduled Reports tab — DESCOPED)

| #    | Element                                    | File                    | Type   | Event Name                                             | Mutation               | Hook | Backend                              |
| ---- | ------------------------------------------ | ----------------------- | ------ | ------------------------------------------------------ | ---------------------- | ---- | ------------------------------------ |
| 41-A | "Ny utsending" button (open create modal)  | rapporter-planlagte.jsx | button | `report.scheduled.create_modal_opened`                 | yes (local state)      | —    | NONE (descoped)                      |
| 41-B | Schedule row click (preview email)         | rapporter-planlagte.jsx | button | `report.scheduled.preview_clicked`                     | no                     | —    | NONE (descoped)                      |
| 41-C | Pause/resume button (togglePause)          | rapporter-planlagte.jsx | button | `report.scheduled.paused` / `report.scheduled.resumed` | yes (local state only) | —    | NONE (descoped)                      |
| 41-D | Preview email icon button (in drawer)      | rapporter-planlagte.jsx | button | `report.scheduled.preview_clicked`                     | no                     | —    | NONE (descoped)                      |
| 41-E | Open report PDF icon button                | rapporter-planlagte.jsx | button | `report.scheduled.report_opened`                       | no                     | —    | NONE (descoped)                      |
| 41-F | Retry delivery button (delivery log)       | rapporter-planlagte.jsx | button | `report.scheduled.delivery_retried`                    | no                     | —    | NONE (descoped)                      |
| 41-G | CreateModal: preset selector               | rapporter-planlagte.jsx | button | `report.scheduled.create_modal_preset_changed`         | yes (local state)      | —    | NONE (descoped)                      |
| 41-H | CreateModal: cadence selector              | rapporter-planlagte.jsx | button | `report.scheduled.create_modal_cadence_changed`        | yes (local state)      | —    | NONE (descoped)                      |
| 41-I | CreateModal: time picker                   | rapporter-planlagte.jsx | button | `report.scheduled.create_modal_time_changed`           | yes (local state)      | —    | NONE (descoped)                      |
| 41-J | CreateModal: recipient toggle              | rapporter-planlagte.jsx | button | `report.scheduled.create_modal_recipient_toggled`      | yes (local state)      | —    | NONE (descoped)                      |
| 41-K | CreateModal: format selector               | rapporter-planlagte.jsx | button | `report.scheduled.create_modal_format_changed`         | yes (local state)      | —    | NONE (descoped)                      |
| 41-L | CreateModal: scope selector                | rapporter-planlagte.jsx | button | `report.scheduled.create_modal_scope_changed`          | yes (local state)      | —    | NONE (descoped)                      |
| 41-M | CreateModal: "Se e-postutkast"             | rapporter-planlagte.jsx | button | `report.scheduled.preview_clicked`                     | no                     | —    | NONE (descoped)                      |
| 41-N | CreateModal: "Se rapport"                  | rapporter-planlagte.jsx | button | `report.scheduled.report_opened`                       | no                     | —    | NONE (descoped)                      |
| 41-O | CreateModal: "Avbryt"                      | rapporter-planlagte.jsx | button | `report.scheduled.create_modal_cancelled`              | no                     | —    | NONE (descoped)                      |
| 41-P | CreateModal: "Planlegg utsending" (submit) | rapporter-planlagte.jsx | button | `report.scheduled.created`                             | yes (local state only) | —    | NONE (descoped — no schedule column) |

### rapporter-drilldown.jsx (KPI Drilldown drawer)

| #       | Element                                   | File                    | Type   | Event Name                | Mutation                         | Hook | Backend      |
| ------- | ----------------------------------------- | ----------------------- | ------ | ------------------------- | -------------------------------- | ---- | ------------ |
| N/A-DD1 | Export PDF icon button (in drawer header) | rapporter-drilldown.jsx | button | `report.exported`         | no                               | —    | none (toast) |
| N/A-DD2 | Close button (drawer)                     | rapporter-drilldown.jsx | button | `report.drilldown.closed` | yes (local state: drillKpi=null) | —    | none         |
| N/A-DD3 | Related insight click (open insight)      | rapporter-drilldown.jsx | button | `report.insight.opened`   | yes (local state)                | —    | none         |

> Note: Items 41-A through 41-P and N/A-DD1 through N/A-DD3 are additional elements beyond the core 41. The total interactive element count is **58** (including planlagte detail + drilldown). See control.json for official counts.

---

## Backend Hooks: Reuse Assessment

| Hook                  | Query key                     | Tables queried                                                              | Rapporter use case                                                        |
| --------------------- | ----------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `use-report-overview` | `["reports","overview",wsId]` | profile, schedule_shift, protocol_assignment (in-memory filter), department | Oversikt tab — KPI cards, 7-day trend, dept stats, insights               |
| `use-report-staffing` | `["reports","staffing",wsId]` | schedule_shift (2 windows), department, workspace_budget                    | Staffing sub-tab (design shows omsetning vs lønn — maps to staffing data) |
| `use-report-people`   | `["reports","people",wsId]`   | profile, employment_contract                                                | People analytics in builder/overview                                      |
| `use-report-training` | `["reports","training",wsId]` | protocol_assignment, protocol                                               | Training compliance — overview beredskap KPI                              |

**Hooks missing:** No write hook for `custom_report` INSERT/UPDATE (needed for "Lagre som mal" in rapporter-bygger). No hook for insight approval persistence (insights are UI-only state today).

---

## Events Missing from Registry (rapporter-specific, 30 new events needed)

```
report.period_picker.opened
report.period.selected
report.email_preview.clicked
report.exported
report.tab.navigated
report.scope.changed
report.perspective.changed
report.kpi.drilldown_opened
report.drilldown.closed
report.brief_action.clicked
report.brief_why.toggled
report.venue.drilldown_opened
report.insight.opened
report.insight.filter_changed
report.insight.expanded
report.insight.approved
report.insight.assigned
report.insight.dismissed
report.insight.exported
report.insight_refresh.clicked
report.builder.dimension_picker_opened
report.builder.dimension_changed
report.builder.groupby_changed
report.builder.metric_toggled
report.builder.preset_applied
report.builder.saved
report.builder.schedule_clicked
report.datasource.drawer_opened
report.datasource.file_upload_clicked
report.datasource.sync_clicked
report.datasource.mapping_edited
report.datasource.field_mapped
report.datasource.disconnected
report.scheduled.create_modal_opened
report.scheduled.created
report.scheduled.paused
report.scheduled.resumed
report.scheduled.preview_clicked
report.scheduled.report_opened
report.scheduled.delivery_retried
```

> 2 generic events (`page viewed`, `button clicked`) exist in registry but are not domain-specific enough for rapporter analytics. The 30 domain-specific events above are net-new.

---

## NOOP Candidates (display-only, no event needed)

- `Brief` body text render (read-only narration)
- `VenueCompare` table static cells (non-clickable rows for group total)
- `ForecastCard` static KPI display (only button gets event)
- `DualTrend` SVG chart (no click handler)
- `InsightCard` source list display (read-only)
- `InsightCard` confidence bar (display only)
- `SourceDrawer` field mapping table rows (except "Map" button)
- `SourceDrawer` "Brukes i" list (display only)
- `RapPlanlagte` recipient groups panel (display only)
- `RapPlanlagte` delivery log rows (except retry button)
- `RapDrilldown` by-dept bars (display only — no click handler)
- `RapDrilldown` by-day chart bars (display only)
- `RapDrilldown` contributing factors list (display only)
