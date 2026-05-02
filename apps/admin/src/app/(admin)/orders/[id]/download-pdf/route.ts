// route.ts — GET /orders/[id]/download-pdf
//
// Auth + access guard → streamOrderPdf (501 stub until M6).
//
// Success path (M6): Content-Type: application/pdf + attachment filename.
// Current: returns 501 with explicit deferral message.

import { NextResponse, type NextRequest } from "next/server";
import { getAccountantUserId } from "@/lib/accountant";
import { createClient } from "@/lib/supabase/server";
import { hasAccountantAccess } from "@smartout/billing/accountant";
import { streamOrderPdf } from "@smartout/billing/server";
import { emit, nonEmpty } from "@smartout/telemetry";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const userId = await getAccountantUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  const { data: invoiceRow } = await supabase
    .from("invoice")
    .select("invoice_id, invoice_number, company_id")
    .eq("invoice_id", id)
    .maybeSingle();

  if (!invoiceRow) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const canAccess = await hasAccountantAccess(supabase as any, userId, invoiceRow.company_id);
  if (!canAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stream = await streamOrderPdf(supabase as any, id);
    const filename = `order_${invoiceRow.invoice_number ?? id}.pdf`;

    await emit({
      event: "order downloaded",
      actor_id: nonEmpty(userId, "actor_id"),
      workspace_id: null,
      properties: {
        entity: { entity_type: "invoice", entity_id: id },
        data: { invoice_id: id, format: "pdf" as const, trigger: "manual" as const },
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return new Response(
      "PDF generator wires in M6 — order-export.ts stub at packages/billing/src/server/order-export.ts. See blueprint §11 risk b.",
      {
        status: 501,
        headers: { "Content-Type": "text/plain" },
      },
    );
  }
}
