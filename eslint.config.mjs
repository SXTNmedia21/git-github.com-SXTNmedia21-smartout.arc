// Root ESLint config — delegates to package-level configs via Turbo.
// This exists so lint-staged can run ESLint from the workspace root.
import base from "@smartout/eslint-config/base";

export default base;
