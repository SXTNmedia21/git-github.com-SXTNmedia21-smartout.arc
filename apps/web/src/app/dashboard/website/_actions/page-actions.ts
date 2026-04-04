"use server";

/**
 * Server actions for website page CRUD operations.
 * Pages are soft-deleted and validated against LIMITS.maxPagesPerSite.
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

// ─── Page row type ───────────────────────────────────────────────

export type PageRow = {
  website_page_id: string;
  title: string;
  slug: string;
  page_type: string;
  sort_order: number;
  is_visible: boolean;
};

type ActionResult = { success: true } | { success: false; error: string };

// ─── createPage ─────────────────────────────────────────────────

/**
 * Creates a new page in the website.
 * Enforces LIMITS.maxPagesPerSite. Returns the created page row.
 */
export async function createPage(
  websiteId: string,
  title: string,
  pageType: string,
  slug: string,
): Promise<PageRow> {
  const { user, admin, workspaceId } = await requireAdminForWebsite(websiteId);

  // Enforce page count limit before inserting
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await admin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .schema("websites" as "public") // SAFETY: websites is a valid Postgres schema not represented as "public" in Supabase client types
    .from("website_page")
    .select("*", { count: "exact", head: true })
    .eq("website_id", websiteId)
    .is("deleted_at", null);

  if ((count ?? 0) >= LIMITS.maxPagesPerSite) {
    throw new Error(`Maximum ${LIMITS.maxPagesPerSite} pages per site`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await admin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .schema("websites" as "public") // SAFETY: websites is a valid Postgres schema not represented as "public" in Supabase client types
    .from("website_page")
    .insert({
      website_id: websiteId,
      workspace_id: workspaceId,
      title,
      slug,
      page_type: pageType,
      sort_order: count ?? 0,
      is_visible: true,
    })
    .select("website_page_id, title, slug, page_type, sort_order, is_visible")
    .single();

  if (error) throw new Error(error.message);

  const page = data as PageRow;

  await emit({
    event: "website page created",
    workspace_id: workspaceId,
    actor_id: user.id,
    properties: {
      entity: { entity_type: "website_page", entity_id: page.website_page_id },
      data: { title, page_type: pageType },
    },
  });

  return page;
}

// ─── deletePage ─────────────────────────────────────────────────

/**
 * Soft-deletes a page by setting deleted_at.
 * The home page cannot be deleted.
 */
export async function deletePage(websiteId: string, pageId: string): Promise<ActionResult> {
  try {
    const { user, admin, workspaceId } = await requireAdminForWebsite(websiteId);

    // Prevent deleting the home page — the site must always have a home
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: page } = await admin
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .schema("websites" as "public") // SAFETY: websites is a valid Postgres schema not represented as "public" in Supabase client types
      .from("website_page")
      .select("page_type")
      .eq("website_page_id", pageId)
      .is("deleted_at", null)
      .single();

    if (!page) return { success: false, error: "Page not found" };
    if ((page as { page_type: string }).page_type === "home") {
      return { success: false, error: "Cannot delete the home page" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await admin
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .schema("websites" as "public") // SAFETY: websites is a valid Postgres schema not represented as "public" in Supabase client types
      .from("website_page")
      .update({ deleted_at: new Date().toISOString() })
      .eq("website_page_id", pageId);

    if (error) return { success: false, error: error.message };

    await emit({
      event: "website page deleted",
      workspace_id: workspaceId,
      actor_id: user.id,
      properties: {
        entity: { entity_type: "website_page", entity_id: pageId },
      },
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ─── reorderPages ────────────────────────────────────────────────

/**
 * Batch updates sort_order for pages given an ordered list of page IDs.
 */
export async function reorderPages(
  websiteId: string,
  orderedPageIds: string[],
): Promise<ActionResult> {
  try {
    const { user, admin, workspaceId } = await requireAdminForWebsite(websiteId);

    await Promise.all(
      orderedPageIds.map((pageId, index) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        admin
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .schema("websites" as "public") // SAFETY: websites is a valid Postgres schema not represented as "public" in Supabase client types
          .from("website_page")
          .update({ sort_order: index })
          .eq("website_page_id", pageId)
          .eq("website_id", websiteId),
      ),
    );

    await emit({
      event: "website pages reordered",
      workspace_id: workspaceId,
      actor_id: user.id,
      properties: {
        entity: { entity_type: "website", entity_id: websiteId },
        data: { page_count: orderedPageIds.length },
      },
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ─── togglePageVisibility ────────────────────────────────────────

/**
 * Toggles the is_visible flag on a page.
 */
export async function togglePageVisibility(
  websiteId: string,
  pageId: string,
  isVisible: boolean,
): Promise<ActionResult> {
  try {
    const { admin } = await requireAdminForWebsite(websiteId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await admin
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .schema("websites" as "public") // SAFETY: websites is a valid Postgres schema not represented as "public" in Supabase client types
      .from("website_page")
      .update({ is_visible: isVisible })
      .eq("website_page_id", pageId)
      .eq("website_id", websiteId);

    if (error) return { success: false, error: error.message };

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
