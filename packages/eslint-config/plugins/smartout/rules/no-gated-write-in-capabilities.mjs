/**
 * smartout/no-gated-write-in-capabilities
 *
 * Forbids the identifiers `gatedInsert`, `gatedUpdate`, `gatedDelete` inside
 * capability tools (`packages/ai/src/tools/**`, `packages/ai/src/capabilities/**`).
 *
 * Rationale (ADR-0091, ADR-0190 Control 4):
 * Capability authority flows through `gateAction` (pathway A) — the agent-loop
 * permission model. `gatedInsert/Update/Delete` is pathway B (policy-tree /
 * `cascade_gate_write`). Mixing them in a capability tool would fire a write
 * gate from inside the agent loop without the agent-loop authority checks,
 * collapsing the two-pathway ontology that ADR-0190 deliberately preserves.
 *
 * Match by IDENTIFIER — not import path — so re-exports cannot bypass the rule.
 * Any reference to the identifiers `gatedInsert|gatedUpdate|gatedDelete` under
 * the restricted paths fails, regardless of how they were imported.
 *
 * Severity is configured where the rule is wired in (see base.mjs overrides
 * block). This rule module itself is severity-agnostic.
 */

const FORBIDDEN_IDENTIFIERS = new Set(["gatedInsert", "gatedUpdate", "gatedDelete"]);

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow gatedInsert/gatedUpdate/gatedDelete inside capability tools — capability authority flows through gate-action (pathway A). See ADR-0091, ADR-0190.",
    },
    schema: [],
    messages: {
      forbidden:
        "gatedInsert/Update/Delete is forbidden in capability tools. Capability authority flows through gate-action (pathway A). See ADR-0091, ADR-0190.",
    },
  },
  create(context) {
    return {
      Identifier(node) {
        if (!FORBIDDEN_IDENTIFIERS.has(node.name)) return;

        // Skip property keys in object literals / member expressions where the
        // identifier is NOT being referenced as a value. E.g. `{ gatedInsert: 1 }`
        // as a key should not trip the rule (extremely unlikely, but explicit).
        const parent = node.parent;
        if (
          parent &&
          parent.type === "Property" &&
          parent.key === node &&
          !parent.computed &&
          parent.shorthand === false
        ) {
          return;
        }
        if (
          parent &&
          parent.type === "MemberExpression" &&
          parent.property === node &&
          !parent.computed
        ) {
          // `foo.gatedInsert` — still a reference we want to block, because the
          // identifier itself is named. Fall through (no return).
        }

        context.report({
          node,
          messageId: "forbidden",
        });
      },
    };
  },
};

export default rule;
