---
title: Implementation Plan — rapporter telemetry
status: draft
created: 2026-05-31
updated: 2026-05-31
module: rapporter
tags: [plan, telemetry, rapporter]
---

# Implementation Plan: rapporter Telemetry

## Goal

Wire 30 domain-specific telemetry events to all 41+ interactive elements across the rapporter domain. Fix the `custom_report` write gap and flag the in-memory workspace isolation issue in `use-report-overview`.

---

## Blockers (must resolve before shipping telemetry)

### B1 — Scheduled Reports DESCOPED

`rapporter-planlagte` has 16 interactive elements (41-A through 41-P) but `custom_report` has no `schedule`, `cadence`, `recipients`, or `next_run` column. **Decision required:** either extend the schema or keep planlagte as a pure UI demo. Until resolved, all planlagte mutations are local-state only and must carry `backend: "descoped"` flag in telemetry properties so downstream analytics know these events are not persisted.

### B2 — In-memory workspace filter in use-report-overview

`protocol_assignment` lacks `workspace_id`. The hook filters in memory after fetching all rows globally. This is a data isolation gap at the predicate level — not a blocker for shipping the UI, but must be tracked. Recommended fix: add `workspace_id` FK to `protocol_assignment` + migrate existing rows + switch to `.eq("workspace_id", wsId)`. Flag in ADR before production.

---

## Phase 1 — Registry: Add 30 events (1 day)

Register all 30 missing events in `packages/telemetry/src/registry.ts` under a new section:

```
// ─── Rapporter (Reports & Insights) Events ─────────────────────────────────
```

Event interface pattern (example):

```typescript
export interface ReportTabNavigated extends BaseEvent {
  event: "report.tab.navigated";
  properties: {
    data: {
      tab: "oversikt" | "innsikt" | "bygger" | "datakilder" | "planlagte";
      from_tab: string;
    };
  };
}
```

Key shape decisions:

- All events prefix with `report.` for easy filtering in PostHog
- `scope` (venue id / "all") and `period` (period id) should be included as properties on all events where relevant — lets us slice by context
- `perspective` (drift/eier) on events where the role affects what was seen
- Mutations get `{ entity_type: "custom_report", entity_id: string | null }` when they have or will have a DB counterpart
- Descoped planlagte events get `{ descoped: true }` in properties

---

## Phase 2 — Hook: Add custom_report write hook (0.5 days)

Create `apps/web/src/app/dashboard/reports/_hooks/use-report-save.ts`:

```typescript
// Wraps custom_report INSERT/UPDATE.
// Called from RapBygger "Lagre som mal".
// Invalidates ["reports", "saved", wsId] on success.
```

Tables: `custom_report` (INSERT for new, UPDATE for existing by report_id)
Columns to write: `workspace_id`, `name`, `config` (JSONB), `is_pinned`, `created_by`

---

## Phase 3 — Wire events to components (2 days)

Priority order (highest signal first):

### P0 — Mutations with backend write

| Element            | Event                      | Component   |
| ------------------ | -------------------------- | ----------- |
| "Lagre som mal"    | `report.builder.saved`     | RapBygger   |
| Insight "Godkjenn" | `report.insight.approved`  | InsightCard |
| Insight "Tildel"   | `report.insight.assigned`  | InsightCard |
| Insight "Avvis"    | `report.insight.dismissed` | InsightCard |

> Note: Insight approve/dismiss/assign are currently local-state only. If there is no persistence table for insight actions yet, still fire the event with `{ persisted: false }` so we capture UX signal before the write is built.

### P1 — High-signal navigation

| Element            | Event                         |
| ------------------ | ----------------------------- |
| Tab navigation     | `report.tab.navigated`        |
| Scope change       | `report.scope.changed`        |
| Period change      | `report.period.selected`      |
| Perspective toggle | `report.perspective.changed`  |
| KPI card click     | `report.kpi.drilldown_opened` |

### P2 — Builder interactions (product analytics)

| Element           | Event                              |
| ----------------- | ---------------------------------- |
| Preset applied    | `report.builder.preset_applied`    |
| Metric toggled    | `report.builder.metric_toggled`    |
| GroupBy changed   | `report.builder.groupby_changed`   |
| Dimension changed | `report.builder.dimension_changed` |
| Export            | `report.exported`                  |

### P3 — Insight engagement

| Element                        | Event                           |
| ------------------------------ | ------------------------------- |
| Insight expanded               | `report.insight.expanded`       |
| Filter changed                 | `report.insight.filter_changed` |
| Insight opened (from oversikt) | `report.insight.opened`         |

### P4 — Datasource interactions

| Element        | Event                              |
| -------------- | ---------------------------------- |
| Drawer opened  | `report.datasource.drawer_opened`  |
| Sync clicked   | `report.datasource.sync_clicked`   |
| Field mapped   | `report.datasource.field_mapped`   |
| Disconnected   | `report.datasource.disconnected`   |
| Mapping edited | `report.datasource.mapping_edited` |

### P5 — Planlagte (descoped — fire but mark)

Wire all 16 planlagte elements with `{ descoped: true }` property.  
Do NOT attempt to write to `custom_report` for "Planlegg utsending" — only fire the event.

---

## Phase 4 — B2 Fix: protocol_assignment workspace isolation (separate sortie)

This is a schema migration, not just a hook change. Scope:

1. Add `workspace_id UUID REFERENCES workspace(workspace_id)` to `protocol_assignment`
2. Backfill: join through `profile.profile_id` → `profile.workspace_id`
3. Add index: `CREATE INDEX ON protocol_assignment(workspace_id)`
4. Update `use-report-overview` to use `.eq("workspace_id", wsId)` instead of in-memory filter
5. Update RLS on `protocol_assignment` to be workspace-scoped

---

## Phase 5 — Verification

- PostHog dashboard: confirm `report.*` events are flowing per tab
- Check `report.builder.saved` fires and `custom_report` row is created
- Confirm `report.scheduled.*` events carry `descoped: true` and no DB write occurs
- Confirm `report.kpi.drilldown_opened` fires with correct `kpi_id`

---

## Effort estimate

| Phase                    | Effort                 |
| ------------------------ | ---------------------- |
| P1: Registry (30 events) | 4h                     |
| P2: Write hook           | 2h                     |
| P3: Wire all elements    | 6h                     |
| P4: B2 schema fix        | separate sortie (4–6h) |
| P5: Verify               | 2h                     |
| **Total (excl. B2)**     | **~14h**               |
