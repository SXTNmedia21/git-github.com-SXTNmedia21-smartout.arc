// packages/eslint-config/react.mjs
import base from "./base.mjs";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...base,
  {
    files: ["**/*.tsx"],
    rules: {
      // React-specific rules go here when needed
    },
  },
];
