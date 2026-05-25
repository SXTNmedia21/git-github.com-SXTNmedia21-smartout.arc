"use server";

import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { resolveCurrentProfile } from "@/app/dashboard/_actions/_shared";
import type { NonEmptyString } from "@smartout/telemetry/server";
import { pinMessage } from "@smartout/ai/capabilities/communication/pin-message";

const PinInputSchema = z.object({
  messageId: z.string().uuid(),
  channelId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  pin: z.boolean(),
});

type PinResult = { ok: true; messageId: string; pinned: boolean } | { ok: false; reason: string };

/**
 * pinMessageAction — manager+ pin/unpin of channel_message rows.
 *
 * Thin-wraps the pin_message capability tool (packages/ai/src/capabilities/communication/
 * pin-message.ts) so the human-author path and the agent-author path share the same
 * gate + emit semantics. Previously the hook emitted telemetry client-side via
 * `void emit(...)` in onSuccess — a fire-and-forget race with page unload (BUG-3).
 *
 * The capability tool body now owns: gate precheck (ADR-0287), UPDATE, awaited emit
 * (ADR-0415 Path A). The Server Action owns: JWT auth, workspace isolation, input
 * parsing, ctx synthesis, result forwarding.
 *
 * ADR-0151 / L-0177: workspaceId is server-derived from JWT via resolveCurrentProfile.
 * Body-supplied workspaceId is only used as a cross-check, never as the authoritative ID.
 */
export async function pinMessageAction(input: unknown): Promise<PinResult> {
  const parsed = PinInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "Invalid input" };
  }
  const { messageId, channelId, workspaceId, pin } = parsed.data;

  // Server-derive profile from JWT (ADR-0151)
  const profile = await resolveCurrentProfile();
  if (!profile) {
    return { ok: false, reason: "Not authenticated" };
  }
  // L-0177: fail-fast on workspace mismatch — never silently accept body-supplied ID.
  if (profile.workspaceId !== workspaceId) {
    return { ok: false, reason: "Workspace mismatch" };
  }

  const supabaseAdmin = createAdminClient();
  const ctx = {
    workspaceId: profile.workspaceId as NonEmptyString,
    profileId: profile.profileId as NonEmptyString,
    sessionId: "server-action",
    channel: "chat" as const,
    supabaseAdmin,
  };

  let raw: string;
  try {
    raw = await pinMessage.execute(
      { channel_message_id: messageId, channel_id: channelId, pin },
      ctx,
    );
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Ukjent feil." };
  }

  // The tool returns JSON on success, a plain error string on failure.
  try {
    const result = JSON.parse(raw) as { ok?: boolean; pinned?: boolean };
    if (result.ok === true) {
      return { ok: true, messageId, pinned: pin };
    }
    return { ok: false, reason: raw };
  } catch {
    // Tool returned a plain error string (gate denied or row not found)
    return { ok: false, reason: raw };
  }
}
