"use client";

/**
 * InvitationStatusBadge + deriveDisplayStatus
 *
 * The DB enum workspace_invitation.status is the write-side truth
 * (pending | accepted | expired | cancelled). The UI display space extends
 * this with "opened" — resolved at read time from the presence of an
 * opened_at timestamp, per L-0090 (enum-vs-timestamp cascade heuristic).
 *
 * On-read expiry check is applied here too (Auth Spec Council Q7 = b):
 * if status is "pending" but expires_at is in the past, we display
 * "expired" without waiting for a cron job to mutate the row.
 *
 * `deriveDisplayStatus` is a pure function — unit-testable and shared by
 * both the admin InvitationStatusList and any page that needs to show a
 * single invitation's status. Exported separately so non-rendering call
 * sites (telemetry branching, email copy) can use the same derivation.
 */

import { cn } from "@/lib/utils";

export type InvitationDbStatus = "pending" | "accepted" | "expired" | "cancelled";

export type DisplayStatus = "pending" | "opened" | "accepted" | "expired" | "cancelled";

export type InvitationForStatus = {
  status: InvitationDbStatus;
  opened_at: string | null;
  /** ISO timestamp string. */
  expires_at: string;
};

/**
 * Pure derivation: (db status, opened_at, expires_at) -> display status.
 *
 * Order matters:
 *   1. Explicit terminal states (accepted, cancelled) win — they don't flip.
 *   2. Pending + past-expiry -> expired (on-read).
 *   3. Pending + opened_at present -> opened.
 *   4. Otherwise -> pending.
 */
export function deriveDisplayStatus(invitation: InvitationForStatus): DisplayStatus {
  if (invitation.status === "accepted") return "accepted";
  if (invitation.status === "cancelled") return "cancelled";
  if (invitation.status === "expired") return "expired";

  // status === "pending"
  if (new Date(invitation.expires_at).getTime() < Date.now()) {
    return "expired";
  }
  if (invitation.opened_at) {
    return "opened";
  }
  return "pending";
}

// Nordic Split semantic token mapping. Tokens confirmed to exist in
// packages/design-tokens/src/tokens.css: --success, --warning, --info,
// --destructive, --muted, --muted-foreground.
const STATUS_STYLES: Record<DisplayStatus, { pill: string; dot: string; label: string }> = {
  pending: {
    pill: "bg-muted text-muted-foreground border-border/60",
    dot: "bg-muted-foreground/70",
    label: "Venter",
  },
  opened: {
    pill: "bg-info/10 text-info border-info/20",
    dot: "bg-info",
    label: "Åpnet",
  },
  accepted: {
    pill: "bg-success/10 text-success border-success/20",
    dot: "bg-success",
    label: "Godtatt",
  },
  expired: {
    pill: "bg-warning/10 text-warning border-warning/20",
    dot: "bg-warning",
    label: "Utløpt",
  },
  cancelled: {
    pill: "bg-destructive/10 text-destructive border-destructive/20",
    dot: "bg-destructive",
    label: "Kansellert",
  },
};

type Props = {
  invitation: InvitationForStatus;
  className?: string;
};

export function InvitationStatusBadge({ invitation, className }: Props) {
  const status = deriveDisplayStatus(invitation);
  const style = STATUS_STYLES[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        style.pill,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} aria-hidden />
      {style.label}
    </span>
  );
}
