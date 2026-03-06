"use client";

import {
  BookOpen,
  GraduationCap,
  FileSignature,
  CheckCircle2,
  Circle,
  Loader2,
  Clock,
} from "lucide-react";
import { useProtocolJourney } from "@/app/dashboard/_hooks";
import type { JourneyPhase } from "@/app/dashboard/_hooks";

// UI Events:
// - visual: horizontal 3-phase progress map with connector lines
// - visual: step checklist below phases
// - override: when assignmentStatus=completed, all phases/steps shown as done

interface EmployeeJourneyMapProps {
  protocolId: string;
  assignmentId: string;
  assignmentStatus: "pending" | "completed" | "expired";
}

const PHASE_ICONS: Record<JourneyPhase["type"], typeof BookOpen> = {
  procedures: BookOpen,
  test: GraduationCap,
  confirmation: FileSignature,
};

function getPhaseStyles(status: JourneyPhase["status"]) {
  switch (status) {
    case "completed":
      return {
        circle: "border-emerald-500 bg-emerald-500/10 text-emerald-500",
        label: "text-emerald-500 font-semibold",
        line: "bg-emerald-500",
      };
    case "in_progress":
      return {
        circle: "border-orange-500 bg-background text-orange-500 ring-2 ring-orange-500/30",
        label: "text-orange-500 font-semibold",
        line: "bg-muted",
      };
    default:
      return {
        circle: "border-border bg-muted text-muted-foreground",
        label: "text-muted-foreground",
        line: "bg-muted",
      };
  }
}

export function EmployeeJourneyMap({
  protocolId,
  assignmentId,
  assignmentStatus,
}: EmployeeJourneyMapProps) {
  const { data, isLoading } = useProtocolJourney(protocolId, assignmentId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const isOverrideCompleted = assignmentStatus === "completed";

  // Override phases if assignment is completed
  const phases = data.phases.map((phase) =>
    isOverrideCompleted
      ? { ...phase, status: "completed" as const, completed: phase.total }
      : phase,
  );

  // Override steps if assignment is completed
  const steps = data.steps.map((step) =>
    isOverrideCompleted ? { ...step, isCompleted: true } : step,
  );

  return (
    <div className="space-y-4">
      {/* Phase map */}
      <div className="flex items-center justify-center gap-0 py-2">
        {phases.map((phase, i) => {
          const Icon = PHASE_ICONS[phase.type];
          const styles = getPhaseStyles(phase.status);

          return (
            <div key={phase.type} className="flex items-center">
              {/* Connector line before (except first) */}
              {i > 0 && (
                <div
                  className={`h-0.5 w-8 sm:w-12 ${
                    phases[i - 1]?.status === "completed" ? "bg-emerald-500" : "bg-muted"
                  }`}
                />
              )}

              {/* Phase circle */}
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${styles.circle}`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <span className={`text-[10px] ${styles.label}`}>{phase.name}</span>
                <span className="text-muted-foreground text-[10px]">
                  {phase.completed}/{phase.total}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Step checklist */}
      {steps.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Prosedyresteg
          </h4>
          <ul className="space-y-1.5">
            {steps.map((step) => (
              <li key={step.stepId} className="flex items-center gap-2">
                {step.isCompleted ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                ) : (
                  <Circle className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                )}
                <span
                  className={`text-xs ${
                    step.isCompleted ? "text-muted-foreground line-through" : "text-foreground"
                  }`}
                >
                  {step.title}
                </span>
                {step.estimatedMinutes !== null && (
                  <span className="text-muted-foreground flex items-center gap-0.5 text-[10px]">
                    <Clock className="h-2.5 w-2.5" />
                    {step.estimatedMinutes} min
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
