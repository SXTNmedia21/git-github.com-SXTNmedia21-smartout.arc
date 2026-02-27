# SMARTOUT_MODULE_10_REPORTS_AND_KPIS

> **Purpose:** Architectural plan for the database upgrades and data extraction strategy required to power the Strategic KPI Dashboard (Module 10).
> **Updated:** February 2026

## 1. Database Schema Upgrades

To support the dynamic, configurable KPIs and historically accurate trend visualization, we need to introduce dedicated reporting tables to the Supabase schema.

### 1.1 `kpi_config` Table

This table stores the editable factors for each KPI (e.g., Target %, Grace Periods, Included factors), configurable per `workspace_id` and optionally overridden per `location_id`.

```sql
CREATE TABLE public.kpi_config (
  config_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspace(workspace_id),
  location_id uuid REFERENCES public.location(location_id), -- null means workspace-wide default
  kpi_type text NOT NULL, -- 'payroll', 'turn', 'abs', 'onboarding', 'task', 'compliance'
  factors jsonb NOT NULL, -- e.g. {"target_pct": 30, "include_manager": true}
  updated_by uuid REFERENCES public.profile(profile_id),
  updated_at timestamptz DEFAULT now() NOT NULL
);
```

### 1.2 `strategic_metrics_snapshot` Table

Computing the 6-month historical turnover or absence rate across hundreds of employees on every page load is too expensive. We need a fact table that takes daily/monthly snapshots of the computed KPIs.

```sql
CREATE TABLE public.strategic_metrics_snapshot (
  snapshot_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspace(workspace_id),
  location_id uuid REFERENCES public.location(location_id),
  snapshot_date date NOT NULL,
  period_type text NOT NULL, -- 'daily', 'weekly', 'monthly'
  metrics jsonb NOT NULL, -- {"payroll": 29.0, "turn": 14.0, "abs": 3.9, ...}
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX idx_strategic_metrics_snapshot_date ON public.strategic_metrics_snapshot(workspace_id, location_id, snapshot_date);
```

### 1.3 External Integrations (Optional)

If we are pulling revenue data for the _Cost of Sales %_ KPI, we need a table to store integration mappings (e.g., external POS API keys) or raw ingested metrics like `daily_gross_sales`.

---

## 2. Data Extraction Strategy (Hvordan vi tar ut dataen)

### 2.1 The Problem

Strategic KPIs span across HR, Scheduling, Task Management, and external POS data. Using `useQuery` to fetch all raw rows and compute them on the client violates ADR-0002 (State-Driven Methodology vs Hooks) and will kill performance.

### 2.2 The Extraction Pipeline (The Engine)

We will extract and transform this data using a multi-layered approach:

1. **Daily Cron Job (Edge Function):**
   - A scheduled Supabase Edge Function (`cron-kpi-snapshot`) runs every night.
   - It calculates the rolling KPIs for that day/week.
   - It writes the computed averages and percentages into the `strategic_metrics_snapshot` table.

2. **Live Current Values (Supabase RPC):**
   - For the "Current Assessed Value" displayed on the KPI cards, we will create a PostgreSQL Stored Procedure (RPC) `get_current_kpi(p_workspace_id, p_location_id)`.
   - This function reads the latest configuration from `kpi_config` and applies it to live operational views (e.g., checking today's approved timesheets).

3. **Frontend Implementation:**
   - The React frontend simply fetches from `strategic_metrics_snapshot` to render the 6-month Bar Charts. This query is lightning-fast because it's just returning pre-computed JSON.
   - When a user changes a Calculation Factor via the KPI Detail Modal, it updates `kpi_config` via mutation, and triggers a background recalculation of the _live_ current value via the RPC.

## 3. Implementation Steps

1. Create Migration SQL file for `kpi_config` and `strategic_metrics_snapshot`.
2. Write Supabase RPC `calculate_kpi_live` to do the mathematical heavy lifting in Postgres.
3. Deploy Edge Function `compute-kpi-snapshots` via pg_cron.
4. Update `AdminDashboard.tsx` to hook into `supabase.rpc()` and `supabase.from('strategic_metrics_snapshot')` instead of the mocked `METRICS_DATA`.
