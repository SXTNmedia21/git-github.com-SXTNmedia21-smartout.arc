"use client";

import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";
import { useWorkspace } from "@/lib/workspace-context";
import { WorkspaceSetupWizard } from "@/components/dashboard/WorkspaceSetupWizard";

export default function DashboardSetupPage() {
  const { workspace } = useWorkspace();
  const supabase = createClient();

  const handleComplete = async () => {
    await supabase
      .from("workspace")
      .update({ setup_guide_completed: true })
      .eq("workspace_id", workspace.workspace_id);

    void emit({
      event: "setup_guide completed",
      workspace_id: workspace.workspace_id,
      actor_id: "",
      properties: {},
    });

    // Clear session dismiss since setup is now permanently done
    sessionStorage.removeItem("setup_dismissed");

    // Hard navigation forces server layout to re-fetch workspace data
    // (workspace context is server-set, not client-queryable)
    window.location.href = "/dashboard";
  };

  return <WorkspaceSetupWizard onComplete={() => void handleComplete()} force />;
}
