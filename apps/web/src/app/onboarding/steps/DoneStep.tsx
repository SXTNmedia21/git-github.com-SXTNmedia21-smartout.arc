"use client";

import { CheckCircle2, ArrowRight } from "lucide-react";
import { useWizard } from "../WizardContext";

export function DoneStep() {
  const wizard = useWizard();

  const dashboardUrl =
    process.env.NEXT_PUBLIC_ROOT_DOMAIN === "localhost"
      ? "/dashboard"
      : `https://${wizard.activatedWorkspaceSlug}.smartout.ai/dashboard`;

  return (
    <div className="animate-in zoom-in-95 fade-in mx-auto flex w-full max-w-md flex-col items-center text-center duration-500">
      <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 shadow-[0_0_40px_rgba(16,185,129,0.3)] ring-4 ring-emerald-500/20">
        <CheckCircle2 size={48} />
      </div>
      <h2 className="mb-4 text-3xl font-extrabold text-white">You&apos;re All Set!</h2>
      <p className="mb-8 text-zinc-400">Welcome to the future of hospitality management.</p>
      <a
        href={dashboardUrl}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-8 py-4 font-bold text-zinc-900 shadow-xl transition-transform hover:bg-zinc-200 active:scale-95"
      >
        Enter Dashboard <ArrowRight size={18} />
      </a>
    </div>
  );
}
