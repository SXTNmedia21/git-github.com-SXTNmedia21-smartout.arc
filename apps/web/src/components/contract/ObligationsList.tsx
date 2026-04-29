// apps/web/src/components/contract/ObligationsList.tsx
// What: List of contract_obligation rows for a given contract.
// Why: Journey 3 — employee sees obligations post-signing; Journey 4 — tracks completion.
// Driving ADR: ADR-0233 (contract schema migration foundation), ADR-0235 (obligation lifecycle trigger semantics)
//
// NOTE: contract_obligation table is defined in ADR-0233 migration (Phase 0a).
// Using local type here until supabase types are regenerated post-migration.

"use client";

// Local placeholder type — replace with Database["public"]["Tables"]["contract_obligation"]["Row"]
// once ADR-0233 migration runs and types are regenerated.
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
  onObligationClick?: (obligationId: string) => void;
}

export function ObligationsList({
  obligations,
  onObligationClick,
}: ObligationsListProps) {
  return (
    <ul>
      {obligations.map((o) => (
        <li key={o.id}>
          {/* TODO Phase 0a: implement obligation row with status pill, due date, CTA */}
          <button
            type="button"
            onClick={() => onObligationClick?.(o.id)}
          >
            {o.reference_text}
          </button>
        </li>
      ))}
    </ul>
  );
}
