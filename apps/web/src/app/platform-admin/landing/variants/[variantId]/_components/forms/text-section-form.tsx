// ============================================
// text-section-form.tsx — Edit form for text_section blocks
// Fields: heading, body (large textarea)
// ============================================

"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type TextSectionContent = {
  heading: string;
  body: string;
};

type Props = {
  content: unknown;
  onChange: (content: unknown) => void;
};

function defaults(content: unknown): TextSectionContent {
  const c = (content ?? {}) as Partial<TextSectionContent>;
  return {
    heading: c.heading ?? "",
    body: c.body ?? "",
  };
}

export function TextSectionForm({ content, onChange }: Props) {
  const [state, setState] = useState<TextSectionContent>(() => defaults(content));

  useEffect(() => {
    setState(defaults(content));
  }, [content]);

  function update(patch: Partial<TextSectionContent>) {
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
          placeholder="Seksjonsoverskrift"
          className="h-9"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Innhold</Label>
        <Textarea
          value={state.body}
          onChange={(e) => update({ body: e.target.value })}
          placeholder="Broedritekst..."
          rows={8}
          className="text-sm"
        />
      </div>
    </div>
  );
}
