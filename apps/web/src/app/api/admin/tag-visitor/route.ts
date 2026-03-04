// ============================================
// api/admin/tag-visitor/route.ts
// POST endpoint: sets manual_label + manual_notes on a landing_visitor.
// Used by the visitor tag dialog in the session detail sheet.
//
// Connected to: platform-admin/landing/_components/visitor-tag-dialog.tsx (consumer)
//               supabase landing_visitor table (data target)
// ============================================

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";

// TODO: Remove UntypedClient cast after regenerating database.types.ts
// (landing_visitor table is not yet in the generated types)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedClient = ReturnType<typeof createAdminClient> & { from: (table: string) => any };

const TagVisitorSchema = z.object({
  visitor_id: z.string().uuid(),
  label: z.string().min(1).max(200),
  notes: z.string().max(2000).optional(),
});

export async function POST(request: NextRequest) {
  const adminId = await getSuperAdminId();
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof TagVisitorSchema>;
  try {
    const raw = await request.json();
    const parsed = TagVisitorSchema.safeParse(raw);
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

  // TODO: Remove cast after regenerating database.types.ts
  const admin = createAdminClient() as unknown as UntypedClient;
  const { error } = await admin
    .from("landing_visitor")
    .update({
      manual_label: body.label,
      manual_notes: body.notes ?? null,
      tagged_by: adminId,
      tagged_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", body.visitor_id);

  if (error) {
    return NextResponse.json({ error: "Failed to tag visitor" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
