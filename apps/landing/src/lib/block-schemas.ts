import { z } from "zod";

// ──── Shared sub-schemas ────

const buttonSchema = z.object({
  label: z.string(),
  href: z.string(),
  style: z.enum(["primary", "outline", "ghost"]).default("primary"),
});

const mediaRefSchema = z.object({
  media_id: z.string().uuid(),
  alt: z.string().default(""),
});

// ──── Block content schemas ────

export const heroContentSchema = z.object({
  heading: z.string(),
  subheading: z.string().default(""),
  buttons: z.array(buttonSchema).default([]),
  image: mediaRefSchema.optional(),
  image_position: z.enum(["right", "below"]).default("right"),
  alignment: z.enum(["left", "center"]).default("center"),
});

export const featuresGridContentSchema = z.object({
  heading: z.string().default(""),
  items: z
    .array(
      z.object({
        icon: z.string(),
        title: z.string(),
        description: z.string().default(""),
      }),
    )
    .default([]),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
});

export const featuresListContentSchema = z.object({
  heading: z.string().default(""),
  items: z
    .array(
      z.object({
        icon: z.string(),
        title: z.string(),
        description: z.string(),
      }),
    )
    .default([]),
});

export const featuresIconsContentSchema = z.object({
  heading: z.string().default(""),
  items: z
    .array(
      z.object({
        icon: z.string(),
        label: z.string(),
      }),
    )
    .default([]),
});

export const ctaSectionContentSchema = z.object({
  heading: z.string(),
  subheading: z.string().default(""),
  buttons: z.array(buttonSchema).default([]),
  background: z.enum(["dark", "accent", "gradient"]).default("dark"),
});

export const statsContentSchema = z.object({
  heading: z.string().default(""),
  items: z
    .array(
      z.object({
        value: z.string(),
        label: z.string(),
        suffix: z.string().default(""),
      }),
    )
    .default([]),
});

export const testimonialContentSchema = z.object({
  quote: z.string(),
  name: z.string(),
  role: z.string().default(""),
  company: z.string().default(""),
  image: mediaRefSchema.optional(),
});

export const caseStudyContentSchema = z.object({
  heading: z.string(),
  company: z.string(),
  quote: z.string().default(""),
  author_name: z.string().default(""),
  author_role: z.string().default(""),
  metrics: z
    .array(
      z.object({
        value: z.string(),
        label: z.string(),
      }),
    )
    .default([]),
});

export const voiceWidgetContentSchema = z.object({
  heading: z.string().default(""),
  subheading: z.string().default(""),
});

export const workspaceAnalyzerContentSchema = z.object({
  heading: z.string().default(""),
  subheading: z.string().default(""),
});

export const textSectionContentSchema = z.object({
  heading: z.string().default(""),
  body: z.string().default(""),
});

export const imageSectionContentSchema = z.object({
  image: mediaRefSchema,
  caption: z.string().default(""),
  max_width: z.enum(["sm", "md", "lg", "full"]).default("lg"),
});

export const pricingPreviewContentSchema = z.object({
  heading: z.string().default(""),
  subheading: z.string().default(""),
  cta_label: z.string().default("Se priser"),
  cta_href: z.string().default("/pricing"),
});

export const faqContentSchema = z.object({
  heading: z.string().default(""),
  items: z
    .array(
      z.object({
        question: z.string(),
        answer: z.string(),
      }),
    )
    .default([]),
});

export const logoStripContentSchema = z.object({
  heading: z.string().default(""),
  logos: z
    .array(
      z.object({
        image: mediaRefSchema,
        name: z.string(),
      }),
    )
    .default([]),
});

// ──── Schema map ────

export const BLOCK_CONTENT_SCHEMAS = {
  hero: heroContentSchema,
  features_grid: featuresGridContentSchema,
  features_list: featuresListContentSchema,
  features_icons: featuresIconsContentSchema,
  cta_section: ctaSectionContentSchema,
  stats: statsContentSchema,
  testimonial: testimonialContentSchema,
  case_study: caseStudyContentSchema,
  voice_widget: voiceWidgetContentSchema,
  workspace_analyzer: workspaceAnalyzerContentSchema,
  text_section: textSectionContentSchema,
  image_section: imageSectionContentSchema,
  pricing_preview: pricingPreviewContentSchema,
  faq: faqContentSchema,
  logo_strip: logoStripContentSchema,
} as const;

// ──── Inferred types ────

export type HeroContent = z.infer<typeof heroContentSchema>;
export type FeaturesGridContent = z.infer<typeof featuresGridContentSchema>;
export type FeaturesListContent = z.infer<typeof featuresListContentSchema>;
export type FeaturesIconsContent = z.infer<typeof featuresIconsContentSchema>;
export type CtaSectionContent = z.infer<typeof ctaSectionContentSchema>;
export type StatsContent = z.infer<typeof statsContentSchema>;
export type TestimonialContent = z.infer<typeof testimonialContentSchema>;
export type CaseStudyContent = z.infer<typeof caseStudyContentSchema>;
export type VoiceWidgetContent = z.infer<typeof voiceWidgetContentSchema>;
export type WorkspaceAnalyzerContent = z.infer<typeof workspaceAnalyzerContentSchema>;
export type TextSectionContent = z.infer<typeof textSectionContentSchema>;
export type ImageSectionContent = z.infer<typeof imageSectionContentSchema>;
export type PricingPreviewContent = z.infer<typeof pricingPreviewContentSchema>;
export type FaqContent = z.infer<typeof faqContentSchema>;
export type LogoStripContent = z.infer<typeof logoStripContentSchema>;

export type LandingBlockType = keyof typeof BLOCK_CONTENT_SCHEMAS;

// ──── Block settings schema (shared across all blocks) ────

export const blockSettingsSchema = z
  .object({
    layout: z.enum(["default", "wide", "narrow"]).default("default"),
    background: z.enum(["none", "subtle", "dark"]).default("none"),
    padding: z.enum(["sm", "md", "lg"]).default("md"),
  })
  .default({});

export type BlockSettings = z.infer<typeof blockSettingsSchema>;

// ──── Variant theme schema ────

export const variantThemeSchema = z.object({
  accent: z.string().default("orange"),
  accentColor: z.string().default("234 88% 55%"),
  accentForeground: z.string().default("0 0% 100%"),
});

export type VariantTheme = z.infer<typeof variantThemeSchema>;

// ──── Block props type for render components ────

export type BlockProps<T = unknown> = {
  content: T;
  settings: BlockSettings;
};
