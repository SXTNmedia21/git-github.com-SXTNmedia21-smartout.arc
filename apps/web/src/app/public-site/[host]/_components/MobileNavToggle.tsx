"use client";

import { useState } from "react";

export function MobileNavToggle({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="p-2 md:hidden"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          {open ? <path d="M18 6L6 18M6 6l12 12" /> : <path d="M3 12h18M3 6h18M3 18h18" />}
        </svg>
      </button>
      {open && (
        <div className="absolute top-full right-0 left-0 border-b border-[var(--site-muted)] bg-[var(--site-background)] shadow-md md:hidden">
          <nav className="flex flex-col gap-2 p-4" onClick={() => setOpen(false)}>
            {children}
          </nav>
        </div>
      )}
    </>
  );
}
