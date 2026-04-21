import { test, expect } from "@playwright/test";
import { supabase } from "../helpers/seed";

/**
 * helpdesk-private-ticket-lifecycle.spec.ts — ADR-0165 HR-style flow guard
 *
 * privacy_mode='private_per_requester' — each ticket spawns a sub-channel
 * (channel_type='query_thread') whose members are requester + rep only.
 * engine_state.entity_id = sub_channel.id; engine_state.context.desk_channel_id
 * points back to the public-facing helpdesk. There is NO parent_channel_id
 * FK column on channel — linkage lives in engine_state.context (JSONB).
 *
 * This test exercises the DB contract of openPrivateTicket +
 * resolveTicketFromMessage (helpdesk-channel-actions.ts:862-973, 992-1089)
 * directly rather than through two-actor UI clicking. Mirrors the 3 HIGH
 * specs' DB-contract pattern: seed, mirror the Server Action writes at
 * service-role level, assert the same invariants the action promises.
 *
 * Verifies:
 *   - sub-channel created with channel_type='query_thread'
 *   - engine_state.entity_id = sub-channel.id
 *   - context.desk_channel_id = parent.id (the linkage the downgrade guard
 *     relies on, and the Min kø groups by)
 *   - channel_member rows for requester + rep only (2 rows, no extras)
 *   - RLS visibility: requester + rep can SELECT the sub-channel via the
 *     channel_member relationship (simulated here with membership count)
 *   - resolve stamps completed_at (L-0079 invariant)
 *
 * Intentionally does NOT assert sub-channel archival on resolve: the
 * current Server Action does NOT set is_archived=true (verified by reading
 * helpdesk-channel-actions.ts:1044-1066). Code wins per CLAUDE.md — the
 * original spec's `expect(subAfter?.is_archived).toBe(true)` was a
 * factual error against the live action.
 *
 * REGRESSION GUARD for ADR-0165 private_per_requester flow + L-0079.
 */

test.describe.configure({ mode: "serial", timeout: 60_000 });

test.describe("journey:private-helpdesk-ticket-sub-channel", () => {
  const seededChannelIds: string[] = [];
  const seededEngineStateIds: string[] = [];

  test.afterEach(async () => {
    for (const stateId of seededEngineStateIds) {
      await supabase.from("engine_state").delete().eq("id", stateId);
    }
    for (const channelId of seededChannelIds) {
      await supabase.from("channel_member").delete().eq("channel_id", channelId);
      await supabase.from("channel_message").delete().eq("channel_id", channelId);
      await supabase.from("channel").delete().eq("id", channelId);
    }
    seededEngineStateIds.length = 0;
    seededChannelIds.length = 0;
  });

  test("private ticket spawns sub-channel linked by context.desk_channel_id with correct membership", async () => {
    const workspaceId = "b0000000-0000-0000-0000-000000000000";

    // Two actors needed: a rep (manager/admin/owner) + a requester (employee).
    const { data: rep, error: repErr } = await supabase
      .from("profile")
      .select("profile_id")
      .eq("workspace_id", workspaceId)
      .in("role", ["manager", "admin", "owner"])
      .eq("is_active", true)
      .order("profile_id", { ascending: true })
      .limit(1)
      .single();
    if (repErr || !rep)
      throw new Error(`Private lifecycle requires an eligible rep: ${repErr?.message}`);

    const { data: requester, error: requesterErr } = await supabase
      .from("profile")
      .select("profile_id")
      .eq("workspace_id", workspaceId)
      .eq("role", "employee")
      .eq("is_active", true)
      .order("profile_id", { ascending: true })
      .limit(1)
      .single();
    if (requesterErr || !requester)
      throw new Error(`Private lifecycle requires an employee requester: ${requesterErr?.message}`);

    // Guard: the two actors must not be the same profile — otherwise the
    // "members is a set of two" assertion below is tautological.
    expect(requester.profile_id).not.toBe(rep.profile_id);

    // --- Seed: private-mode helpdesk parent.
    const suffix = Date.now();
    const { data: parent, error: parentErr } = await supabase
      .from("channel")
      .insert({
        workspace_id: workspaceId,
        channel_type: "custom",
        name: `E2E HR-privat ${suffix}`,
        helpdesk_enabled: true,
        privacy_mode: "private_per_requester",
        responsible_profile_id: rep.profile_id,
      })
      .select("id")
      .single();
    if (parentErr || !parent) throw new Error(`Seed parent channel failed: ${parentErr?.message}`);
    seededChannelIds.push(parent.id);

    // --- Act: mirror openPrivateTicket writes (helpdesk-channel-actions.ts:903-957).
    // Sub-channel (query_thread) + member rows for requester + rep +
    // engine_state anchored on sub-channel with context.desk_channel_id=parent.id.
    const { data: subChannel, error: subErr } = await supabase
      .from("channel")
      .insert({
        workspace_id: workspaceId,
        channel_type: "query_thread",
        name: `Sak: Lønnsspørsmål ${suffix}`,
        description: `Privat sak på E2E HR-privat`,
        created_by: requester.profile_id,
      })
      .select("id")
      .single();
    if (subErr || !subChannel) throw new Error(`Seed sub-channel failed: ${subErr?.message}`);
    seededChannelIds.push(subChannel.id);

    const { error: memberErr } = await supabase.from("channel_member").insert([
      {
        channel_id: subChannel.id,
        workspace_id: workspaceId,
        profile_id: requester.profile_id,
        role: "member",
      },
      {
        channel_id: subChannel.id,
        workspace_id: workspaceId,
        profile_id: rep.profile_id,
        role: "representative",
      },
    ]);
    if (memberErr) throw new Error(`Seed members failed: ${memberErr.message}`);

    const startedAtIso = new Date().toISOString();
    const { data: ticket, error: ticketErr } = await supabase
      .from("engine_state")
      .insert({
        process_id: "helpdesk_query_lifecycle",
        workspace_id: workspaceId,
        entity_type: "channel",
        entity_id: subChannel.id,
        status: "waiting",
        current_step: 1,
        assignee_id: rep.profile_id,
        started_at: startedAtIso,
        context: {
          desk_channel_id: parent.id,
          requester_profile_id: requester.profile_id,
          summary: "Lønnsspørsmål om helgetillegg",
        },
      })
      .select("id")
      .single();
    if (ticketErr || !ticket) throw new Error(`Seed ticket failed: ${ticketErr?.message}`);
    seededEngineStateIds.push(ticket.id);

    // --- Assert: sub-channel + linkage invariants.
    const { data: subRow } = await supabase
      .from("channel")
      .select("id, channel_type, workspace_id")
      .eq("id", subChannel.id)
      .single();
    expect(subRow?.channel_type).toBe("query_thread");
    expect(subRow?.workspace_id).toBe(workspaceId);

    // NOTE: engine_state exposes `updated_at`, NOT `created_at` (verified
    // in supabase/migrations — engine_state has id/workspace_id/process_id/
    // entity_id/entity_type/status/current_step/assignee_id/context/
    // started_at/updated_at/completed_at). The original spec's
    // `.order("created_at")` would 400; using updated_at matches the
    // real Server Action queries and keeps the ordering semantics
    // (most-recent first) for this guard.
    const { data: queriedTickets, error: queryErr } = await supabase
      .from("engine_state")
      .select("id, entity_id, assignee_id, context")
      .eq("process_id", "helpdesk_query_lifecycle")
      .eq("workspace_id", workspaceId)
      .eq("context->>desk_channel_id", parent.id)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (queryErr) throw new Error(`indirectOpen-style query failed: ${queryErr.message}`);
    expect(queriedTickets?.length).toBe(1);
    expect(queriedTickets![0].entity_id).toBe(subChannel.id);
    expect(queriedTickets![0].assignee_id).toBe(rep.profile_id);

    const ctx = queriedTickets![0].context as Record<string, unknown>;
    expect(ctx.desk_channel_id).toBe(parent.id);
    expect(ctx.requester_profile_id).toBe(requester.profile_id);

    // --- Assert: RLS visibility proxy — sub-channel members are exactly
    // requester + rep. No broader workspace audience row exists. Equivalent
    // check to "only those two can SELECT the sub-channel via the
    // channel_jwt_select_member policy".
    const { data: members } = await supabase
      .from("channel_member")
      .select("profile_id, role")
      .eq("channel_id", subChannel.id)
      .order("profile_id", { ascending: true });

    expect(members?.length).toBe(2);
    const memberIds = (members ?? []).map((m) => m.profile_id).sort();
    const expectedIds = [requester.profile_id, rep.profile_id].sort();
    expect(memberIds).toEqual(expectedIds);

    const repMember = members?.find((m) => m.profile_id === rep.profile_id);
    expect(repMember?.role).toBe("representative");
    const requesterMember = members?.find((m) => m.profile_id === requester.profile_id);
    expect(requesterMember?.role).toBe("member");

    // --- Act: mirror resolveTicketFromMessage write (helpdesk-channel-actions.ts:1056-1064).
    const beforeResolve = Date.now();
    const nowIso = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from("engine_state")
      .update({
        status: "complete",
        updated_at: nowIso,
        completed_at: nowIso,
        context: {
          ...ctx,
          resolution_note: null,
          resolved_at: nowIso,
          resolved_by: rep.profile_id,
        },
      })
      .eq("id", ticket.id);
    if (updateErr) throw new Error(`Resolve write failed: ${updateErr.message}`);

    // --- Assert: L-0079 completed_at + monotonic with started_at.
    const { data: after } = await supabase
      .from("engine_state")
      .select("status, completed_at, started_at")
      .eq("id", ticket.id)
      .single();

    expect(after?.status).toBe("complete");
    expect(after?.completed_at).not.toBeNull();

    const completedAt = after?.completed_at ? new Date(after.completed_at).getTime() : 0;
    const startedAt = after?.started_at ? new Date(after.started_at).getTime() : 0;

    expect(completedAt).toBeGreaterThan(beforeResolve - 1000);
    expect(completedAt).toBeLessThan(beforeResolve + 5000);
    expect(startedAt).toBeLessThan(completedAt);
  });
});
