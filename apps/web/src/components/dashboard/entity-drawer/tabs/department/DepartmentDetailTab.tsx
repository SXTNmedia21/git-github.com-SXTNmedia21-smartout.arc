"use client";

/**
 * Drawer tab showing department summary: status, manager, hours, employee count.
 * Reads from existing department queries — no new data hooks.
 */

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useTranslation } from "@smartout/i18n";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { dashboardKeys } from "@/app/dashboard/_hooks/dashboard-keys";

export function DepartmentDetailTab({ entityId }: { entityId: string }) {
  const { t } = useTranslation("dashboard");
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();

  const { data, isLoading } = useQuery({
    queryKey: dashboardKeys.drawerDepartment(wsId!, entityId),
    queryFn: async () => {
      const [deptRes, profilesRes, hoursRes] = await Promise.all([
        supabase
          .from("department")
          .select(
            "department_id, name, is_active, manager_profile_id, color, manager:profile!manager_profile_id(display_name)",
          )
          .eq("department_id", entityId)
          .single(),
        supabase
          .from("profile")
          .select("profile_id")
          .eq("workspace_id", wsId!)
          .eq("department_id", entityId)
          .eq("is_active", true),
        supabase
          .from("department_operating_hours")
          .select("day_of_week, open_time, close_time, is_closed")
          .eq("department_id", entityId),
      ]);

      const manager = deptRes.data?.manager as { display_name: string } | null;

      return {
        department: deptRes.data,
        employeeCount: profilesRes.data?.length ?? 0,
        hours: hoursRes.data ?? [],
        managerName: manager?.display_name ?? null,
      };
    },
    enabled: !!wsId && !!entityId,
    staleTime: 30_000,
  });

  if (isLoading || !data?.department) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-white/30" />
      </div>
    );
  }

  const dept = data.department;
  const weekdayHours = data.hours.find((h) => h.day_of_week === 1 && !h.is_closed);

  return (
    <div className="space-y-4 p-4">
      {/* Status */}
      <div>
        <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-white/30">
          {t("entity_drawer.department_status")}
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
            dept.is_active
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-white/[0.06] text-white/40"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${dept.is_active ? "bg-emerald-500" : "bg-white/30"}`}
          />
          {dept.is_active ? t("entity_drawer.active") : t("entity_drawer.inactive")}
        </span>
      </div>

      {/* Manager */}
      {data.managerName && (
        <div>
          <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-white/30">
            {t("entity_drawer.department_manager")}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.08] text-[9px] font-bold text-white/60">
              {data.managerName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)}
            </div>
            <span className="text-[13px] text-white/80">{data.managerName}</span>
          </div>
        </div>
      )}

      {/* Hours */}
      {weekdayHours && (
        <div>
          <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-white/30">
            {t("entity_drawer.department_hours")}
          </div>
          <span className="font-mono text-[13px] text-white/80">
            {weekdayHours.open_time?.substring(0, 5)} – {weekdayHours.close_time?.substring(0, 5)}
          </span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-[10px] border border-white/[0.07] bg-white/[0.03] p-3">
          <div className="font-mono text-lg font-bold text-white">{data.employeeCount}</div>
          <div className="text-[10px] text-white/30">{t("entity_drawer.department_employees")}</div>
        </div>
        <div className="rounded-[10px] border border-white/[0.07] bg-white/[0.03] p-3">
          <div className="font-mono text-lg font-bold text-white" style={{ color: dept.color ?? undefined }}>
            {dept.name.charAt(0)}
          </div>
          <div className="text-[10px] text-white/30">{dept.name}</div>
        </div>
      </div>
    </div>
  );
}
