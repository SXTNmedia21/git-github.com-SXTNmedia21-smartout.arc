"use client";

/**
 * ai-tools-bridge.tsx — registers Botsson tools for the /dashboard/ai surface.
 *
 * Why a bridge + island:
 *  - /dashboard/ai is a Server Component — this file provides two exports:
 *    1. AiToolsBridge — low-level component: receives already-fetched authority
 *       config via props (used when the parent is already a client component).
 *    2. AiToolsBridgeIsland — self-contained client island: fetches authority
 *       config itself via useAuthorityConfig, then delegates to AiToolsBridge.
 *       Import this from the Server Component page.tsx.
 *
 * ADR-0238 check:
 *  - /dashboard/ai has NO embedded chat surface. The FEATURE_FLAGS.AI_CHAT card
 *    is a "coming soon" placeholder with no input/POST. owns_chat_surface = false.
 *    No <DomainChatOwnership> needed. Botsson Orb renders normally.
 *
 * Lifecycle:
 *  - useRegisterTools handles register/unregister automatically on mount/unmount.
 */

import { useRouter } from "next/navigation";
import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useAiTools, type AiToolsInput } from "./use-ai-tools";
import { useAuthorityConfig } from "../_hooks/use-authority-config";
import type { AuthorityConfigMap } from "../_hooks/use-authority-config";

/* ━━━ Low-level bridge (receives pre-fetched config) ━━━━━━━━━━━━━━━━━━━━━━ */

type AiToolsBridgeProps = {
  authorityConfig: AuthorityConfigMap | null;
};

export function AiToolsBridge({ authorityConfig }: AiToolsBridgeProps) {
  const router = useRouter();

  const input: AiToolsInput = {
    authorityConfig,
    navigate: (path: string) => router.push(path),
  };

  const tools = useAiTools(input);
  useRegisterTools("ai", tools);

  return null;
}

/* ━━━ Self-contained island (import from Server Component page.tsx) ━━━━━━━ */

/**
 * AiToolsBridgeIsland — client island that self-fetches authority config and
 * registers Botsson tools. Import this from /dashboard/ai/page.tsx (Server Component).
 * Renders null — no visual output.
 */
export function AiToolsBridgeIsland() {
  const { data: authorityConfig = null } = useAuthorityConfig();
  return <AiToolsBridge authorityConfig={authorityConfig} />;
}
