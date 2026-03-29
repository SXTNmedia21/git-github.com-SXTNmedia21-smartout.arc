"use client";

/**
 * DevAutoFill — localhost-only button that auto-fills all fields in a wizard step.
 * Hidden in production. Renders a small fixed button in the bottom-left corner.
 */

import { useEffect, useState } from "react";

interface DevAutoFillProps {
  onFill: () => void;
  label?: string;
}

export function DevAutoFill({ onFill, label = "Autofyll" }: DevAutoFillProps) {
  const [isDev, setIsDev] = useState(false);

  useEffect(() => {
    setIsDev(window.location.hostname === "localhost");
  }, []);

  if (!isDev) return null;

  return (
    <button
      type="button"
      onClick={onFill}
      className="fixed bottom-4 left-4 z-50 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white shadow-lg transition-opacity hover:bg-violet-700"
    >
      {label}
    </button>
  );
}
