/**
 * Centralized route definitions for platform-admin.
 * Keeps URLs production-safe and easy to refactor.
 */
export const platformAdminRoutes = {
  root: "/platform-admin",
  services: "/platform-admin/services",
  serviceDetail: (slug: string) => `/platform-admin/services/${slug}` as const,
  keys: "/platform-admin/keys",
  health: "/platform-admin/health",
  walkthrough: "/dashboard?autoplay=1&showcase=1",
} as const;
