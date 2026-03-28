"use client";

/**
 * Drawer tab showing shift details: status, time, position, assigned employee.
 * Read-only — no mutations.
 */

import { Clock } from "lucide-react";
import { useTranslation } from "@smartout/i18n";
import { useDrawerShift } from "@/app/dashboard/_hooks/use-drawer-shift";
import { DrawerSection } from "../../shared/DrawerSection";
import { DrawerSkeleton } from "../../shared/DrawerSkeleton";
import { DrawerEmptyState } from "../../shared/DrawerEmptyState";

const statusColors: Record<string, string> = {
  created: "bg-muted text-muted-foreground",
  assigned: "bg-blue-500/10 text-blue-400",
  published: "bg-emerald-500/10 text-emerald-400",
  active: "bg-amber-500/10 text-amber-400",
  completed: "bg-muted text-muted-foreground",
  unpublished: "bg-destructive/10 text-destructive",
};

export function ShiftDetailTab({ entityId }: { entityId: string }) {
  const { t } = useTranslation("dashboard");
  const { data: shift, isLoading } = useDrawerShift(entityId);

  if (isLoading) return <DrawerSkeleton />;
  if (!shift) return <DrawerEmptyState icon={Clock} message={t("entity_drawer.shift_not_found")} />;

  const employee = shift.employee as { display_name: string } | null;
  const department = shift.department as { name: string } | null;

  return (
    <div className="space-y-4 p-4">
      <DrawerSection label={t("entity_drawer.shift_status")}>
        <span
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold ${statusColors[shift.status] ?? "bg-muted text-muted-foreground"}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${shift.status === "active" ? "bg-amber-500" : shift.status === "published" ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
          />
          {shift.status}
        </span>
      </DrawerSection>

      <DrawerSection label={t("entity_drawer.shift_time")}>
        <span className="font-mono text-[13px] text-foreground">
          {shift.start_time?.substring(0, 5)} – {shift.end_time?.substring(0, 5)}
        </span>
        <span className="text-muted-foreground ml-2 text-xs">
          ({shift.work_hours}h)
        </span>
      </DrawerSection>

      {employee && (
        <DrawerSection label={t("entity_drawer.shift_assigned")}>
          <div className="flex items-center gap-2">
            <div className="bg-muted flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold">
              {employee.display_name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)}
            </div>
            <span className="text-foreground text-[13px]">{employee.display_name}</span>
          </div>
        </DrawerSection>
      )}

      {department && (
        <DrawerSection label={t("entity_drawer.shift_department")}>
          <span className="text-foreground text-[13px]">{department.name}</span>
        </DrawerSection>
      )}

      <DrawerSection label={t("entity_drawer.shift_position")}>
        <span className="text-foreground text-[13px]">{shift.role}</span>
      </DrawerSection>
    </div>
  );
}
