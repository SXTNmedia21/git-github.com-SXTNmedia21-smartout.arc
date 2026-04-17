import { createClient } from "@supabase/supabase-js";
import type { SmartoutEvent, EventMeta } from "../registry";

// Service role — billing_activity_log is platform-scoped; RLS allows
// is_admin_in_company reads but writes come through this provider only.
const getSupabaseClient = () =>
  createClient(
    process.env.SUPABASE_URL || (process.env.NEXT_PUBLIC_SUPABASE_URL as string),
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  );

/**
 * Writes billing events to `billing_activity_log` (ADR-0122).
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
  const entityType: string | undefined = props?.entity_type;
  const entityId: string | undefined = props?.entity_id;
  const data = props?.data ?? {};
  const changes = props?.changes ?? {};

  if (!entityType || !entityId) {
    console.warn(
      `[telemetry.billing_activity_log] Missing entity_type/entity_id for "${event.event}". Rejected.`,
    );
    return;
  }

  const supabase = getSupabaseClient();

  // Resolve invoice_id (used for denormalisation + company_id fallback).
  let invoiceId: string | null = null;
  if (entityType === "invoice") {
    invoiceId = entityId;
  } else if (typeof data.invoice_id === "string") {
    invoiceId = data.invoice_id;
  }

  // Resolve company_id.
  let companyId: string | null = typeof data.company_id === "string" ? data.company_id : null;

  if (!companyId && invoiceId) {
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
    }
    companyId = inv?.company_id ?? null;
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
