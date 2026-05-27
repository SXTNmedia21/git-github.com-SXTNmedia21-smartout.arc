/**
 * smartout/no-oklch-literal
 *
 * Forbids inline `oklch(...)` color literals in app code (ADR-0366).
 *
 * Why: All OKLCH values must live in the design-token layer
 * (`packages/design-tokens/src/tokens.{ts,css}` or the `@theme` block in
 * `apps/web/src/app/globals.css`). App code must consume colors only via
 * Tailwind theme utilities (e.g. `bg-background`) or CSS variable arbitrary
 * values (e.g. `bg-[var(--warn-soft)]`). Inline literals bypass the CSS
 * variable layer and therefore skip dark-mode variants, future theme retuning,
 * and a11y contrast audits that run against the token registry.
 *
 * Detected surfaces:
 *   - String literals: className="bg-[oklch(...)]", style={{ color: "oklch(...)" }}
 *   - Template literals: `radial-gradient(…, oklch(${chroma} …), …)`
 *   - Tagged template literals that contain `oklch(` in any quasi element
 *
 * Exempt:
 *   - `apps/web/src/app/globals.css`  — token DEFINITIONS belong here.
 *                                       Listed for future Stylelint-mirror parity;
 *                                       ESLint never sees .css files under the
 *                                       current `files` glob, but the entry stays
 *                                       so a future Stylelint port shares the
 *                                       same exemption surface.
 *   - `packages/design-tokens/**`     — canonical token source
 *   - `*.test.{ts,tsx,mjs}`           — test fixtures may reference literals
 *   - `*.stories.tsx`                 — Storybook
 *
 * False-positive guard:
 *   The regex requires a digit or dot **inside** the `oklch(...)` parens to fire.
 *   This distinguishes color literals (`oklch(0.5 0.1 90)`) from runtime
 *   prefix-detection strings (`color.startsWith("oklch(")`), a legitimate idiom
 *   in string-parsing helpers like `apps/mobile/src/theme/colors.ts:withOpacity`
 *   that append an alpha channel to a token-supplied OKLCH string at runtime.
 *
 * Severity: `error` — this is a regression-prevention gate.
 *
 * Error message aligns with JOURNEY-design-token-sweep-web-oklch.md.
 *
 * @see ADR-0366 docs/decisions/0366-nordic-split-oklch-literal-ban.md
 */

const ALLOW_LIST_PATTERNS = [
  // Token definition files — OKLCH lives here
  /apps\/web\/src\/app\/globals\.css$/,
  /packages\/design-tokens\//,
  // Test + Storybook fixtures
  /\.test\.(ts|tsx|mjs|js)$/,
  /\.spec\.(ts|tsx|mjs|js)$/,
  /\.stories\.(ts|tsx)$/,
];

// Require a digit or dot inside the parens — fires on `oklch(0.5 …)` but
// NOT on prefix-test strings like `"oklch("`. Case-insensitive per ADR-0366.
const OKLCH_RE = /oklch\s*\(\s*[\d.]/i;

/** @param {string} s @returns {boolean} */
function containsOklch(s) {
  return OKLCH_RE.test(s);
}

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow inline oklch() color literals in app code — use CSS variables or Tailwind tokens (ADR-0366).",
      url: "docs/decisions/0366-nordic-split-oklch-literal-ban.md",
    },
    schema: [],
    messages: {
      forbidden:
        "OKLCH literal banned per ADR-0366. Use CSS variable from globals.css (e.g. var(--foreground)) or a shadcn token class (bg-background, text-foreground, etc.). globals.css is exempt — token DEFINITIONS belong there.",
    },
  },

  create(context) {
    const filename = context.filename ?? context.getFilename?.() ?? "";
    if (ALLOW_LIST_PATTERNS.some((re) => re.test(filename))) {
      return {};
    }

    return {
      // Plain string literals: "…oklch(…)…" or '…oklch(…)…'
      Literal(node) {
        if (typeof node.value === "string" && containsOklch(node.value)) {
          context.report({ node, messageId: "forbidden" });
        }
      },

      // Template literals (tagged or untagged):
      // `radial-gradient(…, oklch(0.82 ${chroma} 50), …)`
      // Each quasi element (TemplateElement) holds the raw string between ${}.
      TemplateLiteral(node) {
        for (const quasi of node.quasis) {
          if (containsOklch(quasi.value.raw)) {
            context.report({ node: quasi, messageId: "forbidden" });
            // Report once per template literal — first offending quasi is enough.
            break;
          }
        }
      },
    };
  },
};

export default rule;
