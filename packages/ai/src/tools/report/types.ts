// ============================================
// types.ts
// Type definitions for the AI report builder system.
// Describes report configuration: data sources, metrics,
// grouping, filters, and visualization preferences.
// Connected to: packages/ai/src/agents/reports.ts (agent that uses these)
// ============================================

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Relaxed Supabase client type to avoid generic mismatch
 * between @supabase/ssr (3 generics) and @supabase/supabase-js (4 generics).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

/**
 * Available data sources for reports.
 * Each maps to a Supabase table the user has RLS access to.
 */
export type ReportDataSource =
  | "profiles"
  | "departments"
  | "teams"
  | "locations"
  | "protocols"
  | "protocol_assignments";

/**
 * A single metric to compute in a report.
 * The field name references a column on the data source table.
 */
export type ReportMetric = {
  field: string;
  aggregation: "count" | "count_distinct" | "percentage" | "avg" | "sum" | "min" | "max";
  label: string;
};

/**
 * How to group report rows — e.g., by department, role, or status.
 */
export type ReportGroupBy = {
  field: string;
  label: string;
};

/**
 * A filter condition to narrow report data.
 */
export type ReportFilter = {
  field: string;
  operator: "eq" | "neq" | "in" | "is_null" | "is_not_null";
  value: unknown;
};

/** Supported visualization types for rendering reports. */
export type ReportVisualization = "table" | "bar_chart" | "pie_chart" | "kpi_cards";

/**
 * Full report configuration — everything needed to execute
 * and render a report. Stored as JSONB in custom_report.config.
 */
export type ReportConfig = {
  data_source: ReportDataSource;
  metrics: ReportMetric[];
  group_by?: ReportGroupBy;
  filters?: ReportFilter[];
  visualization: ReportVisualization;
  sort_by?: { field: string; direction: "asc" | "desc" };
};

/**
 * Context passed to all report tools at execution time.
 * Carries the authenticated Supabase client (respects RLS)
 * plus workspace and profile identifiers.
 */
export type ReportToolContext = {
  workspaceId: string;
  profileId: string;
  supabase: AnySupabaseClient;
};
