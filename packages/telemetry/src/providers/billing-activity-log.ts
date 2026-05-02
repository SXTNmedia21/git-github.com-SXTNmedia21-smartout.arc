import { createClient } from "@supabase/supabase-js";
import type { SmartoutEvent, EventMeta } from "../registry";
import { resolveEntityRef } from "./activity-trail";

// Service role — billing_activity_log is platform-scoped; RLS allows
// is_admin_in_company reads but writes come through this provider only.
const getSupabaseClient = () =>
  createClient(
    process.env.SUPABASE_URL || (process.env.NEXT_PUBLIC_SUPABASE_URL as string),
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  );

/**
 * Writes billing events to `billing_activity_log` (ADR-0125).
 *
 * Differences from `writeActivityTrail`:
 *
 *  - `event.actor_id` is interpreted as a `user_identity.user_id` (NOT
 *    profile_id). Billing events originate from platform admins and cron
 *    jobs that do not own a workspace-scoped profile. The row is written
 *    into `billing_activity_log.actor_user_id`. NULL is accepted (cron/
 *    system writers).
 *
 *  - Rows are company-scoped. `company_id` is resolved in priority order:
 *    (1) explicit `properties.data.company_id`
 *    (2) `invoice_id` lookup for invoice-entity events
 *    If neither resolves, the row is rejected with a warning — we will not
 *    write an unscoped billing audit entry.
 *
 *  - `invoice_id` is denormalised onto the row whenever the event targets
 *    an invoice (`entity_type === 'invoice'` OR `data.invoice_id`). This
 *    matches the index on `billing_activity_log(invoice_id, created_at DESC)`
 *    created in Task 1.7.5 and keeps invoice-timeline queries cheap.
 *
 *  - `source` is taken from `properties.data.source` when a caller tags the
 *    event (Edge Functions should set `'cron'`). Defaults to `'web'`.
 */
export async function writeBillingActivityLog(
  event: SmartoutEvent,
  _meta: EventMeta,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const props = event.properties as any;

  // Accept BOTH flat (props.entity_type / props.entity_id) AND nested
  // (props.entity.entity_type / props.entity.entity_id) shapes — mirroring
  // the dual-shape support in activity-trail.ts (resolveEntityRef, S1.1).
  // Settlement events use the nested shape per registry interface definitions.
  const entityRef = resolveEntityRef(props);
  if (!entityRef) {
    console.warn(
      `[telemetry.billing_activity_log] Missing entity_type/entity_id for "${event.event}". Rejected.`,
    );
    return;
  }
  const entityType = entityRef.entity_type;
  const entityId = entityRef.entity_id;

  const data = props?.data ?? {};
  const changes = props?.changes ?? {};

  const supabase = getSupabaseClient();

  // ── Fan-out path: ADR-0264 ────────────────────────────────────────────────
  //
  // Settlement events (run_completed, run_failed) are platform-scoped:
  // workspace_id is null and the run spans multiple companies. The single-company
  // path below cannot resolve company_id for these events (no invoice_id, no
  // data.company_id). Instead, callers supply data.company_ids[] — one insert
  // per company, each with company_id NOT NULL (constraint satisfied row-by-row).
  //
  // ADR-0264: this path is the sole audit mechanism for settlement run_completed
  // / run_failed events (workspace_id: null → activity_trail silently drops them).
  //
  // Invariant: empty array falls through to single-company path below (regression
  // guard — only non-empty arrays trigger fan-out).
  if (Array.isArray(data.company_ids) && (data.company_ids as unknown[]).length > 0) {
    const source: string = typeof data.source === "string" ? data.source : "web";

    const insertPromises = (data.company_ids as string[]).map(async (cid) => {
      // Verify company exists — same defense-in-depth as single-company path at
      // lines 122–145 (L-0177: forgeable-ID class; DB check is the security gate).
      const { data: company, error: companyErr } = await supabase
        .from("company")
        .select("company_id")
        .eq("company_id", cid)
        .maybeSingle();

      if (companyErr || !company) {
        console.warn(
          `[telemetry.billing_activity_log] fan-out: company ${cid} not found for "${event.event}". Skipped.`,
        );
        return;
      }

      const { error: insertErr } = await supabase.from("billing_activity_log").insert({
        company_id: cid,
        invoice_id: null, // settlement run events have no invoice; invoice_id is nullable per migration 20260417122417
        event: event.event,
        entity_type: entityType,
        entity_id: entityId,
        data,
        changes,
        actor_user_id: event.actor_id || null,
        source,
      });

      if (insertErr) {
        console.error(
          `[telemetry.billing_activity_log] fan-out insert failed for "${event.event}" / company ${cid}:`,
          insertErr,
        );
      }
    });

    // Promise.allSettled — telemetry must never block business logic on a
    // single failed insert (one bad company_id must not suppress the others).
    await Promise.allSettled(insertPromises);
    return; // Fan-out handled; skip single-company path below.
  }

  // Resolve invoice_id (used for denormalisation + company_id resolution).
  let invoiceId: string | null = null;
  if (entityType === "invoice") {
    invoiceId = entityId;
  } else if (typeof data.invoice_id === "string") {
    invoiceId = data.invoice_id;
  }

  // Resolve company_id. SECURITY: always verify against the DB — the
  // caller-supplied `data.company_id` from an emit() payload cannot be
  // trusted on its own (WATCHDOG_CRON_SECRET is shared across multiple
  // cron Edge Functions; any of them could spoof a company_id). Priority:
  //
  //   1. invoice_id present (most common billing events) -> look up
  //      invoice.company_id. If data.company_id was also supplied and
  //      disagrees with the DB value, reject the event (loud).
  //
  //   2. No invoice_id but data.company_id present -> verify the company
  //      exists (defends against typos + bogus UUIDs; doesn't defend
  //      against full spoofing of a real company_id from a compromised
  //      caller, but that's an authorization question outside the
  //      provider's remit — see MODULE_BILLING §7 "Rule" block).
  //
  //   3. Neither -> reject.
  const declaredCompanyId: string | null =
    typeof data.company_id === "string" ? data.company_id : null;
  let companyId: string | null = null;

  if (invoiceId) {
    const { data: inv, error } = await supabase
      .from("invoice")
      .select("company_id")
      .eq("invoice_id", invoiceId)
      .maybeSingle();

    if (error) {
      console.warn(
        `[telemetry.billing_activity_log] invoice lookup failed for "${event.event}":`,
        error.message,
      );
      return;
    }

    if (!inv) {
      console.warn(
        `[telemetry.billing_activity_log] invoice ${invoiceId} not found for "${event.event}". Rejected.`,
      );
      return;
    }

    if (declaredCompanyId && declaredCompanyId !== inv.company_id) {
      console.error(
        `[telemetry.billing_activity_log] company_id mismatch for "${event.event}": caller declared ${declaredCompanyId}, invoice ${invoiceId} belongs to ${inv.company_id}. Rejected (possible cross-tenant spoof).`,
      );
      return;
    }

    companyId = inv.company_id;
  } else if (declaredCompanyId) {
    const { data: company, error } = await supabase
      .from("company")
      .select("company_id")
      .eq("company_id", declaredCompanyId)
      .maybeSingle();

    if (error) {
      console.warn(
        `[telemetry.billing_activity_log] company lookup failed for "${event.event}":`,
        error.message,
      );
      return;
    }

    if (!company) {
      console.warn(
        `[telemetry.billing_activity_log] company ${declaredCompanyId} not found for "${event.event}". Rejected.`,
      );
      return;
    }

    companyId = company.company_id;
  }

  if (!companyId) {
    console.warn(
      `[telemetry.billing_activity_log] Could not resolve company_id for "${event.event}". Rejected.`,
    );
    return;
  }

  const source: string = typeof data.source === "string" ? data.source : "web";

  const { error } = await supabase.from("billing_activity_log").insert({
    company_id: companyId,
    invoice_id: invoiceId,
    event: event.event,
    entity_type: entityType,
    entity_id: entityId,
    data,
    changes,
    actor_user_id: event.actor_id || null,
    source,
  });

  if (error) {
    console.error(`[telemetry.billing_activity_log] insert failed for "${event.event}":`, error);
  }
}
