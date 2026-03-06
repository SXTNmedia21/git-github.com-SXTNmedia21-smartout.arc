"use client";

// ============================================
// AlertOrchestra.tsx
// Interactive alert showcase for onboarding sandbox.
// Exists to demonstrate Smartout alert UI patterns,
// routing intents, and script-driven orchestration.
// ============================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bell, CheckCircle2, Info, Radio, Zap } from "lucide-react";
import { motion } from "framer-motion";

type AlertSeverity = "info" | "warning" | "critical" | "success";
type FocusMode = "normal" | "soft" | "hard";

type AlertDefinition = {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  uiElement: string;
  functionName: string;
  route: string;
  blinkPattern: "pulse" | "double" | "urgent";
};

type ScriptStep = {
  id: string;
  alertId?: string;
  focusMode?: FocusMode;
  navigateTo?: string;
  message: string;
};

const ALERT_DEFINITIONS: AlertDefinition[] = [
  {
    id: "training-overdue",
    title: "Training overdue",
    message: "2 ansatte har ikke fullført opplæring før neste vakt.",
    severity: "warning",
    uiElement: "Top warning banner",
    functionName: "alertTrainingOverdue()",
    route: "/dashboard/my-training",
    blinkPattern: "pulse",
  },
  {
    id: "haccp-critical",
    title: "HACCP critical deviation",
    message: "Temperaturavvik i sone KJ-02. Umiddelbar oppfølging kreves.",
    severity: "critical",
    uiElement: "Critical modal alert",
    functionName: "alertHaccpCriticalDeviation()",
    route: "/dashboard/governance",
    blinkPattern: "urgent",
  },
  {
    id: "shift-gap",
    title: "Shift coverage gap",
    message: "Mangler dekning for kveldsskift i Service i dag.",
    severity: "warning",
    uiElement: "Sticky inline card",
    functionName: "alertShiftCoverageGap()",
    route: "/dashboard/schedule",
    blinkPattern: "double",
  },
  {
    id: "pending-signoff",
    title: "Session pending sign-off",
    message: "Dagens avdelingssession venter på sign-off.",
    severity: "info",
    uiElement: "Timeline status chip",
    functionName: "alertPendingSignoff()",
    route: "/dashboard/operations",
    blinkPattern: "pulse",
  },
  {
    id: "policy-update",
    title: "Policy update requires confirmation",
    message: "Ny policy er publisert. 4 ansatte har ikke bekreftet.",
    severity: "warning",
    uiElement: "Confirmation drawer alert",
    functionName: "alertPolicyUpdateConfirmation()",
    route: "/dashboard/governance",
    blinkPattern: "double",
  },
  {
    id: "inbox-escalation",
    title: "Escalation in inbox",
    message: "En kritisk avvikssak er eskalert til admin.",
    severity: "critical",
    uiElement: "Floating action alert",
    functionName: "alertEscalationInbox()",
    route: "/dashboard/operations",
    blinkPattern: "urgent",
  },
  {
    id: "new-invite-accepted",
    title: "Invite accepted",
    message: "Ny medarbeider har akseptert invitasjon og venter onboarding.",
    severity: "success",
    uiElement: "Toast success alert",
    functionName: "alertInviteAccepted()",
    route: "/dashboard/people",
    blinkPattern: "pulse",
  },
  {
    id: "open-shift-request",
    title: "Open shift request",
    message: "En ansatt ber om bytte av vakt i morgen.",
    severity: "info",
    uiElement: "Notification bell badge",
    functionName: "alertOpenShiftRequest()",
    route: "/dashboard/schedule",
    blinkPattern: "double",
  },
  {
    id: "service-unhealthy",
    title: "Service unhealthy",
    message: "Stage Engine svarer tregt. Helsegrad falt under terskel.",
    severity: "critical",
    uiElement: "System health panel alert",
    functionName: "alertServiceUnhealthy()",
    route: "/platform-admin/health",
    blinkPattern: "urgent",
  },
  {
    id: "goal-risk",
    title: "Season target risk",
    message: "Ligger 11% bak sesongmål denne uken.",
    severity: "warning",
    uiElement: "KPI anomaly card",
    functionName: "alertSeasonTargetRisk()",
    route: "/dashboard/season",
    blinkPattern: "pulse",
  },
  {
    id: "chat-mention",
    title: "Direct mention in chat",
    message: "Du er nevnt i #kjøkken av skiftleder.",
    severity: "info",
    uiElement: "Chat mention pill",
    functionName: "alertChatMention()",
    route: "/dashboard/chat",
    blinkPattern: "double",
  },
  {
    id: "automation-ok",
    title: "Automation completed",
    message: "Daglig close-prosess fullført uten avvik.",
    severity: "success",
    uiElement: "Bottom-right completion toast",
    functionName: "alertAutomationCompleted()",
    route: "/dashboard/reports",
    blinkPattern: "pulse",
  },
];

const SCRIPT_STEPS: ScriptStep[] = [
  { id: "s1", focusMode: "soft", message: "Entering soft focus mode." },
  { id: "s2", alertId: "shift-gap", message: "Highlight staffing gap alert." },
  { id: "s3", navigateTo: "/dashboard/schedule", message: "Navigate preview: schedule." },
  { id: "s4", alertId: "training-overdue", message: "Show training overdue warning." },
  { id: "s5", navigateTo: "/dashboard/my-training", message: "Navigate preview: training." },
  { id: "s6", focusMode: "hard", message: "Escalating to hard focus mode." },
  { id: "s7", alertId: "haccp-critical", message: "Critical HACCP alert appears." },
  { id: "s8", navigateTo: "/dashboard/governance", message: "Navigate preview: HMS governance." },
  { id: "s9", alertId: "automation-ok", message: "Close with successful automation alert." },
  { id: "s10", focusMode: "normal", message: "Returning to normal mode." },
];

/**
 * Returns color classes based on alert severity.
 * Why: Keeps visual semantics consistent per alert type.
 */
function getSeverityClasses(severity: AlertSeverity): string {
  if (severity === "critical") return "border-red-400/40 bg-red-500/10 text-red-100";
  if (severity === "warning") return "border-amber-400/40 bg-amber-500/10 text-amber-100";
  if (severity === "success") return "border-emerald-400/40 bg-emerald-500/10 text-emerald-100";
  return "border-sky-400/40 bg-sky-500/10 text-sky-100";
}

/**
 * Returns icon component for alert severity.
 * Why: Gives fast visual scanning in dense alert grids.
 */
function getSeverityIcon(severity: AlertSeverity) {
  if (severity === "critical") return AlertTriangle;
  if (severity === "warning") return Bell;
  if (severity === "success") return CheckCircle2;
  return Info;
}

export function AlertOrchestra() {
  const router = useRouter();
  const [activeAlertId, setActiveAlertId] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState<FocusMode>("normal");
  const [scriptRunning, setScriptRunning] = useState(false);
  const [scriptIndex, setScriptIndex] = useState(0);
  const [scriptLog, setScriptLog] = useState<string[]>(["Alert orchestra ready."]);
  const [routePreview, setRoutePreview] = useState("/onboarding/showcase");
  const [liveNavigationEnabled, setLiveNavigationEnabled] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Appends a timestamped entry to script log.
   * Why: Script playback should be inspectable step-by-step.
   */
  const addLog = useCallback((message: string) => {
    setScriptLog((prev) =>
      [`${new Date().toLocaleTimeString()}: ${message}`, ...prev].slice(0, 14),
    );
  }, []);

  /**
   * Applies a script step side-effect.
   * Why: Centralizes how focus, alert activation, and navigation are orchestrated.
   */
  const applyStep = useCallback(
    (step: ScriptStep) => {
      if (step.focusMode) {
        setFocusMode(step.focusMode);
        addLog(`Focus mode -> ${step.focusMode}`);
      }
      if (step.alertId) {
        setActiveAlertId(step.alertId);
        addLog(`Alert activated -> ${step.alertId}`);
      }
      if (step.navigateTo) {
        setRoutePreview(step.navigateTo);
        addLog(`Route preview -> ${step.navigateTo}`);
        if (liveNavigationEnabled) {
          router.push(step.navigateTo);
        }
      }
      addLog(step.message);
    },
    [addLog, liveNavigationEnabled, router],
  );

  /**
   * Stops current script playback and clears running timer.
   * Why: Prevents stale timers from continuing orchestration.
   */
  const stopScript = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setScriptRunning(false);
    addLog("Script stopped.");
  }, [addLog]);

  /**
   * Runs one script step and schedules the next one.
   * Why: Creates deterministic showcase playback with visible sequencing.
   */
  const runStep = useCallback(() => {
    setScriptIndex((prevIndex) => {
      if (prevIndex >= SCRIPT_STEPS.length) {
        setScriptRunning(false);
        addLog("Script completed.");
        return prevIndex;
      }

      const step = SCRIPT_STEPS[prevIndex];
      if (step) {
        applyStep(step);
      }

      const nextIndex = prevIndex + 1;
      if (nextIndex < SCRIPT_STEPS.length) {
        timerRef.current = setTimeout(runStep, 1100);
      } else {
        setScriptRunning(false);
        addLog("Script completed.");
      }

      return nextIndex;
    });
  }, [addLog, applyStep]);

  /**
   * Starts script playback from first step.
   * Why: Enables one-click end-to-end orchestration demo.
   */
  const startScript = useCallback(() => {
    stopScript();
    setScriptIndex(0);
    setScriptRunning(true);
    addLog("Script started.");
    timerRef.current = setTimeout(runStep, 300);
  }, [addLog, runStep, stopScript]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const uiElementList = useMemo(() => [...new Set(ALERT_DEFINITIONS.map((a) => a.uiElement))], []);
  const functionList = useMemo(
    () => [...new Set(ALERT_DEFINITIONS.map((a) => a.functionName))],
    [],
  );

  const focusRingClass =
    focusMode === "hard"
      ? "ring-2 ring-red-400/60"
      : focusMode === "soft"
        ? "ring-2 ring-amber-300/40"
        : "ring-1 ring-white/10";

  return (
    <section
      className={`rounded-2xl border border-white/[0.08] bg-white/[0.05] p-6 backdrop-blur-xl ${focusRingClass}`}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-white/40 uppercase">
            Alert orchestra
          </p>
          <h3 className="mt-1 text-xl font-semibold text-white">Interactive Alert Journey</h3>
          <p className="mt-1 text-sm text-white/60">
            Blinking alerts, route previews, focus mode transitions, and ordered script playback.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={startScript}
            className="rounded-lg bg-[oklch(0.75_0.18_55)] px-3 py-2 text-xs font-semibold text-white hover:bg-[oklch(0.72_0.18_55)]"
          >
            Run script
          </button>
          <button
            type="button"
            onClick={stopScript}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10"
          >
            Stop
          </button>
          <button
            type="button"
            onClick={() => {
              const step = SCRIPT_STEPS[scriptIndex];
              if (step) {
                applyStep(step);
                setScriptIndex((prev) => Math.min(prev + 1, SCRIPT_STEPS.length));
              }
            }}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10"
          >
            Step
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
          <p className="text-xs tracking-wider text-white/40 uppercase">Focus mode</p>
          <p className="mt-1 text-sm font-semibold text-white/90">{focusMode.toUpperCase()}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
          <p className="text-xs tracking-wider text-white/40 uppercase">Route preview</p>
          <p className="mt-1 text-sm font-semibold text-white/90">{routePreview}</p>
        </div>
        <label className="rounded-lg border border-white/10 bg-black/20 p-3">
          <span className="text-xs tracking-wider text-white/40 uppercase">Live navigation</span>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="checkbox"
              checked={liveNavigationEnabled}
              onChange={(event) => setLiveNavigationEnabled(event.target.checked)}
            />
            <span className="text-sm text-white/80">Enable real route push</span>
          </div>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {ALERT_DEFINITIONS.map((alert) => {
          const isActive = activeAlertId === alert.id;
          const Icon = getSeverityIcon(alert.severity);
          return (
            <motion.button
              key={alert.id}
              type="button"
              onClick={() => {
                setActiveAlertId(alert.id);
                setRoutePreview(alert.route);
                addLog(`Manual alert click -> ${alert.id}`);
              }}
              animate={
                isActive
                  ? alert.blinkPattern === "urgent"
                    ? { opacity: [1, 0.65, 1], scale: [1, 1.01, 1] }
                    : alert.blinkPattern === "double"
                      ? { opacity: [1, 0.85, 1, 0.85, 1] }
                      : { opacity: [1, 0.9, 1] }
                  : { opacity: 1 }
              }
              transition={{ duration: isActive ? 1.1 : 0, repeat: isActive ? Infinity : 0 }}
              className={`rounded-xl border p-4 text-left transition-all hover:bg-white/10 ${getSeverityClasses(alert.severity)}`}
            >
              <div className="mb-2 flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <span className="text-sm font-semibold">{alert.title}</span>
              </div>
              <p className="text-xs opacity-90">{alert.message}</p>
              <p className="mt-2 text-[11px] opacity-75">
                UI: {alert.uiElement} | Fn: {alert.functionName} | Route: {alert.route}
              </p>
            </motion.button>
          );
        })}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="mb-2 text-xs font-semibold tracking-wider text-white/40 uppercase">
            All alert UI elements
          </p>
          <ul className="space-y-1 text-sm text-white/80">
            {uiElementList.map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="mb-2 text-xs font-semibold tracking-wider text-white/40 uppercase">
            All alert functions
          </p>
          <ul className="space-y-1 text-sm text-white/80">
            {functionList.map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
        <p className="mb-2 text-xs font-semibold tracking-wider text-white/40 uppercase">
          Script log
        </p>
        <div className="max-h-44 space-y-1 overflow-auto">
          {scriptLog.map((entry) => (
            <p key={entry} className="text-xs text-white/70">
              {entry}
            </p>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-white/55">
        <Radio className="h-3.5 w-3.5" />
        <span>
          Mode: {scriptRunning ? "RUNNING" : "IDLE"} | Step {scriptIndex}/{SCRIPT_STEPS.length}
        </span>
        <Zap className="h-3.5 w-3.5" />
      </div>
    </section>
  );
}
