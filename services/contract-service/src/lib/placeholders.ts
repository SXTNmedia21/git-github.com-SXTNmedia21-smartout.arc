import { supabase } from "./supabase.js";
import { config } from "../config.js";

type PlaceholderDef = {
  key: string;
  label: string;
  source: string;
  default_value?: string;
  required: boolean;
};

export async function resolvePlaceholders(
  html: string,
  placeholders: PlaceholderDef[],
  workspaceId: string,
  overrides: Record<string, string>,
): Promise<{ resolved_html: string; resolved_values: Record<string, string> }> {
  const values: Record<string, string> = {};

  // Fetch workspace data
  const { data: workspace } = await supabase
    .from("workspace")
    .select("*, company:company_id(*)")
    .eq("workspace_id", workspaceId)
    .single();

  for (const p of placeholders) {
    // Priority: override > source lookup > default
    if (overrides[p.key]) {
      values[p.key] = overrides[p.key];
      continue;
    }

    switch (p.source) {
      case "workspace":
        values[p.key] = resolveWorkspaceField(workspace, p.key) ?? p.default_value ?? "";
        break;
      case "workspace.company":
        values[p.key] = resolveCompanyField(workspace?.company, p.key) ?? p.default_value ?? "";
        break;
      case "constant":
        values[p.key] = resolveConstant(p.key) ?? p.default_value ?? "";
        break;
      case "auto": {
        const autoVal = resolveAuto(p.key);
        values[p.key] = autoVal || overrides[p.key] || p.default_value || "";
        break;
      }
      case "manual":
        values[p.key] = overrides[p.key] ?? p.default_value ?? "";
        break;
      default:
        values[p.key] = p.default_value ?? "";
    }
  }

  // Replace all placeholders in HTML
  let resolved = html;
  for (const [key, value] of Object.entries(values)) {
    resolved = resolved.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }

  return { resolved_html: resolved, resolved_values: values };
}

function resolveWorkspaceField(
  workspace: Record<string, unknown> | null,
  key: string,
): string | null {
  if (!workspace) return null;
  const fieldMap: Record<string, string> = {
    client_address: "address_line_1",
    client_postal_code: "postal_code",
    client_city: "city",
  };
  const field = fieldMap[key] ?? key;
  return workspace[field] as string | null;
}

function resolveCompanyField(company: Record<string, unknown> | null, key: string): string | null {
  if (!company) return null;
  const fieldMap: Record<string, string> = {
    client_company_name: "name",
    client_org_number: "org_number",
  };
  const field = fieldMap[key] ?? key;
  return company[field] as string | null;
}

function resolveConstant(key: string): string | null {
  const constants: Record<string, string> = {
    smartout_company_name: config.SMARTOUT_COMPANY_NAME,
    smartout_org_number: config.SMARTOUT_ORG_NUMBER,
    smartout_contact_email: config.SMARTOUT_CONTACT_EMAIL,
    smartout_contact_name: "Pontus Johansson",
  };
  return constants[key] ?? null;
}

function resolveAuto(key: string): string {
  switch (key) {
    case "contract_date":
      return new Date().toLocaleDateString("no-NO");
    case "effective_date":
      return new Date().toLocaleDateString("no-NO");
    case "contract_number":
      // Sequence will be called via SQL
      return `KONTRAKT-${new Date().getFullYear()}-PENDING`;
    default:
      return "";
  }
}
