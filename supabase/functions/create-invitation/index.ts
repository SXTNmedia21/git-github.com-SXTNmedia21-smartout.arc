import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { sendSms } from "../_shared/twilio.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

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
 */
Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
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
      return await handleBatchInvites(supabaseClient, user, body);
    } else if (body.invite_type) {
      return await handleSingleInvite(supabaseClient, user, body);
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

// ── Batch mode (legacy) ──────────────────────────────────────────────

async function handleBatchInvites(
  supabaseClient: ReturnType<typeof createClient>,
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

  // Dispatch emails unless skip_dispatch is set (CSV import skips dispatch)
  let dispatched = 0;
  let dispatchFailed = 0;

  if (!body.skip_dispatch) {
    const siteUrl = Deno.env.get("SITE_URL") || "https://app.smartout.ai";
    const dispatchResults = await Promise.allSettled(
      insertedInvites
        .filter((inv: { email: string | null }) => inv.email)
        .map((inv: { email: string; token: string }) => {
          const inviteUrl = `${siteUrl}/invite/${inv.token}`;
          return sendEmailInvite(inv.email, inviteUrl, body.workspace_id);
        }),
    );

    dispatched = dispatchResults.filter((r) => r.status === "fulfilled").length;
    dispatchFailed = dispatchResults.filter((r) => r.status === "rejected").length;
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

  // Dispatch notifications for each active channel
  const inviteUrl = `${Deno.env.get("SITE_URL") || "https://app.smartout.ai"}/invite/${invitation.token}`;

  if (channels.includes("email") && email) {
    await sendEmailInvite(email, inviteUrl, workspace_id);
  }
  if (channels.includes("sms") && phone) {
    await sendSmsInvite(phone, inviteUrl);
  }
  // link channel: token always returned to client

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

async function sendEmailInvite(recipientEmail: string, inviteUrl: string, workspaceId: string) {
  const apiKey = Deno.env.get("SENDGRID_API_KEY");
  if (!apiKey) {
    console.warn("SENDGRID_API_KEY not configured, skipping email dispatch");
    return;
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
        from: { email: "noreply@smartout.ai", name: "Smartout" },
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
    }
  } catch (err) {
    console.error("Failed to send email:", err);
  }
}

// ── SMS dispatch via shared Twilio helper ────────────────────────────

async function sendSmsInvite(phone: string, inviteUrl: string) {
  await sendSms(phone, `You've been invited to join Smartout! Accept here: ${inviteUrl}`);
}
