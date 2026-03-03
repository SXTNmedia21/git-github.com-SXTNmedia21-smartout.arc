"use client";

import { FileText, CheckCircle } from "lucide-react";
import { useOnboarding } from "../WizardContext";
import { SectionReveal, RevealItem } from "../components/SectionReveal";

const CONTRACT_INCLUDES = [
  "Arbeidsavtale ihht. Arbeidsmiljoloven",
  "Personalhandbok-referanse",
  "GDPR-samtykke",
  "Taushetserklaring",
];

export function ContractSection() {
  const { business, completeSection } = useOnboarding();

  const companyName = business.legalName || business.name;

  return (
    <SectionReveal>
      <div className="flex flex-col items-center gap-10">
        <RevealItem>
          <div className="flex flex-col items-center gap-3 text-center">
            <h2 className="font-[family-name:var(--font-display)] text-6xl leading-[1.1] tracking-tight text-white">
              Kontraktmal
            </h2>
            <p className="max-w-md text-xl leading-relaxed text-white/50">
              Vi har laget en mal basert pa norsk arbeidsmiljolov og din bedrift.
            </p>
          </div>
        </RevealItem>

        <RevealItem>
          <div className="flex w-full max-w-md flex-col gap-6 rounded-2xl border border-white/[0.06] bg-white/[0.07] p-8 shadow-lg shadow-black/20">
            <div className="flex items-center gap-3">
              <FileText className="size-5 text-white/40" />
              <span className="text-lg font-medium text-white/80">
                {companyName || "Ditt selskap"}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              {business.orgNumber && (
                <p className="font-mono text-sm text-white/50">Org.nr: {business.orgNumber}</p>
              )}
              {(business.address || business.city) && (
                <p className="text-sm text-white/40">
                  {[business.address, business.postalCode, business.city]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              )}
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            <div className="flex flex-col gap-3">
              <p className="text-xs tracking-wider text-white/50 uppercase">Malen inkluderer</p>
              {CONTRACT_INCLUDES.map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <CheckCircle className="size-4 shrink-0 text-emerald-400" />
                  <span className="text-base text-white/70">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </RevealItem>

        <RevealItem>
          <div className="flex w-full max-w-md flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => completeSection("contract")}
              className="w-full rounded-2xl bg-white py-4 text-lg font-semibold text-black transition-colors hover:bg-white/90"
            >
              Bekreft kontraktmal
            </button>
            <button
              type="button"
              onClick={() => completeSection("contract")}
              className="text-center text-sm text-white/40 transition-colors hover:text-white/60"
            >
              Tilpass senere i dashboardet
            </button>
          </div>
        </RevealItem>
      </div>
    </SectionReveal>
  );
}
