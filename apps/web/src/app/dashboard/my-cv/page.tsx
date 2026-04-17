import { Suspense } from "react";
import { redirect } from "next/navigation";
import { FEATURE_FLAGS } from "@/lib/feature-flags";
import { MyCvPageClient } from "./_components/my-cv-page-client";
import MyCvLoading from "./loading";

/**
 * /dashboard/my-cv — Server Component shell.
 * Feature-flag gate runs server-side (no client JS for the redirect).
 * A single Suspense boundary wraps the client surface per ADR-0115.
 */
export default function MyCvPage() {
  if (!FEATURE_FLAGS.MY_CV) {
    redirect("/dashboard");
  }

  return (
    <Suspense fallback={<MyCvLoading />}>
      <MyCvPageClient />
    </Suspense>
  );
}
