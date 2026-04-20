import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@smartout/supabase/server";
import WebsiteOverview from "./_components/WebsiteOverview";
import WebsiteLoading from "./loading";

/**
 * /dashboard/website — Server Component shell.
 *
 * Confirms auth server-side, then hands off to the client island
 * inside a Suspense boundary. Initial "no website yet" and data-fetch
 * states are handled by the client via `useWebsite`. Per ADR-0115
 * RSC migration pattern.
 */
export default async function WebsitePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <Suspense fallback={<WebsiteLoading />}>
      <WebsiteOverview />
    </Suspense>
  );
}
