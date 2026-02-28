import type { FastifyInstance } from "fastify";
import { supabase } from "../lib/supabase.js";
import { docuseal } from "../lib/docuseal.js";
import { resolvePlaceholders } from "../lib/placeholders.js";
import { scheduleReminders } from "../lib/reminders.js";
import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import { createContractSchema, listContractsQuery } from "../schemas/contracts.js";

export async function contractRoutes(app: FastifyInstance) {
  // List contracts
  app.get("/contracts", async (request, reply) => {
    const query = listContractsQuery.parse(request.query);
    let q = supabase.from("contract").select("*");

    if (query.workspace_id) q = q.eq("workspace_id", query.workspace_id);
    if (query.status) q = q.eq("status", query.status);
    if (query.contract_type) q = q.eq("contract_type", query.contract_type);
    if (query.recipient_email) q = q.eq("recipient_email", query.recipient_email);

    const { data, error } = await q.order("created_at", { ascending: false });
    if (error) return reply.status(500).send({ error: error.message });
    return data;
  });

  // Get contract with events
  app.get("/contracts/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const [contractResult, eventsResult] = await Promise.all([
      supabase.from("contract").select("*").eq("contract_id", id).single(),
      supabase.from("contract_event").select("*").eq("contract_id", id).order("created_at"),
    ]);

    if (contractResult.error) {
      return reply.status(404).send({ error: "Contract not found" });
    }

    return { ...contractResult.data, events: eventsResult.data ?? [] };
  });

  // Create contract from template
  app.post("/contracts", async (request, reply) => {
    const body = createContractSchema.parse(request.body);

    // Fetch template
    const { data: template, error: tplErr } = await supabase
      .from("contract_template")
      .select("*")
      .eq("template_id", body.template_id)
      .single();

    if (tplErr || !template) {
      return reply.status(404).send({ error: "Template not found" });
    }

    // Generate contract number
    const { data: numResult } = await supabase.rpc("generate_contract_number" as never);
    const contractNumber = (numResult as string) ?? `KONTRAKT-${new Date().getFullYear()}-000`;

    // Resolve placeholders
    const placeholders =
      (template.placeholders as Array<{
        key: string;
        label: string;
        source: string;
        default_value?: string;
        required: boolean;
      }>) ?? [];

    const { resolved_html, resolved_values } = await resolvePlaceholders(
      template.content_html ?? "",
      placeholders,
      body.workspace_id,
      { ...body.value_overrides, contract_number: contractNumber },
    );

    // Insert contract record
    const { data: contract, error: insertErr } = await supabase
      .from("contract")
      .insert({
        workspace_id: body.workspace_id,
        template_id: body.template_id,
        contract_type: body.contract_type,
        contract_number: contractNumber,
        title: `${template.name} - ${body.recipient_name}`,
        resolved_html,
        resolved_values,
        sender_name: config.SMARTOUT_COMPANY_NAME,
        sender_email: config.SMARTOUT_CONTACT_EMAIL,
        recipient_name: body.recipient_name,
        recipient_email: body.recipient_email,
        status: "draft",
        journey_type: body.journey_type,
        auto_create_workspace: body.auto_create_workspace,
        metadata: body.metadata,
      })
      .select()
      .single();

    if (insertErr) return reply.status(400).send({ error: insertErr.message });

    // Log creation event
    await supabase.from("contract_event").insert({
      contract_id: contract.contract_id,
      workspace_id: body.workspace_id,
      event_type: "created",
      actor_type: "user",
      actor_id: (request.headers["x-user-id"] as string) ?? "system",
    });

    return reply.status(201).send(contract);
  });

  // Send contract for signing
  app.post("/contracts/:id/send", async (request, reply) => {
    const { id } = request.params as { id: string };

    const { data: contract, error } = await supabase
      .from("contract")
      .select(
        "*, template:template_id(content_html, placeholders, header_html, footer_html, content_css, accent_color)",
      )
      .eq("contract_id", id)
      .single();

    if (error || !contract) {
      return reply.status(404).send({ error: "Contract not found" });
    }

    if (contract.status !== "draft") {
      return reply
        .status(400)
        .send({ error: `Cannot send contract in status: ${contract.status}` });
    }

    try {
      // Resolve placeholders if still unresolved (e.g. contract created by Next.js route
      // which stores raw template HTML without running resolvePlaceholders)
      let contractHtml = contract.resolved_html ?? "";
      const template = contract.template as {
        content_html: string | null;
        header_html: string | null;
        footer_html: string | null;
        content_css: string | null;
        accent_color: string | null;
        placeholders: Array<{
          key: string;
          label: string;
          source: string;
          default_value?: string;
          required: boolean;
        }> | null;
      } | null;

      if (contractHtml.includes("{{") && template?.placeholders?.length && contract.workspace_id) {
        // Fetch workspace + company for comprehensive placeholder resolution
        const { data: workspace } = await supabase
          .from("workspace")
          .select("*, company:company_id(*)")
          .eq("workspace_id", contract.workspace_id)
          .single();

        const company = workspace?.company as {
          name?: string;
          org_number?: string;
          email?: string;
        } | null;

        const overrides: Record<string, string> = {
          contract_number: contract.contract_number ?? "",
          recipient_name: contract.recipient_name ?? "",
          recipient_email: contract.recipient_email ?? "",
          kunde_navn: contract.recipient_name ?? company?.name ?? "",
          kunde_org: company?.org_number ?? "",
          kunde_epost: contract.recipient_email ?? company?.email ?? "",
          arbeidssted_navn: workspace?.name ?? "",
          arbeidssted_adresse: [workspace?.address_line_1, workspace?.postal_code, workspace?.city]
            .filter(Boolean)
            .join(", "),
        };

        const { resolved_html, resolved_values } = await resolvePlaceholders(
          template.content_html ?? contractHtml,
          template.placeholders,
          contract.workspace_id,
          overrides,
        );
        contractHtml = resolved_html;

        // Persist the resolved HTML so it doesn't need re-resolving
        await supabase
          .from("contract")
          .update({ resolved_html: contractHtml, resolved_values })
          .eq("contract_id", id);
      }

      // Transform Tiptap custom fields to DocuSeal HTML field tags
      const docusealHtml = contractHtml
        // Signature fields: <div data-type="signature-field" data-role="sender|recipient" ...>
        .replace(
          /<div\s+data-type="signature-field"\s+data-role="sender"[^>]*><\/div>/gi,
          '<signature-field name="Signatur Smartout" role="Leverandør" format="drawn_or_typed" required="true" style="width: 240px; height: 60px; display: inline-block;"> </signature-field>',
        )
        .replace(
          /<div\s+data-type="signature-field"\s+data-role="recipient"[^>]*><\/div>/gi,
          '<signature-field name="Signatur Kunde" role="Kunde" format="drawn_or_typed" required="true" style="width: 240px; height: 60px; display: inline-block;"> </signature-field>',
        )
        // Date fields: <span data-type="date-field" ...>...</span>
        .replace(
          /<span\s+data-type="date-field"[^>]*data-label="([^"]*)"[^>]*>[^<]*<\/span>/gi,
          '<date-field name="$1" role="Kunde" format="DD/MM/YYYY" required="false" style="width: 120px; height: 18px; display: inline-block;"> </date-field>',
        );

      // Build full HTML with template branding
      const accent = template?.accent_color ?? "#FF6B35";
      const fullHtml = `<!DOCTYPE html>
<html lang="no">
<head>
  <meta charset="UTF-8">
  <style>
    :root { --accent: ${accent}; --accent-light: ${accent}1a; }
    body { font-family: Inter, sans-serif; margin: 0; padding: 40px; color: #1a1a2e; }
    h1, h2, h3 { color: var(--accent); }
    .section-summary { color: #6b7280; font-style: italic; margin-bottom: 1em; }
    ${template?.content_css ?? ""}
  </style>
</head>
<body>
  ${template?.header_html ?? ""}
  ${docusealHtml}
  ${template?.footer_html ?? ""}
</body>
</html>`;

      // Create DocuSeal template from resolved HTML
      const dsTemplate = await docuseal.createTemplateFromHtml({
        html: fullHtml,
        name: contract.title ?? "Smartout Contract",
      });

      // Fallback to config values if sender/recipient not set on contract
      const senderEmail = contract.sender_email || config.SMARTOUT_CONTACT_EMAIL;
      const recipientEmail = contract.recipient_email;

      if (!recipientEmail) {
        return reply.status(400).send({ error: "Contract is missing recipient_email" });
      }

      // Generate signing token before submission so we can use it in the redirect URL
      const signingToken = randomUUID().replace(/-/g, "").slice(0, 24);

      // Create submission with two parties
      const submission = await docuseal.createSubmission({
        template_id: dsTemplate.id,
        send_email: true,
        completed_redirect_url: `${config.APP_URL}/sign/success?token=${signingToken}`,
        submitters: [
          {
            role: "Leverandør",
            email: senderEmail,
            completed: true, // Auto-sign Smartout party
          },
          {
            role: "Kunde",
            email: recipientEmail,
          },
        ],
      });

      // Extract signing URL for the client submitter
      const submitters = submission.submitters;
      const clientSubmitter = submitters.find((s) => s.role === "Kunde");

      const docusealEmbedUrl = clientSubmitter?.embed_src ?? clientSubmitter?.slug ?? null;

      const sentAt = new Date();

      // Update contract record
      await supabase
        .from("contract")
        .update({
          status: "sent",
          sent_at: sentAt.toISOString(),
          expires_at: new Date(sentAt.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          docuseal_submission_id: String(submitters[0]?.submission_id ?? dsTemplate.id),
          docuseal_submitter_id: clientSubmitter?.id ?? null,
          signing_url: signingToken,
          docuseal_embed_url: docusealEmbedUrl,
          updated_at: sentAt.toISOString(),
        })
        .eq("contract_id", id);

      // Log sent event
      await supabase.from("contract_event").insert({
        contract_id: id,
        workspace_id: contract.workspace_id,
        event_type: "sent",
        actor_type: "user",
        actor_id: (request.headers["x-user-id"] as string) ?? "system",
        details: { docuseal_template_id: dsTemplate.id },
      });

      // Schedule reminders (Task 13)
      await scheduleReminders(
        id,
        contract.workspace_id,
        contract.journey_type ?? "sales_assisted",
        sentAt,
      );

      return {
        contract_id: id,
        status: "sent",
        signing_url: signingToken,
        docuseal_embed_url: docusealEmbedUrl,
        expires_at: new Date(sentAt.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send contract";
      return reply.status(502).send({ error: message });
    }
  });

  // Cancel contract
  app.post("/contracts/:id/cancel", async (request, reply) => {
    const { id } = request.params as { id: string };

    const { data: contract, error } = await supabase
      .from("contract")
      .select("contract_id, status, workspace_id")
      .eq("contract_id", id)
      .single();

    if (error || !contract) {
      return reply.status(404).send({ error: "Contract not found" });
    }

    const cancellable = ["draft", "sent", "viewed"];
    if (!cancellable.includes(contract.status)) {
      return reply
        .status(400)
        .send({ error: `Cannot cancel contract in status: ${contract.status}` });
    }

    await supabase
      .from("contract")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("contract_id", id);

    // Cancel pending reminders
    await supabase
      .from("contract_reminder")
      .update({ status: "skipped", skip_reason: "contract_cancelled" })
      .eq("contract_id", id)
      .eq("status", "scheduled");

    // Log cancellation
    await supabase.from("contract_event").insert({
      contract_id: id,
      workspace_id: contract.workspace_id,
      event_type: "cancelled",
      actor_type: "user",
      actor_id: (request.headers["x-user-id"] as string) ?? "system",
    });

    return { contract_id: id, status: "cancelled" };
  });

  // Get contract events (audit trail)
  app.get("/contracts/:id/events", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { data, error } = await supabase
      .from("contract_event")
      .select("*")
      .eq("contract_id", id)
      .order("created_at");

    if (error) return reply.status(500).send({ error: error.message });
    return data;
  });
}
