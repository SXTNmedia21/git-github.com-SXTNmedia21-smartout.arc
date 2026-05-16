"use client";

/**
 * teams-tools-bridge.tsx — registers Botsson tools for /dashboard/organization/teams.
 *
 * Hosted inside the TeamsPage component so it captures live team state
 * (teams array, member counts, leader names, department links, loading flag).
 * Returns null — no visual output. Tools are unregistered automatically on unmount.
 *
 * Why a bridge:
 *  - Keeps page.tsx clean from voice-tool registration.
 *  - Mounts only when data is available (teams is non-null after first fetch).
 *  - Passes memoised TeamSummary[] so the tool hook stays stable.
 *
 * ADR-0238: /dashboard/organization/teams has NO embedded domain chat surface.
 * BotssonShell operates in normal interactive mode on this route.
 * No <DomainChatOwnership> required.
 *
 * ADR-0151: workspace_id is auth-derived from DashboardContext. Tools do NOT
 * accept workspace_id in the request body — all reads come from page-level state
 * already fetched under the authenticated session.
 */

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useTeamsTools, type TeamsToolInput } from "./use-teams-tools";

export function TeamsToolsBridge(props: TeamsToolInput) {
  const tools = useTeamsTools(props);
  useRegisterTools("organization-teams", tools);
  return null;
}
