/**
 * POST /api/employment-contracts — Compose a contract draft proposal.
 *
 * Validates the request body, calls resolveComposition to derive employment
 * terms from cascade dimensions (D2 profile, K1a framework rules, K1b binding),
 * and returns the ContractDraftProposal as JSON.
 *
 * ADR-0076: composition as cascade derivation.
 */

import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { z } from "zod";
import { resolveComposition } from "@/lib/contracts/resolve-composition";

const composeSchema = z.object({
  workspace_id: z.string().uuid(),
  profile_id: z.string().uuid(),
  template_id: z.string().uuid().optional(),
});

// ---------------------------------------------------------------------------
// POST /api/employment-contracts
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = composeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { workspace_id, profile_id, template_id } = parsed.data;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const proposal = await resolveComposition(supabase, workspace_id, profile_id, template_id);

    return NextResponse.json(proposal);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
