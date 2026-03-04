"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type {
  BlockProps,
  LandingBlockType,
  BlockSettings,
  VariantTheme,
} from "../../lib/block-schemas";
import { ThemeProvider } from "./ThemeProvider";

// Dynamic imports for code-splitting — each block loads only when used
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- content is validated at schema level
const BLOCK_MAP: Record<LandingBlockType, ComponentType<BlockProps<any>>> = {
  hero: dynamic(() => import("./HeroBlock")),
  features_grid: dynamic(() => import("./FeaturesGridBlock")),
  features_list: dynamic(() => import("./FeaturesListBlock")),
  features_icons: dynamic(() => import("./FeaturesIconsBlock")),
  cta_section: dynamic(() => import("./CtaSectionBlock")),
  stats: dynamic(() => import("./StatsBlock")),
  testimonial: dynamic(() => import("./TestimonialBlock")),
  case_study: dynamic(() => import("./CaseStudyBlock")),
  voice_widget: dynamic(() => import("./VoiceWidgetBlock"), { ssr: false }),
  workspace_analyzer: dynamic(() => import("./WorkspaceAnalyzerBlock"), {
    ssr: false,
  }),
  text_section: dynamic(() => import("./TextSectionBlock")),
  image_section: dynamic(() => import("./ImageSectionBlock")),
  pricing_preview: dynamic(() => import("./PricingPreviewBlock")),
  faq: dynamic(() => import("./FaqBlock")),
  logo_strip: dynamic(() => import("./LogoStripBlock")),
};

type Block = {
  id: string;
  block_type: LandingBlockType;
  content: unknown;
  settings: BlockSettings;
  is_visible: boolean;
};

type BlockRendererProps = {
  blocks: Block[];
  theme: VariantTheme;
};

export function BlockRenderer({ blocks, theme }: BlockRendererProps) {
  return (
    <ThemeProvider theme={theme}>
      {blocks
        .filter((b) => b.is_visible)
        .map((block) => {
          const Component = BLOCK_MAP[block.block_type];
          if (!Component) return null;
          return <Component key={block.id} content={block.content} settings={block.settings} />;
        })}
    </ThemeProvider>
  );
}
