// WebDayControl widgets (ADR-0156 §8 — Phase 2 extraction from apps/web).
// Portability discipline: pure-props components, no next/*, no direct
// Supabase access. Consumed by apps/web today; apps/mobile consumption
// gated on T4b ADR (packages/ui dual-platform strategy).
export * from "./day-control";

export { Button, buttonVariants, type ButtonProps } from "./components/button";
export * from "./components/dialog";
export {
  EntityFormDialog,
  type EntityFormDialogMode,
  type EntityFormDialogProps,
} from "./components/entity-form-dialog";
export * from "./components/input";
export * from "./components/label";
export * from "./components/popover";
export * from "./components/badge";
export * from "./components/card";
export {
  Skeleton,
  SkeletonLine,
  SkeletonHeading,
  SkeletonCard,
  SkeletonAvatar,
  SkeletonBadge,
  SkeletonTableRow,
  SkeletonChart,
} from "./components/skeleton";
export { SkeletonEntrance } from "./components/skeleton-entrance";
export { Entrance, withEntrance } from "./components/entrance";
export * from "./components/separator";
export { StatusBadge } from "./components/status-badge";
export { InvoiceStatusBadge, type InvoiceStatus } from "./components/invoice-status-badge";
export { ReadinessBadge, type ReadinessBadgeProps, type ReadinessState } from "./readiness-badge";
export { ContractTimeline } from "./components/contract-timeline";
export {
  BotssonInputRequest,
  type BotssonInputRequestProps,
  type BIRDescriptor,
  type BIRField,
  type BIRFieldType,
  type BIRSensitivity,
  type BIRValidation,
} from "./components/botsson-input-request";
export { cn } from "./lib/utils";
export * from "./wizard";
export * from "./flow-player";
export * from "./task-runner";
export * from "./shift-timeline";
export * from "./helpdesk";
