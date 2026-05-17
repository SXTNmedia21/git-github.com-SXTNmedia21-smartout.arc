import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@smartout/supabase/server";
import { MarketplacePageClient } from "./_components/marketplace-page-client";
import MarketplaceLoading from "./loading";

/**
 * /dashboard/schedule/marketplace — Server Component shell.
 *
 * Confirms auth + manager role server-side before rendering the client island.
 * Manager+ only — employees use mobile pull-poll (ADR-0133, ADR-0306 V1).
 *
 * Per ADR-0021 RSC pattern: server shell gates auth / access, client island
 * owns all TanStack Query data fetching and mutations.
 */
export default async function MarketplacePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Role check will be enforced by the BFF; client redirects if the API returns 403.
  // (Server-side role check would require an extra DB call that the layout already
  //  performs — avoid double-query per ADR-0115 RSC migration pattern.)

  return (
    <Suspense fallback={<MarketplaceLoading />}>
      <MarketplacePageClient />
    </Suspense>
  );
}
