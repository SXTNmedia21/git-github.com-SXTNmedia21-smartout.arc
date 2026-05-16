"use client";

/**
 * shift-clock-tools-bridge.tsx — registers Botsson tools for the
 * /dashboard/shift-clock surface.
 *
 * Why a bridge:
 *  - Keeps page.tsx clean from voice-tool registration concerns.
 *  - Receives live ShiftClockState from the view — no duplicate fetch.
 *  - useRegisterTools handles register/unregister on mount/unmount automatically.
 *
 * ADR-0133 MOBILE-CRITICAL: shift-clock is the primary D6 employee execute surface.
 * Botsson must be able to read shift state and propose clock actions via voice.
 *
 * ADR-0238 + ADR-0337: chat tab owns a domain chat surface (session + shift chat).
 * ShiftClockTabs declares <DomainChatOwnership reason="shift-clock-chat" /> inside
 * the chat TabsContent — Orb auto-suppresses to passive while chat tab is active,
 * returns to interactive when user switches to Oppgaver/Notater tab.
 *
 * uiActions injection (post-council-B1 fix, 2026-05-14):
 *   Write-propose tools delegate to useShiftClock() mutations via uiActions
 *   instead of dispatching dead-drop CustomEvents that had no listeners.
 *
 * access: employee, manager, admin, owner.
 */

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useShiftClockTools, type ShiftClockToolInput } from "./use-shift-clock-tools";

type ShiftClockToolsBridgeProps = ShiftClockToolInput;

export function ShiftClockToolsBridge({ loading, state, uiActions }: ShiftClockToolsBridgeProps) {
  const tools = useShiftClockTools({ loading, state, uiActions });

  useRegisterTools("shift-clock", tools);

  return null;
}
