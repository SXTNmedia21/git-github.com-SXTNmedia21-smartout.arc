"use client";

/**
 * departments-tools-bridge.tsx — registers Botsson tools for
 * /dashboard/organization/departments/[id].
 *
 * Hosted inside DepartmentDetailPage so it captures live D1-envelope state
 * (department metadata, positions, teams, members, policies, operating hours).
 * Returns null — no visual output. Tools are unregistered on unmount (route change).
 *
 * Scope key: "organization-departments"
 *
 * ADR-0238: /dashboard/organization/departments/[id] has NO embedded domain chat surface.
 * BotssonShell operates in normal interactive mode. No <DomainChatOwnership> required.
 *
 * ADR-0151: workspace_id and department_id are auth-derived from DashboardContext +
 * useParams. Tools do NOT accept workspace_id or department_id as body parameters.
 */

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useDepartmentsTools, type DepartmentsToolInput } from "./use-departments-tools";

export function DepartmentsToolsBridge(props: DepartmentsToolInput) {
  const tools = useDepartmentsTools(props);
  useRegisterTools("organization-departments", tools);
  return null;
}
