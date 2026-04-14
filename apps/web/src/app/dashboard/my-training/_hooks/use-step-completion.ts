"use client";

// Re-exports from @smartout/training for backwards compatibility.

import { useContext } from "react";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import {
  useCompleteStep as useCompleteStepShared,
  useSubmitTest as useSubmitTestShared,
  useSignConfirmation as useSignConfirmationShared,
} from "@smartout/training";

function useTrainingContext() {
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  return { supabase, workspaceId: workspace.workspace_id, profileId: profileId ?? "" };
}

export function useCompleteStep() {
  return useCompleteStepShared(useTrainingContext());
}

export function useSubmitTest() {
  return useSubmitTestShared(useTrainingContext());
}

export function useSignConfirmation() {
  return useSignConfirmationShared(useTrainingContext());
}
