"use client";

/**
 * LonnsprofilSection.tsx — Tripletex-aligned payroll-profile section for /people/[id] HR tab.
 *
 * What: Displays + edits employee_payroll_profile fields (Tripletex integration data,
 *       tax-card fields, HIGH-PII masked fields, pension scheme selection).
 * Why:  Cycle 6 Wave 1 Phase 2 — HR-tab authoring surface for payroll profile.
 *       Phase 5 TD — admin tax-card form + BFF-reveal for personal_number + bank_account.
 *       ADR-0077 (PII handling — bank_account + personal_number masked, BFF reveal only).
 *       ADR-0078 Layer-3 (voice readback of PII fields FORBIDDEN — no voice surface here).
 *       ADR-0242 (RevealableField BFF-fetch mode for Høy-PII).
 *       ADR-0245 (web-only admin authoring surface).
 *       ADR-0151 (workspace_id resolved server-side — POST via employment action).
 *
 * Edit mode:
 *   - Admin: mid-PII fields + tax-card fields editable.
 *   - Manager/Employee: mid-PII fields editable, tax-card fields read-only.
 * HIGH-PII fields (bank_account, personal_number): BFF-reveal for ALL roles that can view.
 *
 * Save: via upsertLonnsprofil Server Action.
 *
 * Telemetry: TODO — Agent V wires payroll_profile.updated emit() in Wave 2.
 *
 * Voice readback: FORBIDDEN per ADR-0078 for all fields in this section.
 * DomainChatOwnership: TODO — mount <DomainChatOwnership reason="payroll-profile" />
 * when the component is available (ADR-0238, Orb suppression for payroll surface).
 */

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  Edit2,
  Info,
  Loader2,
  RefreshCw,
  Save,
  Shield,
  TrendingUp,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { toast } from "sonner";
import { createClient } from "@smartout/supabase/client";
import { RevealableField } from "@/components/RevealableField";
import {
  upsertLonnsprofil,
  upsertPayrollPhase1Fields,
} from "../../_actions/employment-contract-actions";
import { TimebankPanel } from "./TimebankPanel";
import type { Database } from "@smartout/supabase";

// ─── Types ─────────────────────────────────────────────────────────────────

type SyncStatusEnum = Database["public"]["Enums"]["sync_status_enum"];
type TaxCardTypeEnum = Database["public"]["Enums"]["tax_card_type"];

type PensionScheme = {
  id: string;
  name: string;
  provider: string | null;
  scheme_type: string;
};

interface PayrollProfileData {
  payroll_tripletex_employee_id: number | null;
  payroll_sync_status: SyncStatusEnum;
  payroll_last_synced_at: string | null;
  // Tax-card fields — editable by admin (Phase 5 TD)
  tax_table_number: string | null;
  tax_card_type: TaxCardTypeEnum | null;
  tax_percentage: number | null;
  tax_card_year: number | null;
  tax_card_fetched_at: string | null;
  pension_scheme_id: string | null;
  // Phase 1 payroll fields
  overtime_mode: "paid_out" | "banked";
  toil_agreement_signed_at: string | null;
  holiday_allowance_pct: number;
  toil_max_banked_hours: number | null;
}

interface LonnsprofilSectionProps {
  profileId: string;
  workspaceId: string;
  /** If a contract exists, pass for server action linkage */
  contractId?: string | null;
  /**
   * Whether the viewer is an admin. Admin gets editable tax-card form.
   * Non-admin sees tax fields as read-only.
   * Defaults to false (safe).
   */
  isAdmin?: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const inputCls =
  "border-border bg-card text-foreground placeholder:text-muted-foreground w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500/40 transition-colors disabled:opacity-60 disabled:cursor-not-allowed";

const selectCls =
  "border-border bg-card text-foreground w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500/40 transition-colors disabled:opacity-60 disabled:cursor-not-allowed";

const labelCls = "text-muted-foreground mb-1 block text-xs font-semibold tracking-wider uppercase";

/** Maps sync_status_enum → Norwegian label + color tokens */
function SyncStatusBadge({ status }: { status: SyncStatusEnum }) {
  const cfg: Record<SyncStatusEnum, { label: string; cls: string }> = {
    synced: {
      label: "Synkronisert",
      cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
    pending: {
      label: "Venter",
      cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
    divergent: {
      label: "Avvik",
      cls: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    },
    not_synced: {
      label: "Ikke synkronisert",
      cls: "bg-secondary text-muted-foreground",
    },
  };

  const { label, cls } = cfg[status] ?? cfg.not_synced;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}
    >
      {status === "synced" && <CheckCircle2 className="h-3 w-3" />}
      {status === "pending" && <Clock className="h-3 w-3" />}
      {status === "divergent" && <AlertTriangle className="h-3 w-3" />}
      {status === "not_synced" && <RefreshCw className="h-3 w-3" />}
      {label}
    </span>
  );
}

/** Formats ISO timestamp to "15. nov 2026 14:30" (Norwegian) */
function formatSyncTimestamp(iso: string): string {
  try {
    return format(new Date(iso), "d. MMM yyyy HH:mm", { locale: nb });
  } catch {
    return iso;
  }
}

const TAX_CARD_TYPE_LABELS: Record<TaxCardTypeEnum, string> = {
  percentage: "Trekkprosent",
  table: "Trekktabell",
  freecard: "Frikort",
};

// ─── Component ─────────────────────────────────────────────────────────────

export function LonnsprofilSection({
  profileId,
  workspaceId,
  contractId,
  isAdmin = false,
}: LonnsprofilSectionProps) {
  const [data, setData] = useState<PayrollProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, startSave] = useTransition();

  // Edit state — mid-PII fields (all roles)
  const [editTripletexId, setEditTripletexId] = useState<string>("");
  const [editPensionId, setEditPensionId] = useState<string>("");
  // Phase 1 payroll edit state (ADR-0254)
  const [editOvertimeMode, setEditOvertimeMode] = useState<"paid_out" | "banked">("paid_out");
  const [editHolidayPct, setEditHolidayPct] = useState<string>("12");
  const [editToilMax, setEditToilMax] = useState<string>("");

  // Tax-card edit state — admin only (Phase 5 TD)
  const [editTaxCardType, setEditTaxCardType] = useState<TaxCardTypeEnum | "">("");
  const [editTaxTableNumber, setEditTaxTableNumber] = useState<string>("");
  const [editTaxPercentage, setEditTaxPercentage] = useState<string>("");
  const [editTaxCardYear, setEditTaxCardYear] = useState<string>(String(new Date().getFullYear()));

  // Tax-card validation errors
  const [taxErrors, setTaxErrors] = useState<string[]>([]);

  // Pension scheme options
  const [pensionSchemes, setPensionSchemes] = useState<PensionScheme[]>([]);

  const supabase = createClient();

  // Fetch payroll profile + pension schemes.
  // HIGH-PII (bank_account, personal_number) are NOT fetched here — they come via BFF reveal.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const [payrollRes, pensionRes] = await Promise.all([
        supabase
          .from("employee_payroll_profile")
          .select(
            "payroll_tripletex_employee_id, payroll_sync_status, payroll_last_synced_at, tax_table_number, tax_card_type, tax_percentage, tax_card_year, tax_card_fetched_at, pension_scheme_id, overtime_mode, toil_agreement_signed_at, holiday_allowance_pct, toil_max_banked_hours",
          )
          .eq("profile_id", profileId)
          .eq("workspace_id", workspaceId)
          .maybeSingle(),
        supabase
          .from("pension_scheme")
          .select("id, name, provider, scheme_type")
          .eq("workspace_id", workspaceId)
          .eq("is_active", true)
          .order("name"),
      ]);

      if (cancelled) return;

      const pp = payrollRes.data;
      const overtimeMode = (pp?.overtime_mode ?? "paid_out") as "paid_out" | "banked";
      const holidayPct = pp?.holiday_allowance_pct ?? 12;
      const toilMax = pp?.toil_max_banked_hours ?? null;

      setData({
        payroll_tripletex_employee_id: pp?.payroll_tripletex_employee_id ?? null,
        payroll_sync_status: (pp?.payroll_sync_status ?? "not_synced") as SyncStatusEnum,
        payroll_last_synced_at: pp?.payroll_last_synced_at ?? null,
        tax_table_number: pp?.tax_table_number ?? null,
        tax_card_type: (pp?.tax_card_type ?? null) as TaxCardTypeEnum | null,
        tax_percentage: pp?.tax_percentage ?? null,
        tax_card_year: pp?.tax_card_year ?? null,
        tax_card_fetched_at: pp?.tax_card_fetched_at ?? null,
        pension_scheme_id: pp?.pension_scheme_id ?? null,
        overtime_mode: overtimeMode,
        toil_agreement_signed_at: pp?.toil_agreement_signed_at ?? null,
        holiday_allowance_pct: holidayPct,
        toil_max_banked_hours: toilMax,
      });

      setEditTripletexId(String(pp?.payroll_tripletex_employee_id ?? ""));
      setEditPensionId(pp?.pension_scheme_id ?? "");
      setEditOvertimeMode(overtimeMode);
      setEditHolidayPct(String(holidayPct));
      setEditToilMax(toilMax != null ? String(toilMax) : "");
      // Tax-card edit defaults
      setEditTaxCardType((pp?.tax_card_type ?? "") as TaxCardTypeEnum | "");
      setEditTaxTableNumber(pp?.tax_table_number ?? "");
      setEditTaxPercentage(pp?.tax_percentage != null ? String(pp.tax_percentage) : "");
      setEditTaxCardYear(
        pp?.tax_card_year != null ? String(pp.tax_card_year) : String(new Date().getFullYear()),
      );

      setPensionSchemes((pensionRes.data ?? []) as PensionScheme[]);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [profileId, workspaceId]);

  const originalEditRef = useRef({
    tripletexId: "",
    pensionId: "",
    overtimeMode: "paid_out" as "paid_out" | "banked",
    holidayPct: "12",
    toilMax: "",
    taxCardType: "" as TaxCardTypeEnum | "",
    taxTableNumber: "",
    taxPercentage: "",
    taxCardYear: String(new Date().getFullYear()),
  });

  const handleEdit = useCallback(() => {
    originalEditRef.current = {
      tripletexId: editTripletexId,
      pensionId: editPensionId,
      overtimeMode: editOvertimeMode,
      holidayPct: editHolidayPct,
      toilMax: editToilMax,
      taxCardType: editTaxCardType,
      taxTableNumber: editTaxTableNumber,
      taxPercentage: editTaxPercentage,
      taxCardYear: editTaxCardYear,
    };
    setTaxErrors([]);
    setEditing(true);
  }, [
    editTripletexId,
    editPensionId,
    editOvertimeMode,
    editHolidayPct,
    editToilMax,
    editTaxCardType,
    editTaxTableNumber,
    editTaxPercentage,
    editTaxCardYear,
  ]);

  const handleDiscard = useCallback(() => {
    setEditTripletexId(originalEditRef.current.tripletexId);
    setEditPensionId(originalEditRef.current.pensionId);
    setEditOvertimeMode(originalEditRef.current.overtimeMode);
    setEditHolidayPct(originalEditRef.current.holidayPct);
    setEditToilMax(originalEditRef.current.toilMax);
    setEditTaxCardType(originalEditRef.current.taxCardType);
    setEditTaxTableNumber(originalEditRef.current.taxTableNumber);
    setEditTaxPercentage(originalEditRef.current.taxPercentage);
    setEditTaxCardYear(originalEditRef.current.taxCardYear);
    setTaxErrors([]);
    setEditing(false);
  }, []);

  /** Validate tax-card fields before save. Returns error messages (empty = valid). */
  function validateTaxFields(): string[] {
    const errors: string[] = [];
    const type = editTaxCardType;
    const anyTaxSet = type !== "" || editTaxTableNumber !== "" || editTaxPercentage !== "";

    if (anyTaxSet) {
      const year = parseInt(editTaxCardYear, 10);
      if (!editTaxCardYear || isNaN(year) || year < 2024 || year > 2035) {
        errors.push("Kortår (årstall) er påkrevd ved skattekortendring (2024–2035)");
      }
      if (type === "percentage") {
        const pct = parseFloat(editTaxPercentage);
        if (editTaxPercentage === "" || isNaN(pct) || pct < 0 || pct > 100) {
          errors.push("Trekkprosent (0–100) er påkrevd ved prosent-skattekort");
        }
      }
      if (type === "table") {
        if (!/^\d{4}$/.test(editTaxTableNumber)) {
          errors.push("Skattetabellnummer må være 4 sifre ved tabellskattekort");
        }
      }
    }
    return errors;
  }

  const handleSave = () => {
    if (isAdmin) {
      const errs = validateTaxFields();
      if (errs.length > 0) {
        setTaxErrors(errs);
        return;
      }
      setTaxErrors([]);
    }

    startSave(async () => {
      // Resolve tax-card values — only pass if admin and any tax field was touched
      const taxChanged =
        isAdmin &&
        (editTaxCardType !== originalEditRef.current.taxCardType ||
          editTaxTableNumber !== originalEditRef.current.taxTableNumber ||
          editTaxPercentage !== originalEditRef.current.taxPercentage ||
          editTaxCardYear !== originalEditRef.current.taxCardYear);

      // Fix 4 (HIGH): parse + validate Tripletex ID before building the action payload
      // so we fail fast client-side (avoids a round-trip for invalid input).
      let parsedTripletexId: number | null | undefined = undefined; // undefined = not supplied
      if (editTripletexId !== originalEditRef.current.tripletexId) {
        if (editTripletexId === "" || editTripletexId === null) {
          parsedTripletexId = null; // clear
        } else {
          const n = parseInt(editTripletexId, 10);
          if (isNaN(n)) {
            toast.error("Tripletex ansatt-ID må være et tall");
            return;
          }
          parsedTripletexId = n;
        }
      }

      const result = await upsertLonnsprofil({
        profile_id: profileId,
        contract_id: contractId ?? null,
        salary_type: "hourly", // Required field — preserved; this section only patches its fields.
        pension_scheme_id: editPensionId || null,
        // Fix 4: tripletex_employee_id now flows through the server action (gated + audited).
        // undefined means "unchanged this save" — action leaves the column untouched.
        ...(parsedTripletexId !== undefined && {
          payroll_tripletex_employee_id: parsedTripletexId,
        }),
        ...(taxChanged && {
          tax_card_type: (editTaxCardType || null) as "percentage" | "table" | "freecard" | null,
          tax_table_number: editTaxTableNumber || null,
          withholding_pct: editTaxPercentage ? parseFloat(editTaxPercentage) : null,
          tax_card_year: editTaxCardYear ? parseInt(editTaxCardYear, 10) : null,
        }),
      });

      if (result.ok) {
        // Reflect updated values in local state
        setData((prev) => {
          if (!prev) return prev;
          const next = {
            ...prev,
            payroll_tripletex_employee_id: editTripletexId ? parseInt(editTripletexId, 10) : null,
            pension_scheme_id: editPensionId || null,
          };
          if (taxChanged) {
            next.tax_card_type = (editTaxCardType || null) as TaxCardTypeEnum | null;
            next.tax_table_number = editTaxTableNumber || null;
            next.tax_percentage = editTaxPercentage ? parseFloat(editTaxPercentage) : null;
            next.tax_card_year = editTaxCardYear ? parseInt(editTaxCardYear, 10) : null;
            next.tax_card_fetched_at = new Date().toISOString();
          }
          return next;
        });

        // Save Phase 1 payroll fields if any changed
        const phase1Changed =
          editOvertimeMode !== originalEditRef.current.overtimeMode ||
          editHolidayPct !== originalEditRef.current.holidayPct ||
          editToilMax !== originalEditRef.current.toilMax;

        if (phase1Changed) {
          const holidayPctNum = parseFloat(editHolidayPct);
          if (isNaN(holidayPctNum) || holidayPctNum < 10.2 || holidayPctNum > 20) {
            toast.error("Feriepengeprosent må være mellom 10,2 og 20");
            return;
          }
          const toilMaxNum = editToilMax ? parseFloat(editToilMax) : null;
          if (editToilMax && (isNaN(toilMaxNum!) || toilMaxNum! < 0)) {
            toast.error("Maks TOIL-timer må være et positivt tall");
            return;
          }

          const p1Result = await upsertPayrollPhase1Fields({
            profile_id: profileId,
            overtime_mode: editOvertimeMode,
            holiday_allowance_pct: holidayPctNum,
            toil_max_banked_hours: toilMaxNum,
          });

          if (!p1Result.ok) {
            toast.error(p1Result.error ?? "Kunne ikke lagre overtidsmodus");
            return;
          }

          setData((prev) =>
            prev
              ? {
                  ...prev,
                  overtime_mode: editOvertimeMode,
                  holiday_allowance_pct: holidayPctNum,
                  toil_max_banked_hours: toilMaxNum,
                }
              : prev,
          );
        }

        originalEditRef.current = {
          tripletexId: editTripletexId,
          pensionId: editPensionId,
          overtimeMode: editOvertimeMode,
          holidayPct: editHolidayPct,
          toilMax: editToilMax,
          taxCardType: editTaxCardType,
          taxTableNumber: editTaxTableNumber,
          taxPercentage: editTaxPercentage,
          taxCardYear: editTaxCardYear,
        };
        toast.success("Lønnsprofil oppdatert");
        setEditing(false);
      } else {
        toast.error(result.error);
      }
    });
  };

  if (loading) {
    return (
      <div className="border-border flex items-center gap-2 rounded-xl border p-5">
        <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
        <span className="text-muted-foreground text-sm">Henter lønnsprofil…</span>
      </div>
    );
  }

  return (
    <div className="border-border rounded-xl border p-5" data-testid="lonnsprofil-form">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-foreground text-sm font-semibold">Lønnsprofil</h3>
            <p className="text-muted-foreground text-xs">Tripletex-tilpasset lønnsdata</p>
          </div>
        </div>

        {!editing ? (
          <button
            type="button"
            onClick={handleEdit}
            className="border-border text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
          >
            <Edit2 className="h-3 w-3" />
            Rediger
          </button>
        ) : (
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={handleDiscard}
              disabled={saving}
              className="border-border text-muted-foreground hover:bg-accent flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
            >
              <X className="h-3 w-3" />
              Forkast
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-orange-600 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Lagre
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* ── Tripletex ansatt-ID (mid-PII — editable) ── */}
        <div>
          <label className={labelCls}>Tripletex ansatt-ID</label>
          {editing ? (
            <input
              type="text"
              value={editTripletexId}
              onChange={(e) => setEditTripletexId(e.target.value)}
              placeholder="Fyll inn Tripletex-ID"
              className={inputCls}
              aria-label="Tripletex ansatt-ID"
            />
          ) : (
            <p className="text-foreground text-sm">
              {data?.payroll_tripletex_employee_id ?? (
                <span className="text-muted-foreground">Ikke satt</span>
              )}
            </p>
          )}
        </div>

        {/* ── Sync-status (badge — read-only always) ── */}
        <div>
          <label className={labelCls}>Sync-status</label>
          <div className="flex items-center gap-2">
            <SyncStatusBadge status={data?.payroll_sync_status ?? "not_synced"} />
          </div>
        </div>

        {/* ── Sist synkronisert (timestamp — read-only) ── */}
        <div>
          <label className={labelCls}>Sist synkronisert</label>
          <p className="text-foreground text-sm">
            {data?.payroll_last_synced_at ? (
              formatSyncTimestamp(data.payroll_last_synced_at)
            ) : (
              <span className="text-muted-foreground">Aldri synkronisert</span>
            )}
          </p>
        </div>

        {/* ── Pensjonsordning (FK — editable mid-PII) ── */}
        <div>
          <label className={labelCls}>Pensjonsordning</label>
          {editing ? (
            <select
              value={editPensionId}
              onChange={(e) => setEditPensionId(e.target.value)}
              className={selectCls}
              aria-label="Pensjonsordning"
            >
              <option value="">Ingen pensjonsordning</option>
              {pensionSchemes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.provider ? ` (${s.provider})` : ""}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-foreground text-sm">
              {pensionSchemes.find((s) => s.id === data?.pension_scheme_id)?.name ?? (
                <span className="text-muted-foreground">Ikke satt</span>
              )}
            </p>
          )}
        </div>

        {/* ── Phase 1 Payroll fields (ADR-0254) ── */}

        {/* Overtidsmodus */}
        <div>
          <label className={labelCls}>Overtidsmodus</label>
          {editing ? (
            <select
              value={editOvertimeMode}
              onChange={(e) => setEditOvertimeMode(e.target.value as "paid_out" | "banked")}
              className={selectCls}
              aria-label="Overtidsmodus"
            >
              <option value="paid_out">Utbetalt</option>
              <option value="banked" disabled={!data?.toil_agreement_signed_at}>
                Avspasering (TOIL){!data?.toil_agreement_signed_at ? " — krever TOIL-avtale" : ""}
              </option>
            </select>
          ) : (
            <p className="text-foreground text-sm">
              {data?.overtime_mode === "banked" ? "Avspasering (TOIL)" : "Utbetalt"}
            </p>
          )}
        </div>

        {/* TOIL-avtale signert (read-only badge) */}
        <div>
          <label className={labelCls}>TOIL-avtale signert</label>
          <div className="flex items-center gap-2">
            {data?.toil_agreement_signed_at ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                {formatSyncTimestamp(data.toil_agreement_signed_at)}
              </span>
            ) : (
              <span className="text-muted-foreground text-sm">Ikke signert</span>
            )}
          </div>
          <p className="text-muted-foreground mt-0.5 text-[10px]">
            Kreves for å aktivere avspasering (TOIL)
          </p>
        </div>

        {/* Feriepengeprosent */}
        <div>
          <label className={labelCls}>Feriepengeprosent</label>
          {editing ? (
            <input
              type="number"
              value={editHolidayPct}
              onChange={(e) => setEditHolidayPct(e.target.value)}
              min={10.2}
              max={20}
              step={0.1}
              className={inputCls}
              aria-label="Feriepengeprosent"
            />
          ) : (
            <p className="text-foreground text-sm">
              {data?.holiday_allowance_pct != null ? (
                `${data.holiday_allowance_pct} %`
              ) : (
                <span className="text-muted-foreground">Ikke satt</span>
              )}
            </p>
          )}
          <p className="text-muted-foreground mt-0.5 text-[10px]">Lovlig intervall: 10,2–20 %</p>
        </div>

        {/* Maks TOIL-timer */}
        <div>
          <label className={labelCls}>Maks TOIL-timer</label>
          {editing ? (
            <input
              type="number"
              value={editToilMax}
              onChange={(e) => setEditToilMax(e.target.value)}
              min={0}
              step={0.5}
              placeholder="Ingen grense"
              className={inputCls}
              aria-label="Maks TOIL-timer"
              disabled={editOvertimeMode !== "banked"}
            />
          ) : (
            <p className="text-foreground text-sm">
              {data?.toil_max_banked_hours != null ? (
                `${data.toil_max_banked_hours} t`
              ) : (
                <span className="text-muted-foreground">Ingen grense</span>
              )}
            </p>
          )}
          <p className="text-muted-foreground mt-0.5 text-[10px]">
            Kun relevant ved avspasering-modus
          </p>
        </div>

        {/* ── Skattekort — tax-card section ── */}

        {/*
         * Phase 5 TD: admin can edit tax fields manually.
         * Non-admin sees read-only display.
         * "Hentes fra Skatteetaten" copy removed — manual entry is now supported.
         * Phase 7 will add Tripletex automatic sync; until then this is the entry point.
         */}
        <div className="sm:col-span-2">
          <div className="border-border bg-muted/20 rounded-xl border p-4">
            {/* Tax section header */}
            <div className="mb-3 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-500" />
              <span className="text-foreground text-xs font-semibold">Skattekort</span>
              {isAdmin && (
                <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
                  Manuell inntasting
                </span>
              )}
            </div>
            <p className="text-muted-foreground mb-3 text-[10px]">
              Skattekort — fylles inn manuelt eller synkes fra regnskapssystem
            </p>

            {/* Tax field validation errors */}
            {taxErrors.length > 0 && (
              <div className="bg-destructive/10 border-destructive/30 mb-3 rounded-lg border p-2">
                {taxErrors.map((e, i) => (
                  <p key={i} className="text-destructive text-xs">
                    {e}
                  </p>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* Skattekorttype */}
              <div>
                <label className={labelCls}>Skattekorttype</label>
                {editing && isAdmin ? (
                  <select
                    value={editTaxCardType}
                    onChange={(e) => {
                      setEditTaxCardType(e.target.value as TaxCardTypeEnum | "");
                      setTaxErrors([]);
                    }}
                    className={selectCls}
                    aria-label="Skattekorttype"
                    data-testid="edit-tax_card_type"
                  >
                    <option value="">Ikke valgt</option>
                    <option value="percentage">Trekkprosent</option>
                    <option value="table">Trekktabell</option>
                    <option value="freecard">Frikort</option>
                  </select>
                ) : (
                  <p
                    className="text-foreground text-sm"
                    data-testid="tax_card_type"
                    aria-readonly="true"
                  >
                    {data?.tax_card_type ? (
                      TAX_CARD_TYPE_LABELS[data.tax_card_type]
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </p>
                )}
              </div>

              {/* Kortår */}
              <div>
                <label className={labelCls}>Kortår</label>
                {editing && isAdmin ? (
                  <input
                    type="number"
                    value={editTaxCardYear}
                    onChange={(e) => {
                      setEditTaxCardYear(e.target.value);
                      setTaxErrors([]);
                    }}
                    min={2024}
                    max={2035}
                    step={1}
                    className={inputCls}
                    aria-label="Kortår"
                    data-testid="edit-tax_card_year"
                  />
                ) : (
                  <p className="text-foreground text-sm" data-testid="tax_card_year">
                    {data?.tax_card_year ?? <span className="text-muted-foreground">—</span>}
                  </p>
                )}
              </div>

              {/* Skattetabellnummer — only when type = table */}
              {((!editing && data?.tax_card_type === "table") ||
                (editing && isAdmin && editTaxCardType === "table")) && (
                <div>
                  <label className={labelCls}>Skattetabellnummer</label>
                  {editing && isAdmin ? (
                    <input
                      type="text"
                      value={editTaxTableNumber}
                      onChange={(e) => {
                        setEditTaxTableNumber(e.target.value);
                        setTaxErrors([]);
                      }}
                      placeholder="7100"
                      maxLength={4}
                      className={inputCls}
                      aria-label="Skattetabellnummer"
                      data-testid="edit-tax_table_number"
                    />
                  ) : (
                    <p className="text-foreground font-mono text-sm" data-testid="tax_table_number">
                      {data?.tax_table_number ?? <span className="text-muted-foreground">—</span>}
                    </p>
                  )}
                </div>
              )}

              {/* Trekkprosent — only when type = percentage */}
              {((!editing && data?.tax_card_type === "percentage") ||
                (editing && isAdmin && editTaxCardType === "percentage")) && (
                <div>
                  <label className={labelCls}>Trekkprosent (%)</label>
                  {editing && isAdmin ? (
                    <input
                      type="number"
                      value={editTaxPercentage}
                      onChange={(e) => {
                        setEditTaxPercentage(e.target.value);
                        setTaxErrors([]);
                      }}
                      min={0}
                      max={100}
                      step={0.1}
                      placeholder="22"
                      className={inputCls}
                      aria-label="Trekkprosent"
                      data-testid="edit-tax_percentage"
                    />
                  ) : (
                    <p
                      className="text-foreground text-sm"
                      data-testid="tax_percentage"
                      aria-readonly="true"
                    >
                      {data?.tax_percentage != null ? (
                        `${data.tax_percentage} %`
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </p>
                  )}
                </div>
              )}

              {/* Sist oppdatert — read-only timestamp */}
              <div className="sm:col-span-2">
                <label className={labelCls}>Sist oppdatert</label>
                <p className="text-muted-foreground text-xs">
                  {data?.tax_card_fetched_at
                    ? formatSyncTimestamp(data.tax_card_fetched_at)
                    : "Ingen registrert dato"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── HIGH-PII fields — BFF reveal only (ADR-0077 + ADR-0078 + ADR-0242) ── */}

        <div className="sm:col-span-2">
          <div className="border-border bg-muted/30 rounded-xl border p-4">
            <div className="mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4 text-amber-500" />
              <span className="text-foreground text-xs font-semibold">Høy-PII felt</span>
              <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                ADR-0077
              </span>
            </div>

            <div className="space-y-4">
              {/*
               * Bankkonto — BFF-fetch reveal (ADR-0242 + ADR-0151).
               * PII is never loaded by the client directly; RevealableField POSTs to BFF on click.
               * ADR-0078 Layer-3: voice readback of bank_account is FORBIDDEN.
               */}
              <div>
                <label className={labelCls}>Bankkonto</label>
                <div data-testid="reveal-bank_account">
                  <RevealableField
                    label="Bankkonto"
                    fieldName="bank_account"
                    profileId={profileId}
                    workspaceId={workspaceId}
                    fetchEndpoint="/api/payroll/reveal-bank-account"
                  />
                </div>
                <div className="mt-2">
                  <button
                    type="button"
                    disabled
                    className="text-muted-foreground border-border flex cursor-not-allowed items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium opacity-60"
                    title="PII-inntak-flyt ikke tilgjengelig ennå — TODO"
                  >
                    <Info className="h-3 w-3" />
                    Endre bankkonto
                  </button>
                  <p className="text-muted-foreground mt-0.5 text-[10px]">
                    Endringer krever separat PII-inntak-flyt (ADR-0077)
                  </p>
                </div>
              </div>

              {/*
               * Personnummer — BFF-fetch reveal (ADR-0242 + ADR-0151).
               * ADR-0077: personal_number is always write-protected from this surface.
               * ADR-0078 Layer-3: voice readback FORBIDDEN.
               */}
              <div>
                <label className={labelCls}>Personnummer</label>
                <div data-testid="reveal-personal_number">
                  <RevealableField
                    label="Personnummer"
                    fieldName="personal_number"
                    profileId={profileId}
                    workspaceId={workspaceId}
                    fetchEndpoint="/api/payroll/reveal-personal-number"
                  />
                </div>
                <p className="text-muted-foreground mt-0.5 text-[10px]">
                  Personnummer er alltid skrivebeskyttet (ADR-0077)
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Tidskonto-saldo (TimebankPanel) ── */}
        <div className="sm:col-span-2">
          <div className="mb-1">
            <p className={labelCls}>Tidskontoer</p>
          </div>
          <TimebankPanel profileId={profileId} workspaceId={workspaceId} />
        </div>

        {/* Info notice */}
        <div className="sm:col-span-2">
          <div className="border-border bg-muted/20 flex items-start gap-2 rounded-lg border p-3">
            <Info className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p className="text-muted-foreground text-xs">
              Tripletex-synkronisering skjer automatisk ved lønnskjøring. Skattekortdata kan legges
              inn manuelt av administrator, eller synkes automatisk fra regnskapssystem (Phase 7).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
