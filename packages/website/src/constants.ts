export const SCHEMA_VERSION = 1;

export const SECTION_TYPES = [
  "hero",
  "rich_text",
  "text_image",
  "feature_grid",
  "gallery",
  "testimonials",
  "cta",
  "hours",
  "map",
  "contact",
  "menu_preview",
  "menu_full",
  "faq",
  "booking_cta",
  "pdf_viewer",
  "footer",
] as const;

export type SectionType = (typeof SECTION_TYPES)[number];

export const LIMITS = {
  maxPagesPerSite: 20,
  maxSectionsPerPage: 30,
  maxMenusPerSite: 10,
  maxMenuItemsPerMenu: 200,
  maxAssetsPerSite: 500,
  maxSnapshotSizeBytes: 2 * 1024 * 1024, // 2 MB
  maxActivePreviewTokens: 50,
  previewTokenTtlMs: 24 * 60 * 60 * 1000, // 24 hours
  maxImageUploadBytes: 5 * 1024 * 1024, // 5 MB
  maxPdfUploadBytes: 20 * 1024 * 1024, // 20 MB
} as const;
