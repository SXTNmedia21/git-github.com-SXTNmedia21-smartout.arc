import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect, notFound } from "next/navigation";
import { TemplateEditor } from "@/components/contract-editor/template-editor-dynamic";
import { saveTemplate } from "./save-action";
import type { PlaceholderItem } from "@/components/contract-editor/placeholder-panel";
import type { TemplateAttachment } from "./save-action";

type PageProps = {
  params: Promise<{ id: string }>;
};

const DEFAULT_TEMPLATE_CONTENT = `
<h1>Ny kontraktsmal</h1>
<div data-type="clause-block" data-clause-id="parter" data-title="Parter" data-category="parties" data-collapsed="false">
<p><strong>Selger:</strong> Smartout AS (org.nr. 929 620 291)</p>
<p><strong>Kunde:</strong> {{kunde_navn}} (org.nr. {{kunde_org_nr}})</p>
</div>
<div data-type="clause-block" data-clause-id="leveranser" data-title="Leveranser" data-category="deliverables" data-collapsed="false">
<p>Beskriv leveransene her...</p>
</div>
<div data-type="clause-block" data-clause-id="priser" data-title="Priser og vilkar" data-category="pricing" data-collapsed="false">
<p>Prisdetaljer her...</p>
</div>
<div data-type="clause-block" data-clause-id="signatur" data-title="Signaturer" data-category="signatures" data-collapsed="false">
<p>Denne avtalen er gyldig nar begge parter har signert.</p>
<div data-type="signature-field" data-role="sender" data-label="Signatur Smartout" data-required="true"></div>
<div data-type="signature-field" data-role="recipient" data-label="Signatur Kunde" data-required="true"></div>
</div>
`;

const DEFAULT_PLACEHOLDERS: PlaceholderItem[] = [
  { key: "kunde_navn", label: "Kundenavn", source: "manual", required: true },
  { key: "kunde_org_nr", label: "Org.nr. kunde", source: "manual", required: true },
  { key: "kunde_kontakt", label: "Kontaktperson kunde", source: "manual", required: true },
  { key: "kunde_epost", label: "E-post kunde", source: "manual", required: false },
];

type TemplateRow = {
  template_id: string;
  name: string;
  content_html: string | null;
  description: string | null;
  contract_type: string;
  language: string | null;
  placeholders: unknown;
  is_active: boolean | null;
  status: string | null;
  attachments: unknown;
};

async function loadTemplate(templateId: string) {
  const admin = createAdminClient();
  // attachments column added by migration 20260228210000 — use type assertion until types are regenerated
  const { data, error } = (await admin
    .from("contract_template")
    .select(
      "template_id, name, content_html, description, contract_type, language, placeholders, is_active, status, attachments",
    )
    .eq("template_id", templateId)
    .single()) as unknown as { data: TemplateRow | null; error: { message: string } | null }; // SAFETY: Supabase join returns union type; runtime shape matches the cast

  if (error || !data) return null;
  return data;
}

export default async function ContractTemplateEditPage({ params }: PageProps) {
  const { id } = await params;
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  if (id === "new") {
    const boundSave = saveTemplate.bind(null, "new", adminId);
    return (
      <div className="flex h-full flex-col">
        <TemplateEditor
          templateId="new"
          initialData={{
            name: "Ny kontraktsmal",
            contract_type: "client",
            content_html: DEFAULT_TEMPLATE_CONTENT,
            placeholders: DEFAULT_PLACEHOLDERS,
            description: "",
            language: "no",
            status: "draft",
            attachments: [],
          }}
          onSave={boundSave}
        />
      </div>
    );
  }

  const template = await loadTemplate(id);
  if (!template) notFound();

  const boundSave = saveTemplate.bind(null, template.template_id, adminId);

  // Parse placeholders from JSON — default to empty array
  let parsedPlaceholders: PlaceholderItem[] = [];
  if (Array.isArray(template.placeholders)) {
    parsedPlaceholders = template.placeholders as unknown as PlaceholderItem[]; // SAFETY: Supabase join returns union type; runtime shape matches the cast
  }

  // Parse attachments from JSON — default to empty array
  let parsedAttachments: TemplateAttachment[] = [];
  if (Array.isArray(template.attachments)) {
    parsedAttachments = template.attachments as unknown as TemplateAttachment[]; // SAFETY: Supabase join returns union type; runtime shape matches the cast
  }

  return (
    <div className="flex h-full flex-col">
      <TemplateEditor
        templateId={template.template_id}
        initialData={{
          name: template.name,
          contract_type: template.contract_type,
          content_html: template.content_html || DEFAULT_TEMPLATE_CONTENT,
          placeholders: parsedPlaceholders,
          description: template.description || "",
          language: template.language || "no",
          status: template.status || "draft",
          attachments: parsedAttachments,
        }}
        onSave={boundSave}
      />
    </div>
  );
}
