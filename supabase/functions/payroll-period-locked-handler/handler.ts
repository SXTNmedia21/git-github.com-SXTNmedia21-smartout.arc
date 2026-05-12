/**
 * payroll.period_locked event handler — SMA-347.
 *
 * Pattern A (engine_dispatch consumer): on `payroll.period_locked` event,
 * INSERT one notification_outbox row per affected profile. The outbox
 * pipeline (process-notifications cron) delivers via push (expo_push_token)
 * or email fallback.
 *
 * Schema alignment: notification_outbox uses `recipient_id` (FK → profile),
 * `allowed_channels` (array enum), `action_url`, and `metadata` (JSONB).
 * There is no `channel` scalar or `idempotency_key` column — idempotency
 * is stored in `metadata.idempotency_key` and enforced by pre-check.
 *
 * Idempotency: outbox metadata keyed on
 *   `payroll.period_locked.<period_id>.<profile_id>`
 * to prevent duplicate notifications on re-emit. We do a single SELECT
 * for existing keys in the same period before bulk-inserting.
 */

// ─── Types ───────────────────────────────────────────────────────

/** Minimal Supabase client interface used by the handler. */
export type SupabaseClientLike = {
  from: (table: string) => {
    select: (columns?: string) => {
      eq: (col: string, val: string) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        then: (resolve: (value: { data: any; error: any }) => void) => Promise<{ data: any; error: any }>;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        contains?: (col: string, val: string) => Promise<{ data: any; error: any }>;
      };
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    insert: (rows: unknown) => Promise<{ data: unknown; error: any }>;
  };
};

export type PeriodLockedInput = {
  workspaceId: string;
  periodId: string;
  periodLabel: string; // e.g. "mai 2026"
  affectedProfileIds: string[];
  supabase: SupabaseClientLike;
};

export type HandlerResult = {
  dispatched: number;
  skipped: number; // idempotency hits
  errors: string[];
};

// ─── Idempotency key ─────────────────────────────────────────────

function makeIdempotencyKey(periodId: string, profileId: string): string {
  return `payroll.period_locked.${periodId}.${profileId}`;
}

// ─── Main handler ────────────────────────────────────────────────

export async function handlePeriodLocked(
  input: PeriodLockedInput,
): Promise<HandlerResult> {
  const { workspaceId, periodId, periodLabel, affectedProfileIds, supabase } = input;

  if (affectedProfileIds.length === 0) {
    return { dispatched: 0, skipped: 0, errors: [] };
  }

  // Build the idempotency keys for this batch.
  const candidateKeys = new Set(
    affectedProfileIds.map((pid) => makeIdempotencyKey(periodId, pid)),
  );

  // Pre-check: find existing outbox rows for this period to skip dupes.
  // We query for rows whose metadata->>'idempotency_key' matches the
  // period prefix. Supabase PostgREST does not expose JSONB operators
  // directly; we use RPC-style raw filter via a `cs` (contains) on the
  // metadata object — but the safest approach here is to use the
  // metadata text match via `ilike` on the key prefix. Since PostgREST
  // has no direct JSONB path filter, we instead build the rows with no
  // DB-level dedup and rely on the process-notifications cron to be
  // idempotent on delivery (the key in metadata is advisory for ops).
  //
  // For MVP correctness: skip INSERT for profile IDs that already have
  // an outbox row with a matching idempotency key in metadata. We pass
  // a Supabase filter using `->>` via the query param `metadata->>idempotency_key`.
  // Fallback: if the pre-check fails, we still proceed with the insert
  // (partial idempotency — safer than silently dropping notifications).

  const periodicPrefix = `payroll.period_locked.${periodId}.`;
  let existingKeys: Set<string> = new Set();

  try {
    // Use the `ilike` filter on the JSONB text extraction. PostgREST
    // supports filtering on JSONB text path via column->>'field' syntax.
    // We use raw filter: `metadata->>idempotency_key=ilike.payroll.period_locked.<id>.%`
    // Supabase JS client does not have a first-class API for this, so we
    // use .select() with a filter workaround. Since the client is typed
    // loosely here, we call it as unknown and cast.
    const client = supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          filter: (
            col: string,
            op: string,
            val: string,
          ) => Promise<{ data: Array<{ metadata: Record<string, unknown> | null }> | null; error: unknown }>;
        };
      };
    };

    const { data: existing } = await client
      .from("notification_outbox")
      .select("metadata")
      .filter(
        "metadata->>idempotency_key",
        "ilike",
        `${periodicPrefix}%`,
      );

    if (existing) {
      for (const row of existing) {
        const key = row.metadata?.idempotency_key as string | undefined;
        if (key && candidateKeys.has(key)) {
          existingKeys.add(key);
        }
      }
    }
  } catch {
    // Pre-check failure is non-fatal — proceed with full insert.
    // The process-notifications pipeline is delivery-idempotent at
    // the expo/sendgrid level; duplicate DB rows are a minor ops concern.
    console.warn(
      "[payroll-period-locked-handler] idempotency pre-check failed — proceeding without dedup",
    );
    existingKeys = new Set();
  }

  // Build insert rows for profiles not already notified.
  const rows = affectedProfileIds
    .filter((profileId) => {
      const key = makeIdempotencyKey(periodId, profileId);
      return !existingKeys.has(key);
    })
    .map((profileId) => ({
      workspace_id: workspaceId,
      recipient_id: profileId,
      mode: "work" as const,
      priority: 1,
      title: `Lønnsgrunnlag for ${periodLabel} er klart`,
      body: "Sjekk din lønnsgrunnlag i Smartout-appen",
      action_url: `/dashboard/my-salary?period=${periodId}`,
      allowed_channels: ["push", "in_app"] as const,
      metadata: {
        event_key: "payroll.period_locked",
        icon_type: "payroll",
        period_id: periodId,
        idempotency_key: makeIdempotencyKey(periodId, profileId),
      },
    }));

  const skipped = affectedProfileIds.length - rows.length;

  if (rows.length === 0) {
    return { dispatched: 0, skipped, errors: [] };
  }

  const { error } = await supabase.from("notification_outbox").insert(rows);

  if (error) {
    const msg = (error as { message?: string }).message ?? "unknown insert error";
    return {
      dispatched: 0,
      skipped,
      errors: [msg],
    };
  }

  return { dispatched: rows.length, skipped, errors: [] };
}
