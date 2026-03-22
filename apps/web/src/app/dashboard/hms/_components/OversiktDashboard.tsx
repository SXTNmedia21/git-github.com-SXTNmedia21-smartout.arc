"use client";

import { useContext } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  AlertTriangle,
  Clock,
  Users,
  GraduationCap,
  ClipboardCheck,
  FileSearch,
  Loader2,
} from "lucide-react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGovernanceFiltered } from "../_hooks/use-governance-filtered";

// TODO: move to i18n
const STRINGS = {
  statusTitle: "Status",
  attentionTitle: "Krever oppmerksomhet",
  actionsTitle: "Handlinger",
  readiness: "Opplaeringsgrad",
  openDeviations: "Apne avvik",
  overdueItems: "Forfalt",
  protocols: "Protokoller",
  noAttention: "Ingen varsler akkurat na.",
  assignTraining: "Tildel opplaering",
  logControl: "Logg kontroll",
  inspectionPack: "Inspeksjonspakke",
  expired: "ansatte har forfalt opplaering",
  lowCompletion: "fullforingsgrad",
} as const;

type KpiCardProps = {
  icon: typeof ShieldCheck;
  label: string;
  value: string | number;
  sublabel?: string;
  variant?: "default" | "warning" | "critical";
};

function KpiCard({ icon: Icon, label, value, sublabel, variant = "default" }: KpiCardProps) {
  const variantStyles = {
    default: "border-border bg-card",
    warning: "border-yellow-500/30 bg-yellow-500/5",
    critical: "border-red-500/30 bg-red-500/5",
  };

  return (
    <Card className={`${variantStyles[variant]}`}>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
          <Icon className="text-muted-foreground h-5 w-5" />
        </div>
        <div>
          <p className="text-muted-foreground text-xs font-medium">{label}</p>
          <p className="text-foreground text-2xl font-bold">{value}</p>
          {sublabel && <p className="text-muted-foreground text-xs">{sublabel}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export function OversiktDashboard() {
  const { isDark } = useContext(DashboardContext);
  const { protocols, stats, isLoading } = useGovernanceFiltered("all");

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    );
  }

  const overdueProtocols = protocols.filter((p) => p.expiredCount > 0);
  const lowCompletionProtocols = protocols
    .filter((p) => p.completionPercent < 80 && p.totalAssigned > 0)
    .sort((a, b) => a.completionPercent - b.completionPercent);

  return (
    <div className="space-y-6">
      {/* Block A: Status */}
      <div>
        <h2 className="text-foreground mb-3 text-lg font-bold">{STRINGS.statusTitle}</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            icon={ShieldCheck}
            label={STRINGS.readiness}
            value={`${stats.avgCompletion}%`}
            variant={
              stats.avgCompletion < 70
                ? "critical"
                : stats.avgCompletion < 90
                  ? "warning"
                  : "default"
            }
          />
          <KpiCard
            icon={AlertTriangle}
            label={STRINGS.openDeviations}
            value={0}
            sublabel="Kommer i Phase 2"
          />
          <KpiCard
            icon={Clock}
            label={STRINGS.overdueItems}
            value={stats.overdue}
            variant={stats.overdue > 0 ? "warning" : "default"}
          />
          <KpiCard icon={Users} label={STRINGS.protocols} value={stats.total} />
        </div>
      </div>

      {/* Block B: Attention */}
      <div>
        <h2 className="text-foreground mb-3 text-lg font-bold">{STRINGS.attentionTitle}</h2>
        {overdueProtocols.length === 0 && lowCompletionProtocols.length === 0 ? (
          <div
            className={`rounded-xl border p-6 text-center ${isDark ? "border-zinc-800 bg-zinc-900/50" : "border-border bg-muted/30"}`}
          >
            <p className="text-muted-foreground text-sm">{STRINGS.noAttention}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {overdueProtocols.map((p) => (
              <Link
                key={`expired-${p.protocolId}`}
                href="/dashboard/hms/training"
                className={`hover:bg-muted/50 flex items-center gap-3 rounded-lg border p-3 transition-colors ${isDark ? "border-zinc-800" : "border-border"}`}
              >
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-foreground text-sm font-medium">{p.protocolName}</p>
                  <p className="text-muted-foreground text-xs">
                    {p.expiredCount} {STRINGS.expired}
                  </p>
                </div>
              </Link>
            ))}
            {lowCompletionProtocols.map((p) => (
              <Link
                key={`low-${p.protocolId}`}
                href="/dashboard/hms/training"
                className={`hover:bg-muted/50 flex items-center gap-3 rounded-lg border p-3 transition-colors ${isDark ? "border-zinc-800" : "border-border"}`}
              >
                <Clock className="h-4 w-4 shrink-0 text-yellow-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-foreground text-sm font-medium">{p.protocolName}</p>
                  <p className="text-muted-foreground text-xs">
                    {p.completionPercent}% {STRINGS.lowCompletion}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Block C: Actions */}
      <div>
        <h2 className="text-foreground mb-3 text-lg font-bold">{STRINGS.actionsTitle}</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/hms/training">
              <GraduationCap className="mr-2 h-4 w-4" />
              {STRINGS.assignTraining}
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/hms/drift">
              <ClipboardCheck className="mr-2 h-4 w-4" />
              {STRINGS.logControl}
            </Link>
          </Button>
          <Button variant="outline" size="sm" disabled>
            <FileSearch className="mr-2 h-4 w-4" />
            {STRINGS.inspectionPack}
          </Button>
        </div>
      </div>
    </div>
  );
}
