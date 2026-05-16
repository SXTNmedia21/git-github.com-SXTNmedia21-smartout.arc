"use client";

/**
 * my-schedule-tools-bridge.tsx — registers Botsson tools for the
 * /dashboard/my-schedule surface.
 *
 * Why a bridge:
 *  - Keeps MyWeekView clean from voice-tool registration concerns.
 *  - Mounts only when shifts data has been fetched (shifts non-null).
 *    Prevents tools returning empty state before the first fetch completes.
 *
 * Data sourcing:
 *  - Receives live data and callbacks from MyWeekView via props.
 *    No duplicate fetch — MyWeekView already holds useMyScheduleShifts result;
 *    this bridge just re-uses it.
 *
 * Lifecycle:
 *  - useRegisterTools handles register/unregister on mount/unmount.
 *  - Returns null — renders nothing in the DOM.
 *
 * ADR-0238: /dashboard/my-schedule has no in-page chat surface — Orb stays
 * interactive, no DomainChatOwnership declaration needed.
 */

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useMyScheduleTools, type MyScheduleToolInput } from "./use-my-schedule-tools";

export function MyScheduleToolsBridge(props: MyScheduleToolInput) {
  const tools = useMyScheduleTools(props);
  useRegisterTools("my-schedule", tools);
  return null;
}
