// ============================================
// finalization.ts
// Centralizes onboarding setup finalization rules.
// Why: Join and onboarding must hand off through one
// canonical bootstrap contract before dashboard setup.
// ============================================

import { Building2, Calendar, Users, MapPin, ClipboardCheck, type LucideIcon } from "lucide-react";

export type WorkspaceFinalizationPayload = Record<string, unknown>;

export type WorkspaceFinalizationRequest = {
  functionName: "finalize-workspace" | "activate-workspace";
  body: {
    workspaceId?: string;
    workspaceData: WorkspaceFinalizationPayload;
  };
};

export type SetupSummaryItem = {
  icon: LucideIcon;
  label: string;
  detail: string | null;
  filled: boolean;
};

type SetupSummaryInput = {
  businessName: string;
  businessIndustry: string;
  businessCity: string;
  seasonName: string;
  seasonStartDate: string;
  seasonEndDate: string;
  departmentNames: string[];
  locationNames: string[];
  zoneCount: number;
  procedureNames: string[];
};

/**
 * Chooses the canonical finalization entrypoint for workspace setup.
 * Why: Live onboarding shells must pass through `finalize-workspace`
 * so bootstrap-side effects stay aligned with the documented contract.
 *
 * @returns The function invocation descriptor for the current setup path
 */
export function buildWorkspaceFinalizationRequest(
  onboardingWorkspaceId: string | null,
  workspaceData: WorkspaceFinalizationPayload,
): WorkspaceFinalizationRequest {
  if (onboardingWorkspaceId) {
    return {
      functionName: "finalize-workspace",
      body: {
        workspaceId: onboardingWorkspaceId,
        workspaceData,
      },
    };
  }

  return {
    functionName: "activate-workspace",
    body: {
      workspaceData,
    },
  };
}

/**
 * Builds the post-bootstrap destination after onboarding finalization.
 * Why: Bootstrap should hand off into dashboard setup, not the generic dashboard root.
 *
 * @returns An absolute subdomain URL or local dashboard setup route
 */
export function buildPostBootstrapRoute(slug: string | null, rootDomain?: string): string {
  if (rootDomain && rootDomain !== "localhost" && slug) {
    return `https://${slug}.${rootDomain}/dashboard/setup`;
  }

  return "/dashboard/setup";
}

/**
 * Formats a season date range for the setup summary.
 * Why: The welcome step should show concrete setup scope before handoff.
 *
 * @returns A short localized date range
 */
function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  return `${start.toLocaleDateString("nb-NO", options)} - ${end.toLocaleDateString("nb-NO", options)}`;
}

/**
 * Builds the visible setup summary shown before the dashboard setup handoff.
 * Why: Contract is no longer part of the live flow, so the summary should reflect
 * only the workspace structure the user actually confirmed.
 *
 * @returns Ordered cards for the setup completion summary
 */
export function buildSetupSummaryItems(input: SetupSummaryInput): SetupSummaryItem[] {
  const locationLabel = `${input.locationNames.length} lokasjon${input.locationNames.length !== 1 ? "er" : ""}`;
  const locationDetail =
    input.zoneCount > 0
      ? `${input.zoneCount} sone${input.zoneCount !== 1 ? "r" : ""}`
      : input.locationNames.length > 0
        ? input.locationNames.join(", ")
        : null;

  return [
    {
      icon: Building2,
      label: input.businessName || "Bedrift",
      detail: [input.businessIndustry, input.businessCity].filter(Boolean).join(" · ") || null,
      filled: Boolean(input.businessName),
    },
    {
      icon: Calendar,
      label: input.seasonName || "Sesong",
      detail:
        input.seasonStartDate && input.seasonEndDate
          ? formatDateRange(input.seasonStartDate, input.seasonEndDate)
          : null,
      filled: Boolean(input.seasonName),
    },
    {
      icon: Users,
      label: `${input.departmentNames.length} avdelinger`,
      detail: input.departmentNames.length > 0 ? input.departmentNames.join(", ") : null,
      filled: input.departmentNames.length > 0,
    },
    {
      icon: MapPin,
      label: locationLabel,
      detail: locationDetail,
      filled: input.locationNames.length > 0,
    },
    {
      icon: ClipboardCheck,
      label: `${input.procedureNames.length} prosedyrer`,
      detail:
        input.procedureNames.length > 0
          ? input.procedureNames.slice(0, 3).join(", ") +
            (input.procedureNames.length > 3 ? ` +${input.procedureNames.length - 3}` : "")
          : null,
      filled: input.procedureNames.length > 0,
    },
  ];
}
