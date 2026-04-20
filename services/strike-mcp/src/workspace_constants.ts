/**
 * workspace_constants.ts — per-workspace Bubble IDs for strike-mcp migrations.
 *
 * Centralized so adding a new workspace doesn't require code changes in each
 * script. To add a tenant: append a new slug → constants mapping below, then
 * run `STRIKE_WORKSPACE_SLUG=<new-slug> pnpm tsx scripts/...`.
 *
 * PER-WORKSPACE CONSTANTS:
 *   - bubbleWorkspaceId: the Bubble `_id` of the workspace record itself.
 *     Used to (a) filter every ws-scoped Bubble query, (b) derive the v3
 *     workspace_id via uuidv5.
 *   - bookkeeperBubbleProfileId: the Bubble `_id` of the admin profile used as
 *     `created_by` / `owner_profile_id` on auto-generated bookkeeping rows
 *     (bookkeeping policy, protocol, etc. in Tier 2). Must be a profile that
 *     Tier 1 already migrates (so the v3 profile row exists by the time Tier 2
 *     references it).
 *
 * If a workspace is not in this table, scripts throw on lookup. Failing loudly
 * beats silently migrating to the wrong workspace.
 */

export interface WorkspaceConstants {
  /** Bubble workspace record _id (used as the value for ws-scoped constraints). */
  bubbleWorkspaceId: string;
  /** Bubble profile _id of the admin who "owns" auto-generated Tier 2 rows. */
  bookkeeperBubbleProfileId: string;
  /** Human-readable name (for logs only). */
  displayName: string;
}

const WORKSPACE_TABLE: Record<string, WorkspaceConstants> = {
  wrightegaarden: {
    bubbleWorkspaceId: "1683059156689x546199168715701950",
    // profileId 1683059157430x101700354381603740 = "Pontus lindroth W"
    // verified via mappings/.local/profiles.sidecar.json 2026-04-17.
    bookkeeperBubbleProfileId: "1683059157430x101700354381603740",
    displayName: "Wrightegaarden Langesund AS",
  },
  // Future workspaces: add entries here.
  // Example:
  // "strom-mat-og-bar": {
  //   bubbleWorkspaceId: "1675220407080x794481244847879300",
  //   bookkeeperBubbleProfileId: "<admin-profile-bubble-id>",
  //   displayName: "Strøm Mat & Bar",
  // },
};

export function getWorkspaceConstants(slug: string): WorkspaceConstants {
  const hit = WORKSPACE_TABLE[slug];
  if (!hit) {
    const known = Object.keys(WORKSPACE_TABLE).join(", ") || "(none)";
    throw new Error(
      `Unknown workspace slug "${slug}". Add it to src/workspace_constants.ts. Known: ${known}`,
    );
  }
  return hit;
}

export function workspaceBubbleId(slug: string): string {
  return getWorkspaceConstants(slug).bubbleWorkspaceId;
}

export function bookkeeperBubbleProfileId(slug: string): string {
  return getWorkspaceConstants(slug).bookkeeperBubbleProfileId;
}
