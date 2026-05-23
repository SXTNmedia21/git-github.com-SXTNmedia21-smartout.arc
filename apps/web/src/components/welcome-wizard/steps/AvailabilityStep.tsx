"use client";

/**
 * AvailabilityStep.tsx — Availability Step
 *
 * Users mark which weekdays they are normally UNABLE to work.
 * Chips are toggleable; aria-pressed reflects selection state.
 * Empty selection = available all days (valid, not an error).
 * Data persisted via saveAvailability Server Action.
 */

import { useState, useTransition } from "react";
import { ChevronLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  saveAvailability,
  type WeekdayCode,
} from "@/app/dashboard/_actions/welcome-wizard-actions";

type Props = {
  onNext: () => void;
  onBack: () => void;
};

const WEEKDAYS: ReadonlyArray<{ code: WeekdayCode; label: string }> = [
  { code: "MO", label: "Mandag" },
  { code: "TU", label: "Tirsdag" },
  { code: "WE", label: "Onsdag" },
  { code: "TH", label: "Torsdag" },
  { code: "FR", label: "Fredag" },
  { code: "SA", label: "Lørdag" },
  { code: "SU", label: "Søndag" },
];

export function AvailabilityStep({ onNext, onBack }: Props) {
  const [unavailable, setUnavailable] = useState<Set<WeekdayCode>>(new Set());
  const [isPending, startTransition] = useTransition();

  const toggle = (code: WeekdayCode) => {
    setUnavailable((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  function handleNext() {
    startTransition(async () => {
      const result = await saveAvailability({
        unavailableDays: Array.from(unavailable),
      });
      if (!result.ok) {
        toast.error(result.error ?? "Noe gikk galt. Prøv igjen.");
        return;
      }
      onNext();
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1.5">
        <h2 className="font-heading text-foreground text-2xl">Når er du tilgjengelig?</h2>
        <p className="text-muted-foreground text-sm">
          Hvilke dager kan du vanligvis <strong>ikke</strong> jobbe? Du kan endre dette når som
          helst i Min Tid.
        </p>
      </div>

      {/* Day chips */}
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Velg ukedager du ikke kan jobbe"
      >
        {WEEKDAYS.map((d) => {
          const isOff = unavailable.has(d.code);
          return (
            <button
              key={d.code}
              type="button"
              aria-pressed={isOff}
              onClick={() => toggle(d.code)}
              className={
                "rounded-full border px-4 py-2 text-sm transition-colors " +
                (isOff
                  ? "border-destructive bg-destructive/10 text-destructive"
                  : "border-border bg-card text-foreground hover:bg-muted")
              }
            >
              {d.label}
            </button>
          );
        })}
      </div>

      {/* Actions */}
      <div className="mt-auto flex items-center justify-between gap-3 pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          disabled={isPending}
          className="text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Tilbake
        </Button>
        <Button
          size="default"
          onClick={handleNext}
          disabled={isPending}
          autoFocus
          className="bg-foreground text-background hover:bg-foreground/90 min-w-[90px] disabled:opacity-40"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Neste"}
        </Button>
      </div>
    </div>
  );
}
