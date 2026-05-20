/**
 * Per-shift pipeline lookup for the mobile ShiftCard lock indicator.
 *
 * Fetches `/api/schedule/shifts/[id]/pipeline` via Bearer auth (dual-auth route).
 * Mirrors `apps/web/src/app/dashboard/schedule/_hooks/use-shift-pipeline.ts`.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getWebApiUrl } from "@/lib/web-api";

export type ShiftPipelineInfo = {
  pipeline_instance_id: string;
  blueprint_id: string;
  status: string;
};

type PipelineResponse = { pipeline: ShiftPipelineInfo | null };

async function fetchShiftPipeline(shiftId: string): Promise<PipelineResponse> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Ikke innlogget.");

  const url = `${getWebApiUrl()}/api/schedule/shifts/${shiftId}/pipeline`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error(`pipeline fetch failed: ${res.status}`);
  return (await res.json()) as PipelineResponse;
}

export function useShiftPipeline(shiftId: string | null | undefined) {
  return useQuery<PipelineResponse>({
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
