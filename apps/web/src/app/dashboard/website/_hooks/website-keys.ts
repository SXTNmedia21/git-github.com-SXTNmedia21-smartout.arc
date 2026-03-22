/**
 * TanStack Query key factory for all website builder queries.
 * Structured for granular invalidation — invalidating websiteKeys.all() clears everything,
 * while websiteKeys.sections(pageId) clears only one page's sections.
 */
export const websiteKeys = {
  all: ["website"] as const,
  website: (workspaceId: string) => ["website", "site", workspaceId] as const,
  pages: (websiteId: string) => ["website", "pages", websiteId] as const,
  sections: (pageId: string) => ["website", "sections", pageId] as const,
  templates: () => ["website", "templates"] as const,
  spokesperson: (sectionId: string) => ["website", "spokesperson", sectionId] as const,
};
