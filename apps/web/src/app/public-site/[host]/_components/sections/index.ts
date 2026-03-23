import type { SectionComponent } from "./types";

import { HeroPublic } from "./HeroPublic";
import { RichTextPublic } from "./RichTextPublic";
import { TextImagePublic } from "./TextImagePublic";
import { FeatureGridPublic } from "./FeatureGridPublic";
import { GalleryPublic } from "./GalleryPublic";
import { TestimonialsPublic } from "./TestimonialsPublic";
import { CtaPublic } from "./CtaPublic";
import { HoursPublic } from "./HoursPublic";
import { MapPublic } from "./MapPublic";
import { ContactPublic } from "./ContactPublic";
import { MenuPreviewPublic } from "./MenuPreviewPublic";
import { MenuFullPublic } from "./MenuFullPublic";
import { FaqPublic } from "./FaqPublic";
import { BookingCtaPublic } from "./BookingCtaPublic";
import { PdfViewerPublic } from "./PdfViewerPublic";
import { FooterPublic } from "./FooterPublic";

export type { PublicSectionProps, SectionComponent } from "./types";

export const PUBLIC_SECTION_MAP: Record<string, SectionComponent> = {
  hero: HeroPublic,
  rich_text: RichTextPublic,
  text_image: TextImagePublic,
  feature_grid: FeatureGridPublic,
  gallery: GalleryPublic,
  testimonials: TestimonialsPublic,
  cta: CtaPublic,
  hours: HoursPublic,
  map: MapPublic,
  contact: ContactPublic,
  menu_preview: MenuPreviewPublic,
  menu_full: MenuFullPublic,
  faq: FaqPublic,
  booking_cta: BookingCtaPublic,
  pdf_viewer: PdfViewerPublic,
  footer: FooterPublic,
};
