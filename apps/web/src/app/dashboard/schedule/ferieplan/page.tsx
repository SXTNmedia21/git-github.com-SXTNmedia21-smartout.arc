import { Suspense } from "react";
import { createClient } from "@smartout/supabase/server";
import { resolveDashboardContext } from "../../_data/resolve-page-context";
import { FerieplanPageClient } from "./_components/FerieplanPageClient";
import FerieplanLoading from "./loading";

/**
 * /dashboard/schedule/ferieplan — Ferieplan tab (Vaktplan hub §3).
 *
 * Shows all vacation absences for this workspace.
 * Filter: schedule_absence.absence_type = 'vacation'.
 *
 * Server component — auth + workspace resolved server-side.
 * Data passed to FerieplanPageClient for client-side view-mode rendering.
 *
 * Spec: docs/design/sitemap/web/00-CANONICAL.md §3, §6.
 */
export default async function FerieplanPage() {
  const { workspace } = await resolveDashboardContext();
  const supabase = await createClient();

  const { data: absences, error } = await supabase
    .from("schedule_absence")
    .select("*, profile:employee_id(display_name)")
    .eq("workspace_id", workspace.workspace_id)
    .eq("absence_type", "vacation")
    .order("start_date", { ascending: false });

  // Surface fetch errors gracefully — render empty state rather than hard-crash.
  const safeAbsences = error ? [] : (absences ?? []);

  return (
    <Suspense fallback={<FerieplanLoading />}>
      <FerieplanPageClient absences={safeAbsences} />
    </Suspense>
  );
}
