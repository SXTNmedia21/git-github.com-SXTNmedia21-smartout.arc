// packages/training/src/types.ts
// Shared training types used by web, mobile, and agent capabilities.

export type AssignedProtocol = {
  assignmentId: string;
  protocolId: string;
  protocolName: string;
  protocolDescription: string | null;
  assignmentStatus: "not_started" | "in_progress" | "completed" | "expired" | "waived";
  assignedAt: string;
  completedAt: string | null;
  assignedVia: string | null;
  protocolVersion: string | null;
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
  trainingContent: string | null;
  mediaUrls: Array<{ type: string; url: string; caption?: string }> | null;
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

export type ReadinessScore = {
  percent: number;
  completed: number;
  total: number;
};
