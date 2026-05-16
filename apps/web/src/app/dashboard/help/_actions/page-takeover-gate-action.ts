"use server";

import { z } from "zod";
import { gateAction, resolveCurrentProfile } from "@/app/dashboard/_actions/_shared";
import {
  TAKEOVER_TARGETS,
  isValidTakeoverTarget,
} from "@/app/dashboard/help/_lib/takeover-targets";

const inputSchema = z.object({
  target_id: z.string().min(1),
  channel: z.enum(["chat", "voice", "system"]).default("chat"),
});

export type PageTakeoverGateInput = z.infer<typeof inputSchema>;

export type PageTakeoverGateResult =
  | {
      ok: true;
      target_id: string;
      capability: string;
      label: string;
      selector: string;
    }
  | {
      ok: false;
      reason: string;
      user_message?: string;
    };

/**
 * Server-side gate for page-takeover invocation. Per ADR-0228:
 * - Channel must be 'chat' (voice forbidden for mutation tools).
 * - target_id must be in the static allow-list.
 * - gateAction must allow the resolved capability for this workspace + actor.
 *
 * Returns spec needed by client (selector + label) only when allowed. Default
 * level='disabled' in the seed ensures fresh workspaces deny by default.
 */
export async function pageTakeoverGateAction(
  input: PageTakeoverGateInput,
): Promise<PageTakeoverGateResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: `validation_failed: ${parsed.error.message}`,
    };
  }

  // ADR-0078 extension: voice forbidden for takeover.
  if (parsed.data.channel !== "chat") {
    return {
      ok: false,
      reason: "voice_forbidden_for_takeover",
      user_message: "Bytt til chat for å gjøre dette.",
    };
  }

  if (!isValidTakeoverTarget(parsed.data.target_id)) {
    return {
      ok: false,
      reason: "unknown_target",
      user_message: "Den knappen er ikke i mitt godkjente sett.",
    };
  }

  const spec = TAKEOVER_TARGETS[parsed.data.target_id];

  const profile = await resolveCurrentProfile();
  if (!profile) {
    return { ok: false, reason: "not_authenticated" };
  }

  // @authority-gate-ungated — forwarder: capability comes from spec (caller-supplied static literal).
  // Each takeover capability is seeded independently in migrations.
  const gate = await gateAction({
    workspaceId: profile.workspaceId,
    capability: spec.capability,
    channel: "chat",
    actorProfileId: profile.profileId,
    actionType: "execute",
  });

  if (!gate.allow) {
    return {
      ok: false,
      reason: `authority_denied: ${gate.reason ?? "disabled"}`,
      user_message:
        "Jeg har ikke tillatelse til å gjøre det her — be admin aktivere page-takeover først.",
    };
  }

  return {
    ok: true,
    target_id: spec.target_id,
    capability: spec.capability,
    label: spec.label,
    selector: spec.selector,
  };
}
