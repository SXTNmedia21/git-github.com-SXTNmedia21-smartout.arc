// packages/training/src/index.ts
export { trainingKeys } from "./hooks/keys";
export { useAssignedProtocols } from "./hooks/use-assigned-protocols";
export { useCompleteStep, useSubmitTest, useSignConfirmation } from "./hooks/use-step-completion";
export { useReadinessScore } from "./hooks/use-readiness-score";
export type {
  AssignedProtocol,
  AssignedProcedure,
  ProcedureStepWithStatus,
  AssignedKnowledgeTest,
  AssignedConfirmation,
  ReadinessScore,
} from "./types";
