"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@smartout/supabase/server";
import { gateAction, resolveCurrentProfile } from "@/app/dashboard/_actions/_shared";

const handbookChapterSchema = z.object({
  chapter_id: z.string().uuid().nullable().optional(),
  chapter_key: z.string().min(1).max(100),
  title: z.string().min(1).max(300),
  content: z.unknown(),
});

export type UpsertHandbookChapterInput = z.infer<typeof handbookChapterSchema>;

export type UpsertHandbookChapterResult =
  | { ok: true; handbook_chapter_id: string }
  | { ok: false; error: string };

export async function upsertHandbookChapterAction(
  input: UpsertHandbookChapterInput,
): Promise<UpsertHandbookChapterResult> {
  const parsed = handbookChapterSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: `Validation failed: ${parsed.error.message}` };
  }

  const profile = await resolveCurrentProfile();
  if (!profile) {
    return { ok: false, error: "Not authenticated" };
  }
  const { profileId, workspaceId } = profile;

  const isUpdate = Boolean(parsed.data.chapter_id);

  const gate = await gateAction({
    workspaceId,
    capability: "handbook_chapter",
    channel: "system",
    actorProfileId: profileId,
    actionType: isUpdate ? "update" : "create",
    entityId: parsed.data.chapter_id ?? undefined,
  });
  if (!gate.allow) {
    return {
      ok: false,
      error: `gate_action denied: ${gate.reason ?? "unknown"}`,
    };
  }

  const supabase = await createClient();
  const now = new Date().toISOString();

  if (isUpdate && parsed.data.chapter_id) {
    const { error: updateErr } = await supabase
      .from("handbook_chapter")
      .update({
        chapter_key: parsed.data.chapter_key,
        title: parsed.data.title,
        content: parsed.data.content as never,
        updated_at: now,
        updated_by: profileId,
      })
      .eq("handbook_chapter_id", parsed.data.chapter_id);

    if (updateErr) {
      return { ok: false, error: `Update failed: ${updateErr.message}` };
    }

    // TODO T7: emit governance.content_updated (trigger=update) once event registered.

    revalidatePath("/dashboard/governance");
    return { ok: true, handbook_chapter_id: parsed.data.chapter_id };
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("handbook_chapter")
    .insert({
      workspace_id: workspaceId,
      chapter_key: parsed.data.chapter_key,
      title: parsed.data.title,
      content: parsed.data.content as never,
      updated_by: profileId,
    })
    .select("handbook_chapter_id")
    .single();

  if (insertErr || !inserted) {
    return {
      ok: false,
      error: `Insert failed: ${insertErr?.message ?? "no row returned"}`,
    };
  }

  // TODO T7: emit governance.content_updated (trigger=create) once event registered.

  revalidatePath("/dashboard/governance");
  return { ok: true, handbook_chapter_id: inserted.handbook_chapter_id };
}
