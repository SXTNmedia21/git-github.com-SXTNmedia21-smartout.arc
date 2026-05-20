"use client";

/**
 * year-wheel-tools-bridge.tsx — registers Botsson tools for /dashboard/year-wheel.
 *
 * Hosted inside YearWheelPageClient so it captures the live year, seasons,
 * planning events, seededSet, filter state, and UI action callbacks.
 * Returns null. Tools are unregistered automatically on unmount (route change).
 *
 * ADR-0238: /dashboard/year-wheel has NO embedded domain chat surface.
 * BotssonShell operates in normal interactive mode on this route.
 * No <DomainChatOwnership> required.
 */

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useYearWheelTools, type YearWheelToolInput } from "./use-year-wheel-tools";

export function YearWheelToolsBridge(props: YearWheelToolInput) {
  const tools = useYearWheelTools(props);
  useRegisterTools("year-wheel", tools);
  return null;
}
