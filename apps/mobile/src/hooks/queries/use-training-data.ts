/**
 * Fetches training data for the current employee: protocol assignments,
 * procedures, and completed confirmations.
 *
 * protocol_assignment links a profile to a protocol with status tracking.
 * Procedures are fetched via the protocol's linked procedures.
 * Confirmations (signed certificates) come from confirmation_signature.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useWorkspaceStore } from "@/hooks/stores/use-workspace-store";
import type { Database } from "@smartout/supabase/database.types";

type ProtocolAssignmentRow = Database["public"]["Tables"]["protocol_assignment"]["Row"];
type ProtocolRow = Database["public"]["Tables"]["protocol"]["Row"];
type ProcedureRow = Database["public"]["Tables"]["procedure"]["Row"];

/** A protocol assignment enriched with the protocol's name and description */
export type TrainingCourse = ProtocolAssignmentRow & {
  protocol: Pick<ProtocolRow, "name" | "description" | "status"> | null;
};

/** A procedure with its parent protocol name for context */
export type TrainingProcedure = ProcedureRow & {
  protocol: Pick<ProtocolRow, "name"> | null;
};

/** A completed confirmation signature with the confirmation name */
export type TrainingCertificate = {
  id: string;
  confirmation_name: string;
  signed_at: string;
  confirmation_id: string;
};

export type TrainingData = {
  courses: TrainingCourse[];
  procedures: TrainingProcedure[];
  certificates: TrainingCertificate[];
  readinessPercent: number;
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

async function fetchTrainingData(selectedProfileId: string | null): Promise<TrainingData> {
  const profileId = await resolveProfileId(selectedProfileId);

  // Run all queries in parallel — they're independent
  const [assignmentsResult, proceduresResult, certificatesResult] = await Promise.all([
    // 1. Protocol assignments for this profile (courses)
    supabase
      .from("protocol_assignment")
      .select("*, protocol:protocol_id(name, description, status)")
      .eq("profile_id", profileId)
      .order("assigned_at", { ascending: false }),

    // 2. Active procedures from protocols assigned to this profile
    supabase
      .from("procedure")
      .select("*, protocol:protocol_id(name)")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),

    // 3. Completed confirmations (certificates) for this profile
    supabase
      .from("confirmation_signature")
      .select("id, signed_at, confirmation_id, confirmation:confirmation_id(name)")
      .eq("profile_id", profileId)
      .order("signed_at", { ascending: false }),
  ]);

  if (assignmentsResult.error) throw assignmentsResult.error;
  if (proceduresResult.error) throw proceduresResult.error;
  if (certificatesResult.error) throw certificatesResult.error;

  const courses = (assignmentsResult.data ?? []) as unknown as TrainingCourse[];

  // Filter procedures to only those from protocols assigned to this profile
  const assignedProtocolIds = new Set(courses.map((c) => c.protocol_id));
  const allProcedures = (proceduresResult.data ?? []) as unknown as TrainingProcedure[];
  const procedures = allProcedures.filter((p) => assignedProtocolIds.has(p.protocol_id));

  const certificates: TrainingCertificate[] = (certificatesResult.data ?? []).map((row) => {
    const r = row as unknown as {
      id: string;
      signed_at: string;
      confirmation_id: string;
      confirmation: { name: string } | null;
    };
    return {
      id: r.id,
      confirmation_name: r.confirmation?.name ?? "Sertifikat",
      signed_at: r.signed_at,
      confirmation_id: r.confirmation_id,
    };
  });

  // Calculate readiness: completed / total assignments
  const total = courses.length;
  const completed = courses.filter((c) => c.status === "completed").length;
  const readinessPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return { courses, procedures, certificates, readinessPercent };
}

/**
 * Hook: returns training data for the current employee.
 * Includes protocol assignments (courses), procedures, and certificates.
 */
export function useTrainingData() {
  const selectedProfileId = useWorkspaceStore((s) => s.selectedProfileId);

  return useQuery<TrainingData>({
    queryKey: ["training-data", selectedProfileId],
    queryFn: () => fetchTrainingData(selectedProfileId),
    staleTime: STALE_TIME_MS,
    retry: 1,
  });
}
