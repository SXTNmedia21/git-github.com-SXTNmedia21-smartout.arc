"use server";

/**
 * Server actions for website section CRUD operations.
 * Content is validated against Zod schemas from the section registry before saving.
 * Settings are validated against sectionSettingsSchema.
 * All mutations record a draft revision for history tracking.
 */

import { createClient as createServerClient } from "@smartout/supabase/server";
import { createClient } from "@supabase/supabase-js";
import {
  getSectionDef,
  sectionSettingsSchema,
  defaultSectionSettings,
  LIMITS,
} from "@smartout/website";
import type { SectionSettings } from "@smartout/website";
import { emit, nonEmpty } from "@smartout/telemetry";
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

type ActionResult = { success: true } | { success: false; error: string };

// ─── createSection ───────────────────────────────────────────────

export type SectionRow = {
  website_section_id: string;
  website_page_id: string;
  section_type: string;
  content: Record<string, unknown>;
  settings: SectionSettings;
  is_visible: boolean;
  sort_order: number;
};

/**
 * Creates a new section on a page using default content from the section registry.
 * Validates the section type is registered before inserting.
 * Enforces LIMITS.maxSectionsPerPage.
 */
export async function createSection(
  websiteId: string,
  pageId: string,
  sectionType: string,
): Promise<SectionRow> {
  const { user, admin, workspaceId } = await requireAdminForWebsite(websiteId);

  const sectionDef = getSectionDef(sectionType);
  if (!sectionDef) throw new Error(`Unknown section type: ${sectionType}`);

  // Enforce section count limit
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await admin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .schema("websites" as any) // SAFETY: websites is a valid Postgres schema not in Supabase generated types
    .from("website_section")
    .select("*", { count: "exact", head: true })
    .eq("website_page_id", pageId)
    .is("deleted_at", null);

  if ((count ?? 0) >= LIMITS.maxSectionsPerPage) {
    throw new Error(`Maximum ${LIMITS.maxSectionsPerPage} sections per page`);
  }

  // Enforce maxPerPage constraint from section definition
  if (sectionDef.maxPerPage !== undefined) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: typeCount } = await admin
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .schema("websites" as any) // SAFETY: websites is a valid Postgres schema not in Supabase generated types
      .from("website_section")
      .select("*", { count: "exact", head: true })
      .eq("website_page_id", pageId)
      .eq("section_type", sectionType)
      .is("deleted_at", null);

    if ((typeCount ?? 0) >= sectionDef.maxPerPage) {
      throw new Error(`Maximum ${sectionDef.maxPerPage} "${sectionDef.name}" section(s) per page`);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await admin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .schema("websites" as any) // SAFETY: websites is a valid Postgres schema not in Supabase generated types
    .from("website_section")
    .insert({
      website_page_id: pageId,
      workspace_id: workspaceId,
      section_type: sectionType,
      content: sectionDef.defaults ?? {},
      settings: defaultSectionSettings,
      sort_order: count ?? 0,
      is_visible: true,
    })
    .select(
      "website_section_id, website_page_id, section_type, content, settings, is_visible, sort_order",
    )
    .single();

  if (error) throw new Error(error.message);

  const section = data as SectionRow;

  await emit({
    event: "website section created",
    workspace_id: nonEmpty(workspaceId, "workspace_id"),
    actor_id: nonEmpty(user.id, "actor_id"),
    properties: {
      entity: { entity_type: "website_section", entity_id: section.website_section_id },
      data: { section_type: sectionType, page_id: pageId },
    },
  });

  return section;
}

// ─── deleteSection ───────────────────────────────────────────────

/**
 * Soft-deletes a section by setting deleted_at.
 */
export async function deleteSection(websiteId: string, sectionId: string): Promise<ActionResult> {
  try {
    const { user, admin, workspaceId } = await requireAdminForWebsite(websiteId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await admin
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .schema("websites" as any) // SAFETY: websites is a valid Postgres schema not in Supabase generated types
      .from("website_section")
      .update({ deleted_at: new Date().toISOString() })
      .eq("website_section_id", sectionId);

    if (error) return { success: false, error: error.message };

    await emit({
      event: "website section deleted",
      workspace_id: nonEmpty(workspaceId, "workspace_id"),
      actor_id: nonEmpty(user.id, "actor_id"),
      properties: {
        entity: { entity_type: "website_section", entity_id: sectionId },
      },
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ─── updateSectionContent ────────────────────────────────────────

/**
 * Updates the content of a section after validating it against the registered Zod schema.
 * Records a draft revision for history. source="autosave" skips revision for frequent saves.
 */
export async function updateSectionContent(
  websiteId: string,
  sectionId: string,
  content: Record<string, unknown>,
  source: "manual" | "autosave" = "manual",
): Promise<ActionResult> {
  try {
    const { user, admin, workspaceId } = await requireAdminForWebsite(websiteId);

    // Fetch section type so we can look up the correct Zod schema
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: section } = await admin
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .schema("websites" as any) // SAFETY: websites is a valid Postgres schema not in Supabase generated types
      .from("website_section")
      .select("section_type")
      .eq("website_section_id", sectionId)
      .single();

    if (!section) return { success: false, error: "Section not found" };

    const sectionType = (section as { section_type: string }).section_type;
    const sectionDef = getSectionDef(sectionType);

    // Validate content against schema if a definition exists
    if (sectionDef) {
      const result = sectionDef.schema.safeParse(content);
      if (!result.success) {
        return { success: false, error: `Validation failed: ${result.error.message}` };
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await admin
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .schema("websites" as any) // SAFETY: websites is a valid Postgres schema not in Supabase generated types
      .from("website_section")
      .update({ content, updated_at: new Date().toISOString() })
      .eq("website_section_id", sectionId);

    if (error) return { success: false, error: error.message };

    // Record draft revision — skip for autosave to avoid polluting revision history
    if (source === "manual") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await admin
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .schema("websites" as any) // SAFETY: websites is a valid Postgres schema not in Supabase generated types
        .from("website_draft_revision")
        .insert({
          website_id: websiteId,
          workspace_id: workspaceId,
          source,
          changed_by: user.id,
          change_summary: `Updated ${sectionType} section`,
        });
    }

    await emit({
      event: "website section updated",
      workspace_id: nonEmpty(workspaceId, "workspace_id"),
      actor_id: nonEmpty(user.id, "actor_id"),
      properties: {
        entity: { entity_type: "website_section", entity_id: sectionId },
        data: { section_type: sectionType, source },
      },
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ─── reorderSections ────────────────────────────────────────────

/**
 * Batch updates sort_order for sections given an ordered list of section IDs.
 */
export async function reorderSections(
  websiteId: string,
  pageId: string,
  orderedSectionIds: string[],
): Promise<ActionResult> {
  try {
    const { user, admin, workspaceId } = await requireAdminForWebsite(websiteId);

    await Promise.all(
      orderedSectionIds.map((sectionId, index) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        admin
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .schema("websites" as any) // SAFETY: websites is a valid Postgres schema not in Supabase generated types
          .from("website_section")
          .update({ sort_order: index })
          .eq("website_section_id", sectionId)
          .eq("website_page_id", pageId),
      ),
    );

    await emit({
      event: "website sections reordered",
      workspace_id: nonEmpty(workspaceId, "workspace_id"),
      actor_id: nonEmpty(user.id, "actor_id"),
      properties: {
        entity: { entity_type: "website_page", entity_id: pageId },
        data: { section_count: orderedSectionIds.length },
      },
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ─── updateSectionSettings ───────────────────────────────────────

/**
 * Updates the display settings (spacing, background, width, alignment) for a section.
 * Validates against sectionSettingsSchema before writing.
 */
export async function updateSectionSettings(
  websiteId: string,
  sectionId: string,
  settings: Record<string, unknown>,
): Promise<ActionResult> {
  try {
    const { admin } = await requireAdminForWebsite(websiteId);

    const result = sectionSettingsSchema.safeParse(settings);
    if (!result.success) {
      return { success: false, error: `Invalid settings: ${result.error.message}` };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await admin
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .schema("websites" as any) // SAFETY: websites is a valid Postgres schema not in Supabase generated types
      .from("website_section")
      .update({ settings: result.data, updated_at: new Date().toISOString() })
      .eq("website_section_id", sectionId);

    if (error) return { success: false, error: error.message };

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
