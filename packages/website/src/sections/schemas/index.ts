import type { ZodSchema } from "zod";
import type { SectionType } from "../../constants";

export { sectionSettingsSchema, defaultSectionSettings } from "./settings";
export type { SectionSettingsFromSchema } from "./settings";

export { heroContentSchema, heroDefaults } from "./hero";
export type { HeroContent } from "./hero";

export { richTextContentSchema, richTextDefaults } from "./rich-text";
export type { RichTextContent } from "./rich-text";

export { textImageContentSchema, textImageDefaults } from "./text-image";
export type { TextImageContent } from "./text-image";

export { featureGridContentSchema, featureGridDefaults } from "./feature-grid";
export type { FeatureGridContent } from "./feature-grid";

export { galleryContentSchema, galleryDefaults } from "./gallery";
export type { GalleryContent } from "./gallery";

export { testimonialsContentSchema, testimonialsDefaults } from "./testimonials";
export type { TestimonialsContent } from "./testimonials";

export { ctaContentSchema, ctaDefaults } from "./cta";
export type { CtaContent } from "./cta";

export { hoursContentSchema, hoursDefaults } from "./hours";
export type { HoursContent } from "./hours";

export { mapContentSchema, mapDefaults } from "./map";
export type { MapContent } from "./map";

export { contactContentSchema, contactDefaults } from "./contact";
export type { ContactContent } from "./contact";

export { menuPreviewContentSchema, menuPreviewDefaults } from "./menu-preview";
export type { MenuPreviewContent } from "./menu-preview";

export { menuFullContentSchema, menuFullDefaults } from "./menu-full";
export type { MenuFullContent } from "./menu-full";

export { faqContentSchema, faqDefaults } from "./faq";
export type { FaqContent } from "./faq";

export { bookingCtaContentSchema, bookingCtaDefaults } from "./booking-cta";
export type { BookingCtaContent } from "./booking-cta";

export { pdfViewerContentSchema, pdfViewerDefaults } from "./pdf-viewer";
export type { PdfViewerContent } from "./pdf-viewer";

export { footerContentSchema, footerDefaults } from "./footer";
export type { FooterContent } from "./footer";

import { heroContentSchema } from "./hero";
import { richTextContentSchema } from "./rich-text";
import { textImageContentSchema } from "./text-image";
import { featureGridContentSchema } from "./feature-grid";
import { galleryContentSchema } from "./gallery";
import { testimonialsContentSchema } from "./testimonials";
import { ctaContentSchema } from "./cta";
import { hoursContentSchema } from "./hours";
import { mapContentSchema } from "./map";
import { contactContentSchema } from "./contact";
import { menuPreviewContentSchema } from "./menu-preview";
import { menuFullContentSchema } from "./menu-full";
import { faqContentSchema } from "./faq";
import { bookingCtaContentSchema } from "./booking-cta";
import { pdfViewerContentSchema } from "./pdf-viewer";
import { footerContentSchema } from "./footer";

/** Maps section type string to its Zod content schema. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const SECTION_SCHEMA_MAP: Record<SectionType, ZodSchema<any>> = {
  hero: heroContentSchema,
  rich_text: richTextContentSchema,
  text_image: textImageContentSchema,
  feature_grid: featureGridContentSchema,
  gallery: galleryContentSchema,
  testimonials: testimonialsContentSchema,
  cta: ctaContentSchema,
  hours: hoursContentSchema,
  map: mapContentSchema,
  contact: contactContentSchema,
  menu_preview: menuPreviewContentSchema,
  menu_full: menuFullContentSchema,
  faq: faqContentSchema,
  booking_cta: bookingCtaContentSchema,
  pdf_viewer: pdfViewerContentSchema,
  footer: footerContentSchema,
};
