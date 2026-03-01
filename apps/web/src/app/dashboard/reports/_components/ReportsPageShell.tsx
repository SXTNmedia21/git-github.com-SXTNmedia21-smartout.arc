// ============================================
// ReportsPageShell.tsx
// Client-side interactive shell for the reports page.
// Manages state between the chat panel, saved reports grid,
// and report viewer. Split-panel layout.
// Connected to: apps/web/src/app/dashboard/reports/page.tsx (server parent)
// ============================================

"use client";

import { useState, useCallback } from "react";
import { ReportsChatPanel } from "./ReportsChatPanel";
import { SavedReportsGrid } from "./SavedReportsGrid";
import { ReportViewer } from "./ReportViewer";

type ReportData = {
  summary: Record<string, unknown>[];
  totals: Record<string, unknown>;
  row_count: number;
  visualization: string;
  message?: string;
};

type SavedReport = {
  report_id: string;
  name: string;
  description: string | null;
  config: { visualization?: string; data_source?: string };
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
};

type ReportsPageShellProps = {
  workspaceId: string;
};

/**
 * Interactive shell with split-panel layout:
 * Left side — saved reports grid + active report viewer
 * Right side — AI chat panel (report builder wizard)
 */
export function ReportsPageShell({ workspaceId }: ReportsPageShellProps) {
  // Report data from the AI agent's preview_report tool
  const [activeReportData, setActiveReportData] = useState<ReportData | null>(null);
  // Counter to trigger refetch of saved reports
  const [refreshKey, setRefreshKey] = useState(0);

  /** Called when the AI agent returns preview data */
  const handleReportData = useCallback((data: unknown) => {
    setActiveReportData(data as ReportData);
  }, []);

  /** Called when the AI agent saves a report */
  const handleReportSaved = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  /** Called when a saved report card is clicked — re-execute and show */
  const handleSelectReport = useCallback((_report: SavedReport) => {
    // For now, set the config as active data
    // Future: re-execute the report config via API
    setActiveReportData(null);
  }, []);

  /** Close the active report viewer */
  const handleCloseViewer = useCallback(() => {
    setActiveReportData(null);
  }, []);

  return (
    <>
      <div className="mb-6">
        <h1 className="text-foreground mb-2 text-3xl font-extrabold tracking-tight">Rapporter</h1>
        <p className="text-muted-foreground text-sm">
          Bygg tilpassede rapporter med AI-assistenten eller se lagrede rapporter.
        </p>
      </div>

      <div className="flex flex-1 gap-6">
        {/* Left side: saved reports + report viewer */}
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          {/* Active report viewer — shown when AI produces preview data */}
          {activeReportData && <ReportViewer data={activeReportData} onClose={handleCloseViewer} />}

          {/* Saved reports grid */}
          <SavedReportsGrid
            workspaceId={workspaceId}
            refreshKey={refreshKey}
            onSelectReport={handleSelectReport}
          />
        </div>

        {/* Right side: AI chat panel */}
        <div className="border-border bg-card hidden w-[380px] shrink-0 overflow-hidden rounded-lg border lg:flex lg:flex-col">
          <ReportsChatPanel
            workspaceId={workspaceId}
            onReportData={handleReportData}
            onReportSaved={handleReportSaved}
          />
        </div>
      </div>
    </>
  );
}
