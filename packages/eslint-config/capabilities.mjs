// packages/eslint-config/capabilities.mjs
//
// ADR-0190 Control 4 — `no-gated-write-in-capabilities`.
//
// Exported as a dedicated flat-config fragment so that only the package(s)
// that host capability tools (`@smartout/ai`) opt into the restriction. This
// avoids false-positive collisions with other `src/tools/` directories in the
// monorepo (e.g. `packages/agent-sdk/src/tools/`) which are structurally
// different and out of scope for ADR-0190.
//
// Path globs are resolved relative to the `eslint.config.mjs` file that
// imports this fragment — i.e. the consuming package's root. For
// `packages/ai/eslint.config.mjs` this means `src/capabilities/**` and
// `src/tools/**`.

import base from "./base.mjs";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...base,
  {
    files: ["src/capabilities/**/*.{ts,tsx}", "src/tools/**/*.{ts,tsx}"],
    rules: {
      "smartout/no-gated-write-in-capabilities": "error",
    },
  },
];
