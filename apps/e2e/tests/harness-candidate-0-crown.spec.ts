import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

test.describe("Harness Candidate 0 — Crown", () => {
  let stateId: string | null = null;
  let admin: ReturnType<typeof createClient> | null = null;

  test.afterEach(async () => {
    if (admin && stateId) {
      await admin.from("engine_state").delete().eq("id", stateId);
    }
    stateId = null;
  });

  test("heartbeat dispatches dev-arena-bootstrap mission to terminal completion", async () => {
    test.setTimeout(120_000); // poll budget 90s + headroom for setup/teardown
    admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. Pick the seed test workspace
    const { data: ws } = await admin
      .from("workspace")
      .select("workspace_id")
      .eq("is_active", true)
      .order("workspace_id", { ascending: true })
      .limit(1)
      .single();
    expect(ws?.workspace_id, "test workspace must exist").toBeTruthy();
    const workspaceId = ws!.workspace_id as string;

    // 2. Insert scheduled engine_state row, ready for pickup (1 minute in past)
    const { data: row, error: insertErr } = await admin
      .from("engine_state")
      .insert({
        process_id: "dev-arena-bootstrap",
        mission_id: "dev-arena-bootstrap",
        workspace_id: workspaceId,
        status: "scheduled",
        scheduled_for: new Date(Date.now() - 60_000).toISOString(),
        context: { phase: 0, source: "harness-candidate-0" },
      })
      .select("id")
      .single();
    expect(insertErr, "scheduled insert must succeed").toBeNull();
    stateId = row!.id as string;

    // Supabase Local has no pg_cron — manually trigger heartbeat-dispatcher
    // during the 90s poll window. See PLAN-arena-harness-migration.md §Task 6 Step 6.3 footnote.
    const heartbeatUrl = `${SUPABASE_URL}/functions/v1/heartbeat-dispatcher`;
    const cronSecret = process.env.WATCHDOG_CRON_SECRET ?? "";
    const heartbeatInterval = setInterval(() => {
      void fetch(heartbeatUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${cronSecret}` },
      }).catch(() => {
        // silent — if dispatcher transient, next tick retries
      });
    }, 5000);

    // 3. Poll up to 90s for terminal status
    const deadline = Date.now() + 90_000;
    let final: { status: string; dispatch_lock_id: string | null } | null = null;
    while (Date.now() < deadline) {
      const { data } = await admin
        .from("engine_state")
        .select("status, dispatch_lock_id")
        .eq("id", stateId)
        .single();
      const row = data as { status: string; dispatch_lock_id: string | null } | null;
      if (row && row.status === "complete") {
        final = row;
        break;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    clearInterval(heartbeatInterval);
    expect(final, "engine_state must reach 'complete' within 90s").not.toBeNull();
    expect(final!.dispatch_lock_id, "dispatch_lock_id must be set by heartbeat").not.toBeNull();

    // 4. Assert exact event sequence.
    // engine_event columns: event_type (TEXT) + payload (JSONB).
    // Journey events embed run_id INSIDE payload — filter via .contains().
    const { data: events } = await admin
      .from("engine_event")
      .select("event_type, payload")
      .contains("payload", { run_id: stateId })
      .order("fired_at", { ascending: true });

    const types = (events ?? []).map((e) => e.event_type);
    expect(types.filter((t) => t === "journey run_started")).toHaveLength(1);
    expect(types.filter((t) => t === "journey step_reached")).toHaveLength(2);
    expect(types.filter((t) => t === "journey completed")).toHaveLength(1);
    expect(types.filter((t) => t === "journey run_failed")).toHaveLength(0);

    // 5. Spot-check payload shape on run_started (registry contract).
    const runStarted = (events ?? []).find((e) => e.event_type === "journey run_started");
    expect(runStarted, "run_started event must exist").toBeDefined();
    const payload = runStarted!.payload as Record<string, unknown>;
    expect(payload.capability).toBe("journey.run_dev");
    expect(payload.surface).toBe("dev");
    expect(payload.journey_version_id).toBeTruthy();
    expect((payload.entity as Record<string, unknown>)?.entity_type).toBe("journey_run");
  });
});
