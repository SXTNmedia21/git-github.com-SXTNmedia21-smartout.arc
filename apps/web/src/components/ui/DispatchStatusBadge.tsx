"use client";

// DispatchStatusBadge — 5-state pill + icon for the invoice_dispatch
// lifecycle. Nordic Split sibling to InvoiceStatusBadge from
// @smartout/ui: same rounded-pill shape + Lucide icon-first pattern,
// different state palette (dispatch never flips 'void'/'overdue').
//
// Sibling rather than reuse because the DB enum dispatch_status differs
// from invoice_status (in_flight/bounced vs issued/overdue/void) and
// the colour semantics diverge (in_flight uses the spring-pulse motion,
// not the invoice 'issued' info-tone).
//
// Motion (spec §13):
//   in_flight → spring ring pulse, stiffness 35 / damping 22 / mass 2.2,
//   2.2s cycle, scale 1.00 ↔ 1.03, opacity 0.6 ↔ 1.0. Reduced-motion
//   falls back to a static ring.
//
// Accessibility: role="status" + aria-live="polite" so screen readers
// announce lifecycle transitions without nagging. Icon duplicates
// colour meaning so the badge survives colour-blind operators.

import { motion, useReducedMotion } from "framer-motion";
import { motion as motionTokens } from "@smartout/design-tokens";
import { AlertTriangle, CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type DispatchStatus = "pending" | "in_flight" | "delivered" | "failed" | "bounced";

type DispatchStatusBadgeProps = {
  status: DispatchStatus;
  size?: "sm" | "md";
  className?: string;
  /** Optional override label (e.g. tooltip-augmented failure reason). */
  label?: string;
};

const STATUS_CONFIG: Record<
  DispatchStatus,
  {
    label: string;
    bg: string;
    fg: string;
    ringColor?: string;
    Icon: typeof Clock;
  }
> = {
  pending: {
    label: "Venter",
    bg: "bg-muted",
    fg: "text-muted-foreground",
    Icon: Clock,
  },
  in_flight: {
    label: "Sender",
    bg: "bg-info/15",
    fg: "text-info-foreground",
    ringColor: "bg-info/30",
    Icon: Loader2,
  },
  delivered: {
    label: "Levert",
    bg: "bg-success/20",
    fg: "text-success-foreground",
    Icon: CheckCircle2,
  },
  failed: {
    label: "Feilet",
    bg: "bg-destructive/15",
    fg: "text-destructive-foreground",
    Icon: XCircle,
  },
  bounced: {
    label: "Returnert",
    bg: "bg-warning/25",
    fg: "text-warning-foreground",
    Icon: AlertTriangle,
  },
};

export function DispatchStatusBadge({
  status,
  size = "md",
  className,
  label,
}: DispatchStatusBadgeProps) {
  const cfg = STATUS_CONFIG[status];
  const copy = label ?? cfg.label;
  const prefersReducedMotion = useReducedMotion();
  const sizeClasses = size === "sm" ? "text-xs px-2 py-0.5 gap-1" : "text-sm px-2.5 py-1 gap-1.5";
  const iconSize = size === "sm" ? "size-3" : "size-3.5";

  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "relative inline-flex items-center rounded-full font-medium",
        cfg.bg,
        cfg.fg,
        sizeClasses,
        className,
      )}
    >
      {status === "in_flight" && !prefersReducedMotion && cfg.ringColor ? (
        <motion.span
          aria-hidden
          className={cn("absolute inset-0 -z-0 rounded-full", cfg.ringColor)}
          initial={{ opacity: 0.6, scale: 1 }}
          animate={{ opacity: [0.6, 1, 0.6], scale: [1, 1.03, 1] }}
          transition={{
            type: "spring",
            ...motionTokens.spring,
            repeat: Infinity,
            duration: motionTokens.enterMs * 4.4 / 1000,
          }}
        />
      ) : null}
      <cfg.Icon
        aria-hidden
        className={cn(
          "relative z-10",
          iconSize,
          status === "in_flight" && !prefersReducedMotion && "animate-spin",
        )}
      />
      <span className="relative z-10">{copy}</span>
    </span>
  );
}
