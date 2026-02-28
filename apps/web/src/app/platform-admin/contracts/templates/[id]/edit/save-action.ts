"use server";

import { createAdminClient } from "@smartout/supabase/admin";
import { logPlatformAction } from "@/lib/platform-admin";

/**
 * Helper to access the contract_template table.
 * The table is new and not yet in database.types.ts — using type assertion.
 * Once migration is applied and types regenerated, replace with typed client.
 */
function getTemplateTable(admin: ReturnType<typeof createAdminClient>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (admin as any).from("contract_template") as {
    insert: (data: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    update: (data: Record<string, unknown>) => {
      eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
    };
  };
}

/**
 * Server action for saving contract template content.
 */
export async function saveTemplate(
  templateId: string,
  adminId: string,
  html: string,
): Promise<void> {
  const admin = createAdminClient();
  const table = getTemplateTable(admin);

  if (templateId === "new") {
    const { error } = await table.insert({
      name: "Ny kontraktsmal",
      content_html: html,
      contract_type: "client",
      language: "no",
      created_by: adminId,
    });

    if (error) {
      throw new Error(`Failed to create template: ${error.message}`);
    }

    await logPlatformAction(adminId, "create_template", "contract_template", null, {
      name: "Ny kontraktsmal",
    });
  } else {
    const { error } = await table
      .update({
        content_html: html,
        updated_at: new Date().toISOString(),
      })
      .eq("id", templateId);

    if (error) {
      throw new Error(`Failed to save template: ${error.message}`);
    }

    await logPlatformAction(adminId, "update_template", "contract_template", templateId, {
      action: "content_update",
    });
  }
}
