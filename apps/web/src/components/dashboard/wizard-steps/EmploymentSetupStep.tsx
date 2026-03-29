"use client";

import {
  useState,
  useCallback,
  useContext,
  useMemo,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from "react";
import { Briefcase, Plus, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@smartout/supabase/client";
import type { Json } from "@smartout/supabase";
import { emit } from "@smartout/telemetry";
import type { IndustryEmploymentDefaults } from "@/lib/industry/types";
import { useWorkspace } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useEmploymentTools } from "./tools/employment-tools";

// ─── Types ───────────────────────────────────────────────

type EmploymentForm = {
  type: string;
  label: string;
  defaultHoursPerWeek: number;
  defaultNotice: { value: number; unit: "months" | "days" };
  enabled: boolean;
  hoursPerWeek: number;
  noticeValue: number;
  noticeUnit: "months" | "days";
};

type CommonTerms = {
  probationMonths: number;
  vacationDays: number;
  extraVacationDays: boolean;
  otpPct: number;
  employerTaxPct: number;
};

// ─── Constants ───────────────────────────────────────────

const INITIAL_FORMS: EmploymentForm[] = [
  {
    type: "fast_heltid",
    label: "Fast heltid",
    defaultHoursPerWeek: 37.5,
    defaultNotice: { value: 1, unit: "months" },
    enabled: true,
    hoursPerWeek: 37.5,
    noticeValue: 1,
    noticeUnit: "months",
  },
  {
    type: "fast_deltid",
    label: "Fast deltid",
    defaultHoursPerWeek: 0,
    defaultNotice: { value: 1, unit: "months" },
    enabled: false,
    hoursPerWeek: 0,
    noticeValue: 1,
    noticeUnit: "months",
  },
  {
    type: "tilkalling",
    label: "Tilkallingshjelp",
    defaultHoursPerWeek: 0,
    defaultNotice: { value: 14, unit: "days" },
    enabled: true,
    hoursPerWeek: 0,
    noticeValue: 14,
    noticeUnit: "days",
  },
  {
    type: "laerling",
    label: "L\u00e6rling",
    defaultHoursPerWeek: 37.5,
    defaultNotice: { value: 1, unit: "months" },
    enabled: false,
    hoursPerWeek: 37.5,
    noticeValue: 1,
    noticeUnit: "months",
  },
];

// ─── EmploymentSetupStep ─────────────────────────────────

export type EmploymentSetupHandle = {
  save: () => Promise<void>;
};

export const EmploymentSetupStep = forwardRef<
  EmploymentSetupHandle,
  {
    industryDefaults?: IndustryEmploymentDefaults;
    extractedTerms?: {
      noticePeriod?: string;
      probation?: string;
      source: string;
    };
  }
>(function EmploymentSetupStep({ industryDefaults, extractedTerms }, ref) {
  const workspace = useWorkspace();
  const { profileId } = useContext(DashboardContext);
  const queryClient = useQueryClient();

  const initialCommonTerms = useMemo<CommonTerms>(
    () => ({
      probationMonths: industryDefaults?.probationMonths ?? 6,
      vacationDays: industryDefaults?.vacationDays ?? 25,
      extraVacationDays: industryDefaults?.extraVacationDays ?? false,
      otpPct: industryDefaults?.otpPct ?? 2,
      employerTaxPct: industryDefaults?.employerTaxPct ?? 14.1,
    }),
    [industryDefaults],
  );

  const [forms, setForms] = useState<EmploymentForm[]>(INITIAL_FORMS);
  const [commonTerms, setCommonTerms] = useState<CommonTerms>(initialCommonTerms);

  const { data: existingPolicy } = useQuery({
    queryKey: ["employment-policy", workspace.workspace.workspace_id],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("policy")
        .select("policy_id, rules_json")
        .eq("workspace_id", workspace.workspace.workspace_id)
        .eq("policy_type", "hr")
        .eq("name", "Ansettelsesvilk\u00e5r")
        .eq("is_active", true)
        .maybeSingle();
      return data;
    },
  });

  // Pre-populate from existing policy
  useEffect(() => {
    if (!existingPolicy?.rules_json) return;
    const rules = existingPolicy.rules_json as {
      employment_forms?: Array<{
        type: string;
        label: string;
        hours_per_week: number;
        notice_value: number;
        notice_unit: "months" | "days";
      }>;
      common_terms?: {
        probation_months?: number;
        vacation_days?: number;
        extra_vacation_days?: number;
        otp_pct?: number;
        employer_tax_pct?: number;
      };
    };

    if (rules.employment_forms) {
      const enabledTypes = new Set(rules.employment_forms.map((f) => f.type));
      const customForms: EmploymentForm[] = rules.employment_forms
        .filter((f) => f.type.startsWith("custom_"))
        .map((f) => ({
          type: f.type,
          label: f.label,
          defaultHoursPerWeek: f.hours_per_week,
          defaultNotice: { value: f.notice_value, unit: f.notice_unit },
          enabled: true,
          hoursPerWeek: f.hours_per_week,
          noticeValue: f.notice_value,
          noticeUnit: f.notice_unit,
        }));

      setForms((prev) => {
        const presetForms = prev
          .filter((form) => !form.type.startsWith("custom_"))
          .map((form) => {
            const saved = rules.employment_forms?.find((f) => f.type === form.type);
            if (saved)
              return {
                ...form,
                enabled: true,
                hoursPerWeek: saved.hours_per_week,
                noticeValue: saved.notice_value,
                noticeUnit: saved.notice_unit,
              };
            return { ...form, enabled: enabledTypes.has(form.type) };
          });
        return [...presetForms, ...customForms];
      });
    }

    if (rules.common_terms) {
      const ct = rules.common_terms;
      setCommonTerms({
        probationMonths: ct.probation_months ?? 6,
        vacationDays: ct.vacation_days ?? 25,
        extraVacationDays: (ct.extra_vacation_days ?? 0) > 0,
        otpPct: ct.otp_pct ?? 2,
        employerTaxPct: ct.employer_tax_pct ?? 14.1,
      });
    }
  }, [existingPolicy]);

  useEffect(() => {
    if (!extractedTerms) return;
    setCommonTerms((prev) => {
      const next = { ...prev };
      if (extractedTerms.probation) {
        const months = parseInt(extractedTerms.probation, 10);
        if (!isNaN(months)) next.probationMonths = months;
      }
      return next;
    });
    if (extractedTerms.noticePeriod) {
      const periodStr = extractedTerms.noticePeriod.toLowerCase();
      let noticeValue = parseInt(periodStr, 10);
      let noticeUnit: "months" | "days" = "months";
      if (periodStr.includes("dag") || periodStr.includes("day")) noticeUnit = "days";
      if (isNaN(noticeValue)) noticeValue = 1;
      setForms((prev) => prev.map((f) => (f.enabled ? { ...f, noticeValue, noticeUnit } : f)));
    }
  }, [extractedTerms]);

  const handleFormToggle = useCallback((index: number) => {
    setForms((prev) => prev.map((f, i) => (i === index ? { ...f, enabled: !f.enabled } : f)));
  }, []);

  const handleFormUpdate = useCallback((index: number, updates: Partial<EmploymentForm>) => {
    setForms((prev) => prev.map((f, i) => (i === index ? { ...f, ...updates } : f)));
  }, []);

  const handleAddCustomForm = useCallback(() => {
    setForms((prev) => [
      ...prev,
      {
        type: `custom_${Date.now()}`,
        label: "",
        defaultHoursPerWeek: 37.5,
        defaultNotice: { value: 1, unit: "months" },
        enabled: true,
        hoursPerWeek: 37.5,
        noticeValue: 1,
        noticeUnit: "months",
      },
    ]);
  }, []);

  const handleRemoveForm = useCallback((index: number) => {
    setForms((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleCommonTermChange = useCallback(
    <K extends keyof CommonTerms>(key: K, value: CommonTerms[K]) => {
      setCommonTerms((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  // Save is called externally (on "Neste") via onSave or exposed via ref
  const saveMutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient();
      const rulesJson = {
        employment_forms: forms
          .filter((f) => f.enabled)
          .map((f) => ({
            type: f.type,
            label: f.label,
            hours_per_week: f.hoursPerWeek,
            notice_value: f.noticeValue,
            notice_unit: f.noticeUnit,
          })),
        common_terms: {
          probation_months: commonTerms.probationMonths,
          vacation_days: commonTerms.vacationDays,
          extra_vacation_days: commonTerms.extraVacationDays ? 5 : 0,
          vacation_pay_pct: 10.2,
          otp_pct: commonTerms.otpPct,
          employer_tax_pct: commonTerms.employerTaxPct,
        },
      } as unknown as Json;

      if (existingPolicy?.policy_id) {
        const { error } = await supabase
          .from("policy")
          .update({ rules_json: rulesJson })
          .eq("policy_id", existingPolicy.policy_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("policy").insert({
          name: "Ansettelsesvilk\u00e5r",
          statement: "Standard ansettelsesvilk\u00e5r",
          policy_type: "hr" as const,
          policy_scope: "workspace" as const,
          workspace_id: workspace.workspace.workspace_id,
          created_by: profileId ?? "",
          rules_json: rulesJson,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["employment-policy", workspace.workspace.workspace_id],
      });
      void emit({
        event: "button clicked",
        workspace_id: workspace.workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: { trackingId: "employment-terms-saved" },
      });
    },
    onError: () => {
      toast.error("Kunne ikke lagre vilk\u00e5r");
    },
  });

  useImperativeHandle(
    ref,
    () => ({
      save: async () => {
        await saveMutation.mutateAsync();
        await queryClient.invalidateQueries({
          queryKey: ["employment-policy", workspace.workspace.workspace_id],
        });
      },
    }),
    [saveMutation.mutateAsync, queryClient, workspace.workspace.workspace_id],
  );

  // Build summary view for Emma — just type/label/enabled
  const formSummary = useMemo(
    () => forms.map((f) => ({ type: f.type, label: f.label, enabled: f.enabled })),
    [forms],
  );

  // Emma toggles by label — map back to index for handleFormToggle
  const handleToggleByLabel = useCallback(
    (label: string) => {
      const idx = forms.findIndex((f) => f.label === label);
      if (idx !== -1) handleFormToggle(idx);
    },
    [forms, handleFormToggle],
  );

  const employmentTools = useEmploymentTools(formSummary, handleToggleByLabel);
  useRegisterTools("wizard-setup-employment", employmentTools);

  return (
    <div className="space-y-6">
      {/* Ansettelsesformer */}
      <div className="space-y-3">
        <h3 className="text-muted-foreground text-sm font-bold">Ansettelsesformer</h3>
        <div className="space-y-2">
          {forms.map((form, index) => {
            const isCustom = form.type.startsWith("custom_");
            const noticeLabel = form.noticeUnit === "months" ? "mnd" : "dager";
            return (
              <div
                key={form.type}
                className={`rounded-xl border transition-colors ${
                  form.enabled ? "border-brand-orange bg-brand-orange/5" : "border-border bg-muted"
                }`}
              >
                <label className="flex cursor-pointer items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Briefcase
                      className={`h-4 w-4 ${form.enabled ? "text-brand-orange" : "text-muted-foreground"}`}
                    />
                    {isCustom ? (
                      <Input
                        type="text"
                        placeholder="Navn"
                        value={form.label}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => handleFormUpdate(index, { label: e.target.value })}
                        className="border-border bg-card text-foreground h-7 w-40 text-sm font-semibold"
                      />
                    ) : (
                      <span className="text-foreground text-sm font-semibold">{form.label}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isCustom && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleRemoveForm(index);
                        }}
                        className="text-muted-foreground hover:text-foreground rounded-md p-1"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                    <Switch
                      checked={form.enabled}
                      onCheckedChange={() => handleFormToggle(index)}
                    />
                  </div>
                </label>
                {form.enabled && (
                  <div className="border-border flex items-center gap-4 border-t px-4 py-2">
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={form.hoursPerWeek}
                        onChange={(e) =>
                          handleFormUpdate(index, { hoursPerWeek: parseFloat(e.target.value) || 0 })
                        }
                        className="border-border bg-card text-foreground h-7 w-16 text-xs"
                      />
                      <span className="text-muted-foreground text-xs">t/uke</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        min={0}
                        max={365}
                        step={1}
                        value={form.noticeValue}
                        onChange={(e) =>
                          handleFormUpdate(index, {
                            noticeValue: parseInt(e.target.value, 10) || 0,
                          })
                        }
                        className="border-border bg-card text-foreground h-7 w-16 text-xs"
                      />
                      <span className="text-muted-foreground text-xs">
                        {noticeLabel} oppsigelse
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={handleAddCustomForm}
          className="border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground flex w-full items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-2 text-sm font-medium transition-colors"
        >
          <Plus className="h-4 w-4" />
          Legg til ansettelsesform
        </button>
      </div>

      {/* Fellesvilk\u00e5r — compact */}
      <div className="space-y-3">
        <h3 className="text-muted-foreground text-sm font-bold">Fellesvilk&aring;r</h3>
        <div className="border-border bg-muted grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border p-4 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">Pr&oslash;vetid</Label>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                min={0}
                max={12}
                value={commonTerms.probationMonths}
                onChange={(e) =>
                  handleCommonTermChange("probationMonths", parseInt(e.target.value, 10) || 0)
                }
                className="border-border bg-card text-foreground h-7 w-14 text-xs"
              />
              <span className="text-muted-foreground text-xs">mnd</span>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">Ferie</Label>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                min={0}
                max={60}
                value={commonTerms.vacationDays}
                onChange={(e) =>
                  handleCommonTermChange("vacationDays", parseInt(e.target.value, 10) || 0)
                }
                className="border-border bg-card text-foreground h-7 w-14 text-xs"
              />
              <span className="text-muted-foreground text-xs">dager</span>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">OTP</Label>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                min={0}
                max={30}
                step={0.1}
                value={commonTerms.otpPct}
                onChange={(e) => handleCommonTermChange("otpPct", parseFloat(e.target.value) || 0)}
                className="border-border bg-card text-foreground h-7 w-14 text-xs"
              />
              <span className="text-muted-foreground text-xs">%</span>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">Arb.giveravgift</Label>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                min={0}
                max={30}
                step={0.1}
                value={commonTerms.employerTaxPct}
                onChange={(e) =>
                  handleCommonTermChange("employerTaxPct", parseFloat(e.target.value) || 0)
                }
                className="border-border bg-card text-foreground h-7 w-14 text-xs"
              />
              <span className="text-muted-foreground text-xs">%</span>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">Feriepenger</Label>
            <div className="text-muted-foreground flex h-7 items-center text-xs">10,2%</div>
          </div>
          <label className="flex items-center gap-2 self-end">
            <Switch
              checked={commonTerms.extraVacationDays}
              onCheckedChange={(checked) => handleCommonTermChange("extraVacationDays", checked)}
            />
            <span className="text-muted-foreground text-xs">+5 ferie</span>
          </label>
        </div>
      </div>
    </div>
  );
});
