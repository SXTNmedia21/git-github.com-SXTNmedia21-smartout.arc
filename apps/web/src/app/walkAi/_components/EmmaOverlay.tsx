"use client";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  Emma Overlay                              */
/*                                            */
/*  Thin wrapper that drops WalkAi into the   */
/*  dashboard layout as a floating orb.       */
/*  Loaded via dynamic import — zero SSR.     */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

import "./walkai.css";
import { WalkAiProvider } from "./WalkAiProvider";
import { WalkAiShell } from "./WalkAiShell";
import { useWorkspaceOptional } from "@/lib/workspace-context";

export function EmmaOverlay() {
  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id ?? null;

  return (
    <WalkAiProvider workspaceId={workspaceId}>
      <WalkAiShell />
    </WalkAiProvider>
  );
}
