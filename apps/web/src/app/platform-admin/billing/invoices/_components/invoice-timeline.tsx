import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  FileText,
  MessageSquare,
  Send,
  XCircle,
} from "lucide-react";
import { createAdminClient } from "@smartout/supabase/admin";

// InvoiceTimeline — reads from billing_activity_log (ADR-0125; the
// dunning-audit surface that supersedes the original activity_trail
// routing in ADR-0118).
//
// Phase 6.4 of Billing Engine Fase 1. Server Component — hits the DB
// directly via createAdminClient and renders into the detail page's
// Historikk tab. Query uses the invoice_id FK (indexed) so rendering
// is cheap even for long-running customer invoices.

const EVENT_ICONS: Record<string, typeof FileText> = {
  "invoice generated": FileText,
  "invoice issued": Send,
  "invoice sent": Send,
  "invoice marked_paid": CheckCircle2,
  "invoice overdue_detected": AlertTriangle,
  "invoice voided": Ban,
  "invoice credit_note_issued": XCircle,
  "invoice basis_drift_detected": AlertTriangle,
  "dunning_note added": MessageSquare,
};

type BillingLogRow = {
  id: number;
  event: string;
  data: Record<string, unknown> | null;
  actor_user_id: string | null;
  created_at: string;
};

export async function InvoiceTimeline({ invoiceId }: { invoiceId: string }) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("billing_activity_log")
    .select("id, event, data, actor_user_id, created_at")
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[InvoiceTimeline] query failed:", error);
    return <p className="text-muted-foreground">Kunne ikke hente historikk. Prøv igjen.</p>;
  }

  const events = (data ?? []) as BillingLogRow[];

  if (events.length === 0) {
    return <p className="text-muted-foreground">Ingen hendelser registrert enda.</p>;
  }

  return (
    <ol className="border-border/40 relative ml-4 space-y-4 border-l">
      {events.map((e) => {
        const Icon = EVENT_ICONS[e.event] ?? FileText;
        return (
          <li key={e.id} className="relative pl-6">
            <span className="bg-background border-border/60 absolute top-0 -left-3 rounded-full border p-1">
              <Icon className="h-3 w-3" aria-hidden />
            </span>
            <time className="text-muted-foreground text-xs">
              {new Date(e.created_at).toLocaleString("nb-NO")}
            </time>
            <p className="font-medium">{formatEvent(e.event, e.data)}</p>
          </li>
        );
      })}
    </ol>
  );
}

function formatEvent(event: string, data: Record<string, unknown> | null): string {
  const d = data ?? {};
  switch (event) {
    case "invoice generated":
      return "Fakturagrunnlag generert";
    case "invoice issued": {
      const amount = d.amount_incl_vat;
      return typeof amount === "number"
        ? `Faktura utstedt (kr ${amount.toLocaleString("nb-NO")})`
        : "Faktura utstedt";
    }
    case "invoice sent":
      return "Faktura sendt til kunde";
    case "invoice marked_paid": {
      const channel = d.payment_channel;
      return typeof channel === "string" ? `Merket som betalt (${channel})` : "Merket som betalt";
    }
    case "invoice voided": {
      const reason = d.reason_detail ?? d.reason;
      return typeof reason === "string" ? `Annullert: ${reason}` : "Annullert";
    }
    case "invoice overdue_detected": {
      const days = d.days_overdue;
      return typeof days === "number" ? `Forfalt (${days} dager)` : "Forfalt";
    }
    case "invoice credit_note_issued":
      return "Kreditnota utstedt";
    case "invoice basis_drift_detected":
      return "Grunnlag-drift oppdaget";
    case "dunning_note added": {
      const note = d.note;
      return typeof note === "string" ? `Notat: ${note}` : "Purringsnotat";
    }
    default:
      return event;
  }
}
