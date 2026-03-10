import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId, logPlatformAction } from "@/lib/platform-admin";

const CreateSchema = z.object({
  workspaceId: z.string().uuid(),
  content: z.string().min(1).max(5000),
});

const UpdateSchema = z.object({
  noteId: z.string().uuid(),
  content: z.string().min(1).max(5000),
});

const DeleteSchema = z.object({
  noteId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { workspaceId, content } = parsed.data;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("workspace_note")
    .insert({ workspace_id: workspaceId, admin_id: adminId, content })
    .select("note_id, content, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logPlatformAction(adminId, "note_created", "workspace_note", workspaceId, {
    note_id: data.note_id,
  });

  return NextResponse.json({ ok: true, note: data });
}

export async function PATCH(request: NextRequest) {
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { noteId, content } = parsed.data;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("workspace_note")
    .update({ content })
    .eq("note_id", noteId)
    .select("note_id, content, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logPlatformAction(adminId, "note_updated", "workspace_note", noteId);

  return NextResponse.json({ ok: true, note: data });
}

export async function DELETE(request: NextRequest) {
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = DeleteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { noteId } = parsed.data;
  const admin = createAdminClient();

  const { error } = await admin.from("workspace_note").delete().eq("note_id", noteId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logPlatformAction(adminId, "note_deleted", "workspace_note", noteId);

  return NextResponse.json({ ok: true });
}
