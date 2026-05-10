import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";
import { supabase, seedWorkspace, seedDepartment, seedProfile } from "../helpers/seed";
import { cleanupTestData } from "../helpers/cleanup";

async function seedNewsAnnouncement(opts: {
  workspaceId: string;
  senderId: string;
  title: string;
  body: string;
}) {
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

  await supabase.from("channel_message").insert({
    workspace_id: opts.workspaceId,
    channel_id: channelId,
    sender_id: opts.senderId,
    content: `${opts.title}\n${opts.body}`,
    message_type: "announcement",
  });
}

test.describe("Nyheter journey 3 — pin/unpin writes correct DB shape + audit", () => {
  let workspaceId: string;
  let managerProfileId: string;
  let messageId: string;

  test.beforeEach(async () => {
    const ws = await seedWorkspace({ name: "Strøm Mat & Bar", slug: "strom-mat-og-bar" });
    workspaceId = ws.workspace_id;
    await seedDepartment(workspaceId, { name: "Kjøkken" });
    const manager = await seedProfile(workspaceId, {
      display_name: "Sofia Manager",
      role: "manager",
    });
    managerProfileId = manager.profile_id;
    await seedNewsAnnouncement({
      workspaceId,
      senderId: managerProfileId,
      title: "Critical safety notice",
      body: "All staff please read.",
    });
    // Capture the message id we just inserted so we can assert against it
    const { data: rows } = await supabase
      .from("channel_message")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("message_type", "announcement")
      .order("created_at", { ascending: false })
      .limit(1);
    messageId = rows?.[0]?.id ?? "";
  });

  test.afterEach(async () => {
    await cleanupTestData(workspaceId);
  });

  test("manager clicks Fest øverst → DB has is_pinned=true + pinned_by + pinned_at + activity_trail row", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/dashboard/komm/nyheter");

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
      .select("event_name, entity_id, properties")
      .eq("workspace_id", workspaceId)
      .eq("event_name", "channel.message.pinned")
      .order("created_at", { ascending: false })
      .limit(1);
    expect(audit?.[0]).toBeDefined();
    expect(audit?.[0]?.entity_id).toBe(messageId);
  });

  test("manager unpins → DB has is_pinned=false + null pinned_by/pinned_at + activity_trail unpinned row", async ({
    page,
  }) => {
    // Pre-pin via service role so the spec starts in pinned state
    await supabase
      .from("channel_message")
      .update({
        is_pinned: true,
        pinned_by: managerProfileId,
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
      .select("event_name, entity_id")
      .eq("workspace_id", workspaceId)
      .eq("event_name", "channel.message.unpinned")
      .order("created_at", { ascending: false })
      .limit(1);
    expect(audit?.[0]?.entity_id).toBe(messageId);
  });
});
