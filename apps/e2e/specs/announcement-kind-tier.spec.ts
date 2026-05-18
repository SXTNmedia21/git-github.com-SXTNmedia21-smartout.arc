import { test } from "@playwright/test";

/**
 * Announcement V2 — kind / tier / entity-link E2E spec stubs
 *
 * WHY SKIPPED: Composer pickers (AnnouncementKindPicker, AnnouncementTierPicker,
 * EntityLinkPicker) are deferred to Track E. Happy-path UI flows cannot execute
 * until pickers are mounted in ComposeAnnouncement + AnnounceSheet. Flip
 * `describe.skip` → `describe` and fill in steps after Track E ships.
 *
 * Related:
 *   - docs/journeys/JOURNEY-announce-kind-tier-link.md — journey specs these tests cover
 *   - docs/HANDOFF-announce-kind-tier-link.md — known issues / deferred items
 *   - apps/e2e/komm-nyheter/ — Wave A journey tests (passing)
 */

// TODO: enable after Track E pickers ship
test.describe
  .skip("Announcement V2: kind/tier/entity-link (TODO: enable after Track E pickers ship)", () => {
  test("admin publishes celebration tier=social via ComposeAnnouncement modal", async ({
    page,
  }) => {
    // TODO: requires AnnouncementKindPicker + AnnouncementTierPicker (Track E)
    // Steps (from JOURNEY-announce-kind-tier-link.md Journey 1):
    //   1. loginAsAdmin(page)
    //   2. navigate to /dashboard/komm/nyheter
    //   3. click "Skriv ny" → ComposeAnnouncement modal opens
    //   4. fill title + body
    //   5. open AnnouncementKindPicker → select "celebration"
    //   6. verify tier auto-suggests "social"
    //   7. click Publiser
    //   8. expect: announcement_meta row has kind='celebration', tier='social'
    //   9. expect: TierBadge visible on published card
  });

  test("manager publishes external tier announcement → email channel allowed", async ({ page }) => {
    // TODO: requires TierPicker (Track E) + verify notification_outbox.allowed_channels contains 'email'
    // Steps (from JOURNEY-announce-kind-tier-link.md Journey 2):
    //   1. loginAsManager(page)
    //   2. open AnnounceSheet (header Ny → Nyhet)
    //   3. fill body with urgent content
    //   4. select kind="urgent" → verify tier auto-suggests "external"
    //   5. confirm tier="external"
    //   6. click Publiser
    //   7. expect: notification_outbox rows contain channel='email'
    //   8. expect: TierBadge shows external-tier accent colour
  });

  test("entity-link picker links announcement to staff_event", async ({ page }) => {
    // TODO: requires EntityLinkPicker (Track E) + EntityLinkCTA renderer (Track G)
    // Steps (from JOURNEY-announce-kind-tier-link.md Journey 3 — UI variant):
    //   1. loginAsAdmin(page)
    //   2. navigate to /dashboard/komm/nyheter → open ComposeAnnouncement
    //   3. open EntityLinkPicker → search for an existing staff_event
    //   4. select staff_event → verify entity_link_type + linked_entity_id in draft
    //   5. click Publiser
    //   6. expect: announcement_meta.entity_link_type = 'staff_event'
    //   7. expect: EntityLinkCTA visible in published card (web)
  });

  test("publishing without kind defaults to workspace_news + tier=work", async ({ page }) => {
    // TODO: requires composer + verify announcement_meta row has defaults
    // Steps:
    //   1. loginAsAdmin(page)
    //   2. open ComposeAnnouncement
    //   3. fill title + body — do NOT interact with kind/tier pickers
    //   4. click Publiser
    //   5. query announcement_meta for the new row
    //   6. expect: kind='workspace_news', tier='work', entity_link_type=NULL
    //   7. expect: TierBadge renders 'work' tier (neutral colour)
  });
});
