// apps/web/src/components/journey/FjernkontrollActions.tsx
//
// Button cluster for the Fjernkontroll (ADR-0177).
//
// Surface area is intentionally tiny — start / pause / resume / retry /
// abandon / reset — so this component is easy to test and easy to embed
// in a mobile BFF proxy later (ADR-0132 binds the eventual mobile thin
// client).
//
// Exit edges from `stuck` and `failed` (Track C honesty fix): prior to
// this wiring, a user whose run timed out or failed had no outbound
// control — the UI was locked. `stuck` now offers Prøv igjen / Avslutt;
// `failed` offers Start på nytt (explicit reset, clearing lastError).
//
// Touch targets: every button hits the 44pt minimum via the Nordic
// Split `h-11` (= 44px) baseline. Smaller buttons would break ADR-0177
// §Accessibility.
//
// Tokens only (R5.1-4):
//   - `bg-foreground`, `text-background`, `hover:bg-foreground/90`
//   - `bg-muted`, `text-foreground`, `hover:bg-muted/80`
//   - `border-border`
//   - NO hardcoded hex, NO zinc/gray/slate palette names.

"use client";

import { Play, Pause, RotateCw, RotateCcw, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FjernkontrollState } from "./useFjernkontrollMachine";

export type FjernkontrollActionsProps = {
  state: FjernkontrollState;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onRetry: () => void;
  /**
   * Abandon a stuck run — terminal user-cancellation path from `stuck`.
   * Hook dispatches `abandon` and the machine returns to `idle`. Callers
   * that want to emit `journey.run_failed` with `{ error_code:
   * "abandoned_by_user" }` (ADR-0175) wrap this handler at the call site.
   */
  onAbandon: () => void;
  /**
   * Reset a failed run — explicit recovery path from `failed` back to
   * `idle`. Distinct from `onStart`: reset stays in `idle` awaiting a
   * fresh Start, so the user can re-read the failure banner before
   * committing to another run.
   */
  onReset: () => void;
  disabled?: boolean;
};

const PRIMARY = cn(
  "bg-foreground text-background hover:bg-foreground/90",
  "inline-flex h-11 min-w-11 items-center gap-2 rounded-md px-4 text-sm font-medium",
  "focus-visible:ring-foreground/40 focus-visible:ring-2 focus-visible:outline-none",
  "disabled:opacity-50 disabled:pointer-events-none",
);

const SECONDARY = cn(
  "bg-muted text-foreground hover:bg-muted/80 border border-border",
  "inline-flex h-11 min-w-11 items-center gap-2 rounded-md px-4 text-sm font-medium",
  "focus-visible:ring-foreground/40 focus-visible:ring-2 focus-visible:outline-none",
  "disabled:opacity-50 disabled:pointer-events-none",
);

export function FjernkontrollActions({
  state,
  onStart,
  onPause,
  onResume,
  onRetry,
  onAbandon,
  onReset,
  disabled,
}: FjernkontrollActionsProps) {
  // One or two actions per state — keeps the thumb-zone scan cheap on
  // mobile (ADR-0177 §Accessibility) while still giving `stuck` users a
  // visible abort edge.
  if (state === "idle") {
    return (
      <button type="button" className={PRIMARY} onClick={onStart} disabled={disabled}>
        <Play className="size-4" aria-hidden="true" />
        Start
      </button>
    );
  }

  if (state === "running") {
    return (
      <button type="button" className={SECONDARY} onClick={onPause} disabled={disabled}>
        <Pause className="size-4" aria-hidden="true" />
        Pause
      </button>
    );
  }

  if (state === "paused") {
    return (
      <button type="button" className={PRIMARY} onClick={onResume} disabled={disabled}>
        <Play className="size-4" aria-hidden="true" />
        Fortsett
      </button>
    );
  }

  if (state === "stuck") {
    // Primary = Prøv igjen (retry the current step).
    // Secondary = Avslutt (abandon back to idle — terminal user-cancel).
    return (
      <div className="flex items-center gap-2">
        <button type="button" className={PRIMARY} onClick={onRetry} disabled={disabled}>
          <RotateCw className="size-4" aria-hidden="true" />
          Prøv igjen
        </button>
        <button type="button" className={SECONDARY} onClick={onAbandon} disabled={disabled}>
          <X className="size-4" aria-hidden="true" />
          Avslutt
        </button>
      </div>
    );
  }

  if (state === "failed") {
    // Explicit reset — lands in idle awaiting a deliberate Start.
    return (
      <button type="button" className={PRIMARY} onClick={onReset} disabled={disabled}>
        <RefreshCw className="size-4" aria-hidden="true" />
        Start på nytt
      </button>
    );
  }

  // completed — terminal. Offer a restart via start (single-click flow).
  // RotateCcw reads as "replay this journey"; distinct from the RefreshCw
  // used on `failed` which signals "clear the error and start over".
  return (
    <button type="button" className={SECONDARY} onClick={onStart} disabled={disabled}>
      <RotateCcw className="size-4" aria-hidden="true" />
      Start på nytt
    </button>
  );
}
