// ============================================
// journey-shift-temporal-lock.spec.ts
// Verifies DB-canonical temporal lock behavior on schedule_shift.
// Why: lock must be enforced uniformly across all write channels.
// ============================================

import { expect, test } from "@playwright/test";
import { seedShift, seedWorkspace, supabase } from "../helpers/seed";

/**
 * Builds an ISO date string offset from today.
 *
 * Why: temporal lock behavior depends on shift date relative to "now".
 *
 * @param dayOffset - Number of days from today (negative = past, positive = future)
 * @returns Date string in YYYY-MM-DD format.
 */
function isoDateFromToday(dayOffset: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + dayOffset);
  return date.toISOString().slice(0, 10);
}

test.describe("journey:shift-temporal-lock", () => {
  test("blocks planning field update for locked shifts", async () => {
    const workspace = await seedWorkspace({
      name: "E2E Temporal Lock Workspace",
      slug: `e2e-shift-lock-${Date.now()}`,
    });

    const lockedShift = await seedShift(workspace.workspace_id, {
      shift_date: isoDateFromToday(-1),
      start_time: "09:00:00",
      end_time: "17:00:00",
      status: "published",
      is_published: true,
      role: "server",
    });

    const result = await supabase
      .from("schedule_shift")
      .update({ role: "bartender" })
      .eq("schedule_shift_id", lockedShift.schedule_shift_id)
      .select("schedule_shift_id")
      .single();

    expect(result.error).toBeTruthy();
    expect(result.error?.message).toContain("SHIFT_LOCKED_MUTATION");
  });

  test("allows operational status transitions for locked shifts", async () => {
    const workspace = await seedWorkspace({
      name: "E2E Temporal Lock Status Workspace",
      slug: `e2e-shift-lock-status-${Date.now()}`,
    });

    const lockedShift = await seedShift(workspace.workspace_id, {
      shift_date: isoDateFromToday(-1),
      start_time: "10:00:00",
      end_time: "18:00:00",
      status: "published",
      is_published: true,
      role: "server",
    });

    const activate = await supabase
      .from("schedule_shift")
      .update({ status: "active" })
      .eq("schedule_shift_id", lockedShift.schedule_shift_id)
      .select("status")
      .single();

    expect(activate.error).toBeNull();
    expect(activate.data?.status).toBe("active");

    const complete = await supabase
      .from("schedule_shift")
      .update({ status: "completed" })
      .eq("schedule_shift_id", lockedShift.schedule_shift_id)
      .select("status")
      .single();

    expect(complete.error).toBeNull();
    expect(complete.data?.status).toBe("completed");
  });

  test("blocks delete for locked shifts", async () => {
    const workspace = await seedWorkspace({
      name: "E2E Temporal Lock Delete Workspace",
      slug: `e2e-shift-lock-delete-${Date.now()}`,
    });

    const lockedShift = await seedShift(workspace.workspace_id, {
      shift_date: isoDateFromToday(-1),
      start_time: "08:00:00",
      end_time: "16:00:00",
      status: "created",
      role: "server",
    });

    const deleted = await supabase
      .from("schedule_shift")
      .delete()
      .eq("schedule_shift_id", lockedShift.schedule_shift_id);

    expect(deleted.error).toBeTruthy();
    expect(deleted.error?.message).toContain("SHIFT_LOCKED_MUTATION");
  });

  test("shadow mode audits but does not block locked planning updates", async () => {
    const workspace = await seedWorkspace({
      name: "E2E Temporal Lock Shadow Workspace",
      slug: `e2e-shift-lock-shadow-${Date.now()}`,
    });

    const policyResult = await supabase.from("schedule_shift_lock_policy").insert({
      workspace_id: workspace.workspace_id,
      lock_mode: "shadow",
    });
    expect(policyResult.error).toBeNull();

    const lockedShift = await seedShift(workspace.workspace_id, {
      shift_date: isoDateFromToday(-1),
      start_time: "07:00:00",
      end_time: "15:00:00",
      status: "published",
      is_published: true,
      role: "server",
    });

    const updated = await supabase
      .from("schedule_shift")
      .update({ role: "bartender" })
      .eq("schedule_shift_id", lockedShift.schedule_shift_id)
      .select("schedule_shift_id, role")
      .single();

    expect(updated.error).toBeNull();
    expect(updated.data?.role).toBe("bartender");

    const audit = await supabase
      .from("schedule_shift_lock_audit")
      .select("reason_code, lock_mode, is_enforced")
      .eq("workspace_id", workspace.workspace_id)
      .eq("schedule_shift_id", lockedShift.schedule_shift_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    expect(audit.error).toBeNull();
    expect(audit.data?.reason_code).toBe("planning_fields_immutable_after_start_or_past_date");
    expect(audit.data?.lock_mode).toBe("shadow");
    expect(audit.data?.is_enforced).toBe(false);
  });
});
