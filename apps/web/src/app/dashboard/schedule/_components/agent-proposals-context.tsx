"use client";

// ============================================
// agent-proposals-context.tsx
// Holds agent-generated schedule proposals that require human approval.
// Exists so schedule views can safely render draft ghost actions before write.
// Connected to: schedule page provider composition and future ghost-card UI.
// ============================================

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { emit, nonEmpty } from "@smartout/telemetry";

import type { ShiftProposal } from "./schedule-types";

// A pending confirmation request created by requestConfirmation().
// resolve is called by resolveConfirmation() once the user responds.
type ConfirmationRequest = {
  title: string;
  description: string;
  resolve: (confirmed: boolean) => void;
};

type AgentProposalsContextValue = {
  proposals: ShiftProposal[];
  addProposal: (proposal: ShiftProposal) => void;
  removeProposal: (id: string) => void;
  approveProposal: (id: string) => Promise<void>;
  rejectProposal: (id: string) => void;
  pendingConfirmation: ConfirmationRequest | null;
  requestConfirmation: (title: string, description: string) => Promise<boolean>;
  resolveConfirmation: (confirmed: boolean) => void;
  approveAllProposals: () => Promise<void>;
  clearAllProposals: () => void;
};

const AgentProposalsContext = createContext<AgentProposalsContextValue | null>(null);

type AgentProposalsProviderProps = {
  children: ReactNode;
  createShift: (input: Record<string, unknown>) => Promise<unknown>;
  updateShift: (input: { id: string; patch: Record<string, unknown> }) => Promise<unknown>;
  deleteShift: (id: string) => Promise<unknown>;
  workspaceId: string; // for telemetry on reject (Fase 4 Task 12)
  profileId: string; // for telemetry on reject (Fase 4 Task 12)
};

/**
 * Provides pending agent proposals and explicit approve/reject actions.
 * Why: agent operations should stay human-confirmed before mutating schedule.
 * Returns: React provider that exposes proposal state and mutation actions.
 */
export function AgentProposalsProvider({
  children,
  createShift,
  updateShift,
  deleteShift,
  workspaceId,
  profileId,
}: AgentProposalsProviderProps) {
  const [proposals, setProposals] = useState<ShiftProposal[]>([]);
  const [pendingConfirmation, setPendingConfirmation] = useState<ConfirmationRequest | null>(null);

  // Ghost-only per Pontus's corrected mental model (Fase 4, 2026-05-06):
  // Botsson NEVER mutates domain data directly. Every proposal goes through
  // human approval. The auto-approve block (introduced in 22410af2 2026-03-29)
  // violated this principle and is removed in Fase 4.
  const addProposal = useCallback((proposal: ShiftProposal) => {
    // R3: default source to "agent_response" so no proposal in React state
    // ever has source === undefined. Existing callers that don't set source
    // (non-voice paths) get the correct default. Voice tools set it explicitly.
    const normalised: ShiftProposal = proposal.source
      ? proposal
      : { ...proposal, source: "agent_response" };
    // Idempotency: skip duplicate proposal IDs (voice retry safety for V0).
    // Note: crypto.randomUUID() per execute() means LLM tool-call retries
    // still produce two ghost cards (different IDs). See SMA-298 for fix.
    setProposals((prev) => {
      if (prev.some((p) => p.id === normalised.id)) return prev;
      return [...prev, normalised];
    });
  }, []);

  const removeProposal = useCallback((id: string) => {
    setProposals((prev) => prev.filter((proposal) => proposal.id !== id));
  }, []);

  const approveProposal = useCallback(
    async (id: string) => {
      const proposal = proposals.find((candidate) => candidate.id === id);
      if (!proposal) return;

      if (proposal.type === "create") {
        await createShift({
          id: crypto.randomUUID(),
          employeeId: proposal.employeeId,
          dateId: proposal.dateId,
          role: proposal.role,
          startTime: proposal.startTime,
          endTime: proposal.endTime,
          workHours: proposal.workHours,
          status: "created",
          dayCategory: proposal.dayCategory,
          indicator: proposal.indicator,
          isPublished: false,
          breaks: proposal.breaks,
        });
      } else if (proposal.type === "update") {
        await updateShift({ id: proposal.shiftId, patch: proposal.patch });
      } else if (proposal.type === "delete") {
        await deleteShift(proposal.shiftId);
      }

      // Audit trail: accepted proposals leave a trace for provenance —
      // links the downstream shift mutation to its originating proposal.
      // Reuses ChangeProposalApproved from telemetry registry
      // (packages/telemetry/src/registry.ts:1713).
      // H2 guard: provider may receive empty-string IDs during the brief boot
      // window before useWorkspace resolves. Skip emit rather than throw —
      // the mutation already ran above; missing audit-trail entries are
      // preferable to a thrown nonEmpty() that nukes the click handler.
      if (workspaceId.length > 0 && profileId.length > 0) {
        void emit({
          event: "change_proposal approved",
          workspace_id: nonEmpty(workspaceId, "workspace_id"),
          actor_id: nonEmpty(profileId, "actor_id"),
          properties: { data: { proposal_id: id } },
        });
      }

      setProposals((prev) => prev.filter((candidate) => candidate.id !== id));
    },
    [proposals, createShift, updateShift, deleteShift, workspaceId, profileId],
  );

  const rejectProposal = useCallback(
    (id: string) => {
      setProposals((prev) => prev.filter((proposal) => proposal.id !== id));
      // Audit trail: rejected proposals leave a trace even though no domain
      // row is written. Reuses ChangeProposalRejected from telemetry registry
      // (packages/telemetry/src/registry.ts:1722).
      // H2 guard: see approveProposal above.
      if (workspaceId.length > 0 && profileId.length > 0) {
        void emit({
          event: "change_proposal rejected",
          workspace_id: nonEmpty(workspaceId, "workspace_id"),
          actor_id: nonEmpty(profileId, "actor_id"),
          properties: { data: { proposal_id: id } },
        });
      }
    },
    [workspaceId, profileId],
  );

  // Returns a Promise that resolves once the user responds to the confirmation dialog.
  // The dialog component calls resolveConfirmation() to settle the promise.
  const requestConfirmation = useCallback(
    (title: string, description: string): Promise<boolean> => {
      return new Promise<boolean>((resolve) => {
        setPendingConfirmation({ title, description, resolve });
      });
    },
    [],
  );

  const resolveConfirmation = useCallback((confirmed: boolean) => {
    setPendingConfirmation((current) => {
      current?.resolve(confirmed);
      return null;
    });
  }, []);

  const approveAllProposals = useCallback(async () => {
    const snapshot = proposals;
    for (const proposal of snapshot) {
      if (proposal.type === "create") {
        await createShift({
          id: crypto.randomUUID(),
          employeeId: proposal.employeeId,
          dateId: proposal.dateId,
          role: proposal.role,
          startTime: proposal.startTime,
          endTime: proposal.endTime,
          workHours: proposal.workHours,
          status: "created",
          dayCategory: proposal.dayCategory,
          indicator: proposal.indicator,
          isPublished: false,
          breaks: proposal.breaks,
        });
      } else if (proposal.type === "update") {
        await updateShift({ id: proposal.shiftId, patch: proposal.patch });
      } else if (proposal.type === "delete") {
        await deleteShift(proposal.shiftId);
      }
      // Provenance emit per proposal — same pattern as approveProposal.
      void emit({
        event: "change_proposal approved",
        workspace_id: nonEmpty(workspaceId, "workspace_id"),
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: { data: { proposal_id: proposal.id } },
      });
    }
    setProposals([]);
  }, [proposals, createShift, updateShift, deleteShift, workspaceId, profileId]);

  const clearAllProposals = useCallback(() => {
    setProposals([]);
  }, []);

  const value = useMemo(
    () => ({
      proposals,
      addProposal,
      removeProposal,
      approveProposal,
      rejectProposal,
      pendingConfirmation,
      requestConfirmation,
      resolveConfirmation,
      approveAllProposals,
      clearAllProposals,
    }),
    [
      proposals,
      addProposal,
      removeProposal,
      approveProposal,
      rejectProposal,
      pendingConfirmation,
      requestConfirmation,
      resolveConfirmation,
      approveAllProposals,
      clearAllProposals,
    ],
  );

  return <AgentProposalsContext.Provider value={value}>{children}</AgentProposalsContext.Provider>;
}

/**
 * Reads the current proposal context for schedule agent actions.
 * Why: consumers need a safe guard if provider is missing.
 * Returns: active proposal context API.
 */
export function useAgentProposals() {
  const context = useContext(AgentProposalsContext);
  if (!context) {
    throw new Error("useAgentProposals must be used within AgentProposalsProvider");
  }
  return context;
}
