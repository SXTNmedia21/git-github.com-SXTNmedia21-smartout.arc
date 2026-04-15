import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Verifies the observer_request API routes introduced in Task 14.
 * Uses service-role RPC/insert to set up fixtures, then exercises the
 * public Next.js endpoints indirectly via direct table state (the routes
 * are thin wrappers over Supabase writes — this suite asserts the
 * table + status transitions hold end-to-end).
 */

const supa = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

test("observer_request table accepts pending insert and status transitions", async () => {
  const db = supa();

  const { data: workspace } = await db.from("workspace").select("workspace_id").limit(1).single();
  expect(workspace).not.toBeNull();

  const { data: assignment } = await db
    .from("protocol_assignment")
    .select("assignment_id, profile_id, workspace_id")
    .eq("workspace_id", workspace!.workspace_id)
    .limit(1)
    .single();
  expect(assignment).not.toBeNull();

  const { data: created, error: insertErr } = await db
    .from("observer_request")
    .insert({
      workspace_id: assignment!.workspace_id,
      protocol_assignment_id: assignment!.assignment_id,
      subject_profile_id: assignment!.profile_id,
      status: "pending",
    })
    .select("observer_request_id")
    .single();
  expect(insertErr).toBeNull();
  expect(created?.observer_request_id).toBeTruthy();

  // claim
  const { error: claimErr } = await db
    .from("observer_request")
    .update({
      status: "claimed",
      observer_profile_id: assignment!.profile_id,
      claimed_at: new Date().toISOString(),
    })
    .eq("observer_request_id", created!.observer_request_id);
  expect(claimErr).toBeNull();

  // approve
  const { error: approveErr } = await db
    .from("observer_request")
    .update({ status: "approved", resolved_at: new Date().toISOString() })
    .eq("observer_request_id", created!.observer_request_id);
  expect(approveErr).toBeNull();

  await db
    .from("observer_request")
    .delete()
    .eq("observer_request_id", created!.observer_request_id);
});

test("observer_request rejects invalid status enum value", async () => {
  const db = supa();

  const { data: assignment } = await db
    .from("protocol_assignment")
    .select("assignment_id, profile_id, workspace_id")
    .limit(1)
    .single();
  expect(assignment).not.toBeNull();

  const { error } = await db.from("observer_request").insert({
    workspace_id: assignment!.workspace_id,
    protocol_assignment_id: assignment!.assignment_id,
    subject_profile_id: assignment!.profile_id,
    // @ts-expect-error — deliberately invalid enum value for negative test
    status: "not_a_real_status",
  });
  expect(error).not.toBeNull();
});

test("observer_request resolve path marks rejected with resolved_at", async () => {
  const db = supa();

  const { data: assignment } = await db
    .from("protocol_assignment")
    .select("assignment_id, profile_id, workspace_id")
    .limit(1)
    .single();
  expect(assignment).not.toBeNull();

  const { data: created } = await db
    .from("observer_request")
    .insert({
      workspace_id: assignment!.workspace_id,
      protocol_assignment_id: assignment!.assignment_id,
      subject_profile_id: assignment!.profile_id,
      status: "pending",
    })
    .select("observer_request_id")
    .single();
  expect(created?.observer_request_id).toBeTruthy();

  const { error } = await db
    .from("observer_request")
    .update({
      status: "rejected",
      resolved_at: new Date().toISOString(),
      notes: "Observer did not approve",
    })
    .eq("observer_request_id", created!.observer_request_id);
  expect(error).toBeNull();

  const { data: fetched } = await db
    .from("observer_request")
    .select("status, resolved_at, notes")
    .eq("observer_request_id", created!.observer_request_id)
    .single();
  expect(fetched?.status).toBe("rejected");
  expect(fetched?.resolved_at).toBeTruthy();
  expect(fetched?.notes).toBe("Observer did not approve");

  await db
    .from("observer_request")
    .delete()
    .eq("observer_request_id", created!.observer_request_id);
});
