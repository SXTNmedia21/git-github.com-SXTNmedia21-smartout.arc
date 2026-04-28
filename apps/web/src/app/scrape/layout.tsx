import React from "react";

export default function ScrapeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background text-foreground flex min-h-screen items-center justify-center p-4 sm:p-8">
      <div className="border-border bg-card relative flex h-[90vh] w-full max-w-screen-2xl overflow-hidden rounded-3xl border shadow-2xl">
        {children}
      </div>
    </div>
  );
}
