"use client";

import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// IntegrationStatusIndicator — the 4-state badge used in
// IntegrationsList rows. Spec §13 motion:
//   - healthy     → static primary glow + CheckCircle2
//   - error       → warm amber flash + XCircle
//   - in_flight   → spring pulse ring (stiffness 35, damping 22, mass 2.2)
//   - placeholder → muted tone + AlertTriangle + inline badge copy
//
// Accessibility: role="status" + aria-live="polite" so screen readers
// announce state transitions (in_flight → healthy) without nagging.
//
// ADR-0129: placeholder rows MUST be visually distinct — the label
// inside this badge ("Placeholder — ingen ekstern effekt") prevents
// operator confusion between a mocked probe and a real success.

export type IntegrationStatusState = "healthy" | "error" | "in_flight" | "placeholder";

type Props = {
  state: IntegrationStatusState;
  /** Optional override copy (e.g. error message tooltip). */
  label?: string;
};

const STATE_META: Record<
  IntegrationStatusState,
  { defaultLabel: string; icon: typeof CheckCircle2 }
> = {
  healthy: { defaultLabel: "Aktiv", icon: CheckCircle2 },
  error: { defaultLabel: "Feil", icon: XCircle },
  in_flight: { defaultLabel: "Synkroniserer", icon: Loader2 },
  placeholder: { defaultLabel: "Placeholder — ingen ekstern effekt", icon: AlertTriangle },
};

export function IntegrationStatusIndicator({ state, label }: Props) {
  const prefersReducedMotion = useReducedMotion();
  const { defaultLabel, icon: Icon } = STATE_META[state];
  const copy = label ?? defaultLabel;

  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        state === "healthy" && "bg-primary/10 text-primary",
        state === "error" && "bg-destructive/10 text-destructive",
        state === "in_flight" && "bg-muted text-muted-foreground relative",
        state === "placeholder" && "bg-muted text-muted-foreground",
      )}
    >
      {state === "in_flight" && !prefersReducedMotion ? (
        <motion.span
          aria-hidden
          className="bg-primary/30 absolute inset-0 -z-0 rounded-full"
          initial={{ opacity: 0.6, scale: 1 }}
          animate={{ opacity: [0.6, 1, 0.6], scale: [1, 1.03, 1] }}
          transition={{
            type: "spring",
            stiffness: 35,
            damping: 22,
            mass: 2.2,
            repeat: Infinity,
            duration: 2.2,
          }}
        />
      ) : null}
      <Icon
        aria-hidden
        className={cn(
          "relative z-10 size-3.5",
          state === "in_flight" && !prefersReducedMotion && "animate-spin",
        )}
      />
      <span className="relative z-10">{copy}</span>
    </span>
  );
}
