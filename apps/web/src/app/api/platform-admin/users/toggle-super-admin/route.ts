import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId, logPlatformAction } from "@/lib/platform-admin";

const ToggleSchema = z.object({
  userId: z.string().uuid(),
  isGodmode: z.boolean(),
});

export async function POST(request: NextRequest) {
  const adminId = await getSuperAdminId();
  if (!adminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: z.infer<typeof ToggleSchema>;
  try {
    const raw = await request.json();
    const parsed = ToggleSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    body = parsed.data;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Prevent self-demotion
  if (body.userId === adminId && !body.isGodmode) {
    return NextResponse.json({ error: "Cannot revoke your own godmode access" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("user_identity")
    .update({ is_godmode: body.isGodmode })
    .eq("user_id", body.userId);

  if (error) {
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }

  await logPlatformAction(
    adminId,
    body.isGodmode ? "grant_godmode" : "revoke_godmode",
    "user",
    body.userId,
    { isGodmode: body.isGodmode },
  );

  return NextResponse.json({ success: true });
}
