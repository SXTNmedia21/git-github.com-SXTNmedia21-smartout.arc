"use client";

import { FileText, ArrowRight } from "lucide-react";
import { useWizard } from "../WizardContext";

export function SeasonEducationStep() {
  const wizard = useWizard();

  return (
    <div className="animate-in fade-in slide-in-from-bottom-8 mx-auto w-full max-w-3xl duration-700">
      <div className="mb-10 text-center">
        <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          The Concept of Seasons
        </h1>
        <p className="text-lg text-zinc-400">
          In Smartout, everything operates in Seasons. Reset budgets, update menus, and change
          setups seamlessly.
        </p>
      </div>

      <div className="group relative flex flex-col items-center overflow-hidden rounded-3xl border border-white/5 bg-[#111] p-8 text-center shadow-xl sm:p-10">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent"></div>

        <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-full border border-indigo-500/30 bg-indigo-500/20">
          <FileText size={40} className="text-indigo-400" />
        </div>

        <h2 className="mb-4 text-2xl font-bold text-white">Why Seasons?</h2>
        <p className="mb-8 max-w-lg leading-relaxed text-zinc-300">
          Instead of a continuously growing, unmanageable system, Smartout uses{" "}
          <strong>Seasons</strong>. A Season can be permanent (like &quot;Core Operations&quot;) or
          temporal (like &quot;Summer 2024&quot;).
          <br />
          <br />
          This lets you archive past performance, assign seasonal staff cleanly, and switch entire
          operational configurations overnight.
        </p>

        <button
          onClick={() => wizard.goTo("season_identity")}
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-600 px-8 py-3.5 font-bold text-white shadow-lg shadow-indigo-500/25 transition-transform hover:from-indigo-400 hover:to-blue-500 active:scale-95"
        >
          I understand, let&apos;s build one <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}
