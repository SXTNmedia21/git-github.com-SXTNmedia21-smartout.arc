"use client";

/**
 * website-tools-bridge.tsx — registers Botsson tools for /dashboard/website.
 *
 * Hosted inside the WebsiteOverview page so it captures live website + pages state.
 * Returns null. Tools are unregistered automatically on unmount (route change).
 *
 * ADR-0238: /dashboard/website has no embedded domain chat surface.
 * BotssonShell operates in normal interactive mode on this route. No DomainChatOwnership needed.
 * ADR-0151: workspace_id never passed as a prop — resolved server-side via RLS.
 */

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useWebsiteTools, type WebsiteToolInput } from "./use-website-tools";

export function WebsiteToolsBridge(props: WebsiteToolInput) {
  const tools = useWebsiteTools(props);
  useRegisterTools("website", tools);
  return null;
}
