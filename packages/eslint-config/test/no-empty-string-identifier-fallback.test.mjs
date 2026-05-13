/**
 * Vitest spec for smartout/no-empty-string-identifier-fallback.
 *
 * Wraps ESLint v9's built-in `RuleTester` inside a `describe`/`it` block so
 * the suite runs as `pnpm --filter @smartout/eslint-config test` (vitest).
 *
 * Why vitest: the prompt + sortie plan T7 require a Vitest test. RuleTester
 * itself does the AST work synchronously — we use vitest only as the runner +
 * to expose the result as a green check on CI.
 */

import { describe, it } from "vitest";
import { RuleTester } from "eslint";
import tsparser from "@typescript-eslint/parser";
import rule from "../plugins/smartout/rules/no-empty-string-identifier-fallback.mjs";

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

describe("smartout/no-empty-string-identifier-fallback", () => {
  it("accepts safe patterns and rejects identifier-column fallbacks", () => {
    ruleTester.run("no-empty-string-identifier-fallback", rule, {
      valid: [
        // Display-only string fallback — explicitly allowed.
        { code: `const name = profile?.display_name ?? "";` },
        { code: `const label = item.label ?? "";` },
        { code: `const body = message?.body ?? "";` },
        { code: `const comment = c.comment ?? "";` },
        { code: `const reason = input.reason ?? "";` },

        // Property value where the KEY is non-identifier.
        { code: `const x = { display_name: profile?.display_name ?? "" };` },
        { code: `const x = { description: opt.description ?? "" };` },

        // Empty-string fallback NOT bound to an identifier-named context.
        { code: `const result = arr.map((p) => p.display_name ?? "");` },
        { code: `function fmt(s) { return s ?? ""; }` },

        // File in allow-list: profile-context.ts itself documents the rule.
        {
          filename: "apps/mobile/src/lib/profile-context.ts",
          code: `const workspaceId = profile?.workspace_id ?? "";`,
        },

        // Test fixture file: allowed.
        {
          filename: "apps/mobile/src/foo.test.ts",
          code: `const profileId = ctx.profile_id ?? "";`,
        },

        // Non-empty-string fallback on identifier: NOT this rule's job.
        { code: `const profileId = profile?.profile_id ?? null;` },
        { code: `const workspaceId = profile?.workspace_id ?? "missing";` },

        // Display name passed through map alongside an identifier — value
        // side is display_name, not the identifier itself.
        { code: `const m = new Map(arr.map((p) => [p.profile_id, p.display_name ?? ""]));` },
      ],

      invalid: [
        // F-MO-02 pattern: variable assignment.
        {
          code: `const workspaceId = profile?.workspace_id ?? "";`,
          errors: [{ messageId: "forbidden", data: { name: "workspaceId" } }],
        },

        // F-MO-01 L68: same pattern, different identifier.
        {
          code: `const profileId = profile?.profile_id ?? "";`,
          errors: [{ messageId: "forbidden", data: { name: "profileId" } }],
        },

        // F-MO-01 L240-243: property value with identifier key.
        {
          code: `const o = { workspace_id: entry?.workspace_id ?? "" };`,
          errors: [{ messageId: "forbidden", data: { name: "workspace_id" } }],
        },
        {
          code: `const o = { profile_id: entry?.profile_id ?? "" };`,
          errors: [{ messageId: "forbidden", data: { name: "profile_id" } }],
        },
        {
          code: `const o = { time_entry_id: entry?.time_entry_id ?? "" };`,
          errors: [{ messageId: "forbidden", data: { name: "time_entry_id" } }],
        },

        // F-MO-03 pattern: read-side mapping.
        {
          code: `const out = rows.map((row) => ({ workspace_id: row.workspace_id ?? "" }));`,
          errors: [{ messageId: "forbidden", data: { name: "workspace_id" } }],
        },

        // F-MO-04 pattern: function-argument property with identifier key.
        {
          code: `initiateSwap({ target_profile_id: selected.employee_id ?? "" });`,
          errors: [{ messageId: "forbidden", data: { name: "target_profile_id" } }],
        },

        // entity_id in emit body.
        {
          code: `void emit({ properties: { entity: { entity_id: payload.session_id ?? "" } } });`,
          errors: [{ messageId: "forbidden", data: { name: "entity_id" } }],
        },

        // JSX attribute with identifier-shaped prop.
        {
          code: `const x = <Foo profileId={profile?.profile_id ?? ""} />;`,
          errors: [{ messageId: "forbidden", data: { name: "profileId" } }],
        },

        // || "" form (not just ??).
        {
          code: `const workspaceId = profile?.workspace_id || "";`,
          errors: [{ messageId: "forbidden", data: { name: "workspaceId" } }],
        },

        // channel_id read-side mapping (F-MO read-path widespread).
        {
          code: `return { channel_id: row.entity_id ?? "" };`,
          errors: [{ messageId: "forbidden", data: { name: "channel_id" } }],
        },

        // Setter call: setWorkspaceId(value ?? "").
        {
          code: `setWorkspaceId(profile?.workspace_id ?? "");`,
          errors: [{ messageId: "forbidden", data: { name: "workspaceId" } }],
        },
      ],
    });
  });
});
