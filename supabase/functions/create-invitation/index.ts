import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { sendSms } from "../_shared/twilio.ts";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * create-invitation Edge Function
 *
 * Supports two modes:
 *
 * 1. Batch mode (legacy): { workspace_id, company_id, invites: [...] }
 *    Used by the team member management UI for bulk invites.
 *
 * 2. Single mode (new): { workspace_id, invite_type, email?, phone?, role? }
 *    Used by the onboarding InviteStep for email/SMS/link invites.
 *    Dispatches email via SendGrid or SMS via Twilio.
 *
 * Telemetry: emits to activity_trail + engine_event via direct inserts
 * (Edge Functions can't import emit() from @smartout/telemetry).
 * Reference pattern: supabase/functions/accept-invitation/index.ts:414-431.
 * Tokens are ADR-0167 credentials — always censored to first 8 chars
 * in telemetry payloads. Never log or store full token values.
 */

// Censor an invitation token for telemetry payloads per ADR-0167.
// Tokens are credentials; never log the full value.
function censorToken(token: string): string {
  return token.substring(0, 8) + "...";
}

type DispatchOutcome = {
  channel: "email" | "sms" | "link_only" | "whatsapp";
  outcome: "sent" | "failed";
  reason?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
    );

    // Admin client for telemetry inserts (activity_trail + engine_event bypass RLS).
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Verify authentication
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const body = await req.json();

    // Detect mode: batch (has invites array) vs single (has invite_type)
    if (body.invites && Array.isArray(body.invites)) {
      return await handleBatchInvites(supabaseClient, adminClient, user, body);
    } else if (body.invite_type) {
      return await handleSingleInvite(supabaseClient, adminClient, user, body);
    } else {
      throw new Error("Invalid request: must provide either 'invites' array or 'invite_type'");
    }
  } catch (error: unknown) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      },
    );
  }
});

// ── Telemetry helpers ─────────────────────────────────────────────────

// activity_trail uses human-readable "invitation created" (registry convention).
// engine_event uses dot-separated "invitation.created" (engine_trigger convention).
// Mirrors the bifurcated pattern from accept-invitation/index.ts:414-431.
async function emitInvitationCreated(
  adminClient: ReturnType<typeof createClient>,
  args: {
    invitation_id: string;
    workspace_id: string;
    actor_profile_id: string;
    role: string;
    token: string;
    employment_type: string | null;
    entity_label: string;
    bulk_count?: number;
  },
): Promise<void> {
  const data: Record<string, unknown> = {
    invitation_id: args.invitation_id,
    workspace_id: args.workspace_id,
    role: args.role,
    token_preview: censorToken(args.token),
    employment_type: args.employment_type ?? undefined,
  };
  if (args.bulk_count !== undefined) data.bulk_count = args.bulk_count;

  await Promise.all([
    adminClient.from("activity_trail").insert({
      event: "invitation created",
      action_verb: "created",
      category: "auth",
      entity_type: "invitation",
      entity_id: args.invitation_id,
      entity_label: args.entity_label,
      actor_id: args.actor_profile_id,
      workspace_id: args.workspace_id,
      data,
      source: "edge-function",
    }),
    adminClient.from("engine_event").insert({
      event_type: "invitation.created",
      workspace_id: args.workspace_id,
      payload: data,
    }),
  ]);
}

async function emitInvitationDispatched(
  adminClient: ReturnType<typeof createClient>,
  args: {
    invitation_id: string;
    workspace_id: string;
    actor_profile_id: string;
    token: string;
    entity_label: string;
    dispatch: DispatchOutcome;
  },
): Promise<void> {
  const data = {
    invitation_id: args.invitation_id,
    workspace_id: args.workspace_id,
    channel: args.dispatch.channel,
    outcome: args.dispatch.outcome,
    reason: args.dispatch.reason,
    token_preview: censorToken(args.token),
  };

  await adminClient.from("activity_trail").insert({
    event: "invitation dispatched",
    action_verb: "dispatched",
    category: "auth",
    entity_type: "invitation",
    entity_id: args.invitation_id,
    entity_label: args.entity_label,
    actor_id: args.actor_profile_id,
    workspace_id: args.workspace_id,
    data,
    source: "edge-function",
  });
}

// ── Batch mode (legacy) ──────────────────────────────────────────────

async function handleBatchInvites(
  supabaseClient: ReturnType<typeof createClient>,
  adminClient: ReturnType<typeof createClient>,
  user: { id: string },
  body: {
    workspace_id: string;
    company_id: string;
    invites: Record<string, unknown>[];
    skip_dispatch?: boolean;
  },
) {
  const { workspace_id, company_id, invites } = body;
  if (!workspace_id || !company_id || !invites?.length) {
    throw new Error("Invalid request payload");
  }

  const inviterProfile = await resolveInviterProfile(supabaseClient, user.id, workspace_id);

  const recordsToInsert = invites.map((inv) => ({
    workspace_id,
    company_id,
    email: inv.email as string,
    first_name: inv.first_name as string | undefined,
    last_name: inv.last_name as string | undefined,
    role: (inv.role as string) || "employee",
    department_ids: inv.department_ids || [],
    team_ids: inv.team_ids || [],
    status: "pending",
    invite_type: "email",
    invited_by: inviterProfile.profile_id,
    invite_employment_type: (inv.invite_employment_type as string) || null,
    metadata: inv.metadata ?? null,
  }));

  const { data: insertedInvites, error: insertError } = await supabaseClient
    .from("invitation")
    .insert(recordsToInsert)
    .select();

  if (insertError) {
    console.error("Insert error:", insertError);
    throw new Error("Failed to create invitations in the database");
  }

  // Emit "invitation created" per inserted row. Runs in parallel because
  // rows share no state; failures are logged but do not block the response.
  await Promise.all(
    (
      insertedInvites as Array<{
        invitation_id: string;
        token: string;
        role: string;
        invite_employment_type: string | null;
        email: string | null;
        first_name: string | null;
        last_name: string | null;
      }>
    ).map((inv) =>
      emitInvitationCreated(adminClient, {
        invitation_id: inv.invitation_id,
        workspace_id,
        actor_profile_id: inviterProfile.profile_id,
        role: inv.role,
        token: inv.token,
        employment_type: inv.invite_employment_type,
        entity_label:
          [inv.first_name, inv.last_name].filter(Boolean).join(" ") || inv.email || "invitation",
        bulk_count: insertedInvites.length,
      }).catch((err) => {
        console.error("Failed to emit invitation created:", err);
      }),
    ),
  );

  // Dispatch emails unless skip_dispatch is set (CSV import skips dispatch)
  let dispatched = 0;
  let dispatchFailed = 0;

  if (!body.skip_dispatch) {
    const siteUrl = Deno.env.get("SITE_URL") || "https://app.smartout.ai";
    const emailTargets = (
      insertedInvites as Array<{
        invitation_id: string;
        token: string;
        email: string | null;
        first_name: string | null;
        last_name: string | null;
      }>
    ).filter((inv) => inv.email);

    const dispatchResults = await Promise.all(
      emailTargets.map(async (inv) => {
        const inviteUrl = `${siteUrl}/invite/${inv.token}`;
        const result = await sendEmailInvite(inv.email!, inviteUrl, workspace_id);
        await emitInvitationDispatched(adminClient, {
          invitation_id: inv.invitation_id,
          workspace_id,
          actor_profile_id: inviterProfile.profile_id,
          token: inv.token,
          entity_label:
            [inv.first_name, inv.last_name].filter(Boolean).join(" ") || inv.email || "invitation",
          dispatch: { channel: "email", ...result },
        }).catch((err) => {
          console.error("Failed to emit invitation dispatched:", err);
        });
        return result;
      }),
    );

    dispatched = dispatchResults.filter((r) => r.outcome === "sent").length;
    dispatchFailed = dispatchResults.filter((r) => r.outcome === "failed").length;
  }

  return new Response(
    JSON.stringify({
      success: true,
      count: insertedInvites.length,
      dispatched,
      failed: dispatchFailed,
      invitations: insertedInvites,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    },
  );
}

// ── Single mode (new — onboarding InviteStep) ────────────────────────

async function handleSingleInvite(
  supabaseClient: ReturnType<typeof createClient>,
  adminClient: ReturnType<typeof createClient>,
  user: { id: string },
  body: {
    workspace_id: string;
    invite_type: "email" | "sms" | "link";
    channels?: string[];
    email?: string;
    phone?: string;
    role?: string;
    first_name?: string;
    last_name?: string;
    department_ids?: string[];
    invite_employment_type?: string;
    metadata?: Record<string, unknown>;
  },
) {
  const {
    workspace_id,
    invite_type,
    email,
    phone,
    role,
    first_name,
    last_name,
    department_ids,
    invite_employment_type,
    metadata,
  } = body;
  const channels: string[] = body.channels ?? [invite_type];
  if (!workspace_id) throw new Error("workspace_id is required");

  // Validate required fields per active channel
  if (channels.includes("email") && !email)
    throw new Error("email is required when email channel is active");
  if (channels.includes("sms") && !phone)
    throw new Error("phone is required when SMS channel is active");

  // Resolve company_id from workspace
  const { data: ws } = await supabaseClient
    .from("workspace")
    .select("company_id")
    .eq("workspace_id", workspace_id)
    .single();

  if (!ws?.company_id) throw new Error("Could not resolve company for workspace");

  const inviterProfile = await resolveInviterProfile(supabaseClient, user.id, workspace_id);

  // Store the primary invite_type as "link" (always generated) but record all channels in metadata
  const { data: invitation, error: insertError } = await supabaseClient
    .from("invitation")
    .insert({
      workspace_id,
      company_id: ws.company_id,
      invite_type: "link",
      email: email || null,
      phone: phone || null,
      role: role || "employee",
      first_name: first_name || null,
      last_name: last_name || null,
      department_ids: department_ids || [],
      invite_employment_type: invite_employment_type || null,
      metadata: { ...(metadata ?? {}), channels },
      status: "pending",
      invited_by: inviterProfile.profile_id,
    })
    .select("invitation_id, token, email, phone, invite_type")
    .single();

  if (insertError) {
    console.error("Insert error:", insertError);
    throw new Error("Failed to create invitation");
  }

  const entityLabel =
    [first_name, last_name].filter(Boolean).join(" ") || email || phone || "invitation";

  // Emit "invitation created" once per row. Failures logged but do not block.
  await emitInvitationCreated(adminClient, {
    invitation_id: invitation.invitation_id,
    workspace_id,
    actor_profile_id: inviterProfile.profile_id,
    role: role || "employee",
    token: invitation.token,
    employment_type: invite_employment_type || null,
    entity_label: entityLabel,
  }).catch((err) => {
    console.error("Failed to emit invitation created:", err);
  });

  // Dispatch notifications for each active channel
  const inviteUrl = `${Deno.env.get("SITE_URL") || "https://app.smartout.ai"}/invite/${invitation.token}`;

  if (channels.includes("email") && email) {
    const result = await sendEmailInvite(email, inviteUrl, workspace_id);
    await emitInvitationDispatched(adminClient, {
      invitation_id: invitation.invitation_id,
      workspace_id,
      actor_profile_id: inviterProfile.profile_id,
      token: invitation.token,
      entity_label: entityLabel,
      dispatch: { channel: "email", ...result },
    }).catch((err) => {
      console.error("Failed to emit invitation dispatched (email):", err);
    });
  }
  if (channels.includes("sms") && phone) {
    const result = await sendSmsInvite(phone, inviteUrl);
    await emitInvitationDispatched(adminClient, {
      invitation_id: invitation.invitation_id,
      workspace_id,
      actor_profile_id: inviterProfile.profile_id,
      token: invitation.token,
      entity_label: entityLabel,
      dispatch: { channel: "sms", ...result },
    }).catch((err) => {
      console.error("Failed to emit invitation dispatched (sms):", err);
    });
  }
  // link channel: token always returned to client — emit as "sent" (link_only)
  if (channels.includes("link")) {
    await emitInvitationDispatched(adminClient, {
      invitation_id: invitation.invitation_id,
      workspace_id,
      actor_profile_id: inviterProfile.profile_id,
      token: invitation.token,
      entity_label: entityLabel,
      dispatch: { channel: "link_only", outcome: "sent" },
    }).catch((err) => {
      console.error("Failed to emit invitation dispatched (link):", err);
    });
  }

  return new Response(
    JSON.stringify({
      success: true,
      invitation_id: invitation.invitation_id,
      token: invitation.token,
      invite_type: "link",
      channels,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    },
  );
}

// ── Shared helpers ───────────────────────────────────────────────────

async function resolveInviterProfile(
  supabaseClient: ReturnType<typeof createClient>,
  userId: string,
  workspaceId: string,
) {
  const { data: inviterProfile, error: profileError } = await supabaseClient
    .from("profile")
    .select("profile_id, role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .single();

  if (profileError || !inviterProfile) {
    throw new Error("Could not verify your role in this workspace");
  }

  if (!["admin", "owner"].includes(inviterProfile.role)) {
    throw new Error("Insufficient permissions to invite employees");
  }

  return inviterProfile;
}

// ── Email dispatch via SendGrid HTTP API ─────────────────────────────

async function sendEmailInvite(
  recipientEmail: string,
  inviteUrl: string,
  workspaceId: string,
): Promise<{ outcome: "sent" | "failed"; reason?: string }> {
  const apiKey = Deno.env.get("SENDGRID_API_KEY");
  if (!apiKey) {
    console.warn("SENDGRID_API_KEY not configured, skipping email dispatch");
    return { outcome: "failed", reason: "sendgrid_api_key_missing" };
  }

  // Resolve workspace name for the email
  let workspaceName = "your team";
  try {
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const { data: ws } = await adminClient
      .from("workspace")
      .select("name")
      .eq("workspace_id", workspaceId)
      .single();
    if (ws?.name) workspaceName = ws.name;
  } catch {
    // Use fallback name
  }

  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: recipientEmail }] }],
        from: { email: "noreply@smartout.io", name: "Smartout" },
        subject: `You've been invited to join ${workspaceName} on Smartout`,
        content: [
          {
            type: "text/html",
            value: `
              <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
                <h2 style="color: #111;">You're invited!</h2>
                <p style="color: #555; line-height: 1.6;">
                  You've been invited to join <strong>${workspaceName}</strong> on Smartout.
                  Click the button below to get started.
                </p>
                <a href="${inviteUrl}" style="display: inline-block; background: #06b6d4; color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 16px;">
                  Accept Invitation
                </a>
                <p style="color: #999; font-size: 12px; margin-top: 24px;">
                  This invitation expires in 7 days. If you didn't expect this, you can safely ignore it.
                </p>
              </div>
            `,
          },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("SendGrid error:", res.status, text);
      return { outcome: "failed", reason: `sendgrid_${res.status}` };
    }
    return { outcome: "sent" };
  } catch (err) {
    console.error("Failed to send email:", err);
    return { outcome: "failed", reason: err instanceof Error ? err.message : "unknown_error" };
  }
}

// ── SMS dispatch via shared Twilio helper ────────────────────────────

async function sendSmsInvite(
  phone: string,
  inviteUrl: string,
): Promise<{ outcome: "sent" | "failed"; reason?: string }> {
  try {
    await sendSms(phone, `You've been invited to join Smartout! Accept here: ${inviteUrl}`);
    return { outcome: "sent" };
  } catch (err) {
    console.error("Failed to send SMS:", err);
    return { outcome: "failed", reason: err instanceof Error ? err.message : "unknown_error" };
  }
}
