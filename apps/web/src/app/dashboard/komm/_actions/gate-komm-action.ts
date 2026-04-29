"use server";

/**
 * gate-komm-action.ts — Authority gate for Botsson komm action tools.
 *
 * The 3 komm action tools (sendMessage, createChat, joinCall) live in the
 * browser as ClientToolImplementations and delegate to existing TanStack
 * mutation hooks. Those hooks rely on RLS for tenant scoping, but RLS is
 * not an authority gate — it cannot enforce role floors, channel allowlists
 * (ADR-0078), or four-eyes per ADR-0099.
 *
 * This Server Action is the authority gate the bridge calls BEFORE invoking
 * the mutation hook. It re-derives the actor's profile + workspace
 * server-side per ADR-0151 (never trust IDs from request body), then
 * delegates to the canonical `gateAction` RPC wrapper in `_actions/_shared.ts`.
 *
 * Capability slugs are namespaced `komm.*`. Default-allow applies until
 * `engine_authority_config` rows are seeded — the wiring stands ready;
 * authority floors are a follow-up sortie.
 */

import { gateAction, resolveCurrentProfile, type GateResult } from "../../_actions/_shared";

export type KommCapability = "komm.send_message" | "komm.create_channel" | "komm.join_call";

export type KommGateOutcome =
  | { allow: true; downgradeTo: string | null; channelAllowed: boolean }
  | { allow: false; reason: string; requiresApproval?: boolean; approversNeeded?: number };

export async function gateKommAction(args: {
  capability: KommCapability;
  channel: "chat" | "voice" | "system";
  entityId?: string;
  /**
   * Approvers already collected for this action, by profile_id. Used for
   * four-eyes (SOD) gating. The gate denies when:
   *   - the actor appears in approvers (self-approval is forbidden), OR
   *   - the count is below the gate's required threshold.
   * Empty array = no approvers yet → denied with `requiresApproval=true` so
   * the caller can route to an approval-collection UI.
   */
  approvers?: string[];
}): Promise<KommGateOutcome> {
  const profile = await resolveCurrentProfile();
  if (!profile) {
    return { allow: false, reason: "Ikke autentisert" };
  }

  const result: GateResult = await gateAction({
    workspaceId: profile.workspaceId,
    capability: args.capability,
    channel: args.channel,
    actorProfileId: profile.profileId,
    actionType: "execute",
    entityId: args.entityId,
  });

  if (!result.allow) {
    return { allow: false, reason: result.reason ?? "Ikke autorisert" };
  }
  if (!result.channel_allowed) {
    return {
      allow: false,
      reason:
        args.channel === "voice"
          ? "Denne handlingen er ikke tillatt over voice (ADR-0078). Bytt til chat."
          : "Kanalen er ikke tillatt for denne handlingen.",
    };
  }
  if (result.four_eyes_required) {
    const approvers = args.approvers ?? [];
    const needed = result.approvers_needed > 0 ? result.approvers_needed : 1;

    if (approvers.includes(profile.profileId)) {
      return {
        allow: false,
        reason: "Du kan ikke godkjenne din egen handling (Separation of Duties).",
        requiresApproval: true,
        approversNeeded: needed,
      };
    }
    const distinctApprovers = approvers.filter((id) => id !== profile.profileId);
    if (distinctApprovers.length < needed) {
      return {
        allow: false,
        reason: `Krever ${needed} godkjenner${needed === 1 ? "" : "e"} (har ${distinctApprovers.length}).`,
        requiresApproval: true,
        approversNeeded: needed,
      };
    }
  }
  return {
    allow: true,
    downgradeTo: result.downgrade_to,
    channelAllowed: result.channel_allowed,
  };
}
