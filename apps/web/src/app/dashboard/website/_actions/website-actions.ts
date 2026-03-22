"use server";

/**
 * Server actions for website CRUD operations.
 * Uses service-role client for all writes to the websites schema, which is not
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 * in database.types.ts — all schema queries use .schema("websites" as any).
 */

import { revalidateTag } from "next/cache";
import { createClient as createServerClient } from "@smartout/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { getTemplate, getSectionDef, defaultSectionSettings } from "@smartout/website";
import { emit } from "@smartout/telemetry";

// ─── Helpers ────────────────────────────────────────────────────

/** Service-role client for websites schema operations. */
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

/** Get the authenticated user and verify they are an admin in the given workspace. */
async function requireAdminForWorkspace(workspaceId: string) {
  const userClient = await createServerClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const admin = getAdminClient();

  const { data: isAdmin } = await admin.rpc("is_admin_in_workspace", {
    uid: user.id,
    wid: workspaceId,
  });

  if (!isAdmin) throw new Error("Insufficient permissions — workspace admin required");

  return { user, admin };
}

/** Get the authenticated user and verify they are an admin in the website's workspace. */
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
    .schema("websites" as any)
    .from("website")
    .select("workspace_id")
    .eq("website_id", websiteId)
    .is("deleted_at", null)
    .single();

  if (error || !website) throw new Error("Website not found");

  const workspaceId = (website as { workspace_id: string }).workspace_id;

  const { data: isAdmin } = await admin.rpc("is_admin_in_workspace", {
    uid: user.id,
    wid: workspaceId,
  });

  if (!isAdmin) throw new Error("Insufficient permissions — workspace admin required");

  return { user, admin, workspaceId };
}

// ─── getWebsiteForWorkspace ──────────────────────────────────────

export type WebsiteRow = {
  website_id: string;
  name: string;
  site_slug: string;
  tagline: string | null;
  template_key: string;
  template_version: number;
  theme: Record<string, unknown>;
  visibility: string;
  booking_provider: string | null;
  booking_url: string | null;
  social_links: Record<string, string> | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_address: Record<string, string> | null;
  created_at: string;
  updated_at: string;
};

/**
 * Fetches the website for a given workspace.
 * Returns null if the workspace has no website yet.
 */
export async function getWebsiteForWorkspace(workspaceId: string): Promise<WebsiteRow | null> {
  const admin = getAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await admin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .schema("websites" as any)
    .from("website")
    .select(
      "website_id, name, site_slug, tagline, template_key, template_version, theme, visibility, booking_provider, booking_url, social_links, contact_email, contact_phone, contact_address, created_at, updated_at",
    )
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .single();

  if (error?.code === "PGRST116") return null; // No website yet
  if (error) throw new Error(error.message);

  return data as WebsiteRow;
}

// ─── createWebsiteFromTemplate ──────────────────────────────────

type CreateWebsiteInput = {
  workspaceId: string;
  templateKey: string;
  name: string;
  siteSlug: string;
  theme?: Record<string, unknown>;
};

/**
 * Creates a website from a template manifest.
 * Inserts website, pages, sections, default domain, and draft revision in order.
 * Sets workspace.has_website = true on completion.
 */
export async function createWebsiteFromTemplate(
  input: CreateWebsiteInput,
): Promise<{ websiteId: string; siteSlug: string }> {
  const { user, admin } = await requireAdminForWorkspace(input.workspaceId);

  const template = getTemplate(input.templateKey);
  if (!template) throw new Error(`Template not found: ${input.templateKey}`);

  // 1. Create website row
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: website, error: websiteError } = await admin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .schema("websites" as any)
    .from("website")
    .insert({
      workspace_id: input.workspaceId,
      name: input.name,
      site_slug: input.siteSlug,
      template_key: template.key,
      template_version: template.version,
      theme: input.theme ?? template.defaultTheme,
      visibility: "draft",
      created_by: user.id,
    })
    .select("website_id, site_slug")
    .single();

  if (websiteError || !website) {
    throw new Error(`Failed to create website: ${websiteError?.message}`);
  }

  const websiteId = (website as { website_id: string }).website_id;
  const siteSlug = (website as { site_slug: string }).site_slug;

  // 2. Create pages and sections from template manifest
  for (let pageIdx = 0; pageIdx < template.defaultPages.length; pageIdx++) {
    const pageDef = template.defaultPages[pageIdx];
    if (!pageDef) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: page, error: pageError } = await admin
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .schema("websites" as any)
      .from("website_page")
      .insert({
        website_id: websiteId,
        workspace_id: input.workspaceId,
        slug: pageDef.slug,
        title: pageDef.title,
        page_type: pageDef.type,
        sort_order: pageIdx,
        is_visible: true,
      })
      .select("website_page_id")
      .single();

    if (pageError || !page) continue;

    const pageId = (page as { website_page_id: string }).website_page_id;

    for (let secIdx = 0; secIdx < pageDef.sections.length; secIdx++) {
      const sectionType = pageDef.sections[secIdx];
      if (!sectionType) continue;
      const sectionDef = getSectionDef(sectionType);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await admin
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .schema("websites" as any)
        .from("website_section")
        .insert({
          website_page_id: pageId,
          workspace_id: input.workspaceId,
          section_type: sectionType,
          content: sectionDef?.defaults ?? {},
          settings: defaultSectionSettings,
          sort_order: secIdx,
          is_visible: true,
        });
    }
  }

  // 3. Create default smartout.info subdomain
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await admin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .schema("websites" as any)
    .from("website_domain")
    .insert({
      website_id: websiteId,
      workspace_id: input.workspaceId,
      hostname: `${siteSlug}.smartout.info`,
      is_primary: true,
      is_verified: true,
    });

  // 4. Record draft revision so history is not empty from day one
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await admin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .schema("websites" as any)
    .from("website_draft_revision")
    .insert({
      website_id: websiteId,
      workspace_id: input.workspaceId,
      source: "template_apply",
      changed_by: user.id,
      change_summary: `Created from template: ${template.name}`,
    });

  // 5. Mark workspace as having a website so nav and setup wizard gate correctly
  await admin.from("workspace").update({ has_website: true }).eq("workspace_id", input.workspaceId);

  await emit({
    event: "website setup completed",
    workspace_id: input.workspaceId,
    actor_id: user.id,
    properties: {
      entity: { entity_type: "website", entity_id: websiteId },
      data: { template_key: template.key, page_count: template.defaultPages.length },
    },
  });

  return { websiteId, siteSlug };
}

// ─── updateWebsite ───────────────────────────────────────────────

type UpdateWebsiteInput = {
  name?: string;
  tagline?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactAddress?: Record<string, string>;
  socialLinks?: Record<string, string>;
  bookingProvider?: string;
  bookingUrl?: string;
};

/**
 * Updates top-level website settings — name, contact info, social links, booking.
 */
export async function updateWebsite(
  websiteId: string,
  updates: UpdateWebsiteInput,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const { user, admin, workspaceId } = await requireAdminForWebsite(websiteId);

    const patch: Record<string, unknown> = {};
    if (updates.name !== undefined) patch.name = updates.name;
    if (updates.tagline !== undefined) patch.tagline = updates.tagline;
    if (updates.contactEmail !== undefined) patch.contact_email = updates.contactEmail;
    if (updates.contactPhone !== undefined) patch.contact_phone = updates.contactPhone;
    if (updates.contactAddress !== undefined) patch.contact_address = updates.contactAddress;
    if (updates.socialLinks !== undefined) patch.social_links = updates.socialLinks;
    if (updates.bookingProvider !== undefined) patch.booking_provider = updates.bookingProvider;
    if (updates.bookingUrl !== undefined) patch.booking_url = updates.bookingUrl;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await admin
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .schema("websites" as any)
      .from("website")
      .update(patch)
      .eq("website_id", websiteId);

    if (error) return { success: false, error: error.message };

    revalidateTag(`website:${websiteId}`);
    revalidateTag(`website:workspace:${workspaceId}`);

    await emit({
      event: "website updated",
      workspace_id: workspaceId,
      actor_id: user.id,
      properties: {
        entity: { entity_type: "website", entity_id: websiteId },
        data: { fields: Object.keys(patch) },
      },
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
