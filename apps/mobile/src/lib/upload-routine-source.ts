// apps/mobile/src/lib/upload-routine-source.ts
// Upload a captured/picked image to the routine-source bucket. Returns the
// storage_path the BFF extract route expects. Path: <workspace>/<profile>/<uuid>.<ext>
import { randomUUID } from "expo-crypto";
import { supabase } from "@/lib/supabase";

export async function uploadRoutineSource(
  workspaceId: string,
  profileId: string,
  localUri: string,
): Promise<string> {
  const ext = localUri.split(".").pop()?.toLowerCase() ?? "jpg";
  const mimeType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  const storagePath = `${workspaceId}/${profileId}/${randomUUID()}.${ext}`;

  const response = await fetch(localUri);
  const blob = await response.blob();

  const { error } = await supabase.storage
    .from("routine-source")
    .upload(storagePath, blob, { contentType: mimeType, upsert: false });
  if (error) throw error;

  return storagePath;
}
