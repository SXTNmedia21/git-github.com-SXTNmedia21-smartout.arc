import { lazy, type ComponentType } from "react";

// Props every editor receives from SectionForm.
// Individual editors use typed content internally, but the registry
// treats content as opaque JSON — the Zod schema inside each editor
// handles validation.
export type EditorProps = {
  content: Record<string, unknown>;
  onChange: (content: Record<string, unknown>) => void;
  websiteId: string;
  // sectionId is needed by editors that maintain server-side records tied to
  // the section (e.g. SpokespersonEditor tracks the website_spokesperson table).
  sectionId: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EditorModule = { default: ComponentType<any> };
type EditorLoader = () => Promise<EditorModule>;

// Maps section_type string → lazy-loaded editor component
const editors: Record<string, EditorLoader> = {
  hero: () => import("./HeroEditor"),
  rich_text: () => import("./RichTextEditor"),
  text_image: () => import("./TextImageEditor"),
  feature_grid: () => import("./FeatureGridEditor"),
  gallery: () => import("./GalleryEditor"),
  testimonials: () => import("./TestimonialsEditor"),
  cta: () => import("./CtaEditor"),
  faq: () => import("./FaqEditor"),
  footer: () => import("./FooterEditor"),
  hours: () => import("./HoursEditor"),
  map: () => import("./MapEditor"),
  contact: () => import("./ContactEditor"),
  menu_preview: () => import("./MenuPreviewEditor"),
  menu_full: () => import("./MenuFullEditor"),
  booking_cta: () => import("./BookingCtaEditor"),
  pdf_viewer: () => import("./PdfViewerEditor"),
  spokesperson: () => import("./SpokespersonEditor"),
};

// Cache lazy components so we never call lazy() more than once per type
const lazyCache = new Map<string, ComponentType<EditorProps>>();

/**
 * Returns a lazy-loaded editor component for the given section type,
 * or null if no editor is registered for that type.
 */
export function getEditor(sectionType: string): ComponentType<EditorProps> | null {
  const loader = editors[sectionType];
  if (!loader) return null;
  let cached = lazyCache.get(sectionType);
  if (!cached) {
    cached = lazy(loader) as unknown as ComponentType<EditorProps>;
    lazyCache.set(sectionType, cached);
  }
  return cached;
}
