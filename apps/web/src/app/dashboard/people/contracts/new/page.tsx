"use client";

/**
 * /dashboard/people/contracts/new — deprecated route, retained as a thin redirect
 * so bookmarks don't 404 after the Phase 2 hub redesign.
 *
 * The composition flow now lives as a drawer on the hub at
 * `/dashboard/people/contracts?open=compose`. Any `profileId` query param is
 * forwarded so `Lag kontrakt` links from an employee profile continue to
 * prefill the recipient.
 */

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function NewContractRedirectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("open", "compose");
    const profileId = searchParams.get("profileId");
    if (profileId) params.set("profileId", profileId);
    router.replace(`/dashboard/people/contracts?${params.toString()}`);
  }, [router, searchParams]);

  // Minimal surface — users land here for a frame or two before the redirect.
  return null;
}
