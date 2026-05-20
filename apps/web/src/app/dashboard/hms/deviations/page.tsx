"use client";

import { useContext, useState } from "react";
import { LayoutGrid, List, Loader2 } from "lucide-react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { useDeviations } from "../_hooks/use-deviations";
import { DeviationKanban } from "../_components/DeviationKanban";
import { DeviationListView } from "../_components/DeviationListView";
import { DeviationDetailDrawer } from "../_components/DeviationDetailDrawer";
import { DeviationForm } from "../_components/DeviationForm";
import type { DeviationRow } from "@smartout/hms";
import { HmsDeviationsToolsBridge } from "./_tools/hms-deviations-tools-bridge";

type ViewMode = "kanban" | "list";

export default function DeviationsPage() {
  const { isAdminMode } = useContext(DashboardContext);
  const { data: deviations, isLoading } = useDeviations();
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [selectedDeviation, setSelectedDeviation] = useState<DeviationRow | null>(null);

  const allDeviationsForBridge = deviations ?? [];
  const bridge = (
    <HmsDeviationsToolsBridge
      isAdminMode={isAdminMode}
      loading={isLoading}
      deviations={allDeviationsForBridge}
      viewMode={viewMode}
      selectedDeviationId={selectedDeviation?.deviationId ?? null}
      setViewMode={setViewMode}
      openDetail={(deviationId) => {
        const row = allDeviationsForBridge.find((r) => r.deviationId === deviationId);
        if (row) setSelectedDeviation(row);
      }}
    />
  );

  if (!isAdminMode) {
    return (
      <>
        {bridge}
        <DeviationForm />
      </>
    );
  }

  if (isLoading) {
    return (
      <>
        {bridge}
        <div className="flex items-center justify-center py-12">
          <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
        </div>
      </>
    );
  }

  const allDeviations = deviations ?? [];

  return (
    <>
      {bridge}
      <div className="space-y-4">
        {/* Header + toggle */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-foreground text-lg font-bold">Avvik</h2>
            <p className="text-muted-foreground text-xs">{allDeviations.length} avvik totalt</p>
          </div>
          <div className="bg-muted flex rounded-lg p-0.5">
            <Button
              variant={viewMode === "kanban" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setViewMode("kanban")}
            >
              <LayoutGrid className="mr-1 h-3 w-3" />
              Kanban
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setViewMode("list")}
            >
              <List className="mr-1 h-3 w-3" />
              Liste
            </Button>
          </div>
        </div>

        {/* View */}
        {viewMode === "kanban" ? (
          <DeviationKanban deviations={allDeviations} onSelect={setSelectedDeviation} />
        ) : (
          <DeviationListView deviations={allDeviations} onSelect={setSelectedDeviation} />
        )}

        {/* Detail drawer */}
        <DeviationDetailDrawer
          deviation={selectedDeviation}
          open={!!selectedDeviation}
          onClose={() => setSelectedDeviation(null)}
        />
      </div>
    </>
  );
}
