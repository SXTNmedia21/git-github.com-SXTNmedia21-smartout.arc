/**
 * route.ts — GET /orders/[id]/download-pdf
 *
 * Stub — implemented in M3.
 * Proxy to invoice PDF generator (see blueprint §11 risk re: PDF generator existence).
 * Emits "order downloaded" telemetry.
 */
import { NextResponse, type NextRequest } from "next/server";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // TODO M3: call streamOrderPdf(client, id) from @smartout/billing/server
  return NextResponse.json(
    { error: `PDF download for order ${id} not yet implemented`, stub: true },
    { status: 501 },
  );
}
