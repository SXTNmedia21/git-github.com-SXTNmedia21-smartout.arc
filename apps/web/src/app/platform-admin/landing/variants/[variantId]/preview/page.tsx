// ============================================
// preview/page.tsx — Landing Variant Preview
// Server component: gate-checks platform-admin access,
// then renders a client component with an iframe showing
// the landing app root route with variant query param.
//
// Connected to: ../page.tsx (variant editor)
//               apps/landing/src/app/page.tsx (preview target)
//               ./_components/preview-client.tsx (client UI)
// ============================================

import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect, notFound } from "next/navigation";
import { createHmac } from "node:crypto";
import { PreviewClient } from "./_components/preview-client";

type Props = {
  params: Promise<{ variantId: string }>;
};

/**
 * Builds a signed, short-lived preview token for landing app preview mode.
 *
 * Why: preview-by-id should not be publicly accessible by guessing UUIDs.
 * The landing app verifies this signature before allowing draft preview fetches.
 *
 * @param variantId - Landing variant UUID.
 * @returns Signature payload, or null when secret is missing.
 */
function buildPreviewToken(variantId: string): { expiresAt: string; signature: string } | null {
  const secret = process.env.LANDING_PREVIEW_SECRET;
  if (!secret) return null;

  const expiresAt = String(Date.now() + 5 * 60 * 1000);
  const signature = createHmac("sha256", secret).update(`${variantId}:${expiresAt}`).digest("hex");
  return { expiresAt, signature };
}

export default async function PreviewPage({ params }: Props) {
  const { variantId } = await params;
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const admin = createAdminClient();
  const { data: variant } = await admin
    .from("landing_variant")
    .select("id, slug")
    .eq("id", variantId)
    .single();

  if (!variant) notFound();

  const previewToken = buildPreviewToken(variantId);

  return (
    <PreviewClient
      variantId={variantId}
      variantSlug={variant.slug}
      previewExpiresAt={previewToken?.expiresAt}
      previewSignature={previewToken?.signature}
    />
  );
}
