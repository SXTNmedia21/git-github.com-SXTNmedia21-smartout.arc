"use server";

/**
 * Server actions for website asset management — uploading images to Supabase Storage
 * and creating corresponding website_asset rows for reference in section content.
 *
 * Uses service-role client because websites.* schema operations require it,
 * and storage uploads need the service role key for bucket write access.
 */

import { createClient as createServerClient } from "@smartout/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { LIMITS } from "@smartout/website";
import { emit } from "@smartout/telemetry";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/** Verify authenticated user is an admin in the website's workspace. Mirrors publish-actions pattern. */
async function requireAdminForWebsite(websiteId: string) {
  const userClient = await createServerClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const admin = getAdminClient();

  const { data: website, error } = await admin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .schema("websites" as "public") // SAFETY: websites is a valid Postgres schema not represented as "public" in Supabase client types
    .from("website")
    .select("workspace_id")
    .eq("website_id", websiteId)
    .is("deleted_at", null)
    .single();

  if (error || !website) throw new Error("Website not found");

  const workspaceId = (website as { workspace_id: string }).workspace_id;

  const { data: isAdmin } = await admin.rpc("is_admin_in_workspace", {
    p_user_id: user.id,
    p_workspace_id: workspaceId,
  });

  if (!isAdmin) throw new Error("Insufficient permissions — workspace admin required");

  return { user, admin, workspaceId };
}

type UploadResult =
  | { success: true; assetId: string; storagePath: string }
  | { success: false; error: string };

/**
 * Upload an image file to the `website-assets` Storage bucket and register it
 * as a `website_asset` row in the websites schema.
 *
 * The returned `assetId` is stored in section content (e.g. `imageAssetId`)
 * and referenced at publish time to build the snapshot's asset map.
 */
export async function uploadWebsiteAsset(
  websiteId: string,
  formData: FormData,
): Promise<UploadResult> {
  try {
    const { user, admin, workspaceId } = await requireAdminForWebsite(websiteId);

    const file = formData.get("file") as File | null;
    const altText = (formData.get("altText") as string | null) ?? "";

    if (!file) return { success: false, error: "No file provided" };

    // Server-side size validation — client already validates but we must enforce here too
    if (file.size > LIMITS.maxImageUploadBytes) {
      return {
        success: false,
        error: `File too large: max ${LIMITS.maxImageUploadBytes / 1024 / 1024} MB allowed`,
      };
    }

    if (!file.type.startsWith("image/")) {
      return { success: false, error: "Only image files are accepted" };
    }

    // Stable, unique storage path scoped to workspace + website
    const ext = file.name.split(".").pop() ?? "jpg";
    const storagePath = `${workspaceId}/${websiteId}/${crypto.randomUUID()}.${ext}`;
    const buffer = await file.arrayBuffer();

    const { error: storageError } = await admin.storage
      .from("website-assets")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (storageError) {
      return { success: false, error: `Storage upload failed: ${storageError.message}` };
    }

    // Register asset in websites schema for snapshot inclusion at publish time
    const { data: asset, error: dbError } = await admin
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .schema("websites" as "public") // SAFETY: websites is a valid Postgres schema not represented as "public" in Supabase client types
      .from("website_asset")
      .insert({
        website_id: websiteId,
        workspace_id: workspaceId,
        storage_path: storagePath,
        alt_text: altText,
        mime_type: file.type,
        uploaded_by: user.id,
      })
      .select("website_asset_id")
      .single();

    if (dbError || !asset) {
      return { success: false, error: `Failed to create asset record: ${dbError?.message}` };
    }

    const assetId = (asset as { website_asset_id: string }).website_asset_id;

    await emit({
      event: "website asset uploaded",
      workspace_id: workspaceId,
      actor_id: user.id,
      properties: {
        entity: { entity_type: "website", entity_id: websiteId },
        data: { asset_id: assetId, mime_type: file.type, size_bytes: file.size },
      },
    });

    return { success: true, assetId, storagePath };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
