"use server";

// ============================================
// platform-admin/landing/variants/actions.ts
// Server actions for managing landing variants from the
// admin list (duplicate, set default, archive).
//
// Why this file exists:
// - Keep privileged mutations on the server
// - Centralize validation and cache revalidation
//
// Connected to:
// - _components/variant-list.tsx (client action triggers)
// - variants/page.tsx (list refresh target)
// ============================================

import { revalidatePath } from "next/cache";

import type { Database, Json } from "@smartout/supabase";
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";

type LandingBlockType = Database["public"]["Enums"]["landing_block_type"];

export type VariantListRow = {
  id: string;
  name: string;
  slug: string;
  status: "draft" | "published" | "archived";
  is_default: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type VariantActionResponse =
  | { ok: true; message: string; variant?: VariantListRow }
  | { ok: false; error: string };

type LandingVariantRecord = {
  id: string;
  name: string;
  slug: string;
  status: "draft" | "published" | "archived";
  is_default: boolean;
  sort_order: number;
  theme: Json | null;
  meta_title: string | null;
  meta_description: string | null;
  og_image_path: string | null;
  voice_config: Json | null;
  created_at: string;
  updated_at: string;
};

type LandingBlockRecord = {
  block_type: LandingBlockType;
  sort_order: number;
  content: Json | null;
  settings: Json | null;
  is_visible: boolean;
};

const VARIANTS_LIST_PATH = "/platform-admin/landing/variants";

/**
 * Ensures only super admins can execute landing variant mutations.
 *
 * Why: list actions are platform-level operations that should never be
 * available to regular workspace users.
 *
 * @returns The authenticated super admin id.
 */
async function requireSuperAdmin(): Promise<string> {
  const adminId = await getSuperAdminId();
  if (!adminId) {
    throw new Error("Only platform admins can manage landing variants.");
  }
  return adminId;
}

/**
 * Converts a string into a safe slug candidate.
 *
 * Why: duplicate action needs deterministic slug generation.
 *
 * @param value - Candidate string to normalize.
 * @returns URL-safe lowercase slug.
 */
function normalizeSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Builds a unique duplicate slug by appending copy suffixes.
 *
 * Why: landing_variant.slug is unique; duplicate flow must never fail on collisions.
 *
 * @param sourceSlug - Original variant slug.
 * @returns A unique slug for the new duplicated variant.
 */
async function buildUniqueDuplicateSlug(sourceSlug: string): Promise<string> {
  const admin = createAdminClient();
  const baseSlug = normalizeSlug(`${sourceSlug}-copy`) || "variant-copy";
  let candidate = baseSlug;
  let sequence = 2;

  for (;;) {
    const { data, error } = await admin
      .from("landing_variant")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();

    if (error) {
      throw new Error(`Could not validate duplicate slug: ${error.message}`);
    }
    if (!data) {
      return candidate;
    }

    candidate = `${baseSlug}-${sequence}`;
    sequence += 1;
  }
}

/**
 * Triggers cache invalidation in the landing app after public-facing changes.
 *
 * Why: default/publish/archive mutations should be visible quickly on landing.
 *
 * @returns Nothing.
 */
async function triggerLandingRevalidation(): Promise<void> {
  const landingUrl = process.env.NEXT_PUBLIC_LANDING_URL;
  if (!landingUrl) return;

  try {
    await fetch(`${landingUrl}/api/revalidate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: process.env.NEXT_PUBLIC_REVALIDATION_SECRET ?? "dev-revalidation-secret",
      }),
      cache: "no-store",
    });
  } catch {
    // Revalidation is best-effort; admin mutation should still complete.
  }
}

/**
 * Duplicates a landing variant and all its blocks into a new draft variant.
 *
 * Why: editors need a safe way to branch content without modifying the original.
 *
 * @param variantId - Source variant id.
 * @returns Operation status and duplicated row metadata.
 */
export async function duplicateLandingVariant(variantId: string): Promise<VariantActionResponse> {
  try {
    await requireSuperAdmin();
    const admin = createAdminClient();

    const { data: source, error: sourceError } = await admin
      .from("landing_variant")
      .select(
        "id, name, slug, status, is_default, sort_order, theme, meta_title, meta_description, og_image_path, voice_config, created_at, updated_at",
      )
      .eq("id", variantId)
      .single();

    if (sourceError || !source) {
      return { ok: false, error: sourceError?.message ?? "Variant not found." };
    }

    const sourceVariant = source as unknown as LandingVariantRecord; // SAFETY: Supabase join returns union type; runtime shape matches the cast
    const duplicateSlug = await buildUniqueDuplicateSlug(sourceVariant.slug);

    const { data: blockRows, error: blockError } = await admin
      .from("landing_block")
      .select("block_type, sort_order, content, settings, is_visible")
      .eq("variant_id", variantId)
      .order("sort_order", { ascending: true });

    if (blockError) {
      return { ok: false, error: blockError.message };
    }

    const { data: insertedVariant, error: insertVariantError } = await admin
      .from("landing_variant")
      .insert({
        name: `${sourceVariant.name} (Copy)`,
        slug: duplicateSlug,
        status: "draft",
        is_default: false,
        sort_order: sourceVariant.sort_order + 1,
        theme: sourceVariant.theme ?? ({} as Json),
        meta_title: sourceVariant.meta_title,
        meta_description: sourceVariant.meta_description,
        og_image_path: sourceVariant.og_image_path,
        voice_config: sourceVariant.voice_config ?? ({} as Json),
      })
      .select("id, name, slug, status, is_default, sort_order, created_at, updated_at")
      .single();

    if (insertVariantError || !insertedVariant) {
      return { ok: false, error: insertVariantError?.message ?? "Failed to duplicate variant." };
    }

    const duplicatedVariant = insertedVariant as unknown as VariantListRow & { id: string }; // SAFETY: Supabase join returns union type; runtime shape matches the cast
    const sourceBlocks = (blockRows as unknown as LandingBlockRecord[] | null) ?? []; // SAFETY: Supabase join returns union type; runtime shape matches the cast

    if (sourceBlocks.length > 0) {
      const { error: insertBlocksError } = await admin.from("landing_block").insert(
        sourceBlocks.map((block) => ({
          variant_id: duplicatedVariant.id,
          block_type: block.block_type,
          sort_order: block.sort_order,
          content: block.content ?? ({} as Json),
          settings: block.settings ?? ({} as Json),
          is_visible: block.is_visible,
        })),
      );

      if (insertBlocksError) {
        await admin.from("landing_variant").delete().eq("id", duplicatedVariant.id);
        return { ok: false, error: insertBlocksError.message };
      }
    }

    revalidatePath(VARIANTS_LIST_PATH);
    return {
      ok: true,
      message: "Variant duplicated.",
      variant: duplicatedVariant,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to duplicate variant.",
    };
  }
}

/**
 * Marks a variant as the single default variant.
 *
 * Why: root landing page uses the default variant fallback flow.
 *
 * @param variantId - Target variant id.
 * @returns Operation status.
 */
export async function setLandingVariantAsDefault(
  variantId: string,
): Promise<VariantActionResponse> {
  try {
    await requireSuperAdmin();
    const admin = createAdminClient();

    const { data: target, error: targetError } = await admin
      .from("landing_variant")
      .select("id, status")
      .eq("id", variantId)
      .single();

    if (targetError || !target) {
      return { ok: false, error: targetError?.message ?? "Variant not found." };
    }
    const targetStatus = target.status;
    if (targetStatus !== "published") {
      return {
        ok: false,
        error: "Only published variants can be set as default.",
      };
    }

    const { data: previousDefaultRows, error: previousDefaultError } = await admin
      .from("landing_variant")
      .select("id")
      .eq("is_default", true);

    if (previousDefaultError) {
      return { ok: false, error: previousDefaultError.message };
    }

    const previousDefaultIds = previousDefaultRows?.map((row) => row.id);

    // Clear current defaults first to avoid unique-index conflicts.
    const { error: clearOtherDefaultsError } = await admin
      .from("landing_variant")
      .update({ is_default: false })
      .eq("is_default", true);

    if (clearOtherDefaultsError) {
      return {
        ok: false,
        error: clearOtherDefaultsError.message,
      };
    }

    const { error: setDefaultError } = await admin
      .from("landing_variant")
      .update({ is_default: true })
      .eq("id", variantId);

    if (setDefaultError) {
      // Compensating rollback: restore the previous default if we know it.
      const previousDefaultId = previousDefaultIds?.find((id) => id !== variantId);
      if (previousDefaultId) {
        await admin
          .from("landing_variant")
          .update({ is_default: true })
          .eq("id", previousDefaultId);
      }
      return { ok: false, error: setDefaultError.message };
    }

    revalidatePath(VARIANTS_LIST_PATH);
    await triggerLandingRevalidation();

    return { ok: true, message: "Default variant updated." };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to set default variant.",
    };
  }
}

/**
 * Archives a variant to hide it from active publishing flows.
 *
 * Why: admins need a non-destructive way to retire old variants.
 *
 * @param variantId - Target variant id.
 * @returns Operation status.
 */
export async function archiveLandingVariant(variantId: string): Promise<VariantActionResponse> {
  try {
    await requireSuperAdmin();
    const admin = createAdminClient();

    const { data: target, error: targetError } = await admin
      .from("landing_variant")
      .select("id, is_default, status")
      .eq("id", variantId)
      .single();

    if (targetError || !target) {
      return { ok: false, error: targetError?.message ?? "Variant not found." };
    }

    const variant = target;
    if (variant.is_default) {
      return { ok: false, error: "Set another default variant before archiving this one." };
    }
    if (variant.status === "archived") {
      return { ok: true, message: "Variant is already archived." };
    }

    const { error: archiveError } = await admin
      .from("landing_variant")
      .update({ status: "archived" })
      .eq("id", variantId);

    if (archiveError) {
      return { ok: false, error: archiveError.message };
    }

    revalidatePath(VARIANTS_LIST_PATH);
    await triggerLandingRevalidation();

    return { ok: true, message: "Variant archived." };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to archive variant.",
    };
  }
}
