"use client";

/**
 * season-tools-bridge.tsx — registers Botsson tools for /dashboard/season/[seasonId].
 *
 * Mounted inside SeasonPageClient so it captures the live season, budget,
 * day factors, hour factors, seeded state, and UI action callbacks.
 * Returns null. Tools are unregistered automatically on unmount (route change).
 *
 * ADR-0238: /dashboard/season/[seasonId] has NO embedded domain chat surface.
 * BotssonShell operates in normal interactive mode on this route.
 * No <DomainChatOwnership> required.
 */

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useSeasonTools, type SeasonToolInput } from "./use-season-tools";

export function SeasonToolsBridge(props: SeasonToolInput) {
  const tools = useSeasonTools(props);
  useRegisterTools("season", tools);
  return null;
}
