---
title: "MCP TypeScript SDK uses single package with deep imports"
id: LEARNING_0012
status: canonical
layer: learning
created: 2026-03-01
updated: 2026-03-01
tags: [mcp, sdk, npm, imports, ai-agents]
---

# Learning-0012: MCP TypeScript SDK uses single package with deep imports

## Context

Building the Shift MCP Server (`services/shift-mcp/`). Context7 documentation showed imports from separate packages (`@modelcontextprotocol/server`, `@modelcontextprotocol/node`) which appear to be a planned v2 split that hasn't been published to npm yet.

## Discovery

The published npm package is **`@modelcontextprotocol/sdk`** (v1.27.1 as of March 2026). There are no separate `@modelcontextprotocol/server` or `@modelcontextprotocol/node` packages on npm.

Correct import paths:

| Class/Type                      | Import Path                                          |
| ------------------------------- | ---------------------------------------------------- |
| `McpServer`                     | `@modelcontextprotocol/sdk/server/mcp.js`            |
| `StreamableHTTPServerTransport` | `@modelcontextprotocol/sdk/server/streamableHttp.js` |
| `Server` (low-level)            | `@modelcontextprotocol/sdk/server`                   |
| Types (`CallToolResult`, etc.)  | `@modelcontextprotocol/sdk/types.js`                 |

The `registerTool` API accepts Zod schemas directly as `inputSchema` — no need to convert to JSON Schema manually.

For types like `CallToolResult`, it's simpler to define a local type matching the shape (`{ content: Array<{ type: "text"; text: string }>; isError?: boolean }`) rather than importing from deep SDK paths that may change between versions.

## Impact

- Always use `@modelcontextprotocol/sdk` as the npm dependency, not the v2 split packages
- Don't trust Context7 docs blindly for import paths — verify against the actual published package
- For MCP tool return types, prefer local type definitions over fragile deep SDK imports
- The `registerTool(name, config, handler)` API works in v1.27.1 alongside the older `tool()` API

## References

- ADR-0036: Shift MCP Server
- `services/shift-mcp/package.json` — uses `@modelcontextprotocol/sdk@^1.27.1`
- [npm: @modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk)

---

> Registered in `docs/learnings/0000-learning-log.md`.
