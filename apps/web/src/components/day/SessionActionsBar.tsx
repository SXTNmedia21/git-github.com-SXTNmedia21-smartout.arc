// apps/web/src/components/day/SessionActionsBar.tsx
"use client";

import { useTransition } from "react";
import { Loader2, MoreHorizontal, Play, Send, Lock, RotateCcw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Manuelle handlinger"
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-muted-foreground text-[10px] font-semibold tracking-[0.14em] uppercase">
          Manuelle handlinger
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {actions.length === 0 ? (
          <DropdownMenuItem disabled>Ingen tilgjengelige</DropdownMenuItem>
        ) : (
          actions.map((a) => (
            <DropdownMenuItem
              key={a.target}
              onSelect={() => handleTransition(a.target)}
              disabled={isPending}
              aria-label={`${a.label} — fra ${status}`}
              className="gap-2"
            >
              <a.icon className="h-3.5 w-3.5" aria-hidden />
              {a.label}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
