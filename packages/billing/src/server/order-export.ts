import "server-only";

// server/order-export.ts — PDF and CSV streaming stubs.
//
// PDF/CSV export implementation status (research findings 2026-05-02):
//
// PDF: No PDF invoice generator exists anywhere in the codebase. The
// existing EHF-export (packages/billing/src/actions/ehf-export/generateEhfExport.ts)
// explicitly blocks PDF requests with code "format_not_supported_yet"
// and a comment "PDF-builder kommer i B4". No supabase/functions/*pdf*
// edge function exists. No react-pdf / puppeteer / pdf-lib dependency
// is present in any package.json.
//
// CSV: The existing generateEhfExport() produces a batch monthly CSV
// grouped by period + company — NOT a per-invoice download. A
// per-invoice CSV is also not implemented anywhere.
//
// DECISION: Stub both functions to throw with a clear error.
// M5/M6 must wire a real PDF generator and per-invoice CSV endpoint.
// This prevents apps/admin's download-pdf/download-csv route handlers
// from silently shipping broken downloads.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@smartout/supabase";

type BillingClient = SupabaseClient<Database>;

/**
 * Stream a PDF representation of a single invoice.
 *
 * TODO(M5): Wire a real PDF generator here. Options to evaluate:
 * - Supabase Edge Function `generate-invoice-pdf` (recommended — keeps
 *   heavy deps out of the Next.js bundle).
 * - React-pdf (Remotion already in repo; reuse pattern).
 * - Puppeteer + Vercel serverless.
 *
 * The route handler at apps/admin/src/app/(admin)/orders/[id]/download-pdf/route.ts
 * expects a ReadableStream<Uint8Array> or a Response; update the stub
 * once a generator is available.
 *
 * @throws Always — placeholder until M5 implements the PDF generator.
 */
export async function streamOrderPdf(
  _client: BillingClient,
  invoiceId: string,
): Promise<ReadableStream<Uint8Array>> {
  // TODO(M5/M6): implement PDF generator. See module comment above.
  throw new Error(
    `streamOrderPdf: PDF generator not implemented. ` +
      `M5/M6 must wire PDF generator — placeholder from M3. ` +
      `invoice_id=${invoiceId}`,
  );
}

/**
 * Stream a CSV representation of a single invoice.
 *
 * TODO(M5): Wire a per-invoice CSV generator. The existing
 * generateEhfExport() in packages/billing/src/actions/ehf-export/
 * produces batch monthly CSV files grouped by period — NOT per-invoice.
 * A per-invoice CSV (invoice header + line items as rows) needs to be
 * built from scratch or adapted from the batch exporter.
 *
 * The route handler at apps/admin/src/app/(admin)/orders/[id]/download-csv/route.ts
 * expects a ReadableStream<Uint8Array>; update the stub once implemented.
 *
 * @throws Always — placeholder until M5 implements per-invoice CSV.
 */
export async function streamOrderCsv(
  _client: BillingClient,
  invoiceId: string,
): Promise<ReadableStream<Uint8Array>> {
  // TODO(M5/M6): implement per-invoice CSV. See module comment above.
  throw new Error(
    `streamOrderCsv: per-invoice CSV not implemented. ` +
      `M5/M6 must wire CSV generator — placeholder from M3. ` +
      `invoice_id=${invoiceId}`,
  );
}
