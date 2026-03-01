"use client";

import { createContext, useContext } from "react";
import type { WizardContext as WizardContextType } from "./types";

const Context = createContext<WizardContextType | null>(null);

export function WizardProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: WizardContextType;
}) {
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/**
 * Access the wizard context from any step component.
 * Throws if used outside WizardProvider.
 */
export function useWizard(): WizardContextType {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useWizard must be used within WizardProvider");
  return ctx;
}
