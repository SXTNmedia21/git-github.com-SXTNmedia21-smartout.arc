// packages/training/src/index.ts
export { trainingKeys } from "./hooks/keys.js";
export { useAssignedProtocols } from "./hooks/use-assigned-protocols.js";
export {
  useCompleteStep,
  useSubmitTest,
  useSignConfirmation,
} from "./hooks/use-step-completion.js";
export { useReadinessScore } from "./hooks/use-readiness-score.js";
export type {
  AssignedProtocol,
  AssignedProcedure,
  ProcedureStepWithStatus,
  AssignedKnowledgeTest,
  AssignedConfirmation,
  ReadinessScore,
} from "./types.js";
