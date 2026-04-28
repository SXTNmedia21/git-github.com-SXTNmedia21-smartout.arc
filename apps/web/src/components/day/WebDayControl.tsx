"use client";

import { useContext, useEffect, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { motion as motionTokens } from "@smartout/design-tokens";
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
import { useDailyReconciliation } from "@/app/dashboard/_hooks/use-daily-reconciliation";
import {
  useDepartmentSessions,
  type DepartmentSessionRow,
} from "@/app/dashboard/hms/_hooks/use-department-sessions";
import { pinDayControlContextAction } from "@/app/dashboard/_actions/pin-day-control-context";
import { resolveDeptKey } from "./dept-key";
import { SessionHeader } from "@smartout/ui";
import { OverviewTab } from "./tabs/OverviewTab";
import { TimelineTab } from "./tabs/TimelineTab";
import { RosterTab } from "./tabs/RosterTab";
import { TasksTab } from "./tabs/TasksTab";
import { DeviationsTab } from "./tabs/DeviationsTab";
import { BroadcastTab } from "./tabs/BroadcastTab";
import { SignoffTab } from "./tabs/SignoffTab";
import { DateNavigator } from "./DateNavigator";
import { NoSessionCTA } from "./NoSessionCTA";
import { SessionActionsBar } from "./SessionActionsBar";

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
  const reduceMotion = useReducedMotion();

  const [dateISO, setDateISO] = useState<string>(today());
  const dateLabels = formatDateLabels(dateISO);

  const deptQuery = useCurrentDepartment(profileId);
  const sessionsQuery = useDepartmentSessions(dateISO);

  const currentDept = deptQuery.data;
  const session =
    currentDept && sessionsQuery.data
      ? (sessionsQuery.data.find((s) => s.departmentId === currentDept.departmentId) ?? null)
      : null;

  // Reconciliation feeds `locked` derivation (L-0064): `locked` = `closed`
  // session + `reconciliation.status = 'locked'`. Null recon = "not locked".
  const reconQuery = useDailyReconciliation(currentDept?.departmentId ?? null, dateISO);
  const phase: UiPhase = session
    ? derivePhase({ status: session.status }, reconQuery.data ?? null)
    : "upcoming";

  // Pin session context for Botsson via engine_memory (24h TTL). Profile +
  // workspace are re-derived server-side inside the action per ADR-0151.
  useEffect(() => {
    if (session && currentDept) {
      void pinDayControlContextAction({
        sessionId: session.sessionId,
        departmentName: currentDept.departmentName,
        date: dateISO,
      });
    }
  }, [session, currentDept, dateISO]);

  // Determine which top-level state to render. Outer shell + orb stay mounted
  // across all four states so the transition is content-only — no flash of
  // empty container between skeleton and ready content.
  const isInitialLoading = deptQuery.isLoading || sessionsQuery.isLoading;
  const stateKey: "loading" | "no-dept" | "no-session" | "ready" = isInitialLoading
    ? "loading"
    : !currentDept
      ? "no-dept"
      : !session
        ? "no-session"
        : "ready";

  const headerSession =
    currentDept && session
      ? {
          id: session.sessionId,
          dateISO,
          dayLong: dateLabels.dayLong,
          dayNum: dateLabels.dayNum,
          month: dateLabels.month,
          relativeLabel: "I dag",
          departmentName: currentDept.departmentName,
          departmentKey: resolveDeptKey(currentDept.departmentName),
          location: wsCtx?.workspace.name ?? "",
          plannedOpen: session.plannedOpen ?? "—",
          plannedClose: session.plannedClose ?? "—",
          openedAt: session.openedAt,
          closedAt: session.closedAt,
          tasksTotal: session.tasksTotal,
          tasksCompleted: session.tasksCompleted,
        }
      : null;

  const orbBackground =
    phase === "active"
      ? "radial-gradient(circle at 50% 50%, color-mix(in oklch, var(--brand-orange) 18%, transparent) 0%, transparent 65%)"
      : phase === "pending_signoff"
        ? "radial-gradient(circle at 50% 50%, color-mix(in oklch, var(--warning) 16%, transparent) 0%, transparent 65%)"
        : "radial-gradient(circle at 50% 50%, color-mix(in oklch, var(--brand-orange) 8%, transparent) 0%, transparent 65%)";

  const fade = reduceMotion
    ? {
        initial: false as const,
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: motionTokens.exitMs / 2000 },
      }
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: {
          duration: motionTokens.exitMs / 1000,
          ease: motionTokens.easingArray,
        },
      };

  return (
    <div className="bg-muted/30 relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      {/* Ambient orb — phase-reactive hue with smooth crossfade across states */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-56 -bottom-64 h-[720px] w-[720px] transition-[background] duration-500"
        style={{ background: orbBackground }}
      />

      <AnimatePresence mode="wait">
        {stateKey === "loading" && (
          <motion.div
            key="loading"
            {...fade}
            className="relative z-[1] flex h-full min-h-0 flex-1 flex-col"
          >
            <SkeletonContent />
          </motion.div>
        )}

        {stateKey === "no-dept" && (
          <motion.div
            key="no-dept"
            {...fade}
            className="relative z-[1] flex h-full min-h-0 flex-1 items-center justify-center px-8"
          >
            <NoDepartmentInner />
          </motion.div>
        )}

        {stateKey === "no-session" && currentDept && (
          <motion.div
            key="no-session"
            {...fade}
            className="relative z-[1] flex h-full min-h-0 flex-1 flex-col"
          >
            <div className="border-border bg-background flex items-center justify-between border-b px-7 py-4">
              <DateNavigator dateISO={dateISO} onChange={setDateISO} />
              <span className="text-muted-foreground text-xs">{currentDept.departmentName}</span>
            </div>
            <NoSessionCTA
              departmentId={currentDept.departmentId}
              departmentName={currentDept.departmentName}
              dateISO={dateISO}
              onOpened={() => sessionsQuery.refetch()}
            />
          </motion.div>
        )}

        {stateKey === "ready" && currentDept && session && headerSession && (
          <motion.div
            key="ready"
            {...fade}
            className="relative z-[1] flex h-full min-h-0 flex-1 flex-col"
          >
            {/* Session header */}
            <div className="border-border bg-background border-b px-7 pt-5 pb-4">
              <div className="flex items-start justify-between gap-4">
                <SessionHeader
                  session={headerSession}
                  phase={phase}
                  variant="inline"
                  elapsedText={getElapsedText(phase, session)}
                />
                <DateNavigator dateISO={dateISO} onChange={setDateISO} />
              </div>
              <div className="mt-3">
                <SessionActionsBar sessionId={session.sessionId} status={session.status} />
              </div>
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

            {/* Body — spring transition between tabs */}
            <div
              id={`tab-panel-${tab}`}
              role="tabpanel"
              className="scrollbar-thin flex-1 overflow-y-auto p-7"
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={tab}
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                  transition={
                    reduceMotion ? { duration: 0.15 } : { type: "spring", ...motionTokens.spring }
                  }
                >
                  {tab === "overview" && (
                    <OverviewTab
                      session={session}
                      phase={phase}
                      departmentId={currentDept.departmentId}
                    />
                  )}
                  {tab === "timeline" && <TimelineTab session={session} phase={phase} />}
                  {tab === "roster" && (
                    <RosterTab
                      departmentId={currentDept.departmentId}
                      dateISO={dateISO}
                      deptKey={resolveDeptKey(currentDept.departmentName)}
                    />
                  )}
                  {tab === "tasks" && <TasksTab session={session} />}
                  {tab === "deviations" && <DeviationsTab sessionId={session.sessionId} />}
                  {tab === "broadcast" && (
                    <BroadcastTab
                      sessionId={session.sessionId}
                      departmentId={currentDept.departmentId}
                    />
                  )}
                  {tab === "signoff" && <SignoffTab session={session} phase={phase} />}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Bone({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <div className={`sk-bone rounded-md ${className}`} style={style} />;
}

// Skeleton body content — rendered inside the same outer shell as the real
// component so only inner content swaps when data lands. Layout mirrors
// header strip + tab nav + signal grid to avoid layout shift on hydration.
function SkeletonContent() {
  return (
    <>
      {/* Header strip — mirrors SessionHeader + DateNavigator + ActionsBar */}
      <div
        className="border-border bg-background sk-section border-b px-7 pt-5 pb-4"
        style={{ animationDelay: "0ms" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <Bone className="h-12 w-12 shrink-0 rounded-xl" />
            <div className="space-y-2">
              <Bone className="h-3 w-44" />
              <Bone className="h-2.5 w-32" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Bone className="h-8 w-8 rounded-lg" />
            <Bone className="h-8 w-32 rounded-lg" />
            <Bone className="h-8 w-8 rounded-lg" />
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <Bone className="h-7 w-24 rounded-md" />
          <Bone className="h-7 w-20 rounded-md" />
          <Bone className="h-7 w-28 rounded-md" />
        </div>
      </div>

      {/* Sub-nav — mirrors 7-tab bar */}
      <div
        className="border-border bg-background sk-section border-b px-7"
        style={{ animationDelay: "60ms" }}
      >
        <div className="flex gap-0.5 py-2.5">
          {[64, 80, 76, 72, 56, 64, 64].map((w, i) => (
            <div key={i} className="flex items-center gap-1.5 px-4">
              <Bone className="h-3.5 w-3.5 rounded" />
              <Bone className="h-2.5 rounded" style={{ width: `${w}px` }} />
            </div>
          ))}
        </div>
      </div>

      {/* Body — mirrors OverviewTab default content (signal grid) */}
      <div className="sk-section flex-1 overflow-hidden p-7" style={{ animationDelay: "140ms" }}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="border-border bg-card rounded-2xl border p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-3">
                <Bone className="h-9 w-9 shrink-0 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Bone className="h-2.5 w-24" />
                  <Bone className="h-2 w-40 max-w-full" />
                </div>
              </div>
              <div className="flex items-end gap-3">
                <Bone className="h-9 w-16 rounded-md" />
                <Bone className="h-1.5 flex-1 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function NoDepartmentInner() {
  return (
    <div className="max-w-sm text-center">
      <h2 className="font-heading text-[22px] tracking-[-0.01em]">Ingen avdeling knyttet</h2>
      <p className="text-muted-foreground mt-2 text-[13px] leading-[1.5]">
        Du har ingen avdeling registrert på profilen din, og arbeidsrommet har ingen avdelinger satt
        opp. Kontakt admin for å få tildelt en avdeling.
      </p>
    </div>
  );
}

export default WebDayControl;
