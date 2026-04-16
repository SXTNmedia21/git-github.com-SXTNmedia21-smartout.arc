"use client";

import dynamic from "next/dynamic";
import { withEntrance } from "@smartout/ui";
import { EditorSkeleton } from "@/components/ui/editor-skeleton";
import { DocumentModePanel } from "./document-mode-panel";

const DocumentModeCanvas = dynamic(
  () =>
    import("./document-mode-canvas").then((m) => ({
      default: withEntrance(m.DocumentModeCanvas),
    })),
  { ssr: false, loading: () => <EditorSkeleton className="flex-1 p-6" /> },
);

export function DocumentModeShell({ isDark }: { isDark: boolean }) {
  return (
    <div className="flex min-h-0 flex-1" data-document-mode>
      <DocumentModeCanvas isDark={isDark} />
      <DocumentModePanel isDark={isDark} />
    </div>
  );
}
