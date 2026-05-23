// apps/mobile/src/lib/upload-routine-source.ts
// Upload a captured/picked image to the routine-source bucket. Returns the
// storage_path the BFF extract route expects. Path: <workspace>/<profile>/<uuid>.<ext>
//
// Accepts either a local URI string (native — expo-image-picker asset uri) or a
// Blob/File (web/PWA — from an <input type="file">). On web expo-image-picker is
// stubbed, so the file-input path is the only working capture there.
import { randomUUID } from "expo-crypto";
import { supabase } from "@/lib/supabase";

export async function uploadRoutineSource(
  workspaceId: string,
  profileId: string,
  source: string | Blob,
): Promise<string> {
  let blob: Blob;
  let ext: string;

  if (typeof source === "string") {
    ext = source.split(".").pop()?.toLowerCase() ?? "jpg";
    blob = await (await fetch(source)).blob();
  } else {
    blob = source;
    const name = (source as { name?: string }).name;
    ext = name?.split(".").pop()?.toLowerCase() ?? source.type.split("/")[1] ?? "jpg";
  }
  if (ext === "jpeg") ext = "jpg";

  const mimeType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  const storagePath = `${workspaceId}/${profileId}/${randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from("routine-source")
    .upload(storagePath, blob, { contentType: mimeType, upsert: false });
  if (error) throw error;

  return storagePath;
}
