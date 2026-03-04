// ============================================
// SavedReportsGrid.tsx
// Grid of saved report cards.
// Fetches reports from Supabase and renders ReportCard for each.
// Connected to: _components/ReportCard.tsx (individual card)
// Connected to: apps/web/src/app/dashboard/reports/page.tsx (parent page)
// ============================================

"use client";

import { useEffect, useState, useCallback } from "react";
import { BarChart3, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReportCard } from "./ReportCard";
import { createClient } from "@smartout/supabase/client";

/**
 * NOTE: custom_report table exists after migration 20260301150000.
 * Types will be available after regenerating database.types.ts.
 * Until then, we use explicit types and cast the Supabase query.
 */
type SavedReport = {
  report_id: string;
  name: string;
  description: string | null;
  config: { visualization?: string; data_source?: string };
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
};

type SavedReportsGridProps = {
  workspaceId: string;
  /** Incremented to trigger a refetch (e.g., after saving a new report) */
  refreshKey: number;
  onSelectReport: (report: SavedReport) => void;
};

/**
 * Fetches and displays all saved reports for the workspace.
 * Shows a loading state, empty state, and the card grid.
 */
export function SavedReportsGrid({
  workspaceId,
  refreshKey,
  onSelectReport,
}: SavedReportsGridProps) {
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Fetches saved reports from Supabase using the browser client.
   * RLS ensures we only get workspace-scoped reports.
   */
  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = createClient() as any;
      const { data, error } = await supabase
        .from("custom_report")
        .select("report_id, name, description, config, is_pinned, created_at, updated_at")
        .eq("workspace_id", workspaceId)
        .order("is_pinned", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Failed to fetch reports:", error);
        return;
      }

      setReports((data as SavedReport[]) ?? []);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  // Fetch on mount and when refreshKey changes
  useEffect(() => {
    void fetchReports();
  }, [fetchReports, refreshKey]);

  /**
   * Deletes a report via Supabase client and refreshes the list.
   * RLS handles authorization.
   */
  const handleDelete = useCallback(
    async (reportId: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = createClient() as any;
      const { error } = await supabase
        .from("custom_report")
        .delete()
        .eq("report_id", reportId)
        .eq("workspace_id", workspaceId);

      if (error) {
        console.error("Failed to delete report:", error);
        return;
      }

      // Remove from local state immediately
      setReports((prev) => prev.filter((r) => r.report_id !== reportId));
    },
    [workspaceId],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="border-border bg-muted/20 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12">
        <div className="bg-muted mb-4 flex h-16 w-16 items-center justify-center rounded-full">
          <BarChart3 className="text-muted-foreground h-8 w-8" />
        </div>
        <h2 className="text-foreground mb-2 text-xl font-bold">Ingen rapporter ennå</h2>
        <p className="text-muted-foreground max-w-sm text-center">
          Bruk chat-panelet til høyre for å bygge din første tilpassede rapport med AI-assistenten.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-foreground text-lg font-semibold">
          Lagrede rapporter ({reports.length})
        </h2>
        <Button variant="ghost" size="sm" onClick={() => void fetchReports()}>
          <RefreshCw className="mr-1 h-3 w-3" />
          Oppdater
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reports.map((report) => (
          <ReportCard
            key={report.report_id}
            report={report}
            onSelect={onSelectReport}
            onDelete={(id) => void handleDelete(id)}
          />
        ))}
      </div>
    </div>
  );
}
