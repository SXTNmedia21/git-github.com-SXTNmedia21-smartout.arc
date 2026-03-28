"use client";

/**
 * Drawer tab showing department session summary: status, tasks, shifts.
 * Read-only summary only — deep editing goes to DayControlSheet.
 */

import { CalendarCheck } from "lucide-react";
import { useTranslation } from "@smartout/i18n";
import { useDrawerSession } from "@/app/dashboard/_hooks/use-drawer-session";
import { DrawerSection } from "../../shared/DrawerSection";
import { DrawerSkeleton } from "../../shared/DrawerSkeleton";
import { DrawerEmptyState } from "../../shared/DrawerEmptyState";

const statusColors: Record<string, string> = {
  upcoming: "bg-blue-500/10 text-blue-400",
  active: "bg-emerald-500/10 text-emerald-400",
  pending_signoff: "bg-amber-500/10 text-amber-400",
  closed: "bg-muted text-muted-foreground",
  missed: "bg-destructive/10 text-destructive",
};

export function SessionSummaryTab({ entityId }: { entityId: string }) {
  const { t } = useTranslation("dashboard");
  const { data: session, isLoading } = useDrawerSession(entityId);

  if (isLoading) return <DrawerSkeleton />;
  if (!session) return <DrawerEmptyState icon={CalendarCheck} message={t("entity_drawer.session_not_found")} />;

  const department = session.department as { name: string } | null;

  return (
    <div className="space-y-4 p-4">
      <DrawerSection label={t("entity_drawer.session_status")}>
        <span
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold ${statusColors[session.status] ?? "bg-muted text-muted-foreground"}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${session.status === "active" ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
          />
          {session.status}
        </span>
      </DrawerSection>

      <DrawerSection label={t("entity_drawer.session_date")}>
        <span className="font-mono text-[13px] text-foreground">{session.session_date}</span>
        {department && (
          <span className="text-muted-foreground ml-2 text-xs">({department.name})</span>
        )}
      </DrawerSection>

      {session.planned_open && session.planned_close && (
        <DrawerSection label={t("entity_drawer.shift_time")}>
          <span className="font-mono text-[13px] text-foreground">
            {session.planned_open.substring(0, 5)} – {session.planned_close.substring(0, 5)}
          </span>
        </DrawerSection>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-[10px] border border-border bg-muted/30 p-3">
          <div className="font-mono text-lg font-bold text-foreground">
            {session.tasks_completed ?? 0}/{session.tasks_total ?? 0}
          </div>
          <div className="text-muted-foreground text-[10px]">{t("entity_drawer.session_tasks")}</div>
        </div>
        <div className="rounded-[10px] border border-border bg-muted/30 p-3">
          <div className="font-mono text-lg font-bold text-foreground">
            {session.actual_shifts ?? 0}/{session.planned_shifts ?? 0}
          </div>
          <div className="text-muted-foreground text-[10px]">{t("entity_drawer.session_shifts")}</div>
        </div>
      </div>
    </div>
  );
}
