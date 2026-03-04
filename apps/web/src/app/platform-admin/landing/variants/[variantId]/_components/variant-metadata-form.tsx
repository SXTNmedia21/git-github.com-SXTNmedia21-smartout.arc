// ============================================
// variant-metadata-form.tsx — Variant Metadata Form
// Form for variant-level settings: name, slug, status, default flag,
// meta title, meta description, and theme accent color.
//
// Controlled component — parent (BlockEditorClient) owns the state.
//
// Connected to: block-editor-client.tsx (parent state management)
// ============================================

"use client";

import { useCallback } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ── Types ─────────────────────────────────────────────────────────

export type VariantFormValues = {
  name: string;
  slug: string;
  status: "draft" | "published" | "archived";
  is_default: boolean;
  meta_title: string;
  meta_description: string;
  theme_accent: string;
};

type VariantMetadataFormProps = {
  values: VariantFormValues;
  onChange: (values: VariantFormValues) => void;
};

// ── Theme accent options ──────────────────────────────────────────

const ACCENT_OPTIONS = [
  { value: "orange", label: "Orange" },
  { value: "amber", label: "Amber" },
  { value: "emerald", label: "Emerald" },
  { value: "slate", label: "Slate" },
  { value: "rose", label: "Rose" },
  { value: "yellow", label: "Yellow" },
] as const;

// ── Helper ────────────────────────────────────────────────────────

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

// ── Component ─────────────────────────────────────────────────────

export function VariantMetadataForm({ values, onChange }: VariantMetadataFormProps) {
  const update = useCallback(
    (partial: Partial<VariantFormValues>) => {
      onChange({ ...values, ...partial });
    },
    [values, onChange],
  );

  const handleNameChange = useCallback(
    (name: string) => {
      // Auto-generate slug from name if slug hasn't been manually edited
      const currentAutoSlug = toSlug(values.name);
      const slugIsAuto = values.slug === currentAutoSlug || values.slug === "";
      update({
        name,
        ...(slugIsAuto ? { slug: toSlug(name) } : {}),
      });
    },
    [values, update],
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="variant-name">Navn</Label>
        <Input
          id="variant-name"
          value={values.name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="F.eks. Restaurant-variant"
        />
      </div>

      {/* Slug */}
      <div className="space-y-1.5">
        <Label htmlFor="variant-slug">Slug</Label>
        <Input
          id="variant-slug"
          value={values.slug}
          onChange={(e) => update({ slug: e.target.value })}
          placeholder="restaurant-variant"
          className="font-mono text-sm"
        />
      </div>

      {/* Status */}
      <div className="space-y-1.5">
        <Label htmlFor="variant-status">Status</Label>
        <Select
          value={values.status}
          onValueChange={(val) => update({ status: val as VariantFormValues["status"] })}
        >
          <SelectTrigger id="variant-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Theme accent */}
      <div className="space-y-1.5">
        <Label htmlFor="variant-accent">Aksentfarge</Label>
        <Select value={values.theme_accent} onValueChange={(val) => update({ theme_accent: val })}>
          <SelectTrigger id="variant-accent">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACCENT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Meta title */}
      <div className="space-y-1.5">
        <Label htmlFor="variant-meta-title">Meta-tittel</Label>
        <Input
          id="variant-meta-title"
          value={values.meta_title}
          onChange={(e) => update({ meta_title: e.target.value })}
          placeholder="Sidetittel for SEO"
        />
      </div>

      {/* Is default */}
      <div className="flex items-center gap-3 self-end pb-1">
        <Switch
          id="variant-default"
          checked={values.is_default}
          onCheckedChange={(checked) => update({ is_default: checked })}
        />
        <Label htmlFor="variant-default" className="cursor-pointer">
          Standardvariant
        </Label>
      </div>

      {/* Meta description — full width */}
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="variant-meta-desc">Meta-beskrivelse</Label>
        <Textarea
          id="variant-meta-desc"
          value={values.meta_description}
          onChange={(e) => update({ meta_description: e.target.value })}
          placeholder="Kort beskrivelse for soekemotorer"
          rows={2}
        />
      </div>
    </div>
  );
}
