/**
 * Vitest spec for smartout/no-oklch-literal.
 *
 * Runs ESLint v9's built-in `RuleTester` inside describe/it blocks so the
 * suite runs via `pnpm --filter @smartout/eslint-config test`.
 *
 * Coverage:
 *   valid   — globals.css exempt path, design-tokens exempt path, test files,
 *             CSS variable usage, Tailwind token class usage, JSX using var()
 *   invalid — plain string literal with oklch(), template literal with oklch(),
 *             JSX className string containing oklch()
 *
 * @see ADR-0366 docs/decisions/0366-nordic-split-oklch-literal-ban.md
 */

import { describe, it } from "vitest";
import { RuleTester } from "eslint";
import tsparser from "@typescript-eslint/parser";
import rule from "../plugins/smartout/rules/no-oklch-literal.mjs";

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsparser,
    parserOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      ecmaFeatures: { jsx: true },
    },
  },
});

describe("smartout/no-oklch-literal", () => {
  it("allows exempt paths and token-based patterns; blocks oklch literals", () => {
    ruleTester.run("no-oklch-literal", rule, {
      valid: [
        // ── Exempt files ──────────────────────────────────────────────────

        // Token DEFINITION file — globals.css is allowed (AST rule won't even
        // parse .css; the filename exemption exists for when the rule is applied
        // to CSS-in-JS or other contexts that share the same AST visitor).
        {
          filename: "apps/web/src/app/globals.css",
          code: `const x = "oklch(0.5 0.1 90)";`,
        },

        // Design-tokens package — always exempt
        {
          filename: "packages/design-tokens/src/tokens.ts",
          code: `export const warm = "oklch(0.72 0.08 50)";`,
        },

        // Test fixture — exempt
        {
          filename: "apps/web/src/foo.test.ts",
          code: `expect(src).not.toContain("oklch(");`,
        },

        // Storybook — exempt
        {
          filename: "apps/web/src/components/Foo.stories.tsx",
          code: `const color = "oklch(0.5 0.1 90)";`,
        },

        // ── Token-based usage — should never error ─────────────────────

        // CSS variable reference in arbitrary Tailwind value (correct pattern)
        { code: `const el = <div className="bg-[var(--warn-soft)]" />;` },

        // Semantic Tailwind token (correct pattern)
        { code: `const el = <div className="bg-background text-foreground" />;` },

        // var() reference in inline style (correct pattern)
        { code: `const style = { color: "var(--primary)" };` },

        // Template literal with no oklch anywhere
        {
          code: `const gradient = \`linear-gradient(135deg, var(--warn-soft), var(--primary))\`;`,
        },

        // String without oklch
        { code: `const s = "radial-gradient(circle, #fff, #000)";` },

        // ── False-positive guard: prefix-detection strings ─────────────────
        // Runtime helpers parse OKLCH strings supplied by the token layer; the
        // string "oklch(" with no digits/dots inside the parens is a prefix
        // pattern, not a color literal. Real-world example: `apps/mobile/src/
        // theme/colors.ts:withOpacity` (line 44 as of 2026-05-28).

        // Prefix-test via String.startsWith
        { code: `if (color.startsWith("oklch(")) { /* runtime prefix-test */ }` },

        // Named constant holding the bare prefix
        { code: `const PREFIX = "oklch(";` },

        // ── Regex literal — node.value is RegExp object, must skip ─────────
        // The Literal visitor checks typeof node.value === "string" first, so
        // RegExp values are correctly ignored. Lock that behavior in.
        { code: "const re = /oklch\\(/;" },
      ],

      invalid: [
        // ── Plain string literal ──────────────────────────────────────────

        // JSX className with oklch Tailwind arbitrary value
        {
          code: `export default function Foo() { return <div className="bg-[oklch(0.7_0.2_180)]" />; }`,
          errors: [{ messageId: "forbidden" }],
        },

        // inline style object value
        {
          code: `const style = { color: "oklch(0.5 0.1 90)" };`,
          errors: [{ messageId: "forbidden" }],
        },

        // ── Template literal ───────────────────────────────────────────────

        // Template literal with oklch() in a quasi string segment
        {
          code: `const chroma = 0.1; const gradient = \`radial-gradient(circle, oklch(0.82 \${chroma} 50))\`;`,
          errors: [{ messageId: "forbidden" }],
        },

        // Template literal with oklch() — no interpolation (all in one quasi)
        {
          code: "const g = `linear-gradient(135deg, oklch(0.72 0.08 50), oklch(0.55 0.12 35))`;",
          errors: [{ messageId: "forbidden" }],
        },

        // ── JSX expression with oklch string ───────────────────────────────

        // style prop with string value containing oklch
        {
          code: `const el = <div style={{ background: "radial-gradient(circle, oklch(0.8 0.1 60))" }} />;`,
          errors: [{ messageId: "forbidden" }],
        },

        // ── False-positive guard: tightened regex still catches real values ─
        // Sibling of the prefix-test valid cases above. If a future regex
        // regression weakens the digit/dot requirement, this case ensures we
        // still fire on the actual color-literal form.
        {
          code: `const c = "oklch(0.5 0.1 90)";`,
          errors: [{ messageId: "forbidden" }],
        },

        // ── Case-insensitivity: uppercase OKLCH( must fire ─────────────────
        // ADR-0366 doesn't care about case; CSS accepts oklch/Oklch/OKLCH.
        // The `i` flag in OKLCH_RE handles all three — this locks it in.
        {
          code: `const c = "OKLCH(0.5 0.1 90)";`,
          errors: [{ messageId: "forbidden" }],
        },
      ],
    });
  });
});
