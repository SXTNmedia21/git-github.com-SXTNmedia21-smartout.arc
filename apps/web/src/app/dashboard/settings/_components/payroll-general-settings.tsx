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
      // Phase 1 defaults (ADR-0259)
      is_tariff_bound: false,
      supplement_stacking_policy: "highest_wins",
      toil_default_max_banked_hours: 200,
      wellness_days_per_year_default: 2,
      overtime_requires_pre_approval: false,
      overtime_warn_threshold_minutes: 30,
      requires_four_eyes_for_period_approval: false,
      punch_rounding_direction: "none",
      punch_rounding_minutes: 15,
      punch_rounding_snap_window_minutes: 5,
      punch_window_early_minutes: 15,
      punch_window_late_minutes: 30,
      punch_grace_after_scheduled_minutes: 15,
      forced_break_reminder_minutes: 360,
      split_shift_threshold_minutes: 120,
      split_shift_allowance_amount: 0,
      employee_can_dispute_punch: true,
      employee_dispute_window_days: 7,
      manager_punch_edit_notifies_employee: true,
      manager_punch_edit_requires_reason: false,
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
        // Phase 1 fields (ADR-0259)
        is_tariff_bound: settings.is_tariff_bound ?? false,
        supplement_stacking_policy: settings.supplement_stacking_policy ?? "highest_wins",
        toil_default_max_banked_hours: settings.toil_default_max_banked_hours ?? 200,
        wellness_days_per_year_default: settings.wellness_days_per_year_default ?? 2,
        overtime_requires_pre_approval: settings.overtime_requires_pre_approval ?? false,
        overtime_warn_threshold_minutes: settings.overtime_warn_threshold_minutes ?? 30,
        requires_four_eyes_for_period_approval:
          settings.requires_four_eyes_for_period_approval ?? false,
        punch_rounding_direction: settings.punch_rounding_direction ?? "none",
        punch_rounding_minutes: settings.punch_rounding_minutes ?? 15,
        punch_rounding_snap_window_minutes: settings.punch_rounding_snap_window_minutes ?? 5,
        punch_window_early_minutes: settings.punch_window_early_minutes ?? 15,
        punch_window_late_minutes: settings.punch_window_late_minutes ?? 30,
        punch_grace_after_scheduled_minutes: settings.punch_grace_after_scheduled_minutes ?? 15,
        forced_break_reminder_minutes: settings.forced_break_reminder_minutes ?? 360,
        split_shift_threshold_minutes: settings.split_shift_threshold_minutes ?? 120,
        split_shift_allowance_amount: settings.split_shift_allowance_amount ?? 0,
        employee_can_dispute_punch: settings.employee_can_dispute_punch ?? true,
        employee_dispute_window_days: settings.employee_dispute_window_days ?? 7,
        manager_punch_edit_notifies_employee: settings.manager_punch_edit_notifies_employee ?? true,
        manager_punch_edit_requires_reason: settings.manager_punch_edit_requires_reason ?? false,
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

          {/* Card 3: Tariff + tillegg */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Tariff og tillegg</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground text-sm">
                Riksavtalen-binding og stacking-policy for supplement-regler (ADR-0057, ADR-0250).
              </p>

              {/* is_tariff_bound */}
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="is_tariff_bound" className="text-sm font-medium">
                    Tariffbundet virksomhet
                  </Label>
                  <p className="text-muted-foreground text-xs">
                    Aktiverer Riksavtalen §6 nattillegg, §3 minstelønn og §4 OT-satser automatisk
                  </p>
                </div>
                <input
                  id="is_tariff_bound"
                  type="checkbox"
                  {...form.register("is_tariff_bound")}
                  className="h-4 w-4 cursor-pointer rounded"
                />
              </div>

              {/* supplement_stacking_policy */}
              <div className="space-y-1.5">
                <Label htmlFor="supplement_stacking_policy" className="text-sm font-medium">
                  Supplement-stacking policy
                </Label>
                <Select
                  value={form.watch("supplement_stacking_policy")}
                  onValueChange={(v) =>
                    form.setValue(
                      "supplement_stacking_policy",
                      v as PayrollSettingsInput["supplement_stacking_policy"],
                      { shouldDirty: true },
                    )
                  }
                >
                  <SelectTrigger id="supplement_stacking_policy" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sum_all">Sum alle (alle tillegg legges sammen)</SelectItem>
                    <SelectItem value="highest_wins">
                      Høyeste vinner (kun høyeste tillegg anvendes)
                    </SelectItem>
                    <SelectItem value="first_match">
                      Første treff (første matchende regel gjelder)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Card 4: TOIL + velferd */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">TOIL og velferd</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="toil_default_max_banked_hours" className="text-sm font-medium">
                  Standard maks TOIL-timer
                </Label>
                <Input
                  id="toil_default_max_banked_hours"
                  type="number"
                  min={0}
                  step={10}
                  {...form.register("toil_default_max_banked_hours")}
                />
                <p className="text-muted-foreground text-xs">
                  Brukes som default for nye ansatte (ADR-0254)
                </p>
                {errors.toil_default_max_banked_hours && (
                  <p className="text-destructive text-xs">
                    {errors.toil_default_max_banked_hours.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="wellness_days_per_year_default" className="text-sm font-medium">
                  Velferdsdager per år (standard)
                </Label>
                <Input
                  id="wellness_days_per_year_default"
                  type="number"
                  min={0}
                  max={30}
                  {...form.register("wellness_days_per_year_default")}
                />
                {errors.wellness_days_per_year_default && (
                  <p className="text-destructive text-xs">
                    {errors.wellness_days_per_year_default.message}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Card 5: Overtid og godkjenning */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Overtid og godkjenning</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="overtime_requires_pre_approval" className="text-sm font-medium">
                    Overtid krever forhåndsgodkjenning
                  </Label>
                </div>
                <input
                  id="overtime_requires_pre_approval"
                  type="checkbox"
                  {...form.register("overtime_requires_pre_approval")}
                  className="h-4 w-4 cursor-pointer rounded"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="overtime_warn_threshold_minutes" className="text-sm font-medium">
                  Overtidsvarsel-terskel (minutter)
                </Label>
                <Input
                  id="overtime_warn_threshold_minutes"
                  type="number"
                  min={0}
                  step={15}
                  {...form.register("overtime_warn_threshold_minutes")}
                />
                <p className="text-muted-foreground text-xs">
                  Avvik W03 fyres etter N minutter overtid
                </p>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label
                    htmlFor="requires_four_eyes_for_period_approval"
                    className="text-sm font-medium"
                  >
                    Fire-øyne-prinsipp ved periodegodkjenning
                  </Label>
                  <p className="text-muted-foreground text-xs">
                    Krever to separate godkjenninger for å låse periode
                  </p>
                </div>
                <input
                  id="requires_four_eyes_for_period_approval"
                  type="checkbox"
                  {...form.register("requires_four_eyes_for_period_approval")}
                  className="h-4 w-4 cursor-pointer rounded"
                />
              </div>
            </CardContent>
          </Card>

          {/* Card 6: Punch-rounding */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Stempelrunding</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="punch_rounding_direction" className="text-sm font-medium">
                  Rundingsretning
                </Label>
                <Select
                  value={form.watch("punch_rounding_direction")}
                  onValueChange={(v) =>
                    form.setValue(
                      "punch_rounding_direction",
                      v as PayrollSettingsInput["punch_rounding_direction"],
                      { shouldDirty: true },
                    )
                  }
                >
                  <SelectTrigger id="punch_rounding_direction" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ingen runding</SelectItem>
                    <SelectItem value="nearest">Nærmeste</SelectItem>
                    <SelectItem value="up">Alltid opp</SelectItem>
                    <SelectItem value="down">Alltid ned</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="punch_rounding_minutes" className="text-sm font-medium">
                    Rundingsintervall (min)
                  </Label>
                  <Input
                    id="punch_rounding_minutes"
                    type="number"
                    min={0}
                    max={60}
                    step={5}
                    {...form.register("punch_rounding_minutes")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="punch_rounding_snap_window_minutes"
                    className="text-sm font-medium"
                  >
                    Snap-vindu (min)
                  </Label>
                  <Input
                    id="punch_rounding_snap_window_minutes"
                    type="number"
                    min={0}
                    max={30}
                    {...form.register("punch_rounding_snap_window_minutes")}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="punch_window_early_minutes" className="text-sm font-medium">
                    Tidligst inn (min)
                  </Label>
                  <Input
                    id="punch_window_early_minutes"
                    type="number"
                    min={0}
                    max={120}
                    {...form.register("punch_window_early_minutes")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="punch_window_late_minutes" className="text-sm font-medium">
                    Seinest inn (min)
                  </Label>
                  <Input
                    id="punch_window_late_minutes"
                    type="number"
                    min={0}
                    max={120}
                    {...form.register("punch_window_late_minutes")}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="punch_grace_after_scheduled_minutes"
                    className="text-sm font-medium"
                  >
                    Sluttgrace (min)
                  </Label>
                  <Input
                    id="punch_grace_after_scheduled_minutes"
                    type="number"
                    min={0}
                    max={120}
                    {...form.register("punch_grace_after_scheduled_minutes")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="forced_break_reminder_minutes" className="text-sm font-medium">
                    Pausepåminnelse etter (min)
                  </Label>
                  <Input
                    id="forced_break_reminder_minutes"
                    type="number"
                    min={0}
                    max={480}
                    step={30}
                    {...form.register("forced_break_reminder_minutes")}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 7: Split-vakt */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Delt vakt</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="split_shift_threshold_minutes" className="text-sm font-medium">
                  Pausegrense for delt vakt (min)
                </Label>
                <Input
                  id="split_shift_threshold_minutes"
                  type="number"
                  min={0}
                  max={480}
                  step={15}
                  {...form.register("split_shift_threshold_minutes")}
                />
                <p className="text-muted-foreground text-xs">
                  Pauser over denne grensen utløser delt-vakt-tillegg
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="split_shift_allowance_amount" className="text-sm font-medium">
                  Delt-vakt-tillegg (NOK)
                </Label>
                <Input
                  id="split_shift_allowance_amount"
                  type="number"
                  min={0}
                  step={10}
                  {...form.register("split_shift_allowance_amount")}
                />
              </div>
            </CardContent>
          </Card>

          {/* Card 8: Ansattkontroll */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Ansattkontroll</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="employee_can_dispute_punch" className="text-sm font-medium">
                    Ansatt kan begjære korreksjon av stempel
                  </Label>
                </div>
                <input
                  id="employee_can_dispute_punch"
                  type="checkbox"
                  {...form.register("employee_can_dispute_punch")}
                  className="h-4 w-4 cursor-pointer rounded"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="employee_dispute_window_days" className="text-sm font-medium">
                  Begjæringsvindu (dager)
                </Label>
                <Input
                  id="employee_dispute_window_days"
                  type="number"
                  min={0}
                  max={90}
                  {...form.register("employee_dispute_window_days")}
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label
                    htmlFor="manager_punch_edit_notifies_employee"
                    className="text-sm font-medium"
                  >
                    Varsle ansatt ved lederredigering av stempel
                  </Label>
                </div>
                <input
                  id="manager_punch_edit_notifies_employee"
                  type="checkbox"
                  {...form.register("manager_punch_edit_notifies_employee")}
                  className="h-4 w-4 cursor-pointer rounded"
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label
                    htmlFor="manager_punch_edit_requires_reason"
                    className="text-sm font-medium"
                  >
                    Lederen må oppgi grunn ved redigering av stempel
                  </Label>
                </div>
                <input
                  id="manager_punch_edit_requires_reason"
                  type="checkbox"
                  {...form.register("manager_punch_edit_requires_reason")}
                  className="h-4 w-4 cursor-pointer rounded"
                />
              </div>
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
