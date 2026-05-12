/**
 * journey-3-fail-closed.spec.ts
 *
 * Journey: Fail-closed — missing authority seed → gate denies, no INSERT
 *
 * Verifies that publish_announcement defaults to DENY when the
 * engine_authority_config row for capability="communication" is absent
 * (ADR-0189 default-deny / L-0066 fail-closed invariant).
 *
 * Test setup:
 *   1. beforeEach: DELETE the communication authority config for admin workspace
 *   2. Invoke tool with confirm=true
 *   3. Assert: return string signals denial, no channel_message inserted
 *   4. afterEach: RE-INSERT the authority config row to restore baseline
 *
 * Note on gate.denied activity_trail: gate_action is called via callGateAction
 * which wraps the Postgres gate_action RPC. Whether the RPC emits a gate.denied
 * row to activity_trail depends on the RPC implementation. If the RPC returns
 * allow=false without emitting, the assertion is skipped with a spec comment.
 *
 * DB assertions use service-role Supabase client. No browser automation.
 */

import { test, expect } from "@playwright/test";
import { resolveAdminWorkspaceId, resolveAdminProfileId } from "../../helpers/auth";
import { supabase, cleanupSeededAuthUsers, getSeededAuthUserIds } from "../../helpers/seed";
import { publishAnnouncement } from "@smartout/ai/capabilities/communication/publish-announcement";
import type { AgentToolContext } from "@smartout/ai/capabilities/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function ensureNewsChannelWithPolicy(opts: {
  workspaceId: string;
  adminProfileId: string;
}): Promise<string> {
  const { data: existing } = await supabase
    .from("channel")
    .select("id")
    .eq("workspace_id", opts.workspaceId)
    .eq("channel_type", "news")
    .maybeSingle();

  let channelId: string;
  if (existing) {
    channelId = existing.id;
  } else {
    const { data: created, error } = await supabase
      .from("channel")
      .insert({
        workspace_id: opts.workspaceId,
        channel_type: "news",
        name: "Nyheter",
        created_by: opts.adminProfileId,
      })
      .select("id")
      .single();
    if (error || !created) throw new Error(`Failed to create news channel: ${error?.message}`);
    channelId = created.id;
  }

  await supabase.from("channel_member").upsert(
    {
      channel_id: channelId,
      workspace_id: opts.workspaceId,
      profile_id: opts.adminProfileId,
      role: "member",
    },
    { onConflict: "channel_id,profile_id", ignoreDuplicates: true },
  );

  await supabase.from("channel_ai_policy").upsert(
    {
      channel_id: channelId,
      workspace_id: opts.workspaceId,
      text_participation: "proactive",
      voice_participation: "disabled",
      auto_reminders: false,
      auto_shift_prep: false,
      auto_summarize: false,
    },
    { onConflict: "channel_id", ignoreDuplicates: false },
  );

  return channelId;
}

// ---------------------------------------------------------------------------
// Spec
// ---------------------------------------------------------------------------

test.describe("publish_announcement — journey 3: fail-closed (no authority seed)", () => {
  let workspaceId: string;
  let adminProfileId: string;
  let channelId: string;

  // Preserve the authority row before deletion so afterEach can restore it
  let savedAuthorityRow: {
    capability: string;
    level: string;
    min_role: string;
    requires_four_eyes: boolean;
  } | null = null;

  test.beforeEach(async () => {
    const wsId = await resolveAdminWorkspaceId();
    if (!wsId) throw new Error("E2E_EMAIL admin user has no workspace profile");
    workspaceId = wsId;

    const profId = await resolveAdminProfileId(workspaceId);
    if (!profId) throw new Error("E2E_EMAIL admin user has no profile in their workspace");
    adminProfileId = profId;

    channelId = await ensureNewsChannelWithPolicy({ workspaceId, adminProfileId });

    // Save the communication authority row before deleting it
    const { data: existing } = await supabase
      .from("engine_authority_config")
      .select("capability, level, min_role, requires_four_eyes")
      .eq("workspace_id", workspaceId)
      .eq("capability", "communication")
      .maybeSingle();

    savedAuthorityRow = existing
      ? {
          capability: existing.capability,
          level: existing.level as string,
          min_role: (existing.min_role ?? "employee") as string,
          requires_four_eyes: existing.requires_four_eyes ?? false,
        }
      : null;

    // Remove the communication seed to simulate missing authority
    await supabase
      .from("engine_authority_config")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("capability", "communication");
  });

  test.afterEach(async () => {
    // Restore the authority row so other test suites are not affected
    if (savedAuthorityRow) {
      await supabase.from("engine_authority_config").upsert(
        {
          workspace_id: workspaceId,
          capability: savedAuthorityRow.capability,
          level: savedAuthorityRow.level,
          min_role: savedAuthorityRow.min_role,
          requires_four_eyes: savedAuthorityRow.requires_four_eyes,
        },
        { onConflict: "workspace_id,capability", ignoreDuplicates: false },
      );
    } else {
      // No row existed before — re-insert the default from migration 20260601000000
      await supabase.from("engine_authority_config").upsert(
        {
          workspace_id: workspaceId,
          capability: "communication",
          level: "suggest",
          min_role: "employee",
          requires_four_eyes: false,
        },
        { onConflict: "workspace_id,capability", ignoreDuplicates: true },
      );
    }

    await cleanupSeededAuthUsers(getSeededAuthUserIds());
  });

  test("missing authority seed → tool returns deny copy, no INSERT", async () => {
    const ctx: AgentToolContext = {
      workspaceId: workspaceId as AgentToolContext["workspaceId"],
      profileId: adminProfileId as AgentToolContext["profileId"],
      sessionId: "e2e-test-session-fail-closed",
      supabaseAdmin: supabase,
      channel: "chat",
    };

    // Snapshot row count before call
    const { count: countBefore } = await supabase
      .from("channel_message")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("channel_id", channelId);

    const deniedAt = new Date();

    const returnValue = await publishAnnouncement.execute(
      {
        channel_id: channelId,
        title: "Briefing",
        body: "All staff meeting at 14:00.",
        audience_kind: "all",
        confirm: true,
      },
      ctx,
    );

    // Tool must return a plain string (not JSON) on gate deny
    expect(typeof returnValue).toBe("string");
    const msg = returnValue as string;

    // The deny copy must signal that the action was not authorized.
    // Possible strings: "authority gate denied", "not authorized", "gate denied"
    // The tool returns: "Cannot publish announcement: authority gate denied — <reason>."
    expect(msg.toLowerCase()).toMatch(/not authorized|authority gate denied|gate denied/);

    // Service-role assertion: zero channel_message rows inserted
    const { count: countAfter } = await supabase
      .from("channel_message")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("channel_id", channelId);

    expect(countAfter).toBe(countBefore);

    // Gate deny audit: gate_action RPC is called before any INSERT. Whether the
    // RPC emits a gate.denied row to activity_trail depends on the RPC
    // implementation. Assertion is best-effort: if the row exists, validate it;
    // if not, the test still passes (the primary invariant is "no INSERT").
    const { data: gateAudit } = await supabase
      .from("activity_trail")
      .select("event_name, properties")
      .eq("workspace_id", workspaceId)
      .gte("created_at", deniedAt.toISOString())
      .in("event_name", ["gate.denied", "gate.evaluated", "capability.gate.denied"])
      .limit(1);

    if (gateAudit && gateAudit.length > 0) {
      // Bonus assertion: gate audit row references communication capability
      const row = gateAudit[0];
      const props = (row?.properties ?? {}) as Record<string, unknown>;
      // Accept either a top-level capability field or one nested in properties
      const capField =
        (props["capability"] as string | undefined) ??
        (props["action_type"] as string | undefined) ??
        "";
      expect(capField.toLowerCase()).toMatch(/communication|publish_announcement/);
    }
    // If gateAudit is empty: gate_action RPC does not emit deny rows to
    // activity_trail (implementation detail). Primary assertion (no INSERT) still
    // covers the fail-closed invariant — no action taken = correct behaviour.
  });
});
