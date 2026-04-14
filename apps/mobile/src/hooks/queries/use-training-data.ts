/**
 * Training data hook — thin compatibility wrapper over @smartout/training.
 *
 * Delegates to the shared hooks (useAssignedProtocols, useReadinessScore)
 * and maps the result to the legacy TrainingData shape expected by the
 * training screen. This preserves backwards compatibility while gaining
 * workspace-scoped queries, step-level progress, and shared types.
 *
 * workspace_id is resolved from the profile row (via useMyProfile).
 * profileId comes from useWorkspaceStore (persisted in MMKV).
 */

import { useMemo } from "react";
import { useAssignedProtocols, useReadinessScore } from "@smartout/training";
import type { AssignedProtocol, AssignedConfirmation } from "@smartout/training";
import { supabase } from "@/lib/supabase";
import { useWorkspaceStore } from "@/hooks/stores/use-workspace-store";
import { useMyProfile } from "@/hooks/queries/use-my-profile";

// ── Legacy types (kept for backwards compatibility with training.tsx) ──

/** A protocol assignment in the format the training screen expects */
export type TrainingCourse = {
  assignment_id: string;
  protocol_id: string;
  status: "not_started" | "in_progress" | "completed" | "expired" | "waived";
  assigned_at: string;
  completed_at: string | null;
  assigned_via: string | null;
  protocol_version: string | null;
  protocol: { name: string; description: string | null; status: string } | null;
  progress: { totalSteps: number; completedSteps: number; percent: number };
};

/** A procedure with its parent protocol name for context */
export type TrainingProcedure = {
  procedure_id: string;
  name: string;
  description: string | null;
  protocol_id: string;
  sort_order: number | null;
  created_at: string;
  protocol: { name: string } | null;
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

// ── Mapping functions ──

function mapProtocolToCourse(p: AssignedProtocol): TrainingCourse {
  return {
    assignment_id: p.assignmentId,
    protocol_id: p.protocolId,
    status: p.assignmentStatus,
    assigned_at: p.assignedAt,
    completed_at: p.completedAt,
    assigned_via: p.assignedVia,
    protocol_version: p.protocolVersion,
    protocol: {
      name: p.protocolName,
      description: p.protocolDescription,
      status: p.assignmentStatus,
    },
    progress: p.progress,
  };
}

function mapProtocolsToProcedures(protocols: AssignedProtocol[]): TrainingProcedure[] {
  const procedures: TrainingProcedure[] = [];
  for (const p of protocols) {
    for (const proc of p.procedures) {
      procedures.push({
        procedure_id: proc.procedureId,
        name: proc.name,
        description: proc.description,
        protocol_id: p.protocolId,
        sort_order: proc.sortOrder,
        // Use the protocol assignment date as a fallback since procedures
        // don't carry their own created_at in the shared type
        created_at: p.assignedAt,
        protocol: { name: p.protocolName },
      });
    }
  }
  return procedures;
}

function mapConfirmationToCertificate(c: AssignedConfirmation): TrainingCertificate | null {
  // Only include signed confirmations as certificates
  if (!c.isSigned || !c.signedAt) return null;
  return {
    id: c.confirmationId,
    confirmation_name: c.name,
    signed_at: c.signedAt,
    confirmation_id: c.confirmationId,
  };
}

function mapProtocolsToCertificates(protocols: AssignedProtocol[]): TrainingCertificate[] {
  const certs: TrainingCertificate[] = [];
  for (const p of protocols) {
    for (const c of p.confirmations) {
      const cert = mapConfirmationToCertificate(c);
      if (cert) certs.push(cert);
    }
  }
  return certs;
}

// ── Hook ──

/**
 * Hook: returns training data for the current employee.
 *
 * Delegates to @smartout/training shared hooks, then maps to the legacy
 * TrainingData shape for backwards compatibility with the training screen.
 */
export function useTrainingData() {
  const selectedProfileId = useWorkspaceStore((s) => s.selectedProfileId);
  const { data: profile } = useMyProfile();
  const workspaceId = profile?.workspace_id ?? "";

  const {
    data: protocols,
    isLoading: protocolsLoading,
    isError: protocolsError,
    error: protocolsErrorObj,
  } = useAssignedProtocols({
    profileId: selectedProfileId,
    workspaceId,
    supabase,
  });

  const { score, isLoading: scoreLoading } = useReadinessScore({
    profileId: selectedProfileId,
    workspaceId,
    supabase,
  });

  const data: TrainingData | undefined = useMemo(() => {
    if (!protocols) return undefined;

    return {
      courses: protocols.map(mapProtocolToCourse),
      procedures: mapProtocolsToProcedures(protocols),
      certificates: mapProtocolsToCertificates(protocols),
      readinessPercent: score.percent,
    };
  }, [protocols, score.percent]);

  return {
    data,
    isLoading: protocolsLoading || scoreLoading,
    isError: protocolsError,
    error: protocolsErrorObj,
  };
}
