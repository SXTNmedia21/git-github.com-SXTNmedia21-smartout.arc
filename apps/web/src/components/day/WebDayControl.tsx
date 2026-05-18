"use client";

import { useContext, useEffect, useState, type CSSProperties } from "react";
import { useTranslation } from "@smartout/i18n";
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
import { useProfileRole } from "@/app/dashboard/komm/_hooks/use-profile-role";
import { resolveDeptKey } from "./dept-key";
import type { WorkspaceRole } from "@/lib/context/bootstrap-contract";
import { PhaseBadge } from "@smartout/ui";
import { OverviewTab } from "./tabs/OverviewTab";
import { TimelineTab } from "./tabs/TimelineTab";
import { RosterTab } from "./tabs/RosterTab";
import { TasksTab } from "./tabs/TasksTab";
import { DeviationsTab } from "./tabs/DeviationsTab";
import { BroadcastTab } from "./tabs/BroadcastTab";
import { DateNavigator } from "./DateNavigator";
import { NoSessionCTA } from "./NoSessionCTA";
import { SessionActionsBar } from "./SessionActionsBar";
import { PageTabNav } from "@/components/dashboard/PageTabNav";
import { OversiktToolsBridge } from "./_tools/oversikt-tools-bridge";

const TAB_DEFS = [
  { key: "overview", labelKey: "day.control.tab_overview", Icon: Home },
  { key: "timeline", labelKey: "day.control.tab_timeline", Icon: Clock },
  { key: "roster", labelKey: "day.control.tab_roster", Icon: Users },
  { key: "tasks", labelKey: "day.control.tab_tasks", Icon: CheckCircle2 },
  { key: "deviations", labelKey: "day.control.tab_deviations", Icon: AlertTriangle },
  { key: "broadcast", labelKey: "day.control.tab_broadcast", Icon: MessageSquare },
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

function getElapsedText(
  phase: UiPhase,
  session: DepartmentSessionRow | null,
  t: (key: string, params?: Record<string, string | number>) => string,
): string | undefined {
  if (!session) return undefined;
  if (phase === "active" && session.openedAt) {
    return t("day.control.elapsed_opened", { time: new Date(session.openedAt).toTimeString().slice(0, 5) });
  }
  // "upcoming": PhaseBadge owns this state — no duplicate text needed
  if (phase === "pending_signoff") return t("day.control.elapsed_pending_signoff");
  if (phase === "closed" || phase === "locked") return t("day.control.elapsed_closed");
  if (phase === "missed") return t("day.control.elapsed_missed");
  return undefined;
}

export function WebDayControl({ initialTab = "overview" }: { initialTab?: TabKey }) {
  const { t } = useTranslation("dashboard");
  const [tab, setTab] = useState<TabKey>(initialTab);
  const ctx = useContext(DashboardContext);
  const wsCtx = useWorkspaceOptional();
  const profileId = ctx.profileId;
  const workspaceId = wsCtx?.workspace.workspace_id ?? null;
  const reduceMotion = useReducedMotion();

  // Role plumbing: use raw query.data (not .role which defaults to "employee")
  // so role stays null during loading → SlotPicker gate shows briefly then unblocks.
  const { data: profileRoleData } = useProfileRole(profileId ?? "");
  const role: WorkspaceRole | null = (profileRoleData as WorkspaceRole | undefined) ?? null;

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

  void resolveDeptKey;

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
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
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
            <NoDepartmentInner t={t} />
          </motion.div>
        )}

        {stateKey === "no-session" && currentDept && (
          <motion.div
            key="no-session"
            {...fade}
            className="relative z-[1] flex h-full min-h-0 flex-1 flex-col p-4 pt-1 md:p-6 md:pt-3"
          >
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <h1 className="font-heading text-foreground text-3xl leading-tight tracking-tight">
                  {dateLabels.dayLong} {dateLabels.dayNum}. {dateLabels.month}
                </h1>
                <p className="text-muted-foreground mt-1 text-sm">{currentDept.departmentName}</p>
              </div>
              <DateNavigator dateISO={dateISO} onChange={setDateISO} />
            </div>
            <NoSessionCTA
              departmentId={currentDept.departmentId}
              departmentName={currentDept.departmentName}
              dateISO={dateISO}
              onOpened={() => sessionsQuery.refetch()}
            />
          </motion.div>
        )}

        {stateKey === "ready" && currentDept && session && (
          <motion.div
            key="ready"
            {...fade}
            className="relative z-[1] flex h-full min-h-0 flex-1 flex-col p-4 pt-1 md:p-6 md:pt-3"
          >
            {/* Botsson harness — read + write + nav tools for the active session.
                Mounts ONLY in ready-state so tools cannot fire against
                missing context. Bridge renders null. */}
            <OversiktToolsBridge
              sessionId={session.sessionId}
              departmentId={currentDept.departmentId}
              departmentName={currentDept.departmentName}
              dateISO={dateISO}
              phase={phase}
              uiActions={{
                // Cast through string — runtime enum guard lives in switchDayTab impl.
                setTab: (t: string) => setTab(t as TabKey),
                setDate: setDateISO,
              }}
            />

            {/* Page header — reports style: H1 + subtitle freestanding */}
            <div className="mb-5 flex items-end justify-between gap-4">
              <div className="min-w-0">
                <h1 className="font-heading text-foreground text-3xl leading-tight tracking-tight">
                  {dateLabels.dayLong} {dateLabels.dayNum}. {dateLabels.month}
                </h1>
                <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-sm">
                  <span>{currentDept.departmentName}</span>
                  <span aria-hidden className="opacity-50">
                    ·
                  </span>
                  <PhaseBadge phase={phase} />
                  {(session.plannedOpen ?? session.plannedClose) ? (
                    <>
                      <span aria-hidden className="opacity-50">
                        ·
                      </span>
                      <span className="font-mono tabular-nums">
                        {session.plannedOpen ?? "—"}–{session.plannedClose ?? "—"}
                      </span>
                    </>
                  ) : null}
                  {getElapsedText(phase, session, t) ? (
                    <>
                      <span aria-hidden className="opacity-50">
                        ·
                      </span>
                      <span>{getElapsedText(phase, session, t)}</span>
                    </>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <DateNavigator dateISO={dateISO} onChange={setDateISO} />
                <SessionActionsBar sessionId={session.sessionId} status={session.status} />
              </div>
            </div>

            {/* Tabs — reports pill row */}
            <div className="mb-5">
              <PageTabNav
                tabs={TAB_DEFS.map((tab) => ({ key: tab.key, label: t(tab.labelKey), icon: tab.Icon }))}
                active={tab}
                onChange={(k) => setTab(k as TabKey)}
                ariaLabel={t("day.control.aria_tabs")}
              />
            </div>

            {/* Body — spring transition between tabs */}
            <div
              id={`tab-panel-${tab}`}
              role="tabpanel"
              aria-labelledby={`tab-btn-${tab}`}
              tabIndex={0}
              className="min-h-0 flex-1 overflow-hidden"
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
                  className="flex h-full min-h-0 flex-col"
                >
                  {tab === "overview" && (
                    <OverviewTab
                      session={session}
                      phase={phase}
                      departmentId={currentDept.departmentId}
                      dateISO={dateISO}
                      onNavigate={(k) => setTab(k as TabKey)}
                    />
                  )}
                  {tab === "timeline" && (
                    <TimelineTab
                      session={session}
                      phase={phase}
                      departmentId={currentDept.departmentId}
                      dateISO={dateISO}
                      role={role}
                    />
                  )}
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
    <div className="flex h-full min-h-0 flex-1 flex-col p-6 md:p-8">
      {/* Header — mirrors H1 + subtitle freestanding */}
      <div
        className="sk-section mb-5 flex items-end justify-between gap-4"
        style={{ animationDelay: "0ms" }}
      >
        <div className="min-w-0 space-y-2.5">
          <Bone className="h-8 w-72 max-w-full" />
          <Bone className="h-3 w-56" />
        </div>
        <div className="flex items-center gap-2">
          <Bone className="h-8 w-8 rounded-lg" />
          <Bone className="h-8 w-32 rounded-lg" />
          <Bone className="h-8 w-8 rounded-lg" />
          <Bone className="h-8 w-8 rounded-lg" />
        </div>
      </div>

      {/* Tabs — pill row */}
      <div className="sk-section mb-5" style={{ animationDelay: "60ms" }}>
        <Bone className="h-9 w-[460px] max-w-full rounded-xl" />
      </div>

      {/* Body — mirrors OverviewTab KPI grid */}
      <div
        className="sk-section min-h-0 flex-1 overflow-hidden pr-1 pb-6"
        style={{ animationDelay: "140ms" }}
      >
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
    </div>
  );
}

function NoDepartmentInner({ t }: { t: (key: string) => string }) {
  return (
    <div className="max-w-sm text-center">
      <h2 className="font-heading text-[22px] tracking-[-0.01em]">{t("day.control.no_dept_heading")}</h2>
      <p className="text-muted-foreground mt-2 text-[13px] leading-[1.5]">
        {t("day.control.no_dept_body")}
      </p>
    </div>
  );
}

export default WebDayControl;
