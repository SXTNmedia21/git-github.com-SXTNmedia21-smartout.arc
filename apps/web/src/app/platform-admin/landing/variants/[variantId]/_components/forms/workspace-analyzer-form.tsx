// ============================================
// workspace-analyzer-form.tsx — Edit form for workspace_analyzer blocks
// Minimal: heading + subheading
// ============================================

"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type WorkspaceAnalyzerContent = {
  heading: string;
  subheading: string;
};

type Props = {
  content: unknown;
  onChange: (content: unknown) => void;
};

function defaults(content: unknown): WorkspaceAnalyzerContent {
  const c = (content ?? {}) as Partial<WorkspaceAnalyzerContent>;
  return {
    heading: c.heading ?? "",
    subheading: c.subheading ?? "",
  };
}

export function WorkspaceAnalyzerForm({ content, onChange }: Props) {
  const [state, setState] = useState<WorkspaceAnalyzerContent>(() => defaults(content));

  useEffect(() => {
    setState(defaults(content));
  }, [content]);

  function update(patch: Partial<WorkspaceAnalyzerContent>) {
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
          placeholder="Analyseverktoy-overskrift"
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
        Analyseverktoyets konfigurasjon styres separat.
      </p>
    </div>
  );
}
