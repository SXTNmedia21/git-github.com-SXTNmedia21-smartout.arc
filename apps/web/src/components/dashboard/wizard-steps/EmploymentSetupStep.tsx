"use client";

import { useState, useCallback, useContext, useMemo, useEffect } from "react";
import { CheckCircle2, Loader2, Briefcase, ChevronDown } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@smartout/supabase/client";
import type { Json } from "@smartout/supabase";
import { emit } from "@smartout/telemetry";
import { useWorkspace } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

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
  vacationPayPct: number;
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
    enabled: false,
    hoursPerWeek: 0,
    noticeValue: 14,
    noticeUnit: "days",
  },
  {
    type: "laerling",
    label: "Lærling",
    defaultHoursPerWeek: 37.5,
    defaultNotice: { value: 1, unit: "months" },
    enabled: false,
    hoursPerWeek: 37.5,
    noticeValue: 1,
    noticeUnit: "months",
  },
];

const INITIAL_COMMON_TERMS: CommonTerms = {
  probationMonths: 6,
  vacationDays: 25,
  extraVacationDays: false,
  vacationPayPct: 10.2,
  otpPct: 2,
  employerTaxPct: 14.1,
};

// ─── EmploymentFormCard ──────────────────────────────────

function EmploymentFormCard({
  form,
  isDark,
  onToggle,
  onUpdate,
}: {
  form: EmploymentForm;
  isDark: boolean;
  onToggle: () => void;
  onUpdate: (updates: Partial<EmploymentForm>) => void;
}) {
  const noticeUnitLabel = form.noticeUnit === "months" ? "mnd" : "dager";

  return (
    <div
      className={`overflow-hidden rounded-xl border transition-colors ${
        form.enabled
          ? isDark
            ? "border-orange-500/40 bg-orange-500/5"
            : "border-orange-300 bg-orange-50/50"
          : isDark
            ? "border-zinc-800 bg-zinc-900/30"
            : "border-zinc-200 bg-zinc-50/50"
      }`}
    >
      <label className="flex cursor-pointer items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <Briefcase
            className={`h-4 w-4 ${
              form.enabled ? "text-orange-500" : isDark ? "text-zinc-600" : "text-zinc-400"
            }`}
          />
          <span className={`text-sm font-semibold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>
            {form.label}
          </span>
        </div>
        <Switch checked={form.enabled} onCheckedChange={onToggle} />
      </label>

      {form.enabled && (
        <div
          className={`border-t px-4 pt-3 pb-3 ${isDark ? "border-zinc-800" : "border-zinc-200"}`}
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                Normalarbeidstid
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={form.hoursPerWeek}
                  onChange={(e) => onUpdate({ hoursPerWeek: parseFloat(e.target.value) || 0 })}
                  className={`h-8 w-20 text-sm ${
                    isDark
                      ? "border-zinc-700 bg-zinc-800 text-zinc-200"
                      : "border-zinc-300 bg-white text-zinc-800"
                  }`}
                />
                <span className={`text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                  t/uke
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                Oppsigelsestid
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={365}
                  step={1}
                  value={form.noticeValue}
                  onChange={(e) => onUpdate({ noticeValue: parseInt(e.target.value, 10) || 0 })}
                  className={`h-8 w-20 text-sm ${
                    isDark
                      ? "border-zinc-700 bg-zinc-800 text-zinc-200"
                      : "border-zinc-300 bg-white text-zinc-800"
                  }`}
                />
                <span className={`text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                  {noticeUnitLabel}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── EmploymentSetupStep ─────────────────────────────────

export function EmploymentSetupStep({ isDark }: { isDark: boolean }) {
  const workspace = useWorkspace();
  const { profileId } = useContext(DashboardContext);
  const queryClient = useQueryClient();

  // ── State ──
  const [forms, setForms] = useState<EmploymentForm[]>(INITIAL_FORMS);
  const [commonTerms, setCommonTerms] = useState<CommonTerms>(INITIAL_COMMON_TERMS);

  // ── Existing policy query ──
  const { data: existingPolicy } = useQuery({
    queryKey: ["employment-policy", workspace.workspace_id],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("policy")
        .select("policy_id, rules_json")
        .eq("workspace_id", workspace.workspace_id)
        .eq("policy_type", "hr")
        .eq("name", "Ansettelsesvilkår")
        .eq("is_active", true)
        .maybeSingle();
      return data;
    },
  });

  // ── Pre-populate from existing policy ──
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
        vacation_pay_pct?: number;
        otp_pct?: number;
        employer_tax_pct?: number;
      };
    };

    if (rules.employment_forms) {
      const enabledTypes = new Set(rules.employment_forms.map((f) => f.type));
      setForms((prev) =>
        prev.map((form) => {
          const saved = rules.employment_forms?.find((f) => f.type === form.type);
          if (saved) {
            return {
              ...form,
              enabled: true,
              hoursPerWeek: saved.hours_per_week,
              noticeValue: saved.notice_value,
              noticeUnit: saved.notice_unit,
            };
          }
          return { ...form, enabled: enabledTypes.has(form.type) };
        }),
      );
    }

    if (rules.common_terms) {
      const ct = rules.common_terms;
      setCommonTerms({
        probationMonths: ct.probation_months ?? 6,
        vacationDays: ct.vacation_days ?? 25,
        extraVacationDays: (ct.extra_vacation_days ?? 0) > 0,
        vacationPayPct: ct.vacation_pay_pct ?? 10.2,
        otpPct: ct.otp_pct ?? 2,
        employerTaxPct: ct.employer_tax_pct ?? 14.1,
      });
    }
  }, [existingPolicy]);

  // ── Handlers ──
  const handleFormToggle = useCallback((index: number) => {
    setForms((prev) => prev.map((f, i) => (i === index ? { ...f, enabled: !f.enabled } : f)));
  }, []);

  const handleFormUpdate = useCallback((index: number, updates: Partial<EmploymentForm>) => {
    setForms((prev) => prev.map((f, i) => (i === index ? { ...f, ...updates } : f)));
  }, []);

  const handleCommonTermChange = useCallback(
    <K extends keyof CommonTerms>(key: K, value: CommonTerms[K]) => {
      setCommonTerms((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  // ── Save mutation ──
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
          name: "Ansettelsesvilkår",
          statement: "Standard ansettelsesvilkår for virksomheten",
          policy_type: "hr" as const,
          policy_scope: "workspace" as const,
          workspace_id: workspace.workspace_id,
          created_by: profileId ?? "",
          rules_json: rulesJson,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["employment-policy", workspace.workspace_id],
      });
      toast.success("Ansettelsesvilkår lagret");
      void emit({
        event: "button clicked",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: { trackingId: "employment-terms-saved" },
      });
    },
    onError: () => {
      toast.error("Kunne ikke lagre vilkår");
    },
  });

  // ── Preview text ──
  const previewText = useMemo(() => {
    const enabledForms = forms.filter((f) => f.enabled);
    if (enabledForms.length === 0) return "Ingen ansettelsesformer valgt.";

    const formDescriptions = enabledForms.map((f) => {
      const noticeLabel = f.noticeUnit === "months" ? "mnd" : "dager";
      return `**${f.label.toLowerCase()}** (${f.hoursPerWeek} t/uke, ${f.noticeValue} ${noticeLabel} oppsigelsestid)`;
    });

    const formsStr =
      formDescriptions.length === 1
        ? formDescriptions[0]
        : formDescriptions.slice(0, -1).join(", ") +
          " og " +
          formDescriptions[formDescriptions.length - 1];

    const totalVacation = commonTerms.extraVacationDays
      ? `${commonTerms.vacationDays} + 5`
      : `${commonTerms.vacationDays}`;

    return `Nye ansatte får tilbud om: ${formsStr}. Prøvetid: ${commonTerms.probationMonths} måneder. Ferie: ${totalVacation} dager. Feriepenger: 10,2%. OTP: ${commonTerms.otpPct}%.`;
  }, [forms, commonTerms]);

  const enabledCount = forms.filter((f) => f.enabled).length;

  // ── Render ──
  return (
    <div className="space-y-8">
      {/* ── Del 1: Ansettelsesformer ── */}
      <div className="space-y-3">
        <h3 className={`text-sm font-bold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
          Ansettelsesformer
        </h3>
        <p className={`text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
          Velg hvilke ansettelsesformer som brukes i virksomheten.
        </p>
        <div className="space-y-2">
          {forms.map((form, index) => (
            <EmploymentFormCard
              key={form.type}
              form={form}
              isDark={isDark}
              onToggle={() => handleFormToggle(index)}
              onUpdate={(updates) => handleFormUpdate(index, updates)}
            />
          ))}
        </div>
      </div>

      {/* ── Del 2: Fellesvilkår ── */}
      <div className="space-y-3">
        <h3 className={`text-sm font-bold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
          Fellesvilkår
        </h3>
        <div
          className={`grid grid-cols-1 gap-4 rounded-xl border p-4 sm:grid-cols-2 ${
            isDark ? "border-zinc-800 bg-zinc-900/30" : "border-zinc-200 bg-zinc-50/50"
          }`}
        >
          {/* Prøvetid */}
          <div className="space-y-1.5">
            <Label className={`text-xs font-medium ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
              Prøvetid
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={12}
                step={1}
                value={commonTerms.probationMonths}
                onChange={(e) =>
                  handleCommonTermChange("probationMonths", parseInt(e.target.value, 10) || 0)
                }
                className={`h-8 w-20 text-sm ${
                  isDark
                    ? "border-zinc-700 bg-zinc-800 text-zinc-200"
                    : "border-zinc-300 bg-white text-zinc-800"
                }`}
              />
              <span className={`text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>mnd</span>
            </div>
          </div>

          {/* Feriedager */}
          <div className="space-y-1.5">
            <Label className={`text-xs font-medium ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
              Feriedager
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={60}
                step={1}
                value={commonTerms.vacationDays}
                onChange={(e) =>
                  handleCommonTermChange("vacationDays", parseInt(e.target.value, 10) || 0)
                }
                className={`h-8 w-20 text-sm ${
                  isDark
                    ? "border-zinc-700 bg-zinc-800 text-zinc-200"
                    : "border-zinc-300 bg-white text-zinc-800"
                }`}
              />
              <span className={`text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>dager</span>
            </div>
            <label className="flex items-center gap-2 pt-1">
              <Switch
                checked={commonTerms.extraVacationDays}
                onCheckedChange={(checked) => handleCommonTermChange("extraVacationDays", checked)}
              />
              <span className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                Avtalefestet ferie (+5)
              </span>
            </label>
          </div>

          {/* Feriepenger (read-only) */}
          <div className="space-y-1.5">
            <Label className={`text-xs font-medium ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
              Feriepenger
            </Label>
            <div
              className={`flex h-8 w-20 items-center rounded-md border px-3 text-sm ${
                isDark
                  ? "border-zinc-700 bg-zinc-800/50 text-zinc-400"
                  : "border-zinc-200 bg-zinc-100 text-zinc-500"
              }`}
            >
              10,2%
            </div>
          </div>

          {/* OTP pensjon */}
          <div className="space-y-1.5">
            <Label className={`text-xs font-medium ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
              OTP pensjon
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={30}
                step={0.1}
                value={commonTerms.otpPct}
                onChange={(e) => handleCommonTermChange("otpPct", parseFloat(e.target.value) || 0)}
                className={`h-8 w-20 text-sm ${
                  isDark
                    ? "border-zinc-700 bg-zinc-800 text-zinc-200"
                    : "border-zinc-300 bg-white text-zinc-800"
                }`}
              />
              <span className={`text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>%</span>
            </div>
          </div>

          {/* Arbeidsgiveravgift */}
          <div className="space-y-1.5">
            <Label className={`text-xs font-medium ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
              Arbeidsgiveravgift
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={30}
                step={0.1}
                value={commonTerms.employerTaxPct}
                onChange={(e) =>
                  handleCommonTermChange("employerTaxPct", parseFloat(e.target.value) || 0)
                }
                className={`h-8 w-20 text-sm ${
                  isDark
                    ? "border-zinc-700 bg-zinc-800 text-zinc-200"
                    : "border-zinc-300 bg-white text-zinc-800"
                }`}
              />
              <span className={`text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>%</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Del 3: Forhåndsvisning ── */}
      <div className="space-y-3">
        <h3 className={`text-sm font-bold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
          Forhåndsvisning
        </h3>
        <div
          className={`rounded-xl border p-4 text-sm leading-relaxed ${
            isDark
              ? "border-zinc-700 bg-zinc-800/50 text-zinc-300"
              : "border-zinc-200 bg-amber-50/50 text-zinc-700"
          }`}
        >
          {previewText.split("**").map((part, i) =>
            i % 2 === 1 ? (
              <strong key={i} className={isDark ? "text-zinc-100" : "text-zinc-900"}>
                {part}
              </strong>
            ) : (
              <span key={i}>{part}</span>
            ),
          )}
        </div>
      </div>

      {/* ── Save button ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || enabledCount === 0}
          className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors ${
            saveMutation.isPending || enabledCount === 0
              ? "cursor-not-allowed opacity-50"
              : "bg-orange-500 text-white hover:bg-orange-600"
          }`}
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : existingPolicy ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : null}
          {existingPolicy ? "Oppdater vilkår" : "Lagre vilkår"}
        </button>

        {existingPolicy && !saveMutation.isPending && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-500">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Lagret
          </span>
        )}
      </div>
    </div>
  );
}
