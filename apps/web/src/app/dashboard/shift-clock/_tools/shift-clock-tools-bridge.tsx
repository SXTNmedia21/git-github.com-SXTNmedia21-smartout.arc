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
 * ADR-0238: page does not own a domain chat surface.
 * Orb runs in interactive mode — no <DomainChatOwnership> needed.
 *
 * ADR-0151: write tools dispatch CustomEvents only — the UI owns the mutation
 * confirmation. workspace_id and profile_id are auth-derived from DashboardContext.
 *
 * access: employee, manager, admin, owner.
 */

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useShiftClockTools, type ShiftClockToolInput } from "./use-shift-clock-tools";

type ShiftClockToolsBridgeProps = ShiftClockToolInput;

export function ShiftClockToolsBridge({ loading, state }: ShiftClockToolsBridgeProps) {
  const tools = useShiftClockTools({ loading, state });

  useRegisterTools("shift-clock", tools);

  return null;
}
