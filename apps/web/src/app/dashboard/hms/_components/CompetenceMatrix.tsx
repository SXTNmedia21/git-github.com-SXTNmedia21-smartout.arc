"use client";

import { useMemo, useState } from "react";
import {
  Loader2,
  Filter,
  UserPlus,
  Building2,
  Users as UsersIcon,
  MapPin,
  Briefcase,
  Calendar,
  Layers,
} from "lucide-react";
import { useTranslation } from "@smartout/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { AssignProtocolSheet } from "@/app/dashboard/governance/_components/AssignProtocolSheet";
import {
  useWorkforceReadiness as useCompetenceData,
  type AssignmentStatus,
  type AssignmentProgress,
  type CellData,
  type MatrixRow,
  type ProtocolColumn,
} from "@/app/dashboard/_hooks/use-workforce-readiness";

// Re-export for backward-compat consumers (e.g. OversiktDashboard.tsx).
export { useCompetenceData };

// ── Assignment source display ──

const ASSIGNED_VIA_ICONS: Record<string, typeof Building2> = {
  workspace: Layers,
  department: Building2,
  team: UsersIcon,
  location: MapPin,
  position: Briefcase,
  manual: UserPlus,
  season: Calendar,
};

const ASSIGNED_VIA_LABELS: Record<string, string> = {
  workspace: "Tildelt via arbeidssted",
  department: "Tildelt via avdeling",
  team: "Tildelt via team",
  location: "Tildelt via lokasjon",
  position: "Tildelt via stilling",
  manual: "Manuelt tildelt",
  season: "Tildelt via sesong",
};

function CellWithSource({
  assignedVia,
  children,
}: {
  assignedVia: string | null;
  children: React.ReactNode;
}) {
  if (!assignedVia) return <>{children}</>;

  const SourceIcon = ASSIGNED_VIA_ICONS[assignedVia] ?? Layers;
  const sourceLabel = ASSIGNED_VIA_LABELS[assignedVia] ?? assignedVia;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="group relative inline-flex flex-col items-center">
          {children}
          <SourceIcon className="text-muted-foreground mt-0.5 h-2.5 w-2.5 opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">{sourceLabel}</p>
      </TooltipContent>
    </Tooltip>
  );
}

// ── Progress cell (replaces CellBadge) ──

function ProgressCell({ cell, t }: { cell: CellData; t: (key: string) => string }) {
  const { status, percent, progress, assignedVia } = cell;

  if (status === "not_assigned") {
    return <span className="text-muted-foreground text-[10px]">--</span>;
  }

  if (status === "waived") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className="bg-warning/15 text-warning hover:bg-warning/15 text-[10px] line-through">
            Frafalt
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">Protokollen er frafalt for denne ansatte</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (status === "completed") {
    return (
      <CellWithSource assignedVia={assignedVia}>
        <Badge className="bg-success/15 text-success hover:bg-success/15 text-[10px]">
          {t("hms.competence_matrix.status_ok")}
        </Badge>
      </CellWithSource>
    );
  }

  if (status === "expired") {
    return (
      <CellWithSource assignedVia={assignedVia}>
        <Badge className="bg-destructive/15 text-destructive hover:bg-destructive/15 text-[10px]">
          {t("hms.competence_matrix.status_expired")}
        </Badge>
      </CellWithSource>
    );
  }

  if (status === "not_started") {
    return (
      <CellWithSource assignedVia={assignedVia}>
        <Badge variant="outline" className="text-muted-foreground text-[10px]">
          Ikke startet
        </Badge>
      </CellWithSource>
    );
  }

  // in_progress or legacy pending — show mini progress bar
  const label = progress
    ? `${progress.proceduresCompleted + progress.testsPassed + progress.confirmationsSigned}/${progress.proceduresTotal + progress.testsTotal + progress.confirmationsTotal}`
    : `${percent}%`;

  return (
    <CellWithSource assignedVia={assignedVia}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex flex-col items-center gap-0.5">
            <div className="bg-muted h-1.5 w-12 overflow-hidden rounded-full">
              <div
                className="bg-primary h-full rounded-full transition-[width]"
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="text-muted-foreground text-[9px]">{label}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {progress && (
            <div className="space-y-1 text-xs">
              <p>
                Prosedyrer: {progress.proceduresCompleted}/{progress.proceduresTotal}
              </p>
              <p>
                Tester: {progress.testsPassed}/{progress.testsTotal}
              </p>
              <p>
                Bekreftelser: {progress.confirmationsSigned}/{progress.confirmationsTotal}
              </p>
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </CellWithSource>
  );
}

// ── Main component ──

export function CompetenceMatrix() {
  const { t } = useTranslation("dashboard");
  const { data, isLoading } = useCompetenceData();
  const [departmentFilter, setDepartmentFilter] = useState<string | null>(null);
  const [assignSheetOpen, setAssignSheetOpen] = useState(false);

  const departments = useMemo(() => {
    if (!data) return [];
    const set = new Set(data.rows.map((r) => r.departmentName).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [data]);

  const filteredRows = useMemo(() => {
    if (!data) return [];
    if (!departmentFilter) return data.rows;
    return data.rows.filter((r) => r.departmentName === departmentFilter);
  }, [data, departmentFilter]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!data || data.rows.length === 0) {
    return (
      <div className="border-border rounded-xl border-2 border-dashed p-8 text-center">
        <p className="text-muted-foreground text-sm">{t("hms.competence_matrix.no_data")}</p>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        {/* Header + filter */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-foreground text-lg font-bold">
              {t("hms.competence_matrix.title")}
            </h2>
            <p className="text-muted-foreground text-sm">
              {t("hms.competence_matrix.description")}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setAssignSheetOpen(true)}>
            <UserPlus className="mr-1.5 h-4 w-4" />
            Tildel protokoll
          </Button>
          {departments.length > 1 && (
            <div className="flex items-center gap-1">
              <Filter className="text-muted-foreground h-4 w-4" />
              <Button
                variant={departmentFilter === null ? "default" : "ghost"}
                size="sm"
                className="text-xs"
                onClick={() => setDepartmentFilter(null)}
              >
                {t("hms.competence_matrix.filter_all")}
              </Button>
              {departments.map((dept) => (
                <Button
                  key={dept}
                  variant={departmentFilter === dept ? "default" : "ghost"}
                  size="sm"
                  className="text-xs"
                  onClick={() => setDepartmentFilter(dept)}
                >
                  {dept}
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Matrix table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border border-b">
                <th className="text-muted-foreground px-3 py-2 text-left text-xs font-medium">
                  {t("hms.competence_matrix.employee")}
                </th>
                {data.columns.map((col) => (
                  <th
                    key={col.protocolId}
                    className="text-muted-foreground max-w-[100px] truncate px-2 py-2 text-center text-[10px] font-medium"
                    title={col.protocolName}
                  >
                    {col.protocolName}
                  </th>
                ))}
                <th className="text-muted-foreground px-3 py-2 text-center text-xs font-medium">
                  {t("hms.competence_matrix.readiness")}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr
                  key={row.profileId}
                  className="hover:bg-muted/30 border-border/50 border-b transition-colors"
                >
                  <td className="px-3 py-2">
                    <p className="text-foreground font-medium">{row.profileName}</p>
                    {row.departmentName && (
                      <p className="text-muted-foreground text-[10px]">{row.departmentName}</p>
                    )}
                  </td>
                  {data.columns.map((col) => (
                    <td key={col.protocolId} className="px-2 py-2 text-center">
                      <ProgressCell
                        cell={
                          row.protocols[col.protocolId] ?? {
                            status: "not_assigned",
                            percent: 0,
                            progress: null,
                            assignedVia: null,
                            nextReviewAt: null,
                          }
                        }
                        t={t}
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`text-sm font-bold ${
                        row.readinessPercent >= 90
                          ? "text-success"
                          : row.readinessPercent >= 60
                            ? "text-warning"
                            : "text-destructive"
                      }`}
                    >
                      {row.readinessPercent}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Assign sheet (no fixed protocol — user picks) */}
        <AssignProtocolSheet open={assignSheetOpen} onOpenChange={setAssignSheetOpen} />
      </div>
    </TooltipProvider>
  );
}
