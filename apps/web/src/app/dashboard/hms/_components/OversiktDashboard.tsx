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
  CalendarClock,
  Loader2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@smartout/i18n";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useWorkspace } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGovernanceFiltered } from "../_hooks/use-governance-filtered";
import { useDeviations } from "../_hooks/use-deviations";
import { useCompetenceData } from "./CompetenceMatrix";
import { DepartmentReadiness } from "./DepartmentReadiness";

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
  const { t } = useTranslation("dashboard");
  const { isDark } = useContext(DashboardContext);
  const { workspace } = useWorkspace();
  const { protocols, stats, isLoading } = useGovernanceFiltered("all");
  const { data: openDeviations } = useDeviations({ status: ["open", "acknowledged", "escalated"] });
  const openDeviationCount = openDeviations?.length ?? 0;
  const { data: competenceData } = useCompetenceData();

  // Count assignments with next_review_at within 30 days
  const { data: upcomingReviews } = useQuery({
    queryKey: ["hms", "upcoming-reviews", workspace.workspace_id],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<number> => {
      const supabase = createClient();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const { count, error } = await supabase
        .from("protocol_assignment")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", workspace.workspace_id)
        .not("next_review_at", "is", null)
        .lte("next_review_at", thirtyDaysFromNow.toISOString());

      if (error) throw error;
      return count ?? 0;
    },
  });
  const upcomingReviewCount = upcomingReviews ?? 0;

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
        <h2 className="text-foreground mb-3 text-lg font-bold">{t("hms.overview.status_title")}</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            icon={ShieldCheck}
            label={t("hms.overview.readiness")}
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
            label={t("hms.overview.open_deviations")}
            value={openDeviationCount}
            variant={openDeviationCount > 0 ? "warning" : "default"}
          />
          <KpiCard
            icon={Clock}
            label={t("hms.overview.overdue_items")}
            value={stats.overdue}
            variant={stats.overdue > 0 ? "warning" : "default"}
          />
          <KpiCard icon={Users} label={t("hms.overview.protocols")} value={stats.total} />
          <KpiCard
            icon={CalendarClock}
            label="Kommende fornyelser"
            value={upcomingReviewCount}
            sublabel="Neste 30 dager"
            variant={upcomingReviewCount > 5 ? "warning" : "default"}
          />
        </div>
      </div>

      {/* Block A2: Department Readiness */}
      {competenceData && competenceData.rows.length > 0 && (
        <DepartmentReadiness rows={competenceData.rows} />
      )}

      {/* Block B: Attention */}
      <div>
        <h2 className="text-foreground mb-3 text-lg font-bold">
          {t("hms.overview.attention_title")}
        </h2>
        {overdueProtocols.length === 0 && lowCompletionProtocols.length === 0 ? (
          <div
            className={`rounded-xl border p-6 text-center ${isDark ? "border-zinc-800 bg-zinc-900/50" : "border-border bg-muted/30"}`}
          >
            <p className="text-muted-foreground text-sm">{t("hms.overview.no_attention")}</p>
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
                    {p.expiredCount} {t("hms.overview.expired")}
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
                    {p.completionPercent}% {t("hms.overview.low_completion")}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Block C: Actions */}
      <div>
        <h2 className="text-foreground mb-3 text-lg font-bold">
          {t("hms.overview.actions_title")}
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/hms/training">
              <GraduationCap className="mr-2 h-4 w-4" />
              {t("hms.overview.assign_training")}
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/hms/drift">
              <ClipboardCheck className="mr-2 h-4 w-4" />
              {t("hms.overview.log_control")}
            </Link>
          </Button>
          <Button variant="outline" size="sm" disabled>
            <FileSearch className="mr-2 h-4 w-4" />
            {t("hms.overview.inspection_pack")}
          </Button>
        </div>
      </div>
    </div>
  );
}
