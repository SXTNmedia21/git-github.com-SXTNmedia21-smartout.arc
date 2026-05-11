/**
 * Vitest scaffold for payroll-period-locked-handler — SMA-347.
 *
 * Tests the handler contract: given a locked period + affected profile IDs,
 * handlePeriodLocked inserts one notification_outbox row per profile and
 * returns a { dispatched, skipped, errors } result.
 *
 * The handler lives in supabase/functions/payroll-period-locked-handler/handler.ts
 * (Deno). Since vitest runs in Node, we inline the handler logic here for
 * unit-test isolation — the contract under test is the row shape and
 * idempotency behaviour, not Deno-specific bindings.
 *
 * Row shape validated:
 *   workspace_id    string  (passed through)
 *   recipient_id    string  (per profile — FK → profile.profile_id)
 *   mode            "work"
 *   allowed_channels ["push", "in_app"]
 *   action_url      string  (/dashboard/my-salary?period=<id>)
 *   metadata        { event_key, icon_type, period_id, idempotency_key }
 *   title           string  (contains period label)
 *
 * Idempotency key format: payroll.period_locked.<period_id>.<profile_id>
 */

import { describe, expect, it, vi } from "vitest";

// ─── Inline mirror of handler.ts (Node-compatible, no Deno deps) ─────────
// IMPORTANT: keep in sync with supabase/functions/payroll-period-locked-handler/handler.ts
// Any schema change to notification_outbox inserts must be reflected here.

type NotificationRow = {
  workspace_id: string;
  recipient_id: string;
  mode: "work";
  priority: number;
  title: string;
  body: string;
  action_url: string;
  allowed_channels: readonly ["push", "in_app"];
  metadata: {
    event_key: string;
    icon_type: string;
    period_id: string;
    idempotency_key: string;
  };
};

type SupabaseClientLike = {
  from: (table: string) => {
    insert: (rows: NotificationRow[]) => Promise<{ data: unknown; error: unknown }>;
    select: (columns?: string) => {
      filter: (
        col: string,
        op: string,
        val: string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ) => Promise<{ data: any; error: unknown }>;
    };
  };
};

function makeIdempotencyKey(periodId: string, profileId: string): string {
  return `payroll.period_locked.${periodId}.${profileId}`;
}

async function handlePeriodLocked(input: {
  workspaceId: string;
  periodId: string;
  periodLabel: string;
  affectedProfileIds: string[];
  supabase: SupabaseClientLike;
}): Promise<{ dispatched: number; skipped: number; errors: string[] }> {
  const { workspaceId, periodId, periodLabel, affectedProfileIds, supabase } = input;

  if (affectedProfileIds.length === 0) {
    return { dispatched: 0, skipped: 0, errors: [] };
  }

  const candidateKeys = new Set(affectedProfileIds.map((pid) => makeIdempotencyKey(periodId, pid)));

  let existingKeys: Set<string> = new Set();
  const periodicPrefix = `payroll.period_locked.${periodId}.`;

  try {
    const { data: existing } = await supabase
      .from("notification_outbox")
      .select("metadata")
      .filter("metadata->>idempotency_key", "ilike", `${periodicPrefix}%`);

    if (existing) {
      for (const row of existing as Array<{ metadata: Record<string, unknown> | null }>) {
        const key = row.metadata?.idempotency_key as string | undefined;
        if (key && candidateKeys.has(key)) {
          existingKeys.add(key);
        }
      }
    }
  } catch {
    existingKeys = new Set();
  }

  const rows = affectedProfileIds
    .filter((profileId) => !existingKeys.has(makeIdempotencyKey(periodId, profileId)))
    .map(
      (profileId): NotificationRow => ({
        workspace_id: workspaceId,
        recipient_id: profileId,
        mode: "work",
        priority: 1,
        title: `Lønnsgrunnlag for ${periodLabel} er klart`,
        body: "Sjekk din lønnsgrunnlag i Smartout-appen",
        action_url: `/dashboard/my-salary?period=${periodId}`,
        allowed_channels: ["push", "in_app"],
        metadata: {
          event_key: "payroll.period_locked",
          icon_type: "payroll",
          period_id: periodId,
          idempotency_key: makeIdempotencyKey(periodId, profileId),
        },
      }),
    );

  const skipped = affectedProfileIds.length - rows.length;

  if (rows.length === 0) {
    return { dispatched: 0, skipped, errors: [] };
  }

  const { error } = await supabase.from("notification_outbox").insert(rows);

  if (error) {
    const msg = (error as { message?: string }).message ?? "unknown insert error";
    return { dispatched: 0, skipped, errors: [msg] };
  }

  return { dispatched: rows.length, skipped, errors: [] };
}

// ─── Test helpers ────────────────────────────────────────────────

function mockSupabase(opts: {
  insertSpy?: ReturnType<typeof vi.fn>;
  existingKeys?: string[];
}): SupabaseClientLike {
  const insertSpy = opts.insertSpy ?? vi.fn().mockResolvedValue({ data: [], error: null });

  const existingRows = (opts.existingKeys ?? []).map((key) => ({
    metadata: { idempotency_key: key },
  }));

  const filterSpy = vi.fn().mockResolvedValue({ data: existingRows, error: null });

  return {
    from: vi.fn().mockReturnValue({
      insert: insertSpy,
      select: vi.fn().mockReturnValue({ filter: filterSpy }),
    }),
  };
}

// ─── Tests ───────────────────────────────────────────────────────

describe("payroll-period-locked-handler — SMA-347", () => {
  it("inserts notification_outbox row per affected profile", async () => {
    const insertSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    const supabase = mockSupabase({ insertSpy });

    await handlePeriodLocked({
      workspaceId: "ws-1",
      periodId: "period-1",
      periodLabel: "mai 2026",
      affectedProfileIds: ["prof-1", "prof-2", "prof-3"],
      supabase,
    });

    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(insertSpy.mock.calls[0][0]).toHaveLength(3);
  });

  it("uses recipient_id (not profile_id) for notification_outbox FK", async () => {
    const insertSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    const supabase = mockSupabase({ insertSpy });

    await handlePeriodLocked({
      workspaceId: "ws-1",
      periodId: "period-1",
      periodLabel: "mai 2026",
      affectedProfileIds: ["prof-1"],
      supabase,
    });

    const row = insertSpy.mock.calls[0][0][0] as NotificationRow;
    expect(row.recipient_id).toBe("prof-1");
    // Ensure we don't have a profile_id field (wrong column name)
    expect((row as Record<string, unknown>).profile_id).toBeUndefined();
  });

  it("sets correct row shape: workspace_id, mode=work, allowed_channels, action_url", async () => {
    const insertSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    const supabase = mockSupabase({ insertSpy });

    await handlePeriodLocked({
      workspaceId: "ws-1",
      periodId: "period-1",
      periodLabel: "mai 2026",
      affectedProfileIds: ["prof-1"],
      supabase,
    });

    expect(insertSpy.mock.calls[0][0][0]).toMatchObject({
      workspace_id: "ws-1",
      recipient_id: "prof-1",
      mode: "work",
      allowed_channels: ["push", "in_app"],
      action_url: "/dashboard/my-salary?period=period-1",
    });
  });

  it("stores idempotency_key in metadata (not as top-level column)", async () => {
    const insertSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    const supabase = mockSupabase({ insertSpy });

    await handlePeriodLocked({
      workspaceId: "ws-1",
      periodId: "period-1",
      periodLabel: "mai 2026",
      affectedProfileIds: ["prof-1"],
      supabase,
    });

    const row = insertSpy.mock.calls[0][0][0] as NotificationRow;
    expect(row.metadata.idempotency_key).toBe("payroll.period_locked.period-1.prof-1");
    // Confirm there is NO top-level idempotency_key (notification_outbox has no such column)
    expect((row as Record<string, unknown>).idempotency_key).toBeUndefined();
  });

  it("returns dispatched count equal to number of profiles", async () => {
    const supabase = mockSupabase({});

    const result = await handlePeriodLocked({
      workspaceId: "ws-1",
      periodId: "period-1",
      periodLabel: "mai 2026",
      affectedProfileIds: ["prof-1", "prof-2"],
      supabase,
    });

    expect(result.dispatched).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it("returns dispatched=0, skipped=0 when affectedProfileIds is empty", async () => {
    const insertSpy = vi.fn();
    const supabase = mockSupabase({ insertSpy });

    const result = await handlePeriodLocked({
      workspaceId: "ws-1",
      periodId: "period-1",
      periodLabel: "mai 2026",
      affectedProfileIds: [],
      supabase,
    });

    expect(result.dispatched).toBe(0);
    expect(result.skipped).toBe(0);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("skips profiles that already have an outbox row (idempotency)", async () => {
    const insertSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    const supabase = mockSupabase({
      insertSpy,
      existingKeys: [
        "payroll.period_locked.period-1.prof-1",
        "payroll.period_locked.period-1.prof-2",
      ],
    });

    const result = await handlePeriodLocked({
      workspaceId: "ws-1",
      periodId: "period-1",
      periodLabel: "mai 2026",
      affectedProfileIds: ["prof-1", "prof-2", "prof-3"],
      supabase,
    });

    expect(result.dispatched).toBe(1); // only prof-3
    expect(result.skipped).toBe(2); // prof-1 + prof-2
    expect(insertSpy.mock.calls[0][0]).toHaveLength(1);
    expect(insertSpy.mock.calls[0][0][0].recipient_id).toBe("prof-3");
  });

  it("returns errors array when insert fails", async () => {
    const insertSpy = vi.fn().mockResolvedValue({ data: null, error: { message: "FK violation" } });
    const supabase = mockSupabase({ insertSpy });

    const result = await handlePeriodLocked({
      workspaceId: "ws-1",
      periodId: "period-1",
      periodLabel: "mai 2026",
      affectedProfileIds: ["prof-1"],
      supabase,
    });

    expect(result.dispatched).toBe(0);
    expect(result.errors).toContain("FK violation");
  });

  it("title contains period label", async () => {
    const insertSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    const supabase = mockSupabase({ insertSpy });

    await handlePeriodLocked({
      workspaceId: "ws-1",
      periodId: "period-1",
      periodLabel: "juni 2026",
      affectedProfileIds: ["prof-1"],
      supabase,
    });

    const row = insertSpy.mock.calls[0][0][0] as NotificationRow;
    expect(row.title).toContain("juni 2026");
  });
});
