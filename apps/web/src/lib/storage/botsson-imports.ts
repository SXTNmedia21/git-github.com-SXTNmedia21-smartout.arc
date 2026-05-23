// apps/web/src/lib/storage/botsson-imports.ts
// Shared helper for bulk_import attachment upload, MIME validation, and signed URL generation.
// Spec: docs/superpowers/specs/2026-05-23-bulk-import-design.md (Sortie 0)
// Council: 2026-05-23 APPROVE WITH CHANGES
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

export const ATTACHMENT_MIME_ALLOWLIST = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel", // .xls
  "text/csv",
  "application/csv",
] as const;

export const ATTACHMENT_MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const SIGNED_URL_EXPIRY_SECONDS = 3600; // 1 hour
export const BUCKET_NAME = "botsson-imports";

export function validateAttachmentMime(mime: string): boolean {
  if (!mime) return false;
  return (ATTACHMENT_MIME_ALLOWLIST as readonly string[]).includes(mime);
}

export type UploadResult = {
  storagePath: string;
  signedUrl: string;
  expiresAt: string;
  mime: string;
  sizeBytes: number;
  filename: string;
};

export async function uploadAttachment(args: {
  supabase: SupabaseClient;
  workspaceId: string;
  file: File;
}): Promise<UploadResult> {
  if (!validateAttachmentMime(args.file.type)) {
    throw new Error(`Unsupported MIME type: ${args.file.type}`);
  }
  if (args.file.size > ATTACHMENT_MAX_SIZE_BYTES) {
    throw new Error(`File too large: ${args.file.size} bytes (max ${ATTACHMENT_MAX_SIZE_BYTES})`);
  }

  const ext = args.file.name.split(".").pop() ?? "bin";
  const tempId = randomUUID();
  const storagePath = `${args.workspaceId}/${tempId}.${ext}`;

  const { error: uploadError } = await args.supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, args.file, {
      contentType: args.file.type,
      cacheControl: "private, max-age=0",
      upsert: false,
    });
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  const { data: signed, error: signError } = await args.supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRY_SECONDS);
  if (signError || !signed)
    throw new Error(`Signed URL failed: ${signError?.message ?? "unknown"}`);

  return {
    storagePath,
    signedUrl: signed.signedUrl,
    expiresAt: new Date(Date.now() + SIGNED_URL_EXPIRY_SECONDS * 1000).toISOString(),
    mime: args.file.type,
    sizeBytes: args.file.size,
    filename: args.file.name,
  };
}
