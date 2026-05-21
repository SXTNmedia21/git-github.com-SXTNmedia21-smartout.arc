/**
 * send-login-code Edge Function
 *
 * Allows managers/admins to send a magic link login to an employee.
 * Looks up the employee's email or phone via their profile, generates
 * a Supabase magic link, and delivers it via SendGrid (email) or Twilio (SMS).
 *
 * Input: { profile_id: string, channel: "email" | "sms" }
 * Auth: Bearer JWT — caller must be manager/admin/owner in the same workspace.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { sendSms } from "../_shared/twilio.ts";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: req.headers.get("Authorization")! } },
    });

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is authenticated
    const {
      data: { user: caller },
      error: authError,
    } = await callerClient.auth.getUser();
    if (authError || !caller) throw new Error("Unauthorized");

    const { profile_id, channel } = await req.json();
    if (!profile_id || !["email", "sms"].includes(channel)) {
      throw new Error("Invalid request: profile_id and channel ('email' | 'sms') required");
    }

    // Look up the target employee profile + workspace
    const { data: targetProfile, error: profileError } = await adminClient
      .from("profile")
      .select("profile_id, user_id, workspace_id, display_name")
      .eq("profile_id", profile_id)
      .single();

    if (profileError || !targetProfile) throw new Error("Profile not found");

    // Verify caller has manager/admin/owner role in the same workspace
    const { data: callerProfile, error: callerError } = await adminClient
      .from("profile")
      .select("role")
      .eq("user_id", caller.id)
      .eq("workspace_id", targetProfile.workspace_id)
      .eq("is_active", true)
      .single();

    if (callerError || !callerProfile) throw new Error("Not a member of this workspace");

    const allowedRoles = ["manager", "admin", "owner"];
    if (!allowedRoles.includes(callerProfile.role)) {
      throw new Error("Insufficient permissions — manager, admin, or owner required");
    }

    // Resolve the employee's contact info from auth.users
    const { data: authUser, error: authUserError } = await adminClient.auth.admin.getUserById(
      targetProfile.user_id,
    );
    if (authUserError || !authUser?.user) throw new Error("User not found in auth system");

    const userEmail = authUser.user.email;
    const userPhone = authUser.user.phone;

    // Resolve workspace name for the message
    const { data: workspace } = await adminClient
      .from("workspace")
      .select("name")
      .eq("workspace_id", targetProfile.workspace_id)
      .single();
    const workspaceName = workspace?.name ?? "Smartout";

    // Resolve the web origin once — the magic link must point at the web
    // /api/auth/callback so PKCE exchange runs (mirrors the password-reset
    // fix in commit c29155e6c). The previous `smartout://auth/callback`
    // value was mobile-only and silently 404'd for every desktop recipient.
    const siteUrl = Deno.env.get("SITE_URL") || "https://app.smartout.ai";
    const webRedirectTo = `${siteUrl}/api/auth/callback?next=/dashboard`;

    if (channel === "email") {
      if (!userEmail) throw new Error("Employee has no email registered");

      const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
        type: "magiclink",
        email: userEmail,
        options: {
          redirectTo: webRedirectTo,
        },
      });

      if (linkError || !linkData?.properties?.action_link) {
        throw new Error("Failed to generate magic link");
      }

      // generateLink returns BOTH a clickable action_link AND a 6-digit
      // email_otp the user can type into /login → Engangskode tab. Surface
      // both — desktop users on a hostile mail client (no clickable links)
      // can still log in by reading the code aloud or copy-pasting it.
      await sendEmailLoginCode(
        userEmail,
        linkData.properties.action_link,
        linkData.properties.email_otp,
        workspaceName,
      );
    } else {
      if (!userPhone) throw new Error("Employee has no phone number registered");

      if (userEmail) {
        // generateLink works on email even when we deliver via SMS — the
        // OTP code is the same on both channels. We prefer SMS-delivering
        // the 6-digit code (160-char-friendly + no link-rewriter mangling)
        // and skip the full URL.
        const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
          type: "magiclink",
          email: userEmail,
          options: {
            redirectTo: webRedirectTo,
          },
        });

        if (linkError || !linkData?.properties?.email_otp) {
          throw new Error("Failed to generate login code");
        }

        const smsBody =
          `Smartout: din innloggingskode for ${workspaceName} er ${linkData.properties.email_otp}. ` +
          `Skriv den inn pa Logg inn -> Engangskode. Koden er gyldig i 1 time.`;

        const result = await sendSms(userPhone, smsBody);
        if (!result.success) {
          throw new Error(`Failed to send SMS: ${result.error}`);
        }
      } else {
        // Phone-only user: trigger phone OTP directly (Supabase delivers SMS).
        const { error: otpError } = await adminClient.auth.signInWithOtp({
          phone: userPhone,
        });
        if (otpError) throw new Error(`Failed to send OTP: ${otpError.message}`);
      }
    }

    // Log to activity_trail
    await adminClient.from("activity_trail").insert({
      workspace_id: targetProfile.workspace_id,
      actor_id: caller.id,
      event: `Login code sent to ${targetProfile.display_name} via ${channel}`,
      action_verb: "sent",
      category: "auth",
      entity_type: "profile",
      entity_id: profile_id,
      metadata: { channel, target_profile_id: profile_id },
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("send-login-code error:", message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});

/**
 * Send a magic-link login email via SendGrid. The body carries BOTH the
 * clickable button and the 6-digit code so a recipient on a mail client
 * that strips links (or a recipient on a different device than the one
 * they want to log in on) can still get in by typing the code into the
 * "Engangskode" tab on /login.
 *
 * Falls back silently if SendGrid is not configured (dev environment).
 */
async function sendEmailLoginCode(
  recipientEmail: string,
  magicLink: string,
  otpCode: string | undefined,
  workspaceName: string,
) {
  const apiKey = Deno.env.get("SENDGRID_API_KEY");
  if (!apiKey) {
    console.warn("SENDGRID_API_KEY not configured, skipping email dispatch");
    return;
  }

  // Render the code as monospaced digit chips when present. If the SDK
  // surface ever stops returning email_otp (Supabase upgrade), the email
  // still works via the clickable button — graceful degradation.
  const codeBlock = otpCode
    ? `
              <div style="margin: 24px 0; padding: 20px; background: #f9fafb; border-radius: 12px; text-align: center;">
                <p style="color: #666; font-size: 13px; margin: 0 0 8px;">Eller skriv inn koden manuelt:</p>
                <p style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 28px; letter-spacing: 6px; font-weight: 600; color: #1a1a1a; margin: 0;">${otpCode}</p>
                <p style="color: #999; font-size: 12px; margin: 8px 0 0;">Logg inn -> Engangskode -> tast koden</p>
              </div>
        `
    : "";

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: recipientEmail }] }],
      from: { email: "noreply@smartout.ai", name: "Smartout" },
      subject: `Logg inn pa ${workspaceName}`,
      content: [
        {
          type: "text/html",
          value: `
            <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
              <h2 style="color: #1a1a1a; margin-bottom: 8px;">Logg inn pa ${workspaceName}</h2>
              <p style="color: #666; font-size: 15px; line-height: 1.5;">
                Din leder har sendt deg en innloggingslenke. Trykk pa knappen under for a logge inn pa Smartout.
              </p>
              <a href="${magicLink}" style="display: inline-block; background: #f97316; color: white; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 600; font-size: 15px; margin: 24px 0;">
                Logg inn
              </a>${codeBlock}
              <p style="color: #999; font-size: 13px;">
                Denne lenken er gyldig i 1 time. Hvis du ikke ba om dette, kan du ignorere denne e-posten.
              </p>
            </div>
          `,
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`SendGrid error ${res.status}:`, text);
    throw new Error(`Failed to send email: ${res.status}`);
  }
}
