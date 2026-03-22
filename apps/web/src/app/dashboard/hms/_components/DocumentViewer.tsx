"use client";

import { useContext } from "react";
import Link from "next/link";
import { FileText, GraduationCap, AlertTriangle, Sparkles, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import type { DocumentSelection } from "./DocumentBrowser";

type Props = {
  selection: DocumentSelection | null;
};

/** Fetches procedure with its steps for rendering */
function useProcedureDetail(procedureId: string | undefined) {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: ["hms", "procedure-detail", procedureId],
    enabled: !!procedureId,
    staleTime: 3 * 60 * 1000,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("procedure")
        .select(
          "procedure_id, name, description, is_active, updated_at, procedure_step(step_id, title, description, step_order, is_required, estimated_minutes)",
        )
        .eq("procedure_id", procedureId!)
        .eq("workspace_id", workspace.workspace_id)
        .single();

      if (error) throw error;
      return data;
    },
  });
}

/** Fetches policy or protocol metadata */
function useDocumentMeta(type: "policy" | "protocol", id: string | undefined) {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: ["hms", "doc-meta", type, id],
    enabled: !!id,
    staleTime: 3 * 60 * 1000,
    queryFn: async () => {
      const supabase = createClient();
      if (type === "policy") {
        const { data, error } = await supabase
          .from("policy")
          .select("policy_id, name, statement, policy_type, is_active, updated_at")
          .eq("policy_id", id!)
          .eq("workspace_id", workspace.workspace_id)
          .single();
        if (error) throw error;
        return { ...data, docType: "policy" as const };
      } else {
        const { data, error } = await supabase
          .from("protocol")
          .select("protocol_id, name, description, status, updated_at")
          .eq("protocol_id", id!)
          .eq("workspace_id", workspace.workspace_id)
          .single();
        if (error) throw error;
        return { ...data, docType: "protocol" as const };
      }
    },
  });
}

export function DocumentViewer({ selection }: Props) {
  const { isDark, isAdminMode } = useContext(DashboardContext);

  if (!selection) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
        <FileText className="text-muted-foreground h-12 w-12" />
        <p className="text-muted-foreground text-sm">Velg et dokument fra menyen til venstre.</p>
      </div>
    );
  }

  if (selection.type === "procedure") {
    return <ProcedureView procedureId={selection.id} isAdminMode={isAdminMode} />;
  }

  if (selection.type === "policy" || selection.type === "protocol") {
    return <MetaView type={selection.type} id={selection.id} isAdminMode={isAdminMode} />;
  }

  return null;
}

function ProcedureView({
  procedureId,
  isAdminMode,
}: {
  procedureId: string;
  isAdminMode: boolean;
}) {
  const { data: procedure, isLoading } = useProcedureDetail(procedureId);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!procedure) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground text-sm">Prosedyre ikke funnet.</p>
      </div>
    );
  }

  const steps = (
    procedure.procedure_step as Array<{
      step_id: string;
      title: string;
      description: string;
      step_order: number;
      is_required: boolean;
      estimated_minutes: number | null;
    }>
  ).sort((a, b) => a.step_order - b.step_order);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {/* Header + action bar */}
      <div className="border-b border-inherit p-6">
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-foreground text-xl font-bold">{procedure.name}</h2>
            {procedure.description && (
              <p className="text-muted-foreground mt-1 text-sm">{procedure.description}</p>
            )}
          </div>
          <Badge variant={procedure.is_active ? "default" : "secondary"}>
            {procedure.is_active ? "Aktiv" : "Inaktiv"}
          </Badge>
        </div>
        <ActionBar procedureId={procedureId} isAdminMode={isAdminMode} />
      </div>

      {/* Steps */}
      <div className="flex-1 p-6">
        <ol className="space-y-4">
          {steps.map((step, i) => (
            <li key={step.step_id} className="border-border rounded-lg border p-4">
              <div className="mb-1 flex items-center gap-2">
                <span className="bg-muted text-muted-foreground flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold">
                  {i + 1}
                </span>
                <h3 className="text-foreground font-semibold">{step.title}</h3>
                {step.is_required && (
                  <Badge variant="outline" className="text-[10px]">
                    Pakrevd
                  </Badge>
                )}
                {step.estimated_minutes && (
                  <span className="text-muted-foreground ml-auto text-xs">
                    ~{step.estimated_minutes} min
                  </span>
                )}
              </div>
              <p className="text-muted-foreground ml-8 text-sm">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function MetaView({
  type,
  id,
  isAdminMode,
}: {
  type: "policy" | "protocol";
  id: string;
  isAdminMode: boolean;
}) {
  const { data: doc, isLoading } = useDocumentMeta(type, id);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground text-sm">Dokument ikke funnet.</p>
      </div>
    );
  }

  const name = doc.name;
  const content =
    doc.docType === "policy" ? doc.statement : doc.docType === "protocol" ? doc.description : null;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="border-b border-inherit p-6">
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wider uppercase">
              {type === "policy" ? "Policy" : "Protokoll"}
            </p>
            <h2 className="text-foreground text-xl font-bold">{name}</h2>
          </div>
          <Badge variant="default">
            {"policy_type" in doc ? doc.policy_type : "status" in doc ? doc.status : ""}
          </Badge>
        </div>
      </div>
      <div className="flex-1 p-6">
        {content ? (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <p>{content}</p>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm italic">Ingen beskrivelse.</p>
        )}
      </div>
    </div>
  );
}

function ActionBar({ procedureId, isAdminMode }: { procedureId: string; isAdminMode: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" asChild>
        <Link href={`/dashboard/hms/training?procedure=${procedureId}`}>
          <GraduationCap className="mr-1.5 h-3.5 w-3.5" />
          Start opplaering
        </Link>
      </Button>
      <Button variant="outline" size="sm" asChild>
        <Link href="/dashboard/hms/deviations">
          <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
          Meld avvik
        </Link>
      </Button>
      <Button variant="outline" size="sm" disabled title="Kommer i Phase 4">
        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
        Spor AI
      </Button>
      {isAdminMode && (
        <Button variant="outline" size="sm" asChild>
          <Link href={`/dashboard/hms/procedure/${procedureId}`}>
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            Administrer
          </Link>
        </Button>
      )}
    </div>
  );
}
