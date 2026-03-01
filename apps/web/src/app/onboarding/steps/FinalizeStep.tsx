"use client";

import { Loader2 } from "lucide-react";

export function FinalizeStep() {
  return (
    <div className="animate-in fade-in fill-mode-both mx-auto flex w-full max-w-md flex-col items-center text-center duration-500">
      <div className="relative mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-blue-500/10">
        <div className="absolute inset-x-0 bottom-0 h-1/2 rounded-b-full bg-gradient-to-t from-blue-500/20 to-transparent"></div>
        <Loader2 size={40} className="animate-[spin_2s_linear_infinite] text-blue-500" />
      </div>
      <h2 className="mb-2 text-2xl font-bold text-white">Finalizing Workspace</h2>
      <p className="text-zinc-400">
        Saving structure, injecting policies, and spinning up your dashboard...
      </p>
    </div>
  );
}
