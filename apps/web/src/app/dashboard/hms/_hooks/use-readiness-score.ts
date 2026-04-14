"use client";

import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { useReadinessScore as useReadinessScoreShared } from "@smartout/training";

export function useReadinessScore(profileId: string | null) {
  const { workspace } = useWorkspace();
  const supabase = createClient();
  return useReadinessScoreShared({
    profileId,
    workspaceId: workspace.workspace_id,
    supabase,
  });
}
