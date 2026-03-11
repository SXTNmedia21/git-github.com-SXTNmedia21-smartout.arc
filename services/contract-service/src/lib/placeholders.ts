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

  // Fetch workspace + company data for autofill
  const { data: workspace } = await supabase
    .from("workspace")
    .select("*, company:company_id(*)")
    .eq("workspace_id", workspaceId)
    .single();

  const company = (workspace?.company ?? null) as Record<string, unknown> | null;

  // Build autofill map from workspace/company data
  const autofill = buildAutofillMap(workspace, company);

  for (const p of placeholders) {
    // Priority: override > autofill > source lookup > default
    if (overrides[p.key]) {
      values[p.key] = overrides[p.key];
    } else if (autofill[p.key]) {
      values[p.key] = autofill[p.key];
    } else {
      values[p.key] = p.default_value ?? "";
    }
  }

  // Replace in HTML — supports both formats:
  // 1. {{key}} mustache (legacy)
  // 2. <span data-type="placeholder-field" data-key="key" ...>default</span> (current)
  let resolved = html;
  for (const [key, value] of Object.entries(values)) {
    if (!value) continue;

    // Mustache format: {{key}}
    resolved = resolved.replace(new RegExp(`\\{\\{${escapeRegex(key)}\\}\\}`, "g"), value);

    // HTML span format: <span data-type="placeholder-field" data-key="key" ...>anything</span>
    resolved = resolved.replace(
      new RegExp(`(<span[^>]*data-key="${escapeRegex(key)}"[^>]*>)[^<]*(</span>)`, "gi"),
      `$1${escapeReplace(value)}$2`,
    );

    // Also handle <span class="value" data-type="placeholder-field" data-key="key" ...>
    resolved = resolved.replace(
      new RegExp(
        `(<span[^>]*data-type="placeholder-field"[^>]*data-key="${escapeRegex(key)}"[^>]*>)[^<]*(</span>)`,
        "gi",
      ),
      `$1${escapeReplace(value)}$2`,
    );
  }

  return { resolved_html: resolved, resolved_values: values };
}

/**
 * Build a flat map of placeholder key → value from workspace and company data.
 * This is the single source of truth for autofill.
 */
function buildAutofillMap(
  workspace: Record<string, unknown> | null,
  company: Record<string, unknown> | null,
): Record<string, string> {
  const m: Record<string, string> = {};
  const str = (v: unknown) => (typeof v === "string" && v ? v : "");

  // ── Company / Kunde fields ──
  if (company) {
    m.kunde_firma = str(company.name);
    m.kunde_org_nr = str(company.org_number);
    m.kunde_tlf = str(company.phone);
    m.kunde_epost = str(company.email);
    m.kunde_faktura_epost = str(company.invoice_email) || str(company.email);
    m.kunde_daglig_leder = str(company.contact_name);
    // Legacy keys
    m.name_company = str(company.name);
    m.client_company_name = str(company.name);
    m.company_org_number = str(company.org_number);
    m.client_org_number = str(company.org_number);
    m.company_phone = str(company.phone);
    m.company_email = str(company.email);
  }

  // ── Workspace / Arbeidssted fields ──
  if (workspace) {
    const addr = str(workspace.address_line_1);
    const postal = str(workspace.postal_code);
    const city = str(workspace.city);

    m.kunde_adresse = addr;
    m.kunde_postnr_sted = [postal, city].filter(Boolean).join(", ");
    // Legacy keys
    m.company_street = addr;
    m.client_address = addr;
    m.company_zip_code = postal;
    m.client_postal_code = postal;
    m.workspace_city = city;
    m.client_city = city;
  }

  // ── Smartout constants ──
  m.smartout_kontakt = "Pontus S. Lindroth";
  m.smartout_tittel = "CEO";
  m.smartout_company_name = config.SMARTOUT_COMPANY_NAME;
  m.smartout_org_number = config.SMARTOUT_ORG_NUMBER;
  m.smartout_contact_email = config.SMARTOUT_CONTACT_EMAIL;
  m.smartout_contact_name = "Pontus S. Lindroth";

  // ── Auto-generated ──
  m.current_date = new Date().toLocaleDateString("no-NO");
  m.contract_date = m.current_date;
  m.effective_date = m.current_date;

  return m;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeReplace(str: string): string {
  return str.replace(/\$/g, "$$$$");
}
