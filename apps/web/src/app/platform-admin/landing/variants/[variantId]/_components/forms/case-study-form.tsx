// ============================================
// case-study-form.tsx — Edit form for case_study blocks
// Fields: heading, company, quote, author_name, author_role, metrics list
// ============================================

"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

type MetricItem = {
  value: string;
  label: string;
};

type CaseStudyContent = {
  heading: string;
  company: string;
  quote: string;
  author_name: string;
  author_role: string;
  metrics: MetricItem[];
};

type Props = {
  content: unknown;
  onChange: (content: unknown) => void;
};

function defaults(content: unknown): CaseStudyContent {
  const c = (content ?? {}) as Partial<CaseStudyContent>;
  return {
    heading: c.heading ?? "",
    company: c.company ?? "",
    quote: c.quote ?? "",
    author_name: c.author_name ?? "",
    author_role: c.author_role ?? "",
    metrics: c.metrics ?? [],
  };
}

export function CaseStudyForm({ content, onChange }: Props) {
  const [state, setState] = useState<CaseStudyContent>(() => defaults(content));

  useEffect(() => {
    setState(defaults(content));
  }, [content]);

  function update(patch: Partial<CaseStudyContent>) {
    const next = { ...state, ...patch };
    setState(next);
    onChange(next);
  }

  function updateMetric(index: number, patch: Partial<MetricItem>) {
    const metrics = state.metrics.map((m, i) => (i === index ? { ...m, ...patch } : m));
    update({ metrics });
  }

  function addMetric() {
    update({ metrics: [...state.metrics, { value: "", label: "" }] });
  }

  function removeMetric(index: number) {
    update({ metrics: state.metrics.filter((_, i) => i !== index) });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Overskrift</Label>
        <Input
          value={state.heading}
          onChange={(e) => update({ heading: e.target.value })}
          placeholder="Casestudie-overskrift"
          className="h-9"
        />
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

      <div className="space-y-1.5">
        <Label className="text-xs">Sitat</Label>
        <Textarea
          value={state.quote}
          onChange={(e) => update({ quote: e.target.value })}
          placeholder="Sitat fra kunden"
          rows={3}
          className="text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Forfatter</Label>
          <Input
            value={state.author_name}
            onChange={(e) => update({ author_name: e.target.value })}
            placeholder="Navn paa forfatteren"
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Rolle</Label>
          <Input
            value={state.author_role}
            onChange={(e) => update({ author_role: e.target.value })}
            placeholder="Stillingstittel"
            className="h-9"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Metrikker</Label>
        {state.metrics.map((metric, i) => (
          <div key={i} className="flex items-start gap-2">
            <Input
              value={metric.value}
              onChange={(e) => updateMetric(i, { value: e.target.value })}
              placeholder="Verdi (f.eks. 40%)"
              className="h-8 w-28 text-xs"
            />
            <Input
              value={metric.label}
              onChange={(e) => updateMetric(i, { label: e.target.value })}
              placeholder="Etikett"
              className="h-8 flex-1 text-xs"
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 shrink-0 p-0"
              onClick={() => removeMetric(i)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addMetric}>
          <Plus className="mr-1 h-3 w-3" />
          Legg til metrikk
        </Button>
      </div>
    </div>
  );
}
