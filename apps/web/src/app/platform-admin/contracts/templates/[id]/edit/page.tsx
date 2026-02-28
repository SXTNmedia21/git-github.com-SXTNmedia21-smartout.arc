import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect, notFound } from "next/navigation";
import { TemplateEditor } from "@/components/contract-editor/template-editor";
import { saveTemplate } from "./save-action";
import type { PlaceholderItem } from "@/components/contract-editor/placeholder-panel";

type PageProps = {
  params: Promise<{ id: string }>;
};

const DEFAULT_TEMPLATE_CONTENT = `
<h1>Kontraktsmal</h1>
<p>Denne avtalen er inngatt mellom partene beskrevet nedenfor.</p>
<h2>1. Parter</h2>
<p>Arbeidsgiver: {{bedrift_navn}}</p>
<p>Arbeidstaker: {{ansatt_navn}}</p>
<h2>2. Stilling</h2>
<p>Arbeidstaker ansettes som {{stilling}} ved {{avdeling}}.</p>
<h2>3. Vilkar</h2>
<p>Tilleggsbetingelser kan legges til her.</p>
`;

const DEFAULT_PLACEHOLDERS: PlaceholderItem[] = [
  { key: "bedrift_navn", label: "Bedriftsnavn", source: "company", required: true },
  { key: "ansatt_navn", label: "Ansattnavn", source: "employee", required: true },
  { key: "stilling", label: "Stilling", source: "manual", required: true },
  { key: "avdeling", label: "Avdeling", source: "workspace", required: false },
];

async function loadTemplate(templateId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("contract_template")
    .select(
      "template_id, name, content_html, description, contract_type, language, placeholders, is_active, status",
    )
    .eq("template_id", templateId)
    .single();

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
            contract_type: "employee",
            content_html: DEFAULT_TEMPLATE_CONTENT,
            placeholders: DEFAULT_PLACEHOLDERS,
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
    parsedPlaceholders = template.placeholders as unknown as PlaceholderItem[];
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
        }}
        onSave={boundSave}
      />
    </div>
  );
}
