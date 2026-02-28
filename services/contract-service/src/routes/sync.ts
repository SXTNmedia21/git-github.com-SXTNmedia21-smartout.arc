import type { FastifyInstance } from "fastify";
import { supabase } from "../lib/supabase.js";
import { docuseal } from "../lib/docuseal.js";

export async function syncRoutes(app: FastifyInstance) {
  // Sync template to DocuSeal
  app.post("/templates/:id/sync", async (request, reply) => {
    const { id } = request.params as { id: string };

    // Fetch template
    const { data: template, error } = await supabase
      .from("contract_template")
      .select("*")
      .eq("template_id", id)
      .single();

    if (error || !template) {
      return reply.status(404).send({ error: "Template not found" });
    }

    if (!template.content_html) {
      return reply.status(400).send({ error: "Template has no HTML content" });
    }

    try {
      // Build full HTML with header, content, footer
      const fullHtml = buildTemplateHtml(template);

      // Push to DocuSeal
      const dsTemplate = await docuseal.createTemplateFromHtml({
        html: fullHtml,
        name: `${template.name} (${template.language})`,
      });

      // Update Smartout record with DocuSeal ID
      await supabase
        .from("contract_template")
        .update({
          docuseal_template_id: dsTemplate.id,
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("template_id", id);

      return {
        template_id: id,
        docuseal_template_id: dsTemplate.id,
        synced_at: new Date().toISOString(),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "DocuSeal sync failed";
      return reply.status(502).send({ error: message });
    }
  });

  // Preview template as PDF (without creating DocuSeal template)
  app.post("/templates/:id/preview", async (request, reply) => {
    const { id } = request.params as { id: string };
    const overrides = (request.body as Record<string, string>) ?? {};

    const { data: template, error } = await supabase
      .from("contract_template")
      .select("*")
      .eq("template_id", id)
      .single();

    if (error || !template) {
      return reply.status(404).send({ error: "Template not found" });
    }

    // Resolve placeholders with overrides
    let html = template.content_html ?? "";
    const placeholders =
      (template.placeholders as Array<{ key: string; default_value?: string }>) ?? [];

    for (const p of placeholders) {
      const value = overrides[p.key] ?? p.default_value ?? `[${p.key}]`;
      html = html.replace(new RegExp(`\\{\\{${p.key}\\}\\}`, "g"), value);
    }

    return { html, template_id: id };
  });
}

function buildTemplateHtml(template: {
  content_html: string | null;
  content_css: string | null;
  header_html: string | null;
  footer_html: string | null;
  accent_color: string | null;
}): string {
  const css = template.content_css ?? "";
  const accent = template.accent_color ?? "#FF6B35";

  return `<!DOCTYPE html>
<html lang="no">
<head>
  <meta charset="UTF-8">
  <style>
    :root { --accent: ${accent}; --accent-light: ${accent}1a; }
    body { font-family: Inter, sans-serif; margin: 0; padding: 40px; color: #1a1a2e; }
    h1, h2, h3 { color: var(--accent); }
    .section-summary { color: #6b7280; font-style: italic; margin-bottom: 1em; }
    ${css}
  </style>
</head>
<body>
  ${template.header_html ?? ""}
  ${template.content_html ?? ""}
  ${template.footer_html ?? ""}
</body>
</html>`;
}
