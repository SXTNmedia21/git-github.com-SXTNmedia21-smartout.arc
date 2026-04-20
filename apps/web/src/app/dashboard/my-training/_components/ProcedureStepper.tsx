"use client";

/**
 * Step-through viewer for procedure steps.
 * Shows steps in order with completion checkmarks and action buttons.
 * Connected to: use-step-completion.ts, ProtocolList
 *
 * UI Events:
 * - action: markComplete (completes procedure step)
 * - color-regime: emerald (done), orange (current), zinc (upcoming)
 */

import { useState } from "react";
import { CheckCircle2, Circle, Clock, ChevronRight, Loader2 } from "lucide-react";
import type { AssignedProcedure } from "../_hooks/use-assigned-protocols";
import { useCompleteStep } from "../_hooks/use-step-completion";

type ProcedureStepperProps = {
  procedures: AssignedProcedure[];
  assignmentId: string;
  isDark: boolean;
};

export function ProcedureStepper({ procedures, assignmentId, isDark }: ProcedureStepperProps) {
  const [expandedProcedure, setExpandedProcedure] = useState<string | null>(
    procedures[0]?.procedureId ?? null,
  );

  const completeStep = useCompleteStep();

  if (procedures.length === 0) {
    return (
      <p
        className={`py-4 text-center text-sm ${isDark ? "text-muted-foreground" : "text-muted-foreground"}`}
      >
        Ingen prosedyrer i denne protokollen.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {procedures.map((proc) => {
        const isExpanded = expandedProcedure === proc.procedureId;
        const doneCount = proc.steps.filter((s) => s.isCompleted).length;
        const allDone = proc.steps.length > 0 && doneCount === proc.steps.length;

        return (
          <div
            key={proc.procedureId}
            className={`rounded-lg border ${
              isDark ? "border-border bg-muted" : "border-border bg-muted"
            }`}
          >
            {/* Procedure header */}
            <button
              type="button"
              onClick={() => setExpandedProcedure(isExpanded ? null : proc.procedureId)}
              className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                isDark ? "hover:bg-muted" : "hover:bg-muted"
              }`}
            >
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black ${
                  allDone
                    ? "bg-emerald-500/10 text-emerald-500"
                    : isDark
                      ? "bg-muted text-muted-foreground"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {allDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : (proc.sortOrder ?? "?")}
              </div>
              <span
                className={`flex-1 text-sm font-semibold ${isDark ? "text-foreground" : "text-foreground"}`}
              >
                {proc.name}
              </span>
              <span
                className={`text-[10px] font-bold ${isDark ? "text-muted-foreground" : "text-muted-foreground"}`}
              >
                {doneCount}/{proc.steps.length}
              </span>
              <ChevronRight
                className={`h-3.5 w-3.5 transition-transform duration-200 ${
                  isExpanded ? "rotate-90" : ""
                } ${isDark ? "text-muted-foreground" : "text-muted-foreground"}`}
              />
            </button>

            {/* Steps */}
            {isExpanded && (
              <div className={`border-t px-3 py-2 ${isDark ? "border-border" : "border-border"}`}>
                <div className="space-y-1">
                  {proc.steps.map((step, idx) => {
                    const isNext =
                      !step.isCompleted && proc.steps.slice(0, idx).every((s) => s.isCompleted);

                    return (
                      <div
                        key={step.stepId}
                        className={`flex items-start gap-3 rounded-lg px-2 py-2 transition-colors ${
                          isNext ? (isDark ? "bg-orange-500/5" : "bg-orange-50/50") : ""
                        }`}
                      >
                        {/* Status icon */}
                        <div className="mt-0.5">
                          {step.isCompleted ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <Circle
                              className={`h-4 w-4 ${
                                isNext
                                  ? "text-orange-500"
                                  : isDark
                                    ? "text-muted-foreground"
                                    : "text-muted-foreground"
                              }`}
                            />
                          )}
                        </div>

                        {/* Step content */}
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-sm font-medium ${
                              step.isCompleted
                                ? isDark
                                  ? "text-muted-foreground line-through"
                                  : "text-muted-foreground line-through"
                                : isDark
                                  ? "text-foreground"
                                  : "text-foreground"
                            }`}
                          >
                            {step.title}
                          </p>
                          {step.description && isNext && (
                            <p
                              className={`mt-0.5 text-xs ${isDark ? "text-muted-foreground" : "text-muted-foreground"}`}
                            >
                              {step.description}
                            </p>
                          )}
                          {step.estimatedMinutes && isNext && (
                            <p
                              className={`mt-1 flex items-center gap-1 text-[10px] font-medium ${
                                isDark ? "text-muted-foreground" : "text-muted-foreground"
                              }`}
                            >
                              <Clock className="h-3 w-3" />~{step.estimatedMinutes} min
                            </p>
                          )}
                        </div>

                        {/* Action button */}
                        {isNext && !step.isCompleted && (
                          <button
                            onClick={() =>
                              completeStep.mutate({
                                procedureStepId: step.stepId,
                                protocolAssignmentId: assignmentId,
                              })
                            }
                            disabled={completeStep.isPending}
                            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                              isDark
                                ? "bg-orange-500/10 text-orange-400 hover:bg-orange-500/20"
                                : "bg-orange-50 text-orange-600 hover:bg-orange-100"
                            } disabled:opacity-50`}
                          >
                            {completeStep.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              "Fullfør"
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
