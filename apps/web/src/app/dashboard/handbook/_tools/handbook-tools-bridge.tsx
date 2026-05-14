"use client";

/**
 * handbook-tools-bridge.tsx — registers Botsson tools for /dashboard/handbook.
 *
 * Hosted INSIDE HandbookPageClient so it captures the live active-chapter state
 * and setActiveChapterKey action. Returns null. Tools are unregistered automatically
 * on unmount (route change).
 *
 * ADR-0238: handbook does NOT embed a chat surface — owns_chat_surface = false.
 * kb_query_voice_fallback stays at /dashboard/help.
 */

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useHandbookTools, type HandbookToolInput } from "./use-handbook-tools";

export function HandbookToolsBridge(props: HandbookToolInput) {
  const tools = useHandbookTools(props);
  useRegisterTools("handbook", tools);
  return null;
}
