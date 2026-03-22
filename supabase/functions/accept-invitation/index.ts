/**
 * accept-invitation/index.ts
 * Accepts a workspace invitation by token.
 *
 * Flow:
 * 1. Validate the invitation token (exists, pending, not expired)
 * 2. Create auth user via admin API (supabase.auth.admin.createUser)
 * 3. Update user_identity with first_name and last_name
 * 4. Create profile row in the workspace
 * 5. Assign departments (profile.department_id + departments array) and teams (team_member rows)
 * 6. Mark invitation as accepted
 *
 * Auth: No JWT required (unauthenticated -- invitee has no account yet).
 * Must be listed in config.toml with verify_jwt = false.
 *
 * Connected to: supabase/functions/create-invitation/index.ts (creates the invitation)
 * Connected to: apps/web/src/app/invite/[token]/page.tsx (frontend that calls this function)
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Generates a random 6-character profile code.
 * Matches the pattern used in activate_workspace RPCs:
 * substring(md5(random()::text) from 1 for 6)
 *
 * @returns A 6-char hex string like "a3f1b2"
 */
function generateProfileCode(): string {
  return crypto.randomUUID().replace(/-/g, "").substring(0, 6);
}

/**
 * Ensures a company_member row exists linking the user to the company.
 * Uses upsert so re-invites and idempotent re-clicks are safe.
 */
async function ensureCompanyMember(
  client: ReturnType<typeof createClient>,
  userId: string,
  companyId: string | null,
) {
  if (!companyId) return;
  await client
    .from("company_member")
    .upsert(
      {
        user_id: userId,
        company_id: companyId,
        role: "member",
        is_active: true,
        joined_at: new Date().toISOString(),
      },
      { onConflict: "user_id,company_id" },
    );
}

Deno.serve(async (req: Request) => {
  // ── CORS preflight ──
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Only accept POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Use service role -- invitee has no auth session yet
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // ── Parse and validate request body ──
    const body = await req.json();
    const { token, first_name, last_name, password } = body as {
      token: string;
      first_name: string;
      last_name: string;
      password: string;
    };

    if (!token || !first_name || !last_name || !password) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: token, first_name, last_name, password",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (password.length < 8) {
      return new Response(JSON.stringify({ error: "Password must be at least 8 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 1. Look up the invitation by token ──
    // Only fetch pending invitations -- accepted/expired/cancelled are ignored
    const { data: invitation, error: invError } = await adminClient
      .from("invitation")
      .select("*")
      .eq("token", token)
      .eq("status", "pending")
      .single();

    if (invError || !invitation) {
      return new Response(JSON.stringify({ error: "Invalid or expired invitation" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if the invitation has expired (7-day window from creation)
    if (new Date(invitation.expires_at) < new Date()) {
      // Mark as expired so it won't be found in future lookups
      await adminClient
        .from("invitation")
        .update({ status: "expired" })
        .eq("invitation_id", invitation.invitation_id);

      return new Response(JSON.stringify({ error: "This invitation has expired" }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 2. Create or find auth user ──
    // Check if an auth user already exists with this email.
    // This handles the case where someone was invited to multiple workspaces.
    const { data: listResult } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1,
      filter: invitation.email,
    });
    const existingUser = listResult?.users?.[0] ?? null;

    let userId: string;

    if (existingUser) {
      // User already has an auth account -- reuse it
      userId = existingUser.id;
    } else {
      // Create a new auth user with email pre-confirmed
      // The handle_new_user() trigger on auth.users will auto-create user_identity
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email: invitation.email,
        password,
        email_confirm: true,
        user_metadata: {
          first_name,
          last_name,
        },
      });

      if (createError || !newUser.user) {
        return new Response(
          JSON.stringify({
            error: `Failed to create account: ${createError?.message}`,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      userId = newUser.user.id;
    }

    // Update user_identity with the provided name
    // This covers both new users (trigger may have empty names) and existing users
    await adminClient.from("user_identity").update({ first_name, last_name }).eq("user_id", userId);

    // ── 3. Create profile in the workspace ──
    // Check if this user already has a profile in this workspace
    // (e.g., re-clicking the invitation link after already accepting)
    const { data: existingProfile } = await adminClient
      .from("profile")
      .select("profile_id")
      .eq("user_id", userId)
      .eq("workspace_id", invitation.workspace_id)
      .maybeSingle();

    if (existingProfile) {
      // Ensure company_member exists even on re-click
      await ensureCompanyMember(adminClient, userId, invitation.company_id);

      // Profile already exists -- just mark the invitation as accepted
      await adminClient
        .from("invitation")
        .update({ status: "accepted" })
        .eq("invitation_id", invitation.invitation_id);

      return new Response(
        JSON.stringify({
          success: true,
          workspace_id: invitation.workspace_id,
          profile_id: existingProfile.profile_id,
          message: "Already a member of this workspace",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Build department fields:
    // - department_id: first department (single FK on profile table)
    // - departments: full uuid array for multi-department support
    const departmentIds: string[] = invitation.department_ids ?? [];
    const teamIds: string[] = invitation.team_ids ?? [];

    const { data: profile, error: profileError } = await adminClient
      .from("profile")
      .insert({
        user_id: userId,
        workspace_id: invitation.workspace_id,
        company_id: invitation.company_id,
        profile_code: generateProfileCode(),
        display_name: `${first_name} ${last_name}`,
        role: invitation.role,
        status: "trainee",
        department_id: departmentIds.length > 0 ? departmentIds[0] : null,
        departments: departmentIds,
      })
      .select("profile_id")
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({
          error: `Failed to create profile: ${profileError?.message}`,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ── 3b. Ensure company_member exists ──
    await ensureCompanyMember(adminClient, userId, invitation.company_id);

    // ── 4. Assign teams via team_member join table ──
    if (teamIds.length > 0) {
      const teamRows = teamIds.map((teamId: string) => ({
        team_id: teamId,
        profile_id: profile.profile_id,
      }));
      await adminClient.from("team_member").insert(teamRows);
    }

    // ── 5. Employee cascade: contract + payroll profile ──
    const isEmployee = invitation.invite_employment_type === "employee";
    const meta = (invitation.metadata ?? {}) as Record<string, unknown>;

    if (isEmployee) {
      // 5a. Create draft employment_contract
      const startDate = (meta.start_date as string) || new Date().toISOString().split("T")[0];
      const { data: contract } = await adminClient
        .from("employment_contract")
        .insert({
          workspace_id: invitation.workspace_id,
          profile_id: profile.profile_id,
          status: "draft",
          position_title: invitation.role || "employee",
          employment_category: (meta.employment_category as string) || "fast",
          start_date: startDate,
          agreed_weekly_hours: meta.intended_weekly_hours
            ? Number(meta.intended_weekly_hours)
            : null,
        })
        .select("contract_id")
        .single();

      // 5b. Create employee_payroll_profile from template or metadata
      const salaryType = (meta.salary_type as string) || "hourly";
      const weeklyHours = meta.intended_weekly_hours ? Number(meta.intended_weekly_hours) : 37.5;
      const templateId = (meta.payroll_template_id as string) || null;

      // If a template was selected, read its defaults
      let tariffCategory = "ufaglart";
      if (templateId) {
        const { data: template } = await adminClient
          .from("payroll_profile_template")
          .select("tariff_category")
          .eq("id", templateId)
          .single();
        if (template?.tariff_category) tariffCategory = template.tariff_category;
      }

      await adminClient.from("employee_payroll_profile").insert({
        workspace_id: invitation.workspace_id,
        profile_id: profile.profile_id,
        employment_contract_id: contract?.contract_id ?? null,
        salary_type: salaryType,
        agreed_weekly_hours: weeklyHours,
        tariff_category: tariffCategory,
        seniority_start_date: startDate,
        has_fagbrev: tariffCategory === "faglart",
        valid_from: startDate,
        seeded_from_template_id: templateId,
        seeded_at: templateId ? new Date().toISOString() : null,
      });

      // 5c. Promote profile to active (payroll profile created = operational employee)
      await adminClient
        .from("profile")
        .update({ status: "active" })
        .eq("profile_id", profile.profile_id);
    } else {
      // Guest invite: set active directly, no contract/payroll
      await adminClient
        .from("profile")
        .update({ status: "active" })
        .eq("profile_id", profile.profile_id);
    }

    // ── 6. Mark invitation as accepted ──
    await adminClient
      .from("invitation")
      .update({ status: "accepted" })
      .eq("invitation_id", invitation.invitation_id);

    return new Response(
      JSON.stringify({
        success: true,
        workspace_id: invitation.workspace_id,
        profile_id: profile.profile_id,
        employment_type: invitation.invite_employment_type ?? "guest",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: unknown) {
    console.error("accept-invitation error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
