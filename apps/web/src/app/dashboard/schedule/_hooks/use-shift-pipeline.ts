import { useQuery } from "@tanstack/react-query";

/**
 * Lightweight per-shift pipeline lookup for the pipeline-lock indicator.
 *
 * Reads `GET /api/schedule/shifts/[id]/pipeline` which returns `{ pipeline }`
 * where `pipeline` is null when the shift carries no pipeline_lock_state_id.
 *
 * V1 fires one fetch per shift with a 10s stale window — TanStack auto-dedup
 * collapses simultaneous identical keys. Bulk endpoint planned for V2 once
 * lock-density warrants it.
 */

export type ShiftPipelineInfo = {
  pipeline_instance_id: string;
  blueprint_id: string;
  status: string;
};

type PipelineResponse = { pipeline: ShiftPipelineInfo | null };

async function fetchShiftPipeline(shiftId: string): Promise<PipelineResponse> {
  const res = await fetch(`/api/schedule/shifts/${shiftId}/pipeline`);
  if (!res.ok) throw new Error(`pipeline fetch failed: ${res.status}`);
  return (await res.json()) as PipelineResponse;
}

export function useShiftPipeline(shiftId: string | null | undefined) {
  return useQuery({
    queryKey: ["shift-pipeline", shiftId],
    queryFn: () => fetchShiftPipeline(shiftId as string),
    enabled: Boolean(shiftId),
    staleTime: 10_000,
    retry: false,
  });
}

export function resolvePipelineLabel(blueprintId: string): string {
  if (blueprintId === "shift_swap_lifecycle") return "Vaktbytte under behandling";
  if (blueprintId === "marketplace_lifecycle") return "Åpent vakttilbud — venter på godkjenning";
  return "I behandling";
}
