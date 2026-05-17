"use client";

/**
 * TariffSection — onboarding wizard step for tariff binding.
 *
 * Asks whether the workspace is covered by NHO Reiseliv tariff (Riksavtalen).
 *
 * Ja-path: user selects union + law_version → POST /api/payroll/tariff/setup.
 *   On success: shows confirmation card with binding details.
 *   On error: renders Norwegian message per ADR-0152 error codes.
 *
 * Nei-path: no BFF call. Copy: bransjenorm brukes som default, supplement-regler kan
 *   justeres manuelt. State marks is_tariff_bound: false via tariff.isMember=false.
 *
 * Design rules (Nordic Split):
 *   - bg-background / text-foreground / border-border CSS variables only.
 *   - brand-orange accent via CSS var (--brand-orange).
 *   - Lucide icons only. No emojis.
 *   - Instrument Serif headings via font-heading class.
 *   - transition-colors not transition-all.
 *   - focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/40 focus-visible:outline-none.
 *   - Framer Motion spring {stiffness:35, damping:22, mass:2.2} with useReducedMotion gate.
 *
 * Contract: imports SetupTariffRequest / SetupTariffResponse / PAYROLL_TARIFF_BFF_ROUTES
 *   from @smartout/types. No local Zod schemas defined here.
 */

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { FileText, CheckCircle, ChevronDown, Loader2, AlertCircle, Building2 } from "lucide-react";
import type { WizardStepProps } from "@smartout/ui";
import type { SetupTariffRequest, SetupTariffResponse } from "@smartout/types";
import { setupTariffResponseSchema, PAYROLL_TARIFF_BFF_ROUTES } from "@smartout/types";
import type { OnboardingConfirmState } from "../types-v2";

// OnboardingConfirmState imported for WizardStepProps generic — tariff field is TariffSectionState.
import {
  TARIFF_UNION_OPTIONS,
  tariffErrorToNorwegian,
  defaultTariffSectionState,
  type TariffSectionState,
  type TariffUnionOption,
} from "@/lib/onboarding/tariff-state";

// ─── Motion spring preset (Nordic Split) ─────────────────────────────────────

const SPRING = { stiffness: 35, damping: 22, mass: 2.2 };

// ─── Sub-components ──────────────────────────────────────────────────────────

/**
 * MembershipToggle — Ja/Nei radio cards for NHO Reiseliv membership.
 * Mirrors the department toggle pattern from ConfirmDepartments.
 */
function MembershipToggle({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  const options = [
    { label: "Ja, vi er medlemmer", val: true },
    { label: "Nei, ikke relevant for oss", val: false },
  ];

  return (
    <div className="flex flex-col gap-2">
      {options.map((opt) => {
        const selected = value === opt.val;
        return (
          <button
            key={String(opt.val)}
            type="button"
            onClick={() => onChange(opt.val)}
            className={[
              "flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors",
              selected
                ? "text-foreground border-[var(--brand-orange)]/30 bg-[var(--brand-orange)]/5"
                : "border-border text-muted-foreground hover:text-foreground border-dashed bg-transparent hover:border-[var(--brand-orange)]/30 hover:bg-[var(--brand-orange)]/5",
            ].join(" ")}
          >
            <span className="flex items-center gap-3">
              <span
                className={[
                  "flex size-5 shrink-0 items-center justify-center rounded border text-xs transition-colors",
                  selected
                    ? "border-[var(--brand-orange)]/40 bg-[var(--brand-orange)]/20 text-[var(--brand-orange)]"
                    : "border-border bg-card text-transparent",
                ].join(" ")}
              >
                &#10003;
              </span>
              <span className="text-sm font-medium">{opt.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * UnionPicker — select which union agreement applies.
 * Shows label + description per TARIFF_UNION_OPTIONS.
 */
function UnionPicker({
  selected,
  onChange,
}: {
  selected: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {TARIFF_UNION_OPTIONS.map((union: TariffUnionOption) => {
        const isSelected = selected === union.id;
        return (
          <button
            key={union.id}
            type="button"
            onClick={() => onChange(union.id)}
            className={[
              "flex w-full flex-col rounded-lg border px-4 py-3 text-left transition-colors",
              isSelected
                ? "border-[var(--brand-orange)]/30 bg-[var(--brand-orange)]/5"
                : "border-border border-dashed bg-transparent hover:border-[var(--brand-orange)]/30 hover:bg-[var(--brand-orange)]/5",
            ].join(" ")}
          >
            <span className="flex items-center gap-3">
              <span
                className={[
                  "flex size-5 shrink-0 items-center justify-center rounded border text-xs transition-colors",
                  isSelected
                    ? "border-[var(--brand-orange)]/40 bg-[var(--brand-orange)]/20 text-[var(--brand-orange)]"
                    : "border-border bg-card text-transparent",
                ].join(" ")}
              >
                &#10003;
              </span>
              <span className="text-foreground text-sm font-medium">{union.label}</span>
            </span>
            <span className="text-muted-foreground mt-1 pl-8 text-xs">{union.description}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * LawVersionSelect — dropdown for picking the tariff year/version.
 * Only shown when a union is selected.
 */
function LawVersionSelect({
  union,
  selected,
  onChange,
}: {
  union: TariffUnionOption;
  selected: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <label className="text-muted-foreground mb-1 block text-xs font-medium">Tariffversjon</label>
      <div className="relative">
        <select
          value={selected ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="border-border bg-background text-foreground w-full appearance-none rounded-lg border px-3 py-2.5 pr-9 text-sm focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/40 focus-visible:outline-none"
        >
          <option value="" disabled>
            Velg tariffversjon...
          </option>
          {union.lawVersions.map((lv) => (
            <option key={lv.value} value={lv.value}>
              {lv.label}
            </option>
          ))}
        </select>
        <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2" />
      </div>
    </div>
  );
}

/**
 * SuccessCard — shown after a successful BFF call.
 * Mirrors the ConfirmSummary summary card pattern.
 */
function SuccessCard({
  unionLabel,
  lawVersion,
  effectiveFrom,
  prefersReduced,
}: {
  unionLabel: string;
  lawVersion: string;
  effectiveFrom: string;
  prefersReduced: boolean;
}) {
  return (
    <motion.div
      initial={prefersReduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING}
      className="flex items-start gap-3 rounded-lg border border-[var(--success)]/20 bg-[var(--success)]/5 p-4"
    >
      <CheckCircle className="mt-0.5 size-4 shrink-0 text-[var(--success)]" />
      <div className="flex flex-col gap-0.5">
        <p className="text-foreground text-sm font-medium">Tariff koblet til</p>
        <p className="text-muted-foreground text-xs">
          {unionLabel} · {lawVersion}-satser · gjelder fra {effectiveFrom}
        </p>
      </div>
    </motion.div>
  );
}

/**
 * SoftGuideCard — shown when user picks Nei (not tariff bound).
 * Per scope doc: bransjenorm som default, manuell justering tilgjengelig.
 */
function SoftGuideCard({ prefersReduced }: { prefersReduced: boolean }) {
  return (
    <motion.div
      initial={prefersReduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING}
      className="flex items-start gap-3 rounded-lg border border-[var(--brand-orange)]/15 bg-[var(--brand-orange)]/5 p-4"
    >
      <Building2 className="mt-0.5 size-4 shrink-0 text-[var(--brand-orange)]" />
      <p className="text-muted-foreground text-xs leading-relaxed">
        Bransjenorm brukes som default — du kan justere supplement-regler manuelt under
        Innstillinger → Lønn etter at oppsettet er fullført.
      </p>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TariffSection({
  // state not needed — TariffSection manages its own local state and writes back via updateState
  updateState,
  next,
}: WizardStepProps<OnboardingConfirmState>) {
  const prefersReduced = useReducedMotion() ?? false;

  // Local tariff section state — not persisted into wizard state until submit
  const [tariff, setTariff] = useState<TariffSectionState>(defaultTariffSectionState);

  function patchTariff(patch: Partial<TariffSectionState>) {
    setTariff((prev) => ({ ...prev, ...patch }));
  }

  // Derived
  const selectedUnion = TARIFF_UNION_OPTIONS.find((u) => u.id === tariff.selectedUnionId) ?? null;
  const canSubmitMember =
    tariff.isMember === true &&
    tariff.selectedUnionId !== null &&
    tariff.selectedLawVersion !== null;
  const canProceedNonMember = tariff.isMember === false;
  const canProceed = canSubmitMember || canProceedNonMember;

  // ─── Handlers ──────────────────────────────────────────────────────────────

  function handleMemberChange(val: boolean) {
    patchTariff({
      isMember: val,
      // Reset selections when toggling membership
      selectedUnionId: null,
      selectedLawVersion: null,
      status: "idle",
      errorMessage: null,
      result: null,
    });
  }

  function handleUnionChange(id: string) {
    patchTariff({
      selectedUnionId: id,
      selectedLawVersion: null, // Reset version when union changes
      status: "idle",
      errorMessage: null,
    });
  }

  function handleLawVersionChange(v: string) {
    patchTariff({ selectedLawVersion: v, status: "idle", errorMessage: null });
  }

  async function handleSubmitTariff() {
    if (!canSubmitMember || !selectedUnion || !tariff.selectedLawVersion) return;

    const lawVersionOption = selectedUnion.lawVersions.find(
      (lv) => lv.value === tariff.selectedLawVersion,
    );
    if (!lawVersionOption) return;

    patchTariff({ status: "submitting", errorMessage: null });

    const body: SetupTariffRequest = {
      union_id: tariff.selectedUnionId!,
      law_version: tariff.selectedLawVersion,
      official_effective_date: lawVersionOption.officialEffectiveDate,
    };

    try {
      const res = await fetch(PAYROLL_TARIFF_BFF_ROUTES.setup, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      // Parse and validate response against BFF contract schema
      const raw: unknown = await res.json();
      const parsed = setupTariffResponseSchema.safeParse(raw);

      if (!parsed.success) {
        patchTariff({
          status: "error",
          errorMessage: "Uventet svar fra serveren. Prøv igjen.",
        });
        return;
      }

      const data = parsed.data satisfies SetupTariffResponse;

      if (!data.ok) {
        // Narrowed to error branch by discriminated union on `ok`
        const errCode = data.error.code;
        patchTariff({
          status: "error",
          errorMessage: tariffErrorToNorwegian(errCode),
        });
        return;
      }

      patchTariff({
        status: "success",
        result: {
          workspace_union_binding_id: data.data.workspace_union_binding_id,
          effective_from: data.data.effective_from,
          union_id: data.data.union_id,
          law_version: data.data.law_version,
        },
      });

      // Persist tariff result into wizard state for downstream steps
      updateState({ tariff });
    } catch {
      patchTariff({
        status: "error",
        errorMessage: "Nettverksfeil. Sjekk tilkoblingen og prøv igjen.",
      });
    }
  }

  async function handleContinue() {
    if (tariff.isMember === true && tariff.status !== "success") {
      // Must complete the BFF call before proceeding
      await handleSubmitTariff();
      return;
    }

    // Persist final tariff state and advance
    updateState({ tariff });
    next();
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      {/* Header */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <FileText className="text-brand-orange size-5" />
          <h2 className="font-heading text-foreground text-2xl font-bold">Tariffavtale</h2>
        </div>
        <p className="text-muted-foreground text-sm">
          Er arbeidsplassen din dekket av NHO Reiseliv-tariff (Riksavtalen)?
        </p>
      </div>

      {/* Step 1: Ja / Nei */}
      <MembershipToggle value={tariff.isMember} onChange={handleMemberChange} />

      {/* Step 2: Union + Law version (only for Ja) */}
      <AnimatePresence>
        {tariff.isMember === true && (
          <motion.div
            key="member-form"
            initial={prefersReduced ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: prefersReduced ? "auto" : 0 }}
            transition={SPRING}
            className="overflow-hidden"
          >
            <div className="space-y-4">
              <div>
                <p className="text-muted-foreground mb-2 text-xs font-medium">
                  Hvilken overenskomst gjelder?
                </p>
                <UnionPicker selected={tariff.selectedUnionId} onChange={handleUnionChange} />
              </div>

              {/* Law version — only when union is selected */}
              <AnimatePresence>
                {selectedUnion && (
                  <motion.div
                    key={selectedUnion.id}
                    initial={prefersReduced ? false : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: prefersReduced ? 0 : 4 }}
                    transition={SPRING}
                  >
                    <LawVersionSelect
                      union={selectedUnion}
                      selected={tariff.selectedLawVersion}
                      onChange={handleLawVersionChange}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nei soft guide */}
      <AnimatePresence>
        {tariff.isMember === false && (
          <motion.div
            key="non-member-guide"
            initial={prefersReduced ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: prefersReduced ? "auto" : 0 }}
            transition={SPRING}
            className="overflow-hidden"
          >
            <SoftGuideCard prefersReduced={prefersReduced} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success state (replaces the form after successful BFF call) */}
      <AnimatePresence>
        {tariff.status === "success" && tariff.result && selectedUnion && (
          <motion.div
            key="success-card"
            initial={prefersReduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: prefersReduced ? 0 : 8 }}
            transition={SPRING}
          >
            <SuccessCard
              unionLabel={selectedUnion.label}
              lawVersion={tariff.result.law_version}
              effectiveFrom={tariff.result.effective_from}
              prefersReduced={prefersReduced}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error display */}
      <AnimatePresence>
        {tariff.status === "error" && tariff.errorMessage && (
          <motion.div
            key="error-banner"
            initial={prefersReduced ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: prefersReduced ? 0 : 4 }}
            transition={SPRING}
            className="flex items-start gap-2.5 rounded-lg border border-[var(--destructive)]/20 bg-[var(--destructive)]/5 px-4 py-3"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-[var(--destructive)]" />
            <p className="text-destructive text-xs">{tariff.errorMessage}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Continue button */}
      <button
        type="button"
        onClick={handleContinue}
        disabled={!canProceed || tariff.status === "submitting"}
        className={[
          "bg-brand-orange hover:bg-brand-orange/90 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-white transition-colors",
          "focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/40 focus-visible:outline-none",
          !canProceed || tariff.status === "submitting"
            ? "cursor-not-allowed opacity-50"
            : "cursor-pointer",
        ].join(" ")}
      >
        {tariff.status === "submitting" ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Kobler til tariff...
          </>
        ) : tariff.isMember === true && tariff.status !== "success" ? (
          "Koble til tariff og fortsett"
        ) : (
          "Fortsett"
        )}
      </button>
    </div>
  );
}
