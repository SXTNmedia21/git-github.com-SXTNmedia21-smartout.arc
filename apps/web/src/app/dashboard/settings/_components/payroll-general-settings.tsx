"use client";

// Payroll general settings form — period configuration and employer cost percentages.
// Two cards side-by-side on desktop, stacked on mobile.
//
// UI Events:
// - action: useUpdatePayrollSettings().mutate(values) (save button submit)
// - action: form.reset(data) (data loads, form populates)

import { useEffect, type InputHTMLAttributes } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Label,
  Input,
} from "@smartout/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  usePayrollSettings,
  useUpdatePayrollSettings,
  useSalaryCodes,
  payrollSettingsSchema,
  type PayrollSettingsInput,
} from "../_hooks/use-payroll-settings";

// ─── Skeleton while data loads ─────────────────────────────────────────────

function SettingsCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-4">
        <Skeleton className="h-5 w-36" />
      </CardHeader>
      <CardContent className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Helper: percentage input row ─────────────────────────────────────────

type PctFieldProps = {
  label: string;
  id: string;
  registration: InputHTMLAttributes<HTMLInputElement>;
  error?: string;
};

function PctField({ label, id, registration, error }: PctFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          step="0.1"
          min={0}
          max={100}
          className="pr-8"
          {...registration}
        />
        <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm">
          %
        </span>
      </div>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

export function PayrollGeneralSettings() {
  const { data: settings, isLoading: settingsLoading } = usePayrollSettings();
  const { data: salaryCodes = [], isLoading: codesLoading } = useSalaryCodes();
  const updateSettings = useUpdatePayrollSettings();

  const isLoading = settingsLoading || codesLoading;

  const form = useForm<PayrollSettingsInput>({
    resolver: zodResolver(payrollSettingsSchema),
    defaultValues: {
      period_type: "monthly",
      period_start_day: 1,
      default_worked_hours_salary_code: null,
      default_monthly_salary_code: null,
      shift_grouping: "department",
      employer_social_security_pct: 14.1,
      vacation_pay_pct: 12.0,
      pension_pct: 2.0,
    },
  });

  // Populate form once remote data arrives
  useEffect(() => {
    if (settings) {
      form.reset({
        period_type: settings.period_type,
        period_start_day: settings.period_start_day,
        default_worked_hours_salary_code: settings.default_worked_hours_salary_code,
        default_monthly_salary_code: settings.default_monthly_salary_code,
        shift_grouping: settings.shift_grouping,
        employer_social_security_pct: settings.employer_social_security_pct,
        vacation_pay_pct: settings.vacation_pay_pct,
        pension_pct: settings.pension_pct,
      });
    }
  }, [settings, form]);

  function onSubmit(values: PayrollSettingsInput) {
    updateSettings.mutate(values);
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <SettingsCardSkeleton />
          <SettingsCardSkeleton />
        </div>
      </div>
    );
  }

  const errors = form.formState.errors;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-foreground text-lg font-semibold">Generelle lønnsinnstillinger</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Konfigurer lønnsperiode, grupperingsregler og arbeidsgiveravgifter for hele
          arbeidsplassen.
        </p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Card 1: Period + grouping */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Lønnsperiode</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* period_type */}
              <div className="space-y-1.5">
                <Label htmlFor="period_type" className="text-sm font-medium">
                  Periodetype
                </Label>
                <Select
                  value={form.watch("period_type")}
                  onValueChange={(v) =>
                    form.setValue("period_type", v as PayrollSettingsInput["period_type"], {
                      shouldDirty: true,
                    })
                  }
                >
                  <SelectTrigger id="period_type" className="w-full">
                    <SelectValue placeholder="Velg periodetype" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Månedlig</SelectItem>
                    <SelectItem value="biweekly">Annenhver uke</SelectItem>
                    <SelectItem value="weekly">Ukentlig</SelectItem>
                  </SelectContent>
                </Select>
                {errors.period_type && (
                  <p className="text-destructive text-xs">{errors.period_type.message}</p>
                )}
              </div>

              {/* period_start_day */}
              <div className="space-y-1.5">
                <Label htmlFor="period_start_day" className="text-sm font-medium">
                  Periodestart (dag i måneden)
                </Label>
                <Input
                  id="period_start_day"
                  type="number"
                  min={1}
                  max={28}
                  {...form.register("period_start_day")}
                />
                {errors.period_start_day && (
                  <p className="text-destructive text-xs">{errors.period_start_day.message}</p>
                )}
              </div>

              {/* shift_grouping */}
              <div className="space-y-1.5">
                <Label htmlFor="shift_grouping" className="text-sm font-medium">
                  Skiftgruppering
                </Label>
                <Select
                  value={form.watch("shift_grouping")}
                  onValueChange={(v) =>
                    form.setValue("shift_grouping", v as PayrollSettingsInput["shift_grouping"], {
                      shouldDirty: true,
                    })
                  }
                >
                  <SelectTrigger id="shift_grouping" className="w-full">
                    <SelectValue placeholder="Velg gruppering" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="department">Avdeling</SelectItem>
                    <SelectItem value="wage">Lønnsgruppe</SelectItem>
                    <SelectItem value="wage_type">Lønnstype</SelectItem>
                  </SelectContent>
                </Select>
                {errors.shift_grouping && (
                  <p className="text-destructive text-xs">{errors.shift_grouping.message}</p>
                )}
              </div>

              {/* default_worked_hours_salary_code */}
              <div className="space-y-1.5">
                <Label htmlFor="worked_hours_code" className="text-sm font-medium">
                  Standard lønnssats (timelønn)
                </Label>
                <Select
                  value={form.watch("default_worked_hours_salary_code") ?? "__none__"}
                  onValueChange={(v) =>
                    form.setValue("default_worked_hours_salary_code", v === "__none__" ? null : v, {
                      shouldDirty: true,
                    })
                  }
                >
                  <SelectTrigger id="worked_hours_code" className="w-full">
                    <SelectValue placeholder="Ingen standard" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Ingen standard</SelectItem>
                    {salaryCodes.map((sc) => (
                      <SelectItem key={sc.id} value={sc.code}>
                        {sc.code} — {sc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* default_monthly_salary_code */}
              <div className="space-y-1.5">
                <Label htmlFor="monthly_code" className="text-sm font-medium">
                  Standard lønnssats (månedslønn)
                </Label>
                <Select
                  value={form.watch("default_monthly_salary_code") ?? "__none__"}
                  onValueChange={(v) =>
                    form.setValue("default_monthly_salary_code", v === "__none__" ? null : v, {
                      shouldDirty: true,
                    })
                  }
                >
                  <SelectTrigger id="monthly_code" className="w-full">
                    <SelectValue placeholder="Ingen standard" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Ingen standard</SelectItem>
                    {salaryCodes.map((sc) => (
                      <SelectItem key={sc.id} value={sc.code}>
                        {sc.code} — {sc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Employer costs */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Arbeidsgiveravgifter</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground text-sm">
                Disse satsene brukes til kostnadsberegninger i lønnskjøring og budsjettering. De
                påvirker ikke utbetalte beløp direkte.
              </p>

              <PctField
                label="Arbeidsgiveravgift"
                id="employer_social_security_pct"
                registration={form.register("employer_social_security_pct")}
                error={errors.employer_social_security_pct?.message}
              />

              <PctField
                label="Feriepenger"
                id="vacation_pay_pct"
                registration={form.register("vacation_pay_pct")}
                error={errors.vacation_pay_pct?.message}
              />

              <PctField
                label="OTP (pensjon)"
                id="pension_pct"
                registration={form.register("pension_pct")}
                error={errors.pension_pct?.message}
              />
            </CardContent>
          </Card>
        </div>

        {/* Save row */}
        <div className="mt-6 flex items-center justify-end gap-3">
          {form.formState.isDirty && !updateSettings.isPending && (
            <span className="text-muted-foreground text-xs">Du har ulagrede endringer</span>
          )}
          <Button type="submit" disabled={!form.formState.isDirty || updateSettings.isPending}>
            {updateSettings.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Lagrer...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Lagre innstillinger
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
