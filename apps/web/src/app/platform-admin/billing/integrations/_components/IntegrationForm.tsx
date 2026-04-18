"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import type { BillingIntegration, BillingIntegrationType } from "@smartout/billing";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

// Shared form used by both CreateIntegrationSheet and
// EditIntegrationDialog. The fields mirror the
// CreateIntegrationInputSchema / UpdateIntegrationInputSchema exactly:
// display_name, integration_type, is_enabled, is_placeholder, config
// (JSON).
//
// Validation:
//   - display_name min(1)
//   - integration_type required (Select)
//   - config: parsed as JSON here; surface error inline before submit

export type IntegrationFormValues = {
  display_name: string;
  integration_type: BillingIntegrationType;
  is_enabled: boolean;
  is_placeholder: boolean;
  config: Record<string, unknown>;
};

type Props = {
  defaultValues?: Partial<BillingIntegration>;
  submitLabel: string;
  pending: boolean;
  onSubmit: (values: IntegrationFormValues) => void;
  onCancel: () => void;
};

export function IntegrationForm({
  defaultValues,
  submitLabel,
  pending,
  onSubmit,
  onCancel,
}: Props) {
  const [displayName, setDisplayName] = useState(defaultValues?.display_name ?? "");
  const [integrationType, setIntegrationType] = useState<BillingIntegrationType>(
    (defaultValues?.integration_type as BillingIntegrationType | undefined) ?? "placeholder",
  );
  const [isEnabled, setIsEnabled] = useState(defaultValues?.is_enabled ?? true);
  const [isPlaceholder, setIsPlaceholder] = useState(defaultValues?.is_placeholder ?? false);
  const [configText, setConfigText] = useState(() =>
    defaultValues?.config ? JSON.stringify(defaultValues.config, null, 2) : "{}",
  );
  const [configError, setConfigError] = useState<string | null>(null);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    let parsedConfig: Record<string, unknown> = {};
    try {
      const raw = JSON.parse(configText || "{}");
      if (raw === null || Array.isArray(raw) || typeof raw !== "object") {
        setConfigError("Config må være et JSON-objekt.");
        return;
      }
      parsedConfig = raw as Record<string, unknown>;
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : "Ugyldig JSON");
      return;
    }
    setConfigError(null);
    onSubmit({
      display_name: displayName.trim(),
      integration_type: integrationType,
      is_enabled: isEnabled,
      is_placeholder: isPlaceholder,
      config: parsedConfig,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="display_name">Visningsnavn</Label>
        <Input
          id="display_name"
          name="display_name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          minLength={1}
          maxLength={200}
          placeholder="Fiken prod, Stripe sandbox, …"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="integration_type">Type</Label>
        <Select
          value={integrationType}
          onValueChange={(v) => setIntegrationType(v as BillingIntegrationType)}
        >
          <SelectTrigger id="integration_type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="placeholder">Placeholder (mock)</SelectItem>
            <SelectItem value="fiken">Fiken</SelectItem>
            <SelectItem value="tripletex">Tripletex</SelectItem>
            <SelectItem value="stripe">Stripe</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs">
          Fase 2: alle typer kjører PlaceholderAdapter. Reelle adaptere kommer i Fase 3.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="config">Config (JSON)</Label>
        <Textarea
          id="config"
          name="config"
          rows={6}
          value={configText}
          onChange={(e) => setConfigText(e.target.value)}
          className="font-mono text-xs"
          spellCheck={false}
        />
        {configError ? (
          <p className="text-destructive text-xs" role="alert">
            {configError}
          </p>
        ) : (
          <p className="text-muted-foreground text-xs">
            Lagrer ingen klartekst-hemmeligheter. Bruk op:// referanser for nøkler.
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="is_enabled"
          checked={isEnabled}
          onCheckedChange={(v) => setIsEnabled(v === true)}
        />
        <Label htmlFor="is_enabled" className="cursor-pointer">
          Aktiv
        </Label>
      </div>

      <div className="flex items-start gap-2">
        <Checkbox
          id="is_placeholder"
          checked={isPlaceholder}
          onCheckedChange={(v) => setIsPlaceholder(v === true)}
          className="mt-1"
        />
        <div>
          <Label htmlFor="is_placeholder" className="cursor-pointer">
            Placeholder
          </Label>
          <p className="text-muted-foreground text-xs">
            ADR-0129: markerer at ingen reell ekstern handling utføres. Revisjonssporet skiller
            placeholder fra reelle kall.
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Avbryt
        </Button>
        <Button type="submit" disabled={pending || displayName.trim().length === 0}>
          {pending ? "Lagrer…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
