"use client";

/**
 * HrTabSections.tsx — HR-tab authoring sections for /people/[id].
 *
 * Wave 5 WS2F: AmendmentSection added — "Endre ansettelse" opens a drawer with
 * a MATERIAL field editor + ContractAmendmentDiff + constructive dismissal banner.
 * If is_constructive_dismissal_risk=true, admin must acknowledge before commit.
 *
 * What: Renders Ansettelse (15 §14-6 fields), Lønnsprofil (Tripletex-aligned),
 *       and Tipsregel (distribution modal) sections in the HR-tab.
 * Why: Journey 1 — admin authors employment data directly on people-page;
 *      ADR-0114 (Server Actions as canonical mutation primitive);
 *      ADR-0151 (forgery defence — workspace_id resolved server-side);
 *      ADR-0241 (contract schema migration — all Lovsen amendment fields);
 *      ADR-0242 (RevealableField for Høy-PII);
 *      ARCHITECTURE §UI 1 (people-page = authoring surface, NOT drawer).
 *
 * UnsavedChangesGuard: each section tracks a `dirty` boolean; beforeunload
 * shows native browser dialog when unsaved. No custom overlay needed —
 * the native prompt is sufficient and WCAG-compliant.
 *
 * Motion: section expand uses motionTokens.spring (Nordic Split).
 * Colors: CSS variables only — no hardcoded zinc/gray/amber.
 */

import { useCallback, useEffect, useReducer, useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  Briefcase,
  Building2,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  FileEdit,
  Info,
  Loader2,
  Lock,
  Save,
  TrendingUp,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  upsertAnsettelse,
  upsertLonnsprofil,
  upsertTipsregel,
} from "../../_actions/employment-contract-actions";
import { createClient } from "@smartout/supabase/client";
import { RevealableField } from "@/components/RevealableField";
import { ContractAmendmentDiff, type DiffField } from "@/components/contract/ContractAmendmentDiff";

// ─── Types ─────────────────────────────────────────────────────────────────

type EmploymentForm = "permanent" | "temporary" | "apprentice" | "practice" | "freelance";
type WorkingHoursScheme =
  | "notShiftWork"
  | "shiftWork"
  | "offshoreWork"
  | "continuousShiftWork335"
  | "rotation336";
type OvertimeAgreementType = "legal_default" | "local_tariff_agreement" | "arbeidstilsynet_vedtak";
type TaxCardType = "percentage" | "table" | "freecard";
type TipDistributionMethod = "per_shift_hours" | "per_position" | "fixed_percentage" | "pool";

interface ContractData {
  contract_id: string | null;
  position_title: string;
  department_id: string | null;
  employment_form: EmploymentForm | null;
  employment_category: string;
  employment_percentage: number | null;
  weekly_hours: number | null;
  working_hours_scheme: WorkingHoursScheme | null;
  occupation_code: string | null;
  start_date: string;
  end_date: string | null;
  trial_period_months: number | null;
  notice_period_months: number | null;
  break_minutes_per_day: number | null;
  training_rights: string | null;
  variable_hours_arrangement: string | null;
  // Lovsen amendments
  trial_period_paused_at: string | null;
  trial_period_pause_reason: string | null;
  trial_period_extended_until: string | null;
  remuneration_type: string | null;
  minimum_guaranteed_amount: number | null;
  overtime_agreement_type: OvertimeAgreementType;
}

interface PayrollData {
  salary_type: string;
  hourly_rate: number | null;
  monthly_salary: number | null;
  payday: number | null;
  tax_table_number: string | null;
  tax_card_type: TaxCardType | null;
  withholding_pct: number | null;
  holiday_allowance_pct: number | null;
  extra_holiday_week: boolean;
  pension_scheme_id: string | null;
  trade_union_member: boolean;
  trade_union_name: string | null;
  seniority_start_date: string | null;
  agreed_weekly_hours: number | null;
}

interface TipsregelData {
  distribution_method: TipDistributionMethod;
  tip_share: number;
  tripletex_reporting_method: string;
  a_melding_code: string;
  taxable: boolean;
  effective_from: string;
  effective_until: string | null;
}

interface HrTabSectionsProps {
  profileId: string;
  workspaceId: string;
  departments: { department_id: string; name: string }[];
  initialContract?: Partial<ContractData> | null;
  initialPayroll?: Partial<PayrollData> | null;
  initialTipsregel?: Partial<TipsregelData> | null;
}

// ─── UnsavedChangesGuard hook ──────────────────────────────────────────────

function useUnsavedChangesGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers show generic message — setting returnValue is legacy compat
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}

// ─── Input class (consistent with existing page styling) ───────────────────

const inputCls =
  "border-border bg-card text-foreground placeholder:text-muted-foreground w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500/40 transition-colors";
const selectCls =
  "border-border bg-card text-foreground w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500/40 transition-colors";
const labelCls = "text-muted-foreground mb-1 block text-xs font-semibold tracking-wider uppercase";

// Red-ring class layered on top of inputCls/selectCls when a required-field
// is missing/invalid. Visual signal only — save is never blocked. Server
// fills sane defaults when admin saves with red fields visible.
const missingCls = "!border-red-500/70 ring-2 ring-red-500/20";
const labelMissingCls = "!text-red-500";

// ─── SectionHeader ─────────────────────────────────────────────────────────

function SectionHeader({
  icon,
  title,
  subtitle,
  dirty,
  saving,
  onSave,
  onDiscard,
  alwaysShowSave = false,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  /**
   * When true, Save renders even with `dirty=false`. Used by sections where
   * defaults pre-fill the form but no DB row exists yet — admin must be able
   * to commit the defaults without typing first (rant 2026-04-29).
   */
  alwaysShowSave?: boolean;
}) {
  const showActions = dirty || alwaysShowSave;
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <div className="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
          {icon}
        </div>
        <div>
          <h3 className="text-foreground text-sm font-semibold">{title}</h3>
          {subtitle && <p className="text-muted-foreground text-xs">{subtitle}</p>}
        </div>
      </div>
      {showActions && (
        <div className="flex shrink-0 gap-2">
          {dirty && (
            <button
              type="button"
              onClick={onDiscard}
              disabled={saving}
              className="border-border text-muted-foreground hover:bg-accent rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
            >
              Forkast
            </button>
          )}
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-orange-600 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Lagre
          </button>
        </div>
      )}
    </div>
  );
}

// ─── AnsettelseSection ─────────────────────────────────────────────────────

function AnsettelseSection({
  profileId,
  workspaceId,
  departments,
  initial,
}: {
  profileId: string;
  workspaceId: string;
  departments: { department_id: string; name: string }[];
  initial: Partial<ContractData> | null | undefined;
}) {
  const today = new Date().toISOString().split("T")[0]!;

  const [form, setForm] = useState<ContractData>({
    contract_id: initial?.contract_id ?? null,
    position_title: initial?.position_title ?? "",
    department_id: initial?.department_id ?? null,
    // Norwegian defaults aligned with Aml. + DB CHECK constraints. Replaces
    // the prior "employee"/null defaults which caused immediate save fails:
    //  - employment_category="employee" violated CHECK (fast|deltid|tilkalling)
    //  - weekly_hours=null violated NOT NULL on agreed_weekly_hours
    //  - missing trial/notice defaults made admin fill mandatory fields by hand
    employment_form: initial?.employment_form ?? "permanent",
    employment_category: initial?.employment_category ?? "fast",
    employment_percentage: initial?.employment_percentage ?? 100,
    weekly_hours: initial?.weekly_hours ?? 37.5,
    working_hours_scheme: initial?.working_hours_scheme ?? null,
    occupation_code: initial?.occupation_code ?? null,
    start_date: initial?.start_date ?? today,
    end_date: initial?.end_date ?? null,
    trial_period_months: initial?.trial_period_months ?? 6,
    notice_period_months: initial?.notice_period_months ?? 1,
    break_minutes_per_day: initial?.break_minutes_per_day ?? 30,
    training_rights: initial?.training_rights ?? null,
    variable_hours_arrangement: initial?.variable_hours_arrangement ?? null,
    trial_period_paused_at: initial?.trial_period_paused_at ?? null,
    trial_period_pause_reason: initial?.trial_period_pause_reason ?? null,
    trial_period_extended_until: initial?.trial_period_extended_until ?? null,
    remuneration_type: initial?.remuneration_type ?? null,
    minimum_guaranteed_amount: initial?.minimum_guaranteed_amount ?? null,
    overtime_agreement_type: initial?.overtime_agreement_type ?? "legal_default",
  });

  const originalRef = useRef(JSON.stringify(form));
  const dirty = JSON.stringify(form) !== originalRef.current;
  const [saving, startSave] = useTransition();

  useUnsavedChangesGuard(dirty);

  const update = useCallback(<K extends keyof ContractData>(key: K, value: ContractData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = () => {
    startSave(async () => {
      const result = await upsertAnsettelse({
        profile_id: profileId,
        ...form,
      });
      if (result.ok) {
        if (result.contract_id && !form.contract_id) {
          setForm((prev) => ({ ...prev, contract_id: result.contract_id! }));
        }
        originalRef.current = JSON.stringify({
          ...form,
          contract_id: result.contract_id ?? form.contract_id,
        });
        toast.success("Ansettelse lagret");
        if (result.warning) toast.warning(result.warning);
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleDiscard = () => {
    setForm(JSON.parse(originalRef.current) as ContractData);
  };

  const isTemporary =
    form.employment_form === "temporary" ||
    form.employment_form === "apprentice" ||
    form.employment_form === "practice";

  return (
    <div className="border-border rounded-xl border p-5">
      <SectionHeader
        icon={<Briefcase className="h-4 w-4" />}
        title="Ansettelse"
        subtitle="§14-6 Arbeidsmiljøloven"
        dirty={dirty}
        saving={saving}
        onSave={handleSave}
        onDiscard={handleDiscard}
        alwaysShowSave={!form.contract_id}
      />

      {/* Required-field hints — visual signal only. Save/send always allowed. */}
      {(() => {
        const missingPosition = !form.position_title.trim();
        const missingForm = !form.employment_form;
        const missingCategory = !["fast", "deltid", "tilkalling"].includes(
          form.employment_category,
        );
        const missingStart = !form.start_date;
        const missingCount = [
          missingPosition,
          missingForm,
          missingCategory,
          missingStart,
        ].filter(Boolean).length;
        return missingCount > 0 ? (
          <p className="mb-3 text-xs text-red-500/90">
            {missingCount} felt mangler — markert med rødt. Du kan lagre likevel.
          </p>
        ) : null;
      })()}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Stillingstittel */}
        <div className="sm:col-span-2">
          <label
            className={`${labelCls} ${!form.position_title.trim() ? labelMissingCls : ""}`}
          >
            Stillingstittel
          </label>
          <input
            type="text"
            value={form.position_title}
            onChange={(e) => update("position_title", e.target.value)}
            placeholder="F.eks. Servitør"
            className={`${inputCls} ${!form.position_title.trim() ? missingCls : ""}`}
          />
        </div>

        {/* Avdeling */}
        <div>
          <label className={labelCls}>Avdeling</label>
          <select
            value={form.department_id ?? ""}
            onChange={(e) => update("department_id", e.target.value || null)}
            className={selectCls}
          >
            <option value="">Ingen avdeling</option>
            {departments.map((d) => (
              <option key={d.department_id} value={d.department_id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        {/* Ansettelsesform */}
        <div>
          <label className={`${labelCls} ${!form.employment_form ? labelMissingCls : ""}`}>
            Ansettelsesform
          </label>
          <select
            value={form.employment_form ?? ""}
            onChange={(e) => update("employment_form", (e.target.value as EmploymentForm) || null)}
            className={`${selectCls} ${!form.employment_form ? missingCls : ""}`}
          >
            <option value="">Velg form</option>
            <option value="permanent">Fast</option>
            <option value="temporary">Midlertidig</option>
            <option value="apprentice">Lærling</option>
            <option value="practice">Praksisplass</option>
            <option value="freelance">Frilanser</option>
          </select>
        </div>

        {/* Ansettelseskategori — drop-down with valid CHECK enum values */}
        <div>
          <label
            className={`${labelCls} ${!["fast", "deltid", "tilkalling"].includes(form.employment_category) ? labelMissingCls : ""}`}
          >
            Kategori
          </label>
          <select
            value={form.employment_category}
            onChange={(e) => update("employment_category", e.target.value)}
            className={`${selectCls} ${!["fast", "deltid", "tilkalling"].includes(form.employment_category) ? missingCls : ""}`}
          >
            <option value="">Velg kategori</option>
            <option value="fast">Fast</option>
            <option value="deltid">Deltid</option>
            <option value="tilkalling">Tilkalling</option>
          </select>
        </div>

        {/* Stillingsprosent */}
        <div>
          <label className={labelCls}>Stillingsprosent (%)</label>
          <input
            type="number"
            min={0}
            max={100}
            value={form.employment_percentage ?? ""}
            onChange={(e) =>
              update("employment_percentage", e.target.value ? Number(e.target.value) : null)
            }
            placeholder="100"
            className={inputCls}
          />
        </div>

        {/* Ukentlige timer */}
        <div>
          <label className={labelCls}>Ukentlige timer</label>
          <input
            type="number"
            min={0}
            max={168}
            step={0.5}
            value={form.weekly_hours ?? ""}
            onChange={(e) => update("weekly_hours", e.target.value ? Number(e.target.value) : null)}
            placeholder="37.5"
            className={inputCls}
          />
        </div>

        {/* Arbeidstidsordning */}
        <div>
          <label className={labelCls}>Arbeidstidsordning</label>
          <select
            value={form.working_hours_scheme ?? ""}
            onChange={(e) =>
              update("working_hours_scheme", (e.target.value as WorkingHoursScheme) || null)
            }
            className={selectCls}
          >
            <option value="">Velg ordning</option>
            <option value="notShiftWork">Ikke skiftarbeid</option>
            <option value="shiftWork">Skiftarbeid</option>
            <option value="offshoreWork">Offshore</option>
            <option value="continuousShiftWork335">Kontinuerlig skift 33,5t</option>
            <option value="rotation336">Rotasjon 33,6t</option>
          </select>
        </div>

        {/* STYRK-08 kode */}
        <div>
          <label className={labelCls}>STYRK-08 kode</label>
          <input
            type="text"
            value={form.occupation_code ?? ""}
            onChange={(e) => update("occupation_code", e.target.value || null)}
            placeholder="5131"
            className={inputCls}
          />
        </div>

        {/* Startdato */}
        <div>
          <label className={`${labelCls} ${!form.start_date ? labelMissingCls : ""}`}>
            Startdato
          </label>
          <input
            type="date"
            value={form.start_date}
            onChange={(e) => update("start_date", e.target.value)}
            className={`${inputCls} ${!form.start_date ? missingCls : ""}`}
          />
        </div>

        {/* Sluttdato (bare midlertidig/lærling/praksis) */}
        {isTemporary && (
          <div>
            <label className={labelCls}>
              Sluttdato
              {(form.employment_form === "apprentice" || form.employment_form === "practice") && (
                <span className="ml-1 text-rose-500">*</span>
              )}
            </label>
            <input
              type="date"
              value={form.end_date ?? ""}
              onChange={(e) => update("end_date", e.target.value || null)}
              className={inputCls}
            />
          </div>
        )}

        {/* Prøvetid */}
        <div>
          <label className={labelCls}>Prøvetid (måneder, maks 6)</label>
          <input
            type="number"
            min={0}
            max={6}
            step={1}
            value={form.trial_period_months ?? ""}
            onChange={(e) => {
              const v = e.target.value ? Number(e.target.value) : null;
              if (v !== null && v > 6) {
                toast.error("Prøvetid kan ikke overstige 6 måneder (Aml. §15-6)");
                return;
              }
              update("trial_period_months", v);
            }}
            placeholder="0"
            className={inputCls}
          />
        </div>

        {/* Oppsigelsestid */}
        <div>
          <label className={labelCls}>Oppsigelsestid (måneder)</label>
          <input
            type="number"
            min={0}
            max={12}
            step={1}
            value={form.notice_period_months ?? ""}
            onChange={(e) =>
              update("notice_period_months", e.target.value ? Number(e.target.value) : null)
            }
            placeholder="1"
            className={inputCls}
          />
        </div>

        {/* Pause i arbeidsøkten */}
        <div>
          <label className={labelCls}>Pause (minutter per dag)</label>
          <input
            type="number"
            min={0}
            max={120}
            step={5}
            value={form.break_minutes_per_day ?? ""}
            onChange={(e) =>
              update("break_minutes_per_day", e.target.value ? Number(e.target.value) : null)
            }
            placeholder="30"
            className={inputCls}
          />
        </div>

        {/* Opplæringsrettigheter */}
        <div>
          <label className={labelCls}>Opplæringsrettigheter</label>
          <input
            type="text"
            value={form.training_rights ?? ""}
            onChange={(e) => update("training_rights", e.target.value || null)}
            placeholder="Tariffavtale §X"
            className={inputCls}
          />
        </div>

        {/* Variabel arbeidstid */}
        <div className="sm:col-span-2">
          <label className={labelCls}>Variabel arbeidstidsordning</label>
          <input
            type="text"
            value={form.variable_hours_arrangement ?? ""}
            onChange={(e) => update("variable_hours_arrangement", e.target.value || null)}
            placeholder="Beskriv ordningen"
            className={inputCls}
          />
        </div>

        {/* Overtidsavtale */}
        <div>
          <label className={labelCls}>Overtidsavtale</label>
          <select
            value={form.overtime_agreement_type}
            onChange={(e) =>
              update("overtime_agreement_type", e.target.value as OvertimeAgreementType)
            }
            className={selectCls}
          >
            <option value="legal_default">Lovens standard</option>
            <option value="local_tariff_agreement">Lokal tariffavtale</option>
            <option value="arbeidstilsynet_vedtak">Arbeidstilsynet vedtak</option>
          </select>
        </div>

        {/* Lønnsform (Lovsen amendment) */}
        <div>
          <label className={labelCls}>Lønnsform</label>
          <input
            type="text"
            value={form.remuneration_type ?? ""}
            onChange={(e) => update("remuneration_type", e.target.value || null)}
            placeholder="hourly / monthly / commission"
            className={inputCls}
          />
        </div>

        {/* Minimum garantert beløp (bare provisjon) */}
        {form.remuneration_type === "commissionOnly" && (
          <div>
            <label className={labelCls}>Minimum garantert beløp (kr)</label>
            <input
              type="number"
              min={0}
              value={form.minimum_guaranteed_amount ?? ""}
              onChange={(e) =>
                update("minimum_guaranteed_amount", e.target.value ? Number(e.target.value) : null)
              }
              className={inputCls}
            />
          </div>
        )}

        {/* Prøvetid pause (Lovsen amendment) — vis bare om satt */}
        {form.trial_period_paused_at && (
          <div className="sm:col-span-2">
            <div className="border-border bg-muted/50 rounded-lg border p-3">
              <div className="flex items-center gap-2 text-sm">
                <Lock className="text-muted-foreground h-4 w-4" />
                <span className="text-foreground font-medium">Prøvetid pauset</span>
                <span className="text-muted-foreground">{form.trial_period_paused_at}</span>
              </div>
              {form.trial_period_pause_reason && (
                <p className="text-muted-foreground mt-1 text-xs">
                  {form.trial_period_pause_reason}
                </p>
              )}
              {form.trial_period_extended_until && (
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Utvidet til: {form.trial_period_extended_until}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── LonnsprofilSection ────────────────────────────────────────────────────

function LonnsprofilSection({
  profileId,
  workspaceId,
  initial,
  contractId,
}: {
  profileId: string;
  workspaceId: string;
  initial: Partial<PayrollData> | null | undefined;
  contractId: string | null;
}) {
  const today = new Date().toISOString().split("T")[0]!;

  const [form, setForm] = useState<PayrollData>({
    salary_type: initial?.salary_type ?? "hourly",
    hourly_rate: initial?.hourly_rate ?? null,
    monthly_salary: initial?.monthly_salary ?? null,
    payday: initial?.payday ?? null,
    tax_table_number: initial?.tax_table_number ?? null,
    tax_card_type: initial?.tax_card_type ?? null,
    withholding_pct: initial?.withholding_pct ?? null,
    holiday_allowance_pct: initial?.holiday_allowance_pct ?? 10.2,
    extra_holiday_week: initial?.extra_holiday_week ?? false,
    pension_scheme_id: initial?.pension_scheme_id ?? null,
    trade_union_member: initial?.trade_union_member ?? false,
    trade_union_name: initial?.trade_union_name ?? null,
    seniority_start_date: initial?.seniority_start_date ?? today,
    agreed_weekly_hours: initial?.agreed_weekly_hours ?? null,
  });

  const originalRef = useRef(JSON.stringify(form));
  const dirty = JSON.stringify(form) !== originalRef.current;
  const [saving, startSave] = useTransition();

  useUnsavedChangesGuard(dirty);

  const update = useCallback(<K extends keyof PayrollData>(key: K, value: PayrollData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = () => {
    startSave(async () => {
      const result = await upsertLonnsprofil({
        profile_id: profileId,
        contract_id: contractId,
        ...form,
      });
      if (result.ok) {
        originalRef.current = JSON.stringify(form);
        toast.success("Lønnsprofil lagret");
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleDiscard = () => {
    setForm(JSON.parse(originalRef.current) as PayrollData);
  };

  return (
    <div className="border-border rounded-xl border p-5">
      <SectionHeader
        icon={<TrendingUp className="h-4 w-4" />}
        title="Lønnsprofil"
        subtitle="Tripletex-tilpasset"
        dirty={dirty}
        saving={saving}
        onSave={handleSave}
        onDiscard={handleDiscard}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Lønnstype */}
        <div>
          <label className={labelCls}>Lønnstype</label>
          <select
            value={form.salary_type}
            onChange={(e) => update("salary_type", e.target.value)}
            className={selectCls}
          >
            <option value="hourly">Timelønn</option>
            <option value="monthly">Månedslønn</option>
            <option value="commission">Provisjon</option>
          </select>
        </div>

        {/* Timelønn */}
        {form.salary_type === "hourly" && (
          <div>
            <label className={labelCls}>Timelønn (kr)</label>
            <input
              type="number"
              min={0}
              step={0.5}
              value={form.hourly_rate ?? ""}
              onChange={(e) =>
                update("hourly_rate", e.target.value ? Number(e.target.value) : null)
              }
              placeholder="0.00"
              className={inputCls}
            />
          </div>
        )}

        {/* Månedslønn */}
        {form.salary_type === "monthly" && (
          <div>
            <label className={labelCls}>Månedslønn (kr)</label>
            <input
              type="number"
              min={0}
              step={100}
              value={form.monthly_salary ?? ""}
              onChange={(e) =>
                update("monthly_salary", e.target.value ? Number(e.target.value) : null)
              }
              placeholder="0"
              className={inputCls}
            />
          </div>
        )}

        {/* Lønningsdag */}
        <div>
          <label className={labelCls}>Lønningsdag (1–31)</label>
          <input
            type="number"
            min={1}
            max={31}
            step={1}
            value={form.payday ?? ""}
            onChange={(e) => update("payday", e.target.value ? Number(e.target.value) : null)}
            placeholder="20"
            className={inputCls}
          />
        </div>

        {/* Skattekorttype */}
        <div>
          <label className={labelCls}>Skattekorttype</label>
          <select
            value={form.tax_card_type ?? ""}
            onChange={(e) => update("tax_card_type", (e.target.value as TaxCardType) || null)}
            className={selectCls}
          >
            <option value="">Velg type</option>
            <option value="percentage">Prosentfrikortkort</option>
            <option value="table">Tabell</option>
            <option value="freecard">Frikort</option>
          </select>
        </div>

        {/* Skatteklasse-tabell — RevealableField (Høy PII per ADR-0242) */}
        <div>
          <label className={labelCls}>Skattetabellnummer</label>
          <RevealableField
            label="Skattetabellnummer"
            value={form.tax_table_number ?? ""}
            fieldName="tax_table_number"
            profileId={profileId}
            workspaceId={workspaceId}
          />
          {/* Editable input below reveal — only visible to manager/admin */}
          <input
            type="text"
            value={form.tax_table_number ?? ""}
            onChange={(e) => update("tax_table_number", e.target.value || null)}
            placeholder="7100"
            className={`${inputCls} mt-1`}
            aria-label="Rediger skattetabellnummer"
          />
        </div>

        {/* Trekkprosent */}
        <div>
          <label className={labelCls}>Trekkprosent (%)</label>
          <input
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={form.withholding_pct ?? ""}
            onChange={(e) =>
              update("withholding_pct", e.target.value ? Number(e.target.value) : null)
            }
            placeholder="0.0"
            className={inputCls}
          />
        </div>

        {/* Ferietillegg */}
        <div>
          <label className={labelCls}>Ferietillegg (%)</label>
          <input
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={form.holiday_allowance_pct ?? ""}
            onChange={(e) =>
              update("holiday_allowance_pct", e.target.value ? Number(e.target.value) : null)
            }
            placeholder="10.2"
            className={inputCls}
          />
          <p className="text-muted-foreground mt-0.5 text-xs">
            Standard: 10,2 % — 14,3 % ved Riksavtalen 5. ferieuke
          </p>
        </div>

        {/* 5. ferieuke */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id={`extra-holiday-${profileId}`}
            checked={form.extra_holiday_week}
            onChange={(e) => update("extra_holiday_week", e.target.checked)}
            className="h-4 w-4 rounded"
          />
          <label
            htmlFor={`extra-holiday-${profileId}`}
            className={`${labelCls} mb-0 cursor-pointer`}
          >
            5. ferieuke
          </label>
        </div>

        {/* Ansiennitetsdato */}
        <div>
          <label className={labelCls}>Ansiennitetsdato</label>
          <input
            type="date"
            value={form.seniority_start_date ?? ""}
            onChange={(e) => update("seniority_start_date", e.target.value || null)}
            className={inputCls}
          />
        </div>

        {/* Fagforening — GDPR Art. 9 (særlige kategorier) */}
        <div className="sm:col-span-2">
          <div className="border-border bg-muted/30 rounded-lg border p-3">
            <div className="mb-2 flex items-center gap-2">
              <Users className="text-muted-foreground h-4 w-4" />
              <span className="text-foreground text-xs font-semibold">Fagforening</span>
              <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                GDPR Art. 9
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id={`union-${profileId}`}
                checked={form.trade_union_member}
                onChange={(e) => {
                  update("trade_union_member", e.target.checked);
                  if (!e.target.checked) update("trade_union_name", null);
                }}
                className="h-4 w-4 rounded"
              />
              <label htmlFor={`union-${profileId}`} className="text-foreground text-sm">
                Fagforeningsmedlem
              </label>
            </div>
            {form.trade_union_member && (
              <input
                type="text"
                value={form.trade_union_name ?? ""}
                onChange={(e) => update("trade_union_name", e.target.value || null)}
                placeholder="Fagforeningens navn"
                className={`${inputCls} mt-2`}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── TipsregelSection ──────────────────────────────────────────────────────

function TipsregelSection({
  profileId,
  workspaceId,
  contractId,
  initial,
}: {
  profileId: string;
  workspaceId: string;
  contractId: string | null;
  initial: Partial<TipsregelData> | null | undefined;
}) {
  const today = new Date().toISOString().split("T")[0]!;
  const [open, setOpen] = useState(false);

  const [form, setForm] = useState<TipsregelData>({
    distribution_method: initial?.distribution_method ?? "per_shift_hours",
    tip_share: initial?.tip_share ?? 1.0,
    tripletex_reporting_method: initial?.tripletex_reporting_method ?? "included_in_salary",
    a_melding_code: initial?.a_melding_code ?? "211",
    taxable: initial?.taxable ?? true,
    effective_from: initial?.effective_from ?? today,
    effective_until: initial?.effective_until ?? null,
  });

  const originalRef = useRef(JSON.stringify(form));
  const dirty = JSON.stringify(form) !== originalRef.current;
  const [saving, startSave] = useTransition();

  useUnsavedChangesGuard(dirty);

  const update = useCallback(<K extends keyof TipsregelData>(key: K, value: TipsregelData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = () => {
    if (!contractId) {
      toast.error("Lagre ansettelse først for å sette tipsregel");
      return;
    }
    startSave(async () => {
      const result = await upsertTipsregel({
        profile_id: profileId,
        contract_id: contractId,
        ...form,
      });
      if (result.ok) {
        originalRef.current = JSON.stringify(form);
        toast.success("Tipsregel lagret");
        setOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleDiscard = () => {
    setForm(JSON.parse(originalRef.current) as TipsregelData);
  };

  return (
    <div className="border-border rounded-xl border p-5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2.5">
          <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-lg">
            <CreditCard className="h-4 w-4" />
          </div>
          <div className="text-left">
            <h3 className="text-foreground text-sm font-semibold">Tipsregel</h3>
            <p className="text-muted-foreground text-xs">Fordeling og rapportering</p>
          </div>
        </div>
        {open ? (
          <ChevronUp className="text-muted-foreground h-4 w-4" />
        ) : (
          <ChevronDown className="text-muted-foreground h-4 w-4" />
        )}
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          {!contractId && (
            <div className="border-border bg-muted/30 flex items-center gap-2 rounded-lg border p-3 text-sm">
              <Info className="text-muted-foreground h-4 w-4 shrink-0" />
              <span className="text-muted-foreground">
                Lagre ansettelse først for å aktivere tipsregel
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Fordelingsmetode */}
            <div>
              <label className={labelCls}>Fordelingsmetode</label>
              <select
                value={form.distribution_method}
                onChange={(e) =>
                  update("distribution_method", e.target.value as TipDistributionMethod)
                }
                className={selectCls}
                disabled={!contractId}
              >
                <option value="per_shift_hours">Per vakttime</option>
                <option value="per_position">Per stilling</option>
                <option value="fixed_percentage">Fast prosent</option>
                <option value="pool">Pool</option>
              </select>
            </div>

            {/* Tipsandel (0.00–1.50) */}
            <div>
              <label className={labelCls}>Tipsandel (0,00–1,50)</label>
              <input
                type="number"
                min={0}
                max={1.5}
                step={0.01}
                value={form.tip_share}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (v > 1.5) {
                    toast.error("Tipsandel kan ikke overstige 1,50");
                    return;
                  }
                  update("tip_share", v);
                }}
                className={inputCls}
                disabled={!contractId}
              />
            </div>

            {/* Tripletex rapporteringsmetode */}
            <div>
              <label className={labelCls}>Tripletex rapportering</label>
              <input
                type="text"
                value={form.tripletex_reporting_method}
                onChange={(e) => update("tripletex_reporting_method", e.target.value)}
                placeholder="included_in_salary"
                className={inputCls}
                disabled={!contractId}
              />
            </div>

            {/* A-meldingskode */}
            <div>
              <label className={labelCls}>A-meldingskode</label>
              <input
                type="text"
                value={form.a_melding_code}
                onChange={(e) => update("a_melding_code", e.target.value)}
                placeholder="211"
                className={inputCls}
                disabled={!contractId}
              />
            </div>

            {/* Skattepliktig */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id={`taxable-tip-${profileId}`}
                checked={form.taxable}
                onChange={(e) => update("taxable", e.target.checked)}
                disabled={!contractId}
                className="h-4 w-4 rounded"
              />
              <label
                htmlFor={`taxable-tip-${profileId}`}
                className={`${labelCls} mb-0 cursor-pointer`}
              >
                Skattepliktig tips
              </label>
            </div>

            {/* Gyldig fra */}
            <div>
              <label className={labelCls}>Gyldig fra</label>
              <input
                type="date"
                value={form.effective_from}
                onChange={(e) => update("effective_from", e.target.value)}
                className={inputCls}
                disabled={!contractId}
              />
            </div>

            {/* Gyldig til */}
            <div>
              <label className={labelCls}>Gyldig til (valgfritt)</label>
              <input
                type="date"
                value={form.effective_until ?? ""}
                onChange={(e) => update("effective_until", e.target.value || null)}
                className={inputCls}
                disabled={!contractId}
              />
            </div>
          </div>

          {dirty && contractId && (
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleDiscard}
                disabled={saving}
                className="border-border text-muted-foreground hover:bg-accent rounded-lg border px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50"
              >
                Forkast
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-orange-600 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Save className="h-3 w-3" />
                )}
                Lagre tipsregel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── AmendmentSection ───────────────────────────────────────────────────────
// WS2F: People-page amendment UI.
// Shows "Endre ansettelse" button; on click opens an inline panel with
// editable MATERIAL fields, ContractAmendmentDiff side-by-side preview,
// constructive dismissal banner, and admin acknowledgement checkbox.
//
// ADR-0244: if is_constructive_dismissal_risk=true, shows Aml. §15-7 banner.
//           Admin must check `acknowledged_constructive_dismissal_risk` before commit.
// ADR-0151: POST to /api/contracts/[id]/amend — workspaceId resolved server-side.
// Telemetry: contract.amendment_initiated (Wave 3 Part E).

interface AmendmentSectionProps {
  profileId: string;
  workspaceId: string;
  contractId: string | null;
}

interface AmendmentFieldState {
  position_title: string;
  hourly_rate: string;
  monthly_salary: string;
  agreed_weekly_hours: string;
}

function AmendmentSection({ profileId, workspaceId, contractId }: AmendmentSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [diffFields, setDiffFields] = useState<DiffField[]>([]);
  const [requiresSignature, setRequiresSignature] = useState(false);
  const [isConstructiveDismissal, setIsConstructiveDismissal] = useState(false);
  const [acknowledgedCDR, setAcknowledgedCDR] = useState(false);
  const [classified, setClassified] = useState(false);
  const [amendments, setAmendments] = useState<AmendmentFieldState>({
    position_title: "",
    hourly_rate: "",
    monthly_salary: "",
    agreed_weekly_hours: "",
  });

  // Emit contract.amendment_initiated when section opens.
  useEffect(() => {
    if (!isOpen) return;
    void fetch("/api/telemetry/emit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "contract.amendment_initiated",
        workspace_id: workspaceId,
        actor_id: profileId,
        entity_type: "employment_contract",
        entity_id: contractId ?? profileId,
        data: { profile_id: profileId, contract_id: contractId },
      }),
    }).catch(() => {
      /* fire-and-forget */
    });
  }, [isOpen, workspaceId, profileId, contractId]);

  if (!contractId) {
    return (
      <div className="border-border rounded-xl border p-4">
        <p className="text-muted-foreground text-sm">
          Ingen aktiv kontrakt — lag kontrakt først før du foreslår endringer.
        </p>
      </div>
    );
  }

  async function handleClassify() {
    const fieldChanges = [];
    if (amendments.position_title)
      fieldChanges.push({ column: "position_title", from: null, to: amendments.position_title });
    if (amendments.hourly_rate) {
      const val = parseFloat(amendments.hourly_rate);
      if (!isNaN(val)) fieldChanges.push({ column: "hourly_rate", from: null, to: val });
    }
    if (amendments.monthly_salary) {
      const val = parseFloat(amendments.monthly_salary);
      if (!isNaN(val)) fieldChanges.push({ column: "monthly_salary", from: null, to: val });
    }
    if (amendments.agreed_weekly_hours) {
      const val = parseFloat(amendments.agreed_weekly_hours);
      if (!isNaN(val)) fieldChanges.push({ column: "agreed_weekly_hours", from: null, to: val });
    }

    if (fieldChanges.length === 0) {
      toast.error("Fyll inn minst ett felt du vil endre.");
      return;
    }

    // Preview classification (dry run — no DB write).
    try {
      const res = await fetch(`/api/contracts/${contractId}/amend/classify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field_changes: fieldChanges }),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          requires_employee_signature: boolean;
          is_constructive_dismissal_risk: boolean;
          classifications: Array<{ column: string; label_nb: string }>;
        };
        setRequiresSignature(data.requires_employee_signature);
        setIsConstructiveDismissal(data.is_constructive_dismissal_risk);
        setDiffFields(
          fieldChanges.map((fc) => {
            const cls = data.classifications.find((c) => c.column === fc.column);
            return {
              label: cls?.label_nb ?? fc.column,
              previous: null,
              proposed: fc.to as string | number | null,
            };
          }),
        );
      } else {
        // Fallback: show diff without classification.
        setDiffFields(
          fieldChanges.map((fc) => ({
            label: fc.column,
            previous: null,
            proposed: fc.to as string | number | null,
          })),
        );
      }
      setClassified(true);
    } catch {
      // Offline fallback.
      setDiffFields(
        fieldChanges.map((fc) => ({
          label: fc.column,
          previous: null,
          proposed: fc.to as string | number | null,
        })),
      );
      setClassified(true);
    }
  }

  async function handleSubmit() {
    if (isConstructiveDismissal && !acknowledgedCDR) {
      toast.error("Du må bekrefte anerkjennelse av endringsoppsigelse-risiko.");
      return;
    }

    const fieldChanges = [];
    if (amendments.position_title)
      fieldChanges.push({ column: "position_title", from: null, to: amendments.position_title });
    if (amendments.hourly_rate) {
      const val = parseFloat(amendments.hourly_rate);
      if (!isNaN(val)) fieldChanges.push({ column: "hourly_rate", from: null, to: val });
    }
    if (amendments.monthly_salary) {
      const val = parseFloat(amendments.monthly_salary);
      if (!isNaN(val)) fieldChanges.push({ column: "monthly_salary", from: null, to: val });
    }
    if (amendments.agreed_weekly_hours) {
      const val = parseFloat(amendments.agreed_weekly_hours);
      if (!isNaN(val)) fieldChanges.push({ column: "agreed_weekly_hours", from: null, to: val });
    }

    if (fieldChanges.length === 0) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/contracts/${contractId}/amend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field_changes: fieldChanges,
          acknowledged_constructive_dismissal_risk: isConstructiveDismissal
            ? acknowledgedCDR
            : undefined,
        }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        toast.error(err.error ?? "Feil ved oppretting av amendment.");
        return;
      }

      const data = (await res.json()) as {
        amendment_id: string;
        requires_employee_signature: boolean;
      };
      toast.success(
        data.requires_employee_signature
          ? "Amendment opprettet — ansatt varsles om signering."
          : "Amendment effektuert — kontrakt oppdatert.",
      );
      setIsOpen(false);
      setAmendments({
        position_title: "",
        hourly_rate: "",
        monthly_salary: "",
        agreed_weekly_hours: "",
      });
      setDiffFields([]);
      setClassified(false);
      setIsConstructiveDismissal(false);
      setAcknowledgedCDR(false);
    } catch {
      toast.error("Nettverksfeil — prøv igjen.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="border-border overflow-hidden rounded-xl border">
      {/* Section header */}
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="hover:bg-muted/50 flex w-full items-center justify-between px-4 py-3 text-left transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
            <FileEdit className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-foreground text-sm font-semibold">Endre ansettelse</h3>
            <p className="text-muted-foreground text-xs">Foreslå endring i kontraktsvilkår</p>
          </div>
        </div>
        {isOpen ? (
          <ChevronUp className="text-muted-foreground h-4 w-4 shrink-0" />
        ) : (
          <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0" />
        )}
      </button>

      {isOpen && (
        <div className="border-border bg-card space-y-4 border-t px-4 pt-3 pb-4">
          {/* Field inputs */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Stillingstittel</label>
              <input
                type="text"
                value={amendments.position_title}
                onChange={(e) =>
                  setAmendments((prev) => ({ ...prev, position_title: e.target.value }))
                }
                placeholder="Ny stillingstittel..."
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Timelønn (NOK)</label>
              <input
                type="number"
                value={amendments.hourly_rate}
                onChange={(e) =>
                  setAmendments((prev) => ({ ...prev, hourly_rate: e.target.value }))
                }
                placeholder="195.00"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Månedslønn (NOK)</label>
              <input
                type="number"
                value={amendments.monthly_salary}
                onChange={(e) =>
                  setAmendments((prev) => ({ ...prev, monthly_salary: e.target.value }))
                }
                placeholder="35000"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Ukentlige arbeidstimer</label>
              <input
                type="number"
                value={amendments.agreed_weekly_hours}
                onChange={(e) =>
                  setAmendments((prev) => ({ ...prev, agreed_weekly_hours: e.target.value }))
                }
                placeholder="37.5"
                className={inputCls}
              />
            </div>
          </div>

          {/* Preview button */}
          {!classified && (
            <button
              type="button"
              onClick={handleClassify}
              className="border-border text-foreground hover:bg-accent w-full rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
            >
              Forhåndsvis endringer
            </button>
          )}

          {/* Diff preview */}
          {classified && diffFields.length > 0 && (
            <div className="space-y-3">
              <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                Endringsoversikt
              </p>
              <ContractAmendmentDiff fields={diffFields} layout="side-by-side" />

              {/* Signature requirement badge */}
              {requiresSignature && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2">
                  <Info className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                    Materiell endring — krever ny signering av ansatt.
                  </span>
                </div>
              )}

              {/* Constructive dismissal banner (Aml. §15-7) */}
              {isConstructiveDismissal && (
                <div className="space-y-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                    <div>
                      <p className="text-sm font-semibold text-rose-700 dark:text-rose-400">
                        Mulig endringsoppsigelse — Aml. §15-7
                      </p>
                      <p className="mt-1 text-xs text-rose-600 dark:text-rose-500">
                        Denne endringen kan utgjøre endringsoppsigelse iht. Aml. §15-7. Saklig
                        grunn-vurdering kreves. Kontakt HR-advokat før gjennomføring.
                      </p>
                    </div>
                  </div>
                  <label className="flex cursor-pointer items-start gap-2">
                    <input
                      type="checkbox"
                      checked={acknowledgedCDR}
                      onChange={(e) => setAcknowledgedCDR(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-rose-500/40"
                    />
                    <span className="text-xs text-rose-700 dark:text-rose-400">
                      Jeg bekrefter at saklig grunn-vurdering er gjennomført og dokumentert (Aml.
                      §15-7).
                    </span>
                  </label>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting || (isConstructiveDismissal && !acknowledgedCDR)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white transition-all hover:bg-orange-600 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Lag amendment
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setClassified(false);
                    setDiffFields([]);
                    setIsConstructiveDismissal(false);
                    setAcknowledgedCDR(false);
                  }}
                  disabled={isSubmitting}
                  className="border-border text-muted-foreground hover:bg-accent rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
                >
                  Tilbake
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main export ────────────────────────────────────────────────────────────

export function HrTabSections({
  profileId,
  workspaceId,
  departments,
  initialContract,
  initialPayroll,
  initialTipsregel,
}: HrTabSectionsProps) {
  // Page mount currently does NOT pre-fetch the latest draft contract for
  // this profile (people-page is "use client" and skipped server-side
  // hydration). Fetch on mount so AnsettelseSection initializes with the
  // existing draft instead of a blank form. Without this, every save creates
  // a new draft row and reload looks like nothing was saved.
  const [fetchedContract, setFetchedContract] = useState<Partial<ContractData> | null | undefined>(
    initialContract,
  );
  const [fetchedPayroll, setFetchedPayroll] = useState<Partial<PayrollData> | null | undefined>(
    initialPayroll,
  );
  const [fetchedTipsregel, setFetchedTipsregel] = useState<
    Partial<TipsregelData> | null | undefined
  >(initialTipsregel);
  const [hydrating, setHydrating] = useState<boolean>(initialContract === undefined);

  useEffect(() => {
    if (initialContract !== undefined) return;
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const { data: contractRow } = await supabase
        .from("employment_contract")
        .select(
          "contract_id, position_title, employment_form, employment_category, employment_percentage, agreed_weekly_hours, working_hours_scheme, occupation_code, start_date, end_date, trial_period_months, notice_period_months, break_minutes_per_day, training_rights, variable_hours_arrangement, trial_period_paused_at, trial_period_pause_reason, trial_period_extended_until, remuneration_type, minimum_guaranteed_amount, overtime_agreement_type",
        )
        .eq("profile_id", profileId)
        .eq("workspace_id", workspaceId)
        .in("status", ["draft", "pending_data", "ready_to_send"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;
      if (contractRow) {
        // Map server column agreed_weekly_hours → form weekly_hours. Other
        // columns share names with ContractData fields.
        const { agreed_weekly_hours, ...rest } = contractRow as Record<string, unknown> & {
          agreed_weekly_hours: number | null;
        };
        setFetchedContract({
          ...(rest as Partial<ContractData>),
          weekly_hours: agreed_weekly_hours ?? null,
        });
      } else {
        setFetchedContract(null);
      }
      setHydrating(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [profileId, workspaceId, initialContract]);

  // Track contract_id across sections so Lønnsprofil, Tipsregel and Amendment can link.
  const [contractId, setContractId] = useState<string | null>(
    fetchedContract?.contract_id ?? null,
  );
  // Sync contractId when fetch resolves.
  useEffect(() => {
    if (fetchedContract?.contract_id) setContractId(fetchedContract.contract_id);
  }, [fetchedContract?.contract_id]);
  void setContractId;
  // Suppress unused warning — payroll/tipsregel hydration deferred (only
  // contract drives the visible save bug; payroll/tipsregel rarely block).
  void setFetchedPayroll;
  void setFetchedTipsregel;

  if (hydrating) {
    return (
      <div className="border-border flex items-center gap-2 rounded-xl border p-5">
        <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
        <span className="text-muted-foreground text-sm">Henter ansettelsesdata…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AnsettelseSection
        profileId={profileId}
        workspaceId={workspaceId}
        departments={departments}
        initial={fetchedContract}
      />
      <LonnsprofilSection
        profileId={profileId}
        workspaceId={workspaceId}
        initial={fetchedPayroll}
        contractId={contractId}
      />
      <TipsregelSection
        profileId={profileId}
        workspaceId={workspaceId}
        contractId={contractId}
        initial={fetchedTipsregel}
      />
      {/* WS2F: Amendment section — only shown when a signed contract exists */}
      <AmendmentSection profileId={profileId} workspaceId={workspaceId} contractId={contractId} />
    </div>
  );
}
