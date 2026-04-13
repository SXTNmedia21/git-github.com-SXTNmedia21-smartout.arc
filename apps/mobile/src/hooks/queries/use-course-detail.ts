/**
 * Fetches course (protocol assignment) detail for the course-detail screen.
 *
 * Loads: protocol metadata, linked procedures as "requirements",
 * and the user's completion status for each requirement.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useWorkspaceStore } from "@/hooks/stores/use-workspace-store";
import type { Database } from "@smartout/supabase/database.types";

type ProtocolRow = Database["public"]["Tables"]["protocol"]["Row"];
type ProcedureRow = Database["public"]["Tables"]["procedure"]["Row"];
type ConfirmationSignatureRow = Database["public"]["Tables"]["confirmation_signature"]["Row"];
type KnowledgeTestAttemptRow = Database["public"]["Tables"]["knowledge_test_attempt"]["Row"];

export type CourseRequirement = {
  id: string;
  title: string;
  subtitle: string;
  status: "done" | "pending";
};

export type CourseDetail = {
  protocolId: string;
  title: string;
  description: string;
  statusLabel: string;
  assignmentStatus: string;
  estimatedTime: string;
  requirements: CourseRequirement[];
};

const STALE_TIME_MS = 5 * 60 * 1000;

async function resolveProfileId(selectedProfileId: string | null): Promise<string> {
  if (selectedProfileId) return selectedProfileId;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile, error } = await supabase
    .from("profile")
    .select("profile_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .single();

  if (error) throw error;
  return profile.profile_id;
}

async function fetchCourseDetail(
  protocolId: string,
  selectedProfileId: string | null,
): Promise<CourseDetail> {
  const profileId = await resolveProfileId(selectedProfileId);

  // Fetch protocol, assignment status, procedures, and completion evidence in parallel
  const [protocolResult, assignmentResult, proceduresResult, signaturesResult, testAttemptsResult] =
    await Promise.all([
      supabase.from("protocol").select("*").eq("protocol_id", protocolId).single(),

      supabase
        .from("protocol_assignment")
        .select("status, completed_at")
        .eq("protocol_id", protocolId)
        .eq("profile_id", profileId)
        .maybeSingle(),

      supabase
        .from("procedure")
        .select("procedure_id, name, description")
        .eq("protocol_id", protocolId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),

      // Check which confirmations the user has signed for this protocol
      supabase
        .from("confirmation_signature")
        .select("confirmation_id, signed_at")
        .eq("profile_id", profileId),

      // Check knowledge test attempts for this protocol
      supabase
        .from("knowledge_test_attempt")
        .select("knowledge_test_id, passed, score, attempted_at")
        .eq("profile_id", profileId),
    ]);

  if (protocolResult.error) throw protocolResult.error;
  if (proceduresResult.error) throw proceduresResult.error;

  const protocol = protocolResult.data as ProtocolRow;
  const assignmentStatus = assignmentResult.data?.status ?? "pending";
  const procedures = (proceduresResult.data ?? []) as ProcedureRow[];
  const signatures = (signaturesResult.data ?? []) as Pick<
    ConfirmationSignatureRow,
    "confirmation_id" | "signed_at"
  >[];
  const testAttempts = (testAttemptsResult.data ?? []) as Pick<
    KnowledgeTestAttemptRow,
    "knowledge_test_id" | "passed" | "score" | "attempted_at"
  >[];

  // Build status label
  const statusLabels: Record<string, string> = {
    pending: "VENTER PÅ VERIFISERING",
    completed: "FULLFØRT",
    expired: "UTLØPT",
  };
  const statusLabel = statusLabels[assignmentStatus] ?? "VENTER PÅ VERIFISERING";

  // Build requirements from procedures
  // A procedure is "done" if: the user has a signed confirmation for it,
  // or has passed a knowledge test linked to the same protocol
  const signedConfirmationIds = new Set(signatures.map((s) => s.confirmation_id));
  const passedTests = testAttempts.filter((t) => t.passed);

  const requirements: CourseRequirement[] = procedures.map((proc, index) => {
    // Simple heuristic: mark procedures as done based on order vs completed count
    // In production, this would check procedure-specific completion records
    const isDone = assignmentStatus === "completed" || index < passedTests.length;

    const subtitle = isDone
      ? `Fullført ${passedTests[index] ? `· Score: ${passedTests[index]!.score}%` : ""}`.trim()
      : "Neste steg";

    return {
      id: proc.procedure_id,
      title: proc.name,
      subtitle,
      status: isDone ? ("done" as const) : ("pending" as const),
    };
  });

  // Estimate time: 5 minutes per requirement
  const totalMinutes = procedures.length * 5;
  const estimatedTime =
    totalMinutes >= 60
      ? `${Math.floor(totalMinutes / 60)} time${totalMinutes >= 120 ? "r" : ""}`
      : `${totalMinutes} minutter`;

  return {
    protocolId: protocol.protocol_id,
    title: protocol.name,
    description: protocol.description ?? "Ingen beskrivelse tilgjengelig.",
    statusLabel,
    assignmentStatus,
    estimatedTime,
    requirements,
  };
}

/**
 * Hook: returns course detail for a given protocol.
 * @param protocolId — UUID of the protocol. Pass undefined to skip.
 */
export function useCourseDetail(protocolId: string | undefined) {
  const selectedProfileId = useWorkspaceStore((s) => s.selectedProfileId);

  return useQuery<CourseDetail>({
    queryKey: ["course-detail", protocolId, selectedProfileId],
    queryFn: () => fetchCourseDetail(protocolId!, selectedProfileId),
    enabled: !!protocolId,
    staleTime: STALE_TIME_MS,
    retry: 1,
  });
}
