"use client";

// ============================================
// help-takeover-tools-bridge.tsx (M3.2)
// Composes usePageTakeover + useHelpTakeoverKit, registers the kit with the
// dynamic tool registry, and renders the TakeoverPreview overlay when state
// is 'previewing'.
// ============================================

import { useCallback } from "react";
import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { usePageTakeover } from "@/app/dashboard/help/_hooks/usePageTakeover";
import { useHelpTakeoverKit } from "@/app/Botsson/_components/help-takeover-kit";
import { TakeoverPreview } from "@/app/dashboard/help/_components/TakeoverPreview";

interface HelpTakeoverToolsBridgeProps {
  workspaceId: string;
  actorId: string;
  /** Channel context — voice MUST be denied for takeover (ADR-0228). */
  channel?: "chat" | "voice" | "system";
}

export function HelpTakeoverToolsBridge({
  workspaceId,
  actorId,
  channel = "chat",
}: HelpTakeoverToolsBridgeProps) {
  const { state, activeTarget, proposeAction, confirmAction, cancelAction } = usePageTakeover({
    workspaceId,
    actorId,
  });

  const onPropose = useCallback(
    async (target_id: string) => {
      const result = await proposeAction(target_id);
      return result;
    },
    [proposeAction],
  );

  const kit = useHelpTakeoverKit({ workspaceId, actorId, channel, onPropose });
  useRegisterTools("help-takeover", kit);

  const reducedMotion =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  if (state !== "previewing" || !activeTarget) return null;

  return (
    <TakeoverPreview
      selector={activeTarget.selector}
      label={activeTarget.label}
      onConfirm={() => {
        void confirmAction();
      }}
      onCancel={(trigger) => cancelAction(trigger)}
      reducedMotion={reducedMotion}
    />
  );
}
