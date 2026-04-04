"use client";

import { useContext, useState } from "react";
import { LayoutDashboard, ListOrdered, ClipboardCheck, PenTool, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useWorkspace } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { Badge } from "@/components/ui/badge";
import { useProcedureSteps } from "../_hooks/use-procedure-steps";

type Tab = "overview" | "steps" | "quiz" | "confirmation";

const TABS: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Oversikt", icon: LayoutDashboard },
  { id: "steps", label: "Steg", icon: ListOrdered },
  { id: "quiz", label: "Quiz", icon: ClipboardCheck },
  { id: "confirmation", label: "Bekreftelse", icon: PenTool },
];

function useProcedureMeta(procedureId: string) {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: ["hms", "procedure-meta", procedureId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("procedure")
        .select(
          "procedure_id, name, description, is_active, updated_at, protocol:protocol_id(name, protocol_id, policy:policy_id(name, policy_type))",
        )
        .eq("procedure_id", procedureId)
        .eq("workspace_id", workspace.workspace_id)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function ProcedureDetailTabs({ procedureId }: { procedureId: string }) {
  const { isDark } = useContext(DashboardContext);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const { data: meta, isLoading: metaLoading } = useProcedureMeta(procedureId);
  const { data: steps, isLoading: stepsLoading } = useProcedureSteps(procedureId);

  if (metaLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!meta) {
    return (
      <div className="border-border rounded-xl border-2 border-dashed p-8 text-center">
        <p className="text-muted-foreground text-sm">Prosedyre ikke funnet.</p>
      </div>
    );
  }

  const protocol = meta.protocol as unknown as { // SAFETY: Supabase join returns union type; runtime shape matches the cast
    name: string;
    protocol_id: string;
    policy: { name: string; policy_type: string } | null;
  } | null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="mb-1 flex items-center gap-2">
          {protocol?.policy && (
            <Badge variant="outline" className="text-xs">
              {protocol.policy.policy_type}
            </Badge>
          )}
          <Badge variant={meta.is_active ? "default" : "secondary"}>
            {meta.is_active ? "Aktiv" : "Inaktiv"}
          </Badge>
        </div>
        <h1 className="text-foreground text-2xl font-bold">{meta.name}</h1>
        {meta.description && (
          <p className="text-muted-foreground mt-1 text-sm">{meta.description}</p>
        )}
        {protocol && (
          <p className="text-muted-foreground mt-1 text-xs">
            Protokoll: {protocol.name}
            {protocol.policy && ` | Policy: ${protocol.policy.name}`}
          </p>
        )}
      </div>

      {/* Tab navigation */}
      <div
        className={`flex gap-1 rounded-xl border p-1 ${isDark ? "border-zinc-800 bg-zinc-900/50" : "border-border bg-muted/50"}`}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                isActive
                  ? "bg-background text-foreground shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <InfoCard label="Steg" value={steps?.length ?? 0} />
          <InfoCard
            label="Sist oppdatert"
            value={new Date(meta.updated_at).toLocaleDateString("nb-NO")}
          />
        </div>
      )}

      {activeTab === "steps" && (
        <div className="space-y-3">
          {stepsLoading ? (
            <Loader2 className="text-muted-foreground mx-auto h-5 w-5 animate-spin" />
          ) : !steps || steps.length === 0 ? (
            <p className="text-muted-foreground text-center text-sm">Ingen steg definert.</p>
          ) : (
            steps.map((step, i) => (
              <div key={step.stepId} className="border-border rounded-lg border p-4">
                <div className="mb-1 flex items-center gap-2">
                  <span className="bg-muted text-muted-foreground flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold">
                    {i + 1}
                  </span>
                  <h3 className="text-foreground font-semibold">{step.title}</h3>
                  {step.isRequired && (
                    <Badge variant="outline" className="text-[10px]">
                      Pakrevd
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground ml-8 text-sm">{step.description}</p>
                {step.trainingContent && (
                  <div className="mt-2 ml-8 rounded-md border border-blue-500/20 bg-blue-500/5 p-3">
                    <p className="mb-1 text-[10px] font-medium text-blue-600">
                      Opplaeringsinnhold:
                    </p>
                    <div className="prose prose-sm dark:prose-invert max-w-none text-xs">
                      <div dangerouslySetInnerHTML={{ __html: step.trainingContent }} />
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "quiz" && (
        <div className="border-border rounded-xl border-2 border-dashed p-8 text-center">
          <ClipboardCheck className="text-muted-foreground mx-auto mb-3 h-8 w-8" />
          <p className="text-muted-foreground text-sm">
            Kunnskapstester vises her. Kobles i neste iterasjon.
          </p>
        </div>
      )}

      {activeTab === "confirmation" && (
        <div className="border-border rounded-xl border-2 border-dashed p-8 text-center">
          <PenTool className="text-muted-foreground mx-auto mb-3 h-8 w-8" />
          <p className="text-muted-foreground text-sm">
            Bekreftelser vises her. Kobles i neste iterasjon.
          </p>
        </div>
      )}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border-border rounded-lg border p-4">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <p className="text-foreground text-lg font-bold">{value}</p>
    </div>
  );
}
