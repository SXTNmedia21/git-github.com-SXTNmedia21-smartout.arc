import { buildAutofillMap, resolvePlaceholders as resolveCore } from "@smartout/utils";
import type { PlaceholderDef, SmartoutConfig } from "@smartout/utils";
import { supabase } from "./supabase.js";
import { config } from "../config.js";

export type { PlaceholderDef };

const smartoutConfig: SmartoutConfig = {
  companyName: config.SMARTOUT_COMPANY_NAME,
  orgNumber: config.SMARTOUT_ORG_NUMBER,
  contactEmail: config.SMARTOUT_CONTACT_EMAIL,
  contactName: "Pontus S. Lindroth",
};

/**
 * Resolve placeholders by fetching workspace/company data from DB
 * and delegating to the shared pure utility.
 */
export async function resolvePlaceholders(
  html: string,
  placeholders: PlaceholderDef[],
  workspaceId: string,
  overrides: Record<string, string>,
): Promise<{ resolved_html: string; resolved_values: Record<string, string> }> {
  const { data: workspace } = await supabase
    .from("workspace")
    .select("*, company:company_id(*)")
    .eq("workspace_id", workspaceId)
    .single();

  const company = (workspace?.company ?? null) as Record<string, unknown> | null;
  const autofillMap = buildAutofillMap(workspace, company, smartoutConfig);

  return resolveCore(html, placeholders, autofillMap, overrides);
}
