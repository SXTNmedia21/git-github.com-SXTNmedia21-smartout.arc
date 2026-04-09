/**
 * Notification Outbox API Route
 *
 * Server-side bridge for the telemetry "notifications" destination.
 * Receives { event_key, metadata } from emit.ts (client-side fetch),
 * resolves notification config, and inserts into notification_outbox.
 * The outbox consumer Edge Function handles fan-out to channels.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@smartout/supabase/server";
import { getEventConfig, insertOutboxNotification } from "@smartout/notifications";

const OutboxPayload = z.object({
  event_key: z.string(),
  metadata: z.record(z.unknown()).optional().default({}),
});

export async function POST(request: Request) {
  // 1. Auth check — require authenticated user
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse and validate payload (matches emit.ts shape: { event_key, metadata })
  const body: unknown = await request.json().catch(() => null);
  const parsed = OutboxPayload.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { event_key, metadata } = parsed.data;

  // 3. Event config lookup — convert space-separated event names to dot-notation
  // to match NOTIFICATION_EVENTS keys (e.g., "shift published" → "shift.published")
  const configKey = event_key.replace(/\s+/g, ".");
  const config = getEventConfig(configKey);
  if (!config) {
    return NextResponse.json({ ok: true, skipped: true }, { status: 202 });
  }

  // 4. Derive workspace_id and recipient_id from metadata
  // workspace_id comes from the telemetry event properties; recipient_id
  // defaults to the authenticated user when not explicitly set.
  const workspaceId = metadata.workspace_id as string | undefined;
  const recipientId = (metadata.recipient_id as string | undefined) ?? user.id;

  if (!workspaceId) {
    // Without a workspace, we can't insert into the outbox (workspace_id is required)
    return NextResponse.json({ ok: true, skipped: true }, { status: 202 });
  }

  // 5. Insert into notification_outbox via the shared helper
  const { error } = await insertOutboxNotification(supabase, {
    workspace_id: workspaceId,
    recipient_id: recipientId,
    event_key: configKey,
    metadata,
  });

  if (error) {
    console.error("[notification-outbox] Insert failed:", error.message);
    return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 202 });
}
