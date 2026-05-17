/**
 * smartout/no-empty-string-identifier-fallback
 *
 * Flags `<identifier-expr> ?? ""` (and `|| ""`) patterns where the surrounding
 * context proves the left-hand side is an *identifier column* — workspace_id,
 * profile_id, actor_id, user_id, entity_id, or any name ending in `_id` / `Id`.
 *
 * Why: empty-string fallback on identifier columns silently corrupts
 * `activity_trail` + `engine_event` routing. ADR-0134 Invariant 2 forbids the
 * pattern. L-0083 catalogues every recurrence — F-MO-01/02/03 surfaced again in
 * the 2026-05-13 audit despite three prior reminders. Rule-without-enforcement
 * = recurring regression. This rule is the enforcement.
 *
 * Allowed call sites (no LSP, manual review):
 *   - `display_name ?? ""`  — display-only string, never routed
 *   - `body ?? ""`          — message body
 *   - `comment ?? ""`       — comment text
 *   - `reason ?? ""`        — reason text
 * The rule fires ONLY when the surrounding context (property key or assignment
 * target) names an identifier column. A bare `?? ""` on `display_name` is
 * untouched.
 *
 * Allow list — file-path overrides:
 *   - `**\/*.test.{ts,tsx,mjs}`         (test fixtures may need invalid samples)
 *   - `**\/*test-fixtures*\/**`         (rule test fixtures live here)
 *   - `**\/profile-context.ts`          (the helper that documents this rule)
 *
 * Reference: ADR-0134 (Mobile Telemetry Contract), L-0083, audit
 * `docs/audits/2026-05-13-adr-contract-validation/05-mobile-surface.md`.
 */

const ALLOW_LIST_PATTERNS = [
  /\.test\.(ts|tsx|mjs|js)$/,
  /\/test-fixtures\//,
  /\/profile-context\.ts$/,
];

// Explicit list of known identifier column names (snake_case).
// Used to short-circuit detection — if the property key or variable name
// matches one of these exactly, the rule always fires.
const KNOWN_IDENTIFIER_NAMES = new Set([
  "workspace_id",
  "profile_id",
  "actor_id",
  "user_id",
  "entity_id",
  "time_entry_id",
  "shift_id",
  "department_id",
  "session_id",
  "deviation_id",
  "task_id",
  "company_id",
  "schedule_shift_id",
  "supplement_rule_id",
  "manual_supplement_id",
  "channel_id",
  "conversation_id",
  "target_profile_id",
  "target_shift_id",
  "requester_profile_id",
  "requester_shift_id",
  "reconciliation_id",
  "approval_id",
  "assignment_id",
  "protocol_id",
  "confirmation_id",
  "procedure_id",
  "procedure_step_id",
  "step_id",
  "process_key",
  "process_id",
  "engine_state_id",
  "owner_id",
  "added_by",
  "settled_by",
  "created_by",
]);

/**
 * Returns true when the property/variable name fits an identifier-column
 * pattern: a known name OR ends in `_id` (snake_case) OR ends in `Id`
 * (camelCase, e.g. `workspaceId`, `profileId`).
 */
function looksLikeIdentifierName(name) {
  if (!name || typeof name !== "string") return false;
  if (KNOWN_IDENTIFIER_NAMES.has(name)) return true;
  if (name.endsWith("_id")) return true;
  // camelCase: ends in `Id` after a lowercase letter (so `Idle` / `IDLE_CAPS`
  // don't match). We require the preceding character to be lowercase, which
  // catches `workspaceId`, `profileId`, `actorId`, etc. but skips `ID`,
  // `KIND`, `MID` (uppercase preceding char or short literal).
  if (
    name.length >= 3 &&
    name.endsWith("Id") &&
    name[name.length - 3] >= "a" &&
    name[name.length - 3] <= "z"
  ) {
    return true;
  }
  return false;
}

/**
 * Walks parent chain to find an identifier-naming context for the offending
 * `?? ""` expression. Returns the identifier name when found, else null.
 *
 * Contexts inspected (lowest-cost first):
 *   1. Property value: `{ workspace_id: <expr> ?? "" }`
 *   2. VariableDeclarator init: `const workspaceId = <expr> ?? ""`
 *   3. AssignmentExpression target: `obj.workspaceId = <expr> ?? ""`
 *   4. JSX attribute value: `<TaskFeed profileId={... ?? ""} />`
 *   5. Argument to function whose name is an identifier-shaped setter
 *      (`setWorkspaceId(... ?? "")`).
 */
function findIdentifierContext(node) {
  let current = node;
  let parent = node.parent;

  while (parent) {
    // 1. Property value — `{ workspace_id: ... ?? "" }`
    if (parent.type === "Property" && parent.value === current) {
      const keyName =
        parent.key?.type === "Identifier"
          ? parent.key.name
          : parent.key?.type === "Literal"
            ? String(parent.key.value)
            : null;
      if (looksLikeIdentifierName(keyName)) return keyName;
      // If the key is NOT an identifier column, the fallback is on a
      // non-identifier field (e.g. `display_name`) — explicitly safe.
      return null;
    }

    // 2. VariableDeclarator init — `const profileId = ... ?? ""`
    if (parent.type === "VariableDeclarator" && parent.init === current) {
      const name = parent.id?.type === "Identifier" ? parent.id.name : null;
      if (looksLikeIdentifierName(name)) return name;
      return null;
    }

    // 3. AssignmentExpression target — `state.workspaceId = ... ?? ""`
    if (parent.type === "AssignmentExpression" && parent.right === current) {
      const left = parent.left;
      let name = null;
      if (left?.type === "Identifier") name = left.name;
      else if (left?.type === "MemberExpression" && left.property?.type === "Identifier") {
        name = left.property.name;
      }
      if (looksLikeIdentifierName(name)) return name;
      return null;
    }

    // 4. JSX attribute value — `<Foo profileId={... ?? ""} />`
    if (parent.type === "JSXExpressionContainer") {
      const grand = parent.parent;
      if (grand?.type === "JSXAttribute" && grand.name?.type === "JSXIdentifier") {
        if (looksLikeIdentifierName(grand.name.name)) return grand.name.name;
        return null;
      }
    }

    // 5. CallExpression argument to a setter — `setWorkspaceId(... ?? "")`
    if (parent.type === "CallExpression" && parent.arguments.includes(current)) {
      const callee = parent.callee;
      let calleeName = null;
      if (callee?.type === "Identifier") calleeName = callee.name;
      else if (callee?.type === "MemberExpression" && callee.property?.type === "Identifier") {
        calleeName = callee.property.name;
      }
      if (calleeName && /^set[A-Z]/.test(calleeName)) {
        // Strip `set` prefix and lower-case the first letter for matching.
        const stripped = calleeName.slice(3);
        const camel = stripped[0].toLowerCase() + stripped.slice(1);
        if (looksLikeIdentifierName(camel)) return camel;
      }
      return null;
    }

    // Climb if we're inside a chain of expressions (parens, conditionals,
    // chained `??`/`||`). Bound the climb to avoid pathological trees.
    if (
      parent.type === "ChainExpression" ||
      parent.type === "ConditionalExpression" ||
      (parent.type === "LogicalExpression" && parent !== node)
    ) {
      current = parent;
      parent = parent.parent;
      continue;
    }

    // Anything else: stop.
    return null;
  }
  return null;
}

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow empty-string fallback (`?? \"\"` or `|| \"\"`) on identifier columns. Silently corrupts activity_trail. Use getProfileContext() fail-fast pattern (ADR-0134).",
    },
    schema: [],
    messages: {
      forbidden:
        "L-0083: empty-string fallback on identifier `{{name}}` silently corrupts activity_trail + engine_event routing. Use `getProfileContext()` (mobile) or upstream guard — fail fast on missing identity. ADR-0134 Invariant 2.",
    },
  },
  create(context) {
    const filename = context.filename ?? context.getFilename?.() ?? "";
    if (ALLOW_LIST_PATTERNS.some((re) => re.test(filename))) return {};

    return {
      LogicalExpression(node) {
        // Only `??` and `||` with empty-string RHS.
        if (node.operator !== "??" && node.operator !== "||") return;
        const right = node.right;
        if (!right) return;
        if (right.type !== "Literal" || right.value !== "") return;

        const name = findIdentifierContext(node);
        if (!name) return;

        context.report({
          node,
          messageId: "forbidden",
          data: { name },
        });
      },
    };
  },
};

export default rule;
