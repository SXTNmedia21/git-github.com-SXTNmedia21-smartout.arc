import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect, notFound } from "next/navigation";
import { ContractEditor } from "./contract-editor";

export default async function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const admin = createAdminClient();

  const [contractResult, eventsResult, remindersResult] = await Promise.all([
    admin
      .from("contract")
      .select(
        `*,
         template:template_id (name, contract_type, content_html, content_css, placeholders, attachments),
         workspace:workspace_id (name, slug)`,
      )
      .eq("contract_id", id)
      .single(),
    admin
      .from("contract_event")
      .select("*")
      .eq("contract_id", id)
      .order("created_at", { ascending: false }),
    admin
      .from("contract_reminder")
      .select("*")
      .eq("contract_id", id)
      .order("scheduled_at", { ascending: true }),
  ]);

  const contract = contractResult.data;
  if (!contract) notFound();

  const template = contract.template as {
    name: string;
    contract_type: string;
    content_html: string | null;
    placeholders: Array<{
      key: string;
      label: string;
      source: string;
      default_value?: string;
      required: boolean;
    }> | null;
    content_css: string | null;
    attachments: Array<{
      id: string;
      title: string;
      content_html: string;
    }> | null;
  } | null;

  const workspace = contract.workspace as { name: string; slug: string } | null;

  const placeholders = template?.placeholders ?? [];
  const templateHtml = template?.content_html ?? contract.resolved_html ?? "";
  const attachments = template?.attachments ?? [];
  const contentCss = template?.content_css ?? "";

  return (
    <ContractEditor
      contract={{
        contract_id: contract.contract_id,
        title: contract.title,
        status: contract.status,
        contract_type: contract.contract_type,
        contract_number: contract.contract_number,
        journey_type: contract.journey_type,
        sender_name: contract.sender_name,
        sender_email: contract.sender_email,
        recipient_name: contract.recipient_name,
        recipient_email: contract.recipient_email,
        resolved_html: contract.resolved_html,
        resolved_values: (contract.resolved_values ?? {}) as Record<string, string>,
        created_at: contract.created_at,
        sent_at: contract.sent_at,
        viewed_at: contract.viewed_at,
        signed_at: contract.signed_at,
        declined_at: contract.declined_at,
        decline_reason: contract.decline_reason,
        expires_at: contract.expires_at,
        signing_url: contract.signing_url,
        signed_pdf_url: contract.signed_pdf_url,
        audit_log_url: contract.audit_log_url,
        document_url: contract.document_url,
        docuseal_submission_id: contract.docuseal_submission_id,
        workspace,
        template: template
          ? {
              name: template.name,
              contract_type: template.contract_type,
              content_html: template.content_html,
            }
          : null,
      }}
      placeholders={placeholders}
      templateHtml={templateHtml}
      attachments={attachments}
      contentCss={contentCss}
      events={
        (eventsResult.data ?? []) as Array<{
          id: string;
          event_type: string;
          actor_type: string;
          actor_id: string | null;
          details: Record<string, unknown> | null;
          created_at: string;
        }>
      }
      reminders={
        (remindersResult.data ?? []) as Array<{
          id: string;
          reminder_type: string;
          template_key: string;
          scheduled_at: string;
          sent_at: string | null;
          status: string | null;
        }>
      }
    />
  );
}
