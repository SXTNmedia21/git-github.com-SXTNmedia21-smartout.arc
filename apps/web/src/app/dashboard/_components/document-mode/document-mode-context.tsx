"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
  type MutableRefObject,
} from "react";
import type { Editor } from "@tiptap/react";
import type { ChapterKey } from "./chapters";

type PanelTab = "tools" | "actions" | "settings";

type DocumentModeState = {
  activeChapterKey: ChapterKey;
  setActiveChapterKey: (key: ChapterKey) => void;
  panelTab: PanelTab;
  setPanelTab: (tab: PanelTab) => void;
  isDirty: boolean;
  setIsDirty: (val: boolean) => void;
  editorRef: MutableRefObject<Editor | null>;
};

const DocumentModeContext = createContext<DocumentModeState | null>(null);

export function DocumentModeProvider({ children }: { children: ReactNode }) {
  const [activeChapterKey, setActiveChapterKey] = useState<ChapterKey>("identity-mission");
  const [panelTab, setPanelTab] = useState<PanelTab>("tools");
  const [isDirty, setIsDirty] = useState(false);
  const editorRef = useRef<Editor | null>(null);

  const handleSetChapter = useCallback((key: ChapterKey) => {
    setActiveChapterKey(key);
    setIsDirty(false);
  }, []);

  return (
    <DocumentModeContext.Provider
      value={{
        activeChapterKey,
        setActiveChapterKey: handleSetChapter,
        panelTab,
        setPanelTab,
        isDirty,
        setIsDirty,
        editorRef,
      }}
    >
      {children}
    </DocumentModeContext.Provider>
  );
}

export function useDocumentMode() {
  const ctx = useContext(DocumentModeContext);
  if (!ctx) throw new Error("useDocumentMode must be used within DocumentModeProvider");
  return ctx;
}
