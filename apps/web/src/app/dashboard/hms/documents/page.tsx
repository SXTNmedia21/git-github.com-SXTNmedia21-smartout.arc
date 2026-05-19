"use client";

import { useContext, useEffect, useRef, useState } from "react";
import { emit, nonEmpty } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { DocumentBrowser, type DocumentSelection } from "../_components/DocumentBrowser";
import { DocumentViewer } from "../_components/DocumentViewer";
import { HmsDocumentsToolsBridge } from "./_tools/hms-documents-tools-bridge";

export default function DocumentsPage() {
  const { workspaceData, profileId } = useContext(DashboardContext);
  const [selection, setSelection] = useState<DocumentSelection | null>(null);

  const workspaceId = workspaceData?.workspace_id ?? null;

  // Emit `hms.documents.opened` once workspace AND profile are resolved (L-0177).
  // Entity-only event: no data fields required per registry definition.
  const documentsOpenedRef = useRef(false);
  useEffect(() => {
    if (!workspaceId || !profileId || documentsOpenedRef.current) return;
    documentsOpenedRef.current = true;
    void emit({
      event: "hms.documents.opened",
      workspace_id: nonEmpty(workspaceId, "workspace_id"),
      actor_id: nonEmpty(profileId, "actor_id"),
      properties: {
        entity: {
          entity_type: "workspace",
          entity_id: workspaceId,
          entity_label: "HMS Documents",
        },
      },
    });
  }, [workspaceId, profileId]);

  return (
    <>
      <HmsDocumentsToolsBridge selection={selection} clearSelection={() => setSelection(null)} />
      <div className="border-border flex min-h-[600px] gap-0 overflow-hidden rounded-xl border">
        <DocumentBrowser onSelect={setSelection} selected={selection} />
        <DocumentViewer selection={selection} />
      </div>
    </>
  );
}
