# Stage Engine Startup Blockers (2026-03-03)

## BLOCKER 1: Module resolution mismatch (CRITICAL)

### Symptom

```
SyntaxError: The requested module '@smartout/types' does not provide an export named 'UserActionSchema'
```

### Root Cause

Three-part mismatch:

1. `@smartout/types` and `@smartout/ai` use `moduleResolution: "bundler"` in tsconfig
2. Their `package.json` files lack `"type": "module"`
3. Their compiled dist files use ESM syntax (`export *` / `import`) with NO `.js` extensions

The stage-engine uses `module: "NodeNext"` + `moduleResolution: "NodeNext"` + `"type": "module"`, which requires `.js` extensions for ESM resolution.

When Node.js loads `@smartout/types/dist/index.js`:

- No `"type": "module"` -> Node treats it as CJS initially
- Detects ESM syntax -> retries as ESM
- Hits `export * from "./enums"` (no .js) -> fails to resolve

### Fix Options

**Option A (quickest)**: Add `"type": "module"` to `packages/types/package.json` and `packages/ai/package.json`. Then fix all import paths in their source to include `.js` extensions. Rebuild. This makes them proper ESM packages.

**Option B**: Change stage-engine tsconfig to `moduleResolution: "bundler"` and remove `"type": "module"` from its package.json. Run via tsx (which handles this). But this breaks the Dockerfile/production path.

**Option C**: Add `"exports"` field to types/ai package.json that properly maps subpath exports, keeping bundler moduleResolution for Next.js consumers.

**Recommendation**: Option A is cleanest. All packages should be proper ESM since the project is TypeScript-everywhere with Vercel/Node.js targets.

## ISSUE 2: onboarding-interview mission has NULL system_prompt

The `system_prompt` column on `engine_missions` was added in migration `20260318120000`, AFTER the seed in `20260314300000`. The seed doesn't set it. Lise's personality (voice persona prompt) is not in the DB.

### Fix

UPDATE migration or new migration to set system_prompt for onboarding-interview with Lise's personality.

## ISSUE 3: onboarding-main stage at order 0

The onboarding-interview mission has 7 stages (order 0-6). Stage at order 0 is "onboarding-main" with `next_stage: null`. The original seed starts at order 1 ("greeting"). Since this is sequential mode, the engine picks `stages[0]` as the first stage, which is "onboarding-main" -- NOT "greeting".

The "onboarding-main" stage has no next_stage, so the session would get stuck after stage 0.

### Fix

Either remove "onboarding-main" or update it to have `next_stage: "greeting"`, or reorder stages so "greeting" is at order 0.

## ISSUE 4: Ultravox tools require HTTPS (known, documented)

In `routes/adapters/ultravox.ts` line 68-72:

```ts
const isLocalDev = config.ENGINE_URL.startsWith("http://");
const tools = isLocalDev ? [] : buildUltravoxTools(...);
```

Local dev skips tools. Voice works but without store/fetch/advance tools. Not a blocker for text/chat mode but limits voice testing.

## ISSUE 5: Missing .env.example

The stage-engine has `.env` (empty, 0 bytes) and `.env.local` (596 bytes, contains secrets). No `.env.example` file documents required vars. New developers won't know what to configure.

## ISSUE 6: agent_router.ts depends on @smartout/ai deep imports

The agent router imports from:

- `@smartout/ai/router/intent-classifier`
- `@smartout/ai/router/tool-selector`
- `@smartout/ai/prompts/mr-botsson`
- `@smartout/ai/adapters/vercel-ai`
- `@smartout/ai/context/collector`
- `@smartout/ai/capabilities/types`

These all require the AI package to be built AND have proper exports mapping. The `@smartout/ai` package.json has all these exports defined, and dist exists. But the same module resolution issue from Blocker 1 may apply here too.
