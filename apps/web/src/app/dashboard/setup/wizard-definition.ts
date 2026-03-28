"use client";

/**
 * Dashboard Setup wizard definition — config object for AnimatedWizardShell.
 *
 * Maps the 9-step workspace setup flow to WizardDefinition<SetupState>.
 * Each step wrapper component accepts WizardStepProps<SetupState> and delegates
 * to the existing step components in components/dashboard/wizard-steps/.
 */

import {
  Sparkles,
  Upload,
  ShieldCheck,
  DollarSign,
  Briefcase,
  Users,
  Clock,
  Calendar,
  BookOpen,
} from "lucide-react";
import type { WizardDefinition } from "@smartout/ui";
import { createClient } from "@smartout/supabase/client";
import type { ScrapedIntelligence } from "@/components/dashboard/wizard-steps/wizard-state";
import type { SetupState } from "./types";
import { defaultSetupState } from "./types";
import {
  WelcomeStepAdapter,
  DocumentDropStepAdapter,
  GovernanceStepAdapter,
  PayrollStepAdapter,
  EmploymentStepAdapter,
  TeamStepAdapter,
  ShiftTemplateStepAdapter,
  SeasonStepAdapter,
  HandbookStepAdapter,
} from "./_adapters";

/** Norwegian day-of-week abbreviations indexed by company_opening_hours.day_of_week (0=Mon). */
const DAY_LABELS = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

/**
 * loadState — hydrates SetupState from Supabase on mount.
 *
 * Fetches the current user's profile, workspace, and company data, then maps
 * DB fields into the ScrapedIntelligence shape so the wizard steps can display
 * pre-existing business data without re-scraping.
 */
async function loadState(): Promise<Partial<SetupState>> {
  if (typeof window === "undefined") return {};

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return {};

  // Get profile with workspace + company join
  const { data: profile } = await supabase
    .from("profile")
    .select("profile_id, workspace_id, workspace:workspace_id(name, company_id)")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!profile?.workspace_id) return {};

  const ws = profile.workspace as unknown as {
    name: string;
    company_id: string | null;
  };
  const workspaceId = profile.workspace_id;
  const profileId = profile.profile_id;

  if (!ws.company_id) {
    return { workspaceId, profileId };
  }

  // Fetch company data, details, opening hours, and social media in parallel
  const [companyResult, detailsResult, hoursResult, socialResult] = await Promise.all([
    supabase.from("company").select("*").eq("company_id", ws.company_id).single(),
    supabase.from("company_details").select("*").eq("workspace_id", workspaceId).maybeSingle(),
    supabase
      .from("company_opening_hours")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("day_of_week"),
    supabase.from("company_social_media").select("*").eq("workspace_id", workspaceId),
  ]);

  const company = companyResult.data;
  const companyDetails = detailsResult.data;
  const openingHours = hoursResult.data ?? [];
  const socialMedia = socialResult.data ?? [];

  // Build scraped data from DB fields
  const scrapedData: ScrapedIntelligence = {
    companyName: ws.name ?? undefined,
    orgNumber: company?.org_number ?? undefined,
    industryType: company?.industry ?? undefined,
    address:
      [company?.address_line_1, company?.postal_code, company?.city].filter(Boolean).join(", ") ||
      undefined,
    website: company?.website ?? undefined,
    email: company?.email ?? undefined,
    phone: company?.phone ?? undefined,
    openingHours:
      openingHours
        .filter((h) => !h.is_closed)
        .map((h) => `${DAY_LABELS[h.day_of_week]}: ${h.open_time}-${h.close_time}`)
        .join(", ") || undefined,
    // Business narrative from company_details
    aboutUs: companyDetails?.about_us ?? undefined,
    ourHistory: companyDetails?.our_history ?? undefined,
    ourConcept: companyDetails?.our_concept ?? undefined,
    restaurantType: companyDetails?.restaurant_type ?? undefined,
    cuisineTypes: companyDetails?.cuisine_types ?? undefined,
    priceCategory: companyDetails?.price_category ?? undefined,
    menuDescription: companyDetails?.menu_description ?? undefined,
    // Social links
    socialLinks:
      socialMedia.length > 0
        ? socialMedia.reduce(
            (acc, sm) => ({ ...acc, [sm.platform]: sm.url }),
            {} as Record<string, string>,
          )
        : undefined,
    // Source tracking
    fieldSources: (companyDetails?.field_sources as Record<string, string>) ?? undefined,
  };

  return { scrapedData, workspaceId, profileId };
}

/**
 * onComplete — emits wizard completed event.
 * The actual query invalidation and routing is handled by the page component.
 */
async function onComplete(_state: SetupState): Promise<void> {
  // Completion logic handled in the page component via telemetry callbacks
}

export const dashboardSetupWizard: WizardDefinition<SetupState> = {
  id: "dashboard-setup",
  theme: "light",

  metadata: {
    titleKey: "setup.title",
    descriptionKey: "setup.description",
    i18nNamespace: "dashboard",
  },

  initialState: defaultSetupState,
  loadState,
  onComplete,

  steps: [
    {
      id: "welcome",
      labelKey: "steps.welcome",
      icon: Sparkles,
      component: WelcomeStepAdapter,
      skippable: true,
    },
    {
      id: "document-drop",
      labelKey: "steps.documents",
      icon: Upload,
      component: DocumentDropStepAdapter,
      skippable: true,
    },
    {
      id: "governance",
      labelKey: "steps.governance",
      icon: ShieldCheck,
      component: GovernanceStepAdapter,
    },
    {
      id: "payroll",
      labelKey: "steps.payroll",
      icon: DollarSign,
      component: PayrollStepAdapter,
    },
    {
      id: "employment",
      labelKey: "steps.employment",
      icon: Briefcase,
      component: EmploymentStepAdapter,
    },
    {
      id: "team",
      labelKey: "steps.team",
      icon: Users,
      component: TeamStepAdapter,
      skippable: true,
    },
    {
      id: "shift-template",
      labelKey: "steps.shifts",
      icon: Clock,
      component: ShiftTemplateStepAdapter,
      skippable: true,
    },
    {
      id: "season",
      labelKey: "steps.season",
      icon: Calendar,
      component: SeasonStepAdapter,
    },
    {
      id: "handbook",
      labelKey: "steps.handbook",
      icon: BookOpen,
      component: HandbookStepAdapter,
      skippable: true,
    },
  ],
};
