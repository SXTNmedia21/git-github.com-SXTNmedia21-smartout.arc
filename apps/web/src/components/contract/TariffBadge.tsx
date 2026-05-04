// apps/web/src/components/contract/TariffBadge.tsx
// What: Badge showing tariff sync state per ADR-0181 drift indicator.
// Why: Employee /my-contract page needs to surface whether their tariff is current.
// States: green (synced), amber (>7 days stale), red (>30 days stale).
// Phase 0a ships badge + tooltip. Phase 0b adds clickable EntityDrawer destination.
// Driving ADRs: ADR-0181 (tariff sync drift indicator), ADR-0244 (WCAG AAA + motion)
//
// Motion: amber/red pulse on stale state uses animate/transition with
// useReducedMotion guard — static badge if reduced (WCAG AAA requirement per ADR-0244).

"use client";

import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";

type TariffSyncState = "synced" | "pending" | "stale";

interface TariffBadgeProps {
  state: TariffSyncState;
  lastSyncedAt: string | null;
  tariffName: string;
}

/** Derive sync state from lastSyncedAt timestamp. */
export function deriveTariffSyncState(lastSyncedAt: string | null): TariffSyncState {
  if (!lastSyncedAt) return "stale";
  const daysSince = (Date.now() - new Date(lastSyncedAt).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince > 30) return "stale";
  if (daysSince > 7) return "pending";
  return "synced";
}

const STATE_CONFIG = {
  synced: {
    label: "Tariff oppdatert",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    pulse: false,
  },
  pending: {
    label: "Tariff utdatert >7 dager",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    icon: <Clock className="h-3.5 w-3.5" />,
    pulse: true,
  },
  stale: {
    label: "Tariff utdatert >30 dager",
    className: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    pulse: true,
  },
} as const;

export function TariffBadge({ state, lastSyncedAt, tariffName }: TariffBadgeProps) {
  const cfg = STATE_CONFIG[state];
  const prefersReduced = useReducedMotion();

  const formattedDate = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleDateString("nb-NO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : null;

  const tooltipText = [
    tariffName,
    formattedDate ? `Sist synkronisert: ${formattedDate}` : "Aldri synkronisert",
  ].join(" — ");

  return (
    <motion.span
      data-state={state}
      title={tooltipText}
      aria-label={`${cfg.label} — ${tariffName}`}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cfg.className}`}
      animate={cfg.pulse && !prefersReduced ? { opacity: [1, 0.6, 1] } : {}}
      transition={
        cfg.pulse && !prefersReduced ? { duration: 3, repeat: Infinity, ease: "easeInOut" } : {}
      }
    >
      {cfg.icon}
      {tariffName}
    </motion.span>
  );
}
