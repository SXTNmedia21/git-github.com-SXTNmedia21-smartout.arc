"use client";

import { useState, useMemo, useCallback } from "react";
import { Circle, Loader2, ArrowRight, Check, AlertTriangle } from "lucide-react";
import { useOnboarding } from "../WizardContext";
import { SectionReveal, RevealItem } from "../components/SectionReveal";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_B2B_TEMPLATE_ID = "c0000002-0000-0000-0000-000000000002";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Editable text field with label and dark-theme styling */
function DocumentField({
  label,
  value,
  onChange,
  placeholder,
  readOnly = false,
  mono = false,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  mono?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm text-white/50">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className={`w-full rounded-xl border border-white/[0.08] bg-white/[0.05] px-4 py-3 text-white placeholder:text-white/30 focus:ring-2 focus:ring-white/20 focus:outline-none ${
          readOnly ? "cursor-default text-white/60" : ""
        } ${mono ? "font-mono" : ""}`}
      />
    </div>
  );
}

/** Two fields on the same row */
function DocumentFieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-4">{children}</div>;
}

/** Tier header with status dot and label */
function TierHeader({
  tier,
  label,
  complete,
}: {
  tier: "required" | "recommended" | "optional";
  label: string;
  complete: boolean;
}) {
  const dotStyles = {
    required: complete ? "bg-success" : "bg-destructive",
    recommended: complete ? "bg-info" : "bg-white/20",
    optional: "bg-white/10 ring-1 ring-white/20",
  };

  const isFilled = tier === "optional" ? false : complete;

  return (
    <div className="flex items-center gap-2.5 pt-2 pb-1">
      {tier === "optional" ? (
        <Circle className="h-3 w-3 text-white/30" />
      ) : (
        <div className={`h-3 w-3 rounded-full ${dotStyles[tier]} ${isFilled ? "shadow-sm" : ""}`} />
      )}
      <span className="text-xs font-semibold tracking-wider text-white/40 uppercase">{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type ContractStatus = "idle" | "sending" | "sent" | "error";

export function CustomerDocumentView() {
  const { business, season, departments, updateBusiness, completeSection, onboardingWorkspaceId } =
    useOnboarding();

  // Local state for contact person (defaults to empty — filled by user)
  const [contactPerson, setContactPerson] = useState("");
  // Contact email from auth — shown as readonly
  // We pull from business.email since that's what the scrape populates
  const contactEmail = business.email;

  // Contract sending state
  const [contractStatus, setContractStatus] = useState<ContractStatus>("idle");
  const [contractError, setContractError] = useState<string | null>(null);
  const [contractId, setContractId] = useState<string | null>(null);

  // ----- Tier field completion checks -----

  const mustHaveFields = useMemo(
    () => ({
      name: (business.name || business.legalName || "").trim(),
      orgNumber: (business.orgNumber || "").trim(),
      contactPerson: contactPerson.trim(),
      email: (contactEmail || "").trim(),
    }),
    [business.name, business.legalName, business.orgNumber, contactPerson, contactEmail],
  );

  const mustHaveComplete = useMemo(
    () => Object.values(mustHaveFields).every((v) => v.length > 0),
    [mustHaveFields],
  );

  const mustHaveFilledCount = useMemo(
    () => Object.values(mustHaveFields).filter((v) => v.length > 0).length,
    [mustHaveFields],
  );

  const shouldHaveFields = useMemo(
    () => ({
      address: (business.address || "").trim(),
      postalCode: (business.postalCode || "").trim(),
      city: (business.city || "").trim(),
      phone: (business.phone || "").trim(),
      industry: (business.industry || "").trim(),
    }),
    [business.address, business.postalCode, business.city, business.phone, business.industry],
  );

  const shouldHaveComplete = useMemo(
    () => Object.values(shouldHaveFields).every((v) => v.length > 0),
    [shouldHaveFields],
  );

  const selectedDepartments = useMemo(
    () => departments.filter((d) => d.selected).map((d) => d.name),
    [departments],
  );

  // ----- Progress bar -----

  const totalMustHave = 4;
  const progressPercent = Math.round((mustHaveFilledCount / totalMustHave) * 100);

  // ----- Send contract -----

  const handleSendContract = useCallback(async () => {
    if (!mustHaveComplete) return;

    setContractStatus("sending");
    setContractError(null);

    try {
      const res = await fetch("/api/onboarding/send-contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: DEFAULT_B2B_TEMPLATE_ID,
          workspaceId: onboardingWorkspaceId ?? undefined,
          recipientName: contactPerson.trim(),
          recipientEmail: contactEmail.trim(),
          businessData: {
            name: business.name || business.legalName,
            legalName: business.legalName || undefined,
            orgNumber: business.orgNumber,
            address: business.address || undefined,
            postalCode: business.postalCode || undefined,
            city: business.city || undefined,
            phone: business.phone || undefined,
            industry: business.industry || undefined,
            industryCode: business.industryCode || undefined,
            departments: selectedDepartments.length > 0 ? selectedDepartments : undefined,
          },
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Ukjent feil" }));
        throw new Error(errData.error ?? "Kunne ikke sende kontrakt");
      }

      const data = (await res.json()) as {
        contractId: string;
        signingUrl: string | null;
        status: string;
      };

      setContractId(data.contractId);
      setContractStatus("sent");
      completeSection("contract");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Noe gikk galt";
      setContractError(message);
      setContractStatus("error");
    }
  }, [
    mustHaveComplete,
    contactPerson,
    contactEmail,
    business,
    selectedDepartments,
    onboardingWorkspaceId,
    completeSection,
  ]);

  // ----- Success state -----

  if (contractStatus === "sent") {
    return (
      <SectionReveal>
        <RevealItem>
          <div className="flex flex-col items-center gap-6 py-12 text-center">
            <div className="bg-success/20 flex h-20 w-20 items-center justify-center rounded-full">
              <Check className="text-success h-10 w-10" />
            </div>
            <h2 className="font-heading text-4xl leading-tight tracking-tight text-white">
              Kontraktet er sendt!
            </h2>
            <p className="max-w-md text-lg leading-relaxed text-white/50">
              Sjekk e-posten din for kontraktet. Du kan signere det digitalt direkte fra e-posten.
            </p>
            {contractId && (
              <p className="font-mono text-xs text-white/20">Ref: {contractId.slice(0, 8)}</p>
            )}
          </div>
        </RevealItem>
      </SectionReveal>
    );
  }

  // ----- Document form -----

  return (
    <div className="flex h-dvh flex-col overflow-y-auto px-6 py-12 sm:px-12 lg:px-24">
      <SectionReveal>
        {/* Header + progress bar */}
        <RevealItem>
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-3xl leading-tight tracking-tight text-white sm:text-4xl">
              Kundedokument
            </h2>
            <div className="flex items-center gap-3">
              <div className="h-2 w-24 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-white/60 transition-all duration-500 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-sm font-medium text-white/40">{progressPercent}% klart</span>
            </div>
          </div>
        </RevealItem>

        {/* Tier 1: MA HA (required) */}
        <RevealItem>
          <div className="mt-8">
            <TierHeader tier="required" label="Ma ha" complete={mustHaveComplete} />
            <div className="mt-3 rounded-2xl border border-white/[0.06] bg-white/[0.07] p-6 shadow-lg shadow-black/20">
              <div className="space-y-4">
                <DocumentField
                  label="Bedriftsnavn"
                  value={business.name || business.legalName}
                  onChange={(v) => updateBusiness({ name: v })}
                  placeholder="Bedriftens navn"
                />
                <DocumentField
                  label="Org.nummer"
                  value={business.orgNumber}
                  onChange={(v) => updateBusiness({ orgNumber: v })}
                  placeholder="000 000 000"
                  mono
                />
                <DocumentField
                  label="Kontaktperson"
                  value={contactPerson}
                  onChange={setContactPerson}
                  placeholder="Fullt navn"
                />
                <DocumentField
                  label="E-post"
                  value={contactEmail}
                  readOnly
                  placeholder="kontakt@bedrift.no"
                />
              </div>
            </div>
          </div>
        </RevealItem>

        {/* Tier 2: SKA HA (recommended) */}
        <RevealItem>
          <div className="mt-6">
            <TierHeader tier="recommended" label="Ska ha" complete={shouldHaveComplete} />
            <div className="mt-3 rounded-2xl border border-white/[0.06] bg-white/[0.07] p-6 shadow-lg shadow-black/20">
              <div className="space-y-4">
                <DocumentField
                  label="Adresse"
                  value={business.address}
                  onChange={(v) => updateBusiness({ address: v })}
                  placeholder="Gateadresse"
                />
                <DocumentFieldRow>
                  <DocumentField
                    label="Postnummer"
                    value={business.postalCode}
                    onChange={(v) => updateBusiness({ postalCode: v })}
                    placeholder="0000"
                    mono
                  />
                  <DocumentField
                    label="Sted"
                    value={business.city}
                    onChange={(v) => updateBusiness({ city: v })}
                    placeholder="By"
                  />
                </DocumentFieldRow>
                <DocumentField
                  label="Telefon"
                  value={business.phone}
                  onChange={(v) => updateBusiness({ phone: v })}
                  placeholder="+47 000 00 000"
                />
                <DocumentField
                  label="Bransje"
                  value={business.industry}
                  readOnly
                  placeholder="Fra skanning"
                />
                <DocumentField
                  label="Avdelinger"
                  value={selectedDepartments.length > 0 ? selectedDepartments.join(", ") : ""}
                  readOnly
                  placeholder="Ingen valgt enna"
                />
              </div>
            </div>
          </div>
        </RevealItem>

        {/* Tier 3: VILL HA (optional) */}
        <RevealItem>
          <div className="mt-6">
            <TierHeader tier="optional" label="Vill ha" complete={false} />
            <div className="mt-3 rounded-2xl border border-white/[0.06] bg-white/[0.07] p-6 shadow-lg shadow-black/20">
              <div className="space-y-4">
                <DocumentField
                  label="Nettside"
                  value={business.website}
                  onChange={(v) => updateBusiness({ website: v })}
                  placeholder="https://bedrift.no"
                />
                <DocumentField
                  label="Antall ansatte"
                  value={business.employeeCount}
                  onChange={(v) => updateBusiness({ employeeCount: v })}
                  placeholder="Ca. antall"
                />
                <DocumentField
                  label="Sesong"
                  value={season.name}
                  readOnly
                  placeholder="Ikke valgt"
                />
              </div>
            </div>
          </div>
        </RevealItem>

        {/* Error message */}
        {contractStatus === "error" && contractError && (
          <RevealItem>
            <div className="border-destructive/20 bg-destructive/10 mt-6 flex items-start gap-3 rounded-xl border p-4">
              <AlertTriangle className="text-destructive mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="text-destructive text-sm font-medium">{contractError}</p>
                <p className="text-destructive/60 mt-1 text-xs">Du kan prove igjen nedenfor.</p>
              </div>
            </div>
          </RevealItem>
        )}

        {/* Confirm button */}
        <RevealItem>
          <div className="mt-8">
            <button
              type="button"
              onClick={handleSendContract}
              disabled={!mustHaveComplete || contractStatus === "sending"}
              className={`flex w-full items-center justify-center gap-3 rounded-2xl py-4 text-lg font-semibold transition-colors ${
                mustHaveComplete && contractStatus !== "sending"
                  ? "bg-white text-black hover:bg-white/90"
                  : "cursor-not-allowed bg-white/10 text-white/30"
              }`}
            >
              {contractStatus === "sending" ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Sender kontrakt...
                </>
              ) : (
                <>
                  Bekreft og send kontrakt
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>

            {!mustHaveComplete && (
              <p className="mt-3 text-center text-sm text-white/30">
                Fyll ut alle obligatoriske felt for å sende kontraktet.
              </p>
            )}
          </div>
        </RevealItem>
      </SectionReveal>
    </div>
  );
}
