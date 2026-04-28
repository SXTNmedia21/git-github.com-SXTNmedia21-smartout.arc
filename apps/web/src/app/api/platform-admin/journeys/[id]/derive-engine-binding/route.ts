// ============================================
// derive-engine-binding/route.ts — Engine-binding Runbook (HTTP wrapper)
//
// Thin auth-+-shape wrapper around the pure `runRunbook` in
// `@smartout/ai/journey-ops/runbook`. Both this route and the journey-ops
// agent tool delegate to the same pure function so the logic stays single-
// source.
//
// Connected to: packages/ai/src/journey-ops/runbook.ts
// Connected to: journey-edit-form.tsx (Kjør runbook button)
// ============================================

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { getServiceKey } from "@smartout/supabase/vault";
import { runRunbook } from "@smartout/ai/journey-ops/runbook";
import { getSuperAdminId } from "@/lib/platform-admin";

const uuidSchema = z.string().uuid();

type Props = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: Props) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid journey ID" }, { status: 400 });
  }

  const adminId = await getSuperAdminId();
  if (!adminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();

  let openrouterKey: string | null = null;
  try {
    openrouterKey = await getServiceKey(admin, "openrouter");
  } catch {
    openrouterKey = null;
  }

  const result = await runRunbook(admin, id, openrouterKey);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result);
}
