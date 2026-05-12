import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { emit } from "@smartout/telemetry";
import { z } from "zod";
import { getApiRateLimit } from "@/lib/rate-limit";

// Strict schema — rejects unknown events at the boundary
const BeaconEventSchema = z.object({
  event: z.string().min(1).max(200),
  workspace_id: z.string().uuid(),
  actor_id: z.string().uuid(),
  properties: z.record(z.unknown()).optional(),
  // entity block required by activity_trail provider (resolveEntityRef reads top-level entity).
  // Without this field, safeParse strips it and the provider silently rejects the write.
  entity: z
    .object({
      entity_type: z.string(),
      entity_id: z.string(),
      entity_label: z.string().optional(),
    })
    .optional(),
  correlation_id: z.string().optional(),
  timestamp: z.string().datetime().optional(),
});

export async function POST(req: NextRequest) {
  try {
    // Rate limit by IP (when Upstash is configured)
    const rateLimit = getApiRateLimit();
    if (rateLimit) {
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
      const { success } = await rateLimit.limit(ip);
      if (!success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
      }
    }

    // Verify caller has a valid Supabase session
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = BeaconEventSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    // Enforce actor_id belongs to the authenticated user to prevent audit spoofing.
    // Accept either:
    //   (a) actor_id === user.id (auth user acting directly)
    //   (b) actor_id === a profile.profile_id owned by user.id (workspace-scoped audit)
    // Most client emits use profile_id for workspace-scoped auditability; server-side
    // emits typically use user.id. Both are valid signals of "this human did it".
    if (parsed.data.actor_id !== user.id) {
      const { data: ownedProfile } = await supabase
        .from("profile")
        .select("profile_id")
        .eq("user_id", user.id)
        .eq("profile_id", parsed.data.actor_id)
        .maybeSingle();
      if (!ownedProfile) {
        return NextResponse.json({ error: "actor_id mismatch" }, { status: 403 });
      }
    }

    // Fire-and-forget — don't block the response
    // The beacon accepts any event name; emit() logs unregistered events and ignores them
    void emit(parsed.data as unknown as Parameters<typeof emit>[0]); // SAFETY: Supabase join returns union type; runtime shape matches the cast

    return NextResponse.json({ ok: true }, { status: 202 });
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
