import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import { EmailTemplateEditor } from "../../_components/email-template-editor";
import { saveEmailTemplate } from "./save-action";

type PageProps = {
  params: Promise<{ id: string }>;
};

const DEFAULT_SECTIONS = [
  {
    id: crypto.randomUUID(),
    type: "title" as const,
    content: "Velkommen til Smartout",
  },
  {
    id: crypto.randomUUID(),
    type: "message" as const,
    content: "<p>Skriv meldingen din her...</p>",
  },
  {
    id: crypto.randomUUID(),
    type: "footer" as const,
    content: "<p>Med vennlig hilsen<br/>Smartout-teamet</p>",
  },
];

const DEFAULT_PLACEHOLDERS = [
  { key: "recipient_name", label: "Mottakernavn", defaultValue: "" },
  { key: "company_name", label: "Bedriftsnavn", defaultValue: "" },
];

export default async function EditEmailTemplatePage({ params }: PageProps) {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const { id } = await params;
  const admin = createAdminClient();

  let initialData;

  if (id === "new") {
    initialData = {
      name: "",
      category: "custom",
      subject: "",
      sections: DEFAULT_SECTIONS,
      placeholders: DEFAULT_PLACEHOLDERS,
      status: "draft",
    };
  } else {
    const { data, error } = await admin
      .from("platform_email_template")
      .select("*")
      .eq("template_id", id)
      .single();

    if (error || !data) redirect("/platform-admin/communications/templates");

    initialData = {
      name: data.name,
      category: data.category,
      subject: data.subject,
      sections: (data.sections ?? []) as typeof DEFAULT_SECTIONS,
      placeholders: (data.placeholders ?? []) as typeof DEFAULT_PLACEHOLDERS,
      status: data.status,
    };
  }

  return (
    <EmailTemplateEditor
      templateId={id}
      initialData={initialData}
      onSave={saveEmailTemplate.bind(null, id, adminId)}
    />
  );
}
