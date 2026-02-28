"use server";

import { createAdminClient } from "@smartout/supabase/admin";

/**
 * Server action for deleting a PDF attachment from storage.
 */
export async function deleteAttachment(filePath: string): Promise<void> {
  if (!filePath) {
    throw new Error("filePath is required");
  }

  const admin = createAdminClient();

  const { error } = await admin.storage.from("contract-attachments").remove([filePath]);

  if (error) {
    throw new Error(`Kunne ikke slette filen: ${error.message}`);
  }
}
