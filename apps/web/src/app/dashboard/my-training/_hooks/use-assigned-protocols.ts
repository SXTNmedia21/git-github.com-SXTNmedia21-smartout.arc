"use client";

// Re-exports from @smartout/training for backwards compatibility.
// Web-specific wrapper provides supabase client and workspace context.

import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import {
  useAssignedProtocols as useAssignedProtocolsShared,
  trainingKeys,
} from "@smartout/training";

export type {
  AssignedProtocol,
  AssignedProcedure,
  ProcedureStepWithStatus,
  AssignedKnowledgeTest,
  AssignedConfirmation,
} from "@smartout/training";

// Re-export for backwards compatibility with existing imports
export const myTrainingKeys = {
  assignedProtocols: trainingKeys.assignedProtocols,
};

export function useAssignedProtocols(profileId: string | null) {
  const { workspace } = useWorkspace();
  const supabase = createClient();

  return useAssignedProtocolsShared({
    profileId,
    workspaceId: workspace.workspace_id,
    supabase,
  });
}
