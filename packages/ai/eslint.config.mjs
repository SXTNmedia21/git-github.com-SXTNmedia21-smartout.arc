// @smartout/ai ESLint config.
//
// Uses the `capabilities` flat-config fragment which extends `base.mjs` and
// adds ADR-0190 Control 4 — the `no-gated-write-in-capabilities` rule scoped
// to `src/capabilities/**` and `src/tools/**` within this package.
export { default } from "@smartout/eslint-config/capabilities";
