/**
 * TanStack Query key factory for timeline-template hooks.
 *
 * Kept in a separate file (not merged into dashboard-keys.ts) so the
 * timeline-template key shapes stay visible alongside the hooks that use them.
 *
 * Key collision guard (learning_tanstack_query_shape_collision.md):
 *   Each key function has a distinct shape suffix so cache entries don't
 *   collide across hooks with different return shapes. Specifically:
 *     timelineTemplates → list shape (array of template rows)
 *   Timeline events live in the existing dashboard-keys "day-control" namespace
 *   (use-day-timeline-events.ts) — do NOT add a "day-control" key here.
 *
 * Spec ref: docs/superpowers/specs/2026-05-16-timeline-templates-design.md §Data hooks
 * ADR ref:  ADR-0334
 */

export type TimelineTemplateScope = {
  scopeType: "team" | "department" | "location" | "shift";
  scopeId: string;
};

export const timelineTemplateKeys = {
  /** Root prefix — invalidate everything timeline-template at once. */
  all: ["timeline-template"] as const,

  /**
   * List of templates for a workspace + scope combination.
   * Include the includeArchived flag so archived/active lists are cached
   * independently — prevents stale list after archive toggle.
   */
  list: (workspaceId: string, scopeType: string, scopeId: string, includeArchived: boolean) =>
    ["timeline-template", "list", workspaceId, scopeType, scopeId, includeArchived] as const,
};
