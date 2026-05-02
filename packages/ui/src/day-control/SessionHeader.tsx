import { X } from "lucide-react";
import type { UiPhase } from "./types";
import type { DaySession } from "./types";
import { PhaseBadge } from "./PhaseBadge";

export function SessionHeader({
  session,
  phase,
  variant = "full",
  onClose,
  elapsedText,
}: {
  session: DaySession;
  phase: UiPhase;
  variant?: "full" | "inline";
  onClose?: () => void;
  /** Phase-appropriate right-side text: "3t 34m", "om 2t 28m", "siste ut 23:12", etc. */
  elapsedText?: string;
}) {
  const headingSize = variant === "full" ? "text-[44px]" : "text-[40px]";

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <h1
          className={`font-heading text-foreground ${headingSize} leading-[1.02] tracking-[-0.02em]`}
        >
          {session.dayLong} {session.dayNum}. {session.month}
        </h1>
        <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
          <PhaseBadge phase={phase} />
          <span className="text-muted-foreground text-[13px]">
            <span className="font-mono">
              {session.plannedOpen}–{session.plannedClose}
            </span>
            {elapsedText ? (
              <>
                <span className="mx-2 opacity-50">·</span>
                {elapsedText}
              </>
            ) : null}
          </span>
        </div>
      </div>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label="Lukk"
          className="text-muted-foreground hover:text-foreground p-1.5 transition-colors"
        >
          <X className="h-[18px] w-[18px]" />
        </button>
      ) : null}
    </div>
  );
}
