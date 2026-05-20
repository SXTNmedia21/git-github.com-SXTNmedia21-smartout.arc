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
  useEntityDrawerOptional,
  type EntityType,
} from "@/components/dashboard/entity-drawer/EntityDrawerContext";
import { useTranslation } from "@smartout/i18n";
import { resolveKey, interpolateParams } from "@/app/dashboard/_components/todo/translate-todo";
import { MustDoCard, type MustDoItem } from "@/components/day/MustDoCard";
import { KpiAccentTile } from "@smartout/ui";

const DASH = "—";
const NOK = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 });
function formatNok(n: number): string {
  return NOK.format(Math.round(n));
}

type OverviewNavKey = "overview" | "timeline" | "roster" | "tasks" | "deviations" | "broadcast";

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

  return (
    <div className="h-full min-h-0 overflow-hidden">
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

        {/* Må gjøre nå — full width below KPI strip (Aktivitetslogg + right sidebar removed). */}
        <div className="min-h-0 flex-1">
          <MustDoCard items={mustDoItems} />
        </div>
      </div>
    </div>
  );
}
