// Public surface of the InlineConfirmCard primitive.
// Tools, runtime, and tests import from this module, not the individual files.
// Sibling to packages/ai/src/primitives/input-request/index.ts (BIR pattern).
export {
  // Re-exported from BIR for convenience (consumers of this module only need one import)
  type SessionChannel,
  SessionChannelSchema,
  // Surface + Platform enums
  type Surface,
  type Platform,
  SurfaceSchema,
  PlatformSchema,
  // Action schemas + types
  type ConfirmAction,
  type EditAction,
  type CancelAction,
  type Action,
  ConfirmActionSchema,
  EditActionSchema,
  CancelActionSchema,
  ActionSchema,
  // Preview schemas + types
  type PreviewMetadataItem,
  type Preview,
  PreviewMetadataItemSchema,
  PreviewSchema,
  // Primary descriptor
  type InlineConfirmCardDescriptor,
  InlineConfirmCardDescriptorSchema,
  // Result descriptor
  type InlineConfirmCardResult,
  InlineConfirmCardResultSchema,
  // Type guard + builder
  type InlineConfirmCardInput,
  isInlineConfirmCard,
  buildInlineConfirmCard,
} from "./types.js";

export {
  type ChannelGuardResult,
  checkInlineConfirmCardChannelGuard,
  formatInlineConfirmCardChannelRejection,
} from "./channel-guard.js";
