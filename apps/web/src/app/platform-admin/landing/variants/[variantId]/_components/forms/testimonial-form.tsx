// ============================================
// testimonial-form.tsx — Edit form for testimonial blocks
// Fields: quote, name, role, company, image
// ============================================

"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MediaPicker } from "../media-picker";

type TestimonialContent = {
  quote: string;
  name: string;
  role: string;
  company: string;
  image?: { media_id: string; alt: string };
};

type Props = {
  content: unknown;
  onChange: (content: unknown) => void;
};

function defaults(content: unknown): TestimonialContent {
  const c = (content ?? {}) as Partial<TestimonialContent>;
  return {
    quote: c.quote ?? "",
    name: c.name ?? "",
    role: c.role ?? "",
    company: c.company ?? "",
    image: c.image,
  };
}

export function TestimonialForm({ content, onChange }: Props) {
  const [state, setState] = useState<TestimonialContent>(() => defaults(content));

  useEffect(() => {
    setState(defaults(content));
  }, [content]);

  function update(patch: Partial<TestimonialContent>) {
    const next = { ...state, ...patch };
    setState(next);
    onChange(next);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Sitat</Label>
        <Textarea
          value={state.quote}
          onChange={(e) => update({ quote: e.target.value })}
          placeholder="Sitatet fra kunden"
          rows={3}
          className="text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Navn</Label>
          <Input
            value={state.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="Fullt navn"
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Rolle</Label>
          <Input
            value={state.role}
            onChange={(e) => update({ role: e.target.value })}
            placeholder="Stillingstittel"
            className="h-9"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Bedrift</Label>
        <Input
          value={state.company}
          onChange={(e) => update({ company: e.target.value })}
          placeholder="Bedriftsnavn"
          className="h-9"
        />
      </div>

      <MediaPicker
        value={state.image}
        onChange={(image) => update({ image })}
        label="Profilbilde"
      />
    </div>
  );
}
