// ============================================
// ReportsPageShell.tsx
// Main container for the Reports module.
// Tabbed layout: Oversikt | Medarbeidere | Bemanning |
// Opplaering | Mine rapporter
// AI assistant available via floating button → Sheet drawer.
// ============================================

"use client";

import { useState, useCallback, useContext, useMemo, useEffect, useRef } from "react";
import {
  BarChart3,
  Users,
  CalendarCheck,
  GraduationCap,
  BookmarkCheck,
  Bot,
  Sparkles,
} from "lucide-react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { PageTabNav } from "@/components/dashboard/PageTabNav";
import { usePageTabs } from "@/components/dashboard/PageHeaderContext";
import { Button } from "@/components/ui/button";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { emit, nonEmpty } from "@smartout/telemetry";
import dynamic from "next/dynamic";
import { SkeletonChart, withEntrance } from "@smartout/ui";
import { SavedReportsGrid } from "./SavedReportsGrid";
import { ReportViewer } from "./ReportViewer";
import { AiReportDrawer } from "./AiReportDrawer";
import { ReportInsightDrawer } from "./ReportInsightDrawer";
import type { ReportInsightCard } from "./report-insight-types";
import { ReportsToolsBridge } from "../_tools/reports-tools-bridge";
import type { ReportsTab } from "../_tools/use-reports-tools";
import { useReportOverview } from "../_hooks/use-report-overview";
import { useReportPeople } from "../_hooks/use-report-people";
import { useReportStaffing } from "../_hooks/use-report-staffing";
import { useReportTraining } from "../_hooks/use-report-training";

// Recharts (~90KB) is heavy. Each tab is only needed when the user clicks it,
// so we defer loading until the TabsContent renders. Skeleton matches chart
// geometry so the swap-in is visually contained. `withEntrance` adds the
// canonical springSnappy entrance so the chunk-resolve doesn't pop in.
const sectionLoading = () => <SkeletonChart className="min-h-[28rem]" />;

const OverviewSection = dynamic(
  () =>
    import("./OverviewSection").then((m) => ({
      default: withEntrance(m.OverviewSection),
    })),
  { ssr: false, loading: sectionLoading },
);
const PeopleSection = dynamic(
  () =>
    import("./PeopleSection").then((m) => ({
      default: withEntrance(m.PeopleSection),
    })),
  { ssr: false, loading: sectionLoading },
);
const StaffingSection = dynamic(
  () =>
    import("./StaffingSection").then((m) => ({
      default: withEntrance(m.StaffingSection),
    })),
  { ssr: false, loading: sectionLoading },
);
const TrainingSection = dynamic(
  () =>
    import("./TrainingSection").then((m) => ({
      default: withEntrance(m.TrainingSection),
    })),
  { ssr: false, loading: sectionLoading },
);

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
  const { isDark, workspaceData, profileId } = useContext(DashboardContext);
  const workspaceId = workspaceIdProp ?? workspaceData?.workspace_id ?? "";
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [activeReportData, setActiveReportData] = useState<ReportData | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [insightDrawerOpen, setInsightDrawerOpen] = useState(false);
  const [activeInsight, setActiveInsight] = useState<ReportInsightCard | null>(null);
  const [_insightStateByCard, setInsightStateByCard] = useState<Record<string, ReportInsightCard>>(
    {},
  );
  const [insightDefaultsByCard, setInsightDefaultsByCard] = useState<
    Record<string, ReportInsightCard>
  >({});

  // Telemetry: emit "page viewed" once after workspace + actor are known (ADR-0134 R1).
  // Reports is a read-only analytics surface — no domain-specific registry entry needed;
  // "page viewed" (PostHog only) is sufficient for navigation audit.
  const viewedRef = useRef(false);
  useEffect(() => {
    if (!workspaceId || !profileId || viewedRef.current) return;
    viewedRef.current = true;
    void emit({
      event: "page viewed",
      workspace_id: nonEmpty(workspaceId, "workspace_id"),
      actor_id: nonEmpty(profileId, "actor_id"),
      properties: {
        path: "/dashboard/reports",
      },
    });
  }, [workspaceId, profileId]);

  // Controlled tab — lets Botsson navigate between tabs via switchReportTab tool.
  const [activeTab, setActiveTab] = useState<ReportsTab>("overview");

  // Saved-reports count — updated from SavedReportsGrid via onCountChange.
  const [savedReportsCount, setSavedReportsCount] = useState(0);

  // Hoist analytics hooks so the Botsson bridge can access live data without
  // waiting for the dynamic-import chunk to render. The same queries run inside
  // each dynamically-loaded section; TanStack deduplicates via queryKey.
  const { data: overviewData } = useReportOverview();
  const { data: peopleData } = useReportPeople();
  const { data: staffingData } = useReportStaffing();
  const { data: trainingData } = useReportTraining();

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

  /**
   * Opens the insight drawer for the selected report card.
   */
  const handleOpenInsight = useCallback((insight: ReportInsightCard) => {
    setInsightDefaultsByCard((previous) => ({
      ...previous,
      [insight.cardId]: previous[insight.cardId] ?? insight,
    }));

    setInsightStateByCard((previous) => {
      const currentInsight = previous[insight.cardId] ?? insight;
      setActiveInsight(currentInsight);
      return {
        ...previous,
        [insight.cardId]: currentInsight,
      };
    });

    setInsightDrawerOpen(true);
  }, []);

  /**
   * Updates one variable for the selected report insight card.
   */
  const handleInsightFactorChange = useCallback(
    (cardId: string, factorId: string, value: number) => {
      setInsightStateByCard((previous) => {
        const currentCard = previous[cardId];
        if (!currentCard) return previous;

        const nextCard: ReportInsightCard = {
          ...currentCard,
          factors: currentCard.factors.map((factor) =>
            factor.id === factorId
              ? {
                  ...factor,
                  value: Math.min(factor.max, Math.max(factor.min, value)),
                }
              : factor,
          ),
        };

        setActiveInsight((active) => (active?.cardId === cardId ? nextCard : active));

        return {
          ...previous,
          [cardId]: nextCard,
        };
      });
    },
    [],
  );

  /**
   * Restores factors for one insight card to its original defaults.
   */
  const handleResetInsightCard = useCallback(
    (cardId: string) => {
      const original = insightDefaultsByCard[cardId];
      if (!original) return;

      setInsightStateByCard((previous) => ({
        ...previous,
        [cardId]: {
          ...original,
          factors: original.factors.map((factor) => ({ ...factor })),
        },
      }));

      setActiveInsight((active) =>
        active?.cardId === cardId
          ? {
              ...original,
              factors: original.factors.map((factor) => ({ ...factor })),
            }
          : active,
      );
    },
    [insightDefaultsByCard],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Page Header */}
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="font-heading text-foreground text-3xl leading-tight tracking-tight">
            Rapporter
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
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

      {/* Botsson harness bridge — registers page-scoped tools, renders nothing. */}
      <ReportsToolsBridge
        workspaceId={workspaceId}
        activeTab={activeTab}
        overviewData={overviewData}
        peopleData={peopleData}
        staffingData={staffingData}
        trainingData={trainingData}
        savedReportsCount={savedReportsCount}
        uiActions={{
          setActiveTab,
          openAiDrawer: () => setAiDrawerOpen(true),
        }}
      />

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as ReportsTab)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <ReportsTabsPublisher
          activeTab={activeTab}
          onChange={(v) => setActiveTab(v as ReportsTab)}
        />

        <div className="min-h-0 flex-1 overflow-y-auto pr-1 pb-6">
          <TabsContent value="overview" className="mt-0">
            <OverviewSection isDark={isDark} onOpenInsight={handleOpenInsight} />
          </TabsContent>

          <TabsContent value="people" className="mt-0">
            <PeopleSection isDark={isDark} onOpenInsight={handleOpenInsight} />
          </TabsContent>

          <TabsContent value="staffing" className="mt-0">
            <StaffingSection isDark={isDark} onOpenInsight={handleOpenInsight} />
          </TabsContent>

          <TabsContent value="training" className="mt-0">
            <TrainingSection isDark={isDark} onOpenInsight={handleOpenInsight} />
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

      <ReportInsightDrawer
        isDark={isDark}
        open={insightDrawerOpen}
        onOpenChange={setInsightDrawerOpen}
        insight={activeInsight}
        onFactorChange={handleInsightFactorChange}
        onResetCard={handleResetInsightCard}
      />
    </div>
  );
}

function ReportsTabsPublisher({
  activeTab,
  onChange,
}: {
  activeTab: string;
  onChange: (v: string) => void;
}) {
  const tabsNode = useMemo(
    () => (
      <PageTabNav
        tabs={TABS.map((tab) => ({ key: tab.value, label: tab.label, icon: tab.icon }))}
        active={activeTab}
        onChange={onChange}
        ariaLabel="Rapport-seksjoner"
      />
    ),
    [activeTab, onChange],
  );
  usePageTabs(tabsNode);
  return null;
}
