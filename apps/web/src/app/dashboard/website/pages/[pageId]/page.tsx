import { redirect } from "next/navigation";
import { createClient } from "@smartout/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import SectionEditor from "../../_components/SectionEditor";

/** Service-role client for websites schema — required because websites.* is not in RLS-accessible public schema. */
function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export default async function PageEditorPage({ params }: { params: Promise<{ pageId: string }> }) {
  const { pageId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = getAdminClient();

  // Fetch page to get its parent websiteId for auth and editor context
  const { data: page } = await admin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .schema("websites" as "public") // SAFETY: websites is a valid Postgres schema not represented as "public" in Supabase client types
    .from("website_page")
    .select("website_id, title")
    .eq("website_page_id", pageId)
    .is("deleted_at", null)
    .single();

  if (!page) redirect("/dashboard/website");

  const { website_id: websiteId, title } = page as { website_id: string; title: string };

  return <SectionEditor pageId={pageId} websiteId={websiteId} pageTitle={title} />;
}
