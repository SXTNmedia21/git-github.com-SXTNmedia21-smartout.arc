import type { UiPhase } from "@smartout/ui";

/**
 * Map reconciliation_status DB enum → UiPhase semantic for PhaseBadge.
 *
 * Source enum (see `supabase/migrations/.../daily_reconciliation.sql`):
 *   open | submitted | awaiting_approval | approved | locked | unreconciled
 *
 * Target UiPhase (from @smartout/ui):
 *   upcoming | active | pending_signoff | closed | missed | locked
 */
export function reconciliationStatusToPhase(status: string): UiPhase {
  switch (status) {
    case "open":
      return "upcoming";
    case "submitted":
    case "awaiting_approval":
      return "pending_signoff";
    case "approved":
      return "closed";
    case "locked":
      return "locked";
    case "unreconciled":
      return "missed";
    default:
      return "upcoming";
  }
}

/** Human-readable status label in Norwegian. */
export function reconciliationStatusLabel(status: string): string {
  switch (status) {
    case "open":
      return "Åpen";
    case "submitted":
      return "Innsendt";
    case "awaiting_approval":
      return "Venter godkjenning";
    case "approved":
      return "Godkjent";
    case "locked":
      return "Låst";
    case "unreconciled":
      return "Ikke avstemt";
    default:
      return status;
  }
}
