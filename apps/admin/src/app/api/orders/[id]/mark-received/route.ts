/**
 * route.ts — POST /api/orders/[id]/mark-received
 *
 * Stub — implemented in M3.
 * HTTP shell around markReceivedAction server action.
 * Allows non-React HTTP clients (curl, future integrations) to drive the mutation.
 */
import { NextResponse, type NextRequest } from "next/server";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // TODO M3: call markReceivedAction(id) from @/lib/orders/actions
  return NextResponse.json(
    { error: `mark-received for order ${id} not yet implemented`, stub: true },
    { status: 501 },
  );
}
