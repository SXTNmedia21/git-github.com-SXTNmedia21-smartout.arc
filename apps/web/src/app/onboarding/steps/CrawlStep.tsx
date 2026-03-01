"use client";

import { Globe } from "lucide-react";
import { useWizard } from "../WizardContext";

export function CrawlStep() {
  const wizard = useWizard();

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center text-center">
      <div className="relative mb-8 flex h-24 w-24 items-center justify-center">
        <div className="absolute inset-0 rounded-full border-4 border-cyan-500/20"></div>
        <div className="absolute inset-0 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent"></div>
        <Globe className="h-8 w-8 text-cyan-400" />
      </div>
      <h2 className="mb-2 text-2xl font-bold text-white">
        Analyzing {wizard.workspaceData.website || "your site"}...
      </h2>
      <p className="text-zinc-400">
        Extracting company structure, locations, and generating standard operational policies.
      </p>
    </div>
  );
}
