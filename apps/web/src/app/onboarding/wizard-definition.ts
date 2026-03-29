"use client";

/**
 * Onboarding confirmation wizard definition.
 *
 * Maps a 5-step confirmation flow to WizardDefinition<OnboardingConfirmState>.
 * Data is pre-loaded from workspace.intelligence_data (populated by Join wizard).
 * The user reviews and adjusts before finalizing the workspace.
 */

import { Layers, MapPin, ClipboardCheck, CheckCircle, Users, Crown, Briefcase } from "lucide-react";
import type { WizardDefinition } from "@smartout/ui";
import { createClient } from "@smartout/supabase/client";
import type { OnboardingConfirmState } from "./types-v2";
import { defaultOnboardingConfirmState } from "./types-v2";
import type { LocationData } from "./types";
import { mergeBusinessData } from "./lib/data-merger";
import type { PlacesData } from "./lib/data-merger";
import {
  getDepartmentsForIndustry,
  getProceduresForIndustry,
  getProfessionsForIndustry,
  resolveNaceCode,
} from "./lib/industry-defaults";
import { buildWorkspaceFinalizationRequest } from "./lib/finalization";
import { redirectToDashboard } from "./lib/redirect";
import { ConfirmDepartments } from "./steps/ConfirmDepartments";
import { ConfirmRoles } from "./steps/ConfirmRoles";
import { ConfirmPositions } from "./steps/ConfirmPositions";
import { ConfirmLocations } from "./steps/ConfirmLocations";
import { ConfirmProcedures } from "./steps/ConfirmProcedures";
import { ConfirmSummary } from "./steps/ConfirmSummary";

/**
 * Load pre-filled onboarding state from workspace.intelligence_data.
 *
 * Queries the user's profile for a workspace that hasn't completed onboarding,
 * then extracts business data, departments, locations, and procedures from
 * the intelligence pipeline results.
 */
async function loadState(): Promise<Partial<OnboardingConfirmState>> {
  if (typeof window === "undefined") return {};

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return {};

  // Find workspace still in onboarding
  const { data: profiles } = await supabase
    .from("profile")
    .select(
      "workspace_id, workspace:workspace_id(workspace_id, slug, onboarding_completed, intelligence_data, name)",
    )
    .eq("user_id", user.id)
    .limit(10);

  if (!profiles) return {};

  const onboardingProfile = profiles.find((p) => {
    const ws = p.workspace as unknown as {
      onboarding_completed: boolean;
    } | null;
    return ws?.onboarding_completed === false;
  });

  if (!onboardingProfile) {
    // No workspace in onboarding — caller should redirect to /join
    return {};
  }

  const ws = onboardingProfile.workspace as unknown as {
    workspace_id: string;
    slug: string | null;
    intelligence_data: Record<string, unknown> | null;
    name: string;
  };

  const intel = ws.intelligence_data;
  if (!intel) {
    return {
      workspaceId: ws.workspace_id,
      workspaceSlug: ws.slug,
    };
  }

  // Extract and merge business data from intelligence pipeline
  const scraped = intel.scraped as Record<string, unknown> | null;
  const brreg = intel.brreg as Record<string, unknown> | null;
  const places = intel.places as PlacesData | null;
  const joinIntake = intel.join_intake as {
    businessNarrative?: { aboutUs?: string; ourHistory?: string; ourConcept?: string };
    menu?: {
      restaurantType?: string;
      cuisineTypes?: string[];
      priceCategory?: string;
      menuDescription?: string;
    };
  } | null;

  const merged = mergeBusinessData(scraped, brreg, places);
  const sourceUrl = intel.source_url as string | null;

  if (!merged.website && sourceUrl && !sourceUrl.startsWith("brreg:")) {
    merged.website = sourceUrl;
  }

  if (!merged.description) {
    merged.description =
      joinIntake?.businessNarrative?.aboutUs ?? joinIntake?.businessNarrative?.ourConcept ?? "";
  }

  // Restore join intake fields
  if (joinIntake) {
    const narrative = joinIntake.businessNarrative;
    if (narrative?.ourHistory) merged.ourHistory = narrative.ourHistory;
    if (narrative?.ourConcept) merged.ourConcept = narrative.ourConcept;

    const menu = joinIntake.menu;
    if (menu?.restaurantType) merged.restaurantType = menu.restaurantType;
    if (menu?.cuisineTypes?.length) merged.cuisineTypes = menu.cuisineTypes;
    if (menu?.priceCategory) merged.priceCategory = menu.priceCategory;
    if (menu?.menuDescription) merged.menuDescription = menu.menuDescription;
  }

  // Restore scraped fields not covered by mergeBusinessData
  if (scraped) {
    const socialLinks = scraped.socialLinks as Record<string, string> | undefined;
    if (socialLinks && Object.keys(socialLinks).length > 0) {
      merged.socialLinks = socialLinks;
    }
    if (scraped.reservationUrl) merged.reservationUrl = scraped.reservationUrl as string;
    if (scraped.menus) merged.menuLinks = scraped.menus as Array<{ href: string; text: string }>;
    if (scraped.logoUrl && !merged.logoUrl) merged.logoUrl = scraped.logoUrl as string;
  }

  // Departments + procedures from industry NACE code
  const nace = merged.industryCode || resolveNaceCode(merged.industry);
  const employeeCount = parseInt(merged.employeeCount, 10) || 5;
  const departments = getDepartmentsForIndustry(nace, employeeCount);
  const procedures = getProceduresForIndustry(nace);

  // Professions from DB (K1a platform data)
  const professions = await getProfessionsForIndustry(nace);

  // Locations — prefer I1-seeded from DB, fall back to scraped data
  let locations: LocationData[] = [];

  const { data: dbLocations } = await supabase
    .from("location")
    .select("location_id, name, location_type")
    .eq("workspace_id", ws.workspace_id)
    .eq("is_active", true)
    .order("sort_order");

  if (dbLocations && dbLocations.length > 0) {
    // Deduplicate by name (I1 template may have run multiple times)
    const seen = new Set<string>();
    locations = dbLocations
      .filter((loc) => {
        const key = loc.name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((loc) => ({
        id: loc.location_id,
        name: loc.name,
        type: (loc.location_type === "outdoor" ||
        loc.location_type === "kitchen" ||
        loc.location_type === "other"
          ? loc.location_type
          : "main") as LocationData["type"],
        zones: [],
      }));
  } else if (Array.isArray(scraped?.locations)) {
    locations = (scraped.locations as Array<{ name: string; type?: string }>)
      .filter(
        (loc): loc is { name: string; type?: string } =>
          typeof loc === "object" && loc !== null && typeof loc.name === "string",
      )
      .map((loc, i) => ({
        id: `loc-resume-${i}`,
        name: loc.name,
        type:
          loc.type === "outdoor" || loc.type === "satellite" || loc.type === "other"
            ? (loc.type as LocationData["type"])
            : "main",
        zones: [],
      }));
  }

  // Auto-generate default location from business name if scraping returned none
  if (locations.length === 0 && merged.name) {
    locations.push({
      id: "loc-default-0",
      name: merged.name,
      type: "main",
      zones: [],
    });
  }

  return {
    business: merged,
    departments,
    locations,
    procedures,
    professions,
    workspaceId: ws.workspace_id,
    workspaceSlug: ws.slug,
  };
}

/**
 * Finalize the workspace — calls the finalize-workspace or activate-workspace
 * Edge Function with the confirmed configuration.
 */
async function onComplete(state: OnboardingConfirmState): Promise<void> {
  const supabase = createClient();

  const selectedDepts = state.departments
    .filter((d) => d.selected)
    .map((d) => ({
      name: d.name,
      positions: d.positions
        .filter((p) => p.selected)
        .map((p) => ({ name: p.name, isLeader: p.isLeader })),
    }));

  const selectedProcs = state.procedures.filter((p) => p.selected).map((p) => p.name);

  const locationPayload = state.locations.map((loc) => ({
    name: loc.name,
    type: loc.type,
    zones: loc.zones.map((z) => z.name),
  }));

  const professionPayload = state.professions
    .filter((p) => p.positions.some((pos) => pos.selected))
    .map((p) => ({
      professionId: p.id,
      professionSlug: p.slug,
      professionName: p.name,
      positions: p.positions
        .filter((pos) => pos.selected)
        .map((pos) => ({
          name: pos.name,
          slug: pos.slug,
        })),
    }));

  const workspacePayload = {
    name: state.business.name || "Min bedrift",
    legalName: state.business.legalName,
    orgNumber: state.business.orgNumber,
    email: state.business.email,
    phone: state.business.phone,
    address: [
      state.business.address,
      [state.business.postalCode, state.business.city].filter(Boolean).join(" "),
    ]
      .filter(Boolean)
      .join(", "),
    industry: state.business.industry,
    industryCode: state.business.industryCode,
    employeeCount: state.business.employeeCount,
    summary: state.business.description,
    website: state.business.website,
    departments: selectedDepts,
    locations: locationPayload,
    procedures: selectedProcs,
    aboutUs: state.business.description,
    ourHistory: state.business.ourHistory,
    ourConcept: state.business.ourConcept,
    restaurantType: state.business.restaurantType,
    cuisineTypes: state.business.cuisineTypes,
    priceCategory: state.business.priceCategory,
    menuDescription: state.business.menuDescription,
    socialLinks: state.business.socialLinks,
    logoUrl: state.business.logoUrl,
    professions: professionPayload,
  };

  const finalizationRequest = buildWorkspaceFinalizationRequest(
    state.workspaceId,
    workspacePayload,
  );

  const { error } = await supabase.functions.invoke(finalizationRequest.functionName, {
    body: finalizationRequest.body,
  });

  if (error) {
    throw new Error(error.message || "Failed to finalize workspace");
  }

  redirectToDashboard(state.workspaceSlug, "/dashboard/setup");
}

export const onboardingWizard: WizardDefinition<OnboardingConfirmState> = {
  id: "onboarding",
  theme: "warm",

  metadata: {
    titleKey: "wizard.title",
    descriptionKey: "wizard.description",
    i18nNamespace: "onboarding",
  },

  brandPanel: {
    logoSrc: "/smartout-logo.png",
    position: "right",
    messages: {
      "confirm-departments": {
        heading: "brandPanel.confirmDepartments_heading",
        sub: "brandPanel.confirmDepartments_sub",
      },
      "confirm-roles": {
        heading: "brandPanel.confirmRoles_heading",
        sub: "brandPanel.confirmRoles_sub",
      },
      "confirm-positions": {
        heading: "brandPanel.confirmPositions_heading",
        sub: "brandPanel.confirmPositions_sub",
      },
      "confirm-locations": {
        heading: "brandPanel.confirmLocations_heading",
        sub: "brandPanel.confirmLocations_sub",
      },
      "confirm-procedures": {
        heading: "brandPanel.confirmProcedures_heading",
        sub: "brandPanel.confirmProcedures_sub",
      },
      summary: {
        heading: "brandPanel.summary_heading",
        sub: "brandPanel.summary_sub",
      },
    },
  },

  initialState: defaultOnboardingConfirmState,
  loadState,
  onComplete,

  steps: [
    {
      id: "confirm-departments",
      labelKey: "confirm.departments_title",
      icon: Layers,
      component: ConfirmDepartments,
    },
    {
      id: "confirm-roles",
      labelKey: "confirm.roles_title",
      icon: Crown,
      component: ConfirmRoles,
    },
    {
      id: "confirm-positions",
      labelKey: "confirm.positions_title",
      icon: Briefcase,
      component: ConfirmPositions,
    },
    {
      id: "confirm-locations",
      labelKey: "confirm.locations_title",
      icon: MapPin,
      component: ConfirmLocations,
      skippable: true,
    },
    {
      id: "confirm-procedures",
      labelKey: "confirm.procedures_title",
      icon: ClipboardCheck,
      component: ConfirmProcedures,
    },
    {
      id: "summary",
      labelKey: "confirm.summary_title",
      icon: CheckCircle,
      component: ConfirmSummary,
      hideNavBar: true,
    },
  ],
};
