"use client";

import { useState } from "react";
import { AlertTriangle, Camera, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  deviationDomainValues,
  deviationSeverityValues,
  type DeviationDomain,
  type DeviationSeverity,
} from "@smartout/hms";
import { useCreateDeviation } from "../_hooks/use-create-deviation";

// TODO: move to i18n
const DOMAIN_LABELS: Record<string, string> = {
  safety: "Sikkerhet",
  customer: "Kunde",
  procedure: "Prosedyre",
  system: "System",
  material: "Materiell",
};

const SEVERITY_LABELS: Record<string, string> = {
  low: "Lav",
  medium: "Middels",
  high: "Hoy",
  critical: "Kritisk",
};

type DeviationFormPrefill = {
  sessionId?: string;
  departmentId?: string;
  sourceTaskId?: string;
  procedureId?: string;
  protocolId?: string;
  domain?: DeviationDomain;
};

type Props = {
  prefill?: DeviationFormPrefill;
  onSuccess?: () => void;
};

export function DeviationForm({ prefill, onSuccess }: Props) {
  const createDeviation = useCreateDeviation();
  const [title, setTitle] = useState("");
  const [domain, setDomain] = useState<DeviationDomain | "">(prefill?.domain ?? "");
  const [severity, setSeverity] = useState<DeviationSeverity | "">("");
  const [description, setDescription] = useState("");

  const canSubmit = title.trim() && domain && severity;

  function handleSubmit() {
    if (!canSubmit) return;
    createDeviation.mutate(
      {
        title: title.trim(),
        domain: domain as DeviationDomain,
        severity: severity as DeviationSeverity,
        description: description.trim() || undefined,
        department_id: prefill?.departmentId ?? null,
        session_id: prefill?.sessionId ?? null,
        source_task_id: prefill?.sourceTaskId ?? null,
        procedure_id: prefill?.procedureId ?? null,
        protocol_id: prefill?.protocolId ?? null,
      },
      {
        onSuccess: () => {
          setTitle("");
          setDomain(prefill?.domain ?? "");
          setSeverity("");
          setDescription("");
          onSuccess?.();
        },
      },
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
          <AlertTriangle className="h-5 w-5 text-red-500" />
        </div>
        <div>
          <h2 className="text-foreground text-lg font-bold">Meld avvik</h2>
          <p className="text-muted-foreground text-xs">Rapporter et avvik eller en hendelse.</p>
        </div>
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <Label htmlFor="deviation-title">
          Hva skjedde? <span className="text-red-500">*</span>
        </Label>
        <Input
          id="deviation-title"
          placeholder="Kort beskrivelse av avviket..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      {/* Domain + Severity row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>
            Kategori <span className="text-red-500">*</span>
          </Label>
          <Select value={domain} onValueChange={(v) => setDomain(v as DeviationDomain)}>
            <SelectTrigger>
              <SelectValue placeholder="Velg..." />
            </SelectTrigger>
            <SelectContent>
              {deviationDomainValues.map((d) => (
                <SelectItem key={d} value={d}>
                  {DOMAIN_LABELS[d] ?? d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>
            Alvorlighet <span className="text-red-500">*</span>
          </Label>
          <Select value={severity} onValueChange={(v) => setSeverity(v as DeviationSeverity)}>
            <SelectTrigger>
              <SelectValue placeholder="Velg..." />
            </SelectTrigger>
            <SelectContent>
              {deviationSeverityValues.map((s) => (
                <SelectItem key={s} value={s}>
                  {SEVERITY_LABELS[s] ?? s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="deviation-desc">Beskrivelse</Label>
        <Textarea
          id="deviation-desc"
          placeholder="Utdypende beskrivelse av hva som skjedde, hvordan, og konsekvenser..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
        />
      </div>

      {/* Photo placeholder */}
      <div>
        <Button variant="outline" size="sm" disabled>
          <Camera className="mr-1.5 h-3.5 w-3.5" />
          Legg til bilde
        </Button>
        <p className="text-muted-foreground mt-1 text-[10px]">Bildeopplasting kommer snart.</p>
      </div>

      {/* Submit */}
      <Button
        className="w-full"
        onClick={handleSubmit}
        disabled={!canSubmit || createDeviation.isPending}
      >
        {createDeviation.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Send className="mr-2 h-4 w-4" />
        )}
        Meld avvik
      </Button>
    </div>
  );
}
