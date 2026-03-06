// ============================================
// ReportsPageShell.tsx
// Main container for the Reports module.
// Tabbed layout: Oversikt | Medarbeidere | Bemanning |
// Opplaering | Mine rapporter
// AI assistant available via floating button → Sheet drawer.
// ============================================

"use client";

import { useState, useCallback, useContext } from "react";
import {
  BarChart3,
  Users,
  CalendarCheck,
  GraduationCap,
  BookmarkCheck,
  Bot,
  Sparkles,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { OverviewSection } from "./OverviewSection";
import { PeopleSection } from "./PeopleSection";
import { StaffingSection } from "./StaffingSection";
import { TrainingSection } from "./TrainingSection";
import { SavedReportsGrid } from "./SavedReportsGrid";
import { ReportViewer } from "./ReportViewer";
import { AiReportDrawer } from "./AiReportDrawer";

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
  workspaceId?: string;
};

const TABS = [
  { value: "overview", label: "Oversikt", icon: BarChart3 },
  { value: "people", label: "Medarbeidere", icon: Users },
  { value: "staffing", label: "Bemanning", icon: CalendarCheck },
  { value: "training", label: "Opplaering", icon: GraduationCap },
  { value: "saved", label: "Mine rapporter", icon: BookmarkCheck },
] as const;

export function ReportsPageShell({ workspaceId: workspaceIdProp }: ReportsPageShellProps) {
  const { isDark, workspaceData } = useContext(DashboardContext);
  const workspaceId = workspaceIdProp ?? workspaceData?.workspace_id ?? "";
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [activeReportData, setActiveReportData] = useState<ReportData | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleReportData = useCallback((data: unknown) => {
    setActiveReportData(data as ReportData);
  }, []);

  const handleReportSaved = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  const handleSelectReport = useCallback((_report: SavedReport) => {
    setActiveReportData(null);
  }, []);

  const handleCloseViewer = useCallback(() => {
    setActiveReportData(null);
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Page Header */}
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1
            className={`font-heading text-3xl leading-tight tracking-tight ${
              isDark ? "text-white" : "text-zinc-900"
            }`}
          >
            Rapporter
          </h1>
          <p className={`mt-1 text-sm ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
            Innsikt og analyse for din arbeidsstyrke
          </p>
        </div>
        <Button
          onClick={() => setAiDrawerOpen(true)}
          className="group gap-2 rounded-xl px-4"
          size="sm"
        >
          <Bot className="h-4 w-4" />
          <span className="hidden sm:inline">AI Assistent</span>
          <Sparkles className="h-3 w-3 opacity-50 transition-opacity group-hover:opacity-100" />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col">
        <TabsList
          className={`mb-5 inline-flex h-auto w-fit gap-1 rounded-xl border p-1 ${
            isDark ? "border-zinc-800 bg-zinc-900/80" : "border-zinc-200 bg-zinc-50"
          }`}
        >
          {TABS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className={`gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all data-[state=active]:shadow-sm ${
                isDark
                  ? "text-zinc-500 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100"
                  : "text-zinc-400 data-[state=active]:bg-white data-[state=active]:text-zinc-800"
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1 pb-6">
          <TabsContent value="overview" className="mt-0">
            <OverviewSection isDark={isDark} />
          </TabsContent>

          <TabsContent value="people" className="mt-0">
            <PeopleSection isDark={isDark} />
          </TabsContent>

          <TabsContent value="staffing" className="mt-0">
            <StaffingSection isDark={isDark} />
          </TabsContent>

          <TabsContent value="training" className="mt-0">
            <TrainingSection isDark={isDark} />
          </TabsContent>

          <TabsContent value="saved" className="mt-0">
            <div className="flex flex-col gap-6">
              {activeReportData && (
                <ReportViewer data={activeReportData} onClose={handleCloseViewer} />
              )}
              {workspaceId ? (
                <SavedReportsGrid
                  workspaceId={workspaceId}
                  refreshKey={refreshKey}
                  onSelectReport={handleSelectReport}
                />
              ) : (
                <div className="text-muted-foreground text-sm">
                  Arbeidsrom ikke tilgjengelig for rapporter enda.
                </div>
              )}
            </div>
          </TabsContent>
        </div>
      </Tabs>

      {/* AI Report Drawer */}
      {workspaceId ? (
        <AiReportDrawer
          open={aiDrawerOpen}
          onOpenChange={setAiDrawerOpen}
          workspaceId={workspaceId}
          onReportData={handleReportData}
          onReportSaved={handleReportSaved}
        />
      ) : null}
    </div>
  );
}
