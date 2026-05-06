"use client";

// PaymentStatusBadge — 6-state pill + icon for the payment lifecycle
// (Fase 3A). Nordic Split sibling to InvoiceStatusBadge (@smartout/ui)
// and DispatchStatusBadge — same rounded-pill shape + Lucide icon-first
// pattern, different state palette.
//
// Why sibling and not reuse?
//   The DB enum payment_status (pending | processing | succeeded |
//   failed | refunded | partially_refunded) is a distinct state machine
//   from invoice_status or dispatch_status. Sharing one badge would
//   force generic labels ("Utkast" for payments makes no sense) and
//   blur colour semantics — "processing" uses a pulse-dot that neither
//   invoice draft nor dispatch in_flight wants.
//
// Motion (spec §3.5, Frontend council R2):
//   processing → ambient pulse dot (spring stiffness 35 / damping 22 /
//   mass 2.2, 2.2s cycle). Icon and text stay still; only the dot
//   pulses so the badge never feels jittery in a dense table.
//   Reduced-motion falls back to a static dot — the colour still
//   communicates "in progress".
//
// Accessibility (WCAG 4.1.3):
//   role="status" + aria-live="polite" so screen readers announce the
//   transition when the server action flips the payment row.

import { motion, useReducedMotion } from "framer-motion";
import { motion as motionTokens } from "@smartout/design-tokens";
import { CheckCircle, Clock, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export type PaymentStatus =
  | "pending"
  | "processing"
  | "succeeded"
  | "failed"
  | "refunded"
  | "partially_refunded";

type PaymentStatusBadgeProps = {
  status: PaymentStatus;
  size?: "sm" | "md";
  className?: string;
  /** Optional override label (e.g. short-code error summary on failed). */
  label?: string;
};

type StatusConfig = {
  label: string;
  bg: string;
  fg: string;
  border?: string;
  Icon?: typeof Clock;
  dotColor?: string;
};

const STATUS_CONFIG: Record<PaymentStatus, StatusConfig> = {
  pending: {
    label: "Venter",
    bg: "bg-muted",
    fg: "text-muted-foreground",
    Icon: Clock,
  },
  processing: {
    // Spec: processing uses pulse-dot (no icon) so the motion reads
    // as "heartbeat" rather than a spinning loader.
    label: "Behandler",
    bg: "bg-muted",
    fg: "text-foreground",
    dotColor: "bg-foreground/60",
  },
  succeeded: {
    label: "Betalt",
    bg: "bg-foreground/5",
    fg: "text-foreground",
    border: "border-foreground/10",
    Icon: CheckCircle,
  },
  failed: {
    label: "Feilet",
    bg: "bg-muted",
    fg: "text-foreground",
    border: "border-destructive/20",
    // Destructive-tone dot signals the failure without flooding the
    // badge in red — aligns with the Frontend council "warning, not
    // alarm" framing for transient Stripe failures.
    dotColor: "bg-destructive",
  },
  refunded: {
    label: "Refundert",
    bg: "bg-muted",
    fg: "text-muted-foreground",
    Icon: RotateCcw,
  },
  partially_refunded: {
    label: "Delvis refundert",
    bg: "bg-muted",
    fg: "text-muted-foreground",
    Icon: RotateCcw,
  },
};

export function PaymentStatusBadge({
  status,
  size = "md",
  className,
  label,
}: PaymentStatusBadgeProps) {
  const cfg = STATUS_CONFIG[status];
  const copy = label ?? cfg.label;
  const prefersReducedMotion = useReducedMotion();
  const sizeClasses = size === "sm" ? "text-xs px-2 py-0.5 gap-1" : "text-sm px-2.5 py-1 gap-1.5";
  const iconSize = size === "sm" ? "size-3" : "size-3.5";
  const dotSize = size === "sm" ? "size-1.5" : "size-2";

  const Icon = cfg.Icon;

  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        cfg.bg,
        cfg.fg,
        cfg.border ?? "border-transparent",
        sizeClasses,
        className,
      )}
    >
      {cfg.dotColor ? (
        prefersReducedMotion ? (
          <span aria-hidden className={cn("rounded-full", cfg.dotColor, dotSize)} />
        ) : (
          <motion.span
            aria-hidden
            className={cn("rounded-full", cfg.dotColor, dotSize)}
            initial={{ opacity: 0.5, scale: 1 }}
            animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.15, 1] }}
            transition={{
              type: "spring",
              ...motionTokens.spring,
              repeat: Infinity,
              duration: (motionTokens.enterMs * 4.4) / 1000,
            }}
          />
        )
      ) : null}
      {Icon ? <Icon aria-hidden className={iconSize} /> : null}
      <span>{copy}</span>
    </span>
  );
}
