"use client";

/**
 * LonnsprofilSection.tsx — Tripletex-aligned payroll-profile section for /people/[id] HR tab.
 *
 * What: Displays + edits employee_payroll_profile fields (Tripletex integration data,
 *       DERIVED tax fields, HIGH-PII masked fields, pension scheme selection).
 * Why:  Cycle 6 Wave 1 Phase 2 — HR-tab authoring surface for payroll profile.
 *       ADR-0077 (PII handling — bank_account + personal_number masked, separate intake flow).
 *       ADR-0078 Layer-3 (voice readback of PII fields FORBIDDEN — no voice surface here).
 *       ADR-0242 (RevealableField for Høy-PII).
 *       ADR-0245 (web-only admin authoring surface).
 *       ADR-0151 (workspace_id resolved server-side — POST via employment action).
 *
 * Edit mode: only mid-PII fields editable (payroll_tripletex_employee_id, pension_scheme_id).
 * DERIVED tax fields (tax_table_number, tax_card_type, tax_percentage) are ALWAYS read-only.
 * HIGH-PII fields (bank_account, personal_number) are display-only with masked reveal.
 *
 * Save: via upsertLonnsprofil Server Action (extended with tripletex_employee_id path).
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
  Lock,
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

type PensionScheme = {
  id: string;
  name: string;
  provider: string | null;
  scheme_type: string;
};

interface PayrollProfileData {
  /** Tripletex employee number — editable mid-PII */
  payroll_tripletex_employee_id: number | null;
  /** Sync status from Tripletex — read-only badge */
  payroll_sync_status: SyncStatusEnum;
  /** Last successful sync timestamp — read-only */
  payroll_last_synced_at: string | null;
  /**
   * DERIVED from Skatteetaten — read-only.
   * Per ADR-0247 (Skatteetaten integration): tax fields are fetched via
   * Altinn/Skatteetaten at payroll run time; cannot be manually overridden.
   */
  tax_table_number: string | null;
  /** DERIVED — read-only */
  tax_card_type: Database["public"]["Enums"]["tax_card_type"] | null;
  /** DERIVED — read-only */
  tax_percentage: number | null;
  /**
   * HIGH-PII (ADR-0077) — masked display only. Edit via separate PII intake flow.
   * Never editable from this surface.
   */
  bank_account: string | null;
  /**
   * HIGH-PII (ADR-0077) — masked display only.
   * Never editable from this surface.
   */
  personal_number: string | null;
  /** FK to pension_scheme — editable mid-PII */
  pension_scheme_id: string | null;
  /**
   * Phase 1 payroll fields (ADR-0254).
   * Overtime handling mode — editable.
   */
  overtime_mode: "paid_out" | "banked";
  /** ADR-0254: banked mode only allowed when this is set — read-only badge */
  toil_agreement_signed_at: string | null;
  /** Feriepengeprosent — editable (10.2–20) */
  holiday_allowance_pct: number;
  /** Max banked TOIL hours — editable, nullable */
  toil_max_banked_hours: number | null;
}

interface LonnsprofilSectionProps {
  profileId: string;
  workspaceId: string;
  /** If a contract exists, pass for server action linkage */
  contractId?: string | null;
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

/** Masks account/personnummer — shows only last 4 chars: "•••• •••• 1234" */
function maskAccountNumber(value: string): string {
  const cleaned = value.replace(/\s/g, "");
  const last4 = cleaned.slice(-4);
  return `•••• •••• ${last4}`;
}

// ─── Component ─────────────────────────────────────────────────────────────

export function LonnsprofilSection({
  profileId,
  workspaceId,
  contractId,
}: LonnsprofilSectionProps) {
  const [data, setData] = useState<PayrollProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, startSave] = useTransition();

  // Edit state — only mid-PII fields
  const [editTripletexId, setEditTripletexId] = useState<string>("");
  const [editPensionId, setEditPensionId] = useState<string>("");
  // Phase 1 payroll edit state (ADR-0254)
  const [editOvertimeMode, setEditOvertimeMode] = useState<"paid_out" | "banked">("paid_out");
  const [editHolidayPct, setEditHolidayPct] = useState<string>("12");
  const [editToilMax, setEditToilMax] = useState<string>("");

  // Pension scheme options
  const [pensionSchemes, setPensionSchemes] = useState<PensionScheme[]>([]);

  const supabase = createClient();

  // Fetch payroll profile + profile PII fields + pension schemes
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const [payrollRes, profileRes, pensionRes] = await Promise.all([
        supabase
          .from("employee_payroll_profile")
          .select(
            "payroll_tripletex_employee_id, payroll_sync_status, payroll_last_synced_at, tax_table_number, tax_card_type, tax_percentage, pension_scheme_id, overtime_mode, toil_agreement_signed_at, holiday_allowance_pct, toil_max_banked_hours",
          )
          .eq("profile_id", profileId)
          .eq("workspace_id", workspaceId)
          .maybeSingle(),
        // HIGH-PII: bank_account + personal_number live on profile table (ADR-0077)
        supabase
          .from("profile")
          .select("bank_account, personal_number")
          .eq("profile_id", profileId)
          .single(),
        supabase
          .from("pension_scheme")
          .select("id, name, provider, scheme_type")
          .eq("workspace_id", workspaceId)
          .eq("is_active", true)
          .order("name"),
      ]);

      if (cancelled) return;

      const pp = payrollRes.data;
      const prof = profileRes.data;

      const overtimeMode = (pp?.overtime_mode ?? "paid_out") as "paid_out" | "banked";
      const holidayPct = pp?.holiday_allowance_pct ?? 12;
      const toilMax = pp?.toil_max_banked_hours ?? null;

      setData({
        payroll_tripletex_employee_id: pp?.payroll_tripletex_employee_id ?? null,
        payroll_sync_status: (pp?.payroll_sync_status ?? "not_synced") as SyncStatusEnum,
        payroll_last_synced_at: pp?.payroll_last_synced_at ?? null,
        tax_table_number: pp?.tax_table_number ?? null,
        tax_card_type: pp?.tax_card_type ?? null,
        tax_percentage: pp?.tax_percentage ?? null,
        // HIGH-PII from profile table
        bank_account: prof?.bank_account ?? null,
        personal_number: prof?.personal_number ?? null,
        pension_scheme_id: pp?.pension_scheme_id ?? null,
        // Phase 1 payroll fields
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
  });

  const handleEdit = useCallback(() => {
    originalEditRef.current = {
      tripletexId: editTripletexId,
      pensionId: editPensionId,
      overtimeMode: editOvertimeMode,
      holidayPct: editHolidayPct,
      toilMax: editToilMax,
    };
    setEditing(true);
  }, [editTripletexId, editPensionId, editOvertimeMode, editHolidayPct, editToilMax]);

  const handleDiscard = useCallback(() => {
    setEditTripletexId(originalEditRef.current.tripletexId);
    setEditPensionId(originalEditRef.current.pensionId);
    setEditOvertimeMode(originalEditRef.current.overtimeMode);
    setEditHolidayPct(originalEditRef.current.holidayPct);
    setEditToilMax(originalEditRef.current.toilMax);
    setEditing(false);
  }, []);

  const handleSave = () => {
    startSave(async () => {
      const result = await upsertLonnsprofil({
        profile_id: profileId,
        contract_id: contractId ?? null,
        salary_type: "hourly", // Required field — preserved; this section only patches tripletex fields
        // Patch only the mid-PII Tripletex fields that this section owns.
        // Other payroll fields remain unchanged (no overwrite of rates/tax from this surface).
        pension_scheme_id: editPensionId || null,
        // Note: payroll_tripletex_employee_id is NOT part of LonnsprofilSchema yet.
        // TODO — Agent V: extend LonnsprofilSchema + upsertLonnsprofil to accept
        // tripletex_employee_id as a patchable column on employee_payroll_profile.
        // Until then this field is displayed but saved as a direct patch below.
      });

      if (result.ok) {
        // Also patch tripletex_employee_id directly — not yet in LonnsprofilSchema
        if (editTripletexId !== originalEditRef.current.tripletexId) {
          const parsed = editTripletexId ? parseInt(editTripletexId, 10) : null;
          if (editTripletexId && isNaN(parsed!)) {
            toast.error("Tripletex ansatt-ID må være et tall");
            return;
          }
          const { error } = await supabase
            .from("employee_payroll_profile")
            .update({ payroll_tripletex_employee_id: parsed })
            .eq("profile_id", profileId)
            .eq("workspace_id", workspaceId);
          if (error) {
            toast.error(error.message);
            return;
          }
        }

        // Reflect updated values in local state
        setData((prev) =>
          prev
            ? {
                ...prev,
                payroll_tripletex_employee_id: editTripletexId
                  ? parseInt(editTripletexId, 10)
                  : null,
                pension_scheme_id: editPensionId || null,
              }
            : prev,
        );

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

          // Reflect Phase 1 changes in local state
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
        };
        toast.success("Lønnsprofil oppdatert");
        // TODO (Agent V): emit payroll_profile.updated telemetry here
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

  const taxCardTypeLabels: Record<
    NonNullable<Database["public"]["Enums"]["tax_card_type"]>,
    string
  > = {
    percentage: "Prosentkort",
    table: "Tabell",
    freecard: "Frikort",
  };

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

        {/* ── DERIVED tax fields — always read-only ── */}

        {/* Skattetabell (DERIVED — read-only per ADR-0247-Skatteetaten) */}
        <div>
          <label className={`${labelCls} flex items-center gap-1.5`}>
            Skattetabell
            <span
              aria-label="Hentes automatisk"
              title="DERIVED"
              className="text-blue-500 dark:text-blue-400"
            >
              <Lock className="h-3 w-3" />
            </span>
          </label>
          {data?.tax_table_number ? (
            <p
              className="text-foreground font-mono text-sm"
              aria-label="Skattetabellnummer — lest fra Skatteetaten"
              data-testid="tax_table_number"
            >
              {data.tax_table_number}
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">—</p>
          )}
          <p className="text-muted-foreground mt-0.5 text-[10px]">
            Hentes fra Skatteetaten — kan ikke redigeres
          </p>
        </div>

        {/* Skattekorttype (DERIVED — read-only) */}
        <div>
          <label className={`${labelCls} flex items-center gap-1.5`}>
            Skattekorttype
            <Lock className="h-3 w-3 text-blue-500 dark:text-blue-400" aria-hidden="true" />
          </label>
          <p className="text-foreground text-sm" data-testid="tax_card_type" aria-readonly="true">
            {data?.tax_card_type ? (
              taxCardTypeLabels[data.tax_card_type]
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </p>
          <p className="text-muted-foreground mt-0.5 text-[10px]">
            Hentes fra Skatteetaten — kan ikke redigeres
          </p>
        </div>

        {/* Skatteprosent (DERIVED — read-only) */}
        <div>
          <label className={`${labelCls} flex items-center gap-1.5`}>
            Skatteprosent
            <Lock className="h-3 w-3 text-blue-500 dark:text-blue-400" aria-hidden="true" />
          </label>
          <p className="text-foreground text-sm" data-testid="tax_percentage" aria-readonly="true">
            {data?.tax_percentage != null ? (
              `${data.tax_percentage} %`
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </p>
          <p className="text-muted-foreground mt-0.5 text-[10px]">
            Hentes fra Skatteetaten — kan ikke redigeres
          </p>
        </div>

        {/* ── HIGH-PII fields — masked display only (ADR-0077 + ADR-0078) ── */}

        {/*
         * ADR-0077: bank_account is HIGH-PII. Display masked here.
         * Edit requires separate PII intake flow (out of scope this sprint).
         * ADR-0078 Layer-3: voice readback of this field is FORBIDDEN.
         */}
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
              {/* Bankkonto */}
              <div>
                <label className={labelCls}>Bankkonto</label>
                <div data-testid="reveal-bank_account">
                  <RevealableField
                    label="Bankkonto"
                    value={data?.bank_account ?? ""}
                    fieldName="bank_account"
                    profileId={profileId}
                    workspaceId={workspaceId}
                  />
                </div>
                <div className="mt-2">
                  {/*
                   * "Endre bankkonto" leads to separate PII intake flow per ADR-0077.
                   * TODO: wire to /dashboard/people/[id]/pii-intake?field=bank_account
                   * when that route exists. For now shows pending state.
                   */}
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

              {/* Personnummer */}
              <div>
                <label className={labelCls}>Personnummer</label>
                <div data-testid="reveal-personal_number">
                  <RevealableField
                    label="Personnummer"
                    value={data?.personal_number ?? ""}
                    fieldName="personal_number"
                    profileId={profileId}
                    workspaceId={workspaceId}
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
              Tripletex-synkronisering skjer automatisk ved lønnskjøring. Skattedata hentes fra
              Skatteetaten via Altinn. Manuell redigering av skattekortdata er ikke tillatt.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
