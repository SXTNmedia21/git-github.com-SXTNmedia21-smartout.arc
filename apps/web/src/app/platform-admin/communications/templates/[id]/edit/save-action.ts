"use server";

import { createAdminClient } from "@smartout/supabase/admin";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export type EmailTemplateSection = {
  id: string;
  type:
    | "title"
    | "message"
    | "image"
    | "list"
    | "html"
    | "footer"
    | "divider"
    | "button"
    | "card"
    | "hero_card"
    | "cta"
    | "video";
  content?: string;
  subtitle?: string;
  items?: string[];
  imageUrl?: string;
  imageAlt?: string;
  buttonText?: string;
  buttonUrl?: string;
  videoUrl?: string;
  videoThumbnailUrl?: string;
};

export type EmailTemplatePlaceholder = {
  key: string;
  label: string;
  defaultValue?: string;
};

export type SaveEmailTemplateData = {
  name: string;
  category: string;
  subject: string;
  sections: EmailTemplateSection[];
  placeholders: EmailTemplatePlaceholder[];
  status?: string;
};

export async function saveEmailTemplate(
  templateId: string,
  adminId: string,
  data: SaveEmailTemplateData,
): Promise<{ templateId: string }> {
  const admin = createAdminClient();

  const payload = {
    name: data.name,
    category: data.category,
    subject: data.subject,
    sections: data.sections,
    placeholders: data.placeholders,
    status: data.status ?? "draft",
    updated_at: new Date().toISOString(),
  };

  if (templateId === "new") {
    const { data: inserted, error } = await admin
      .from("platform_email_template")
      .insert({ ...payload, created_by: adminId })
      .select("template_id")
      .single();

    if (error) throw new Error(`Failed to create template: ${error.message}`);

    const newId = (inserted as { template_id: string }).template_id;

    revalidatePath("/platform-admin/communications/templates");
    redirect(`/platform-admin/communications/templates/${newId}/edit`);
  }

  const { error } = await admin
    .from("platform_email_template")
    .update(payload)
    .eq("template_id", templateId);

  if (error) throw new Error(`Failed to save template: ${error.message}`);

  revalidatePath("/platform-admin/communications/templates");
  return { templateId };
}
