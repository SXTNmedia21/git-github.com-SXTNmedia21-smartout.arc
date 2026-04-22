// apps/web/src/components/journey/FjernkontrollActions.tsx
//
// Button cluster for the Fjernkontroll (ADR-0177).
//
// Surface area is intentionally tiny — start / pause / resume / retry —
// so this component is easy to test and easy to embed in a mobile BFF
// proxy later (ADR-0132 binds the eventual mobile thin client).
//
// Touch targets: every button hits the 44pt minimum via the Nordic
// Split `h-11` (= 44px) baseline. Smaller buttons would break ADR-0177
// §Accessibility.
//
// Tokens only (R5.1-4):
//   - `bg-foreground`, `text-background`, `hover:bg-foreground/90`
//   - `bg-muted`, `text-foreground`, `hover:bg-muted/80`
//   - `border-border`

"use client";

import { Play, Pause, RotateCcw, Redo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FjernkontrollState } from "./useFjernkontrollMachine";

export type FjernkontrollActionsProps = {
  state: FjernkontrollState;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onRetry: () => void;
  disabled?: boolean;
};

const PRIMARY = cn(
  "bg-foreground text-background hover:bg-foreground/90",
  "inline-flex h-11 items-center gap-2 rounded-md px-4 text-sm font-medium",
  "focus-visible:ring-foreground/40 focus-visible:ring-2 focus-visible:outline-none",
  "disabled:opacity-50 disabled:pointer-events-none",
);

const SECONDARY = cn(
  "bg-muted text-foreground hover:bg-muted/80 border border-border",
  "inline-flex h-11 items-center gap-2 rounded-md px-4 text-sm font-medium",
  "focus-visible:ring-foreground/40 focus-visible:ring-2 focus-visible:outline-none",
  "disabled:opacity-50 disabled:pointer-events-none",
);

export function FjernkontrollActions({
  state,
  onStart,
  onPause,
  onResume,
  onRetry,
  disabled,
}: FjernkontrollActionsProps) {
  // One primary action per state. No button soup — reduces cognitive
  // load and keeps the thumb-zone single-target on mobile (ADR-0177).
  if (state === "idle") {
    return (
      <button type="button" className={PRIMARY} onClick={onStart} disabled={disabled}>
        <Play className="size-4" aria-hidden />
        Start
      </button>
    );
  }

  if (state === "running") {
    return (
      <button type="button" className={SECONDARY} onClick={onPause} disabled={disabled}>
        <Pause className="size-4" aria-hidden />
        Pause
      </button>
    );
  }

  if (state === "paused") {
    return (
      <button type="button" className={PRIMARY} onClick={onResume} disabled={disabled}>
        <Play className="size-4" aria-hidden />
        Fortsett
      </button>
    );
  }

  if (state === "stuck") {
    return (
      <button type="button" className={PRIMARY} onClick={onRetry} disabled={disabled}>
        <RotateCcw className="size-4" aria-hidden />
        Prøv igjen
      </button>
    );
  }

  // completed / failed — terminal. Offer a restart.
  return (
    <button type="button" className={SECONDARY} onClick={onStart} disabled={disabled}>
      <Redo2 className="size-4" aria-hidden />
      Start på nytt
    </button>
  );
}
