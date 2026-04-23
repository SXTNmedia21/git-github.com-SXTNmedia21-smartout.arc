"use server";

/**
 * Website publish pipeline — server actions for publishing, rolling back,
 * and unpublishing a workspace website.
 *
 * Uses service-role client because publish is a privileged cross-table
 * transactional operation that spans the websites.* schema. The websites
 * schema is not yet in database.types.ts, so we use untyped .schema() calls.
 */

import { updateTag } from "next/cache";
import { createClient as createServerClient } from "@smartout/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { hashSnapshot, validateSnapshotSize, SCHEMA_VERSION } from "@smartout/website";
import type {
  SiteSnapshot,
  SnapshotPage,
  SnapshotSection,
  SnapshotMenu,
  SnapshotMenuCategory,
  SnapshotMenuItem,
  SnapshotAsset,
} from "@smartout/website";
import { emit, nonEmpty } from "@smartout/telemetry";
// ─── Helpers ────────────────────────────────────────────────────

type PublishResult =
  | { success: true; version: number; snapshotHash: string }
  | { success: false; error: string };

type ActionResult = { success: true } | { success: false; error: string };

/** Service-role client for websites schema operations. */
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

/** Get the authenticated user and verify they are an admin in the website's workspace. */
async function requireAdminForWebsite(websiteId: string) {
  const userClient = await createServerClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const admin = getAdminClient();

  // Look up the website to get workspace_id
  const { data: website, error } = await admin
    .schema("websites")
    .from("website")
    .select("workspace_id, template_key, template_version")
    .eq("website_id", websiteId)
    .is("deleted_at", null)
    .single();

  if (error || !website) {
    throw new Error("Website not found");
  }

  // Verify admin role
  const { data: isAdmin } = await admin.rpc("is_admin_in_workspace", {
    p_user_id: user.id,
    p_workspace_id: website.workspace_id,
  });

  if (!isAdmin) {
    throw new Error("Insufficient permissions — workspace admin required");
  }

  return {
    user,
    admin,
    website: website as {
      workspace_id: string;
      template_key: string;
      template_version: number;
    },
    workspaceId: website.workspace_id as string,
  };
}

// ─── publishWebsite ─────────────────────────────────────────────

export async function publishWebsite(websiteId: string): Promise<PublishResult> {
  try {
    const { user, admin, website, workspaceId } = await requireAdminForWebsite(websiteId);

    // Validate: home page must exist with at least 1 visible section
    const { data: homePage } = await admin
      .schema("websites")
      .from("website_page")
      .select("website_page_id")
      .eq("website_id", websiteId)
      .eq("page_type", "home")
      .is("deleted_at", null)
      .single();

    if (!homePage) {
      return { success: false, error: "Cannot publish: no home page found" };
    }

    const { data: homeSections } = await admin
      .schema("websites")
      .from("website_section")
      .select("website_section_id")
      .eq("website_page_id", (homePage as { website_page_id: string }).website_page_id)
      .eq("is_visible", true)
      .is("deleted_at", null)
      .limit(1);

    if (!homeSections || homeSections.length === 0) {
      return {
        success: false,
        error: "Cannot publish: home page has no visible sections",
      };
    }

    // Build snapshot from draft tables
    const snapshot = await buildSnapshot(admin, websiteId, workspaceId, website);

    // Validate snapshot size
    const sizeCheck = validateSnapshotSize(snapshot);
    if (!sizeCheck.valid) {
      return {
        success: false,
        error: `Snapshot too large: ${(sizeCheck.sizeBytes / 1024 / 1024).toFixed(1)} MB exceeds 2 MB limit`,
      };
    }

    // Hash and check for duplicate
    const snapshotHash = hashSnapshot(snapshot);

    const { data: existingActive } = await admin
      .schema("websites")
      .from("website_published_snapshot")
      .select("snapshot_hash, version")
      .eq("website_id", websiteId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .single();

    if (existingActive) {
      const active = existingActive as { snapshot_hash: string; version: number };
      if (active.snapshot_hash === snapshotHash) {
        return {
          success: true,
          version: active.version,
          snapshotHash,
        };
      }
    }

    // Determine next version number
    const { data: maxVersion } = await admin
      .schema("websites")
      .from("website_published_snapshot")
      .select("version")
      .eq("website_id", websiteId)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    const nextVersion = ((maxVersion as { version: number } | null)?.version ?? 0) + 1;

    // Update build meta with final version and recompute hash
    snapshot.buildMeta.snapshotVersion = nextVersion;
    snapshot.buildMeta.publishedBy = user.id;
    snapshot.buildMeta.publishedAt = new Date().toISOString();
    const finalHash = hashSnapshot(snapshot);

    // Write new snapshot row (inactive initially)
    const { data: newSnapshot, error: insertError } = await admin
      .schema("websites")
      .from("website_published_snapshot")
      .insert({
        website_id: websiteId,
        workspace_id: workspaceId,
        version: nextVersion,
        snapshot_data: snapshot,
        snapshot_hash: finalHash,
        is_active: false,
        published_by: user.id,
        published_at: new Date().toISOString(),
      })
      .select("snapshot_id")
      .single();

    if (insertError || !newSnapshot) {
      return {
        success: false,
        error: `Failed to write snapshot: ${insertError?.message}`,
      };
    }

    const snapshotId = (newSnapshot as { snapshot_id: string }).snapshot_id;

    // Deactivate all other snapshots for this website
    await admin
      .schema("websites")
      .from("website_published_snapshot")
      .update({ is_active: false })
      .eq("website_id", websiteId)
      .eq("is_active", true);

    // Activate the new snapshot
    const { error: activateError } = await admin
      .schema("websites")
      .from("website_published_snapshot")
      .update({ is_active: true })
      .eq("snapshot_id", snapshotId);

    if (activateError) {
      return {
        success: false,
        error: `Failed to activate snapshot: ${activateError.message}`,
      };
    }

    // Update website visibility to 'live'
    await admin
      .schema("websites")
      .from("website")
      .update({ visibility: "live" })
      .eq("website_id", websiteId);

    // Log publish event
    await admin.schema("websites").from("website_publish_event").insert({
      website_id: websiteId,
      workspace_id: workspaceId,
      snapshot_id: snapshotId,
      action: "publish",
      performed_by: user.id,
    });

    // Revalidate ISR cache
    updateTag(`website:${websiteId}`);
    updateTag(`website:workspace:${workspaceId}`);

    // Emit telemetry
    await emit({
      event: "website published",
      workspace_id: nonEmpty(workspaceId, "workspace_id"),
      actor_id: nonEmpty(user.id, "actor_id"),
      properties: {
        entity: { entity_type: "website", entity_id: websiteId },
        data: { version: nextVersion, snapshot_hash: finalHash },
      },
    });

    return { success: true, version: nextVersion, snapshotHash: finalHash };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}

// ─── rollbackWebsite ────────────────────────────────────────────

export async function rollbackWebsite(
  websiteId: string,
  targetVersion: number,
): Promise<ActionResult> {
  try {
    const { user, admin, workspaceId } = await requireAdminForWebsite(websiteId);

    // Find current active version for telemetry
    const { data: currentActive } = await admin
      .schema("websites")
      .from("website_published_snapshot")
      .select("snapshot_id, version")
      .eq("website_id", websiteId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .single();

    const fromVersion = (currentActive as { version: number } | null)?.version ?? 0;

    // Find target snapshot
    const { data: targetSnapshot, error: targetError } = await admin
      .schema("websites")
      .from("website_published_snapshot")
      .select("snapshot_id")
      .eq("website_id", websiteId)
      .eq("version", targetVersion)
      .is("deleted_at", null)
      .single();

    if (targetError || !targetSnapshot) {
      return {
        success: false,
        error: `Snapshot version ${targetVersion} not found`,
      };
    }

    const targetSnapshotId = (targetSnapshot as { snapshot_id: string }).snapshot_id;

    // Deactivate current active snapshot
    await admin
      .schema("websites")
      .from("website_published_snapshot")
      .update({ is_active: false })
      .eq("website_id", websiteId)
      .eq("is_active", true);

    // Activate target
    const { error: activateError } = await admin
      .schema("websites")
      .from("website_published_snapshot")
      .update({ is_active: true })
      .eq("snapshot_id", targetSnapshotId);

    if (activateError) {
      return {
        success: false,
        error: `Failed to activate target: ${activateError.message}`,
      };
    }

    // Ensure visibility is 'live'
    await admin
      .schema("websites")
      .from("website")
      .update({ visibility: "live" })
      .eq("website_id", websiteId);

    // Log rollback event
    await admin.schema("websites").from("website_publish_event").insert({
      website_id: websiteId,
      workspace_id: workspaceId,
      snapshot_id: targetSnapshotId,
      action: "rollback",
      performed_by: user.id,
    });

    // Revalidate ISR cache
    updateTag(`website:${websiteId}`);
    updateTag(`website:workspace:${workspaceId}`);

    // Emit telemetry
    await emit({
      event: "website rollback",
      workspace_id: nonEmpty(workspaceId, "workspace_id"),
      actor_id: nonEmpty(user.id, "actor_id"),
      properties: {
        entity: { entity_type: "website", entity_id: websiteId },
        data: { from_version: fromVersion, to_version: targetVersion },
      },
    });

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}

// ─── unpublishWebsite ───────────────────────────────────────────

export async function unpublishWebsite(websiteId: string): Promise<ActionResult> {
  try {
    const { user, admin, workspaceId } = await requireAdminForWebsite(websiteId);

    // Deactivate all snapshots
    await admin
      .schema("websites")
      .from("website_published_snapshot")
      .update({ is_active: false })
      .eq("website_id", websiteId)
      .eq("is_active", true);

    // Set visibility to 'offline'
    await admin
      .schema("websites")
      .from("website")
      .update({ visibility: "offline" })
      .eq("website_id", websiteId);

    // Log unpublish event
    await admin.schema("websites").from("website_publish_event").insert({
      website_id: websiteId,
      workspace_id: workspaceId,
      snapshot_id: null,
      action: "unpublish",
      performed_by: user.id,
    });

    // Revalidate ISR cache
    updateTag(`website:${websiteId}`);
    updateTag(`website:workspace:${workspaceId}`);

    // Emit telemetry
    await emit({
      event: "website unpublished",
      workspace_id: nonEmpty(workspaceId, "workspace_id"),
      actor_id: nonEmpty(user.id, "actor_id"),
      properties: {
        entity: { entity_type: "website", entity_id: websiteId },
      },
    });

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}

// ─── Snapshot Builder ───────────────────────────────────────────

/**
 * Builds a SiteSnapshot from the current draft tables.
 * Joins: website -> pages -> sections, website -> menus -> categories -> items,
 * website -> assets, website -> domains.
 */
async function buildSnapshot(
  admin: ReturnType<typeof getAdminClient>,
  websiteId: string,
  workspaceId: string,
  websiteMeta: { template_key: string; template_version: number },
): Promise<SiteSnapshot> {
  // Fetch all data in parallel for performance
  const [
    websiteResult,
    pagesResult,
    sectionsResult,
    menusResult,
    categoriesResult,
    itemsResult,
    assetsResult,
  ] = await Promise.all([
    admin
      .schema("websites")
      .from("website")
      .select(
        "name, tagline, theme, booking_provider, booking_url, social_links, contact_email, contact_phone, contact_address, default_meta_title, default_meta_description, default_og_image_path",
      )
      .eq("website_id", websiteId)
      .single(),
    admin
      .schema("websites")
      .from("website_page")
      .select(
        "website_page_id, slug, title, page_type, is_visible, meta_title, meta_description, og_image_path, sort_order",
      )
      .eq("website_id", websiteId)
      .is("deleted_at", null)
      .eq("is_visible", true)
      .order("sort_order"),
    admin
      .schema("websites")
      .from("website_section")
      .select(
        "website_section_id, website_page_id, section_type, content, settings, is_visible, sort_order",
      )
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .eq("is_visible", true)
      .order("sort_order"),
    admin
      .schema("websites")
      .from("website_menu")
      .select("website_menu_id, name, description, source_type, pdf_storage_path, sort_order")
      .eq("website_id", websiteId)
      .is("deleted_at", null)
      .eq("is_visible", true)
      .order("sort_order"),
    admin
      .schema("websites")
      .from("website_menu_category")
      .select("website_menu_category_id, website_menu_id, name, description, sort_order")
      .eq("website_id", websiteId)
      .is("deleted_at", null)
      .order("sort_order"),
    admin
      .schema("websites")
      .from("website_menu_item")
      .select(
        "website_menu_category_id, name, description, price, currency, allergens, dietary_tags, image_asset_id, sort_order",
      )
      .eq("website_id", websiteId)
      .is("deleted_at", null)
      .eq("is_visible", true)
      .order("sort_order"),
    admin
      .schema("websites")
      .from("website_asset")
      .select("website_asset_id, storage_path, alt_text, width, height, mime_type")
      .eq("website_id", websiteId)
      .is("deleted_at", null),
  ]);

  // SAFETY: All queries are against the websites schema which returns untyped results.
  // Shapes are known from the .select() calls above and match the PublishSnapshot types below.
  const site = websiteResult.data as Record<string, unknown>;
  const pages = (pagesResult.data ?? []) as Record<string, unknown>[];
  const sections = (sectionsResult.data ?? []) as Record<string, unknown>[];
  const menus = (menusResult.data ?? []) as Record<string, unknown>[];
  const categories = (categoriesResult.data ?? []) as Record<string, unknown>[];
  const items = (itemsResult.data ?? []) as Record<string, unknown>[];
  const assets = (assetsResult.data ?? []) as Record<string, unknown>[];

  // Group sections by page
  const sectionsByPage = new Map<string, typeof sections>();
  for (const section of sections) {
    const pageId = section.website_page_id as string;
    if (!sectionsByPage.has(pageId)) {
      sectionsByPage.set(pageId, []);
    }
    sectionsByPage.get(pageId)!.push(section);
  }

  // Group categories by menu
  const categoriesByMenu = new Map<string, typeof categories>();
  for (const cat of categories) {
    const menuId = cat.website_menu_id as string;
    if (!categoriesByMenu.has(menuId)) {
      categoriesByMenu.set(menuId, []);
    }
    categoriesByMenu.get(menuId)!.push(cat);
  }

  // Group items by category
  const itemsByCategory = new Map<string, typeof items>();
  for (const item of items) {
    const catId = item.website_menu_category_id as string;
    if (!itemsByCategory.has(catId)) {
      itemsByCategory.set(catId, []);
    }
    itemsByCategory.get(catId)!.push(item);
  }

  // Build pages record
  const snapshotPages: Record<string, SnapshotPage> = {};

  for (const page of pages) {
    // SAFETY: website_page_id is always a string in practice; page comes from untyped websites schema query
    const pageSections = sectionsByPage.get(page.website_page_id as string) ?? [];

    const mappedSections: SnapshotSection[] = pageSections.map((s: Record<string, unknown>) => ({
      id: s.website_section_id as string,
      type: s.section_type as string,
      content: s.content as Record<string, unknown>,
      settings: s.settings as SnapshotSection["settings"],
      sortOrder: s.sort_order as number,
    }));

    snapshotPages[page.slug as string] = {
      title: page.title as string,
      slug: page.slug as string,
      meta: {
        title: (page.meta_title as string) ?? (page.title as string),
        description: (page.meta_description as string) ?? "",
        ogImage: (page.og_image_path as string) ?? "",
      },
      sections: mappedSections,
    };
  }

  // Build navigation from visible pages
  const navPages = pages.map((p: Record<string, unknown>) => ({
    slug: p.slug as string,
    title: p.title as string,
    sortOrder: p.sort_order as number,
  }));

  // Build menus with nested categories and items
  const snapshotMenus: SnapshotMenu[] = menus.map((menu: Record<string, unknown>) => {
    const menuCats = categoriesByMenu.get(menu.website_menu_id as string) ?? [];

    const mappedCategories: SnapshotMenuCategory[] = menuCats.map(
      (cat: Record<string, unknown>) => {
        const catItems = itemsByCategory.get(cat.website_menu_category_id as string) ?? [];

        const mappedItems: SnapshotMenuItem[] = catItems.map((item: Record<string, unknown>) => ({
          name: item.name as string,
          description: (item.description as string) ?? "",
          price: Number(item.price ?? 0),
          currency: item.currency as string,
          allergens: (item.allergens as string[]) ?? [],
          dietaryTags: (item.dietary_tags as string[]) ?? [],
          imageAssetId: (item.image_asset_id as string) ?? undefined,
        }));

        return {
          name: cat.name as string,
          description: (cat.description as string) ?? "",
          items: mappedItems,
        };
      },
    );

    return {
      name: menu.name as string,
      description: (menu.description as string) ?? "",
      sourceType: menu.source_type as "structured" | "pdf",
      pdfPath: (menu.pdf_storage_path as string) ?? undefined,
      categories: mappedCategories,
    };
  });

  // Build assets lookup map
  const assetsById: Record<string, SnapshotAsset> = {};
  for (const asset of assets) {
    assetsById[asset.website_asset_id as string] = {
      storagePath: asset.storage_path as string,
      alt: asset.alt_text as string,
      width: asset.width as number | null,
      height: asset.height as number | null,
      mimeType: asset.mime_type as string,
    };
  }

  const contactAddress = (site.contact_address ?? {}) as Record<string, string>;
  const socialLinks = (site.social_links ?? {}) as Record<string, string>;
  const storageBaseUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/website-assets`;

  return {
    site: {
      name: site.name as string,
      tagline: (site.tagline as string) ?? "",
      contact: {
        email: (site.contact_email as string) ?? "",
        phone: (site.contact_phone as string) ?? "",
        address: {
          street: contactAddress.street ?? "",
          city: contactAddress.city ?? "",
          postalCode: contactAddress.postalCode ?? "",
          country: contactAddress.country ?? "",
        },
      },
      social: {
        instagram: socialLinks.instagram,
        facebook: socialLinks.facebook,
        tripadvisor: socialLinks.tripadvisor,
        googleMaps: socialLinks.googleMaps,
      },
    },
    theme: site.theme as SiteSnapshot["theme"],
    navigation: { pages: navPages },
    pages: snapshotPages,
    menuData: { menus: snapshotMenus },
    seoDefaults: {
      title: (site.default_meta_title as string) ?? (site.name as string),
      description: (site.default_meta_description as string) ?? "",
      ogImage: (site.default_og_image_path as string) ?? "",
    },
    assets: {
      byId: assetsById,
      storageBaseUrl,
    },
    integrations: {
      booking: {
        provider: site.booking_provider as string,
        url: (site.booking_url as string) ?? "",
      },
    },
    buildMeta: {
      snapshotVersion: 0, // Overwritten after version determination
      templateKey: websiteMeta.template_key,
      templateVersion: websiteMeta.template_version,
      schemaVersion: SCHEMA_VERSION,
      publishedAt: "",
      publishedBy: "",
    },
  };
}
