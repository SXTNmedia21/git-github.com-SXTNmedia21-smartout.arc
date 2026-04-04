// ============================================
// get-variant.ts
// Server-side data fetching for landing page variants.
// Fetches a variant + its blocks from Supabase, cached with
// unstable_cache and the 'landing' tag for on-demand revalidation.
//
// Usage:
//   - getVariantWithBlocks()          → default published variant
//   - getVariantWithBlocks("slug")    → published variant by slug
//   - getVariantWithBlocks(undefined, "uuid") → any variant by ID (preview)
//
// Note: The landing_variant and landing_block tables exist in the DB
// (migration 20260301600000) but are not yet in database.types.ts.
// We use createAdminClient() with explicit type casts until types
// are regenerated. Once regenerated, remove the casts.
//
// Connected to: apps/landing/src/app/v/page.tsx (consumer)
//               apps/landing/src/app/api/revalidate/route.ts (cache bust)
//               supabase/migrations/20260301600000_landing_page_builder.sql
// ============================================

import { unstable_cache } from "next/cache";
import { createAdminClient } from "@smartout/supabase/admin";
import type { LandingBlockType, BlockSettings, VariantTheme } from "./block-schemas";
import { variantThemeSchema } from "./block-schemas";

// ──── Types ────────────────────────────────────────────────

export type VariantRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  is_default: boolean;
  theme: unknown;
  meta_title: string | null;
  meta_description: string | null;
  og_image_path: string | null;
  voice_config: unknown;
};

export type BlockRow = {
  id: string;
  block_type: LandingBlockType;
  sort_order: number;
  content: unknown;
  settings: BlockSettings;
  is_visible: boolean;
};

export type VariantWithBlocks = {
  variant: VariantRow;
  blocks: BlockRow[];
};

// ──── Theme parser ─────────────────────────────────────────

/**
 * Safely parses a variant's theme JSONB column into a typed VariantTheme.
 * Falls back to defaults if the value is null, malformed, or incomplete.
 */
export function parseTheme(raw: unknown): VariantTheme {
  return variantThemeSchema.parse(raw ?? {});
}

// ──── Core fetch (uncached) ────────────────────────────────

async function fetchVariantWithBlocks(
  slug?: string,
  previewId?: string,
): Promise<VariantWithBlocks | null> {
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    console.warn("[get-variant] Admin client unavailable — cannot fetch variant");
    return null;
  }

  // ── Resolve the variant ──
  let variant: VariantRow | null = null;

  /**
   * Fetches the default published variant.
   * Why: both the root page and invalid slug requests must resolve predictably.
   */
  async function fetchDefaultPublishedVariant(): Promise<VariantRow | null> {
    const { data, error } = await admin
      .from("landing_variant")
      .select(
        "id, slug, name, status, is_default, theme, meta_title, meta_description, og_image_path, voice_config",
      )
      .eq("is_default", true)
      .eq("status", "published")
      .single();

    if (error || !data) {
      console.warn("[get-variant] Default published variant not found:", error?.message);
      return null;
    }

    return data as VariantRow;
  }

  if (previewId) {
    // Preview mode: fetch by ID regardless of status
    const { data, error } = await admin
      .from("landing_variant")
      .select(
        "id, slug, name, status, is_default, theme, meta_title, meta_description, og_image_path, voice_config",
      )
      .eq("id", previewId)
      .single();

    if (error || !data) {
      console.warn("[get-variant] Preview variant not found:", previewId, error?.message);
      return null;
    }
    variant = data as VariantRow;
  } else if (slug) {
    // Fetch published variant by slug
    const { data, error } = await admin
      .from("landing_variant")
      .select(
        "id, slug, name, status, is_default, theme, meta_title, meta_description, og_image_path, voice_config",
      )
      .eq("slug", slug)
      .eq("status", "published")
      .single();

    if (!error && data) {
      variant = data as VariantRow;
    } else {
      // Invalid slug should fall back to the default published variant.
      console.warn("[get-variant] Published variant not found for slug, using default:", slug);
      variant = await fetchDefaultPublishedVariant();
      if (!variant) return null;
    }
  } else {
    // Default: fetch the published variant with is_default=true
    variant = await fetchDefaultPublishedVariant();
    if (!variant) return null;
  }

  // ── Fetch blocks for the variant ──
  const { data: blocks, error: blocksError } = await admin
    .from("landing_block")
    .select("id, block_type, sort_order, content, settings, is_visible")
    .eq("variant_id", variant.id)
    .order("sort_order", { ascending: true });

  if (blocksError) {
    console.warn("[get-variant] Failed to fetch blocks:", blocksError.message);
    return { variant, blocks: [] };
  }

  return {
    variant,
    blocks: (blocks ?? []) as BlockRow[],
  };
}

// ──── Cached version ───────────────────────────────────────

/**
 * Fetches a landing variant with its blocks, cached with the 'landing' tag.
 *
 * @param slug - Optional variant slug. If omitted, fetches the default variant.
 * @param previewId - Optional variant UUID for preview mode (bypasses status filter).
 * @returns The variant row + ordered blocks, or null if not found.
 */
export async function getVariantWithBlocks(
  slug?: string,
  previewId?: string,
): Promise<VariantWithBlocks | null> {
  // Preview requests are never cached — they must always reflect the latest state
  if (previewId) {
    return fetchVariantWithBlocks(undefined, previewId);
  }

  const cached = unstable_cache(
    () => fetchVariantWithBlocks(slug),
    ["landing-variant", slug ?? "__default"],
    { tags: ["landing"], revalidate: 3600 },
  );

  return cached();
}
