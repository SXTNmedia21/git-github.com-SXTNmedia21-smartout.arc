// Platform-admin API for workspace pricing terms.
// Godmode-gated: only super-admins can read or write pricing terms.
// GET  — fetch current pricing terms for a workspace (effective_until IS NULL)
// POST — create a new pricing_terms row for a workspace
// PATCH — update existing pricing terms by pricing_terms_id

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireGodmode, logPlatformAction } from "@/lib/platform-admin";
import { emit } from "@smartout/telemetry";

// ── Validation schemas ────────────────────────────────────────────────────────

// Currency enum mirrors the database constraint — must stay in sync with the DB enum.
const CurrencyEnum = z.enum(["NOK", "SEK", "DKK", "EUR"]);

const CreateSchema = z.object({
  workspace_id: z.string().uuid(),
  company_id: z.string().uuid(),
  price_per_employee: z.number().nonnegative(),
  effective_from: z.string(), // ISO date string
  billing_interval: z.string().optional(),
  currency: CurrencyEnum.optional(),
  monthly_cost: z.number().nonnegative().nullable().optional(),
  discount_percent: z.number().min(0).max(100).nullable().optional(),
  discount_label: z.string().max(100).nullable().optional(),
  onboarding_package: z.string().max(100).nullable().optional(),
  onboarding_cost: z.number().nonnegative().nullable().optional(),
  trial_days: z.number().int().nonnegative().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  contract_id: z.string().uuid().nullable().optional(),
});

const UpdateSchema = z.object({
  pricing_terms_id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  price_per_employee: z.number().nonnegative().optional(),
  effective_from: z.string().optional(),
  billing_interval: z.string().optional(),
  currency: CurrencyEnum.optional(),
  monthly_cost: z.number().nonnegative().nullable().optional(),
  discount_percent: z.number().min(0).max(100).nullable().optional(),
  discount_label: z.string().max(100).nullable().optional(),
  onboarding_package: z.string().max(100).nullable().optional(),
  onboarding_cost: z.number().nonnegative().nullable().optional(),
  trial_days: z.number().int().nonnegative().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  contract_id: z.string().uuid().nullable().optional(),
});

// ── GET /api/platform-admin/pricing-terms?workspace_id=<uuid> ────────────────

export async function GET(req: NextRequest) {
  const auth = await requireGodmode();
  if (auth.error) return auth.error;

  const workspaceId = req.nextUrl.searchParams.get("workspace_id");
  if (!workspaceId) {
    return NextResponse.json({ error: "workspace_id is required" }, { status: 400 });
  }

  // Fetch the current (non-expired) pricing terms for this workspace.
  const { data, error } = await auth.admin
    .from("pricing_terms")
    .select("*")
    .eq("workspace_id", workspaceId)
    .is("effective_until", null)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

// ── POST /api/platform-admin/pricing-terms ───────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await requireGodmode();
  if (auth.error) return auth.error;

  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { workspace_id, ...fields } = parsed.data;

  const { data, error } = await auth.admin
    .from("pricing_terms")
    .insert({ workspace_id, ...fields })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logPlatformAction(
    auth.adminId,
    "pricing_terms_created",
    "pricing_terms",
    data.pricing_terms_id,
    {
      workspace_id,
      fields,
    },
  );

  void emit({
    event: "pricing terms updated",
    workspace_id,
    actor_id: auth.adminId,
    properties: {
      entity: { entity_type: "workspace", entity_id: workspace_id },
      data: { action: "created" },
    },
  });

  return NextResponse.json({ data }, { status: 201 });
}

// ── PATCH /api/platform-admin/pricing-terms ──────────────────────────────────

export async function PATCH(req: NextRequest) {
  const auth = await requireGodmode();
  if (auth.error) return auth.error;

  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { pricing_terms_id, workspace_id, ...fields } = parsed.data;

  // Only update fields that were actually provided — avoids accidentally nulling optional columns.
  const updates: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(fields)) {
    if (val !== undefined) updates[key] = val;
  }

  const { data, error } = await auth.admin
    .from("pricing_terms")
    .update(updates)
    .eq("pricing_terms_id", pricing_terms_id)
    .eq("workspace_id", workspace_id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logPlatformAction(
    auth.adminId,
    "pricing_terms_updated",
    "pricing_terms",
    pricing_terms_id,
    {
      workspace_id,
      fields: Object.keys(updates),
    },
  );

  void emit({
    event: "pricing terms updated",
    workspace_id,
    actor_id: auth.adminId,
    properties: {
      entity: { entity_type: "workspace", entity_id: workspace_id },
      data: { action: "updated", fields: Object.keys(updates) },
    },
  });

  return NextResponse.json({ data });
}
