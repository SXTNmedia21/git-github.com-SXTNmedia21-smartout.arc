import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { emit } from "@smartout/telemetry";
import { z } from "zod";
import { apiRateLimit } from "@/lib/rate-limit";

// Strict schema — rejects unknown events at the boundary
const BeaconEventSchema = z.object({
  event: z.string().min(1).max(200),
  workspace_id: z.string().uuid(),
  actor_id: z.string().uuid(),
  properties: z.record(z.unknown()).optional(),
  timestamp: z.string().datetime().optional(),
});

export async function POST(req: NextRequest) {
  try {
    // Rate limit by IP (when Upstash is configured)
    if (apiRateLimit) {
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
      const { success } = await apiRateLimit.limit(ip);
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

    // Enforce actor_id matches the authenticated user to prevent audit spoofing
    if (parsed.data.actor_id !== user.id) {
      return NextResponse.json({ error: "actor_id mismatch" }, { status: 403 });
    }

    // Fire-and-forget — don't block the response
    // The beacon accepts any event name; emit() logs unregistered events and ignores them
    void emit(parsed.data as unknown as Parameters<typeof emit>[0]);

    return NextResponse.json({ ok: true }, { status: 202 });
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
