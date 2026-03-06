"use client";

import { DocumentModeProvider } from "./document-mode-context";
import { DocumentModeCanvas } from "./document-mode-canvas";
import { DocumentModePanel } from "./document-mode-panel";

export function DocumentModeShell({ isDark }: { isDark: boolean }) {
  return (
    <DocumentModeProvider>
      <div className="flex min-h-0 flex-1" data-document-mode>
        <DocumentModeCanvas isDark={isDark} />
        <DocumentModePanel isDark={isDark} />
      </div>
    </DocumentModeProvider>
  );
}
