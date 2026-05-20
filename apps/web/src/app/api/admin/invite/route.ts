/**
 * Same-origin BFF for invitation creation.
 *
 * Replaces direct browser `supabase.functions.invoke("create-invitation")`
 * calls per ADR-0179 (browser → route handler, not Edge Function from
 * the client). The deleted Edge Function lives on as the shared
 * `createInvitation()` library at `apps/web/src/lib/invitations.ts`.
 *
 * Auth gate is `withWorkspaceAdmin` — SECURITY DEFINER
 * `is_admin_in_workspace` RPC against the JWT-scoped client. Inside the
 * gate we resolve the inviter's `profile_id` (not user_id — invitation
 * provenance is workspace-scoped) and call `createInvitation()` for
 * single or batch payloads.
 *
 * Trust Gate condition #5: `runtime = "nodejs"` + `maxDuration = 60`
 * are mandatory — Vercel's default 10s would truncate batch invites
 * with 50+ rows that fan out to email/SMS dispatch.
 *
 * Per ADR-0179 + ADR-0180.
 */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withWorkspaceAdmin } from "@/lib/billing/withAdmin";
import {
  createInvitation,
  InviteRoleSchema,
  SingleInviteSchema,
  type InvitationResult,
  type SingleInviteInput,
} from "@/lib/invitations";

// Trust Gate condition #5 — these MUST be present.
export const runtime = "nodejs";
export const maxDuration = 60;

// Batch payload — shared lib does not expose a BatchInviteSchema, so the
// route validates here and loops `createInvitation` per row. Keeps the lib
// API single-purpose and lets the route own multi-row orchestration.
const BatchInviteRowSchema = z.object({
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

const BatchPayloadSchema = z.object({
  workspace_id: z.string().uuid(),
  // company_id is accepted for back-compat with the old Edge Function
  // payload but ignored — the lib resolves it from workspace_id.
  company_id: z.string().uuid().optional(),
  invites: z.array(BatchInviteRowSchema).min(1),
  skip_dispatch: z.boolean().default(false),
});

type BatchInviteRow = z.infer<typeof BatchInviteRowSchema>;

function pickChannelsForBatchRow(row: BatchInviteRow, skipDispatch: boolean) {
  if (skipDispatch) return ["link"] as const;
  if (row.email) return ["email"] as const;
  if (row.phone) return ["sms"] as const;
  return ["link"] as const;
}

// Bump the draft contract for this workspace so the freshly invited owner
// receives the contract instead of whoever was named at workspace-create
// time. Best-effort: never fails the invite if the contract update fails —
// the workspace might not have a draft, or it might already be signed.
// Caller filters on role === "owner" + non-empty email.
async function bumpDraftContractRecipient(
  client: import("@supabase/supabase-js").SupabaseClient,
  workspaceId: string,
  firstName: string,
  lastName: string,
  email: string,
) {
  try {
    const { data: contracts, error } = await client
      .from("contract")
      .select("contract_id")
      .eq("workspace_id", workspaceId)
      .eq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(1);

    if (error || !contracts || contracts.length === 0) return;
    const firstContract = contracts[0];
    if (!firstContract) return;

    const contractId = firstContract.contract_id as string;
    const { error: updateErr } = await client
      .from("contract")
      .update({
        recipient_name: `${firstName} ${lastName}`.trim(),
        recipient_email: email,
      })
      .eq("contract_id", contractId);

    if (updateErr) {
      console.warn("[api/admin/invite] bumpDraftContractRecipient failed:", updateErr.message);
    }
  } catch (err) {
    console.warn("[api/admin/invite] bumpDraftContractRecipient exception:", err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const isBatch = Array.isArray((body as { invites?: unknown }).invites);

    // Validate up-front so we get the workspace_id either way.
    const parsed = isBatch
      ? BatchPayloadSchema.safeParse(body)
      : SingleInviteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const workspaceId = parsed.data.workspace_id;

    const result = await withWorkspaceAdmin<InvitationResult | { invitations: InvitationResult[] }>(
      workspaceId,
      async (userId, client) => {
        // Resolve inviter profile_id from the authenticated user — invitation
        // provenance is workspace-scoped (`invited_by` is a profile FK, not
        // a user FK).
        const { data: profile, error: profileError } = await client
          .from("profile")
          .select("profile_id")
          .eq("workspace_id", workspaceId)
          .eq("user_id", userId)
          .maybeSingle();

        if (profileError || !profile) {
          return {
            ok: false as const,
            error: "Inviter profile not found in workspace",
            code: "not_workspace_admin",
          };
        }

        // Owner-role gate: only one pending owner-invite per workspace.
        // Counts requested owner-rows (single = 0 or 1, batch = 0..N).
        const ownerRowCount = isBatch
          ? (parsed.data as z.infer<typeof BatchPayloadSchema>).invites.filter(
              (r) => r.role === "owner",
            ).length
          : (parsed.data as SingleInviteInput).role === "owner"
            ? 1
            : 0;

        if (ownerRowCount > 1) {
          return {
            ok: false as const,
            error: "Cannot send more than one owner-invite at a time",
            code: "owner_invite_pending",
          };
        }

        if (ownerRowCount === 1) {
          const { data: existingOwner } = await client
            .from("invitation")
            .select("invitation_id")
            .eq("workspace_id", workspaceId)
            .eq("role", "owner")
            .eq("status", "pending")
            .limit(1)
            .maybeSingle();

          if (existingOwner) {
            return {
              ok: false as const,
              error: "Pending owner-invite already exists for this workspace",
              code: "owner_invite_pending",
            };
          }
        }

        if (isBatch) {
          const batchData = parsed.data as z.infer<typeof BatchPayloadSchema>;
          const invitations: InvitationResult[] = [];
          for (const row of batchData.invites) {
            const channels = pickChannelsForBatchRow(row, batchData.skip_dispatch);
            const singleInput: SingleInviteInput = {
              workspace_id: workspaceId,
              channels: [...channels],
              email: row.email,
              phone: row.phone,
              role: row.role,
              first_name: row.first_name,
              last_name: row.last_name,
              department_ids: row.department_ids,
              team_ids: row.team_ids,
              invite_employment_type: row.invite_employment_type,
              metadata: row.metadata,
            };
            const r = await createInvitation(singleInput, profile.profile_id, client);
            invitations.push(r);
            if (row.role === "owner" && row.email) {
              await bumpDraftContractRecipient(
                client,
                workspaceId,
                row.first_name,
                row.last_name,
                row.email,
              );
            }
          }
          return { ok: true as const, data: { invitations } };
        }

        const single = parsed.data as SingleInviteInput;
        const r = await createInvitation(single, profile.profile_id, client);
        if (single.role === "owner" && single.email) {
          await bumpDraftContractRecipient(
            client,
            workspaceId,
            single.first_name,
            single.last_name,
            single.email,
          );
        }
        return { ok: true as const, data: r };
      },
    );

    if (!result.ok) {
      const status =
        result.code === "not_workspace_admin" || result.code === "unauthorized" ? 403 : 500;
      return NextResponse.json({ error: result.error, code: result.code }, { status });
    }

    return NextResponse.json(result.data);
  } catch (err) {
    console.error("[api/admin/invite] Exception:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
