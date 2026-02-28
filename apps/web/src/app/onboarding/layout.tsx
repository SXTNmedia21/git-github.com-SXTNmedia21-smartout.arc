import React from "react";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4 text-zinc-50 sm:p-8">
      <div className="relative flex h-[90vh] w-full max-w-screen-2xl overflow-hidden rounded-3xl border border-zinc-800/60 bg-zinc-900 shadow-2xl">
        {children}
      </div>
    </div>
  );
}
