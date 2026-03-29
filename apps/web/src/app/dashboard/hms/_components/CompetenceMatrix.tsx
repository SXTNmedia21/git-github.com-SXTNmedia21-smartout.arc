"use client";

import { useContext, useMemo, useState } from "react";
import { Loader2, Filter } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@smartout/i18n";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useWorkspace } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type MatrixRow = {
  profileId: string;
  profileName: string;
  departmentName: string | null;
  protocols: Record<
    string,
    { status: "completed" | "pending" | "expired" | "not_assigned"; percent: number }
  >;
  readinessPercent: number;
};

type ProtocolColumn = {
  protocolId: string;
  protocolName: string;
};

function useCompetenceData() {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: ["hms", "competence-matrix", workspace.workspace_id],
    staleTime: 3 * 60 * 1000,
    queryFn: async (): Promise<{ rows: MatrixRow[]; columns: ProtocolColumn[] }> => {
      const supabase = createClient();

      const [profilesRes, protocolsRes, assignmentsRes] = await Promise.all([
        supabase
          .from("profile")
          .select("profile_id, display_name, department:department_id(name)")
          .eq("workspace_id", workspace.workspace_id)
          .in("profile_status", ["active", "trainee"])
          .order("display_name"),
        supabase
          .from("protocol")
          .select("protocol_id, name")
          .eq("workspace_id", workspace.workspace_id)
          .eq("status", "active")
          .order("name"),
        supabase
          .from("protocol_assignment")
          .select("profile_id, protocol_id, status")
          .eq("workspace_id", workspace.workspace_id),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (protocolsRes.error) throw protocolsRes.error;
      if (assignmentsRes.error) throw assignmentsRes.error;

      const columns: ProtocolColumn[] = (protocolsRes.data ?? []).map((p) => ({
        protocolId: p.protocol_id,
        protocolName: p.name,
      }));

      // Build assignment lookup: profileId -> protocolId -> status
      const assignmentMap = new Map<string, Map<string, string>>();
      for (const a of assignmentsRes.data ?? []) {
        if (!assignmentMap.has(a.profile_id)) assignmentMap.set(a.profile_id, new Map());
        assignmentMap.get(a.profile_id)!.set(a.protocol_id, a.status);
      }

      const rows: MatrixRow[] = (profilesRes.data ?? []).map((profile) => {
        const dept = profile.department as unknown as { name: string } | null;
        const assignments = assignmentMap.get(profile.profile_id) ?? new Map();

        const protocols: MatrixRow["protocols"] = {};
        let completed = 0;
        let total = 0;

        for (const col of columns) {
          const status = assignments.get(col.protocolId);
          if (status) {
            total++;
            if (status === "completed") completed++;
            protocols[col.protocolId] = {
              status: status as "completed" | "pending" | "expired",
              percent: status === "completed" ? 100 : 0,
            };
          } else {
            protocols[col.protocolId] = { status: "not_assigned", percent: 0 };
          }
        }

        return {
          profileId: profile.profile_id,
          profileName: profile.display_name ?? "Ukjent",
          departmentName: dept?.name ?? null,
          protocols,
          readinessPercent: total > 0 ? Math.round((completed / total) * 100) : 0,
        };
      });

      return { rows, columns };
    },
  });
}

function CellBadge({
  status,
  t,
}: {
  status: "completed" | "pending" | "expired" | "not_assigned";
  t: (key: string) => string;
}) {
  switch (status) {
    case "completed":
      return (
        <Badge className="bg-green-500/15 text-[10px] text-green-600 hover:bg-green-500/15">
          {t("hms.competence_matrix.status_ok")}
        </Badge>
      );
    case "pending":
      return (
        <Badge variant="outline" className="text-[10px]">
          {t("hms.competence_matrix.status_pending")}
        </Badge>
      );
    case "expired":
      return (
        <Badge className="bg-red-500/15 text-[10px] text-red-600 hover:bg-red-500/15">
          {t("hms.competence_matrix.status_expired")}
        </Badge>
      );
    case "not_assigned":
      return <span className="text-muted-foreground text-[10px]">--</span>;
  }
}

export function CompetenceMatrix() {
  const { t } = useTranslation("dashboard");
  const { isDark } = useContext(DashboardContext);
  const { data, isLoading } = useCompetenceData();
  const [departmentFilter, setDepartmentFilter] = useState<string | null>(null);

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
    <div className="space-y-4">
      {/* Header + filter */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-foreground text-lg font-bold">{t("hms.competence_matrix.title")}</h2>
          <p className="text-muted-foreground text-sm">{t("hms.competence_matrix.description")}</p>
        </div>
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
            <tr className={`border-b ${isDark ? "border-zinc-800" : "border-border"}`}>
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
                className={`hover:bg-muted/30 border-b transition-colors ${isDark ? "border-zinc-800/50" : "border-border/50"}`}
              >
                <td className="px-3 py-2">
                  <p className="text-foreground font-medium">{row.profileName}</p>
                  {row.departmentName && (
                    <p className="text-muted-foreground text-[10px]">{row.departmentName}</p>
                  )}
                </td>
                {data.columns.map((col) => (
                  <td key={col.protocolId} className="px-2 py-2 text-center">
                    <CellBadge
                      status={row.protocols[col.protocolId]?.status ?? "not_assigned"}
                      t={t}
                    />
                  </td>
                ))}
                <td className="px-3 py-2 text-center">
                  <span
                    className={`text-sm font-bold ${
                      row.readinessPercent >= 90
                        ? "text-green-600"
                        : row.readinessPercent >= 60
                          ? "text-yellow-600"
                          : "text-red-600"
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
    </div>
  );
}
