/**
 * CreatePeriodDialog — modal form for creating a new payroll period.
 *
 * UX:
 *   - shadcn/ui Dialog with Instrument Serif heading ("font-heading")
 *   - Two date inputs: Startdato + Sluttdato
 *   - Inline validation: start must be before end (mirrors BFF Zod rule)
 *   - Submit disabled while pending or validation fails
 *   - Closes + resets on success; errors surfaced via sonner (in mutation hook)
 *
 * Nordic Split:
 *   - CSS variable colors only (bg-background, text-foreground, text-destructive)
 *   - font-heading on DialogTitle per Instrument Serif convention
 *   - Geist Mono for date inputs (font-mono) — date data = monospace
 */
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreatePeriod } from "../_hooks/use-create-period";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
};

export function CreatePeriodDialog({ open, onOpenChange, workspaceId }: Props) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { mutate, isPending } = useCreatePeriod();

  // Mirror the BFF Zod refine: start must be strictly before end.
  const dateRangeError =
    startDate && endDate && startDate >= endDate ? "Startdato må være før sluttdato" : null;

  const isValid = Boolean(startDate && endDate && !dateRangeError);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    mutate(
      { workspaceId, startDate, endDate },
      {
        onSuccess: () => {
          // Reset fields and close dialog after successful creation.
          setStartDate("");
          setEndDate("");
          onOpenChange(false);
        },
      },
    );
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      // Reset state when dialog closes (cancel or backdrop click).
      setStartDate("");
      setEndDate("");
    }
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-background text-foreground sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Ny lønnsperiode</DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Opprett en ny lønnsperiode for arbeidsstedet. Perioden låses etter at lønnskjøringen er
            ferdig.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="create-period-start">Startdato</Label>
            <Input
              id="create-period-start"
              type="date"
              className="font-mono"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              disabled={isPending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="create-period-end">Sluttdato</Label>
            <Input
              id="create-period-end"
              type="date"
              className="font-mono"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
              disabled={isPending}
            />
            {dateRangeError && <p className="text-destructive text-xs">{dateRangeError}</p>}
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              Avbryt
            </Button>
            <Button type="submit" disabled={!isValid || isPending}>
              {isPending ? "Oppretter…" : "Opprett periode"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
