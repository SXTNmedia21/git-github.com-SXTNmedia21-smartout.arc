"use client";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  Emma Overlay                              */
/*                                            */
/*  Thin wrapper that drops Botsson into the   */
/*  dashboard layout as a floating orb.       */
/*  Loaded via dynamic import — zero SSR.     */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

import "./Botsson.css";
import { BotssonProvider } from "./BotssonProvider";
import { BotssonShell } from "./BotssonShell";
import { useWorkspaceOptional } from "@/lib/workspace-context";

export function EmmaOverlay() {
  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id ?? null;

  return (
    <BotssonProvider workspaceId={workspaceId}>
      <BotssonShell />
    </BotssonProvider>
  );
}
