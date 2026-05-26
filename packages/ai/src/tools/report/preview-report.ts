// ============================================
// preview-report.ts
// Executes a report configuration against the database and returns data.
// This is the core tool — it maps ReportConfig → Supabase queries.
// Uses the authenticated client from context (respects RLS).
// Connected to: packages/ai/src/tools/report/types.ts (ReportConfig definition)
// ============================================

import { z } from "zod";
import { defineTool } from "../../types";
import type { ReportToolContext, ReportConfig, ReportDataSource } from "./types";

/**
 * Maps report data source IDs to actual Supabase table names.
 */
const SOURCE_TO_TABLE: Record<ReportDataSource, string> = {
  profiles: "profile",
  departments: "department",
  teams: "team",
  locations: "location",
  protocols: "protocol",
  protocol_assignments: "protocol_assignment",
};

/**
 * Default select columns per data source.
 * These are the columns we fetch for building report data.
 */
const SOURCE_COLUMNS: Record<ReportDataSource, string> = {
  profiles: "profile_id, display_name, role, status, department_id, team_id, created_at",
  departments: "department_id, name, created_at",
  teams: "team_id, name, department_id, leader_profile_id, created_at",
  locations: "location_id, name, address, created_at",
  protocols: "protocol_id, title, type, department_id, is_active, created_at",
  protocol_assignments: "assignment_id, protocol_id, profile_id, status, completed_at, created_at",
};

/**
 * Tables that lack a direct workspace_id column and need a join-through filter.
 */
const NEEDS_JOIN_FILTER = new Set<ReportDataSource>(["protocol_assignments"]);

const ReportConfigSchema = z.object({
  data_source: z.enum([
    "profiles",
    "departments",
    "teams",
    "locations",
    "protocols",
    "protocol_assignments",
  ]),
  metrics: z.array(
    z.object({
      field: z.string(),
      aggregation: z.enum(["count", "count_distinct", "percentage", "avg", "sum", "min", "max"]),
      label: z.string(),
    }),
  ),
  group_by: z
    .object({
      field: z.string(),
      label: z.string(),
    })
    .optional(),
  filters: z
    .array(
      z.object({
        field: z.string(),
        operator: z.enum(["eq", "neq", "in", "is_null", "is_not_null"]),
        value: z.unknown(),
      }),
    )
    .optional(),
  visualization: z.enum(["table", "bar_chart", "pie_chart", "kpi_cards"]),
  sort_by: z
    .object({
      field: z.string(),
      direction: z.enum(["asc", "desc"]),
    })
    .optional(),
});

/**
 * Applies filter conditions to a Supabase query builder.
 * Returns the query with all filters chained.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFilters(query: any, filters: ReportConfig["filters"]) {
  if (!filters || filters.length === 0) return query;

  let filtered = query;
  for (const filter of filters) {
    switch (filter.operator) {
      case "eq":
        filtered = filtered.eq(filter.field, filter.value);
        break;
      case "neq":
        filtered = filtered.neq(filter.field, filter.value);
        break;
      case "in":
        filtered = filtered.in(filter.field, filter.value as string[]);
        break;
      case "is_null":
        filtered = filtered.is(filter.field, null);
        break;
      case "is_not_null":
        filtered = filtered.not(filter.field, "is", null);
        break;
    }
  }
  return filtered;
}

/**
 * Computes metrics by grouping rows client-side.
 * Supabase JS client doesn't support GROUP BY directly,
 * so we fetch raw rows and aggregate in memory.
 */
function computeMetrics(
  rows: Record<string, unknown>[],
  config: ReportConfig,
): { summary: Record<string, unknown>[]; totals: Record<string, unknown> } {
  const totals: Record<string, unknown> = {};

  // Compute totals across all rows
  for (const metric of config.metrics) {
    const key = metric.label;
    switch (metric.aggregation) {
      case "count":
        if (metric.field === "*") {
          totals[key] = rows.length;
        } else {
          totals[key] = rows.filter((r) => r[metric.field] != null).length;
        }
        break;
      case "count_distinct":
        totals[key] = new Set(rows.map((r) => r[metric.field]).filter(Boolean)).size;
        break;
      case "percentage":
        // Percentage of non-null values
        totals[key] =
          rows.length > 0
            ? Math.round((rows.filter((r) => r[metric.field] != null).length / rows.length) * 100)
            : 0;
        break;
      case "sum": {
        const sumVal = rows.reduce((acc, r) => acc + (Number(r[metric.field]) || 0), 0);
        totals[key] = sumVal;
        break;
      }
      case "avg": {
        const nums = rows.map((r) => Number(r[metric.field])).filter((n) => !isNaN(n));
        totals[key] =
          nums.length > 0
            ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100
            : 0;
        break;
      }
      case "min": {
        const minNums = rows.map((r) => Number(r[metric.field])).filter((n) => !isNaN(n));
        totals[key] = minNums.length > 0 ? Math.min(...minNums) : null;
        break;
      }
      case "max": {
        const maxNums = rows.map((r) => Number(r[metric.field])).filter((n) => !isNaN(n));
        totals[key] = maxNums.length > 0 ? Math.max(...maxNums) : null;
        break;
      }
    }
  }

  // If no group_by, return just totals
  if (!config.group_by) {
    return { summary: [totals], totals };
  }

  // Group rows by the specified field
  const groupField = config.group_by.field;
  const groups = new Map<string, Record<string, unknown>[]>();

  for (const row of rows) {
    const groupKey = String(row[groupField] ?? "null");
    const existing = groups.get(groupKey) ?? [];
    existing.push(row);
    groups.set(groupKey, existing);
  }

  // Compute metrics per group
  const summary: Record<string, unknown>[] = [];
  for (const [groupKey, groupRows] of groups) {
    const entry: Record<string, unknown> = {
      [config.group_by.label]: groupKey,
    };

    for (const metric of config.metrics) {
      const key = metric.label;
      switch (metric.aggregation) {
        case "count":
          entry[key] =
            metric.field === "*"
              ? groupRows.length
              : groupRows.filter((r) => r[metric.field] != null).length;
          break;
        case "count_distinct":
          entry[key] = new Set(groupRows.map((r) => r[metric.field]).filter(Boolean)).size;
          break;
        case "percentage":
          entry[key] = rows.length > 0 ? Math.round((groupRows.length / rows.length) * 100) : 0;
          break;
        case "sum":
          entry[key] = groupRows.reduce((acc, r) => acc + (Number(r[metric.field]) || 0), 0);
          break;
        case "avg": {
          const nums = groupRows.map((r) => Number(r[metric.field])).filter((n) => !isNaN(n));
          entry[key] =
            nums.length > 0
              ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100
              : 0;
          break;
        }
        case "min": {
          const minN = groupRows.map((r) => Number(r[metric.field])).filter((n) => !isNaN(n));
          entry[key] = minN.length > 0 ? Math.min(...minN) : null;
          break;
        }
        case "max": {
          const maxN = groupRows.map((r) => Number(r[metric.field])).filter((n) => !isNaN(n));
          entry[key] = maxN.length > 0 ? Math.max(...maxN) : null;
          break;
        }
      }
    }
    summary.push(entry);
  }

  // Sort summary if sort_by is specified
  if (config.sort_by) {
    const sortField = config.sort_by.field;
    const dir = config.sort_by.direction === "asc" ? 1 : -1;
    summary.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === "number" && typeof bVal === "number") return (aVal - bVal) * dir;
      return String(aVal ?? "").localeCompare(String(bVal ?? "")) * dir;
    });
  }

  return { summary, totals };
}

/**
 * preview_report — Executes a report config and returns the computed data.
 * Fetches rows from the specified data source (respecting RLS),
 * applies filters, computes metrics with optional grouping.
 * Returns summary rows + totals for visualization.
 */
export const previewReport = defineTool({
  name: "preview_report",
  description:
    "Execute a report configuration and return the computed data. Fetches rows from the database, applies filters, computes metrics (count, sum, avg, etc.), and groups results. Always call this BEFORE saving a report so the user can verify the data looks correct.",
  schema: z.object({
    config: ReportConfigSchema.describe("The full report configuration to execute"),
  }),
  execute: async ({ config }, ctx: ReportToolContext) => {
    const table = SOURCE_TO_TABLE[config.data_source as ReportDataSource];
    if (!table) {
      return JSON.stringify({ error: `Unknown data source: ${config.data_source}` });
    }

    const dataSource = config.data_source as ReportDataSource;
    const needsJoin = NEEDS_JOIN_FILTER.has(dataSource);
    // protocol_assignment lacks workspace_id — join through profile for workspace scoping
    const columns = needsJoin
      ? `${SOURCE_COLUMNS[dataSource]}, profile!inner(workspace_id)`
      : SOURCE_COLUMNS[dataSource];
    let query = ctx.supabase.from(table).select(columns).limit(1000);

    if (needsJoin) {
      query = query.eq("profile.workspace_id", ctx.workspaceId);
    } else {
      query = query.eq("workspace_id", ctx.workspaceId);
    }

    // Apply filters — cast to ReportFilter[] since Zod schema matches
    query = applyFilters(query, config.filters as ReportConfig["filters"]);

    const { data: rows, error } = await query;

    if (error) {
      return JSON.stringify({ error: `Database query failed: ${error.message}` });
    }

    if (!rows || rows.length === 0) {
      return JSON.stringify({
        summary: [],
        totals: {},
        row_count: 0,
        message: "Ingen data funnet for denne rapporten.",
      });
    }

    const typedConfig = config as ReportConfig;
    const { summary, totals } = computeMetrics(
      rows as unknown as Record<string, unknown>[],
      typedConfig,
    );

    return JSON.stringify({
      summary,
      totals,
      row_count: rows.length,
      visualization: config.visualization,
    });
  },
});
