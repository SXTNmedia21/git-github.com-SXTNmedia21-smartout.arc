"use client";

/**
 * Lists all assigned protocols with progress bars and expandable details.
 * Connected to: use-assigned-protocols.ts, ProcedureStepper, KnowledgeTestView, ConfirmationSign
 *
 * UI Events:
 * - action: click protocol card to expand
 * - action: click phase tab (Lær/Test/Signér) to switch content
 * - color-regime: green (completed), orange (in-progress), zinc (not started)
 */

import { useContext, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  GraduationCap,
  Loader2,
  PenTool,
  ShieldCheck,
} from "lucide-react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useAssignedProtocols, type AssignedProtocol } from "../_hooks/use-assigned-protocols";
import { ProcedureStepper } from "./ProcedureStepper";
import { KnowledgeTestView } from "./KnowledgeTestView";
import { ConfirmationSign } from "./ConfirmationSign";

type Phase = "procedures" | "tests" | "confirmations";

function ProtocolCard({ protocol, isDark }: { protocol: AssignedProtocol; isDark: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activePhase, setActivePhase] = useState<Phase>("procedures");

  const { progress } = protocol;
  const isComplete = progress.percent === 100;

  const phases: Array<{
    key: Phase;
    label: string;
    icon: typeof BookOpen;
    count: number;
    doneCount: number;
  }> = [
    {
      key: "procedures",
      label: "Lær",
      icon: BookOpen,
      count: protocol.procedures.reduce((s, p) => s + p.steps.length, 0),
      doneCount: protocol.procedures.reduce(
        (s, p) => s + p.steps.filter((st) => st.isCompleted).length,
        0,
      ),
    },
    {
      key: "tests",
      label: "Test",
      icon: GraduationCap,
      count: protocol.knowledgeTests.length,
      doneCount: protocol.knowledgeTests.filter((t) => t.passed).length,
    },
    {
      key: "confirmations",
      label: "Signér",
      icon: PenTool,
      count: protocol.confirmations.length,
      doneCount: protocol.confirmations.filter((c) => c.isSigned).length,
    },
  ];

  return (
    <div
      className={`overflow-hidden rounded-xl border transition-all duration-300 ${
        isExpanded ? "shadow-lg" : "hover:shadow-md"
      } ${isDark ? "border-zinc-800 bg-[#0c0c0e]" : "border-zinc-200 bg-white"}`}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex w-full items-center gap-4 p-4 text-left transition-colors ${
          isDark ? "hover:bg-zinc-900/50" : "hover:bg-zinc-50"
        }`}
      >
        <div
          className={`rounded-lg border p-2 ${
            isComplete
              ? isDark
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                : "border-emerald-200 bg-emerald-50 text-emerald-600"
              : progress.percent > 0
                ? isDark
                  ? "border-orange-500/20 bg-orange-500/10 text-orange-400"
                  : "border-orange-200 bg-orange-50 text-orange-600"
                : isDark
                  ? "border-zinc-700 bg-zinc-800 text-zinc-400"
                  : "border-zinc-200 bg-zinc-100 text-zinc-500"
          }`}
        >
          {isComplete ? <CheckCircle2 className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
            {protocol.protocolName}
          </h3>
          {protocol.protocolDescription && (
            <p className={`mt-0.5 truncate text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
              {protocol.protocolDescription}
            </p>
          )}
          {/* Progress bar */}
          <div className="mt-2 flex items-center gap-3">
            <div
              className={`h-1.5 flex-1 overflow-hidden rounded-full ${
                isDark ? "bg-zinc-800" : "bg-zinc-100"
              }`}
            >
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${
                  isComplete
                    ? "bg-emerald-500"
                    : progress.percent > 0
                      ? "bg-orange-500"
                      : "bg-zinc-600"
                }`}
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <span
              className={`shrink-0 text-xs font-medium ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
            >
              {progress.completedSteps}/{progress.totalSteps}
            </span>
          </div>
        </div>

        <span
          className={`shrink-0 text-lg font-black ${
            isComplete ? "text-emerald-500" : isDark ? "text-zinc-300" : "text-zinc-700"
          }`}
        >
          {progress.percent}%
        </span>

        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform duration-300 ${
            isExpanded ? "rotate-180" : ""
          } ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
        />
      </button>

      {/* Expanded content */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-out ${
          isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        {isExpanded && (
          <div className={`border-t p-4 ${isDark ? "border-zinc-800" : "border-zinc-200"}`}>
            {/* Phase tabs */}
            <div className="mb-4 flex gap-1">
              {phases.map((phase) => {
                const Icon = phase.icon;
                const isActive = activePhase === phase.key;
                const allDone = phase.count > 0 && phase.doneCount === phase.count;

                return (
                  <button
                    key={phase.key}
                    onClick={() => setActivePhase(phase.key)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                      isActive
                        ? isDark
                          ? "bg-orange-500/10 text-orange-400"
                          : "bg-orange-50 text-orange-600"
                        : isDark
                          ? "text-zinc-500 hover:text-zinc-300"
                          : "text-zinc-400 hover:text-zinc-600"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {phase.label}
                    {phase.count > 0 && (
                      <span
                        className={`rounded px-1 py-0.5 text-[10px] ${
                          allDone
                            ? "bg-emerald-500/10 text-emerald-500"
                            : isDark
                              ? "bg-zinc-800 text-zinc-400"
                              : "bg-zinc-100 text-zinc-500"
                        }`}
                      >
                        {phase.doneCount}/{phase.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Phase content */}
            {activePhase === "procedures" && (
              <ProcedureStepper
                procedures={protocol.procedures}
                assignmentId={protocol.assignmentId}
                isDark={isDark}
              />
            )}
            {activePhase === "tests" && (
              <KnowledgeTestView
                tests={protocol.knowledgeTests}
                assignmentId={protocol.assignmentId}
                isDark={isDark}
              />
            )}
            {activePhase === "confirmations" && (
              <ConfirmationSign
                confirmations={protocol.confirmations}
                assignmentId={protocol.assignmentId}
                isDark={isDark}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function ProtocolList() {
  const { isDark, profileId } = useContext(DashboardContext);
  const { data: protocols, isLoading, error } = useAssignedProtocols(profileId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className={`h-6 w-6 animate-spin ${isDark ? "text-zinc-500" : "text-zinc-400"}`} />
        <span className={`ml-3 text-sm ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
          Laster opplaering...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6">
        <h2 className="mb-2 text-lg font-bold text-red-500">Kunne ikke laste opplaering</h2>
        <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
          {error instanceof Error ? error.message : "En ukjent feil oppstod."}
        </p>
      </div>
    );
  }

  if (!protocols || protocols.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 ${
          isDark ? "border-zinc-800 bg-zinc-900/20" : "border-zinc-200 bg-zinc-50"
        }`}
      >
        <div
          className={`mb-4 flex h-16 w-16 items-center justify-center rounded-full ${
            isDark ? "bg-zinc-800" : "bg-zinc-100"
          }`}
        >
          <ClipboardList className={`h-8 w-8 ${isDark ? "text-zinc-500" : "text-zinc-400"}`} />
        </div>
        <h2 className={`mb-2 text-xl font-bold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>
          Ingen protokoller tildelt
        </h2>
        <p className={`max-w-sm text-center text-sm ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
          Du har ingen aktive opplaeringsprotokoller. Kontakt din leder for mer informasjon.
        </p>
      </div>
    );
  }

  // Sort: pending first, then completed
  const sorted = [...protocols].sort((a, b) => {
    if (a.assignmentStatus === "completed" && b.assignmentStatus !== "completed") return 1;
    if (a.assignmentStatus !== "completed" && b.assignmentStatus === "completed") return -1;
    return a.progress.percent - b.progress.percent;
  });

  return (
    <div className="space-y-3">
      {sorted.map((protocol) => (
        <ProtocolCard key={protocol.assignmentId} protocol={protocol} isDark={isDark} />
      ))}
    </div>
  );
}
