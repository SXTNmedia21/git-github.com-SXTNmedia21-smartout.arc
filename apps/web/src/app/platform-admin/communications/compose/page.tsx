import { redirect } from "next/navigation";
import { getSuperAdminId } from "@/lib/platform-admin";
import { createAdminClient } from "@smartout/supabase/admin";
import { ComposePageClient } from "./_components/compose-page-client";

export default async function ComposePage() {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const admin = createAdminClient();
  const { data: savedTemplates } = await admin
    .from("platform_email_template" as never)
    .select("template_id, name, category, subject, sections, placeholders")
    .eq("is_active", true)
    .order("name");

  return (
    <ComposePageClient
      savedTemplates={
        (savedTemplates as Array<{
          template_id: string;
          name: string;
          category: string;
          subject: string;
          sections: unknown[];
          placeholders: unknown[];
        }>) ?? []
      }
    />
  );
}
