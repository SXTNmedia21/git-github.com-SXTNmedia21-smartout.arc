// Root ESLint config — delegates to package-level configs via Turbo.
// This exists so lint-staged can run ESLint from the workspace root.
// Apps have their own eslint.config.mjs with @next/next and react-hooks plugins.
// When lint-staged runs from root, disable directives referencing those rules
// would be flagged as "unknown". Setting reportUnusedDisableDirectives to "off"
// prevents lint-staged from failing on them.
import base from "@smartout/eslint-config/base";

export default [
  ...base,
  {
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
  },
];
