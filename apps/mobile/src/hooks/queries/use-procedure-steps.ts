/**
 * Fetches procedure steps and knowledge test for a given procedure.
 *
 * Used by FlowPlayer to render the manual steps and quiz phases.
 * Steps come from procedure_step (ordered by step_order).
 * Quiz comes from knowledge_test (linked via protocol_id on the parent procedure).
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Database } from "@smartout/supabase/database.types";

type ProcedureStepRow = Database["public"]["Tables"]["procedure_step"]["Row"];
type KnowledgeTestRow = Database["public"]["Tables"]["knowledge_test"]["Row"];
type ProcedureRow = Database["public"]["Tables"]["procedure"]["Row"];

export type ProcedureWithSteps = {
  procedure: ProcedureRow;
  steps: ProcedureStepRow[];
  knowledgeTest: KnowledgeTestRow | null;
};

async function fetchProcedureSteps(procedureId: string): Promise<ProcedureWithSteps> {
  // Fetch procedure metadata (includes protocol_id for knowledge test lookup)
  const { data: procedure, error: procError } = await supabase
    .from("procedure")
    .select("*")
    .eq("procedure_id", procedureId)
    .single();

  if (procError) throw procError;

  // Fetch steps ordered by step_order
  const { data: steps, error: stepsError } = await supabase
    .from("procedure_step")
    .select("*")
    .eq("procedure_id", procedureId)
    .order("step_order", { ascending: true });

  if (stepsError) throw stepsError;

  // protocol_id is nullable in schema — orphan procedures skip the knowledge-test lookup
  // (no protocol = no test to bind to). L-0177 fail-fast not warranted here; reader path.
  let knowledgeTest: KnowledgeTestRow | null = null;
  if (procedure.protocol_id) {
    const { data } = await supabase
      .from("knowledge_test")
      .select("*")
      .eq("protocol_id", procedure.protocol_id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    knowledgeTest = data ?? null;
  }

  return {
    procedure,
    steps: steps ?? [],
    knowledgeTest,
  };
}

/**
 * Hook: returns procedure steps + knowledge test for the FlowPlayer.
 *
 * @param procedureId — UUID of the procedure to load. Pass null/undefined to skip.
 */
export function useProcedureSteps(procedureId: string | undefined) {
  return useQuery<ProcedureWithSteps>({
    queryKey: ["procedure-steps", procedureId],
    queryFn: () => fetchProcedureSteps(procedureId!),
    enabled: !!procedureId,
    staleTime: 5 * 60 * 1000,
  });
}
