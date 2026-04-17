# strike-mcp Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the foundational skeleton of `strike-mcp` — a TypeScript MCP server with a Bubble Data API client, exposing two discovery tools (`list_workspaces`, `inspect_workspace`) so an agent running in Claude Code can enumerate Smartout Bubble workspaces and get a scope overview of one.

**Architecture:** Standalone pnpm package at `~/dev/strike-mcp/`. TypeScript + Node.js 24 LTS. Stdio MCP transport via `@modelcontextprotocol/sdk`. Own Bubble Data API client (not reusing `bubble-mcp` runtime) that handles the three iron rules from `bubble-salary-mcp` skill: sparse records, display names, no reliable server-side filtering. All secrets from environment variables (the user loads them from 1Password).

**Tech Stack:** TypeScript 5.x, Node.js 24 LTS, pnpm, `@modelcontextprotocol/sdk`, `zod` (tool input schemas), `vitest` (tests).

**Source of truth for Bubble Data API shape:** `~/.claude/skills/bubble-salary-mcp/SKILL.md` — read this before starting any task that touches the client.

---

## File Structure

```
~/dev/strike-mcp/
├── .gitignore
├── .mcp.json.example               # how to register the server in Claude Code
├── README.md                        # how to run it locally
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── vitest.config.ts
├── docs/
│   └── superpowers/
│       ├── specs/2026-04-07-strike-mcp-design.md   # already exists
│       └── plans/2026-04-07-strike-mcp-phase-1.md  # this file
├── src/
│   ├── index.ts                    # MCP server entry point, stdio transport
│   ├── config.ts                   # env var loading + validation
│   ├── logger.ts                   # stderr-only logger (stdout is MCP protocol)
│   ├── bubble/
│   │   ├── client.ts               # BubbleClient class
│   │   ├── types.ts                # Bubble API response types
│   │   └── errors.ts               # typed errors
│   ├── tools/
│   │   ├── list_workspaces.ts
│   │   └── inspect_workspace.ts
│   └── entities.ts                 # registry of known Bubble entity types
└── tests/
    ├── fixtures/
    │   ├── bubble_list_workspaces.json
    │   ├── bubble_list_empty.json
    │   └── bubble_list_paginated.json
    ├── bubble/
    │   ├── client.test.ts
    │   └── errors.test.ts
    ├── tools/
    │   ├── list_workspaces.test.ts
    │   └── inspect_workspace.test.ts
    └── config.test.ts
```

**Decomposition rationale:**

- `bubble/client.ts` is the only file that touches the network. Everything else is pure.
- Tools are one file each so they can be tested in isolation.
- `entities.ts` is the single source of truth for "which Bubble types exist in Smartout" — Phase 2's research engine will read from the same registry.
- `logger.ts` is its own file because it is load-bearing: writing to `stdout` corrupts MCP stdio protocol, so we need one enforced place where logging goes to `stderr`.

---

## Task 1: Initialize the pnpm package

**Files:**
- Create: `~/dev/strike-mcp/package.json`
- Create: `~/dev/strike-mcp/tsconfig.json`
- Create: `~/dev/strike-mcp/.gitignore`
- Create: `~/dev/strike-mcp/vitest.config.ts`
- Create: `~/dev/strike-mcp/README.md`

- [ ] **Step 1: Create the project directory and init git**

```bash
mkdir -p ~/dev/strike-mcp
cd ~/dev/strike-mcp
git init
```

Expected: `Initialized empty Git repository in /home/sxtnl/dev/strike-mcp/.git/`.

- [ ] **Step 2: Write `package.json`**

Create `~/dev/strike-mcp/package.json`:

```json
{
  "name": "strike-mcp",
  "version": "0.1.0",
  "description": "Bubble.io → Smartout v3 workspace migrator MCP server",
  "type": "module",
  "private": true,
  "engines": {
    "node": ">=24.0.0"
  },
  "bin": {
    "strike-mcp": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 3: Write `tsconfig.json`**

Create `~/dev/strike-mcp/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": false,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 4: Write `.gitignore`**

Create `~/dev/strike-mcp/.gitignore`:

```
node_modules/
dist/
.env
.env.local
*.log
.DS_Store
coverage/
.vitest-cache/
```

- [ ] **Step 5: Write `vitest.config.ts`**

Create `~/dev/strike-mcp/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    globals: false,
  },
});
```

- [ ] **Step 6: Write minimal `README.md`**

Create `~/dev/strike-mcp/README.md`:

```markdown
# strike-mcp

MCP server that migrates a Bubble.io workspace into Smartout v3 Supabase, one entity at a time, under agent control.

See `docs/superpowers/specs/2026-04-07-strike-mcp-design.md` for the design.

## Running locally

1. Install dependencies: `pnpm install`
2. Build: `pnpm build`
3. Set environment variables (see `.mcp.json.example`)
4. Register with Claude Code using `.mcp.json.example` as reference

## Tests

`pnpm test`
```

- [ ] **Step 7: Install dependencies**

```bash
cd ~/dev/strike-mcp
pnpm install
```

Expected: `pnpm-lock.yaml` created, `node_modules/` populated, no errors.

- [ ] **Step 8: Verify the toolchain works**

```bash
cd ~/dev/strike-mcp
pnpm typecheck
pnpm test
```

Expected: `typecheck` succeeds silently (no source files yet). `test` reports "No test files found" and exits 0.

- [ ] **Step 9: Commit**

```bash
cd ~/dev/strike-mcp
git add -A
git commit -m "chore: initialize strike-mcp pnpm package"
```

---

## Task 2: Logger utility (stderr-only)

**Files:**
- Create: `~/dev/strike-mcp/src/logger.ts`
- Test: `~/dev/strike-mcp/tests/logger.test.ts`

**Why first:** The MCP protocol owns `stdout` for stdio transport. Any stray `console.log` corrupts the JSON-RPC framing and the server silently breaks. The logger must write to `stderr` exclusively. We build this before anything else so that every subsequent file can depend on it.

- [ ] **Step 1: Write the failing test**

Create `~/dev/strike-mcp/tests/logger.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createLogger } from "../src/logger.js";

describe("logger", () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    stdoutSpy.mockRestore();
  });

  it("writes info messages to stderr, not stdout", () => {
    const log = createLogger("test");
    log.info("hello");
    expect(stderrSpy).toHaveBeenCalled();
    expect(stdoutSpy).not.toHaveBeenCalled();
  });

  it("includes the scope name in the output", () => {
    const log = createLogger("bubble-client");
    log.info("fetching");
    const call = stderrSpy.mock.calls[0]?.[0]?.toString() ?? "";
    expect(call).toContain("bubble-client");
    expect(call).toContain("fetching");
  });

  it("serializes structured fields", () => {
    const log = createLogger("test");
    log.info("event", { count: 42, name: "alpha" });
    const call = stderrSpy.mock.calls[0]?.[0]?.toString() ?? "";
    expect(call).toContain("count=42");
    expect(call).toContain('name="alpha"');
  });

  it("has warn and error methods that also go to stderr", () => {
    const log = createLogger("test");
    log.warn("careful");
    log.error("broken");
    expect(stderrSpy).toHaveBeenCalledTimes(2);
    expect(stdoutSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd ~/dev/strike-mcp
pnpm test
```

Expected: FAIL — `Cannot find module '../src/logger.js'` or similar.

- [ ] **Step 3: Implement the logger**

Create `~/dev/strike-mcp/src/logger.ts`:

```ts
type Level = "info" | "warn" | "error";

type Fields = Record<string, string | number | boolean | null | undefined>;

export interface Logger {
  info(message: string, fields?: Fields): void;
  warn(message: string, fields?: Fields): void;
  error(message: string, fields?: Fields): void;
}

function formatFields(fields?: Fields): string {
  if (!fields) return "";
  const parts: string[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string") {
      parts.push(`${key}="${value.replace(/"/g, '\\"')}"`);
    } else {
      parts.push(`${key}=${value}`);
    }
  }
  return parts.length ? " " + parts.join(" ") : "";
}

function write(level: Level, scope: string, message: string, fields?: Fields): void {
  const timestamp = new Date().toISOString();
  const line = `${timestamp} ${level.toUpperCase()} [${scope}] ${message}${formatFields(fields)}\n`;
  process.stderr.write(line);
}

export function createLogger(scope: string): Logger {
  return {
    info: (message, fields) => write("info", scope, message, fields),
    warn: (message, fields) => write("warn", scope, message, fields),
    error: (message, fields) => write("error", scope, message, fields),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd ~/dev/strike-mcp
pnpm test
```

Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
cd ~/dev/strike-mcp
git add -A
git commit -m "feat(logger): add stderr-only logger that never touches stdout"
```

---

## Task 3: Config loading from environment

**Files:**
- Create: `~/dev/strike-mcp/src/config.ts`
- Test: `~/dev/strike-mcp/tests/config.test.ts`

**What we need from the environment:**
- `BUBBLE_APP_URL` — base URL of the Bubble app (e.g. `https://smartout.bubbleapps.io`)
- `BUBBLE_API_TOKEN` — Bearer token for Data API authentication

- [ ] **Step 1: Write the failing test**

Create `~/dev/strike-mcp/tests/config.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { loadConfig, ConfigError } from "../src/config.js";

describe("loadConfig", () => {
  it("returns a valid config when all env vars are present", () => {
    const env = {
      BUBBLE_APP_URL: "https://smartout.bubbleapps.io",
      BUBBLE_API_TOKEN: "secret-token",
    };
    const config = loadConfig(env);
    expect(config.bubbleAppUrl).toBe("https://smartout.bubbleapps.io");
    expect(config.bubbleApiToken).toBe("secret-token");
  });

  it("strips a trailing slash from BUBBLE_APP_URL", () => {
    const env = {
      BUBBLE_APP_URL: "https://smartout.bubbleapps.io/",
      BUBBLE_API_TOKEN: "secret-token",
    };
    const config = loadConfig(env);
    expect(config.bubbleAppUrl).toBe("https://smartout.bubbleapps.io");
  });

  it("throws ConfigError when BUBBLE_APP_URL is missing", () => {
    expect(() => loadConfig({ BUBBLE_API_TOKEN: "x" })).toThrow(ConfigError);
    expect(() => loadConfig({ BUBBLE_API_TOKEN: "x" })).toThrow(/BUBBLE_APP_URL/);
  });

  it("throws ConfigError when BUBBLE_API_TOKEN is missing", () => {
    expect(() => loadConfig({ BUBBLE_APP_URL: "https://x" })).toThrow(ConfigError);
    expect(() => loadConfig({ BUBBLE_APP_URL: "https://x" })).toThrow(/BUBBLE_API_TOKEN/);
  });

  it("throws ConfigError when BUBBLE_APP_URL is not http(s)", () => {
    expect(() =>
      loadConfig({ BUBBLE_APP_URL: "smartout.bubbleapps.io", BUBBLE_API_TOKEN: "x" }),
    ).toThrow(/must start with http/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd ~/dev/strike-mcp
pnpm test
```

Expected: FAIL — `Cannot find module '../src/config.js'`.

- [ ] **Step 3: Implement `config.ts`**

Create `~/dev/strike-mcp/src/config.ts`:

```ts
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export interface Config {
  bubbleAppUrl: string;
  bubbleApiToken: string;
}

export function loadConfig(env: Record<string, string | undefined>): Config {
  const rawUrl = env.BUBBLE_APP_URL;
  const token = env.BUBBLE_API_TOKEN;

  if (!rawUrl || rawUrl.trim() === "") {
    throw new ConfigError("BUBBLE_APP_URL environment variable is required");
  }
  if (!token || token.trim() === "") {
    throw new ConfigError("BUBBLE_API_TOKEN environment variable is required");
  }
  if (!rawUrl.startsWith("http://") && !rawUrl.startsWith("https://")) {
    throw new ConfigError("BUBBLE_APP_URL must start with http:// or https://");
  }

  const bubbleAppUrl = rawUrl.replace(/\/+$/, "");
  return { bubbleAppUrl, bubbleApiToken: token };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd ~/dev/strike-mcp
pnpm test
```

Expected: all 5 config tests pass, 4 logger tests still pass.

- [ ] **Step 5: Commit**

```bash
cd ~/dev/strike-mcp
git add -A
git commit -m "feat(config): add env-based config loader with validation"
```

---

## Task 4: Bubble client — errors and types

**Files:**
- Create: `~/dev/strike-mcp/src/bubble/errors.ts`
- Create: `~/dev/strike-mcp/src/bubble/types.ts`
- Test: `~/dev/strike-mcp/tests/bubble/errors.test.ts`

**Context for the implementer:** The Bubble Data API returns JSON responses of the form:

```json
{
  "response": {
    "results": [ /* records */ ],
    "cursor": 0,
    "count": 100,
    "remaining": 1348
  }
}
```

On error it returns HTTP 4xx/5xx with a JSON body like `{ "statusCode": 401, "body": { "error": "invalid token" } }`. The client must surface these as typed errors, not throw raw `Error`.

- [ ] **Step 1: Write the failing test**

Create `~/dev/strike-mcp/tests/bubble/errors.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  BubbleApiError,
  BubbleAuthError,
  BubbleNotFoundError,
  BubbleRateLimitError,
  bubbleErrorFromResponse,
} from "../../src/bubble/errors.js";

describe("bubble errors", () => {
  it("401 becomes BubbleAuthError", () => {
    const err = bubbleErrorFromResponse(401, { error: "invalid token" });
    expect(err).toBeInstanceOf(BubbleAuthError);
    expect(err.message).toContain("invalid token");
  });

  it("404 becomes BubbleNotFoundError", () => {
    const err = bubbleErrorFromResponse(404, { error: "type not found" });
    expect(err).toBeInstanceOf(BubbleNotFoundError);
  });

  it("429 becomes BubbleRateLimitError", () => {
    const err = bubbleErrorFromResponse(429, { error: "slow down" });
    expect(err).toBeInstanceOf(BubbleRateLimitError);
  });

  it("500 becomes generic BubbleApiError", () => {
    const err = bubbleErrorFromResponse(500, { error: "internal" });
    expect(err).toBeInstanceOf(BubbleApiError);
    expect(err).not.toBeInstanceOf(BubbleAuthError);
    expect(err.statusCode).toBe(500);
  });

  it("handles body without error field", () => {
    const err = bubbleErrorFromResponse(500, null);
    expect(err).toBeInstanceOf(BubbleApiError);
    expect(err.message).toContain("500");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd ~/dev/strike-mcp
pnpm test
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `errors.ts`**

Create `~/dev/strike-mcp/src/bubble/errors.ts`:

```ts
export class BubbleApiError extends Error {
  readonly statusCode: number;
  readonly body: unknown;

  constructor(message: string, statusCode: number, body: unknown) {
    super(message);
    this.name = "BubbleApiError";
    this.statusCode = statusCode;
    this.body = body;
  }
}

export class BubbleAuthError extends BubbleApiError {
  constructor(message: string, body: unknown) {
    super(message, 401, body);
    this.name = "BubbleAuthError";
  }
}

export class BubbleNotFoundError extends BubbleApiError {
  constructor(message: string, body: unknown) {
    super(message, 404, body);
    this.name = "BubbleNotFoundError";
  }
}

export class BubbleRateLimitError extends BubbleApiError {
  constructor(message: string, body: unknown) {
    super(message, 429, body);
    this.name = "BubbleRateLimitError";
  }
}

function extractMessage(body: unknown, fallback: string): string {
  if (
    body &&
    typeof body === "object" &&
    "error" in body &&
    typeof (body as { error: unknown }).error === "string"
  ) {
    return (body as { error: string }).error;
  }
  return fallback;
}

export function bubbleErrorFromResponse(
  statusCode: number,
  body: unknown,
): BubbleApiError {
  const fallback = `Bubble API error ${statusCode}`;
  const message = extractMessage(body, fallback);
  switch (statusCode) {
    case 401:
    case 403:
      return new BubbleAuthError(message, body);
    case 404:
      return new BubbleNotFoundError(message, body);
    case 429:
      return new BubbleRateLimitError(message, body);
    default:
      return new BubbleApiError(message, statusCode, body);
  }
}
```

- [ ] **Step 4: Implement `types.ts`**

Create `~/dev/strike-mcp/src/bubble/types.ts`:

```ts
/**
 * A raw record from the Bubble Data API. Fields are sparse — two records of the
 * same type will have DIFFERENT key sets depending on which fields are populated
 * on each individual record. See bubble-salary-mcp skill, Iron Rule 1.
 *
 * Keys are DISPLAY NAMES (from the Bubble UI), not schema field IDs. They may
 * contain spaces, dots, emojis, and 🟢 markers. See Iron Rule 2.
 */
export type BubbleRecord = Record<string, unknown> & { _id: string };

/**
 * Response shape from `GET /api/1.1/obj/<type>`.
 */
export interface BubbleListResponse {
  response: {
    results: BubbleRecord[];
    cursor: number;
    count: number;
    remaining: number;
  };
}

/**
 * Response shape from `GET /api/1.1/meta`.
 * The meta endpoint returns schema for every type in the app.
 */
export interface BubbleMetaResponse {
  get: Record<string, BubbleTypeMeta>;
  post: Record<string, BubbleTypeMeta>;
}

export interface BubbleTypeMeta {
  fields: Record<string, BubbleFieldMeta>;
}

export interface BubbleFieldMeta {
  display: string;
  type: string;
}

/**
 * A constraint for the Bubble Data API `constraints` query parameter.
 * NOTE: Server-side filtering is unreliable on Bubble. Always verify results
 * client-side. See bubble-salary-mcp skill.
 */
export interface BubbleConstraint {
  key: string;
  constraint_type:
    | "equals"
    | "not equal"
    | "is_empty"
    | "is_not_empty"
    | "text contains"
    | "greater than"
    | "less than";
  value?: string | number | boolean | null;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd ~/dev/strike-mcp
pnpm test
pnpm typecheck
```

Expected: all 5 error tests pass, typecheck clean.

- [ ] **Step 6: Commit**

```bash
cd ~/dev/strike-mcp
git add -A
git commit -m "feat(bubble): add typed errors and Data API response types"
```

---

## Task 5: Bubble client — fetch wrapper

**Files:**
- Create: `~/dev/strike-mcp/src/bubble/client.ts`
- Create: `~/dev/strike-mcp/tests/bubble/client.test.ts`
- Create: `~/dev/strike-mcp/tests/fixtures/bubble_list_workspaces.json`
- Create: `~/dev/strike-mcp/tests/fixtures/bubble_list_empty.json`
- Create: `~/dev/strike-mcp/tests/fixtures/bubble_list_paginated.json`

**Context:** We inject `fetch` into the client so tests can mock it. No real HTTP in unit tests.

- [ ] **Step 1: Create fixture — workspaces list (first page)**

Create `~/dev/strike-mcp/tests/fixtures/bubble_list_workspaces.json`:

```json
{
  "response": {
    "results": [
      {
        "_id": "1612345678901x111111111111111111",
        "Created Date": "2023-01-15T10:00:00.000Z",
        "Modified Date": "2026-03-20T08:42:00.000Z",
        "name_text": "Strøm Mat & Bar"
      },
      {
        "_id": "1612345678902x222222222222222222",
        "Created Date": "2023-02-01T09:00:00.000Z",
        "Modified Date": "2026-01-10T14:00:00.000Z",
        "name_text": "Kafé Ost"
      }
    ],
    "cursor": 0,
    "count": 2,
    "remaining": 0
  }
}
```

- [ ] **Step 2: Create fixture — empty list**

Create `~/dev/strike-mcp/tests/fixtures/bubble_list_empty.json`:

```json
{
  "response": {
    "results": [],
    "cursor": 0,
    "count": 0,
    "remaining": 0
  }
}
```

- [ ] **Step 3: Create fixture — paginated response (first page, remaining > 0)**

Create `~/dev/strike-mcp/tests/fixtures/bubble_list_paginated.json`:

```json
{
  "response": {
    "results": [
      { "_id": "a1", "name_text": "A" },
      { "_id": "a2", "name_text": "B" }
    ],
    "cursor": 0,
    "count": 2,
    "remaining": 3
  }
}
```

- [ ] **Step 4: Write the failing test for `BubbleClient.listType`**

Create `~/dev/strike-mcp/tests/bubble/client.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BubbleClient } from "../../src/bubble/client.js";
import { BubbleAuthError, BubbleApiError } from "../../src/bubble/errors.js";

function loadFixture(name: string): unknown {
  const path = resolve(__dirname, "..", "fixtures", name);
  return JSON.parse(readFileSync(path, "utf-8"));
}

function mockFetch(
  response: { status: number; body: unknown },
): typeof fetch {
  return vi.fn(async () => {
    return new Response(JSON.stringify(response.body), {
      status: response.status,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
}

describe("BubbleClient.listType", () => {
  it("fetches records and returns results + cursor metadata", async () => {
    const fixture = loadFixture("bubble_list_workspaces.json");
    const client = new BubbleClient(
      {
        bubbleAppUrl: "https://smartout.bubbleapps.io",
        bubbleApiToken: "tok",
      },
      mockFetch({ status: 200, body: fixture }),
    );

    const page = await client.listType("workspace", { cursor: 0, limit: 100 });

    expect(page.results).toHaveLength(2);
    expect(page.results[0]._id).toBe("1612345678901x111111111111111111");
    expect(page.cursor).toBe(0);
    expect(page.count).toBe(2);
    expect(page.remaining).toBe(0);
  });

  it("sends the Bearer token in the Authorization header", async () => {
    const fixture = loadFixture("bubble_list_empty.json");
    const spy = vi.fn(async () => {
      return new Response(JSON.stringify(fixture), { status: 200 });
    }) as unknown as typeof fetch;

    const client = new BubbleClient(
      {
        bubbleAppUrl: "https://smartout.bubbleapps.io",
        bubbleApiToken: "my-secret",
      },
      spy,
    );
    await client.listType("workspace", { cursor: 0, limit: 100 });

    const call = (spy as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const init = call[1] as RequestInit;
    expect(init.headers).toBeDefined();
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer my-secret");
  });

  it("builds the correct URL with cursor and limit params", async () => {
    const fixture = loadFixture("bubble_list_empty.json");
    const spy = vi.fn(async () => {
      return new Response(JSON.stringify(fixture), { status: 200 });
    }) as unknown as typeof fetch;

    const client = new BubbleClient(
      {
        bubbleAppUrl: "https://smartout.bubbleapps.io",
        bubbleApiToken: "tok",
      },
      spy,
    );
    await client.listType("shift_satellite", { cursor: 200, limit: 50 });

    const url = (spy as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain("/api/1.1/obj/shift_satellite");
    expect(url).toContain("cursor=200");
    expect(url).toContain("limit=50");
  });

  it("throws BubbleAuthError on 401", async () => {
    const client = new BubbleClient(
      {
        bubbleAppUrl: "https://smartout.bubbleapps.io",
        bubbleApiToken: "tok",
      },
      mockFetch({ status: 401, body: { error: "invalid token" } }),
    );
    await expect(
      client.listType("workspace", { cursor: 0, limit: 100 }),
    ).rejects.toBeInstanceOf(BubbleAuthError);
  });

  it("throws BubbleApiError on 500", async () => {
    const client = new BubbleClient(
      {
        bubbleAppUrl: "https://smartout.bubbleapps.io",
        bubbleApiToken: "tok",
      },
      mockFetch({ status: 500, body: { error: "boom" } }),
    );
    await expect(
      client.listType("workspace", { cursor: 0, limit: 100 }),
    ).rejects.toBeInstanceOf(BubbleApiError);
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

```bash
cd ~/dev/strike-mcp
pnpm test
```

Expected: FAIL — module not found.

- [ ] **Step 6: Implement `BubbleClient.listType`**

Create `~/dev/strike-mcp/src/bubble/client.ts`:

```ts
import { createLogger } from "../logger.js";
import type { Config } from "../config.js";
import type {
  BubbleListResponse,
  BubbleRecord,
  BubbleConstraint,
} from "./types.js";
import { bubbleErrorFromResponse } from "./errors.js";

const log = createLogger("bubble-client");

export interface ListPage {
  results: BubbleRecord[];
  cursor: number;
  count: number;
  remaining: number;
}

export interface ListOptions {
  cursor: number;
  limit: number;
  constraints?: BubbleConstraint[];
}

export class BubbleClient {
  private readonly config: Config;
  private readonly fetchImpl: typeof fetch;

  constructor(config: Config, fetchImpl: typeof fetch = globalThis.fetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  async listType(bubbleType: string, opts: ListOptions): Promise<ListPage> {
    const url = this.buildListUrl(bubbleType, opts);
    log.info("list request", {
      type: bubbleType,
      cursor: opts.cursor,
      limit: opts.limit,
    });

    const res = await this.fetchImpl(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.config.bubbleApiToken}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const body = await this.safeJson(res);
      throw bubbleErrorFromResponse(res.status, body);
    }

    const json = (await res.json()) as BubbleListResponse;
    return {
      results: json.response.results,
      cursor: json.response.cursor,
      count: json.response.count,
      remaining: json.response.remaining,
    };
  }

  private buildListUrl(bubbleType: string, opts: ListOptions): string {
    const params = new URLSearchParams();
    params.set("cursor", String(opts.cursor));
    params.set("limit", String(opts.limit));
    if (opts.constraints && opts.constraints.length > 0) {
      params.set("constraints", JSON.stringify(opts.constraints));
    }
    return `${this.config.bubbleAppUrl}/api/1.1/obj/${encodeURIComponent(
      bubbleType,
    )}?${params.toString()}`;
  }

  private async safeJson(res: Response): Promise<unknown> {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }
}
```

- [ ] **Step 7: Run the test to verify it passes**

```bash
cd ~/dev/strike-mcp
pnpm test
```

Expected: all 5 client tests pass. All previous tests still pass.

- [ ] **Step 8: Commit**

```bash
cd ~/dev/strike-mcp
git add -A
git commit -m "feat(bubble): add BubbleClient.listType with auth, pagination params, typed errors"
```

---

## Task 6: Bubble client — paginated collection

**Files:**
- Modify: `~/dev/strike-mcp/src/bubble/client.ts` (add `listAll` method)
- Modify: `~/dev/strike-mcp/tests/bubble/client.test.ts` (add `listAll` tests)

**Why:** `inspect_workspace` needs to count ALL records of a type belonging to a workspace, not just the first page. Bubble caps pages at 100 records, so we need a loop that follows `remaining > 0`.

- [ ] **Step 1: Write the failing test for `listAll`**

Append to `~/dev/strike-mcp/tests/bubble/client.test.ts`:

```ts
describe("BubbleClient.listAll", () => {
  it("follows pagination until remaining is 0", async () => {
    let callCount = 0;
    const spy = vi.fn(async (url: string) => {
      callCount++;
      const urlObj = new URL(url as string);
      const cursor = Number(urlObj.searchParams.get("cursor"));
      if (cursor === 0) {
        return new Response(
          JSON.stringify({
            response: {
              results: [{ _id: "a" }, { _id: "b" }],
              cursor: 0,
              count: 2,
              remaining: 2,
            },
          }),
          { status: 200 },
        );
      }
      if (cursor === 2) {
        return new Response(
          JSON.stringify({
            response: {
              results: [{ _id: "c" }, { _id: "d" }],
              cursor: 2,
              count: 2,
              remaining: 0,
            },
          }),
          { status: 200 },
        );
      }
      return new Response("{}", { status: 500 });
    }) as unknown as typeof fetch;

    const client = new BubbleClient(
      { bubbleAppUrl: "https://x", bubbleApiToken: "t" },
      spy,
    );
    const all = await client.listAll("shift_satellite", {});

    expect(all).toHaveLength(4);
    expect(all.map((r) => r._id)).toEqual(["a", "b", "c", "d"]);
    expect(callCount).toBe(2);
  });

  it("stops at maxRecords if provided", async () => {
    const spy = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          response: {
            results: Array.from({ length: 100 }, (_, i) => ({ _id: `r${i}` })),
            cursor: 0,
            count: 100,
            remaining: 900,
          },
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const client = new BubbleClient(
      { bubbleAppUrl: "https://x", bubbleApiToken: "t" },
      spy,
    );
    const limited = await client.listAll("shift_satellite", { maxRecords: 100 });

    expect(limited).toHaveLength(100);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("returns empty array when there are no records", async () => {
    const spy = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          response: { results: [], cursor: 0, count: 0, remaining: 0 },
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const client = new BubbleClient(
      { bubbleAppUrl: "https://x", bubbleApiToken: "t" },
      spy,
    );
    const all = await client.listAll("workspace", {});
    expect(all).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd ~/dev/strike-mcp
pnpm test
```

Expected: FAIL — `listAll is not a function`.

- [ ] **Step 3: Implement `listAll`**

Append to the `BubbleClient` class in `~/dev/strike-mcp/src/bubble/client.ts` (add these method + interface before the closing brace of the class, and add the `ListAllOptions` interface near `ListOptions`):

```ts
export interface ListAllOptions {
  constraints?: BubbleConstraint[];
  pageSize?: number;
  maxRecords?: number;
}
```

Add inside the `BubbleClient` class:

```ts
  async listAll(
    bubbleType: string,
    opts: ListAllOptions,
  ): Promise<BubbleRecord[]> {
    const pageSize = opts.pageSize ?? 100;
    const out: BubbleRecord[] = [];
    let cursor = 0;

    while (true) {
      const page = await this.listType(bubbleType, {
        cursor,
        limit: pageSize,
        constraints: opts.constraints,
      });
      out.push(...page.results);

      if (opts.maxRecords !== undefined && out.length >= opts.maxRecords) {
        return out.slice(0, opts.maxRecords);
      }
      if (page.remaining <= 0 || page.results.length === 0) {
        return out;
      }
      cursor += page.results.length;
    }
  }
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd ~/dev/strike-mcp
pnpm test
```

Expected: all tests pass, typecheck clean.

- [ ] **Step 5: Commit**

```bash
cd ~/dev/strike-mcp
git add -A
git commit -m "feat(bubble): add listAll for full-collection pagination with optional cap"
```

---

## Task 7: Entity registry

**Files:**
- Create: `~/dev/strike-mcp/src/entities.ts`
- Create: `~/dev/strike-mcp/tests/entities.test.ts`

**Why:** We need a single source of truth for "which Bubble types do we care about?" — used by `inspect_workspace` (to know what to count) and by Phase 2's research engine. Keeping it in one file means Phase 2 extends it instead of duplicating it.

**Important:** The Bubble type names below are placeholders where we don't yet know the exact name. The **first time** `research_entity` runs in Phase 2, it will confirm or correct each of these against the real Bubble schema. For Phase 1 we only need `workspace` and a best-guess list of types to count in `inspect_workspace`. The counts don't have to be perfect — incorrect type names should return 0, not crash.

- [ ] **Step 1: Write the failing test**

Create `~/dev/strike-mcp/tests/entities.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  ENTITY_REGISTRY,
  getEntityByName,
  allEntityNames,
} from "../src/entities.js";

describe("entity registry", () => {
  it("includes workspace as a known entity", () => {
    const ws = getEntityByName("workspace");
    expect(ws).toBeDefined();
    expect(ws?.bubbleType).toBe("workspace");
  });

  it("lists all entity names", () => {
    const names = allEntityNames();
    expect(names).toContain("workspace");
    expect(names).toContain("locations");
    expect(names).toContain("shifts");
    expect(names.length).toBeGreaterThan(5);
  });

  it("returns undefined for unknown entity", () => {
    expect(getEntityByName("nonexistent")).toBeUndefined();
  });

  it("each entry has a description", () => {
    for (const entry of ENTITY_REGISTRY) {
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd ~/dev/strike-mcp
pnpm test
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `entities.ts`**

Create `~/dev/strike-mcp/src/entities.ts`:

```ts
/**
 * The list of Bubble entity types strike-mcp knows how to work with.
 *
 * - `name` is strike-mcp's internal name (used in tool arguments).
 * - `bubbleType` is the Bubble Data API type name (used as the URL segment).
 * - `workspaceFieldKey` is the display-name key on that type's records that
 *   links to a workspace. For the workspace type itself it is null.
 *
 * Bubble type names are provisional for Phase 1. Phase 2's `research_entity`
 * will verify each one against the real Bubble schema and update this file
 * if any are wrong.
 */
export interface EntityEntry {
  name: string;
  bubbleType: string;
  workspaceFieldKey: string | null;
  description: string;
}

export const ENTITY_REGISTRY: readonly EntityEntry[] = [
  {
    name: "workspace",
    bubbleType: "workspace",
    workspaceFieldKey: null,
    description: "The workspace (tenant) record itself.",
  },
  {
    name: "locations",
    bubbleType: "location",
    workspaceFieldKey: "workspace",
    description: "Physical sites / venues belonging to a workspace.",
  },
  {
    name: "departments",
    bubbleType: "department",
    workspaceFieldKey: "workspace",
    description: "Organizational departments inside a workspace.",
  },
  {
    name: "teams",
    bubbleType: "team",
    workspaceFieldKey: "workspace",
    description: "Team groupings within a workspace.",
  },
  {
    name: "users",
    bubbleType: "User",
    workspaceFieldKey: "workspace",
    description: "Users (employees, managers, admins) of a workspace.",
  },
  {
    name: "shifts",
    bubbleType: "shift_satellite",
    workspaceFieldKey: "workspace",
    description: "Individual shift records. Expect weird shapes on older records.",
  },
  {
    name: "shift_templates",
    bubbleType: "shift_template",
    workspaceFieldKey: "workspace",
    description: "Reusable shift template definitions.",
  },
  {
    name: "tasks",
    bubbleType: "task",
    workspaceFieldKey: "workspace",
    description: "Operational tasks assigned in a workspace.",
  },
  {
    name: "routines",
    bubbleType: "routine",
    workspaceFieldKey: "workspace",
    description: "Recurring routines.",
  },
  {
    name: "manuals",
    bubbleType: "manual",
    workspaceFieldKey: "workspace",
    description: "Employee / operational manuals.",
  },
  {
    name: "training",
    bubbleType: "training",
    workspaceFieldKey: "workspace",
    description: "Training programs and modules.",
  },
  {
    name: "inventory",
    bubbleType: "inventory_item",
    workspaceFieldKey: "workspace",
    description: "Inventory items tracked by a workspace.",
  },
  {
    name: "supplements",
    bubbleType: "supplement",
    workspaceFieldKey: "workspace",
    description: "Supplements / add-ons.",
  },
  {
    name: "rules",
    bubbleType: "rule",
    workspaceFieldKey: "workspace",
    description: "Business rules and policies.",
  },
];

export function getEntityByName(name: string): EntityEntry | undefined {
  return ENTITY_REGISTRY.find((e) => e.name === name);
}

export function allEntityNames(): string[] {
  return ENTITY_REGISTRY.map((e) => e.name);
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd ~/dev/strike-mcp
pnpm test
```

Expected: all 4 entity tests pass.

- [ ] **Step 5: Commit**

```bash
cd ~/dev/strike-mcp
git add -A
git commit -m "feat(entities): add entity registry as single source of truth"
```

---

## Task 8: `list_workspaces` tool

**Files:**
- Create: `~/dev/strike-mcp/src/tools/list_workspaces.ts`
- Create: `~/dev/strike-mcp/tests/tools/list_workspaces.test.ts`

**Tool contract:**
- Input: none
- Output: `{ workspaces: [{ id, name, createdAt, modifiedAt }] }`

**Why the name key logic:** We do not yet know whether workspace name is stored as `name_text`, `Name`, or `Titel`. The tool tries a short list of candidate keys and falls back to `"(unnamed)"` if none hit. Phase 2 research will confirm the real key and update this code.

- [ ] **Step 1: Write the failing test**

Create `~/dev/strike-mcp/tests/tools/list_workspaces.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { listWorkspacesTool } from "../../src/tools/list_workspaces.js";
import { BubbleClient } from "../../src/bubble/client.js";

function makeClient(records: Array<Record<string, unknown>>): BubbleClient {
  const client = new BubbleClient(
    { bubbleAppUrl: "https://x", bubbleApiToken: "t" },
    vi.fn() as unknown as typeof fetch,
  );
  vi.spyOn(client, "listAll").mockResolvedValue(records as never);
  return client;
}

describe("list_workspaces tool", () => {
  it("returns an empty list when no workspaces exist", async () => {
    const client = makeClient([]);
    const result = await listWorkspacesTool.execute({}, { bubble: client });
    expect(result.workspaces).toEqual([]);
  });

  it("maps Bubble records to workspace summary objects", async () => {
    const client = makeClient([
      {
        _id: "1612345678901x111111111111111111",
        "Created Date": "2023-01-15T10:00:00.000Z",
        "Modified Date": "2026-03-20T08:42:00.000Z",
        name_text: "Strøm Mat & Bar",
      },
      {
        _id: "1612345678902x222222222222222222",
        "Created Date": "2023-02-01T09:00:00.000Z",
        "Modified Date": "2026-01-10T14:00:00.000Z",
        name_text: "Kafé Ost",
      },
    ]);
    const result = await listWorkspacesTool.execute({}, { bubble: client });
    expect(result.workspaces).toHaveLength(2);
    expect(result.workspaces[0]).toEqual({
      id: "1612345678901x111111111111111111",
      name: "Strøm Mat & Bar",
      createdAt: "2023-01-15T10:00:00.000Z",
      modifiedAt: "2026-03-20T08:42:00.000Z",
    });
  });

  it("falls back to '(unnamed)' when no known name key is present", async () => {
    const client = makeClient([
      {
        _id: "abc",
        "Created Date": "2023-01-01T00:00:00.000Z",
      },
    ]);
    const result = await listWorkspacesTool.execute({}, { bubble: client });
    expect(result.workspaces[0].name).toBe("(unnamed)");
  });

  it("tries multiple candidate name keys", async () => {
    const client = makeClient([
      { _id: "a", Name: "Alpha" },
      { _id: "b", Titel: "Bravo" },
      { _id: "c", name_text: "Charlie" },
    ]);
    const result = await listWorkspacesTool.execute({}, { bubble: client });
    expect(result.workspaces.map((w) => w.name)).toEqual([
      "Alpha",
      "Bravo",
      "Charlie",
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd ~/dev/strike-mcp
pnpm test
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the tool**

Create `~/dev/strike-mcp/src/tools/list_workspaces.ts`:

```ts
import { z } from "zod";
import type { BubbleClient } from "../bubble/client.js";
import type { BubbleRecord } from "../bubble/types.js";

export interface ToolContext {
  bubble: BubbleClient;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  createdAt: string | null;
  modifiedAt: string | null;
}

export interface ListWorkspacesResult {
  workspaces: WorkspaceSummary[];
}

const NAME_KEY_CANDIDATES = ["name_text", "Name", "Titel", "title", "name"];

function pickName(record: BubbleRecord): string {
  for (const key of NAME_KEY_CANDIDATES) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return "(unnamed)";
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export const listWorkspacesTool = {
  name: "list_workspaces",
  description:
    "List all workspaces in the configured Bubble.io instance. Returns ID, best-effort name, created/modified timestamps.",
  inputSchema: z.object({}),
  execute: async (
    _input: Record<string, never>,
    ctx: ToolContext,
  ): Promise<ListWorkspacesResult> => {
    const records = await ctx.bubble.listAll("workspace", {});
    const workspaces = records.map<WorkspaceSummary>((record) => ({
      id: record._id,
      name: pickName(record),
      createdAt: asString(record["Created Date"]),
      modifiedAt: asString(record["Modified Date"]),
    }));
    return { workspaces };
  },
};
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd ~/dev/strike-mcp
pnpm test
```

Expected: all 4 list_workspaces tests pass.

- [ ] **Step 5: Commit**

```bash
cd ~/dev/strike-mcp
git add -A
git commit -m "feat(tools): add list_workspaces tool with fallback name resolution"
```

---

## Task 9: `inspect_workspace` tool

**Files:**
- Create: `~/dev/strike-mcp/src/tools/inspect_workspace.ts`
- Create: `~/dev/strike-mcp/tests/tools/inspect_workspace.test.ts`

**Tool contract:**
- Input: `{ workspaceId: string }`
- Output: `{ workspaceId, counts: { [entityName]: number }, errors: [{ entity, message }] }`

**Behavior:**
- For each entry in the entity registry (except the workspace entity itself), query Bubble for records where `workspaceFieldKey === workspaceId` and record the count.
- Uses server-side `constraints` as a hint but follows the skill's warning: do not trust server-side filtering blindly. For Phase 1, the count is "records the server returned for this constraint" — good enough for scope overview. Phase 2 will tighten this if needed.
- If a type does not exist in the Bubble schema (e.g. our guessed `bubbleType` is wrong), the API returns 404. We catch that per-entity and record it in `errors`, not fail the whole tool.
- We cap each per-entity query at `maxRecords = 5000` so an accidental huge type does not hang the tool. If the real count exceeds the cap, `counts[entity]` is `5000` and we add a warning.

- [ ] **Step 1: Write the failing test**

Create `~/dev/strike-mcp/tests/tools/inspect_workspace.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { inspectWorkspaceTool } from "../../src/tools/inspect_workspace.js";
import { BubbleClient } from "../../src/bubble/client.js";
import { BubbleNotFoundError, BubbleApiError } from "../../src/bubble/errors.js";

function makeClientWith(
  perType: Record<string, Array<Record<string, unknown>> | Error>,
): BubbleClient {
  const client = new BubbleClient(
    { bubbleAppUrl: "https://x", bubbleApiToken: "t" },
    vi.fn() as unknown as typeof fetch,
  );
  vi.spyOn(client, "listAll").mockImplementation(async (type: string) => {
    const entry = perType[type];
    if (entry === undefined) return [] as never;
    if (entry instanceof Error) throw entry;
    return entry as never;
  });
  return client;
}

describe("inspect_workspace tool", () => {
  it("returns counts for each entity type", async () => {
    const client = makeClientWith({
      location: [{ _id: "l1" }, { _id: "l2" }],
      department: [{ _id: "d1" }],
      team: [],
      User: [{ _id: "u1" }, { _id: "u2" }, { _id: "u3" }],
      shift_satellite: [{ _id: "s1" }],
      shift_template: [],
      task: [],
      routine: [],
      manual: [],
      training: [],
      inventory_item: [],
      supplement: [],
      rule: [],
    });
    const result = await inspectWorkspaceTool.execute(
      { workspaceId: "ws-1" },
      { bubble: client },
    );
    expect(result.workspaceId).toBe("ws-1");
    expect(result.counts.locations).toBe(2);
    expect(result.counts.departments).toBe(1);
    expect(result.counts.users).toBe(3);
    expect(result.counts.shifts).toBe(1);
    expect(result.errors).toEqual([]);
  });

  it("records 404 errors per entity without failing the tool", async () => {
    const client = makeClientWith({
      location: [{ _id: "l1" }],
      department: new BubbleNotFoundError("type not found", null),
      team: [],
      User: [],
      shift_satellite: [],
      shift_template: [],
      task: [],
      routine: [],
      manual: [],
      training: [],
      inventory_item: [],
      supplement: [],
      rule: [],
    });
    const result = await inspectWorkspaceTool.execute(
      { workspaceId: "ws-1" },
      { bubble: client },
    );
    expect(result.counts.locations).toBe(1);
    expect(result.counts.departments).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].entity).toBe("departments");
  });

  it("rethrows non-404 Bubble errors", async () => {
    const client = makeClientWith({
      location: new BubbleApiError("boom", 500, null),
      department: [],
      team: [],
      User: [],
      shift_satellite: [],
      shift_template: [],
      task: [],
      routine: [],
      manual: [],
      training: [],
      inventory_item: [],
      supplement: [],
      rule: [],
    });
    await expect(
      inspectWorkspaceTool.execute({ workspaceId: "ws-1" }, { bubble: client }),
    ).rejects.toBeInstanceOf(BubbleApiError);
  });

  it("passes the workspace constraint to listAll for non-workspace entities", async () => {
    const client = new BubbleClient(
      { bubbleAppUrl: "https://x", bubbleApiToken: "t" },
      vi.fn() as unknown as typeof fetch,
    );
    const spy = vi.spyOn(client, "listAll").mockResolvedValue([] as never);

    await inspectWorkspaceTool.execute(
      { workspaceId: "ws-1" },
      { bubble: client },
    );

    const firstCall = spy.mock.calls.find((c) => c[0] === "location");
    expect(firstCall).toBeDefined();
    const opts = firstCall![1] as { constraints?: unknown[] };
    expect(opts.constraints).toBeDefined();
    expect(opts.constraints).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd ~/dev/strike-mcp
pnpm test
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the tool**

Create `~/dev/strike-mcp/src/tools/inspect_workspace.ts`:

```ts
import { z } from "zod";
import type { BubbleClient } from "../bubble/client.js";
import { BubbleNotFoundError } from "../bubble/errors.js";
import { ENTITY_REGISTRY } from "../entities.js";
import type { ToolContext } from "./list_workspaces.js";

const MAX_RECORDS_PER_ENTITY = 5000;

export interface InspectError {
  entity: string;
  message: string;
}

export interface InspectResult {
  workspaceId: string;
  counts: Record<string, number>;
  errors: InspectError[];
  warnings: string[];
}

export const inspectWorkspaceTool = {
  name: "inspect_workspace",
  description:
    "Count the records per entity type belonging to a given workspace. Returns a scope overview used for migration planning.",
  inputSchema: z.object({
    workspaceId: z.string().min(1),
  }),
  execute: async (
    input: { workspaceId: string },
    ctx: ToolContext,
  ): Promise<InspectResult> => {
    const counts: Record<string, number> = {};
    const errors: InspectError[] = [];
    const warnings: string[] = [];

    for (const entity of ENTITY_REGISTRY) {
      if (entity.workspaceFieldKey === null) continue;

      try {
        const records = await ctx.bubble.listAll(entity.bubbleType, {
          maxRecords: MAX_RECORDS_PER_ENTITY,
          constraints: [
            {
              key: entity.workspaceFieldKey,
              constraint_type: "equals",
              value: input.workspaceId,
            },
          ],
        });
        counts[entity.name] = records.length;
        if (records.length >= MAX_RECORDS_PER_ENTITY) {
          warnings.push(
            `${entity.name}: capped at ${MAX_RECORDS_PER_ENTITY}; actual count may be higher`,
          );
        }
      } catch (err) {
        if (err instanceof BubbleNotFoundError) {
          counts[entity.name] = 0;
          errors.push({
            entity: entity.name,
            message: `Bubble type "${entity.bubbleType}" not found`,
          });
        } else {
          throw err;
        }
      }
    }

    return { workspaceId: input.workspaceId, counts, errors, warnings };
  },
};
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd ~/dev/strike-mcp
pnpm test
```

Expected: all 4 inspect_workspace tests pass, previous tests still pass.

- [ ] **Step 5: Commit**

```bash
cd ~/dev/strike-mcp
git add -A
git commit -m "feat(tools): add inspect_workspace tool with per-entity error handling"
```

---

## Task 10: MCP server entry point

**Files:**
- Create: `~/dev/strike-mcp/src/index.ts`

**What this does:** Wires the tools into an actual MCP server using `@modelcontextprotocol/sdk`, listens on stdio, and registers both tools. This is the only file with no unit tests — we smoke-test it in Task 11 via Claude Code.

- [ ] **Step 1: Implement `index.ts`**

Create `~/dev/strike-mcp/src/index.ts`:

```ts
#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { loadConfig, ConfigError } from "./config.js";
import { createLogger } from "./logger.js";
import { BubbleClient } from "./bubble/client.js";
import { listWorkspacesTool } from "./tools/list_workspaces.js";
import { inspectWorkspaceTool } from "./tools/inspect_workspace.js";

const log = createLogger("server");

async function main(): Promise<void> {
  let config;
  try {
    config = loadConfig(process.env);
  } catch (err) {
    if (err instanceof ConfigError) {
      log.error("config error", { message: err.message });
      process.exit(1);
    }
    throw err;
  }

  const bubble = new BubbleClient(config);
  const ctx = { bubble };

  const server = new Server(
    { name: "strike-mcp", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  const tools = [listWorkspacesTool, inspectWorkspaceTool];

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: true,
        },
      })),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = tools.find((t) => t.name === request.params.name);
    if (!tool) {
      throw new Error(`Unknown tool: ${request.params.name}`);
    }
    const parsed = tool.inputSchema.parse(request.params.arguments ?? {});
    const result = await tool.execute(parsed as never, ctx);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log.info("server started", { tools: tools.length });
}

main().catch((err) => {
  log.error("fatal", { message: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
```

- [ ] **Step 2: Build and verify it compiles**

```bash
cd ~/dev/strike-mcp
pnpm build
```

Expected: `dist/index.js` exists, no TS errors.

- [ ] **Step 3: Verify the tool surface is what we expect (list-tools probe)**

Run the server and feed it a manual JSON-RPC `tools/list` request via stdin:

```bash
cd ~/dev/strike-mcp
BUBBLE_APP_URL=https://fake.bubbleapps.io BUBBLE_API_TOKEN=fake-token \
  node dist/index.js <<'EOF'
{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}
EOF
```

Expected: a JSON response on stdout containing `"name":"list_workspaces"` and `"name":"inspect_workspace"`. Log lines appear on stderr. Process may hang after responding — that is expected for stdio servers. Hit Ctrl+C to exit.

- [ ] **Step 4: Run the full test suite**

```bash
cd ~/dev/strike-mcp
pnpm test
pnpm typecheck
```

Expected: all tests pass, typecheck clean.

- [ ] **Step 5: Commit**

```bash
cd ~/dev/strike-mcp
git add -A
git commit -m "feat(server): wire MCP stdio server with tool dispatch"
```

---

## Task 11: Claude Code registration and smoke test

**Files:**
- Create: `~/dev/strike-mcp/.mcp.json.example`

**Goal:** Prove end-to-end that Claude Code can start `strike-mcp`, call `list_workspaces`, and get a real response from the production Smartout Bubble instance.

**Important:** This task requires real Bubble credentials. Pontus runs these manually — do not commit real credentials to git.

- [ ] **Step 1: Create the registration example file**

Create `~/dev/strike-mcp/.mcp.json.example`:

```json
{
  "mcpServers": {
    "strike-mcp": {
      "command": "node",
      "args": ["/home/sxtnl/dev/strike-mcp/dist/index.js"],
      "env": {
        "BUBBLE_APP_URL": "https://smartout.bubbleapps.io",
        "BUBBLE_API_TOKEN": "REPLACE_FROM_1PASSWORD"
      }
    }
  }
}
```

- [ ] **Step 2: Document the smoke test procedure in README**

Append to `~/dev/strike-mcp/README.md`:

```markdown

## Smoke test (Phase 1)

1. Build: `pnpm build`
2. Copy `.mcp.json.example` to your project's `.mcp.json` (or `~/.claude/.mcp.json`), replace `REPLACE_FROM_1PASSWORD` with the real Bubble API token from 1Password (`op://smartout_ai_prod/bubble/api-token` or wherever it lives).
3. Restart Claude Code so it picks up the MCP server.
4. In a Claude Code session, ask: "Use strike-mcp to list all workspaces."
5. Expected: a list of Smartout workspaces with IDs and names.
6. Then: "Inspect workspace <id>"
7. Expected: counts per entity type, possibly with errors for types whose Bubble name we guessed wrong (those get corrected in Phase 2).
```

- [ ] **Step 3: Execute the smoke test manually**

This is a manual step for the person running the plan. Walk through steps 1–7 from the README. Record the results in the PR description or in `docs/superpowers/notes/phase-1-smoke-test.md`.

**Expected outcome:**
- `list_workspaces` returns a populated list (Smartout has many workspaces)
- `inspect_workspace <some-id>` returns counts. Some entities may return errors if our Bubble type guess is wrong — record those in the smoke test notes for Phase 2 to correct.

**If the smoke test fails:**
- Check stderr output (Claude Code shows MCP server stderr in its logs)
- Most common causes: wrong `BUBBLE_APP_URL` (missing subdomain), wrong token, `dist/index.js` not built
- Do NOT proceed to commit if smoke test fails. Debug first.

- [ ] **Step 4: Commit the smoke test docs (no credentials)**

```bash
cd ~/dev/strike-mcp
git add -A
git commit -m "docs: add Claude Code registration example and smoke test procedure"
```

- [ ] **Step 5: Final verification**

```bash
cd ~/dev/strike-mcp
pnpm typecheck
pnpm test
pnpm build
git status
git log --oneline
```

Expected:
- typecheck clean
- all tests pass
- build succeeds
- working tree clean
- ~11 commits in the log, one per task

Phase 1 is complete when all of the above succeed AND the smoke test returned a real list of workspaces from production Bubble.

---

## Phase 1 Exit Criteria

- [x] `strike-mcp` is a pnpm package at `~/dev/strike-mcp/`
- [x] Logger writes only to stderr (critical for stdio MCP)
- [x] Config loads from env with typed errors
- [x] `BubbleClient` has `listType` (single page) and `listAll` (full pagination) with mockable fetch
- [x] Typed error hierarchy for Bubble API responses
- [x] Entity registry as single source of truth
- [x] `list_workspaces` tool works end-to-end against real Bubble
- [x] `inspect_workspace` tool returns per-entity counts and records per-entity errors without crashing
- [x] MCP server wired with stdio transport and dispatches both tools
- [x] Claude Code can register and call the server
- [x] Full test suite passes, typecheck clean, build succeeds

After this plan is executed, Phase 2 (research engine) can begin. Phase 2 will extend `entities.ts`, add `mappings/`, add `research_entity` tool, and confirm or correct the provisional Bubble type names used in Phase 1.
