// Public surface of the InputRequest primitive.
// Tools and runtime import from this module, not the individual files.
export {
  type SessionChannel,
  type SensitivityLevel,
  type InputFieldType,
  type InputValidation,
  type InputField,
  type InputRequestDescriptor,
  SessionChannelSchema,
  SensitivityLevelSchema,
  InputFieldTypeSchema,
  InputValidationSchema,
  InputFieldSchema,
  InputRequestDescriptorSchema,
  isInputRequest,
  buildInputRequest,
} from "./types.js";

export {
  type ChannelGuardResult,
  checkChannelGuard,
  formatChannelRejection,
} from "./channel-guard.js";
