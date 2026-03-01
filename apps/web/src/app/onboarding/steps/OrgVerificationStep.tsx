"use client";

import { useState } from "react";
import { createClient } from "@smartout/supabase/client";
import { Building2, CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import { useWizard } from "../WizardContext";

export function OrgVerificationStep() {
  const wizard = useWizard();
  const supabase = createClient();
  const [isVerifyingOrg, setIsVerifyingOrg] = useState(false);
  const [orgError, setOrgError] = useState("");

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
    if (wizard.sessionId && wizard.orgNumberInput) {
      try {
        const { data: wsData } = await supabase
          .from("workspace")
          .select("company_id")
          .eq("workspace_id", wizard.sessionId)
          .single();

        if (wsData?.company_id) {
          await supabase
            .from("company")
            .update({ org_number: wizard.orgNumberInput })
            .eq("company_id", wsData.company_id);
        }
      } catch (e) {
        console.error("Failed to persist org_number", e);
      }
    }

    wizard.goTo("branding");
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 mx-auto flex w-full max-w-2xl flex-col items-center text-center duration-500">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-blue-500/20 bg-blue-500/10 text-blue-400 shadow-[0_0_30px_rgba(59,130,246,0.15)]">
        <Building2 size={32} />
      </div>
      <h2 className="mb-3 text-3xl font-extrabold text-white">Verify Company Identity</h2>
      <p className="mb-8 text-zinc-400">
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
        <div className="relative w-full overflow-hidden rounded-2xl border border-cyan-500/30 bg-[#111] p-6 text-left shadow-2xl shadow-cyan-900/10 sm:p-8">
          <div className="absolute top-0 right-0 p-4">
            <CheckCircle2 className="text-green-500" size={24} />
          </div>
          <h3 className="mb-6 pr-8 text-2xl font-bold text-white">{wizard.verifiedOrgData.name}</h3>

          <div className="mb-8 grid grid-cols-1 gap-8 sm:grid-cols-2">
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

          <div className="flex gap-3">
            <button
              onClick={() => wizard.setVerifiedOrgData(null)}
              className="flex-1 rounded-xl bg-zinc-800 px-4 py-3 font-medium text-white transition-colors hover:bg-zinc-700"
            >
              Try Again
            </button>
            <button
              onClick={handleConfirmOrg}
              className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3 font-bold text-white shadow-lg shadow-cyan-500/20 hover:opacity-90"
            >
              Looks correct <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
