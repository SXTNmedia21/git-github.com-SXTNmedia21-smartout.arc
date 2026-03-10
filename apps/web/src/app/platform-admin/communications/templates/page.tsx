import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import { TemplateListClient } from "./_components/template-list-client";

export default async function EmailTemplatesPage() {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const admin = createAdminClient();

  const { data: templates } = await admin
    .from("platform_email_template")
    .select("template_id, name, category, subject, status, is_active, created_at, updated_at")
    .order("updated_at", { ascending: false });

  return (
    <div className="space-y-6">
      <TemplateListClient templates={(templates as TemplateRow[]) ?? []} />
    </div>
  );
}

type TemplateRow = {
  template_id: string;
  name: string;
  category: string;
  subject: string;
  status: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
