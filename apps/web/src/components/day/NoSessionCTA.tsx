// apps/web/src/components/day/NoSessionCTA.tsx
"use client";

import { useTransition } from "react";
import { CalendarPlus, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { nb } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { openSessionAction } from "@/app/dashboard/_actions/open-session-action";

type Props = {
  departmentId: string;
  departmentName: string;
  dateISO: string;
  onOpened: (sessionId: string) => void;
};

export function NoSessionCTA({ departmentId, departmentName, dateISO, onOpened }: Props) {
  const [isPending, startTransition] = useTransition();
  const qc = useQueryClient();
  const dateLabel = format(parseISO(dateISO), "EEEE d. MMMM", { locale: nb });

  function handleCreate(activateNow: boolean) {
    startTransition(async () => {
      const result = await openSessionAction({ departmentId, dateISO, activateNow });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.created
          ? activateNow
            ? "Session åpnet og satt aktiv"
            : "Session opprettet"
          : "Session fantes allerede",
      );
      qc.invalidateQueries({ queryKey: ["department-sessions"] });
      onOpened(result.sessionId);
    });
  }

  return (
    <div className="border-border bg-card mx-auto my-12 max-w-xl rounded-2xl border p-8 text-center shadow-sm">
      <div className="bg-muted mx-auto flex h-12 w-12 items-center justify-center rounded-full">
        <CalendarPlus className="text-muted-foreground h-5 w-5" aria-hidden />
      </div>
      <h2 className="font-heading text-foreground mt-4 text-2xl tracking-[-0.01em]">
        Ingen session for {dateLabel}
      </h2>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        {departmentName} har ikke registrert en session for denne dagen ennå. Du kan opprette en —
        også retroaktivt for tidligere datoer hvis du var offline eller dagen ble glemt.
      </p>
      <div className="mt-6 flex flex-col items-stretch gap-2 sm:flex-row sm:justify-center">
        <Button
          type="button"
          onClick={() => handleCreate(false)}
          disabled={isPending}
          variant="outline"
          className="gap-1.5"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Opprett som planlagt
        </Button>
        <Button
          type="button"
          onClick={() => handleCreate(true)}
          disabled={isPending}
          className="gap-1.5"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Åpne nå (aktiv)
        </Button>
      </div>
      <p className="text-muted-foreground mt-4 text-xs">
        Begge handlinger logges i revisjonsloggen som <code className="font-mono">manual</code>.
      </p>
    </div>
  );
}
