// ============================================
// platform-admin/landing/variants/[variantId]/page.tsx
// Server component: fetches a single landing_variant and its
// landing_block rows, then renders the block editor.
//
// When variantId is "new", renders an empty form for creating
// a new variant. Otherwise fetches existing data from Supabase.
//
// Connected to: _components/block-editor-client.tsx (main client UI)
//               supabase/migrations/20260301600000_landing_page_builder.sql (schema)
// ============================================

import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect, notFound } from "next/navigation";
import { BlockEditorClient } from "./_components/block-editor-client";

type Props = {
  params: Promise<{ variantId: string }>;
};

/** Shape of a variant row from the database. */
export type VariantData = {
  id: string;
  name: string;
  slug: string;
  status: "draft" | "published" | "archived";
  is_default: boolean;
  meta_title: string | null;
  meta_description: string | null;
  theme: Record<string, unknown> | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

/** Shape of a block row from the database. */
export type BlockData = {
  id: string;
  variant_id: string;
  block_type: string;
  content: Record<string, unknown>;
  sort_order: number;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
};

export default async function VariantEditorPage({ params }: Props) {
  const { variantId } = await params;

  // Guard: only platform admins can access this page
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  // Handle "new" variant — render empty editor
  if (variantId === "new") {
    return <BlockEditorClient variant={null} blocks={[]} isNew />;
  }

  const admin = createAdminClient();

  // Fetch variant and blocks in parallel
  const [variantResult, blocksResult] = await Promise.all([
    admin
      .from("landing_variant")
      .select(
        "id, name, slug, status, is_default, meta_title, meta_description, theme, sort_order, created_at, updated_at",
      )
      .eq("id", variantId)
      .single(),
    admin
      .from("landing_block")
      .select("id, variant_id, block_type, content, sort_order, is_visible, created_at, updated_at")
      .eq("variant_id", variantId)
      .order("sort_order", { ascending: true }),
  ]);

  if (!variantResult.data) {
    notFound();
  }

  return (
    <BlockEditorClient
      variant={variantResult.data as unknown as VariantData}
      blocks={(blocksResult.data as unknown as BlockData[]) ?? []}
    />
  );
}
