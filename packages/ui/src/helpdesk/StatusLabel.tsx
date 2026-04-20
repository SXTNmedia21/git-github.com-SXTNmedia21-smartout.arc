/**
 * StatusLabel (web) — uppercase mono label per Spec §2.1 + §1.4 badge row.
 *
 * Pure presentation. Pulls label text from a consumer-supplied map so we
 * don't wire i18n into a shared primitive. Consumers pass the already-
 * translated string; defaults exist for dev ergonomics.
 */

import * as React from "react";
import { cn } from "../lib/utils";
import type { TicketStatus } from "./types";

export type StatusLabelSize = "sm" | "md";

export type StatusLabelProps = {
  status: TicketStatus;
  /** Pre-translated labels keyed by status. */
  labels?: Record<TicketStatus, string>;
  size?: StatusLabelSize;
  className?: string;
};

const DEFAULT_LABELS: Record<TicketStatus, string> = {
  waiting: "VENTER",
  active: "AKTIV",
  complete: "LØST",
};

const SIZE_CLASS: Record<StatusLabelSize, string> = {
  sm: "text-[10px]",
  md: "text-[11px]",
};

export function StatusLabel({
  status,
  labels = DEFAULT_LABELS,
  size = "md",
  className,
}: StatusLabelProps) {
  return (
    <span
      className={cn(
        "text-muted-foreground font-mono tracking-[0.08em] uppercase",
        SIZE_CLASS[size],
        className,
      )}
    >
      {labels[status]}
    </span>
  );
}
