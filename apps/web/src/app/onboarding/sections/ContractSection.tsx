"use client";

import { useState } from "react";
import { FileText, CheckCircle, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useOnboarding } from "../WizardContext";

const CONTRACT_INCLUDES = [
  "Arbeidsavtale ihht. Arbeidsmiljøloven",
  "Personalhandbok-referanse",
  "GDPR-samtykke",
  "Taushetserklæring",
];

// TODO: Replace with a SendGrid Edge Function call (e.g. supabase.functions.invoke("send-contract-email"))
async function sendContractConfirmation(
  email: string,
  workspaceData: { companyName: string; orgNumber: string },
) {
  console.log("[ContractSection] sendContractConfirmation called", {
    email,
    workspaceData,
  });
}

export function ContractSection() {
  const { business, completeSection } = useOnboarding();
  const [contractEnabled, setContractEnabled] = useState(true);

  const companyName = business.legalName || business.name;

  function handleConfirm() {
    if (contractEnabled) {
      sendContractConfirmation(business.email, {
        companyName: companyName || "Ukjent selskap",
        orgNumber: business.orgNumber,
      });
      toast.success("Avtalen er sendt til din e-post");
    }
    completeSection("contract");
  }

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* Left: Agent voice */}
      <div className="flex flex-col justify-center border-r border-white/[0.04] px-10 py-20 lg:w-[38%] lg:px-16">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-xs font-semibold tracking-[0.25em] text-white/20 uppercase">
            Kontrakt
          </p>
          <h2 className="font-heading mt-6 text-[clamp(3.5rem,7vw,6rem)] leading-[0.9] tracking-tight text-white">
            En siste
            <br />
            ting.
            <br />
            <span className="text-white/25">Avtalen.</span>
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-white/35">
            Dette er avtalen mellom Smartout og din bedrift — ikke en arbeidsavtale for de ansatte.
          </p>

          <div className="mt-10 flex flex-col gap-3">
            <button
              type="button"
              onClick={handleConfirm}
              className="flex items-center justify-center gap-3 rounded-2xl bg-white py-4 text-lg font-semibold text-black transition-colors hover:bg-white/90"
            >
              {contractEnabled ? "Bekreft kontraktmal →" : "Fortsett uten kontrakt →"}
            </button>
            <button
              type="button"
              onClick={() => completeSection("contract")}
              className="text-center text-sm text-white/25 transition-colors hover:text-white/45"
            >
              Tilpass senere i dashboardet
            </button>
          </div>
        </motion.div>
      </div>

      {/* Right: Contract card */}
      <div className="flex flex-col justify-center px-10 py-20 lg:w-[62%] lg:px-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-xl"
        >
          {/* Toggle */}
          <div className="mb-6 flex items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.03] px-6 py-4">
            <span className="text-base text-white/50">Inkluder kontraktmal</span>
            <button
              type="button"
              onClick={() => setContractEnabled((prev) => !prev)}
              className="text-white/60 transition-colors hover:text-white/80"
              aria-label={contractEnabled ? "Deaktiver kontrakt" : "Aktiver kontrakt"}
            >
              {contractEnabled ? (
                <ToggleRight className="size-8 text-emerald-400" />
              ) : (
                <ToggleLeft className="size-8" />
              )}
            </button>
          </div>

          {contractEnabled ? (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.05] p-8">
              <div className="flex items-center gap-3">
                <FileText className="size-5 text-white/30" />
                <span className="text-xl font-medium text-white">
                  {companyName || "Ditt selskap"}
                </span>
              </div>

              {(business.orgNumber || business.address || business.city) && (
                <div className="mt-3 flex flex-col gap-1">
                  {business.orgNumber && (
                    <p className="font-mono text-sm text-white/35">Org.nr: {business.orgNumber}</p>
                  )}
                  {(business.address || business.city) && (
                    <p className="text-sm text-white/30">
                      {[business.address, business.postalCode, business.city]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  )}
                </div>
              )}

              <div className="my-6 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

              <p className="mb-4 text-xs tracking-[0.15em] text-white/25 uppercase">
                Malen inkluderer
              </p>
              <div className="flex flex-col gap-3">
                {CONTRACT_INCLUDES.map((item, i) => (
                  <motion.div
                    key={item}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    className="flex items-center gap-3"
                  >
                    <CheckCircle className="size-4 shrink-0 text-emerald-400/70" />
                    <span className="text-base text-white/60">{item}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/[0.06] p-8 text-center">
              <p className="text-base text-white/30">
                Du har valgt bort kontraktmalen. Du kan alltid aktivere den igjen i dashboardet.
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
