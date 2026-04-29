"use client";

// ============================================
// help-tour-tools-bridge.tsx
// Composes useHelpTour + useHelpTourKit, registers the kit with the dynamic
// tool registry, and renders the TourHighlight overlay when active.
// Why: the bridge is the integration seam between Botsson's tool runtime and
// the Help page UI — it translates tool invocations into DOM side-effects
// without coupling the kit to React state directly.
// ============================================

import { useCallback } from "react";
import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useHelpTour } from "@/app/dashboard/help/_hooks/useHelpTour";
import { useHelpTourKit } from "@/app/Botsson/_components/help-tour-kit";
import { TourHighlight } from "@/app/dashboard/help/_components/TourHighlight";
import type { TourAnchor } from "@/app/dashboard/help/_lib/tour-anchors";

/* ━━━ Props ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

interface HelpTourToolsBridgeProps {
  workspaceId: string;
  actorId: string;
}

/* ━━━ Component ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function HelpTourToolsBridge({ workspaceId, actorId }: HelpTourToolsBridgeProps) {
  const { activeHighlight, navigateTo, highlightElement } = useHelpTour({ workspaceId, actorId });

  // Bridge callback — translates tool invocations to hook calls.
  // Stable via useCallback (onInvoke is a dep of useHelpTourKit useMemo).
  const onInvoke = useCallback(
    (
      tool: "navigate_to" | "highlight_element",
      target_id: TourAnchor,
      opts?: { label: string; duration_ms: number },
    ) => {
      if (tool === "navigate_to") {
        navigateTo(target_id);
      } else {
        // opts is always defined when tool === "highlight_element" per kit contract.
        highlightElement(target_id, opts ?? { label: "", duration_ms: 5000 });
      }
    },
    [navigateTo, highlightElement],
  );

  const kit = useHelpTourKit({ workspaceId, actorId, onInvoke });
  useRegisterTools("help-tour", kit);

  // Detect reduced-motion preference for the overlay animation.
  const reducedMotion =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  return activeHighlight ? (
    <TourHighlight
      targetId={activeHighlight.target_id}
      label={activeHighlight.label}
      reducedMotion={reducedMotion}
    />
  ) : null;
}
