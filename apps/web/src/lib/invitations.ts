/**
 * Shared invitation creation logic.
 *
 * Single chokepoint for invite creation. Used by:
 * - apps/web/src/app/api/admin/invite/route.ts (browser BFF — same-origin per ADR-0179)
 * - apps/web/src/app/dashboard/people/_actions/people-actions.ts resendInvitation Server Action
 * - Future agent capabilities
 *
 * Replaces deleted supabase/functions/create-invitation/ Edge Function (Wave H).
 *
 * Per ADR-0179 (browser → route handler) + ADR-0045 clarification
 * (single dispatch surface — @smartout/notifications). Per ADR-0167,
 * invitation tokens are credentials and are censored to first 8 chars
 * before they ever reach a telemetry payload.
 *
 * Authority check (inviter must be admin/owner) is the caller's
 * responsibility — the route handler uses withWorkspaceAdmin and the
 * Server Action runs in the dashboard with workspace membership already
 * resolved. This lib trusts the supplied invitedByProfileId.
 */

import { createAdminClient } from "@smartout/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@smartout/supabase/database.types";
import { sendEmailBatch, sendSms } from "@smartout/notifications";
import { emit, nonEmpty } from "@smartout/telemetry";
import { z } from "zod";

// ── Types ─────────────────────────────────────────────────

export const InviteChannelSchema = z.enum(["email", "sms", "link"]);
export type InviteChannel = z.infer<typeof InviteChannelSchema>;

/**
 * Roles allowed when creating an invitation.
 * Matches the public.profile_role enum minus "system" (system roles are
 * never invited — they are seeded).
 */
export const InviteRoleSchema = z.enum(["admin", "manager", "employee", "owner"]);
export type InviteRole = z.infer<typeof InviteRoleSchema>;

export const SingleInviteSchema = z.object({
  workspace_id: z.string().uuid(),
  channels: z.array(InviteChannelSchema).min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  role: InviteRoleSchema,
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  department_ids: z.array(z.string().uuid()).optional(),
  team_ids: z.array(z.string().uuid()).optional(),
  invite_employment_type: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type SingleInviteInput = z.infer<typeof SingleInviteSchema>;

export type DispatchOutcome = {
  channel: "email" | "sms" | "link_only";
  outcome: "sent" | "failed";
  reason?: string;
};

export type InvitationResult = {
  invitation_id: string;
  token: string;
  invite_url: string;
  outcomes: DispatchOutcome[];
};

type AdminClient = SupabaseClient<Database>;

// ── Helpers ───────────────────────────────────────────────

/**
 * Censor an invitation token for telemetry payloads per ADR-0167.
 * Tokens are credentials; never log the full value.
 */
export function censorToken(token: string): string {
  return token.substring(0, 8) + "...";
}

function getInviteUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.smartout.ai";
  return `${base}/invite/${token}`;
}

function getEntityLabel(input: {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
}): string {
  const name = [input.first_name, input.last_name].filter(Boolean).join(" ");
  return name || input.email || input.phone || "invitation";
}

function renderInvitationEmail(opts: {
  inviteUrl: string;
  workspaceName: string;
  firstName: string;
}): { subject: string; html: string } {
  const subject = `You've been invited to join ${opts.workspaceName} on Smartout`;
  const html = `
<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
  <h2 style="color: #111;">Hi ${opts.firstName}!</h2>
  <p style="color: #555; line-height: 1.6;">
    You've been invited to join <strong>${opts.workspaceName}</strong> on Smartout.
    Click the button below to get started.
  </p>
  <a href="${opts.inviteUrl}" style="display: inline-block; background: #06b6d4; color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 16px;">
    Accept Invitation
  </a>
  <p style="color: #999; font-size: 12px; margin-top: 24px;">
    This invitation expires in 7 days. If you didn't expect this, you can safely ignore it.
  </p>
</div>
  `.trim();
  return { subject, html };
}

// ── Main entry ────────────────────────────────────────────

/**
 * Create a single invitation, dispatch on the requested channels, and
 * emit `invitation created` + `invitation dispatched` telemetry.
 *
 * The caller MUST have already authorized the inviter as admin/owner of
 * the workspace. This function does not re-check authority — it trusts
 * `invitedByProfileId`. Callers are:
 *   - route handler with `withWorkspaceAdmin`
 *   - Server Action that already ran the dashboard membership check
 *
 * @param input - validated invite payload
 * @param invitedByProfileId - profile_id of the admin/owner inviter
 * @param client - optional admin client (mostly for tests); defaults to a
 *                 fresh `createAdminClient()`
 */
export async function createInvitation(
  input: SingleInviteInput,
  invitedByProfileId: string,
  client?: AdminClient,
): Promise<InvitationResult> {
  const admin = client ?? (createAdminClient() as AdminClient);

  // 1. Resolve workspace company_id + name (used by INSERT + email body)
  const { data: workspace, error: wsError } = await admin
    .from("workspace")
    .select("workspace_id, company_id, name")
    .eq("workspace_id", input.workspace_id)
    .single();
  if (wsError || !workspace) {
    throw new Error(`Workspace not found: ${input.workspace_id}`);
  }
  if (!workspace.company_id) {
    throw new Error(`Workspace has no company_id: ${input.workspace_id}`);
  }

  // 2. INSERT invitation row.
  // invite_type is always "link" — actual channels live in metadata.channels.
  // metadata column is JSONB — coerce to Json so Supabase types accept it.
  const baseMetadata = {
    ...(input.metadata ?? {}),
    channels: input.channels,
  } as unknown as Json;

  const { data: invitation, error: insertError } = await admin
    .from("invitation")
    .insert({
      workspace_id: input.workspace_id,
      company_id: workspace.company_id,
      invite_type: "link",
      email: input.email ?? null,
      phone: input.phone ?? null,
      role: input.role,
      first_name: input.first_name,
      last_name: input.last_name,
      department_ids: input.department_ids ?? [],
      team_ids: input.team_ids ?? [],
      invite_employment_type: input.invite_employment_type ?? null,
      metadata: baseMetadata,
      status: "pending",
      invited_by: invitedByProfileId,
    })
    .select("invitation_id, token")
    .single();

  if (insertError || !invitation) {
    throw new Error(`Failed to create invitation: ${insertError?.message ?? "no row returned"}`);
  }

  const entityLabel = getEntityLabel({
    first_name: input.first_name,
    last_name: input.last_name,
    email: input.email,
    phone: input.phone,
  });

  // 3. Emit "invitation created" — failures are logged but never block.
  await emit({
    event: "invitation created",
    workspace_id: nonEmpty(input.workspace_id, "workspace_id"),
    actor_id: nonEmpty(invitedByProfileId, "actor_id"),
    properties: {
      entity: {
        entity_type: "invitation",
        entity_id: invitation.invitation_id,
        entity_label: entityLabel,
      },
      data: {
        invitation_id: invitation.invitation_id,
        workspace_id: input.workspace_id,
        role: input.role,
        token_preview: censorToken(invitation.token),
        employment_type: input.invite_employment_type,
      },
    },
  }).catch((err: unknown) => {
    console.error("Failed to emit invitation created:", err);
  });

  // 4. Dispatch per channel.
  const inviteUrl = getInviteUrl(invitation.token);
  const outcomes: DispatchOutcome[] = [];

  if (input.channels.includes("email") && input.email) {
    const { subject, html } = renderInvitationEmail({
      inviteUrl,
      workspaceName: workspace.name,
      firstName: input.first_name,
    });
    try {
      const result = await sendEmailBatch([{ email: input.email, subject, html }]);
      if (result.sent > 0) {
        outcomes.push({ channel: "email", outcome: "sent" });
      } else {
        const reason = result.errors[0]?.error ?? "send_failed";
        outcomes.push({ channel: "email", outcome: "failed", reason });
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : "unknown_error";
      outcomes.push({ channel: "email", outcome: "failed", reason });
    }
  }

  if (input.channels.includes("sms") && input.phone) {
    try {
      const body = `You've been invited to join ${workspace.name} on Smartout. Accept here: ${inviteUrl}`;
      const result = await sendSms(input.phone, body);
      if (result.sent > 0) {
        outcomes.push({ channel: "sms", outcome: "sent" });
      } else {
        const reason = result.errors[0]?.error ?? "send_failed";
        outcomes.push({ channel: "sms", outcome: "failed", reason });
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : "unknown_error";
      outcomes.push({ channel: "sms", outcome: "failed", reason });
    }
  }

  // link channel: token always returned to client — emit as "sent" (link_only)
  if (input.channels.includes("link")) {
    outcomes.push({ channel: "link_only", outcome: "sent" });
  }

  // 5. Emit "invitation dispatched" per outcome.
  for (const outcome of outcomes) {
    await emit({
      event: "invitation dispatched",
      workspace_id: nonEmpty(input.workspace_id, "workspace_id"),
      actor_id: nonEmpty(invitedByProfileId, "actor_id"),
      properties: {
        entity: {
          entity_type: "invitation",
          entity_id: invitation.invitation_id,
          entity_label: entityLabel,
        },
        data: {
          invitation_id: invitation.invitation_id,
          channel: outcome.channel,
          outcome: outcome.outcome,
          reason: outcome.reason,
          token_preview: censorToken(invitation.token),
        },
      },
    }).catch((err: unknown) => {
      console.error("Failed to emit invitation dispatched:", err);
    });
  }

  return {
    invitation_id: invitation.invitation_id,
    token: invitation.token,
    invite_url: inviteUrl,
    outcomes,
  };
}
