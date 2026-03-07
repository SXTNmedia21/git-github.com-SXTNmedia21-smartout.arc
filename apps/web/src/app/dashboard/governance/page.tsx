"use client";

import { Loader2, ShieldCheck } from "lucide-react";
import { useContext, useMemo } from "react";
import { useGovernanceOverview } from "@/app/dashboard/_hooks";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { Badge } from "@/components/ui/badge";
import { GovernanceOverview } from "./_components/GovernanceOverview";
import { OverdueAlerts } from "./_components/OverdueAlerts";
import { PolicyForm } from "./_components/PolicyForm";
import { ProtocolForm } from "./_components/ProtocolForm";
import { ProcedureBuilder } from "./_components/ProcedureBuilder";
import { KnowledgeTestBuilder } from "./_components/KnowledgeTestBuilder";
import { ConfirmationForm } from "./_components/ConfirmationForm";

export default function GovernancePage() {
  const { isAdminMode } = useContext(DashboardContext);
  const { data: protocols, isLoading, error } = useGovernanceOverview();

  const stableProtocols = useMemo(() => protocols ?? [], [protocols]);

  const expiredAlerts = useMemo(() => {
    return stableProtocols
      .filter((p) => p.expiredCount > 0)
      .map((p) => ({
        protocolName: p.protocolName,
        displayName: `${p.expiredCount} ansatte`,
        assignedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // Approximate — real dates not available at overview level
      }));
  }, [stableProtocols]);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6">
        <h2 className="mb-2 text-lg font-bold text-red-500">Kunne ikke laste governance-data</h2>
        <p className="text-muted-foreground text-sm">
          {error instanceof Error ? error.message : "En ukjent feil oppstod."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="mb-1 flex items-center gap-3">
          <h1 className="text-foreground text-3xl font-extrabold tracking-tight">Governance</h1>
          {stableProtocols.length > 0 && (
            <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
              <ShieldCheck className="mr-1 h-3 w-3" />
              {stableProtocols.length} protokoller
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground text-sm">Protokollstatus og ansattes fremdrift</p>
      </div>

      {/* Admin CRUD actions */}
      {isAdminMode && (
        <div className="flex flex-wrap gap-2">
          <PolicyForm />
          <ProtocolForm />
          <ProcedureBuilder />
          <KnowledgeTestBuilder />
          <ConfirmationForm />
        </div>
      )}

      {/* Overdue alerts */}
      <OverdueAlerts expiredAssignees={expiredAlerts} />

      {/* Protocol overview */}
      <GovernanceOverview protocols={stableProtocols} />
    </div>
  );
}
