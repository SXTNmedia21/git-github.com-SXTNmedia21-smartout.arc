// apps/web/src/app/api/botsson/imports/upload/route.ts
// BFF upload endpoint for bulk_import capability.
// Accepts multipart/form-data with `file` + `workspace_id` fields.
// Validates MIME type, size cap, workspace membership — then delegates to helper.
// Returns signed URL (1h TTL) for stage-engine attachment forwarding.
// Spec: docs/superpowers/specs/2026-05-23-bulk-import-design.md (Sortie 0)
// Council: 2026-05-23 APPROVE WITH CHANGES
import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { uploadAttachment } from "@/lib/storage/botsson-imports";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FormSchema = z.object({
  workspace_id: z.string().uuid(),
});

export async function POST(req: Request) {
  const supabase = await createClient();

  // 1. Authenticate
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 2. Parse multipart
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_multipart" }, { status: 400 });
  }

  const file = formData.get("file");
  const workspaceId = formData.get("workspace_id");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 });
  }

  const parsed = FormSchema.safeParse({ workspace_id: workspaceId });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_workspace_id" }, { status: 400 });
  }

  // 3. Verify user is member of workspace — fail-fast before RLS
  // profile.user_id maps to auth.uid(); profile.workspace_id is the scope
  const { data: membership } = await supabase
    .from("profile")
    .select("profile_id, workspace_id")
    .eq("workspace_id", parsed.data.workspace_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "not_workspace_member" }, { status: 403 });
  }

  // 4. Upload via helper — MIME + size validation inside
  try {
    const result = await uploadAttachment({
      supabase,
      workspaceId: parsed.data.workspace_id,
      file,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "upload_failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
