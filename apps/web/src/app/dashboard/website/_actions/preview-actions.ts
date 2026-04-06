"use server";

/**
 * Server actions for website preview token management.
 * Preview tokens allow viewing an unpublished website draft via a signed URL.
 */

import { createClient as createServerClient } from "@smartout/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { LIMITS } from "@smartout/website";
import { emit } from "@smartout/telemetry";

// ─── Helpers ────────────────────────────────────────────────────

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function requireAdminForWebsite(websiteId: string) {
  const userClient = await createServerClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const admin = getAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: website, error } = await admin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .schema("websites" as any) // SAFETY: websites is a valid Postgres schema not in Supabase generated types
    .from("website")
    .select("workspace_id, site_slug")
    .eq("website_id", websiteId)
    .is("deleted_at", null)
    .single();

  if (error || !website) throw new Error("Website not found");

  const workspaceId = (website as { workspace_id: string; site_slug: string }).workspace_id;
  const siteSlug = (website as { workspace_id: string; site_slug: string }).site_slug;

  const { data: isAdmin } = await admin.rpc("is_admin_in_workspace", {
    p_user_id: user.id,
    p_workspace_id: workspaceId,
  });

  if (!isAdmin) throw new Error("Insufficient permissions — workspace admin required");

  return { user, admin, workspaceId, siteSlug };
}

// ─── createPreviewToken ──────────────────────────────────────────

type CreatePreviewTokenResult =
  | { success: true; token: string; previewUrl: string }
  | { success: false; error: string };

/**
 * Creates a 24-hour preview token for a draft website.
 * The token can be appended to the site URL as ?preview={token}.
 * Enforces a maximum of LIMITS.maxActivePreviewTokens per website.
 */
export async function createPreviewToken(websiteId: string): Promise<CreatePreviewTokenResult> {
  try {
    const { user, admin, workspaceId, siteSlug } = await requireAdminForWebsite(websiteId);

    // Check active token count to avoid unbounded growth
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await admin
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .schema("websites" as any) // SAFETY: websites is a valid Postgres schema not in Supabase generated types
      .from("website_preview_token")
      .select("*", { count: "exact", head: true })
      .eq("website_id", websiteId)
      .gt("expires_at", new Date().toISOString());

    if ((count ?? 0) >= LIMITS.maxActivePreviewTokens) {
      return {
        success: false,
        error: `Maximum ${LIMITS.maxActivePreviewTokens} active preview tokens reached`,
      };
    }

    const expiresAt = new Date(Date.now() + LIMITS.previewTokenTtlMs).toISOString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: tokenRow, error: insertError } = await admin
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .schema("websites" as any) // SAFETY: websites is a valid Postgres schema not in Supabase generated types
      .from("website_preview_token")
      .insert({
        website_id: websiteId,
        workspace_id: workspaceId,
        created_by: user.id,
        expires_at: expiresAt,
      })
      .select("token")
      .single();

    if (insertError || !tokenRow) {
      return { success: false, error: insertError?.message ?? "Failed to create preview token" };
    }

    const token = (tokenRow as { token: string }).token;
    const previewUrl = `https://${siteSlug}.smartout.info?preview=${token}`;

    await emit({
      event: "website preview token created",
      workspace_id: workspaceId,
      actor_id: user.id,
      properties: {
        entity: { entity_type: "website", entity_id: websiteId },
        data: { expires_at: expiresAt },
      },
    });

    return { success: true, token, previewUrl };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
