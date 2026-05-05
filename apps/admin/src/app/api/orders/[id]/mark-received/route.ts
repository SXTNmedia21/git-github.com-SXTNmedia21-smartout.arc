// route.ts — POST /api/orders/[id]/mark-received
//
// HTTP shell around markReceivedAction. Accepts JSON body, validates with Zod,
// calls the action, returns the result or a typed error response.
//
// Status codes:
//   200 — success: { invoice_id, payment_id, status: "paid" }
//   400 — invalid body (Zod parse failure)
//   401 — not authenticated
//   403 — authenticated but no active grant for this company
//   404 — invoice not found or RLS denied read
//   409 — invoice is not in a markable status (issued | sent | overdue)
//   500 — unexpected server error

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { markReceivedAction } from "@/lib/orders/actions";

const BodySchema = z.object({
  paid_at: z.string().date(),
  paid_amount: z.number().positive(),
  note: z.string().max(200).optional(),
});

const ERROR_STATUS: Record<string, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Parse + validate body.
  let body: z.infer<typeof BodySchema>;
  try {
    const raw = await request.json();
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.issues },
        { status: 400 },
      );
    }
    body = parsed.data;
  } catch {
    return NextResponse.json({ error: "Malformed JSON body" }, { status: 400 });
  }

  try {
    const result = await markReceivedAction(id, body);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";

    // Map known error codes to HTTP status.
    const status = ERROR_STATUS[message] ?? 500;

    if (status === 500) {
      console.error("[api/orders/mark-received] unexpected error:", err);
    }

    return NextResponse.json({ error: message }, { status });
  }
}
