"use client";

import { useState } from "react";
import { AlertTriangle, Camera, Loader2, Send } from "lucide-react";
import { useTranslation } from "@smartout/i18n";
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
  const { t } = useTranslation("dashboard");
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
        <div className="bg-destructive/10 flex h-10 w-10 items-center justify-center rounded-lg">
          <AlertTriangle className="text-destructive h-5 w-5" />
        </div>
        <div>
          <h2 className="text-foreground text-lg font-bold">{t("hms.deviation_form.title")}</h2>
          <p className="text-muted-foreground text-xs">{t("hms.deviation_form.subtitle")}</p>
        </div>
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <Label htmlFor="deviation-title">
          {t("hms.deviation_form.what_happened")} <span className="text-destructive">*</span>
        </Label>
        <Input
          id="deviation-title"
          placeholder={t("hms.deviation_form.title_placeholder")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      {/* Domain + Severity row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>
            {t("hms.deviation_form.category")} <span className="text-destructive">*</span>
          </Label>
          <Select value={domain} onValueChange={(v) => setDomain(v as DeviationDomain)}>
            <SelectTrigger>
              <SelectValue placeholder={t("hms.deviation_form.select_placeholder")} />
            </SelectTrigger>
            <SelectContent>
              {deviationDomainValues.map((d) => (
                <SelectItem key={d} value={d}>
                  {t(`hms.deviation_form.domain_${d}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>
            {t("hms.deviation_form.severity")} <span className="text-destructive">*</span>
          </Label>
          <Select value={severity} onValueChange={(v) => setSeverity(v as DeviationSeverity)}>
            <SelectTrigger>
              <SelectValue placeholder={t("hms.deviation_form.select_placeholder")} />
            </SelectTrigger>
            <SelectContent>
              {deviationSeverityValues.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`hms.deviation_form.severity_${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="deviation-desc">{t("hms.deviation_form.description")}</Label>
        <Textarea
          id="deviation-desc"
          placeholder={t("hms.deviation_form.description_placeholder")}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
        />
      </div>

      {/* Photo placeholder */}
      <div>
        <Button variant="outline" size="sm" disabled>
          <Camera className="mr-1.5 h-3.5 w-3.5" />
          {t("hms.deviation_form.add_photo")}
        </Button>
        <p className="text-muted-foreground mt-1 text-[10px]">
          {t("hms.deviation_form.photo_coming_soon")}
        </p>
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
        {t("hms.deviation_form.submit")}
      </Button>
    </div>
  );
}
