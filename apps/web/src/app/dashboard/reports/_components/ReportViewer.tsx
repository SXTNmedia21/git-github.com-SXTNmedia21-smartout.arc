// ============================================
// ReportViewer.tsx
// Renders report data based on visualization type.
// Supports: table, bar chart (CSS-based), pie chart (CSS-based), KPI cards.
// No external charting library — uses pure CSS + shadcn components.
// Connected to: apps/web/src/app/dashboard/reports/page.tsx (parent page)
// ============================================

"use client";

import { BarChart3, Table2, PieChart, LayoutGrid, X } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type ReportData = {
  summary: Record<string, unknown>[];
  totals: Record<string, unknown>;
  row_count: number;
  visualization: string;
  message?: string;
};

type ReportViewerProps = {
  data: ReportData;
  onClose: () => void;
};

/** Bar colors for the CSS bar chart, cycling through 6 options. */
const BAR_COLORS = [
  "bg-primary",
  "bg-blue-500",
  "bg-green-500",
  "bg-amber-500",
  "bg-purple-500",
  "bg-rose-500",
];

/**
 * Renders a report's data using the specified visualization type.
 * Falls back to table view for unknown types.
 */
export function ReportViewer({ data, onClose }: ReportViewerProps) {
  if (data.message && data.summary.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">{data.message}</p>
        </CardContent>
      </Card>
    );
  }

  const vizType = data.visualization ?? "table";

  return (
    <div className="space-y-4">
      {/* Header with close button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {vizType === "bar_chart" && <BarChart3 className="text-primary h-5 w-5" />}
          {vizType === "table" && <Table2 className="text-primary h-5 w-5" />}
          {vizType === "pie_chart" && <PieChart className="text-primary h-5 w-5" />}
          {vizType === "kpi_cards" && <LayoutGrid className="text-primary h-5 w-5" />}
          <h3 className="text-foreground text-lg font-semibold">Forhåndsvisning</h3>
          <span className="text-muted-foreground text-sm">({data.row_count} rader)</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Visualization */}
      {vizType === "table" && <TableVisualization data={data} />}
      {vizType === "bar_chart" && <BarChartVisualization data={data} />}
      {vizType === "pie_chart" && <PieChartVisualization data={data} />}
      {vizType === "kpi_cards" && <KpiCardsVisualization data={data} />}
    </div>
  );
}

/** Renders report data as a shadcn Table. */
function TableVisualization({ data }: { data: ReportData }) {
  if (data.summary.length === 0) return null;

  const columns = Object.keys(data.summary[0]!);

  return (
    <div className="border-border rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col}>{col}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.summary.map((row, i) => (
            <TableRow key={i}>
              {columns.map((col) => (
                <TableCell key={col}>{String(row[col] ?? "—")}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * Renders report data as a horizontal CSS bar chart.
 * Uses the first string column as the label and
 * the first numeric column as the value.
 */
function BarChartVisualization({ data }: { data: ReportData }) {
  if (data.summary.length === 0) return null;

  const columns = Object.keys(data.summary[0]!);
  // First column is the label, remaining are numeric values
  const labelCol = columns[0]!;
  const valueCols = columns.slice(1);
  const valueCol = valueCols[0] ?? labelCol;

  // Find max value for scaling bars
  const values = data.summary.map((row) => Number(row[valueCol]) || 0);
  const maxValue = Math.max(...values, 1);

  return (
    <Card>
      <CardContent className="space-y-3 pt-4">
        {data.summary.map((row, i) => {
          const label = String(row[labelCol] ?? "—");
          const value = Number(row[valueCol]) || 0;
          const widthPercent = Math.max((value / maxValue) * 100, 2);
          const colorClass = BAR_COLORS[i % BAR_COLORS.length];

          return (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground font-medium">{label}</span>
                <span className="text-muted-foreground">{value}</span>
              </div>
              <div className="bg-muted h-6 w-full overflow-hidden rounded-md">
                <div
                  className={`${colorClass} h-full rounded-md transition-all duration-500`}
                  style={{ width: `${widthPercent}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/**
 * Renders report data as a simple pie chart using CSS conic-gradient.
 * Includes a legend with labels and percentages.
 */
function PieChartVisualization({ data }: { data: ReportData }) {
  if (data.summary.length === 0) return null;

  const columns = Object.keys(data.summary[0]!);
  const labelCol = columns[0]!;
  const valueCols = columns.slice(1);
  const valueCol = valueCols[0] ?? labelCol;

  const values = data.summary.map((row) => Number(row[valueCol]) || 0);
  const total = values.reduce((a, b) => a + b, 0) || 1;

  // Build conic-gradient stops
  const cssColors = ["#f97316", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#f43f5e"];
  let cumulativePercent = 0;
  const gradientStops: string[] = [];

  values.forEach((value, i) => {
    const percent = (value / total) * 100;
    const color = cssColors[i % cssColors.length]!;
    gradientStops.push(`${color} ${cumulativePercent}% ${cumulativePercent + percent}%`);
    cumulativePercent += percent;
  });

  const gradient = `conic-gradient(${gradientStops.join(", ")})`;

  return (
    <Card>
      <CardContent className="flex items-center gap-8 pt-4">
        {/* Pie chart circle */}
        <div className="h-40 w-40 shrink-0 rounded-full" style={{ background: gradient }} />

        {/* Legend */}
        <div className="space-y-2">
          {data.summary.map((row, i) => {
            const label = String(row[labelCol] ?? "—");
            const value = Number(row[valueCol]) || 0;
            const percent = Math.round((value / total) * 100);
            const color = cssColors[i % cssColors.length];

            return (
              <div key={i} className="flex items-center gap-2 text-sm">
                <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: color }} />
                <span className="text-foreground">{label}</span>
                <span className="text-muted-foreground">
                  {value} ({percent}%)
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Renders report totals as large KPI cards.
 * Each metric from totals gets its own card.
 */
function KpiCardsVisualization({ data }: { data: ReportData }) {
  const entries = Object.entries(data.totals);

  if (entries.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map(([label, value]) => (
        <Card key={label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">{label}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground text-3xl font-bold">{String(value ?? "—")}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
