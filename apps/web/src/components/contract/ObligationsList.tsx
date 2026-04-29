// apps/web/src/components/contract/ObligationsList.tsx
// What: List of contract_obligation rows for a given contract.
// Why: Journey 3 — employee sees obligations post-signing; Journey 4 — tracks completion.
// Driving ADR: ADR-0241 (contract schema migration foundation), ADR-0243 (obligation lifecycle trigger semantics)
//
// NOTE: contract_obligation table is defined in ADR-0241 migration (Phase 0a).
// Using local type here until supabase types are regenerated post-migration.

"use client";

import { AlertTriangle, CheckCircle2, Clock, ExternalLink } from "lucide-react";
import Link from "next/link";

// Local placeholder type — replace with Database["public"]["Tables"]["contract_obligation"]["Row"]
// once ADR-0241 migration runs and types are regenerated.
type ContractObligation = {
  id: string;
  contract_id: string;
  obligation_type:
    | "training_required"
    | "certification_required"
    | "activity_required"
    | "attendance_required";
  policy_id: string | null;
  protocol_id: string | null;
  due_within_days: number | null;
  is_blocker: boolean;
  reference_text: string;
  status: "pending" | "in_progress" | "completed" | "overdue" | "waived";
  started_at: string | null;
  completed_at: string | null;
  waived_at: string | null;
  waived_reason: string | null;
};

interface ObligationsListProps {
  obligations: ContractObligation[];
  /** Workspace slug for deep-link routing to /dashboard/competence/protocol/[id] */
  workspaceSlug?: string;
  onObligationClick?: (obligationId: string) => void;
}

const STATUS_CONFIG: Record<
  ContractObligation["status"],
  { label: string; className: string; icon: React.ReactNode }
> = {
  pending: {
    label: "Venter",
    className: "bg-muted text-muted-foreground",
    icon: <Clock className="h-3 w-3" />,
  },
  in_progress: {
    label: "Pågår",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    icon: <Clock className="h-3 w-3" />,
  },
  completed: {
    label: "Fullført",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  overdue: {
    label: "Forfalt",
    className: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    icon: <AlertTriangle className="h-3 w-3" />,
  },
  waived: {
    label: "Frafalt",
    className: "bg-muted text-muted-foreground",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
};

export function ObligationsList({
  obligations,
  workspaceSlug,
  onObligationClick,
}: ObligationsListProps) {
  if (obligations.length === 0) {
    return <p className="text-muted-foreground text-sm">Ingen forpliktelser</p>;
  }

  const completedCount = obligations.filter(
    (o) => o.status === "completed" || o.status === "waived",
  ).length;

  return (
    <div className="space-y-3">
      {/* Bulk progress header */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-medium">Forpliktelser</span>
        <span
          className={`font-semibold ${completedCount === obligations.length ? "text-emerald-500" : "text-foreground"}`}
          aria-live="polite"
          aria-atomic="true"
        >
          {completedCount} av {obligations.length} fullført
        </span>
      </div>

      {/* Obligation rows */}
      <ul className="space-y-2" role="list" aria-label="Kontraktforpliktelser">
        {obligations.map((o) => {
          const cfg = STATUS_CONFIG[o.status];
          const protocolHref =
            o.protocol_id && workspaceSlug
              ? `/dashboard/competence/protocol/${o.protocol_id}`
              : null;

          const RowContent = (
            <div className="border-border bg-card hover:bg-muted/50 flex items-center justify-between gap-3 rounded-lg border p-3 text-sm transition-colors">
              <div className="flex min-w-0 flex-1 items-start gap-2">
                {o.is_blocker && (
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0 text-rose-500"
                    aria-label="Blokkerer"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-foreground truncate font-medium">{o.reference_text}</p>
                  {o.due_within_days !== null &&
                    o.status !== "completed" &&
                    o.status !== "waived" && (
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        Frist: {o.due_within_days} dager fra start
                      </p>
                    )}
                  {o.completed_at && (
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      Fullført:{" "}
                      {new Date(o.completed_at).toLocaleDateString("nb-NO", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.className}`}
                >
                  {cfg.icon}
                  {cfg.label}
                </span>
                {protocolHref && o.status !== "completed" && (
                  <ExternalLink className="text-muted-foreground h-3.5 w-3.5" aria-hidden="true" />
                )}
              </div>
            </div>
          );

          return (
            <li key={o.id}>
              {protocolHref ? (
                <Link
                  href={protocolHref}
                  onClick={() => onObligationClick?.(o.id)}
                  aria-label={`${o.reference_text} — ${cfg.label}`}
                >
                  {RowContent}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => onObligationClick?.(o.id)}
                  className="w-full text-left"
                  aria-label={`${o.reference_text} — ${cfg.label}`}
                >
                  {RowContent}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
