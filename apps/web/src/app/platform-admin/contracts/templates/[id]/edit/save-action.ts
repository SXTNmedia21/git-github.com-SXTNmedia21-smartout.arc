"use server";

import { createAdminClient } from "@smartout/supabase/admin";
import { logPlatformAction } from "@/lib/platform-admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Json } from "@smartout/supabase";

export type PlaceholderItem = {
  key: string;
  label: string;
  source: string;
  default_value?: string;
  required: boolean;
};

export type SaveTemplateData = {
  name: string;
  contract_type: string;
  content_html: string;
  placeholders: PlaceholderItem[];
};

/**
 * Server action for saving a contract template.
 * Handles both create (templateId === "new") and update.
 * PK is `template_id` — NOT `id`.
 */
export async function saveTemplate(
  templateId: string,
  adminId: string,
  data: SaveTemplateData,
): Promise<{ templateId: string }> {
  const admin = createAdminClient();

  if (templateId === "new") {
    const { data: row, error } = await admin
      .from("contract_template")
      .insert({
        name: data.name,
        content_html: data.content_html,
        contract_type: data.contract_type,
        template_type: "standard",
        language: "no",
        locale: "nb-NO",
        status: "draft",
        is_active: false,
        placeholders: data.placeholders as unknown as Json,
        created_by: adminId,
      })
      .select("template_id")
      .single();

    if (error) {
      throw new Error(`Failed to create template: ${error.message}`);
    }

    await logPlatformAction(adminId, "create_template", "contract_template", row.template_id, {
      name: data.name,
      contract_type: data.contract_type,
    });

    revalidatePath("/platform-admin/contracts/templates");
    redirect(`/platform-admin/contracts/templates/${row.template_id}/edit`);
  }

  // Update existing template
  const { error } = await admin
    .from("contract_template")
    .update({
      name: data.name,
      content_html: data.content_html,
      contract_type: data.contract_type,
      placeholders: data.placeholders as unknown as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("template_id", templateId);

  if (error) {
    throw new Error(`Failed to save template: ${error.message}`);
  }

  await logPlatformAction(adminId, "update_template", "contract_template", templateId, {
    name: data.name,
    contract_type: data.contract_type,
  });

  revalidatePath("/platform-admin/contracts/templates");
  revalidatePath(`/platform-admin/contracts/templates/${templateId}/edit`);

  return { templateId };
}
