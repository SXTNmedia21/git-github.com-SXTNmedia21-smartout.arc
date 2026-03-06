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

import type { ShiftProposal } from "./schedule-types";

type AgentProposalsContextValue = {
  proposals: ShiftProposal[];
  addProposal: (proposal: ShiftProposal) => void;
  removeProposal: (id: string) => void;
  approveProposal: (id: string) => Promise<void>;
  rejectProposal: (id: string) => void;
};

const AgentProposalsContext = createContext<AgentProposalsContextValue | null>(null);

type AgentProposalsProviderProps = {
  children: ReactNode;
  createShift: (input: Record<string, unknown>) => Promise<unknown>;
  updateShift: (input: { id: string; patch: Record<string, unknown> }) => Promise<unknown>;
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
}: AgentProposalsProviderProps) {
  const [proposals, setProposals] = useState<ShiftProposal[]>([]);

  const addProposal = useCallback((proposal: ShiftProposal) => {
    setProposals((prev) => [...prev, proposal]);
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
      } else {
        await updateShift({ id: proposal.shiftId, patch: proposal.patch });
      }

      setProposals((prev) => prev.filter((candidate) => candidate.id !== id));
    },
    [proposals, createShift, updateShift],
  );

  const rejectProposal = useCallback((id: string) => {
    setProposals((prev) => prev.filter((proposal) => proposal.id !== id));
  }, []);

  const value = useMemo(
    () => ({
      proposals,
      addProposal,
      removeProposal,
      approveProposal,
      rejectProposal,
    }),
    [proposals, addProposal, removeProposal, approveProposal, rejectProposal],
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
