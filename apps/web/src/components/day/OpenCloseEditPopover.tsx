"use client";

/**
 * OpenCloseEditPopover — inline popover for editing planned_open / planned_close
 * on an existing day_line record.
 *
 * Uses shadcn Popover with two <input type="time"> fields. On submit it calls
 * updateDayLineHoursAction and invalidates the ["day-lines"] query so sibling
 * consumers (e.g. DayLineCard) refresh automatically.
 *
 * L-0177 guard: day_line_id comes from the caller-supplied DayLineRow — workspace_id
 * and actor identity are resolved server-side inside updateDayLineHoursAction
 * (ADR-0151). No workspace_id in the form body.
 *
 * References: ADR-0099, ADR-0134, ADR-0151, ADR-0367.
 */

import { useState, useTransition } from "react";
import { Clock } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateDayLineHoursAction } from "@/app/dashboard/_actions/update-day-line-hours-action";
import type { DayLineRow } from "./_hooks/use-day-lines.types";

// ─── Props ────────────────────────────────────────────────────────────────────

export type OpenCloseEditPopoverProps = {
  /** The day_line record to edit. */
  line: DayLineRow;
  /** Called when the popover closes (cancel or after successful save). */
  onClose?: () => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function OpenCloseEditPopover({ line, onClose }: OpenCloseEditPopoverProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  // Controlled inputs — pre-populated from existing line values (HH:MM slice).
  const [plannedOpen, setPlannedOpen] = useState(line.planned_open?.slice(0, 5) ?? "");
  const [plannedClose, setPlannedClose] = useState(line.planned_close?.slice(0, 5) ?? "");

  const [, startTransition] = useTransition();

  const mutation = useMutation({
    mutationFn: async () => {
      const result = await updateDayLineHoursAction({
        day_line_id: line.day_line_id,
        planned_open: plannedOpen || undefined,
        planned_close: plannedClose || undefined,
      });

      if (!result.ok) {
        throw new Error(result.error ?? "Ukjent feil.");
      }

      return result;
    },
    onSuccess: (result) => {
      if (result.ok && result.no_op) {
        toast.info("Ingen endringer.");
      } else {
        toast.success("Åpningstider oppdatert.");
      }
      void queryClient.invalidateQueries({ queryKey: ["day-lines"] });
      handleClose();
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Kunne ikke oppdatere åpningstider.");
    },
  });

  function handleClose() {
    setOpen(false);
    onClose?.();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!plannedOpen && !plannedClose) {
      toast.error("Angi minst én verdi.");
      return;
    }
    startTransition(() => {
      mutation.mutate();
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          data-testid="open-close-edit-trigger"
          className="gap-1.5 text-sm text-foreground/70 hover:text-foreground"
        >
          <Clock className="h-3.5 w-3.5" />
          Rediger åpningstider
        </Button>
      </PopoverTrigger>

      <PopoverContent
        data-testid="open-close-edit-popover"
        align="start"
        className="w-72 bg-background border-border p-4"
        onInteractOutside={handleClose}
      >
        <p className="mb-3 text-sm font-medium text-foreground">Rediger åpningstider</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* Planned open */}
          <div className="flex flex-col gap-1">
            <Label htmlFor="planned-open-input" className="text-xs text-muted-foreground">
              Åpner
            </Label>
            <Input
              id="planned-open-input"
              data-testid="planned-open-input"
              type="time"
              value={plannedOpen}
              onChange={(e) => setPlannedOpen(e.target.value)}
              className="bg-background border-border text-foreground"
            />
          </div>

          {/* Planned close */}
          <div className="flex flex-col gap-1">
            <Label htmlFor="planned-close-input" className="text-xs text-muted-foreground">
              Stenger
            </Label>
            <Input
              id="planned-close-input"
              data-testid="planned-close-input"
              type="time"
              value={plannedClose}
              onChange={(e) => setPlannedClose(e.target.value)}
              className="bg-background border-border text-foreground"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClose}
              disabled={mutation.isPending}
              className="text-foreground/70"
            >
              Avbryt
            </Button>
            <Button
              type="submit"
              data-testid="save-hours-button"
              size="sm"
              disabled={mutation.isPending || (!plannedOpen && !plannedClose)}
              className="bg-background border border-border text-foreground hover:bg-muted"
            >
              {mutation.isPending ? "Lagrer…" : "Lagre"}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
