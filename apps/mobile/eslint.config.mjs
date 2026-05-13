/**
 * ESLint flat config for @smartout/mobile.
 *
 * Inherits the shared `@smartout/eslint-config/base` plus mobile-specific
 * enforcement: L-0083 empty-string identifier fallback is an ERROR on mobile,
 * not a warning. ADR-0134 Mobile Telemetry Contract requires fail-fast — the
 * F-MO-01/02/03 audit findings (open since 2026-05-10 baseline) closed by the
 * `feat/audit-fmo-l0083-enforcement` sortie and this rule prevents reintro.
 *
 * Why mobile-only `error` severity:
 * - Mobile activity_trail corruption blast radius = wrong workspace routing
 *   on the most-trafficked telemetry path (D2 + D6 surfaces).
 * - The web BFF resolves identity server-side per ADR-0151; web-side `?? ""`
 *   patterns are mostly display-only and less load-bearing.
 * - The 2026-05-13 audit calls out L-0083 as "incurable without ESLint" for
 *   mobile specifically (synthesis §8 / Top Findings #4).
 *
 * Global severity for the same rule stays `warn` in `base.mjs` for now; if a
 * future sortie remediates all web sites, promote globally to `error`.
 */
import base from "@smartout/eslint-config/base";
import smartout from "@smartout/eslint-config/plugins/smartout";

export default [
  ...base,
  {
    ignores: [".expo/**", "dist/**", "build/**", "node_modules/**", ".turbo/**"],
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { smartout },
    rules: {
      // L-0083 enforcement (ADR-0134 Invariant 2). Mobile-only error severity.
      "smartout/no-empty-string-identifier-fallback": "error",
    },
  },
];
