/**
 * Mobile-safe deep-import entry. Re-exports ONLY the React-portable
 * wizard state machine — never the web-only shell components.
 *
 * Mobile must import from "@smartout/ui/wizard/state" (this entry),
 * never from "@smartout/ui/wizard" (the barrel that pulls WizardShell,
 * lucide-react, and framer-motion into the Metro bundle).
 */
export { useWizardState } from "./useWizardState";
export type { WizardDefinition, WizardStepDef, WizardStepProps } from "./types";
