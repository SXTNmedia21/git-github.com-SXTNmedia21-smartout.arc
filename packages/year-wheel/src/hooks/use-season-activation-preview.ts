/**
 * use-season-activation-preview.ts
 *
 * Read-only preview for SeasonActivationProposalModal (ADR-0200 §UI Contract).
 *
 * Returns the data the 6-state matrix needs to render before the manager
 * confirms season activation:
 *   - departments: active departments in the workspace
 *   - existingRows: department_operating_hours already scoped to this season
 *   - defaultRows: department_operating_hours with NULL season_id (what the
 *                  activation trigger would copy)
 *   - rowsToGenerate: 0 when existingRows > 0 (idempotent no-op state),
 *                     else defaultRows (what the trigger will generate)
 *
 * No mutations. No telemetry — the modal emits `season activation_preview`
 * when it opens. RLS is the authority gate; queries are workspace-scoped.
 *
 * Column note (ADR-0200 Invariant 9): `department.is_active` is the active
 * filter. The `department` table does not have a soft-delete timestamp column.
 */

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";

export type SeasonActivationPreview = {
  departments: number;
  existingRows: number;
  defaultRows: number;
  rowsToGenerate: number;
};

export function useSeasonActivationPreview(
  seasonId: string | null,
  workspaceId: string | null,
): UseQueryResult<SeasonActivationPreview> {
  const supabase = createClient();

  return useQuery({
    // Query key per ADR-0200 §UI Contract spec. seasonId is workspace-unique
    // (UUID), so omitting workspaceId from the key is safe.
    queryKey: ["season-activation-preview", seasonId],
    queryFn: async (): Promise<SeasonActivationPreview> => {
      if (!seasonId || !workspaceId) {
        // `enabled` guards this, but TypeScript + defensive runtime.
        return { departments: 0, existingRows: 0, defaultRows: 0, rowsToGenerate: 0 };
      }

      const [departmentsResult, existingRowsResult, defaultRowsResult] = await Promise.all([
        supabase
          .from("department")
          .select("*", { count: "exact", head: true })
          .eq("workspace_id", workspaceId)
          .eq("is_active", true),
        supabase
          .from("department_operating_hours")
          .select("*", { count: "exact", head: true })
          .eq("workspace_id", workspaceId)
          .eq("season_id", seasonId),
        supabase
          .from("department_operating_hours")
          .select("*", { count: "exact", head: true })
          .eq("workspace_id", workspaceId)
          .is("season_id", null),
      ]);

      if (departmentsResult.error) throw new Error(departmentsResult.error.message);
      if (existingRowsResult.error) throw new Error(existingRowsResult.error.message);
      if (defaultRowsResult.error) throw new Error(defaultRowsResult.error.message);

      const departments = departmentsResult.count ?? 0;
      const existingRows = existingRowsResult.count ?? 0;
      const defaultRows = defaultRowsResult.count ?? 0;
      const rowsToGenerate = existingRows > 0 ? 0 : defaultRows;

      return { departments, existingRows, defaultRows, rowsToGenerate };
    },
    enabled: !!seasonId && !!workspaceId,
    staleTime: 30 * 1000, // 30s — preview is cheap, cache briefly.
  });
}
