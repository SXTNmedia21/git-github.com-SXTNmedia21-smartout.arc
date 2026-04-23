/**
 * @smartout/eslint-config local plugin — exposes custom rules under the
 * `smartout/*` namespace (e.g. `smartout/no-direct-supabase-write`).
 */

import noDirectSupabaseWrite from "./rules/no-direct-supabase-write.mjs";
import noGatedWriteInCapabilities from "./rules/no-gated-write-in-capabilities.mjs";

/** @type {import("eslint").ESLint.Plugin} */
const plugin = {
  meta: {
    name: "smartout",
    version: "1.0.0",
  },
  rules: {
    "no-direct-supabase-write": noDirectSupabaseWrite,
    "no-gated-write-in-capabilities": noGatedWriteInCapabilities,
  },
};

export default plugin;
