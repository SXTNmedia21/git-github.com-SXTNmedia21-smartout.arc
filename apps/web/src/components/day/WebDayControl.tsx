"use client";

import { useContext, useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Home,
  MessageSquare,
  ShieldCheck,
  Users,
} from "lucide-react";
import { cn } from "@smartout/ui";
import { derivePhase, type UiPhase } from "@smartout/utils";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { useCurrentDepartment } from "@/app/dashboard/_hooks/use-current-department";
import {
  useDepartmentSessions,
  type DepartmentSessionRow,
} from "@/app/dashboard/hms/_hooks/use-department-sessions";
import { pinDayControlContext } from "@/app/dashboard/_lib/pin-day-control-context";
import { SessionHeader } from "./widgets";
import { OverviewTab } from "./tabs/OverviewTab";
import { TimelineTab } from "./tabs/TimelineTab";
import { RosterTab } from "./tabs/RosterTab";
import { TasksTab } from "./tabs/TasksTab";
import { DeviationsTab } from "./tabs/DeviationsTab";
import { BroadcastTab } from "./tabs/BroadcastTab";
import { SignoffTab } from "./tabs/SignoffTab";

const TAB_DEFS = [
  { key: "overview", label: "Oversikt", Icon: Home },
  { key: "timeline", label: "Dagslinjen", Icon: Clock },
  { key: "roster", label: "Bemanning", Icon: Users },
  { key: "tasks", label: "Oppgaver", Icon: CheckCircle2 },
  { key: "deviations", label: "Avvik", Icon: AlertTriangle },
  { key: "broadcast", label: "Melding", Icon: MessageSquare },
  { key: "signoff", label: "Oppgjør", Icon: ShieldCheck },
] as const;

export type TabKey = (typeof TAB_DEFS)[number]["key"];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const NORWEGIAN_DAYS = ["Søndag", "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag"];
const NORWEGIAN_MONTHS = [
  "januar",
  "februar",
  "mars",
  "april",
  "mai",
  "juni",
  "juli",
  "august",
  "september",
  "oktober",
  "november",
  "desember",
];

function formatDateLabels(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return {
    dayLong: NORWEGIAN_DAYS[d.getDay()] ?? "",
    dayNum: String(d.getDate()),
    month: NORWEGIAN_MONTHS[d.getMonth()] ?? "",
  };
}

function getElapsedText(phase: UiPhase, session: DepartmentSessionRow | null): string | undefined {
  if (!session) return undefined;
  if (phase === "active" && session.openedAt) {
    return `Åpnet ${new Date(session.openedAt).toTimeString().slice(0, 5)}`;
  }
  if (phase === "upcoming") return "Starter snart";
  if (phase === "pending_signoff") return "Venter på signering";
  if (phase === "closed" || phase === "locked") return "Stengt";
  if (phase === "missed") return "Grace overskredet";
  return undefined;
}

export function WebDayControl({ initialTab = "overview" }: { initialTab?: TabKey }) {
  const [tab, setTab] = useState<TabKey>(initialTab);
  const ctx = useContext(DashboardContext);
  const wsCtx = useWorkspaceOptional();
  const profileId = ctx.profileId;
  const workspaceId = wsCtx?.workspace.workspace_id ?? null;

  const dateISO = today();
  const dateLabels = formatDateLabels(dateISO);

  const deptQuery = useCurrentDepartment(profileId);
  const sessionsQuery = useDepartmentSessions(dateISO);

  const currentDept = deptQuery.data;
  const session =
    currentDept && sessionsQuery.data
      ? (sessionsQuery.data.find((s) => s.departmentId === currentDept.departmentId) ?? null)
      : null;

  // Derive phase — `locked` resolution depends on daily_reconciliation, wired in PR 3.
  const phase: UiPhase = session ? derivePhase({ status: session.status }) : "upcoming";

  // Pin session context for Botsson — no-op stub in PR 2, real impl in PR 3.
  useEffect(() => {
    if (session && currentDept && profileId && workspaceId) {
      void pinDayControlContext({
        sessionId: session.sessionId,
        departmentName: currentDept.departmentName,
        date: dateISO,
        profileId,
        workspaceId,
      });
    }
  }, [session, currentDept, profileId, workspaceId, dateISO]);

  if (deptQuery.isLoading || sessionsQuery.isLoading) {
    return <LoadingState />;
  }
  if (!currentDept) {
    return <NoDepartmentState />;
  }
  if (!session) {
    return <NoSessionState departmentName={currentDept.departmentName} />;
  }

  const headerSession = {
    id: session.sessionId,
    dateISO,
    dayLong: dateLabels.dayLong,
    dayNum: dateLabels.dayNum,
    month: dateLabels.month,
    relativeLabel: "I dag",
    departmentName: currentDept.departmentName,
    departmentKey: "kitchen" as const, // TODO(live-data): PR 3 — resolve from department metadata
    location: wsCtx?.workspace.name ?? "",
    plannedOpen: session.plannedOpen ?? "—",
    plannedClose: session.plannedClose ?? "—",
    openedAt: session.openedAt,
    closedAt: session.closedAt,
    tasksTotal: session.tasksTotal,
    tasksCompleted: session.tasksCompleted,
  };

  return (
    <div className="bg-muted/30 relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      {/* Session header */}
      <div className="border-border bg-background border-b px-7 pt-5 pb-4">
        <SessionHeader
          session={headerSession}
          phase={phase}
          variant="inline"
          elapsedText={getElapsedText(phase, session)}
        />
      </div>

      {/* Sub-nav */}
      <div
        className="border-border bg-background border-b px-7"
        role="tablist"
        aria-label="Dag-informasjon seksjoner"
      >
        <div className="flex gap-0.5">
          {TAB_DEFS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={`tab-panel-${t.key}`}
                onClick={() => setTab(t.key)}
                className={cn(
                  "focus-visible:ring-brand-orange -mb-px flex items-center gap-[7px] border-b-2 bg-transparent px-4 py-2.5 text-[13px] font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
                  active
                    ? "border-brand-orange text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground border-transparent",
                )}
              >
                <t.Icon
                  className={cn(
                    "h-3.5 w-3.5",
                    active ? "text-brand-orange" : "text-muted-foreground",
                  )}
                  aria-hidden
                />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div
        id={`tab-panel-${tab}`}
        role="tabpanel"
        className="scrollbar-thin flex-1 overflow-y-auto p-7"
      >
        {tab === "overview" && (
          <OverviewTab session={session} phase={phase} departmentId={currentDept.departmentId} />
        )}
        {tab === "timeline" && <TimelineTab session={session} phase={phase} />}
        {tab === "roster" && (
          <RosterTab departmentId={currentDept.departmentId} dateISO={dateISO} />
        )}
        {tab === "tasks" && <TasksTab session={session} />}
        {tab === "deviations" && <DeviationsTab sessionId={session.sessionId} />}
        {tab === "broadcast" && (
          <BroadcastTab sessionId={session.sessionId} departmentId={currentDept.departmentId} />
        )}
        {tab === "signoff" && <SignoffTab session={session} phase={phase} />}
      </div>
    </div>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background flex h-full min-h-0 flex-1 items-center justify-center px-8">
      {children}
    </div>
  );
}

function LoadingState() {
  return (
    <Shell>
      <div className="text-muted-foreground text-[13px]">Laster dag-informasjon…</div>
    </Shell>
  );
}

function NoDepartmentState() {
  return (
    <Shell>
      <div className="max-w-sm text-center">
        <h2 className="font-heading text-[22px] tracking-[-0.01em]">Ingen avdeling knyttet</h2>
        <p className="text-muted-foreground mt-2 text-[13px] leading-[1.5]">
          Du har ingen avdeling registrert på profilen din, og arbeidsrommet har ingen avdelinger
          satt opp. Kontakt admin for å få tildelt en avdeling.
        </p>
      </div>
    </Shell>
  );
}

function NoSessionState({ departmentName }: { departmentName: string }) {
  return (
    <Shell>
      <div className="max-w-md text-center">
        <h2 className="font-heading text-[22px] tracking-[-0.01em]">
          Ingen sesjon registrert for i dag
        </h2>
        <p className="text-muted-foreground mt-2 text-[13px] leading-[1.5]">
          {departmentName} har ingen{" "}
          <code className="text-foreground font-mono">department_session</code> for dagens dato.
          Venter på at åpningsrutinen oppretter sesjonen via lifecycle-jobben.
        </p>
      </div>
    </Shell>
  );
}

export default WebDayControl;
