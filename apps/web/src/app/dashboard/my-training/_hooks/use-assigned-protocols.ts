"use client";

/**
 * TanStack Query hook for fetching protocols assigned to the current employee.
 * Includes real completion data from tracking tables.
 * Connected to: ProtocolList component
 */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";

export type AssignedProtocol = {
  assignmentId: string;
  protocolId: string;
  protocolName: string;
  protocolDescription: string | null;
  assignmentStatus: "pending" | "completed" | "expired";
  assignedAt: string;
  completedAt: string | null;
  procedures: AssignedProcedure[];
  knowledgeTests: AssignedKnowledgeTest[];
  confirmations: AssignedConfirmation[];
  progress: {
    totalSteps: number;
    completedSteps: number;
    percent: number;
  };
};

export type AssignedProcedure = {
  procedureId: string;
  name: string;
  description: string | null;
  sortOrder: number | null;
  steps: ProcedureStepWithStatus[];
};

export type ProcedureStepWithStatus = {
  stepId: string;
  title: string;
  description: string;
  stepOrder: number;
  isRequired: boolean;
  estimatedMinutes: number | null;
  isCompleted: boolean;
  completedAt: string | null;
};

export type AssignedKnowledgeTest = {
  testId: string;
  name: string;
  description: string | null;
  passThreshold: number;
  maxAttempts: number | null;
  questions: unknown;
  passed: boolean;
  bestScore: number | null;
  attemptCount: number;
};

export type AssignedConfirmation = {
  confirmationId: string;
  name: string;
  confirmationText: string;
  requiresSignature: boolean;
  isSigned: boolean;
  signedAt: string | null;
};

const myTrainingKeys = {
  assignedProtocols: (profileId: string) =>
    ["my-training", "assigned-protocols", profileId] as const,
};

export { myTrainingKeys };

export function useAssignedProtocols(profileId: string | null) {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  return useQuery({
    queryKey: myTrainingKeys.assignedProtocols(profileId ?? ""),
    enabled: !!profileId,
    staleTime: 3 * 60 * 1000,
    queryFn: async (): Promise<AssignedProtocol[]> => {
      const supabase = createClient();

      // 1. Fetch assignments for this profile
      const { data: assignments, error: assignError } = await supabase
        .from("protocol_assignment")
        .select(
          "assignment_id, protocol_id, status, assigned_at, completed_at, protocol:protocol_id(name, description, workspace_id)",
        )
        .eq("profile_id", profileId!);

      if (assignError) throw assignError;
      if (!assignments || assignments.length === 0) return [];

      // Filter to current workspace protocols
      const wsAssignments = assignments.filter((a) => {
        const proto = a.protocol as unknown as { workspace_id: string } | null; // SAFETY: Supabase join returns union type; runtime shape matches the cast
        return proto?.workspace_id === workspaceId;
      });

      if (wsAssignments.length === 0) return [];

      const protocolIds = wsAssignments.map((a) => a.protocol_id);
      // 2. Fetch procedures + steps
      const { data: procedures, error: procError } = await supabase
        .from("procedure")
        .select(
          "procedure_id, name, description, sort_order, protocol_id, procedure_step(step_id, title, description, step_order, is_required, estimated_minutes)",
        )
        .in("protocol_id", protocolIds)
        .eq("is_active", true)
        .order("sort_order");

      if (procError) throw procError;

      // 3. Fetch step completions for this profile
      const { data: completions, error: compError } = await supabase
        .from("procedure_step_completion")
        .select("procedure_step_id, completed_at, protocol_assignment_id")
        .eq("profile_id", profileId!)
        .eq("workspace_id", workspaceId);

      if (compError) throw compError;

      const completionMap = new Map<string, { completedAt: string; assignmentId: string | null }>();
      for (const c of completions ?? []) {
        completionMap.set(c.procedure_step_id, {
          completedAt: c.completed_at,
          assignmentId: c.protocol_assignment_id,
        });
      }

      // 4. Fetch knowledge tests
      const { data: tests, error: testError } = await supabase
        .from("knowledge_test")
        .select(
          "knowledge_test_id, name, description, pass_threshold, max_attempts, questions, protocol_id",
        )
        .in("protocol_id", protocolIds)
        .eq("is_active", true);

      if (testError) throw testError;

      // 5. Fetch test attempts for this profile
      const { data: attempts, error: attemptError } = await supabase
        .from("knowledge_test_attempt")
        .select("knowledge_test_id, score, passed, protocol_assignment_id")
        .eq("profile_id", profileId!)
        .eq("workspace_id", workspaceId);

      if (attemptError) throw attemptError;

      // Build attempt map: testId -> { passed, bestScore, count }
      const attemptMap = new Map<
        string,
        { passed: boolean; bestScore: number | null; count: number }
      >();
      for (const a of attempts ?? []) {
        const existing = attemptMap.get(a.knowledge_test_id) ?? {
          passed: false,
          bestScore: null,
          count: 0,
        };
        existing.count++;
        if (a.passed) existing.passed = true;
        if (a.score !== null && (existing.bestScore === null || a.score > existing.bestScore)) {
          existing.bestScore = a.score;
        }
        attemptMap.set(a.knowledge_test_id, existing);
      }

      // 6. Fetch confirmations
      const { data: confirmations, error: confError } = await supabase
        .from("confirmation")
        .select("confirmation_id, name, confirmation_text, requires_signature, protocol_id")
        .in("protocol_id", protocolIds)
        .eq("is_active", true);

      if (confError) throw confError;

      // 7. Fetch signatures for this profile
      const { data: signatures, error: sigError } = await supabase
        .from("confirmation_signature")
        .select("confirmation_id, signed_at, protocol_assignment_id")
        .eq("profile_id", profileId!)
        .eq("workspace_id", workspaceId);

      if (sigError) throw sigError;

      const signatureMap = new Map<string, { signedAt: string; assignmentId: string | null }>();
      for (const s of signatures ?? []) {
        signatureMap.set(s.confirmation_id, {
          signedAt: s.signed_at,
          assignmentId: s.protocol_assignment_id,
        });
      }

      // 8. Build result
      return wsAssignments.map((assignment) => {
        const proto = assignment.protocol as unknown as { // SAFETY: Supabase join returns union type; runtime shape matches the cast
          name: string;
          description: string | null;
        };

        // Procedures for this protocol
        const procs = (procedures ?? [])
          .filter((p) => p.protocol_id === assignment.protocol_id)
          .map((p) => {
            const steps = (
              (p.procedure_step ?? []) as Array<{
                step_id: string;
                title: string;
                description: string;
                step_order: number;
                is_required: boolean;
                estimated_minutes: number | null;
              }>
            )
              .sort((a, b) => a.step_order - b.step_order)
              .map((s) => {
                const comp = completionMap.get(s.step_id);
                return {
                  stepId: s.step_id,
                  title: s.title,
                  description: s.description,
                  stepOrder: s.step_order,
                  isRequired: s.is_required,
                  estimatedMinutes: s.estimated_minutes,
                  isCompleted: !!comp,
                  completedAt: comp?.completedAt ?? null,
                };
              });

            return {
              procedureId: p.procedure_id,
              name: p.name,
              description: p.description,
              sortOrder: p.sort_order,
              steps,
            };
          });

        // Tests for this protocol
        const protoTests = (tests ?? [])
          .filter((t) => t.protocol_id === assignment.protocol_id)
          .map((t) => {
            const att = attemptMap.get(t.knowledge_test_id);
            return {
              testId: t.knowledge_test_id,
              name: t.name,
              description: t.description,
              passThreshold: t.pass_threshold,
              maxAttempts: t.max_attempts,
              questions: t.questions,
              passed: att?.passed ?? false,
              bestScore: att?.bestScore ?? null,
              attemptCount: att?.count ?? 0,
            };
          });

        // Confirmations for this protocol
        const protoConfs = (confirmations ?? [])
          .filter((c) => c.protocol_id === assignment.protocol_id)
          .map((c) => {
            const sig = signatureMap.get(c.confirmation_id);
            return {
              confirmationId: c.confirmation_id,
              name: c.name,
              confirmationText: c.confirmation_text,
              requiresSignature: c.requires_signature,
              isSigned: !!sig,
              signedAt: sig?.signedAt ?? null,
            };
          });

        // Calculate progress
        const totalSteps =
          procs.reduce((sum, p) => sum + p.steps.length, 0) + protoTests.length + protoConfs.length;
        const completedSteps =
          procs.reduce((sum, p) => sum + p.steps.filter((s) => s.isCompleted).length, 0) +
          protoTests.filter((t) => t.passed).length +
          protoConfs.filter((c) => c.isSigned).length;

        return {
          assignmentId: assignment.assignment_id,
          protocolId: assignment.protocol_id,
          protocolName: proto.name,
          protocolDescription: proto.description,
          assignmentStatus: assignment.status as "pending" | "completed" | "expired",
          assignedAt: assignment.assigned_at,
          completedAt: assignment.completed_at,
          procedures: procs,
          knowledgeTests: protoTests,
          confirmations: protoConfs,
          progress: {
            totalSteps,
            completedSteps,
            percent: totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 100,
          },
        };
      });
    },
  });
}
