"use client";

/**
 * day-control-tools-bridge.tsx — registers DayControlPanel tools in the
 * harness registry (ADR-0282 canonical pattern).
 *
 * Mounts only when DaySessionProvider has resolved a session; the bridge
 * unmounts when the panel closes, which auto-unregisters tools.
 *
 * Replaces the legacy Ultravox temporaryTool / useVoiceTools path that
 * lived in DaySessionProvider. See docs/sortie-logs/2026-05-23-p10-s1-task1.md
 * for the audit catalog of the removed path.
 */

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useDayControlTools, type DayControlToolContext } from "./use-day-control-tools";

type Props = DayControlToolContext;

export function DayControlToolsBridge({ sessionId, departmentId, departmentName, dateISO }: Props) {
  const tools = useDayControlTools({ sessionId, departmentId, departmentName, dateISO });
  useRegisterTools("day-control", tools);
  return null;
}
