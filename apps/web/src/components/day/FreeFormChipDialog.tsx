"use client";

/**
 * FreeFormChipDialog — single-field dialog for authoring a free-form chip.
 *
 * The free-form chip is an authoring placeholder — it renders locally on the
 * canvas but does NOT persist until the user saves the template. At apply time
 * the user picks per-chip: materialise as session_task, session_note, or skip.
 *
 * Why a dialog, not a popover? The SlotPicker is already a popover; nesting a
 * popover inside another popover causes z-index + portal stacking issues in
 * shadcn. A Dialog mounts in the root portal and avoids that problem.
 *
 * Spec ref: docs/superpowers/specs/2026-05-16-timeline-templates-design.md §Build
 * ADR ref:  ADR-0334
 */

import { useState } from "react";
import { Type } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type FreeFormChipDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The HH:MM slot time this chip belongs to. */
  time: string;
  /** Called when the user submits a valid label. */
  onAdd: (label: string, time: string) => void;
};

export function FreeFormChipDialog({ open, onOpenChange, time, onAdd }: FreeFormChipDialogProps) {
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = label.trim();
    if (!trimmed) {
      setError("Etikett kan ikke være tom");
      return;
    }
    if (trimmed.length > 80) {
      setError("Maks 80 tegn");
      return;
    }
    onAdd(trimmed, time);
    setLabel("");
    setError(null);
    onOpenChange(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setLabel("");
      setError(null);
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm" aria-labelledby="freeform-chip-title">
        <DialogHeader>
          <DialogTitle id="freeform-chip-title" className="flex items-center gap-2">
            <Type className="text-muted-foreground h-4 w-4" aria-hidden />
            Fri tekst — kl {time}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="freeform-label" className="text-sm font-medium">
              Etikett
            </Label>
            <Input
              id="freeform-label"
              autoFocus
              placeholder="t.eks. Sett opp julestjerne på bord 5"
              value={label}
              maxLength={80}
              onChange={(e) => {
                setLabel(e.target.value);
                if (error) setError(null);
              }}
              aria-describedby={error ? "freeform-error" : undefined}
              className={error ? "border-destructive focus-visible:ring-destructive" : ""}
            />
            {error && (
              <p id="freeform-error" className="text-destructive text-xs" role="alert">
                {error}
              </p>
            )}
            <p className="text-muted-foreground text-xs">
              {label.length}/80 tegn · vises som et element på tidslinjen
            </p>
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Avbryt
            </Button>
            <Button type="submit" disabled={!label.trim()}>
              Legg til
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
