"use client";

/**
 * Dashboard Setup wizard definition — config object for AnimatedWizardShell.
 *
 * Maps the 9-step workspace setup flow to WizardDefinition<SetupState>.
 * Each step wrapper component accepts WizardStepProps<SetupState> and delegates
 * to the existing step components in components/dashboard/wizard-steps/.
 */

import type { WizardDefinition } from "@smartout/ui";
import { createClient } from "@smartout/supabase/client";
import { invokeEdgeFunction } from "@/lib/supabase-edge-invoke";
import type { ScrapedIntelligence } from "@/components/dashboard/wizard-steps/wizard-state";
import type { SetupState } from "./types";
import { defaultSetupState } from "./types";
import { callEmploymentSave } from "./_adapters/employment-save-bridge";
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
    // SAFETY: Supabase join returns union type; runtime shape matches the cast
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

  // Compute initial step index from module completion (same logic as useWorkspaceSetup)
  const STEP_TO_MODULE: Record<string, string> = {
    // welcome is always shown — it's a greeting, not a completable module
    "document-drop": "governance",
    governance: "governance",
    payroll: "governance",
    employment: "governance",
    team: "people",
    "shift-template": "schedule",
    season: "season",
    handbook: "governance",
  };

  const [policiesResult, profilesResult, shiftsResult, seasonsResult] = await Promise.all([
    supabase
      .from("policy")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId),
    supabase
      .from("profile")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("is_active", true),
    supabase
      .from("schedule_template")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId),
    supabase
      .from("season")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .in("status", ["draft", "active"]),
  ]);

  const moduleComplete: Record<string, boolean> = {
    governance: (policiesResult.count ?? 0) >= 3,
    people: (profilesResult.count ?? 0) > 1,
    schedule: (shiftsResult.count ?? 0) > 0,
    season: (seasonsResult.count ?? 0) > 0,
  };

  const STEP_IDS = [
    "welcome",
    "document-drop",
    "governance",
    "payroll",
    "employment",
    "team",
    "shift-template",
    "season",
    "handbook",
  ];

  // Pontus 2026-05-19: "/dashboard/setup burde start på velkommen".
  // Auto-advance disabled entirely — every visit lands on the welcome step
  // (index 0) regardless of module-completion state. Users click through
  // explicitly; ?step=<id> URL override (setup/page.tsx) still respected.
  // STEP_IDS + STEP_TO_MODULE + moduleComplete kept above for future tools
  // that may surface incomplete-module hints in chat (void to silence
  // unused-warnings while preserving the queries for diagnostics).
  void STEP_IDS;
  void moduleComplete;
  const _initialStepIndex = 0;

  return { scrapedData, workspaceId, profileId, _initialStepIndex } as Partial<SetupState> & {
    _initialStepIndex?: number;
  };
}

/**
 * sendTeamInvitations — creates pending invitation records for team members.
 *
 * Naturally idempotent: checks for existing pending invitations before inserting,
 * so it's safe to call on both step leave AND wizard completion.
 */
async function sendTeamInvitations(
  supabase: ReturnType<typeof createClient>,
  state: SetupState,
): Promise<void> {
  const members = state.teamMembers;
  if (members.length === 0) return;

  // Resolve company_id from workspace
  const { data: ws } = await supabase
    .from("workspace")
    .select("company_id")
    .eq("workspace_id", state.workspaceId)
    .single();

  const companyId = ws?.company_id;
  if (!companyId) return;

  // Check existing pending invitations to avoid duplicates
  const emails = members.map((m) => m.email.trim()).filter(Boolean);
  const { data: existing } = await supabase
    .from("invitation")
    .select("email")
    .eq("workspace_id", state.workspaceId)
    .eq("status", "pending")
    .in("email", emails);

  const existingEmails = new Set((existing ?? []).map((e) => e.email));
  const newMembers = members.filter((m) => !existingEmails.has(m.email.trim()));
  if (newMembers.length === 0) return;

  const inviteRecords = newMembers.map((m) => ({
    workspace_id: state.workspaceId,
    company_id: companyId,
    email: m.email.trim() || null,
    first_name: m.firstName.trim(),
    last_name: m.lastName.trim(),
    role: m.role,
    department_ids: m.departmentId ? [m.departmentId] : [],
    status: "pending" as const,
    invite_type: "email" as const,
    invited_by: state.profileId,
    metadata: {
      ...(m.phone ? { phone: m.phone } : {}),
      ...(m.positionId ? { positionId: m.positionId } : {}),
      ...(m.employmentForm ? { employmentForm: m.employmentForm } : {}),
      ...(m.hourlyRate ? { hourlyRate: m.hourlyRate } : {}),
      ...(m.startDate ? { startDate: m.startDate } : {}),
      ...(m.positionPct ? { positionPct: m.positionPct } : {}),
      ...(m.birthDate ? { birthDate: m.birthDate } : {}),
      ...(m.address ? { address: m.address } : {}),
      ...(Object.keys(m.extraData).length > 0 ? { extraData: m.extraData } : {}),
    },
  }));

  const { error } = await supabase.from("invitation").insert(inviteRecords);
  if (error) {
    console.error("[setup-wizard] Failed to create invitations:", error);
  }
}

/**
 * onComplete — finalizes the setup wizard.
 *
 * Marks workspace setup as complete, sends any pending team invitations,
 * triggers K1b knowledge ingestion, and redirects to the dashboard.
 * Telemetry is NOT emitted here — useWizardTelemetry handles that.
 */
async function onComplete(state: SetupState): Promise<void> {
  const supabase = createClient();

  // 1. Mark workspace setup as completed
  const { error } = await supabase
    .from("workspace")
    .update({ setup_guide_completed: true })
    .eq("workspace_id", state.workspaceId);

  if (error) {
    throw new Error(`Failed to update setup_guide_completed: ${error.message}`);
  }

  // 2. Send team invitations if any pending
  if (state.teamMembers.length > 0) {
    await sendTeamInvitations(supabase, state);
  }

  // 3. Trigger K1b knowledge ingestion (non-blocking)
  void invokeEdgeFunction(supabase, "ingest-workspace-knowledge", {
    body: { workspace_id: state.workspaceId, force: true },
  });

  // 4. Clear session dismiss flag
  sessionStorage.removeItem("setup_dismissed");

  // 5. Hard navigation forces server layout re-fetch with updated setup state
  window.location.href = "/dashboard";
}

export const dashboardSetupWizard: WizardDefinition<SetupState> = {
  id: "dashboard-setup",
  theme: "light",

  metadata: {
    titleKey: "setup.title",
    descriptionKey: "setup.description",
    i18nNamespace: "dashboard",
  },

  brandPanel: {
    logoSrc: "/smartout-logo.png",
    position: "right" as const,
    messages: {
      welcome: {
        heading: "setup.brand_welcome_heading",
        sub: "setup.brand_welcome_sub",
      },
      "document-drop": {
        heading: "setup.brand_documents_heading",
        sub: "setup.brand_documents_sub",
      },
      governance: {
        heading: "setup.brand_governance_heading",
        sub: "setup.brand_governance_sub",
      },
      payroll: {
        heading: "setup.brand_payroll_heading",
        sub: "setup.brand_payroll_sub",
      },
      employment: {
        heading: "setup.brand_employment_heading",
        sub: "setup.brand_employment_sub",
      },
      team: {
        heading: "setup.brand_team_heading",
        sub: "setup.brand_team_sub",
      },
      "shift-template": {
        heading: "setup.brand_shifts_heading",
        sub: "setup.brand_shifts_sub",
      },
      season: {
        heading: "setup.brand_season_heading",
        sub: "setup.brand_season_sub",
      },
      handbook: {
        heading: "setup.brand_handbook_heading",
        sub: "setup.brand_handbook_sub",
      },
    },
  },

  initialState: defaultSetupState,
  loadState,
  onComplete,

  steps: [
    {
      id: "welcome",
      labelKey: "steps.welcome",
      iconName: "sparkles",
      component: WelcomeStepAdapter,
      skippable: true,
    },
    {
      id: "document-drop",
      labelKey: "steps.documents",
      iconName: "upload",
      component: DocumentDropStepAdapter,
      skippable: true,
    },
    {
      id: "governance",
      labelKey: "steps.governance",
      iconName: "shield-check",
      component: GovernanceStepAdapter,
    },
    {
      id: "payroll",
      labelKey: "steps.payroll",
      iconName: "dollar-sign",
      component: PayrollStepAdapter,
    },
    {
      id: "employment",
      labelKey: "steps.employment",
      iconName: "briefcase",
      component: EmploymentStepAdapter,
      onStepLeave: async () => {
        await callEmploymentSave();
      },
    },
    {
      id: "team",
      labelKey: "steps.team",
      iconName: "users",
      component: TeamStepAdapter,
      skippable: true,
      onStepLeave: async (state: SetupState) => {
        if (state.teamMembers.length > 0) {
          await sendTeamInvitations(createClient(), state);
        }
      },
    },
    {
      id: "shift-template",
      labelKey: "steps.shifts",
      iconName: "clock",
      component: ShiftTemplateStepAdapter,
      skippable: true,
    },
    {
      id: "season",
      labelKey: "steps.season",
      iconName: "calendar",
      component: SeasonStepAdapter,
    },
    {
      id: "handbook",
      labelKey: "steps.handbook",
      iconName: "book-open",
      component: HandbookStepAdapter,
      skippable: true,
    },
  ],
};
