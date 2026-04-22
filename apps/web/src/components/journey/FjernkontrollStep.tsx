// apps/web/src/components/journey/FjernkontrollStep.tsx
//
// Per-step row renderer for the Fjernkontroll (ADR-0177).
//
// Why separate from Fjernkontroll.tsx:
//   - Step rows are the bulk of the visual payload; a long IR renders
//     dozens of these. Keeping the renderer pure makes memoisation and
//     test isolation straightforward.
//   - The outer Fjernkontroll owns the state machine + realtime
//     subscription; the row is state-agnostic and purely presentational,
//     fed by props. Prevents the "pass the whole snapshot down" smell.
//
// Tokens only (council red-line R5.1-4):
//   - `bg-muted`, `bg-foreground/5`, `text-foreground`, `text-muted-foreground`
//   - `border-border`, `border-foreground/10` for status accents.
//   - Zero hex, zero zinc/gray/slate.

"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, CircleDot, Loader2, XCircle, PauseCircle, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { FJERN_SPRING } from "./fjernkontroll-spring";

export type StepStatus = "pending" | "running" | "completed" | "failed" | "stuck" | "paused";

export type FjernkontrollStepProps = {
  index: number;
  title: string;
  description?: string;
  status: StepStatus;
  isCurrent?: boolean;
};

type StatusConfig = {
  Icon: typeof Check;
  iconTone: string;
  rowTone: string;
  srLabel: string;
};

/**
 * Token-mapped config. Every value references a Nordic Split semantic
 * token — no literal hex, no tailwind palette names (zinc/gray/slate).
 */
const STATUS_CONFIG: Record<StepStatus, StatusConfig> = {
  pending: {
    Icon: CircleDot,
    iconTone: "text-muted-foreground",
    rowTone: "bg-muted/40 border-border",
    srLabel: "Venter",
  },
  running: {
    Icon: Loader2,
    iconTone: "text-foreground",
    rowTone: "bg-foreground/5 border-foreground/10",
    srLabel: "Kjører",
  },
  completed: {
    Icon: Check,
    iconTone: "text-foreground",
    rowTone: "bg-foreground/5 border-foreground/10",
    srLabel: "Fullført",
  },
  failed: {
    Icon: XCircle,
    iconTone: "text-destructive",
    rowTone: "bg-muted border-destructive/20",
    srLabel: "Feilet",
  },
  stuck: {
    Icon: HelpCircle,
    iconTone: "text-foreground",
    rowTone: "bg-muted border-border",
    srLabel: "Fast",
  },
  paused: {
    Icon: PauseCircle,
    iconTone: "text-muted-foreground",
    rowTone: "bg-muted/40 border-border",
    srLabel: "Pauset",
  },
};

export function FjernkontrollStep({
  index,
  title,
  description,
  status,
  isCurrent,
}: FjernkontrollStepProps) {
  const cfg = STATUS_CONFIG[status];
  const prefersReducedMotion = useReducedMotion();

  // Spinning loader only on `running` — reduced-motion users get a
  // static icon but the surrounding ARIA live region still announces
  // state transitions so assistive tech is never silent.
  const iconSpin = status === "running" && !prefersReducedMotion;

  return (
    <motion.li
      layout
      initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", ...FJERN_SPRING }}
      className={cn(
        "flex items-start gap-3 rounded-md border p-3",
        cfg.rowTone,
        isCurrent && "ring-foreground/20 ring-1",
      )}
    >
      <span
        className={cn(
          "bg-background mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border",
          "border-border",
          cfg.iconTone,
        )}
        aria-hidden
      >
        <cfg.Icon className={cn("size-3.5", iconSpin && "animate-spin")} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-foreground text-sm font-medium">
          <span className="text-muted-foreground mr-2 font-mono text-xs">
            {String(index + 1).padStart(2, "0")}
          </span>
          {title}
        </p>
        {description ? <p className="text-muted-foreground mt-0.5 text-xs">{description}</p> : null}
        <span className="sr-only">Status: {cfg.srLabel}</span>
      </div>
    </motion.li>
  );
}
