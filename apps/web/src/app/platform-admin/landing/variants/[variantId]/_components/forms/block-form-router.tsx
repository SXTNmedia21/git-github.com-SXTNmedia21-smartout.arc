// ============================================
// block-form-router.tsx — Routes block_type to the correct edit form
// Maps each block_type string to its dedicated form component.
// Falls back to a JSON textarea for unknown block types.
//
// Connected to: block-card.tsx (renders inside expanded area)
//               All form files in this directory
// ============================================

"use client";

import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

import { HeroForm } from "./hero-form";
import { FeaturesGridForm } from "./features-grid-form";
import { FeaturesListForm } from "./features-list-form";
import { FeaturesIconsForm } from "./features-icons-form";
import { CtaSectionForm } from "./cta-section-form";
import { StatsForm } from "./stats-form";
import { TestimonialForm } from "./testimonial-form";
import { CaseStudyForm } from "./case-study-form";
import { VoiceWidgetForm } from "./voice-widget-form";
import { WorkspaceAnalyzerForm } from "./workspace-analyzer-form";
import { TextSectionForm } from "./text-section-form";
import { ImageSectionForm } from "./image-section-form";
import { PricingPreviewForm } from "./pricing-preview-form";
import { FaqForm } from "./faq-form";
import { LogoStripForm } from "./logo-strip-form";

type BlockFormProps = {
  blockType: string;
  content: unknown;
  onChange: (content: unknown) => void;
};

const FORM_MAP: Record<
  string,
  React.ComponentType<{ content: unknown; onChange: (content: unknown) => void }>
> = {
  hero: HeroForm,
  features_grid: FeaturesGridForm,
  features_list: FeaturesListForm,
  features_icons: FeaturesIconsForm,
  cta_section: CtaSectionForm,
  stats: StatsForm,
  testimonial: TestimonialForm,
  case_study: CaseStudyForm,
  voice_widget: VoiceWidgetForm,
  workspace_analyzer: WorkspaceAnalyzerForm,
  text_section: TextSectionForm,
  image_section: ImageSectionForm,
  pricing_preview: PricingPreviewForm,
  faq: FaqForm,
  logo_strip: LogoStripForm,
};

/** JSON textarea fallback for block types without a dedicated form. */
function JsonFallbackForm({
  content,
  onChange,
}: {
  content: unknown;
  onChange: (content: unknown) => void;
}) {
  const [json, setJson] = useState(() => JSON.stringify(content ?? {}, null, 2));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setJson(JSON.stringify(content ?? {}, null, 2));
  }, [content]);

  function handleChange(value: string) {
    setJson(value);
    try {
      const parsed: unknown = JSON.parse(value);
      setError(null);
      onChange(parsed);
    } catch {
      setError("Ugyldig JSON");
    }
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs">Innhold (JSON)</Label>
      <Textarea
        value={json}
        onChange={(e) => handleChange(e.target.value)}
        rows={8}
        className="font-mono text-xs"
      />
      {error && <p className="text-destructive text-[10px]">{error}</p>}
    </div>
  );
}

export function BlockFormRouter({ blockType, content, onChange }: BlockFormProps) {
  const FormComponent = FORM_MAP[blockType];

  if (FormComponent) {
    return <FormComponent content={content} onChange={onChange} />;
  }

  return <JsonFallbackForm content={content} onChange={onChange} />;
}
