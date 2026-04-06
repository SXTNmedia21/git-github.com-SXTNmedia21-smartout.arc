"use client";

// Horizontal timeline showing the 4-stage lifecycle of a contract:
// draft → sent → viewed → signed
// Completed steps show a filled dot + check icon, the active step pulses,
// future steps are outline-only. Timestamps come from the events array.

import { Check } from "lucide-react";
import { cn } from "../lib/utils";

type ContractTimelineProps = {
  status: string;
  events: Array<{ event_type: string; created_at: string }>;
};

const STEPS = ["draft", "sent", "viewed", "signed"] as const;
type Step = (typeof STEPS)[number];

const STEP_LABELS: Record<Step, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  signed: "Signed",
};

function getStepIndex(status: string): number {
  const idx = STEPS.indexOf(status as Step);
  // Unknown status defaults to -1 (nothing active, nothing complete)
  return idx;
}

function getTimestampForStep(step: Step, events: ContractTimelineProps["events"]): string | null {
  const match = events.find((e) => e.event_type === step);
  if (!match) return null;
  return new Date(match.created_at).toLocaleString("no-NO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ContractTimeline({ status, events }: ContractTimelineProps) {
  const activeIndex = getStepIndex(status);

  return (
    <ol role="list" className="flex w-full items-start gap-0">
      {STEPS.map((step, index) => {
        const isCompleted = index < activeIndex;
        const isActive = index === activeIndex;
        const timestamp = getTimestampForStep(step, events);

        return (
          <li
            key={step}
            role="listitem"
            aria-current={isActive ? "step" : undefined}
            className="flex min-w-0 flex-1 flex-col items-center"
          >
            {/* Label row — above the dot */}
            <span className="text-muted-foreground mb-1.5 max-w-full truncate px-1 text-center text-xs">
              {STEP_LABELS[step]}
            </span>

            {/* Dot + connector line row */}
            <div className="flex w-full items-center">
              {/* Left connector line — hidden for first step */}
              <div
                className={cn(
                  "h-px flex-1",
                  index === 0 ? "invisible" : "",
                  isCompleted || isActive ? "bg-primary" : "bg-border",
                )}
              />

              {/* The dot itself */}
              <div
                className={cn(
                  "flex h-2 w-2 flex-shrink-0 items-center justify-center rounded-full",
                  isCompleted && "bg-primary",
                  isActive && "bg-primary animate-[pulse-opacity_2s_ease-in-out_infinite]",
                  !isCompleted && !isActive && "border-border bg-background border",
                )}
              >
                {isCompleted && (
                  <Check
                    className="text-primary-foreground h-1.5 w-1.5"
                    strokeWidth={3}
                    aria-hidden="true"
                  />
                )}
              </div>

              {/* Right connector line — hidden for last step */}
              <div
                className={cn(
                  "h-px flex-1",
                  index === STEPS.length - 1 ? "invisible" : "",
                  isCompleted ? "bg-primary" : "bg-border",
                )}
              />
            </div>

            {/* Timestamp row — below the dot */}
            <span className="text-muted-foreground mt-1.5 h-4 max-w-full truncate px-1 text-center font-mono text-[10px]">
              {timestamp ?? ""}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
