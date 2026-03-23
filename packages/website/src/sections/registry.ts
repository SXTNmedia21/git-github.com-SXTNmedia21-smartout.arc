import type { ZodSchema } from "zod";

import { heroContentSchema, heroDefaults } from "./schemas/hero";
import { richTextContentSchema, richTextDefaults } from "./schemas/rich-text";
import { textImageContentSchema, textImageDefaults } from "./schemas/text-image";
import { featureGridContentSchema, featureGridDefaults } from "./schemas/feature-grid";
import { galleryContentSchema, galleryDefaults } from "./schemas/gallery";
import { testimonialsContentSchema, testimonialsDefaults } from "./schemas/testimonials";
import { ctaContentSchema, ctaDefaults } from "./schemas/cta";
import { hoursContentSchema, hoursDefaults } from "./schemas/hours";
import { mapContentSchema, mapDefaults } from "./schemas/map";
import { contactContentSchema, contactDefaults } from "./schemas/contact";
import { menuPreviewContentSchema, menuPreviewDefaults } from "./schemas/menu-preview";
import { menuFullContentSchema, menuFullDefaults } from "./schemas/menu-full";
import { faqContentSchema, faqDefaults } from "./schemas/faq";
import { bookingCtaContentSchema, bookingCtaDefaults } from "./schemas/booking-cta";
import { pdfViewerContentSchema, pdfViewerDefaults } from "./schemas/pdf-viewer";
import { footerContentSchema, footerDefaults } from "./schemas/footer";
import { spokespersonContentSchema, spokespersonDefaults } from "./schemas/spokesperson";

export type SectionDefinition<T = unknown> = {
  type: string;
  name: string;
  description: string;
  schema: ZodSchema<T>;
  defaults: T;
  allowedPageTypes?: string[];
  maxPerPage?: number;
};

const SECTION_REGISTRY = new Map<string, SectionDefinition>();

export function registerSection<T>(def: SectionDefinition<T>): void {
  SECTION_REGISTRY.set(def.type, def as SectionDefinition);
}

export function getSectionDef(type: string): SectionDefinition | undefined {
  return SECTION_REGISTRY.get(type);
}

export function getAllSectionDefs(): SectionDefinition[] {
  return Array.from(SECTION_REGISTRY.values());
}

// Register all 16 section types

registerSection({
  type: "hero",
  name: "Hero",
  description: "Full-width hero section with heading, image, and CTA",
  schema: heroContentSchema,
  defaults: heroDefaults,
  maxPerPage: 1,
});

registerSection({
  type: "rich_text",
  name: "Rich Text",
  description: "Free-form rich text content block",
  schema: richTextContentSchema,
  defaults: richTextDefaults,
});

registerSection({
  type: "text_image",
  name: "Text & Image",
  description: "Side-by-side text and image layout",
  schema: textImageContentSchema,
  defaults: textImageDefaults,
});

registerSection({
  type: "feature_grid",
  name: "Feature Grid",
  description: "Grid of feature cards with icons",
  schema: featureGridContentSchema,
  defaults: featureGridDefaults,
});

registerSection({
  type: "gallery",
  name: "Gallery",
  description: "Image gallery with multiple layout options",
  schema: galleryContentSchema,
  defaults: galleryDefaults,
});

registerSection({
  type: "testimonials",
  name: "Testimonials",
  description: "Customer reviews and testimonials",
  schema: testimonialsContentSchema,
  defaults: testimonialsDefaults,
});

registerSection({
  type: "cta",
  name: "Call to Action",
  description: "Prominent call-to-action banner",
  schema: ctaContentSchema,
  defaults: ctaDefaults,
});

registerSection({
  type: "hours",
  name: "Opening Hours",
  description: "Weekly opening hours schedule",
  schema: hoursContentSchema,
  defaults: hoursDefaults,
});

registerSection({
  type: "map",
  name: "Map",
  description: "Embedded map showing location",
  schema: mapContentSchema,
  defaults: mapDefaults,
});

registerSection({
  type: "contact",
  name: "Contact",
  description: "Contact information display",
  schema: contactContentSchema,
  defaults: contactDefaults,
});

registerSection({
  type: "menu_preview",
  name: "Menu Preview",
  description: "Preview of selected menu items with link to full menu",
  schema: menuPreviewContentSchema,
  defaults: menuPreviewDefaults,
});

registerSection({
  type: "menu_full",
  name: "Full Menu",
  description: "Complete menu display with categories and items",
  schema: menuFullContentSchema,
  defaults: menuFullDefaults,
  allowedPageTypes: ["menu", "custom"],
});

registerSection({
  type: "faq",
  name: "FAQ",
  description: "Frequently asked questions accordion",
  schema: faqContentSchema,
  defaults: faqDefaults,
});

registerSection({
  type: "booking_cta",
  name: "Booking CTA",
  description: "Reservation call-to-action with provider integration",
  schema: bookingCtaContentSchema,
  defaults: bookingCtaDefaults,
  maxPerPage: 1,
});

registerSection({
  type: "pdf_viewer",
  name: "PDF Viewer",
  description: "Embedded PDF document viewer with download option",
  schema: pdfViewerContentSchema,
  defaults: pdfViewerDefaults,
});

registerSection({
  type: "footer",
  name: "Footer",
  description: "Site footer with contact, social, and copyright",
  schema: footerContentSchema,
  defaults: footerDefaults,
  maxPerPage: 1,
});

registerSection({
  type: "spokesperson",
  name: "Talsperson",
  description: "Fremhev en ansatt som talsperson for virksomheten",
  schema: spokespersonContentSchema,
  defaults: spokespersonDefaults,
  maxPerPage: 1,
});
