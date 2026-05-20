"use client";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  Botsson Host                              */
/*                                            */
/*  Synchronous, SSR-safe provider wrapper.   */
/*  Mounts <BotssonProvider> around dashboard */
/*  children so DomainChatOwnership consumers */
/*  share one provider with the floating      */
/*  EmmaOverlay/Orb (ADR-0238 + ADR-0337).    */
/*                                            */
/*  Pairs with EmmaOverlay which stays        */
/*  dynamic({ ssr: false }) for Orb only —    */
/*  this split preserves SSR for {children}.  */
/*                                            */
/*  ADR-0362 (proposed) amends ADR-0113 R51   */
/*  to permit BotssonHost mount inside        */
/*  DashboardShell with SSR-preservation +    */
/*  provider-scope locality rationale.        */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

import type { ReactNode } from "react";
import { BotssonProvider } from "./BotssonProvider";
import { useWorkspaceOptional } from "@/lib/workspace-context";

export function BotssonHost({ children }: { children: ReactNode }) {
  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id ?? null;

  return <BotssonProvider workspaceId={workspaceId}>{children}</BotssonProvider>;
}
