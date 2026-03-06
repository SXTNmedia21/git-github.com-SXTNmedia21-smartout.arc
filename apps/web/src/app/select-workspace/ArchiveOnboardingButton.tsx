"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@smartout/supabase/client";

export function ArchiveOnboardingButton({ workspaceIds }: { workspaceIds: string[] }) {
  const [isArchiving, setIsArchiving] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleArchive() {
    if (
      !confirm(`Arkiver ${workspaceIds.length} uferdige workspace(s)? De kan ikke gjenopprettes.`)
    ) {
      return;
    }

    setIsArchiving(true);
    try {
      const { error } = await supabase.rpc(
        "archive_onboarding_workspaces" as never,
        {
          p_workspace_ids: workspaceIds,
        } as never,
      );

      if (error) throw error;
      router.refresh();
    } catch {
      setIsArchiving(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleArchive}
      disabled={isArchiving}
      className="text-muted-foreground hover:text-destructive text-xs font-medium transition-colors disabled:opacity-50"
    >
      {isArchiving ? "Arkiverer..." : "Arkiver alle"}
    </button>
  );
}
