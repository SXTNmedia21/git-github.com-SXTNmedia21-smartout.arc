// packages/eslint-config/next.mjs
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
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
]);

export default eslintConfig;
