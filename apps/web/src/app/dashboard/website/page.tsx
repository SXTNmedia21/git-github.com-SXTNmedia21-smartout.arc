import { redirect } from "next/navigation";
import { createClient } from "@smartout/supabase/server";
import WebsiteOverview from "./_components/WebsiteOverview";

/**
 * Website overview page — server shell that confirms auth, then hands off to
 * the client component which handles the "no website yet" state via useWebsite.
 */
export default async function WebsitePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <WebsiteOverview />;
}
