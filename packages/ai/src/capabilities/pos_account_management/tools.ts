/**
 * packages/ai/src/capabilities/pos_account_management/tools.ts
 *
 * POS account management capability tools (ADR-0305, C1 sortie).
 *
 * Three tools:
 *   - connect_lightspeed  (admin+, chat-only per ADR-0288, mutateWithGate)
 *   - disconnect          (admin+, chat-only per ADR-0288, mutateWithGate)
 *   - list_accounts       (admin+, both channels, read-only, no gate)
 *
 * Voice guard (ADR-0288 + ADR-0078):
 *   connect_lightspeed and disconnect are admin operations that modify
 *   per-workspace credentials. Chat-only (admin interaction class). The
 *   guard pattern is copied verbatim from payroll/tools.ts:54-62.
 *
 * Gate (ADR-0287 + ADR-0099):
 *   Write tools use mutateWithGate — one call, one gate evaluation, one
 *   audit row. Capability name "pos_account_management"; action_type per tool.
 *
 * Telemetry (ADR-0134):
 *   pos.account.connected  → activity_trail + engine_event + posthog + logger
 *   pos.account.disconnected → same four destinations
 *   No domain event for list_accounts (read-only, L-0023).
 *
 * References:
 *   ADR-0305 — POS adapter pattern, admin connect/disconnect surface.
 *   ADR-0287 — mutateWithGate mandatory on capability mutations.
 *   ADR-0288 — chat-only for POS connect/disconnect admin operations.
 *   ADR-0078 — channel guard, defence-in-depth.
 *   ADR-0099 — unified authority gate.
 *   ADR-0134 — telemetry contract.
 *   ADR-0151 — workspace_id server-derived, never body-supplied.
 *   secrets-protocol — OAuth token flows to Vault via fn_pos_credentials_upsert.
 */

import { z } from "zod";
import { defineTool } from "../../types.js";
import type { AgentToolContext, SessionChannel } from "../types.js";
import { emit } from "@smartout/telemetry";
import {
  mutateWithGate,
  MutateWithGateDenied,
  MutateWithGateError,
} from "../_shared/mutate-with-gate.js";

// ─── Voice guard (ADR-0288) ────────────────────────────────────────────────

/**
 * Guard: POS connect/disconnect tools are chat-only (ADR-0288 + ADR-0078 admin ops).
 * Pattern copied verbatim from payroll/tools.ts:54-62.
 */
function assertChatChannel(
  channel: SessionChannel,
): { denied: false } | { denied: true; msg: string } {
  if (channel !== "chat") {
    return {
      denied: true,
      msg: "POS-kontoadministrasjon er kun tilgjengelig via chat. Bytt til chat-kanalen. (ADR-0288 admin-op)",
    };
  }
  return { denied: false };
}

// ─── Capability name constants ────────────────────────────────────────────

const CAPABILITY = "pos_account_management" as const;

// ─── connect_lightspeed ───────────────────────────────────────────────────

export const connectLightspeed = defineTool({
  name: "connect_lightspeed",
  description:
    "Connect a Lightspeed K-Series POS account for this workspace. Stores OAuth credentials in Vault (never plaintext). Admin only. Chat channel only. V1 mock: accepts any non-empty oauth_code. Real V2 (ADR-0310) will exchange code for access+refresh tokens via Lightspeed OAuth2.",
  capability: CAPABILITY,
  schema: z.object({
    external_account_id: z
      .string()
      .min(1)
      .describe("Lightspeed account ID (from the OAuth callback or admin portal)."),
    oauth_code: z
      .string()
      .min(1)
      .describe(
        "OAuth authorization code from Lightspeed. V1 mock: stored as-is in Vault. V2: exchanged for access+refresh tokens.",
      ),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    // ADR-0288 + ADR-0078: admin op, chat-only.
    const channelCheck = assertChatChannel(ctx.channel ?? "chat");
    if (channelCheck.denied) return channelCheck.msg;

    try {
      const { result } = await mutateWithGate(ctx.supabaseAdmin, {
        workspaceId: ctx.workspaceId,
        profileId: ctx.profileId,
        capability: CAPABILITY,
        actionType: "connect",
        channel: ctx.channel ?? "chat",
        exec: async (db) => {
          // Step 1: Upsert pos_account row (inactive → stays inactive until first sync).
          // If row exists (UNIQUE workspace+vendor), UPDATE external_account_id.
          const { data: existing } = await db
            .from("pos_account")
            .select("pos_account_id")
            .eq("workspace_id", ctx.workspaceId)
            .eq("vendor", "lightspeed_kseries")
            .maybeSingle();

          let accountId: string;

          if (existing?.pos_account_id) {
            accountId = existing.pos_account_id;
            const { error: updateErr } = await db
              .from("pos_account")
              .update({
                external_account_id: params.external_account_id,
                status: "active",
                updated_at: new Date().toISOString(),
              })
              .eq("pos_account_id", accountId);
            if (updateErr) throw new Error(`pos_account update failed: ${updateErr.message}`);
          } else {
            const { data: inserted, error: insertErr } = await db
              .from("pos_account")
              .insert({
                workspace_id: ctx.workspaceId,
                vendor: "lightspeed_kseries",
                external_account_id: params.external_account_id,
                status: "active",
              })
              .select("pos_account_id")
              .single();
            if (insertErr || !inserted)
              throw new Error(`pos_account insert failed: ${insertErr?.message ?? "no data"}`);
            accountId = inserted.pos_account_id;
          }

          // Step 2: Store OAuth code in Vault via SECURITY DEFINER RPC.
          // fn_pos_credentials_upsert validates service_role; we call from
          // supabaseAdmin (service role) so this passes.
          const { error: vaultErr } = await db.rpc("fn_pos_credentials_upsert", {
            p_workspace_id: ctx.workspaceId,
            p_vendor: "lightspeed_kseries",
            p_token: params.oauth_code, // V1 mock — V2 exchanges for access_token here
          });
          if (vaultErr) throw new Error(`fn_pos_credentials_upsert failed: ${vaultErr.message}`);

          return { account_id: accountId };
        },
      });

      // Telemetry: pos.account.connected (ADR-0134).
      await emit({
        event: "pos.account.connected",
        workspace_id: ctx.workspaceId,
        actor_id: ctx.profileId,
        properties: {
          entity: {
            entity_type: "pos_account",
            entity_id: result?.account_id ?? (ctx.workspaceId as string),
          },
          data: {
            pos_account_id: result?.account_id ?? "",
            vendor: "lightspeed_kseries",
            external_account_id: params.external_account_id,
          },
        },
      });

      return `Lightspeed-konto tilkoblet (konto-ID: ${result?.account_id ?? "ukjent"}). POS-synkronisering starter ved neste cron-kjøring.`;
    } catch (err) {
      if (err instanceof MutateWithGateDenied) {
        return `Ikke autorisert: ${err.message}`;
      }
      if (err instanceof MutateWithGateError) {
        return `Tilkoblingsfeil: ${err.message}`;
      }
      const msg = err instanceof Error ? err.message : String(err);
      return `Tilkoblingsfeil: ${msg}`;
    }
  },
});

// ─── disconnect ───────────────────────────────────────────────────────────

export const disconnect = defineTool({
  name: "disconnect_pos_account",
  description:
    "Disconnect (deactivate) the Lightspeed POS integration for this workspace. Sets status to 'inactive'. Does not delete historical sale events (append-only). Admin only. Chat channel only.",
  capability: CAPABILITY,
  schema: z.object({
    pos_account_id: z
      .string()
      .uuid()
      .describe("The pos_account_id to disconnect. Use list_pos_accounts to find it."),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    // ADR-0288 + ADR-0078: admin op, chat-only.
    const channelCheck = assertChatChannel(ctx.channel ?? "chat");
    if (channelCheck.denied) return channelCheck.msg;

    try {
      await mutateWithGate(ctx.supabaseAdmin, {
        workspaceId: ctx.workspaceId,
        profileId: ctx.profileId,
        capability: CAPABILITY,
        actionType: "disconnect",
        channel: ctx.channel ?? "chat",
        targetId: params.pos_account_id,
        exec: async (db) => {
          // Verify the account belongs to this workspace (Law 1 — workspace scope).
          const { data: account, error: selectErr } = await db
            .from("pos_account")
            .select("pos_account_id, vendor")
            .eq("pos_account_id", params.pos_account_id)
            .eq("workspace_id", ctx.workspaceId)
            .maybeSingle();

          if (selectErr) throw new Error(`pos_account lookup failed: ${selectErr.message}`);
          if (!account)
            throw new Error(
              `Konto ikke funnet for denne arbeidsplassen (ID: ${params.pos_account_id})`,
            );

          const { error: updateErr } = await db
            .from("pos_account")
            .update({
              status: "inactive",
              updated_at: new Date().toISOString(),
            })
            .eq("pos_account_id", params.pos_account_id)
            .eq("workspace_id", ctx.workspaceId);

          if (updateErr) throw new Error(`disconnect failed: ${updateErr.message}`);

          return { vendor: account.vendor };
        },
      });

      // Telemetry: pos.account.disconnected (ADR-0134).
      await emit({
        event: "pos.account.disconnected",
        workspace_id: ctx.workspaceId,
        actor_id: ctx.profileId,
        properties: {
          entity: {
            entity_type: "pos_account",
            entity_id: params.pos_account_id,
          },
          data: {
            pos_account_id: params.pos_account_id,
            vendor: "lightspeed_kseries",
            reason: "manual" as const,
          },
        },
      });

      return `POS-konto deaktivert (ID: ${params.pos_account_id}). Historiske salgsdata beholdes.`;
    } catch (err) {
      if (err instanceof MutateWithGateDenied) {
        return `Ikke autorisert: ${err.message}`;
      }
      if (err instanceof MutateWithGateError) {
        return `Frakoblingsfeil: ${err.message}`;
      }
      const msg = err instanceof Error ? err.message : String(err);
      return `Frakoblingsfeil: ${msg}`;
    }
  },
});

// ─── list_accounts ────────────────────────────────────────────────────────

export const listPosAccounts = defineTool({
  name: "list_pos_accounts",
  description:
    "List all POS accounts for this workspace (Lightspeed integrations). Shows vendor, status, last sync time. Admin only. Both channels (voice-safe: no PII, no mutations).",
  capability: CAPABILITY,
  schema: z.object({}),
  execute: async (_params, ctx: AgentToolContext) => {
    const { data, error } = await ctx.supabaseAdmin
      .from("pos_account")
      .select("pos_account_id, vendor, external_account_id, status, last_synced_at, created_at")
      .eq("workspace_id", ctx.workspaceId)
      .order("created_at", { ascending: false });

    if (error) return `Feil ved henting av POS-kontoer: ${error.message}`;
    if (!data || data.length === 0)
      return "Ingen POS-kontoer tilkoblet ennå. Bruk connect_lightspeed for å koble til Lightspeed K-Series.";

    const summary = data.map((a) => {
      const lastSync = a.last_synced_at
        ? new Date(a.last_synced_at).toLocaleString("nb-NO", { timeZone: "Europe/Oslo" })
        : "aldri synkronisert";
      return `- ${a.vendor} | Status: ${a.status} | Sist synkronisert: ${lastSync} | ID: ${a.pos_account_id}`;
    });

    return `POS-kontoer (${data.length}):\n${summary.join("\n")}`;
  },
});
