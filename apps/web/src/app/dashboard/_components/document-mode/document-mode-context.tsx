"use client";

import { createContext, useContext, useState, useMemo, type ReactNode } from "react";
import { HANDBOOK_CHAPTERS } from "./chapters";

type PanelTab = "tools" | "actions" | "settings";

type DocumentModeState = {
  activeChapterKey: string;
  setActiveChapterKey: (key: string) => void;
  panelTab: PanelTab;
  setPanelTab: (tab: PanelTab) => void;
  isDirty: boolean;
  setIsDirty: (val: boolean) => void;
};

const DocumentModeContext = createContext<DocumentModeState | null>(null);

export function DocumentModeProvider({ children }: { children: ReactNode }) {
  const [activeChapterKey, setActiveChapterKey] = useState(HANDBOOK_CHAPTERS[0].key);
  const [panelTab, setPanelTab] = useState<PanelTab>("tools");
  const [isDirty, setIsDirty] = useState(false);

  const value = useMemo(
    () => ({
      activeChapterKey,
      setActiveChapterKey,
      panelTab,
      setPanelTab,
      isDirty,
      setIsDirty,
    }),
    [activeChapterKey, panelTab, isDirty],
  );

  return <DocumentModeContext.Provider value={value}>{children}</DocumentModeContext.Provider>;
}

export function useDocumentMode() {
  const ctx = useContext(DocumentModeContext);
  if (!ctx) {
    throw new Error("useDocumentMode must be used within DocumentModeProvider");
  }
  return ctx;
}
