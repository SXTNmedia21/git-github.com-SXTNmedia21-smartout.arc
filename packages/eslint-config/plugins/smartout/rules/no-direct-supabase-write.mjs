/**
 * smartout/no-direct-supabase-write
 *
 * Flags direct Supabase writes — `.from(X).insert(...)`, `.from(X).update(...)`,
 * `.from(X).delete(...)` — in application code. These must go through the gate
 * client (`gatedInsert` / `gatedUpdate` / `gatedDelete`) from `@smartout/supabase`
 * so that `cascade_gate_write()` runs before the write lands (ADR-0091 WP3,
 * ADR-0114 R3).
 *
 * Allow list — direct writes are permitted in:
 *   - `supabase/functions/**`         (Edge Functions — gate runs server-side)
 *   - `**\/*.test.ts`                 (test fixtures)
 *   - `packages/supabase/src/gate-client.ts` (the wrapper itself)
 *   - `scripts/**`                    (one-off ops scripts)
 *   - `packages/ai/src/generators/**\/seed*.ts` (synthetic data generators)
 *
 * Severity: `warn` — we ship the rule alongside WP3 but do NOT migrate call
 * sites in this PR. Bumping to `error` lands with WP3 follow-up PR once all
 * current call sites are converted.
 */

const ALLOW_LIST_PATTERNS = [
  /\/supabase\/functions\//,
  /\.test\.ts$/,
  /packages\/supabase\/src\/gate-client\.ts$/,
  /\/scripts\//,
  /packages\/ai\/src\/generators\/.*seed.*\.ts$/,
];

const WRITE_METHODS = new Set(["insert", "update", "delete"]);

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow direct Supabase .from().insert/update/delete — use gatedInsert/gatedUpdate/gatedDelete from @smartout/supabase (ADR-0091 WP3, ADR-0114)",
    },
    schema: [],
    messages: {
      direct:
        "Direct Supabase write blocked. Use gatedInsert/gatedUpdate/gatedDelete from @smartout/supabase (ADR-0091 WP3, ADR-0114).",
    },
  },
  create(context) {
    const filename = context.filename ?? context.getFilename();
    if (ALLOW_LIST_PATTERNS.some((re) => re.test(filename))) {
      return {};
    }

    return {
      CallExpression(node) {
        // Match: <anything>.from(<anything>).{insert|update|delete}(...)
        const callee = node.callee;
        if (!callee || callee.type !== "MemberExpression") return;
        if (callee.computed) return;

        const methodName = callee.property?.name;
        if (!methodName || !WRITE_METHODS.has(methodName)) return;

        // The callee.object must itself be a `.from(...)` call.
        const fromCall = callee.object;
        if (!fromCall || fromCall.type !== "CallExpression") return;

        const fromCallee = fromCall.callee;
        if (!fromCallee || fromCallee.type !== "MemberExpression") return;
        if (fromCallee.computed) return;
        if (fromCallee.property?.name !== "from") return;

        context.report({
          node,
          messageId: "direct",
        });
      },
    };
  },
};

export default rule;
