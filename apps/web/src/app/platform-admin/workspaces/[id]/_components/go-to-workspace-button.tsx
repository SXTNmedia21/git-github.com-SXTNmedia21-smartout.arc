"use client";

// go-to-workspace-button.tsx — godmode-only header button on the workspace
// detail page. Mirrors the Gå-til-cell on apps/admin's workspaces list
// (ADR-0410). Clicking joins the workspace as admin and redirects to
// {slug}.smartout.ai/dashboard.

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { goToWorkspaceAction } from "../_actions/go-to-workspace";

type Props = {
  workspaceId: string;
  workspaceName: string;
};

export function GoToWorkspaceButton({ workspaceId, workspaceName }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      try {
        await goToWorkspaceAction(workspaceId);
      } catch (err) {
        // goToWorkspaceAction throws redirect() on success (caught by Next.js).
        // Any other error is a real failure — surface as toast.
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes("NEXT_REDIRECT")) {
          toast.error(`Kunne ikke logge inn på ${workspaceName}: ${msg}`);
        }
      }
    });
  }

  return (
    <Button
      size="sm"
      variant="default"
      className="gap-1.5"
      onClick={handleClick}
      disabled={isPending}
      aria-label={`Logg inn på ${workspaceName}`}
    >
      {isPending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <ArrowRight className="size-3.5" />
      )}
      Logg inn på workspace
    </Button>
  );
}
