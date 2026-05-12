import { test, expect } from "@playwright/test";
import { loginAsAdmin, resolveAdminWorkspaceId, resolveAdminProfileId } from "../helpers/auth";
import {
  supabase,
  seedDepartment,
  seedProfile,
  cleanupSeededAuthUsers,
  getSeededAuthUserIds,
} from "../helpers/seed";

/**
 * Seeds a news announcement into the given workspace.
 * Finds or creates the workspace 'news' channel, ensures the sender is a
 * channel_member (required for get_my_channels RPC), then inserts a
 * channel_message of type 'announcement'.
 *
 * Returns { messageId, channelId } so the caller can assert + clean up.
 */
async function seedNewsAnnouncement(opts: {
  workspaceId: string;
  senderId: string;
  title: string;
  body: string;
}): Promise<{ messageId: string; channelId: string }> {
  // Resolve or create the workspace 'news' channel
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
    const { data: created } = await supabase
      .from("channel")
      .insert({
        workspace_id: opts.workspaceId,
        channel_type: "news",
        name: "Nyheter",
        created_by: opts.senderId,
      })
      .select("id")
      .single();
    channelId = created!.id;
  }

  // Ensure sender is a channel_member — get_my_channels RPC filters by membership.
  // Upsert to handle both new and pre-existing channels gracefully.
  await supabase.from("channel_member").upsert(
    {
      channel_id: channelId,
      workspace_id: opts.workspaceId,
      profile_id: opts.senderId,
      role: "member",
    },
    { onConflict: "channel_id,profile_id", ignoreDuplicates: true },
  );

  const { data: message, error } = await supabase
    .from("channel_message")
    .insert({
      workspace_id: opts.workspaceId,
      channel_id: channelId,
      sender_id: opts.senderId,
      content: `${opts.title}\n${opts.body}`,
      message_type: "announcement",
    })
    .select("id")
    .single();

  if (error || !message) {
    throw new Error(`seedNewsAnnouncement failed: ${error?.message ?? "no row"}`);
  }

  return { messageId: message.id, channelId };
}

test.describe("Nyheter journey 3 — pin/unpin writes correct DB shape + audit", () => {
  let workspaceId: string;
  let adminProfileId: string;
  let messageId: string;
  // Track all seeded entities for targeted cleanup
  const seededIds = {
    departments: [] as string[],
    profiles: [] as string[],
    messages: [] as string[],
  };

  test.beforeEach(async () => {
    const wsId = await resolveAdminWorkspaceId();
    if (!wsId) throw new Error("E2E_EMAIL admin user has no workspace profile");
    workspaceId = wsId;

    const profileId = await resolveAdminProfileId(workspaceId);
    if (!profileId) throw new Error("E2E_EMAIL admin user has no profile in their workspace");
    adminProfileId = profileId;

    // Reset per-test collectors
    seededIds.departments = [];
    seededIds.profiles = [];
    seededIds.messages = [];

    // Seed a department into admin's workspace (used only as structural context)
    const kjokken = await seedDepartment(workspaceId, { name: "Kjøkken" });
    seededIds.departments.push(kjokken.department_id);

    // Seed a manager profile to act as an additional actor (optional — admin is sender)
    const manager = await seedProfile(workspaceId, {
      display_name: "Sofia Manager",
      role: "manager",
    });
    seededIds.profiles.push(manager.profile_id);

    // Seed the announcement with the admin's own profile as sender.
    // Admin is always a valid profile in this workspace.
    const { messageId: mid } = await seedNewsAnnouncement({
      workspaceId,
      senderId: adminProfileId,
      title: "Critical safety notice",
      body: "All staff please read.",
    });
    messageId = mid;
    seededIds.messages.push(messageId);
  });

  test.afterEach(async () => {
    // Targeted cleanup — only remove entities we inserted. Do NOT call
    // cleanupTestData (it would delete the admin's real workspace data).
    if (seededIds.messages.length > 0) {
      await supabase.from("channel_message").delete().in("id", seededIds.messages);
    }
    // Delete profiles before auth users (FK order: profile.user_id → auth.users.id)
    if (seededIds.profiles.length > 0) {
      await supabase.from("profile").delete().in("profile_id", seededIds.profiles);
    }
    await cleanupSeededAuthUsers(getSeededAuthUserIds());
    if (seededIds.departments.length > 0) {
      await supabase.from("department").delete().in("department_id", seededIds.departments);
    }
  });

  test("manager clicks Fest øverst → DB has is_pinned=true + pinned_by + pinned_at + activity_trail row", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/dashboard/komm/nyheter");

    // Wait for the seeded announcement card to render before clicking context menu.
    await expect(page.getByText("Critical safety notice")).toBeVisible({ timeout: 15000 });

    // aria-label is t("nyheter.card_menu_label") = "Mer" (nb) / "More" (en)
    await page.getByRole("button", { name: /mer/i }).first().click();
    await page.getByRole("menuitem", { name: /fest øverst/i }).click();
    await expect(page.getByText(/festet øverst/i)).toBeVisible();

    // Service-role assertion on channel_message row
    const { data: rows } = await supabase
      .from("channel_message")
      .select("is_pinned, pinned_by, pinned_at")
      .eq("id", messageId)
      .single();
    expect(rows?.is_pinned).toBe(true);
    expect(rows?.pinned_by).toBeTruthy();
    expect(rows?.pinned_at).toBeTruthy();

    // Service-role assertion on activity_trail row (channel.message.pinned)
    const { data: audit } = await supabase
      .from("activity_trail")
      .select("event, entity_id, properties")
      .eq("workspace_id", workspaceId)
      .eq("event", "channel.message.pinned")
      .order("created_at", { ascending: false })
      .limit(1);
    expect(audit?.[0]).toBeDefined();
    expect(audit?.[0]?.entity_id).toBe(messageId);
  });

  test("manager unpins → DB has is_pinned=false + null pinned_by/pinned_at + activity_trail unpinned row", async ({
    page,
  }) => {
    // Pre-pin via service role so the spec starts in pinned state.
    // Use adminProfileId as pinned_by — it's a real profile FK in this workspace.
    await supabase
      .from("channel_message")
      .update({
        is_pinned: true,
        pinned_by: adminProfileId,
        pinned_at: new Date().toISOString(),
      })
      .eq("id", messageId);

    await loginAsAdmin(page);
    await page.goto("/dashboard/komm/nyheter");

    // Strip header must be present pre-unpin
    await expect(page.getByRole("heading", { name: /festet/i })).toBeVisible();

    // Click inline Løsne in the strip
    await page.getByRole("button", { name: /løsne/i }).first().click();
    await expect(page.getByRole("heading", { name: /festet/i })).toHaveCount(0);

    const { data: rows } = await supabase
      .from("channel_message")
      .select("is_pinned, pinned_by, pinned_at")
      .eq("id", messageId)
      .single();
    expect(rows?.is_pinned).toBe(false);
    expect(rows?.pinned_by).toBeNull();
    expect(rows?.pinned_at).toBeNull();

    const { data: audit } = await supabase
      .from("activity_trail")
      .select("event, entity_id")
      .eq("workspace_id", workspaceId)
      .eq("event", "channel.message.unpinned")
      .order("created_at", { ascending: false })
      .limit(1);
    expect(audit?.[0]?.entity_id).toBe(messageId);
  });
});
