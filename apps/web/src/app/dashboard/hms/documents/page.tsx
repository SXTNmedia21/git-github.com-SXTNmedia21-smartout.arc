"use client";

import { useState } from "react";
import { DocumentBrowser, type DocumentSelection } from "../_components/DocumentBrowser";
import { DocumentViewer } from "../_components/DocumentViewer";

export default function DocumentsPage() {
  const [selection, setSelection] = useState<DocumentSelection | null>(null);

  return (
    <div className="border-border flex min-h-[600px] gap-0 overflow-hidden rounded-xl border">
      <DocumentBrowser onSelect={setSelection} selected={selection} />
      <DocumentViewer selection={selection} />
    </div>
  );
}
