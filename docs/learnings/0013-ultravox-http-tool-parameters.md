---
title: "Ultravox HTTP tools: no headers on http object, use staticParameters"
id: LEARNING_0013
status: canonical
layer: learning
created: 2026-03-01
updated: 2026-03-01
tags: [ultravox, voice-ai, stage-engine, api]
---

# Learning-0013: Ultravox HTTP Tool Parameter Constraints

## Context

Building Stage Engine Ultravox adapter tools (store, fetch, advance) that point back to the engine. Needed to pass `x-api-key` header and `session_id` query param to the callback endpoints.

## Discovery

Ultravox `http` object on `temporaryTool` only supports two fields:

- `baseUrlPattern` — must have **no query string**
- `httpMethod` — HTTP verb

Three errors hit in sequence:

1. `headers` field on `http` object → "has no field named 'headers'"
2. Query string in `baseUrlPattern` → "Base URL pattern must not contain a query string"

The correct approach uses **three parameter types** on the tool:

| Type                  | Purpose                                        | Visible to AI |
| --------------------- | ---------------------------------------------- | ------------- |
| `dynamicParameters`   | AI-chosen values (e.g. entity_type, data)      | Yes           |
| `staticParameters`    | Fixed values known at definition time          | No            |
| `automaticParameters` | System-populated at invocation (call_id, etc.) | No            |

Each parameter has a `location`:

- `PARAMETER_LOCATION_BODY` — request body
- `PARAMETER_LOCATION_QUERY` — URL query string
- `PARAMETER_LOCATION_HEADER` — HTTP header
- `PARAMETER_LOCATION_PATH` — URL path segment

**Solution**: Use `staticParameters` with `PARAMETER_LOCATION_HEADER` for `x-api-key` and `PARAMETER_LOCATION_QUERY` for `session_id`. This keeps auth in headers (not URLs) and session ID in query params, all without exposing values to the AI model.

```typescript
const staticParams = [
  { name: "session_id", location: "PARAMETER_LOCATION_QUERY", value: sessionId },
  { name: "x-api-key", location: "PARAMETER_LOCATION_HEADER", value: apiKey },
];
```

## Impact

- All Stage Engine Ultravox tool definitions must use `staticParameters` for auth/session
- Never put query strings in `baseUrlPattern`
- Never put `headers` on the `http` object
- This pattern applies to any future Ultravox HTTP tools we build

## References

- Ultravox docs: https://docs.ultravox.ai/tools/custom/parameters
- Stage Engine: `services/stage-engine/src/lib/ultravox.ts`
- Types: `services/stage-engine/src/types/ultravox.ts`
