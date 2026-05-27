/**
 * @smartout/eslint-config local plugin — exposes custom rules under the
 * `smartout/*` namespace (e.g. `smartout/no-direct-supabase-write`).
 */

import noDirectSupabaseWrite from "./rules/no-direct-supabase-write.mjs";
import noGatedWriteInCapabilities from "./rules/no-gated-write-in-capabilities.mjs";
import noEmptyStringIdentifierFallback from "./rules/no-empty-string-identifier-fallback.mjs";
import noWizardBarrelImport from "./rules/no-wizard-barrel-import.mjs";
import noOklchLiteral from "./rules/no-oklch-literal.mjs";

/** @type {import("eslint").ESLint.Plugin} */
const plugin = {
  meta: {
    name: "smartout",
    version: "1.0.0",
  },
  rules: {
    "no-direct-supabase-write": noDirectSupabaseWrite,
    "no-gated-write-in-capabilities": noGatedWriteInCapabilities,
    "no-empty-string-identifier-fallback": noEmptyStringIdentifierFallback,
    "no-wizard-barrel-import": noWizardBarrelImport,
    "no-oklch-literal": noOklchLiteral,
  },
};

export default plugin;
