"use client";

import { useMemo } from "react";
import { Users, CheckCircle2, AlertTriangle, Clock3, Wallet, Banknote } from "lucide-react";
import type { UiPhase } from "@smartout/utils";
import type { DepartmentSessionRow } from "@/app/dashboard/hms/_hooks/use-department-sessions";
import { useRouter } from "next/navigation";
import { useDeviations } from "@/app/dashboard/hms/_hooks/use-deviations";
import { useRoster } from "@/app/dashboard/_hooks/use-roster";
import { useShiftDayStats } from "@/app/dashboard/_hooks/use-shift-day-stats";
import { useDayBudget } from "@/app/dashboard/_hooks/use-day-budget";
import { useSessionHooksWithTasks } from "@/app/dashboard/_hooks/use-session-hooks-with-tasks";
import { useCascadeTasks } from "@/app/dashboard/_hooks/use-cascade-tasks";
import {
  useDayTimelineEvents,
  type DayEvent,
} from "@/app/dashboard/_hooks/use-day-timeline-events";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import {
  useEntityDrawerOptional,
  type EntityType,
} from "@/components/dashboard/entity-drawer/EntityDrawerContext";
import { useTranslation } from "@smartout/i18n";
import { resolveKey, interpolateParams } from "@/app/dashboard/_components/todo/translate-todo";
import { DayActivityLog } from "@/components/day/DayActivityLog";
import { MustDoCard, type MustDoItem } from "@/components/day/MustDoCard";
import { KpiAccentTile, DeviationCard, type DayDeviation } from "@smartout/ui";

const DASH = "—";
const NOK = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 });
function formatNok(n: number): string {
  return NOK.format(Math.round(n));
}

type OverviewNavKey = "overview" | "timeline" | "roster" | "tasks" | "deviations" | "broadcast";

const TYPE_TO_TAB: Record<DayEvent["type"], OverviewNavKey> = {
  booking: "timeline",
  note: "timeline",
  task: "tasks",
  deviation: "deviations",
  checkin: "roster",
  checkout: "roster",
};

export function OverviewTab({
  session,
  phase,
  departmentId,
  dateISO,
  onNavigate,
}: {
  session: DepartmentSessionRow;
  phase: UiPhase;
  departmentId: string;
  dateISO: string;
  onNavigate?: (tab: OverviewNavKey) => void;
}) {
  void phase;
  const wsCtx = useWorkspaceOptional();
  const router = useRouter();
  const drawer = useEntityDrawerOptional();
  const { t } = useTranslation("dashboard");
  const openDevs = useDeviations({ status: ["open", "acknowledged"] });
  const escalatedDevs = useDeviations({ status: ["escalated"] });
  const hooksQuery = useSessionHooksWithTasks(session.sessionId);
  const roster = useRoster(departmentId, dateISO);
  const shiftStats = useShiftDayStats(dateISO);
  const budget = useDayBudget(departmentId, dateISO);
  const cascadeTasks = useCascadeTasks();
  const timelineEvents = useDayTimelineEvents({
    workspaceId: wsCtx?.workspace.workspace_id ?? null,
    departmentId,
    sessionId: session.sessionId,
    dateISO,
  });

  const rosterStats = useMemo(() => {
    if (shiftStats.data) return shiftStats.data;
    const rows = roster.data ?? [];
    return {
      total: rows.length,
      onShift: rows.filter((r) => r.status === "active").length,
      coming: rows.filter((r) => r.status === "upcoming").length,
      done: rows.filter((r) => r.status === "completed").length,
      plannedHours: rows.reduce((sum, r) => sum + (r.plannedHours || 0), 0),
    };
  }, [shiftStats.data, roster.data]);

  const taskStats = useMemo(() => {
    const allTasks = (hooksQuery.data ?? []).flatMap((h) => h.tasks);
    const done = allTasks.filter((t) => t.done).length;
    const active = allTasks.filter((t) => !t.done && t.active).length;
    return {
      total: allTasks.length || session.tasksTotal,
      done: done || session.tasksCompleted,
      active,
    };
  }, [hooksQuery.data, session.tasksTotal, session.tasksCompleted]);

  const deviationStats = useMemo(() => {
    const all = openDevs.data ?? [];
    return {
      open: all.filter((d) => d.status === "open").length,
      escalated: (escalatedDevs.data ?? []).length,
    };
  }, [openDevs.data, escalatedDevs.data]);

  // MustDo aggregator — cascade tasks (D1–D6 / C1–C4) marked critical/should.
  const mustDoItems: MustDoItem[] = useMemo(() => {
    const groups = cascadeTasks.data?.groups ?? [];
    const out: MustDoItem[] = [];
    const drawerable: ReadonlySet<string> = new Set([
      "department",
      "profile",
      "team",
      "shift",
      "department_session",
      "shift_template",
      "cascade_task",
    ]);
    for (const g of groups) {
      for (const task of g.tasks) {
        if (task.urgency !== "critical" && task.urgency !== "should") continue;
        const title = interpolateParams(t(resolveKey(task.title_key)), task.title_params);
        const desc = interpolateParams(
          t(resolveKey(task.description_key)),
          task.description_params,
        );
        out.push({
          id: task.id,
          title,
          subtitle: `${task.dimension} · ${desc}`,
          icon: AlertTriangle,
          onAction: () => {
            // Prefer drawer when entity is drawerable; else open cascade_task tab.
            if (drawer) {
              if (task.entity_type && task.entity_id && drawerable.has(task.entity_type)) {
                drawer.openDrawer(task.entity_type as EntityType, task.entity_id);
                return;
              }
              drawer.openDrawer("cascade_task", task.id);
              return;
            }
            if (task.href) router.push(task.href);
          },
        });
      }
    }
    out.sort((a, b) => a.id.localeCompare(b.id));
    return out;
  }, [cascadeTasks.data, t, router, drawer]);

  const sidebarDeviations: DayDeviation[] = useMemo(
    () =>
      (openDevs.data ?? []).slice(0, 4).map((d) => ({
        id: d.deviationId,
        severity: d.severity,
        status: d.status,
        type: d.domain ?? "Avvik",
        title: d.title,
        desc: d.description ?? "",
        reporter: d.reporterName ?? "—",
        time: d.createdAt ? new Date(d.createdAt).toTimeString().slice(0, 5) : "",
        photos: Array.isArray(d.attachments) ? d.attachments.length : 0,
        assignedTo: null,
      })),
    [openDevs.data],
  );

  function handleActivityClick(e: DayEvent) {
    if (drawer) {
      if (e.type === "checkin" || e.type === "checkout") {
        drawer.openDrawer("shift", e.refId);
        return;
      }
      if (e.type === "task") {
        drawer.openDrawer("cascade_task", e.refId);
        return;
      }
      if (e.type === "deviation") {
        drawer.openDrawer("deviation", e.refId);
        return;
      }
    }
    onNavigate?.(TYPE_TO_TAB[e.type]);
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-5 overflow-hidden lg:grid-cols-[1fr_340px]">
      <div className="flex min-h-0 flex-col gap-5 overflow-hidden">
        {/* KPI Strip */}
        <div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <KpiAccentTile
            title="På vakt"
            icon={Users}
            accent="emerald"
            primary={{ label: "På vakt nå", value: rosterStats.onShift }}
            secondary={{ label: "Kommer i dag", value: rosterStats.coming }}
            onClick={onNavigate ? () => onNavigate("roster") : undefined}
          />
          <KpiAccentTile
            title="Oppgaver"
            icon={CheckCircle2}
            accent="blue"
            primary={{
              label: "Ferdige",
              value: `${taskStats.done}`,
              unit: `/ ${taskStats.total}`,
            }}
            secondary={{ label: "Pågår", value: taskStats.active }}
            onClick={onNavigate ? () => onNavigate("tasks") : undefined}
          />
          <KpiAccentTile
            title="Avvik"
            icon={AlertTriangle}
            accent={deviationStats.escalated > 0 ? "rose" : "orange"}
            primary={{ label: "Åpne", value: deviationStats.open }}
            secondary={{ label: "Eskalerte", value: deviationStats.escalated }}
            onClick={onNavigate ? () => onNavigate("deviations") : undefined}
          />
          <KpiAccentTile
            title="Arbeidstid"
            icon={Clock3}
            accent="purple"
            primary={{
              label: "Forventet",
              value: rosterStats.plannedHours > 0 ? rosterStats.plannedHours.toFixed(1) : DASH,
              unit: "t",
            }}
            secondary={{
              label: "Planert",
              value: budget.data?.laborHours != null ? budget.data.laborHours.toFixed(1) : DASH,
              unit: "t",
            }}
            onClick={onNavigate ? () => onNavigate("roster") : undefined}
          />
          <KpiAccentTile
            title="Lønn"
            icon={Wallet}
            accent="emerald"
            primary={{ label: "Forventet", value: DASH, unit: "kr" }}
            secondary={{
              label: "Budsjettert",
              value: budget.data?.laborCost != null ? formatNok(budget.data.laborCost) : DASH,
              unit: "kr",
            }}
            onClick={onNavigate ? () => onNavigate("roster") : undefined}
          />
          <KpiAccentTile
            title="Omsetning"
            icon={Banknote}
            accent="amber"
            primary={{
              label: "Budsjettert",
              value: budget.data?.revenue != null ? formatNok(budget.data.revenue) : DASH,
              unit: "kr",
            }}
            secondary={{ label: "Faktisk", value: DASH, unit: "kr" }}
          />
        </div>

        {/* 2-col under KPI: ActivityLog | MustDoCard. Cards fill remaining
            height; inner lists scroll internally. */}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
          <DayActivityLog events={timelineEvents.data ?? []} onSelect={handleActivityClick} />
          <MustDoCard items={mustDoItems} />
        </div>
      </div>

      {/* Right sidebar — avvik list + siste meldinger */}
      <aside className="scrollbar-thin grid content-start gap-3.5 overflow-y-auto pr-1">
        <div className="text-muted-foreground text-[10px] font-bold tracking-[0.14em] uppercase">
          Aktive avvik
        </div>
        {sidebarDeviations.length > 0 ? (
          sidebarDeviations.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => drawer?.openDrawer("deviation", d.id)}
              className="focus-visible:ring-ring rounded-2xl text-left focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <DeviationCard deviation={d} variant="compact" />
            </button>
          ))
        ) : (
          <div className="bg-card border-border text-muted-foreground rounded-2xl border p-4 text-[12px] shadow-sm">
            Ingen åpne avvik akkurat nå.
          </div>
        )}
        <div className="bg-card border-border relative overflow-hidden rounded-2xl border p-4 shadow-sm">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-10 -right-10 h-24 w-24 rounded-full bg-blue-500/10 blur-3xl"
          />
          <div className="relative z-10">
            <div className="text-muted-foreground mb-2.5 text-[11px] font-bold tracking-[0.14em] uppercase">
              Siste meldinger
            </div>
            <div className="text-muted-foreground text-[12px]">
              Wires til komm &ldquo;news&rdquo;-kanal i PR 3.
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
