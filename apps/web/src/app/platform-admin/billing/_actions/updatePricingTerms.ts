"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@smartout/supabase/admin";
import { UpdatePricingTermsInputSchema } from "@smartout/billing";
import { emit } from "@smartout/telemetry";
import { getSuperAdminId } from "@/lib/platform-admin";

// Phase 7.6 — updatePricingTerms
//
// Pricing_terms is a time-sliced table: every row represents the
// terms that govern billing between effective_from and
// effective_until. Updating pricing means:
//
//   1. Closing the currently-active row for (company, workspace?) by
//      setting its effective_until to today - 1 day.
//   2. Inserting a new row with effective_from = input.effective_from.
//
// We never mutate a historical row's amounts — ADR-0120 intent.
// Invoices issued during the old row's window snapshot the FK via
// invoice.pricing_terms_id (P1.5), so they remain correct.
//
// Emits 'pricing_terms updated' with a changes payload capturing the
// before/after diff at the field level.

type PricingTermsRow = {
  pricing_terms_id: string;
  monthly_cost: number | null;
  price_per_employee: number;
  free_users: number;
  overage_price_per_user: number | null;
  billing_interval: string;
  delivery_channel: string;
  invoice_format: string;
  effective_from: string;
  effective_until: string | null;
};

export async function updatePricingTerms(
  rawInput: unknown,
): Promise<{ ok: true; pricing_terms_id: string } | { ok: false; error: string }> {
  const adminId = await getSuperAdminId();
  if (!adminId) return { ok: false, error: "unauthorized" };

  const parsed = UpdatePricingTermsInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "invalid_input",
    };
  }
  const input = parsed.data;

  // effective_from guard: reject past dates. A past effective_from
  // would retroactively reprice already-issued invoices in the
  // current window (although invoices with pricing_terms_id
  // snapshot at issue time — P1.5 FK — are protected, in-flight
  // drafts or cron runs would still see the new row as the active
  // one for yesterday).
  const today = toIsoDate(new Date());
  if (input.effective_from < today) {
    return { ok: false, error: "effective_from_cannot_be_in_the_past" };
  }

  const supabase = createAdminClient();

  // Find the currently-active row for this (company, workspace?)
  // scope. We close the open-ended row if present; if none is open
  // (fresh customer), skip the close step and just insert.
  let activeQuery = supabase
    .from("pricing_terms")
    .select(
      "pricing_terms_id, monthly_cost, price_per_employee, free_users, overage_price_per_user, billing_interval, delivery_channel, invoice_format, effective_from, effective_until",
    )
    .eq("company_id", input.company_id)
    .is("effective_until", null)
    .order("effective_from", { ascending: false })
    .limit(1);

  if (input.workspace_id) {
    activeQuery = activeQuery.eq("workspace_id", input.workspace_id);
  } else {
    activeQuery = activeQuery.is("workspace_id", null);
  }

  const { data: active, error: loadErr } = await activeQuery.maybeSingle();
  if (loadErr) {
    console.error("[updatePricingTerms] active lookup failed:", loadErr);
    return { ok: false, error: loadErr.message };
  }

  // Close the active row with effective_until = effective_from - 1.
  // Dovetails exactly with the new row's effective_from so there is
  // no zero-coverage gap even when the admin schedules a future
  // effective_from (e.g. next Monday). If input.effective_from is
  // today, the old row closes as of yesterday — same behaviour as
  // the original implementation.
  const effFrom = new Date(input.effective_from + "T00:00:00Z");
  const priorDay = toIsoDate(new Date(effFrom.getTime() - 24 * 60 * 60 * 1000));

  if (active) {
    const { error: closeErr } = await supabase
      .from("pricing_terms")
      .update({ effective_until: priorDay })
      .eq("pricing_terms_id", active.pricing_terms_id);
    if (closeErr) {
      console.error("[updatePricingTerms] close failed:", closeErr);
      return { ok: false, error: closeErr.message };
    }
  }

  const { data: inserted, error: insErr } = await supabase
    .from("pricing_terms")
    .insert({
      company_id: input.company_id,
      workspace_id: input.workspace_id ?? null,
      monthly_cost: input.monthly_cost,
      price_per_employee: input.price_per_employee,
      free_users: input.free_users,
      overage_price_per_user: input.overage_price_per_user ?? null,
      billing_interval: input.billing_interval,
      delivery_channel: input.delivery_channel,
      invoice_format: input.invoice_format,
      effective_from: input.effective_from,
      created_by: adminId,
    })
    .select("pricing_terms_id")
    .maybeSingle();

  if (insErr || !inserted) {
    console.error("[updatePricingTerms] insert failed:", insErr);
    return {
      ok: false,
      error: insErr?.message ?? "pricing_terms_insert_failed",
    };
  }

  // Field-level diff for the emit payload. Compare `active` against
  // the input — unchanged fields omitted so audit rows are concise.
  const changes = buildChanges(active, input);

  await emit({
    event: "pricing_terms updated",
    actor_id: adminId,
    workspace_id: null,
    properties: {
      entity_type: "pricing_terms",
      entity_id: inserted.pricing_terms_id,
      changes,
    },
  });

  revalidatePath("/platform-admin/billing");
  revalidatePath(`/platform-admin/companies/${input.company_id}`);

  return { ok: true, pricing_terms_id: inserted.pricing_terms_id };
}

function buildChanges(
  before: PricingTermsRow | null,
  after: {
    monthly_cost: number;
    price_per_employee: number;
    free_users: number;
    overage_price_per_user?: number;
    billing_interval: string;
    delivery_channel: string;
    invoice_format: string;
  },
): Record<string, { before: unknown; after: unknown }> {
  const diff: Record<string, { before: unknown; after: unknown }> = {};
  const track = (key: keyof typeof after, prev: unknown, next: unknown) => {
    const normPrev = prev ?? null;
    const normNext = next ?? null;
    if (normPrev !== normNext) {
      diff[key] = { before: normPrev, after: normNext };
    }
  };
  track("monthly_cost", before?.monthly_cost, after.monthly_cost);
  track("price_per_employee", before?.price_per_employee, after.price_per_employee);
  track("free_users", before?.free_users, after.free_users);
  track("overage_price_per_user", before?.overage_price_per_user, after.overage_price_per_user);
  track("billing_interval", before?.billing_interval, after.billing_interval);
  track("delivery_channel", before?.delivery_channel, after.delivery_channel);
  track("invoice_format", before?.invoice_format, after.invoice_format);
  return diff;
}

function toIsoDate(d: Date): string {
  return d.toISOString().split("T")[0] as string;
}
