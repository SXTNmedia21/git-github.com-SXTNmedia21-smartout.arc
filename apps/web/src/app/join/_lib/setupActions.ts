"use server";

// ============================================
// setupActions.ts
// Completes the public /join intake flow and
// hands the user off to authenticated onboarding.
// Why: /join is provisional intake only.
// Final workspace truth is created in /onboarding.
// ============================================

import { createAdminClient } from "@smartout/supabase/admin";
import { createClient } from "@smartout/supabase/server"; // for auth only
import type { Json } from "@smartout/supabase";
import { emit } from "@smartout/telemetry";
import { buildOnboardingShellIntelligence, type SignupSetupData } from "./onboarding-shell";

type DbIndustry = "restaurant" | "hotel" | "cafe" | "bar" | "catering" | "other";

const INDUSTRY_MAP: Record<string, DbIndustry> = {
  restaurant: "restaurant",
  cafe: "cafe",
  bar: "bar",
  hotel: "hotel",
  catering: "catering",
  fast_food: "restaurant",
  retail: "other",
  other: "other",
};

function mapIndustry(value: string): DbIndustry {
  return INDUSTRY_MAP[value] ?? "other";
}

type WorkspaceShellRow = {
  workspace_id: string;
  slug: string;
  company_id: string | null;
  contract_status: string | null;
  intelligence_data: Record<string, unknown> | null;
};

/**
 * Finds an unfinished onboarding workspace for the user when one already exists.
 * Why: retries should resume the same shell instead of provisioning duplicates.
 *
 * @returns The active onboarding shell, or null when none exists
 */
async function findExistingOnboardingWorkspace(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<WorkspaceShellRow | null> {
  const { data } = await admin
    .from("profile")
    .select(
      "workspace:workspace_id(workspace_id, slug, company_id, contract_status, intelligence_data)",
    )
    .eq("user_id", userId)
    .limit(20);

  if (!data || data.length === 0) {
    return null;
  }

  const shells = data
    .map((row) => row.workspace as WorkspaceShellRow | null)
    .filter((row): row is WorkspaceShellRow => row !== null);

  return shells.find((row) => row.contract_status === "onboarding") ?? null;
}

/**
 * Finds any workspace for the user after signup is already marked complete.
 * Why: the action needs an idempotent success path even when the shell is already promoted.
 *
 * @returns The most recent workspace we can safely route back into
 */
async function findExistingWorkspace(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<WorkspaceShellRow | null> {
  const { data } = await admin
    .from("profile")
    .select(
      "workspace:workspace_id(workspace_id, slug, company_id, contract_status, intelligence_data)",
    )
    .eq("user_id", userId)
    .limit(1)
    .single();

  return (data?.workspace as WorkspaceShellRow | null) ?? null;
}

/**
 * Completes public signup by provisioning or reusing an onboarding shell.
 * Why: `/join` owns provisional intake, while `/onboarding` owns final workspace truth.
 *
 * @returns The workspace shell identity used for the `/onboarding` handoff
 */
export async function completeSignup(data: SignupSetupData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const admin = createAdminClient();

  // ── Idempotency guard: prevent duplicate company creation ──────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingProgress } = await (admin as any)
    .from("signup_progress")
    .select("completed")
    .eq("auth_id", user.id)
    .single();

  const existingShell = await findExistingOnboardingWorkspace(admin, user.id);

  if (existingProgress?.completed) {
    const completedWorkspace = existingShell ?? (await findExistingWorkspace(admin, user.id));

    if (completedWorkspace) {
      return {
        workspaceId: completedWorkspace.workspace_id,
        slug: completedWorkspace.slug,
      };
    }

    throw new Error("Signup already completed but workspace not found");
  }

  // ── Phase 1: Provision or reuse a workspace shell ─────────────

  // 1. Update user_identity with name
  const { error: identityError } = await admin
    .from("user_identity")
    .update({
      first_name: data.step2.firstName,
      last_name: data.step2.lastName,
    })
    .eq("user_id", user.id);

  if (identityError) {
    console.error("[completeSignup] user_identity update failed:", identityError);
  }

  const shellIntelligence = buildOnboardingShellIntelligence(data);
  let workspace = existingShell;

  if (!workspace) {
    const { data: workspaceId, error: provisionError } = await admin.rpc(
      "provision_onboarding_workspace",
      {
        p_user_id: user.id,
        p_company_name: data.step1.companyName,
        p_intelligence_data: shellIntelligence as unknown as Json,
      },
    );

    if (provisionError || !workspaceId) {
      throw new Error(
        `Failed to provision onboarding workspace: ${provisionError?.message ?? "unknown"}`,
      );
    }

    const { data: provisionedWorkspace, error: workspaceError } = await admin
      .from("workspace")
      .select("workspace_id, slug, company_id, contract_status, intelligence_data")
      .eq("workspace_id", workspaceId)
      .single();

    if (workspaceError || !provisionedWorkspace) {
      throw new Error(
        `Failed to load onboarding workspace: ${workspaceError?.message ?? "unknown"}`,
      );
    }

    workspace = provisionedWorkspace as WorkspaceShellRow;
  }

  const mergedIntelligence = {
    ...(workspace.intelligence_data ?? {}),
    ...shellIntelligence,
  };

  const { error: workspaceUpdateError } = await admin
    .from("workspace")
    .update({
      name: data.step1.companyName,
      phone: data.step4.phone,
      email: user.email,
      intelligence_data: mergedIntelligence as Json,
    })
    .eq("workspace_id", workspace.workspace_id);

  if (workspaceUpdateError) {
    throw new Error(`Failed to update onboarding workspace: ${workspaceUpdateError.message}`);
  }

  if (workspace.company_id) {
    const { error: companyError } = await admin
      .from("company")
      .update({
        name: data.step1.companyName,
        legal_name: data.step1.companyName,
        org_number: data.step2.orgNumber,
        address_line_1: data.step2.street,
        postal_code: data.step2.postalCode,
        city: data.step2.city,
        phone: data.step4.phone,
        email: user.email,
        website: data.step1.websiteUrl,
        industry: mapIndustry(data.step1.industry),
      })
      .eq("company_id", workspace.company_id);

    if (companyError) {
      console.error("[completeSignup] provisional company update failed:", companyError);
    }
  }

  const { data: profileData, error: profileError } = await admin
    .from("profile")
    .update({
      role: "owner",
      status: "active",
      display_name: `${data.step2.firstName} ${data.step2.lastName}`,
    })
    .eq("user_id", user.id)
    .eq("workspace_id", workspace.workspace_id)
    .select("profile_id")
    .single();

  if (profileError || !profileData) {
    throw new Error(`Failed to update onboarding profile: ${profileError?.message ?? "unknown"}`);
  }

  const actorId = profileData.profile_id;

  // ── Phase 2: Provisional intake persistence ─────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from("company_details").delete().eq("workspace_id", workspace.workspace_id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: detailsError } = await (admin as any).from("company_details").insert({
    workspace_id: workspace.workspace_id,
    about_us: data.step3.aboutUs || null,
    our_history: data.step3.ourHistory || null,
    our_concept: data.step3.ourConcept || null,
    restaurant_type: data.step5.restaurantType || null,
    cuisine_types: data.step5.cuisineTypes || [],
    price_category: data.step5.priceCategory || null,
    menu_description: data.step5.menuDescription || null,
    employee_count: data.step6.employeeCount || null,
    ai_generated_fields: [],
    field_sources: data.intelligence ? shellIntelligence.join_intake.fieldSources : {},
  });

  if (detailsError) {
    console.error("[completeSignup] company_details insert failed:", detailsError);
  }

  const hoursRows = data.step4.openingHours.map((h) => ({
    workspace_id: workspace.workspace_id,
    day_of_week: h.dayOfWeek,
    is_closed: h.isClosed,
    open_time: h.isClosed ? null : h.openTime || null,
    close_time: h.isClosed ? null : h.closeTime || null,
  }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .from("company_opening_hours")
    .delete()
    .eq("workspace_id", workspace.workspace_id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: hoursError } = await (admin as any)
    .from("company_opening_hours")
    .insert(hoursRows);

  if (hoursError) {
    console.error("[completeSignup] company_opening_hours insert failed:", hoursError);
  }

  const socialRows: Array<{
    workspace_id: string;
    platform: string;
    url: string;
  }> = [];
  if (data.step4.instagram) {
    socialRows.push({
      workspace_id: workspace.workspace_id,
      platform: "instagram",
      url: data.step4.instagram,
    });
  }
  if (data.step4.facebook) {
    socialRows.push({
      workspace_id: workspace.workspace_id,
      platform: "facebook",
      url: data.step4.facebook,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .from("company_social_media")
    .delete()
    .eq("workspace_id", workspace.workspace_id);
  if (socialRows.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: socialError } = await (admin as any)
      .from("company_social_media")
      .insert(socialRows);
    if (socialError) {
      console.error("[completeSignup] company_social_media insert failed:", socialError);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .from("company_scraped_data")
    .update({
      workspace_id: workspace.workspace_id,
      parsed_data: mergedIntelligence as Json,
    })
    .eq("auth_id", user.id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .from("signup_progress")
    .update({ completed: true, current_step: 7 })
    .eq("auth_id", user.id);

  // Keep invite capture non-breaking by recreating any pending invites on the shell.
  await admin
    .from("invitation")
    .delete()
    .eq("workspace_id", workspace.workspace_id)
    .eq("status", "pending");

  if (data.step6.teamInvites && data.step6.teamInvites.length > 0 && workspace.company_id) {
    const companyId = workspace.company_id;
    const invitations = data.step6.teamInvites.map((email) => ({
      workspace_id: workspace.workspace_id,
      company_id: companyId,
      email,
      role: "employee" as const,
      status: "pending" as const,
      invited_by: actorId,
    }));
    await admin.from("invitation").insert(invitations);
  }

  // ── Telemetry ──────────────────────────────────────────────────
  await emit({
    event: "wizard completed",
    workspace_id: workspace.workspace_id,
    actor_id: actorId,
    properties: {
      data: { wizard_id: "setup", workspace_id: workspace.workspace_id },
    },
  });

  return { workspaceId: workspace.workspace_id, slug: workspace.slug };
}
