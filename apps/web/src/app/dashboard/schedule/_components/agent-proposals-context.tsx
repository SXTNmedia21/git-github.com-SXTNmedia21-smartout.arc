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
}: AgentProposalsProviderProps) {
  const [proposals, setProposals] = useState<ShiftProposal[]>([]);
  const [pendingConfirmation, setPendingConfirmation] = useState<ConfirmationRequest | null>(null);

  const addProposal = useCallback(
    async (proposal: ShiftProposal) => {
      // Auto-approve single creates (up to 4 pending) — no ghost card needed
      if (proposal.type === "create") {
        const pendingCreates = proposals.filter((p) => p.type === "create").length;
        if (pendingCreates < 4) {
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
          return;
        }
      }
      // 5+ creates, removes, deploys → queue as ghost for batch approval
      setProposals((prev) => [...prev, proposal]);
    },
    [createShift, proposals],
  );

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

      setProposals((prev) => prev.filter((candidate) => candidate.id !== id));
    },
    [proposals, createShift, updateShift, deleteShift],
  );

  const rejectProposal = useCallback((id: string) => {
    setProposals((prev) => prev.filter((proposal) => proposal.id !== id));
  }, []);

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
    }
    setProposals([]);
  }, [proposals, createShift, updateShift, deleteShift]);

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
