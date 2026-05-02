/**
 * route.ts — GET /orders/[id]/download-csv
 *
 * Stub — implemented in M3.
 * Proxy to EHF-export CSV path.
 * Emits "order exported" telemetry.
 */
import { NextResponse, type NextRequest } from "next/server";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // TODO M3: call streamOrderCsv(client, id) from @smartout/billing/server
  return NextResponse.json(
    { error: `CSV export for order ${id} not yet implemented`, stub: true },
    { status: 501 },
  );
}
