import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { countAudience, resolveAudience, type AudienceFilter } from "@smartout/notifications";

const AudienceFilterSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("all_users") }),
  z.object({ type: z.literal("super_admins") }),
  z.object({ type: z.literal("workspace"), workspaceId: z.string().uuid() }),
  z.object({ type: z.literal("role"), role: z.string() }),
  z.object({ type: z.literal("status"), status: z.string() }),
  z.object({ type: z.literal("user_ids"), userIds: z.array(z.string().uuid()) }),
]);

const DryRunSchema = z.object({
  audience: AudienceFilterSchema,
});

export async function POST(request: NextRequest) {
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = DryRunSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { audience } = parsed.data;
  const admin = createAdminClient();

  try {
    const [recipientCount, allRecipients] = await Promise.all([
      countAudience(admin, audience as AudienceFilter),
      resolveAudience(admin, audience as AudienceFilter),
    ]);

    const sampleRecipients = allRecipients
      .slice(0, 10)
      .map((r: { name: string; email: string }) => ({
        name: r.name,
        email: r.email,
      }));

    return NextResponse.json({ recipientCount, sampleRecipients });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to resolve audience" },
      { status: 400 },
    );
  }
}
