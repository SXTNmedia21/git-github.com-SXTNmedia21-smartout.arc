// ============================================
// preview/page.tsx — Landing Variant Preview
// Server component: gate-checks platform-admin access,
// then renders a client component with an iframe showing
// the landing app's /v route in preview mode.
//
// Connected to: ../page.tsx (variant editor)
//               apps/landing/src/app/v/page.tsx (preview target)
//               ./_components/preview-client.tsx (client UI)
// ============================================

import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import { PreviewClient } from "./_components/preview-client";

type Props = {
  params: Promise<{ variantId: string }>;
};

export default async function PreviewPage({ params }: Props) {
  const { variantId } = await params;
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  return <PreviewClient variantId={variantId} />;
}
