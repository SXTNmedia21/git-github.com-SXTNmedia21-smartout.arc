// Types
export type {
  WebsiteTheme,
  SectionSettings,
  SiteSnapshot,
  SnapshotNavPage,
  SnapshotPage,
  SnapshotSection,
  SnapshotMenu,
  SnapshotMenuCategory,
  SnapshotMenuItem,
  SnapshotAsset,
  BuildMeta,
  DomainType,
  DomainStatus,
  SslStatus,
  RedirectBehavior,
  SiteVisibility,
  PageType,
  BookingProvider,
  MenuSourceType,
  PublishAction,
  DraftSource,
  ContactAddress,
  SocialLinks,
} from "./types";

// Constants
export { SCHEMA_VERSION, SECTION_TYPES, LIMITS } from "./constants";
export type { SectionType } from "./constants";

// Section schemas — export everything including individual schemas and types for editor components
export * from "./sections/schemas";

// Section registry
export { registerSection, getSectionDef, getAllSectionDefs } from "./sections/registry";
export type { SectionDefinition } from "./sections/registry";

// Template registry
export { getTemplate, getAllTemplates } from "./templates/registry";
export type { WebsiteTemplate, TemplatePage } from "./templates/registry";

// Validation
export { hashSnapshot, validateSnapshotSize } from "./validation/snapshot";
export { validateSectionContent } from "./validation/section";
