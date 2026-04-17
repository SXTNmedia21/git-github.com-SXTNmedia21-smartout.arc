import { redirect } from "next/navigation";
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";

import { DriftPanel, type DriftRow } from "./_components/drift-panel";

// Phase 8.2 — Basis drift review.
//
// `basis_drift_event` rows are written by the detect_billing_basis_drift
// trigger (Task 1.7) whenever a schedule_shift UPDATE or DELETE
// would change a count in an already-frozen usage_snapshot.
// Platform-admin reviews the drift and records a resolution:
// ignored | credit_note_issued | reinvoiced.
//
// This page shows the unreviewed backlog; resolved rows stay in the
// table but are visually dimmed (or filtered out in a later iteration).

export default async function DriftPage() {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/");

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("basis_drift_event")
    .select(
      "drift_event_id, invoice_id, usage_snapshot_id, shift_id, drift_type, old_value, new_value, detected_at, resolution, reviewed_at",
    )
    .is("resolution", null)
    .order("detected_at", { ascending: true })
    .limit(200);

  if (error) {
    console.error("[drift/page] query failed:", error);
  }

  const rows = (data ?? []) as DriftRow[];

  return <DriftPanel rows={rows} />;
}
