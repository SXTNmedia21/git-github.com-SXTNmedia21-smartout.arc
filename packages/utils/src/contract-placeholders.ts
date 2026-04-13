// ─── Types ────────────────────────────────────────

export type PlaceholderDef = {
  key: string;
  label: string;
  source: string;
  default_value?: string;
  required: boolean;
};

export type SmartoutConfig = {
  companyName: string;
  orgNumber: string;
  contactEmail: string;
  contactName: string;
};

// ─── Public API ───────────────────────────────────

/**
 * Build a flat map of placeholder key -> value from workspace and company data.
 * Pure function — no DB or config dependencies.
 *
 * Uses company as primary source for business identity fields (name, org_number,
 * daglig_leder), but falls back to workspace data when company fields are empty.
 * This handles cases where workspace has richer data than the parent company
 * (e.g., phone, email, address populated on workspace but not on company).
 */
export function buildAutofillMap(
  workspace: Record<string, unknown> | null,
  company: Record<string, unknown> | null,
  smartoutConfig: SmartoutConfig,
): Record<string, string> {
  const m: Record<string, string> = {};
  const str = (v: unknown) => (typeof v === "string" && v ? v : "");

  // Company / Kunde fields — with workspace fallback for shared fields
  const companyName = str(company?.name) || str(workspace?.name);
  const companyPhone = str(company?.phone) || str(workspace?.phone);
  const companyEmail = str(company?.email) || str(workspace?.email);
  const companyOrgNr = str(company?.org_number);
  const companyDagligLeder = str(company?.daglig_leder);
  const companyBillingEmail =
    str(company?.billing_email) || str(company?.invoice_email) || companyEmail;

  m.kunde_firma = companyName;
  m.kunde_org_nr = companyOrgNr;
  m.kunde_tlf = companyPhone;
  m.kunde_epost = companyEmail;
  m.kunde_faktura_epost = companyBillingEmail;
  m.kunde_daglig_leder = companyDagligLeder;

  // Legacy keys
  m.name_company = companyName;
  m.client_company_name = companyName;
  m.company_org_number = companyOrgNr;
  m.client_org_number = companyOrgNr;
  m.company_phone = companyPhone;
  m.company_email = companyEmail;

  // Workspace / Arbeidssted fields — with company fallback for address
  const addr = str(workspace?.address_line_1) || str(company?.address_line_1);
  const postal = str(workspace?.postal_code) || str(company?.postal_code);
  const city = str(workspace?.city) || str(company?.city);

  m.kunde_adresse = addr;
  m.kunde_postnr_sted = [postal, city].filter(Boolean).join(", ");
  m.company_street = addr;
  m.client_address = addr;
  m.company_zip_code = postal;
  m.client_postal_code = postal;
  m.workspace_city = city;
  m.client_city = city;

  // Smartout constants
  m.smartout_kontakt = smartoutConfig.contactName;
  m.smartout_tittel = "CEO";
  m.smartout_company_name = smartoutConfig.companyName;
  m.smartout_org_number = smartoutConfig.orgNumber;
  m.smartout_contact_email = smartoutConfig.contactEmail;
  m.smartout_contact_name = smartoutConfig.contactName;

  // Auto-generated
  m.current_date = new Date().toLocaleDateString("no-NO");
  m.contract_date = m.current_date;
  m.effective_date = m.current_date;

  return m;
}

/**
 * Replace placeholder tokens in HTML with resolved values.
 * Supports {{key}} mustache and <span data-type="placeholder-field" data-key="key"> formats.
 */
export function resolvePlaceholders(
  html: string,
  placeholders: PlaceholderDef[],
  autofillMap: Record<string, string>,
  overrides: Record<string, string>,
): { resolved_html: string; resolved_values: Record<string, string> } {
  const values: Record<string, string> = {};

  for (const p of placeholders) {
    const override = overrides[p.key];
    const autofill = autofillMap[p.key];
    if (override) {
      values[p.key] = override;
    } else if (autofill) {
      values[p.key] = autofill;
    } else {
      values[p.key] = p.default_value ?? "";
    }
  }

  let resolved = html;
  for (const [key, value] of Object.entries(values)) {
    if (!value) continue;

    // Mustache format: {{key}}
    resolved = resolved.replace(new RegExp(`\\{\\{${escapeRegex(key)}\\}\\}`, "g"), value);

    // HTML span format: <span data-type="placeholder-field" data-key="key">anything</span>
    resolved = resolved.replace(
      new RegExp(`(<span[^>]*data-key="${escapeRegex(key)}"[^>]*>)[^<]*(</span>)`, "gi"),
      `$1${escapeReplace(value)}$2`,
    );

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

// ─── Internal Helpers ─────────────────────────────

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeReplace(str: string): string {
  return str.replace(/\$/g, "$$$$");
}
