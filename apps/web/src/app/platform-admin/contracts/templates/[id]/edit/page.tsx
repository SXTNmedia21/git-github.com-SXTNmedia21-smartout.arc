import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect, notFound } from "next/navigation";
import { ContractEditor } from "@/components/contract-editor/contract-editor";
import { saveTemplate } from "./save-action";

type PageProps = {
  params: Promise<{ id: string }>;
};

/**
 * Template row shape — contract_template table is new and not yet in database.types.ts.
 * Once the migration is applied and types regenerated, replace this with the generated type.
 */
type ContractTemplateRow = {
  id: string;
  name: string;
  content_html: string | null;
  description: string | null;
  contract_type: string;
  language: string;
  accent_color: string | null;
  placeholders: unknown;
};

/**
 * Load a contract template by ID from the database.
 * Uses type assertion because contract_template is not yet in database.types.ts.
 */
async function loadTemplate(id: string): Promise<ContractTemplateRow | null> {
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from("contract_template")
    .select(
      "id, name, content_html, description, contract_type, language, accent_color, placeholders",
    )
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data as ContractTemplateRow;
}

export default async function ContractTemplateEditPage({ params }: PageProps) {
  const { id } = await params;
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  // For "new" templates, start with empty content
  if (id === "new") {
    const boundSave = saveTemplate.bind(null, "new", adminId);
    return (
      <div className="flex h-full flex-col">
        <ContractEditor
          templateId="new"
          templateName="Ny kontraktsmal"
          initialContent={DEFAULT_TEMPLATE_CONTENT}
          onSave={boundSave}
        />
      </div>
    );
  }

  // Load existing template
  const template = await loadTemplate(id);
  if (!template) {
    notFound();
  }

  const boundSave = saveTemplate.bind(null, template.id, adminId);

  return (
    <div className="flex h-full flex-col">
      <ContractEditor
        templateId={template.id}
        templateName={template.name}
        initialContent={template.content_html || DEFAULT_TEMPLATE_CONTENT}
        onSave={boundSave}
      />
    </div>
  );
}

const DEFAULT_TEMPLATE_CONTENT = `
<h1>Tjenesteavtale</h1>
<p>Denne avtalen er inngått mellom partene beskrevet nedenfor.</p>
`;
