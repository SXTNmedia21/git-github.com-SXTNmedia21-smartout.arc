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

export function EmmaOverlay() {
  return (
    <WalkAiProvider>
      <WalkAiShell />
    </WalkAiProvider>
  );
}
