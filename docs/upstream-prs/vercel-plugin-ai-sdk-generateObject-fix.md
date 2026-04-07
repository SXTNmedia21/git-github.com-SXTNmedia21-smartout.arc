---
title: Upstream PR draft — vercel-plugin/ai-sdk generateObject false-positive
status: ready-to-file
created: 2026-04-07
updated: 2026-04-07
module: ai-agent
tags: [upstream-pr, vercel-plugin, ai-sdk]
---

# Upstream PR Draft: vercel-plugin/ai-sdk generateObject false-positive

> Ready to file. Pontus has GitHub access; this doc captures the body, evidence,
> and exact diff so the PR can be opened in 2 minutes.

## Where to file

**Repo**: `vercel/vercel-plugin` (or wherever the canonical Claude Code Vercel
plugin source lives — verify before filing). The cache copies live at
`~/.claude/plugins/cache/vercel-vercel-plugin/vercel-plugin/0.31.0/skills/ai-sdk/`
which suggests the plugin name is `vercel-plugin` under the `vercel` org.

## Title

```
fix(ai-sdk): generateObject is deprecated, not removed — downgrade severity
```

## Body

```markdown
## Problem

The `ai-sdk` skill's PostToolUse validator emits an ERROR-severity rule
claiming `generateObject` was removed in AI SDK v6:

> generateObject was removed in AI SDK v6 — use generateText with output:
> Output.object({ schema }) instead. Run Skill(ai-sdk) for v6 structured
> output guidance.

This is wrong on two counts:

1. **`generateObject` is NOT removed.** It is exported and functional in
   `ai@6.0.103` (the latest at time of writing). Verified by reading the
   actually-installed `node_modules/.pnpm/ai@6.0.103/dist/index.d.ts`:
   - **Line 5158**: `declare function generateObject<...>(options): Promise<GenerateObjectResult<RESULT>>`
   - **Line 6383**: included in the named export list (`...generateImage, generateObject, generateText...`)
   - The accompanying `NoObjectGeneratedError` class is also still exported

2. **The plugin's own upstream `references/common-errors.md:73`** correctly
   states the function "is deprecated. Use `generateText` with the `output`
   option instead." Deprecated ≠ removed. The validator rule conflates them.

## Impact

The ERROR severity blocks Edit/Write on any file mentioning `generateObject`,
including JSDoc comments that merely *reference* the function name. This blocks
legitimate work on production codebases that still use `generateObject` (which
is fine — it's deprecated, not removed) AND blocks code that documents the
deprecation in comments.

## Empirical verification

We hit this in the Smartout codebase while building an evaluation harness for
our agent system. The validator blocked our intent classifier work for an
entire session, then required us to patch the rule in 10 files across 4 plugin
cache directories (including the `generated/skill-manifest.json` files which
are what the validator actually loads at runtime, not just the source YAML).

We then verified the underlying function works correctly:

```js
import { generateObject } from "ai";
import { z } from "zod";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
const result = await generateObject({
  model: openrouter("anthropic/claude-sonnet-4.6"),
  schema: z.object({ capability: z.string(), confidence: z.number() }),
  system: "Classify the user message.",
  prompt: "When am I working next week?",
});
console.log(result.object); // { capability: "schedule", confidence: 0.95 }
```

This call succeeds. `generateObject` is alive and well in v6.

## Proposed fix

Change two fields in the rule definition (lives in `skills/ai-sdk/overlay.yaml`
and is also baked into `skills/ai-sdk/SKILL.md` and the generated
`skill-manifest.json`):

```diff
   -
     pattern: generateObject\s*\(
-    message: 'generateObject was removed in AI SDK v6 — use generateText with output: Output.object({ schema }) instead. Run Skill(ai-sdk) for v6 structured output guidance.'
+    message: 'generateObject is deprecated in AI SDK v6 (still exported and functional in ai@6.0.103, verified 2026-04-07). Prefer generateText with output: Output.object({ schema }) for new code. Run Skill(ai-sdk) for migration guidance.'
-    severity: error
+    severity: recommended
     upgradeToSkill: ai-sdk
     upgradeWhy: 'Guides migration from generateObject to generateText + Output.object() with correct imports and schema patterns.'
     skipIfFileContains: Output\.object
```

## Verification after fix

After this change, editing a file containing `generateObject(...)` should
produce a `[RECOMMENDED]` validator hint with the corrected message text and
no longer block the edit. The user can choose to migrate now or defer until
Vercel actually removes the function (which has not happened in v6.x).

## Alternative

If the `severity: recommended` change is contentious, we'd accept just the
**message text fix** (removing "removed" → "deprecated"). The current text is
factually wrong regardless of severity.
```

## Evidence to attach

1. Screenshot of grep against `node_modules/.pnpm/ai@6.0.103/dist/index.d.ts`
   showing the export.
2. Link to Vercel's own `references/common-errors.md` line 73 (saying "is deprecated").
3. Link to `docs/decisions/0073-ai-eval-harness.md` in this repo for the
   full investigation context.

## Local workaround until upstream merges

We ship `scripts/patch-vercel-plugin-ai-sdk.mjs` which idempotently re-applies
this fix to all 10 cache copies after any plugin update. Documented in
`docs/STATE.md` under "Known environment quirks".
