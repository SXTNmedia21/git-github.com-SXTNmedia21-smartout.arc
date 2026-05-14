"use client";

/**
 * organization-tools-bridge.tsx — registers Botsson tools for /dashboard/organization.
 *
 * Hosted inside OrganizationPage so it captures live D1-envelope state (departments,
 * locations, teams, company, workspace, counts, setup checklist, active tab).
 * Returns null — no visual output. Tools are unregistered automatically on unmount
 * (route change).
 *
 * ADR-0238: /dashboard/organization has NO embedded domain chat surface.
 * BotssonShell operates in normal interactive mode on this route.
 * No <DomainChatOwnership> required.
 *
 * ADR-0151: workspace_id is resolved server-side. Tools do NOT pass workspace_id in
 * body — all reads are from the page-level state already fetched server-side-authorised.
 */

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useOrganizationTools, type OrganizationToolInput } from "./use-organization-tools";

export function OrganizationToolsBridge(props: OrganizationToolInput) {
  const tools = useOrganizationTools(props);
  useRegisterTools("organization", tools);
  return null;
}
