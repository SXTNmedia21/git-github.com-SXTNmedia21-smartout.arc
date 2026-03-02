// ============================================
// voice-widget-form.tsx — Edit form for voice_widget blocks
// Minimal: heading + subheading (voice config comes from variant level)
// ============================================

"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type VoiceWidgetContent = {
  heading: string;
  subheading: string;
};

type Props = {
  content: unknown;
  onChange: (content: unknown) => void;
};

function defaults(content: unknown): VoiceWidgetContent {
  const c = (content ?? {}) as Partial<VoiceWidgetContent>;
  return {
    heading: c.heading ?? "",
    subheading: c.subheading ?? "",
  };
}

export function VoiceWidgetForm({ content, onChange }: Props) {
  const [state, setState] = useState<VoiceWidgetContent>(() => defaults(content));

  useEffect(() => {
    setState(defaults(content));
  }, [content]);

  function update(patch: Partial<VoiceWidgetContent>) {
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
          placeholder="Stemmeassistent-overskrift"
          className="h-9"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Underoverskrift</Label>
        <Input
          value={state.subheading}
          onChange={(e) => update({ subheading: e.target.value })}
          placeholder="Kort beskrivelse"
          className="h-9"
        />
      </div>

      <p className="text-muted-foreground text-[10px]">
        Stemmekonfigurasjonen styres paa variantnivaa.
      </p>
    </div>
  );
}
