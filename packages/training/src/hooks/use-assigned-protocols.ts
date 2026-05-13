// packages/training/src/hooks/use-assigned-protocols.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssignedProtocol } from "../types";
import { trainingKeys } from "./keys";

type UseAssignedProtocolsOptions = {
  profileId: string | null;
  /**
   * Caller is responsible for waiting until workspace context is hydrated.
   * Widened from `string` to `string | null | undefined` so mobile callers
   * can pass the raw `profile?.workspace_id` without an empty-string fallback
   * (ADR-0134 / L-0083). The query is gated on both ids being truthy.
   */
  workspaceId: string | null | undefined;
  supabase: SupabaseClient;
};

export function useAssignedProtocols({
  profileId,
  workspaceId,
  supabase,
}: UseAssignedProtocolsOptions) {
  return useQuery({
    queryKey: trainingKeys.assignedProtocols(profileId ?? null),
    enabled: !!profileId && !!workspaceId,
    staleTime: 3 * 60 * 1000,
    queryFn: async (): Promise<AssignedProtocol[]> => {
      // 1. Fetch assignments for this profile, now scoped by workspace_id directly.
      // Non-null casts are safe because the `enabled` gate above guarantees
      // both ids are truthy before the queryFn runs.
      const { data: assignments, error: assignError } = await supabase
        .from("protocol_assignment")
        .select(
          "assignment_id, protocol_id, status, assigned_at, completed_at, assigned_via, protocol_version, protocol:protocol_id(name, description)",
        )
        .eq("profile_id", profileId!)
        .eq("workspace_id", workspaceId!);

      if (assignError) throw assignError;
      if (!assignments || assignments.length === 0) return [];

      const protocolIds = assignments.map((a) => a.protocol_id);

      // 2-7: Fetch procedures, steps, completions, tests, attempts, confirmations, signatures in parallel
      const [
        proceduresRes,
        completionsRes,
        testsRes,
        attemptsRes,
        confirmationsRes,
        signaturesRes,
      ] = await Promise.all([
        supabase
          .from("procedure")
          .select(
            "procedure_id, name, description, sort_order, protocol_id, procedure_step(step_id, title, description, step_order, is_required, estimated_minutes, training_content, media_urls)",
          )
          .in("protocol_id", protocolIds)
          .eq("is_active", true)
          .order("sort_order"),
        supabase
          .from("procedure_step_completion")
          .select("procedure_step_id, completed_at, protocol_assignment_id")
          .eq("profile_id", profileId!)
          .eq("workspace_id", workspaceId),
        supabase
          .from("knowledge_test")
          .select(
            "knowledge_test_id, name, description, pass_threshold, max_attempts, questions, protocol_id",
          )
          .in("protocol_id", protocolIds)
          .eq("is_active", true),
        supabase
          .from("knowledge_test_attempt")
          .select("knowledge_test_id, score, passed")
          .eq("profile_id", profileId!)
          .eq("workspace_id", workspaceId),
        supabase
          .from("confirmation")
          .select("confirmation_id, name, confirmation_text, requires_signature, protocol_id")
          .in("protocol_id", protocolIds)
          .eq("is_active", true),
        supabase
          .from("confirmation_signature")
          .select("confirmation_id, signed_at")
          .eq("profile_id", profileId!)
          .eq("workspace_id", workspaceId),
      ]);

      if (proceduresRes.error) throw proceduresRes.error;
      if (completionsRes.error) throw completionsRes.error;
      if (testsRes.error) throw testsRes.error;
      if (attemptsRes.error) throw attemptsRes.error;
      if (confirmationsRes.error) throw confirmationsRes.error;
      if (signaturesRes.error) throw signaturesRes.error;

      // Build lookup maps
      const completionSet = new Set((completionsRes.data ?? []).map((c) => c.procedure_step_id));
      const completionDates = new Map(
        (completionsRes.data ?? []).map((c) => [c.procedure_step_id, c.completed_at]),
      );

      const attemptMap = new Map<
        string,
        { passed: boolean; bestScore: number | null; count: number }
      >();
      for (const a of attemptsRes.data ?? []) {
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

      const signatureMap = new Map(
        (signaturesRes.data ?? []).map((s) => [s.confirmation_id, s.signed_at]),
      );

      // Build result
      return assignments.map((assignment) => {
        const proto = assignment.protocol as unknown as {
          name: string;
          description: string | null;
        };

        const procs = (proceduresRes.data ?? [])
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
                training_content: string | null;
                media_urls: unknown;
              }>
            )
              .sort((a, b) => a.step_order - b.step_order)
              .map((s) => ({
                stepId: s.step_id,
                title: s.title,
                description: s.description,
                stepOrder: s.step_order,
                isRequired: s.is_required,
                estimatedMinutes: s.estimated_minutes,
                trainingContent: s.training_content,
                mediaUrls: s.media_urls as Array<{
                  type: string;
                  url: string;
                  caption?: string;
                }> | null,
                isCompleted: completionSet.has(s.step_id),
                completedAt: completionDates.get(s.step_id) ?? null,
              }));

            return {
              procedureId: p.procedure_id,
              name: p.name,
              description: p.description,
              sortOrder: p.sort_order,
              steps,
            };
          });

        const protoTests = (testsRes.data ?? [])
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

        const protoConfs = (confirmationsRes.data ?? [])
          .filter((c) => c.protocol_id === assignment.protocol_id)
          .map((c) => ({
            confirmationId: c.confirmation_id,
            name: c.name,
            confirmationText: c.confirmation_text,
            requiresSignature: c.requires_signature,
            isSigned: signatureMap.has(c.confirmation_id),
            signedAt: signatureMap.get(c.confirmation_id) ?? null,
          }));

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
          assignmentStatus: assignment.status as AssignedProtocol["assignmentStatus"],
          assignedAt: assignment.assigned_at,
          completedAt: assignment.completed_at,
          assignedVia: (assignment as Record<string, unknown>).assigned_via as string | null,
          protocolVersion: (assignment as Record<string, unknown>).protocol_version as
            | string
            | null,
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
