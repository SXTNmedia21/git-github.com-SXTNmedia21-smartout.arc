// apps/web/src/components/day/SessionActionsBar.tsx
"use client";

import { useTransition } from "react";
import { Loader2, Play, Send, Lock, RotateCcw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { transitionSessionAction } from "@/app/dashboard/_actions/transition-session-action";

type Status = "upcoming" | "active" | "pending_signoff" | "closed" | "missed";
type TransitionTarget = "active" | "pending_signoff" | "closed" | "missed";

type Props = {
  sessionId: string;
  status: Status;
};

const LEGAL: Record<
  Status,
  ReadonlyArray<{ target: TransitionTarget; label: string; icon: typeof Play }>
> = {
  upcoming: [{ target: "active", label: "Sett aktiv", icon: Play }],
  active: [{ target: "pending_signoff", label: "Send til oppgjør", icon: Send }],
  pending_signoff: [
    { target: "closed", label: "Lukk dag", icon: Lock },
    { target: "active", label: "Reverter til aktiv", icon: RotateCcw },
  ],
  closed: [{ target: "pending_signoff", label: "Gjenåpne", icon: RotateCcw }],
  missed: [{ target: "active", label: "Rediger retroaktivt", icon: Play }],
};

export function SessionActionsBar({ sessionId, status }: Props) {
  const [isPending, startTransition] = useTransition();
  const qc = useQueryClient();

  function handleTransition(target: TransitionTarget) {
    startTransition(async () => {
      const result = await transitionSessionAction({ sessionId, target });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Session: ${target}`);
      qc.invalidateQueries({ queryKey: ["department-sessions"] });
      qc.invalidateQueries({ queryKey: ["reconciliation-list"] });
    });
  }

  const actions = LEGAL[status] ?? [];

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-muted-foreground text-[10px] font-semibold tracking-[0.14em] uppercase">
          Manuelle handlinger
        </span>
        {actions.length === 0 ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" variant="outline" size="sm" disabled className="gap-1.5">
                Ingen tilgjengelige
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Sessionen er i terminal status; ingen videre handlinger.
            </TooltipContent>
          </Tooltip>
        ) : (
          actions.map((a) => (
            <Button
              key={a.target}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleTransition(a.target)}
              disabled={isPending}
              className="gap-1.5"
              aria-label={`${a.label} — fra ${status}`}
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <a.icon className="h-3.5 w-3.5" aria-hidden />
              )}
              {a.label}
            </Button>
          ))
        )}
      </div>
    </TooltipProvider>
  );
}
