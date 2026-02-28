"use server";

import { createAdminClient } from "@smartout/supabase/admin";
import type { TemplateAttachment } from "./save-action";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = ["application/pdf"];

/**
 * Server action for uploading a PDF attachment to a contract template.
 * Uses service role client to bypass storage RLS.
 */
export async function uploadAttachment(
  formData: FormData,
): Promise<{ attachment: TemplateAttachment }> {
  const file = formData.get("file") as File | null;
  const templateId = formData.get("templateId") as string | null;

  if (!file || !templateId) {
    throw new Error("File and templateId are required");
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error("Kun PDF-filer er tillatt");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Filen er for stor (maks 10 MB)");
  }

  const admin = createAdminClient();
  const fileId = crypto.randomUUID();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = `templates/${templateId}/${fileId}_${safeName}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error } = await admin.storage.from("contract-attachments").upload(filePath, buffer, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    throw new Error(`Kunne ikke laste opp filen: ${error.message}`);
  }

  const attachment: TemplateAttachment = {
    id: fileId,
    file_name: file.name,
    file_path: filePath,
    file_size: file.size,
    mime_type: file.type,
    uploaded_at: new Date().toISOString(),
  };

  return { attachment };
}
