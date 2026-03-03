"use client";

import { useState } from "react";
import { createClient } from "@smartout/supabase/client";
import {
  Building2,
  CheckCircle2,
  Loader2,
  ArrowRight,
  MapPin,
  User,
  Briefcase,
  Users,
  Sparkles,
} from "lucide-react";
import { useWizard } from "../WizardContext";

/** Format a 9-digit org number with spaces: "987654321" → "987 654 321" */
function formatOrgNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 9) return raw;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
}

export function OrgVerificationStep() {
  const wizard = useWizard();
  const supabase = createClient();
  const [isVerifyingOrg, setIsVerifyingOrg] = useState(false);
  const [orgError, setOrgError] = useState("");
  const [manualOverride, setManualOverride] = useState(false);

  const autoDetected = wizard.workspaceData.orgNumber && !manualOverride;

  const handleVerifyOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOrg = wizard.orgNumberInput.replace(/\D/g, "");
    if (cleanOrg.length !== 9) {
      setOrgError("Et gyldig norsk organisasjonsnummer har 9 siffer.");
      return;
    }

    setIsVerifyingOrg(true);
    setOrgError("");

    try {
      const res = await fetch(`https://data.brreg.no/enhetsregisteret/api/enheter/${cleanOrg}`);
      if (!res.ok) throw new Error("Fant ikke firma i Bronnoydsundregistrene.");

      const data = await res.json();

      let ceoName = "Ikke registrert / Styret";
      try {
        const rolesRes = await fetch(
          `https://data.brreg.no/enhetsregisteret/api/enheter/${cleanOrg}/roller`,
        );
        if (rolesRes.ok) {
          const rolesData = await rolesRes.json();
          const ceoRole = rolesData.rollegrupper?.find(
            (rg: { type: { kode: string } }) => rg.type.kode === "DAGL",
          );
          if (ceoRole && ceoRole.roller && ceoRole.roller.length > 0) {
            const person = ceoRole.roller[0].person;
            if (person) {
              ceoName = `${person.navn.fornavn} ${person.navn.mellomnavn ? person.navn.mellomnavn + " " : ""}${person.navn.etternavn}`;
            }
          }
        }
      } catch (e) {
        console.error("Kunne ikke hente roller:", e);
      }

      const addressLine = data.forretningsadresse
        ? `${data.forretningsadresse.adresse?.[0] || ""}, ${data.forretningsadresse.postnummer || ""} ${data.forretningsadresse.poststed || ""}`.trim()
        : "Ingen adresse registrert";

      const employeeCount = data.antallAnsatte ? data.antallAnsatte.toString() : "";
      const industry = data.naeringskode1 ? data.naeringskode1.beskrivelse : "";
      const description = data.vedtektsfestetFormaal
        ? data.vedtektsfestetFormaal.join("\n")
        : data.aktivitet
          ? data.aktivitet.join("\n")
          : "";

      wizard.setVerifiedOrgData({
        name: data.navn,
        address: addressLine,
        ceo: ceoName,
        employeeCount,
        industry,
        description,
      });

      wizard.updateData({
        name: data.navn,
        address: addressLine,
        ceo: ceoName,
        employeeCount,
        industry,
        concept: description,
      });
    } catch (error: unknown) {
      setOrgError(error instanceof Error ? error.message : "En feil oppstod ved sok.");
      wizard.setVerifiedOrgData(null);
    } finally {
      setIsVerifyingOrg(false);
    }
  };

  const handleConfirmOrg = async () => {
    // Determine which org number to persist — auto-detected or manually entered
    const orgToPersist = autoDetected
      ? wizard.workspaceData.orgNumber
      : wizard.orgNumberInput;

    if (wizard.sessionId && orgToPersist) {
      try {
        const { data: wsData } = await supabase
          .from("workspace")
          .select("company_id")
          .eq("workspace_id", wizard.sessionId)
          .single();

        if (wsData?.company_id) {
          await supabase
            .from("company")
            .update({ org_number: orgToPersist })
            .eq("company_id", wsData.company_id);
        }
      } catch (e) {
        console.error("Failed to persist org_number", e);
      }
    }

    // If confirming auto-detected data, also sync orgNumberInput for downstream use
    if (autoDetected) {
      wizard.setOrgNumberInput(wizard.workspaceData.orgNumber);
    }

    wizard.goTo("branding");
  };

  const handleSwitchToManual = () => {
    setManualOverride(true);
    wizard.setVerifiedOrgData(null);
  };

  // ── State A: Auto-detected confirmation card ──
  if (autoDetected) {
    const { workspaceData: wd } = wizard;
    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 mx-auto flex w-full max-w-2xl flex-col items-center text-center duration-500">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-green-500/20 bg-green-500/10 text-green-400 shadow-[0_0_30px_rgba(34,197,94,0.15)] sm:h-20 sm:w-20">
          <Building2 className="h-7 w-7 sm:h-8 sm:w-8" />
        </div>
        <h2 className="mb-3 text-2xl font-extrabold text-white sm:text-3xl">
          We found your company
        </h2>
        <p className="mb-6 text-sm text-zinc-400 sm:mb-8 sm:text-base">
          This information was automatically retrieved from Bronnoydsundregistrene. Please confirm it&apos;s correct.
        </p>

        <div className="relative w-full overflow-hidden rounded-2xl border border-green-500/20 bg-[#111] p-5 text-left shadow-2xl shadow-green-900/10 sm:p-8">
          {/* Auto-detected badge */}
          <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1 sm:top-4 sm:right-4">
            <Sparkles className="text-green-400" size={14} />
            <span className="text-xs font-semibold text-green-400">Auto-detected</span>
          </div>

          <h3 className="mb-4 pr-28 text-xl font-bold text-white sm:mb-6 sm:text-2xl">
            {wd.name}
          </h3>

          <div className="mb-6 grid grid-cols-1 gap-4 sm:mb-8 sm:grid-cols-2 sm:gap-6">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/5 bg-white/5">
                <Building2 className="text-zinc-400" size={16} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-zinc-500 uppercase">Org Number</span>
                <span className="font-mono text-zinc-300">{formatOrgNumber(wd.orgNumber)}</span>
              </div>
            </div>

            {wd.address && (
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/5 bg-white/5">
                  <MapPin className="text-zinc-400" size={16} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-zinc-500 uppercase">
                    Forretningsadresse
                  </span>
                  <span className="text-zinc-300">{wd.address}</span>
                </div>
              </div>
            )}

            {wd.ceo && (
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/5 bg-white/5">
                  <User className="text-zinc-400" size={16} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-zinc-500 uppercase">Daglig Leder</span>
                  <span className="text-zinc-300">{wd.ceo}</span>
                </div>
              </div>
            )}

            {wd.industry && (
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/5 bg-white/5">
                  <Briefcase className="text-zinc-400" size={16} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-zinc-500 uppercase">Industry</span>
                  <span className="text-zinc-300">{wd.industry}</span>
                </div>
              </div>
            )}

            {wd.employeeCount && (
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/5 bg-white/5">
                  <Users className="text-zinc-400" size={16} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-zinc-500 uppercase">Employees</span>
                  <span className="text-zinc-300">{wd.employeeCount}</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={handleConfirmOrg}
              className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 font-bold text-black shadow-lg transition-transform hover:bg-zinc-200 active:scale-[0.98]"
            >
              <CheckCircle2 size={18} />
              Confirm & Continue
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSwitchToManual}
          className="mt-6 text-sm text-zinc-500 transition-colors hover:text-white"
        >
          Not correct? Enter org number manually
        </button>
      </div>
    );
  }

  // ── State B: Manual entry (existing implementation) ──
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 mx-auto flex w-full max-w-2xl flex-col items-center text-center duration-500">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-blue-500/20 bg-blue-500/10 text-blue-400 shadow-[0_0_30px_rgba(59,130,246,0.15)] sm:h-20 sm:w-20">
        <Building2 className="h-7 w-7 sm:h-8 sm:w-8" />
      </div>
      <h2 className="mb-3 text-2xl font-extrabold text-white sm:text-3xl">
        Verify Company Identity
      </h2>
      <p className="mb-6 text-sm text-zinc-400 sm:mb-8 sm:text-base">
        Enter your Norwegian organization number to pull official public records for your workspace.
      </p>

      {!wizard.verifiedOrgData ? (
        <form onSubmit={handleVerifyOrg} className="w-full">
          <div className="space-y-4">
            <div className="relative flex items-center overflow-hidden rounded-2xl border border-white/10 bg-[#111] shadow-xl transition-all focus-within:border-cyan-500 focus-within:ring-1 focus-within:ring-cyan-500">
              <input
                type="text"
                value={wizard.orgNumberInput}
                onChange={(e) => wizard.setOrgNumberInput(e.target.value)}
                placeholder="Organisasjonsnummer (9 siffer)"
                className="w-full bg-transparent p-5 text-center text-lg font-medium text-white outline-none placeholder:text-zinc-600"
                maxLength={11}
              />
            </div>
            {orgError && <p className="text-sm font-medium text-red-400">{orgError}</p>}
            <button
              type="submit"
              disabled={isVerifyingOrg || !wizard.orgNumberInput}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-4 font-bold text-black transition-transform hover:bg-zinc-200 active:scale-[0.98] disabled:opacity-50"
            >
              {isVerifyingOrg ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                "Search Bronnoydsundregistrene"
              )}
            </button>
          </div>
          <button
            type="button"
            onClick={() => wizard.goTo("branding")}
            className="mt-6 text-sm text-zinc-500 transition-colors hover:text-white"
          >
            Skip this step for now
          </button>
        </form>
      ) : (
        <div className="relative w-full overflow-hidden rounded-2xl border border-cyan-500/30 bg-[#111] p-5 text-left shadow-2xl shadow-cyan-900/10 sm:p-8">
          <div className="absolute top-3 right-3 sm:top-4 sm:right-4">
            <CheckCircle2 className="text-green-500" size={24} />
          </div>
          <h3 className="mb-4 pr-8 text-xl font-bold text-white sm:mb-6 sm:text-2xl">
            {wizard.verifiedOrgData.name}
          </h3>

          <div className="mb-6 grid grid-cols-1 gap-6 sm:mb-8 sm:grid-cols-2 sm:gap-8">
            <div className="space-y-4">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-zinc-500 uppercase">Org Num</span>
                <span className="font-mono text-zinc-300">{wizard.orgNumberInput}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-zinc-500 uppercase">
                  Forretningsadresse
                </span>
                <span className="text-zinc-300">{wizard.verifiedOrgData.address}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-zinc-500 uppercase">Daglig Leder</span>
                <span className="text-zinc-300">{wizard.verifiedOrgData.ceo}</span>
              </div>
              {wizard.verifiedOrgData.industry && (
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-zinc-500 uppercase">Industry</span>
                  <span className="text-zinc-300">{wizard.verifiedOrgData.industry}</span>
                </div>
              )}
            </div>

            {wizard.verifiedOrgData.description && (
              <div className="flex flex-col rounded-xl border border-white/10 bg-white/5 p-4">
                <span className="mb-2 text-xs font-bold text-zinc-500 uppercase">
                  Description (Formal)
                </span>
                <span className="text-sm leading-relaxed whitespace-pre-line text-zinc-300">
                  {wizard.verifiedOrgData.description}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => wizard.setVerifiedOrgData(null)}
              className="rounded-xl bg-zinc-800 px-4 py-3 font-medium text-white transition-colors hover:bg-zinc-700 sm:flex-1"
            >
              Try Again
            </button>
            <button
              onClick={handleConfirmOrg}
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3 font-bold text-white shadow-lg shadow-cyan-500/20 hover:opacity-90 sm:flex-[2]"
            >
              Looks correct <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
