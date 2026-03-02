// ============================================
// pricing-preview-form.tsx — Edit form for pricing_preview blocks
// Fields: heading, subheading, cta_label, cta_href
// ============================================

"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PricingPreviewContent = {
  heading: string;
  subheading: string;
  cta_label: string;
  cta_href: string;
};

type Props = {
  content: unknown;
  onChange: (content: unknown) => void;
};

function defaults(content: unknown): PricingPreviewContent {
  const c = (content ?? {}) as Partial<PricingPreviewContent>;
  return {
    heading: c.heading ?? "",
    subheading: c.subheading ?? "",
    cta_label: c.cta_label ?? "Se priser",
    cta_href: c.cta_href ?? "/pricing",
  };
}

export function PricingPreviewForm({ content, onChange }: Props) {
  const [state, setState] = useState<PricingPreviewContent>(() => defaults(content));

  useEffect(() => {
    setState(defaults(content));
  }, [content]);

  function update(patch: Partial<PricingPreviewContent>) {
    const next = { ...state, ...patch };
    setState(next);
    onChange(next);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Overskrift</Label>
        <Input
          value={state.heading}
          onChange={(e) => update({ heading: e.target.value })}
          placeholder="Prisoverskrift"
          className="h-9"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Underoverskrift</Label>
        <Input
          value={state.subheading}
          onChange={(e) => update({ subheading: e.target.value })}
          placeholder="Kort beskrivelse av priser"
          className="h-9"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">CTA-tekst</Label>
          <Input
            value={state.cta_label}
            onChange={(e) => update({ cta_label: e.target.value })}
            placeholder="Se priser"
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">CTA-lenke</Label>
          <Input
            value={state.cta_href}
            onChange={(e) => update({ cta_href: e.target.value })}
            placeholder="/pricing"
            className="h-9"
          />
        </div>
      </div>
    </div>
  );
}
