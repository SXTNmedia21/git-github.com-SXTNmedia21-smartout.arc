"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { Loader2 } from "lucide-react";
import { LearnFlow } from "./LearnFlow";

type Props = {
  procedureId: string;
};

/** Checks if procedure exists and renders LearnFlow for employees */
export function ProcedureExperience({ procedureId }: Props) {
  const { workspace } = useWorkspace();
  const { data: procedure, isLoading } = useQuery({
    queryKey: ["hms", "procedure-exists", procedureId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("procedure")
        .select("procedure_id, name, description")
        .eq("procedure_id", procedureId)
        .eq("workspace_id", workspace.workspace_id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!procedure) {
    return (
      <div className="border-border rounded-xl border-2 border-dashed p-8 text-center">
        <p className="text-muted-foreground text-sm">Prosedyre ikke funnet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-foreground text-2xl font-bold">{procedure.name}</h1>
        {procedure.description && (
          <p className="text-muted-foreground mt-1 text-sm">{procedure.description}</p>
        )}
      </div>
      <LearnFlow procedureId={procedureId} />
    </div>
  );
}
