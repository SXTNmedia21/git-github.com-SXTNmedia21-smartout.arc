// packages/eslint-config/next.mjs
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import smartout from "./plugins/smartout/index.mjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Smartout custom rules (ADR-0091 WP3 / ADR-0114 R3).
  // Kept at `warn` severity until call-site migration completes.
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { smartout },
    rules: {
      "smartout/no-direct-supabase-write": "warn",
    },
  },
  // public-site uses [host] dynamic route which ESLint treats as a glob
  // character class, causing "rule definition not found" errors in lint-staged.
  // These are server-rendered public pages — Next.js link rules don't apply.
  globalIgnores([
    ".next/**",
    ".next-e2e-web/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "**/public-site/**",
  ]),
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      // Allow underscore-prefixed args (e.g. _request in route handlers, _report
      // in callbacks) to signal intentional non-use without triggering warnings.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      // React Compiler rules — downgrade from error to warning.
      // These fire on legitimate patterns (ref access in callbacks, TanStack Table,
      // useCallback + useEffect) that the compiler cannot auto-optimize.
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/incompatible-library": "warn",
      "react-hooks/rules-of-hooks": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
    },
  },
  // WebDayControl widgets (ADR-0156): enforce portability discipline for
  // future `packages/ui/day-control/` extraction when mobile consumer lands.
  // Widgets must NOT depend on Next-specific modules or direct Supabase access.
  {
    files: ["**/src/components/day/widgets/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["next/*", "next"],
              message:
                "WebDayControl widgets must be portable to packages/ui when mobile consumer lands (ADR-0156). No next/* imports in widgets.",
            },
            {
              group: ["@smartout/supabase/*", "@/lib/supabase/*"],
              message:
                "WebDayControl widgets must receive data via props, not via direct Supabase access (ADR-0156 portability discipline).",
            },
          ],
        },
      ],
    },
  },
  // Billing UI: forbid raw Tailwind color scales so status rendering goes
  // through <InvoiceStatusBadge/> (Phase 5.1) + Nordic Split semantic
  // tokens (bg-success / bg-warning / bg-destructive / bg-info / bg-muted).
  // Billing spec §10.1 (ESLint fence). Applies to platform-admin + self-
  // serve dashboard billing surfaces.
  {
    files: [
      "**/app/platform-admin/billing/**/*.{ts,tsx}",
      "**/app/dashboard/billing/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "Literal[value=/\\b(bg|text|border)-(red|blue|green|yellow|zinc|gray|slate)-[0-9]+\\b/]",
          message:
            "Billing UI forbids raw Tailwind color scales. Use <InvoiceStatusBadge/> or Nordic Split semantic tokens (bg-success, bg-warning, bg-destructive, bg-info, bg-muted) + the matching text-*-foreground variants. Billing spec §10.1.",
        },
      ],
    },
  },
]);

export default eslintConfig;
