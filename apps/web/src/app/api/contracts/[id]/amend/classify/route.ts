/**
 * POST /api/contracts/[id]/amend/classify — dry-run field change classification.
 *
 * What: Classifies field changes without writing to DB. Returns classification
 *       results for preview UI (WS2F AmendmentSection "Forhåndsvis endringer").
 *
 * Why: Allows the amendment UI to show MATERIAL/ADMIN badges and constructive
 *      dismissal risk before admin commits the amendment.
 *
 * ADR-0151: workspace_id resolved from JWT.
 * No telemetry — this is a read-only dry run.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@smartout/supabase/server";
import { classifyBatch } from "@smartout/contracts";

const FieldChangeSchema = z.object({
  column: z.string().min(1),
  from: z.unknown(),
  to: z.unknown(),
});

const ClassifyBodySchema = z.object({
  field_changes: z.array(FieldChangeSchema).min(1),
});

export async function POST(
  request: Request,
  { params: _params }: { params: Promise<{ id: string }> },
) {
  // Auth (ADR-0151).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ClassifyBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { field_changes } = parsed.data;

  const changesRecord: Record<string, { from: unknown; to: unknown }> = {};
  for (const fc of field_changes) {
    changesRecord[fc.column] = { from: fc.from, to: fc.to };
  }

  const classification = classifyBatch(changesRecord);

  return NextResponse.json({
    requires_employee_signature: classification.requires_employee_signature,
    is_constructive_dismissal_risk: classification.is_constructive_dismissal_risk,
    worst_classification: classification.worst_classification,
    classifications: classification.changes.map(
      (c: {
        column: string;
        classification: string;
        requires_employee_signature: boolean;
        is_constructive_dismissal_risk: boolean;
        label_nb: string;
      }) => ({
        column: c.column,
        classification: c.classification,
        requires_employee_signature: c.requires_employee_signature,
        is_constructive_dismissal_risk: c.is_constructive_dismissal_risk,
        label_nb: c.label_nb,
      }),
    ),
    material_fields: classification.material_fields,
    admin_fields: classification.admin_fields,
  });
}
