// ============================================
// platform-admin/landing/variants/page.tsx
// Server component: fetches all landing_variant rows and renders
// the variant list page for platform admins.
//
// Shows all landing page variants with status, default flag,
// and action menu for managing variants.
//
// Connected to: _components/variant-list.tsx (renders data)
//               _components/variant-columns.tsx (column definitions)
//               supabase/migrations/20260301600000_landing_page_builder.sql (schema)
// ============================================

import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import { VariantList } from "./_components/variant-list";
import type { VariantRow } from "./_components/variant-columns";

export default async function VariantsPage() {
  // Guard: only platform admins can access this page
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const admin = createAdminClient();

  // Fetch all landing variants ordered by sort_order
  const { data: variants } = await admin
    .from("landing_variant")
    .select("id, name, slug, status, is_default, sort_order, created_at, updated_at")
    .order("sort_order", { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Landing Variants</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage landing page variants for A/B testing and multi-audience pages
        </p>
      </div>

      <VariantList variants={(variants ?? []) as unknown as VariantRow[]} />
    </div>
  );
}
