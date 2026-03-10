// ============================================
// ReportCard.tsx
// Individual card for a saved report in the grid.
// Shows name, description, visualization type, and timestamps.
// Connected to: _components/SavedReportsGrid.tsx (parent container)
// ============================================

"use client";

import { BarChart3, Table2, PieChart, LayoutGrid, Pin, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type SavedReport = {
  report_id: string;
  name: string;
  description: string | null;
  config: { visualization?: string; data_source?: string };
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
};

type ReportCardProps = {
  report: SavedReport;
  onSelect: (report: SavedReport) => void;
  onDelete: (reportId: string) => void;
};

/** Maps visualization type to a display icon. */
const VIZ_ICONS: Record<string, typeof BarChart3> = {
  bar_chart: BarChart3,
  table: Table2,
  pie_chart: PieChart,
  kpi_cards: LayoutGrid,
};

/** Maps visualization type to a Norwegian display label. */
const VIZ_LABELS: Record<string, string> = {
  bar_chart: "Stolpediagram",
  table: "Tabell",
  pie_chart: "Kakediagram",
  kpi_cards: "KPI-kort",
};

/**
 * A clickable card representing a saved report.
 * Shows visualization icon, name, description, and metadata.
 */
export function ReportCard({ report, onSelect, onDelete }: ReportCardProps) {
  const vizType = report.config?.visualization ?? "table";
  const VizIcon = VIZ_ICONS[vizType] ?? Table2;
  const vizLabel = VIZ_LABELS[vizType] ?? "Tabell";
  const dataSource = report.config?.data_source ?? "unknown";

  /**
   * Formats an ISO timestamp to a short Norwegian date string.
   */
  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("no-NO", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <Card
      className="group hover:border-primary/50 cursor-pointer border transition-colors dark:border-zinc-700 dark:bg-zinc-950/90 dark:hover:bg-zinc-950"
      onClick={() => onSelect(report)}
    >
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 flex h-8 w-8 items-center justify-center rounded-md">
            <VizIcon className="text-primary h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-sm leading-tight font-semibold">
              {report.is_pinned && <Pin className="text-primary mr-1 inline h-3 w-3" />}
              {report.name}
            </CardTitle>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(report.report_id);
          }}
        >
          <Trash2 className="text-destructive h-3.5 w-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        {report.description && (
          <p className="text-muted-foreground mb-2 line-clamp-2 text-xs">{report.description}</p>
        )}
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {vizLabel}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {dataSource}
          </Badge>
        </div>
        <p className="text-muted-foreground mt-2 text-xs">
          Oppdatert {formatDate(report.updated_at)}
        </p>
      </CardContent>
    </Card>
  );
}
