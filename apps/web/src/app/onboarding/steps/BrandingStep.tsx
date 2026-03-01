"use client";

import { FileText, CheckCircle2 } from "lucide-react";
import { useWizard } from "../WizardContext";

export function BrandingStep() {
  const wizard = useWizard();

  return (
    <div className="animate-in fade-in slide-in-from-bottom-8 mx-auto w-full max-w-3xl duration-700">
      <div className="mb-10 text-center">
        <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Your Branding & Voice
        </h1>
        <p className="text-lg text-zinc-400">
          Set up your company&apos;s visual identity and communication style.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <div className="group relative overflow-hidden rounded-3xl border border-white/5 bg-[#111] p-6 shadow-xl transition-colors hover:border-white/10 sm:p-8">
          <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-purple-500 to-pink-500 opacity-50"></div>
          <h3 className="mb-6 flex items-center gap-3 text-xl font-bold text-white">
            <FileText className="text-purple-400" size={24} /> Company Summary & Images
          </h3>
          <div className="space-y-6">
            <div>
              <label className="mb-2 block text-xs font-bold tracking-wider text-zinc-500 uppercase">
                Company Logo
              </label>
              <div className="flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/10 bg-black/30 text-zinc-500 transition-colors hover:border-white/30 hover:text-white">
                <span className="text-sm font-medium">Click to upload or drag & drop</span>
                <span className="mt-1 text-xs">PNG, JPG or SVG</span>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold tracking-wider text-zinc-500 uppercase">
                Company Slogan
              </label>
              <input
                value={wizard.workspaceData.slogan}
                onChange={(e) => wizard.updateData({ slogan: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white transition-colors outline-none focus:border-purple-500"
                placeholder="e.g. Where quality meets service"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold tracking-wider text-zinc-500 uppercase">
                Brand Color
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="color"
                  value={wizard.workspaceData.brandColor || "#3B82F6"}
                  onChange={(e) => wizard.updateData({ brandColor: e.target.value })}
                  className="h-12 w-12 cursor-pointer rounded-xl border border-white/10 bg-black/50"
                />
                <span className="rounded-xl border border-white/10 bg-black/50 px-4 py-3 font-mono text-sm text-zinc-400">
                  {wizard.workspaceData.brandColor || "#3B82F6"}
                </span>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold tracking-wider text-zinc-500 uppercase">
                Communication Tone
              </label>
              <select
                value={wizard.workspaceData.communicationTone || "Professional & Formal"}
                onChange={(e) => wizard.updateData({ communicationTone: e.target.value })}
                className="w-full appearance-none rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white transition-colors outline-none focus:border-purple-500"
              >
                <option>Professional & Formal</option>
                <option>Friendly & Casual</option>
                <option>Energetic & Upbeat</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-10 flex justify-between">
        <button
          onClick={() => wizard.goTo("org_verification")}
          className="rounded-xl border border-white/10 px-6 py-3.5 font-medium text-white transition-colors hover:bg-white/5"
        >
          Back
        </button>
        <button
          onClick={() => wizard.goTo("season_education")}
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 px-8 py-3.5 font-bold text-white shadow-lg shadow-purple-500/25 transition-transform hover:from-purple-400 hover:to-pink-500 active:scale-95"
        >
          Generate Contract & Proceed <CheckCircle2 size={18} />
        </button>
      </div>
    </div>
  );
}
